import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { LoadedActor } from '../apps/web/lib/three/actor-assets.ts';
import { readCharacterManifest } from '../apps/web/lib/three/character-manifest-values.ts';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const publicRoot = new URL('../apps/web/public/', import.meta.url);
export const manifest = readCharacterManifest(
    JSON.parse(readFileSync(new URL('models/characters/manifest.json', publicRoot), 'utf8')),
  ),
  loads = new Map<string, Promise<GLTF>>();
function load(url: string): Promise<GLTF> {
  const cached = loads.get(url);
  if (cached) {
    return cached;
  }
  // Keep native geometry, skinning and tracks; CPU contact review does not need
  // the browser's image decoders. Keep material roles for surface selection.
  const bytes = readFileSync(new URL(`.${url}`, publicRoot)),
    length = bytes.readUInt32LE(12),
    doc: unknown = JSON.parse(bytes.subarray(20, 20 + length).toString('utf8'));
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    throw Error('Invalid GLTF fixture');
  }
  for (const key of ['images', 'textures', 'samplers']) {
    Reflect.deleteProperty(doc, key);
  }
  if ('materials' in doc) {
    const materials: unknown = doc.materials;
    if (!Array.isArray(materials)) {
      throw Error('Invalid GLTF materials');
    }
    doc.materials = materials.map((material: unknown) => {
      if (
        typeof material !== 'object' ||
        material === null ||
        !('name' in material) ||
        typeof material.name !== 'string'
      ) {
        throw Error('Invalid GLTF material');
      }
      return { name: material.name, ...('extras' in material ? { extras: material.extras } : {}) };
    });
  }
  const json = Buffer.from(JSON.stringify(doc)),
    padded = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]),
    binary = bytes.subarray(20 + length),
    header = Buffer.from(bytes.subarray(0, 20));
  header.writeUInt32LE(20 + padded.length + binary.length, 8);
  header.writeUInt32LE(padded.length, 12);
  const buffer = Buffer.concat([header, padded, binary]),
    promise = new GLTFLoader().parseAsync(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length),
      '',
    );
  loads.set(url, promise);
  return promise;
}
export async function publishedActor(id: string, lod = 1): Promise<LoadedActor> {
  const appearance = Array.isArray(manifest.appearances)
    ? manifest.appearances.find((appearance) => appearance.id === id)
    : manifest.appearances[id];
  if (!appearance) {
    throw Error(`Missing fixture appearance: ${id}`);
  }
  const bank = manifest.animationLibraries[appearance.animationLibrary],
    level = appearance.lods[lod];
  if (!bank || !level) {
    throw Error('Missing fixture animation or level');
  }
  const [body, animation, equipment] = await Promise.all([
    load(level.url),
    load(bank.url),
    load(manifest.equipment.url),
  ]);
  return { manifest, appearance, body, animation, equipment, clips: bank.clips, lod };
}
