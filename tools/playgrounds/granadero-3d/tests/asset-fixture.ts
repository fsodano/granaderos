import assert from 'node:assert/strict';

type Value = Record<string, unknown>;
type Check = (value: unknown) => boolean;
const record = (value: unknown): value is Value =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown): value is string => typeof value === 'string';
const boolean = (value: unknown) => typeof value === 'boolean';
const array =
  (check: Check): Check =>
  (value) =>
    Array.isArray(value) && value.every(check);
const dictionary =
  (check: Check): Check =>
  (value) =>
    record(value) && Object.values(value).every(check);
const optional = (value: Value, key: string, check: Check) =>
  value[key] === undefined || check(value[key]);
export type Axis = '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z';
const axis = (value: unknown): value is Axis =>
  value === '+X' ||
  value === '-X' ||
  value === '+Y' ||
  value === '-Y' ||
  value === '+Z' ||
  value === '-Z';
interface ReviewClip {
  name: string;
  durationSeconds: number;
  loop: boolean;
  events?: Record<string, number>;
}
interface ReviewManifest {
  asset: string;
  byteLength: number;
  sha256: string;
  clips: ReviewClip[];
  nodes: Record<string, string>;
  materials: { skin: string };
  coordinates: { forward: Axis };
  weaponForwardLocal: Record<string, Axis>;
}
function manifest(value: unknown): value is ReviewManifest {
  return (
    record(value) &&
    text(value['asset']) &&
    finite(value['byteLength']) &&
    text(value['sha256']) &&
    array(
      (clip) =>
        record(clip) &&
        text(clip['name']) &&
        finite(clip['durationSeconds']) &&
        boolean(clip['loop']) &&
        optional(clip, 'events', dictionary(finite)),
    )(value['clips']) &&
    dictionary(text)(value['nodes']) &&
    record(value['materials']) &&
    text(value['materials']['skin']) &&
    record(value['coordinates']) &&
    axis(value['coordinates']['forward']) &&
    dictionary(axis)(value['weaponForwardLocal'])
  );
}
export function readReviewManifest(value: unknown): ReviewManifest {
  assert.ok(
    manifest(value),
    'Review manifest contains typed animation, coordinate and resource declarations',
  );
  return value;
}
interface BufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
}
type AccessorKind = 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' | 'MAT4';
export type ComponentKind = 5120 | 5121 | 5122 | 5123 | 5125 | 5126;
interface Accessor {
  componentType: ComponentKind;
  type: AccessorKind;
  count: number;
  normalized?: boolean;
  bufferView?: number;
  byteOffset?: number;
  sparse?: {
    count: number;
    indices: { bufferView: number; byteOffset?: number; componentType: ComponentKind };
    values: { bufferView: number; byteOffset?: number };
  };
}
export interface FixtureAnimation {
  name: string;
  channels: { sampler: number; target: { node: number; path: string } }[];
  samplers: { input: number; output: number; interpolation?: string }[];
}
interface FixtureGlb {
  asset: { version: string };
  buffers: { byteLength: number; uri?: string }[];
  bufferViews: BufferView[];
  accessors: Accessor[];
  textures: { name?: string }[];
  images: { uri?: string; bufferView: number; mimeType: string }[];
  skins: { joints: number[]; inverseBindMatrices: number }[];
  nodes: { name?: string; children?: number[]; skin?: number; mesh?: number }[];
  meshes: { primitives: { attributes: Record<string, number>; material?: number }[] }[];
  animations: FixtureAnimation[];
  materials: { name?: string }[];
}
const component = (value: unknown): value is ComponentKind =>
  value === 5120 ||
  value === 5121 ||
  value === 5122 ||
  value === 5123 ||
  value === 5125 ||
  value === 5126;
const accessorKind = (value: unknown): value is AccessorKind =>
  value === 'SCALAR' ||
  value === 'VEC2' ||
  value === 'VEC3' ||
  value === 'VEC4' ||
  value === 'MAT4';
const reference = (value: unknown) =>
  record(value) && finite(value['bufferView']) && optional(value, 'byteOffset', finite);
function accessor(value: unknown): value is Accessor {
  return (
    record(value) &&
    component(value['componentType']) &&
    accessorKind(value['type']) &&
    finite(value['count']) &&
    optional(value, 'normalized', boolean) &&
    optional(value, 'bufferView', finite) &&
    optional(value, 'byteOffset', finite) &&
    optional(
      value,
      'sparse',
      (sparse) =>
        record(sparse) &&
        finite(sparse['count']) &&
        reference(sparse['values']) &&
        record(sparse['indices']) &&
        reference(sparse['indices']) &&
        component(sparse['indices']['componentType']),
    )
  );
}
function glb(value: unknown): value is FixtureGlb {
  return (
    record(value) &&
    record(value['asset']) &&
    text(value['asset']['version']) &&
    array(
      (buffer) => record(buffer) && finite(buffer['byteLength']) && optional(buffer, 'uri', text),
    )(value['buffers']) &&
    array(
      (view) =>
        record(view) &&
        finite(view['buffer']) &&
        finite(view['byteLength']) &&
        optional(view, 'byteOffset', finite) &&
        optional(view, 'byteStride', finite),
    )(value['bufferViews']) &&
    array(accessor)(value['accessors']) &&
    array((texture) => record(texture) && optional(texture, 'name', text))(value['textures']) &&
    array(
      (image) =>
        record(image) &&
        finite(image['bufferView']) &&
        text(image['mimeType']) &&
        optional(image, 'uri', text),
    )(value['images']) &&
    array(
      (skin) =>
        record(skin) && array(finite)(skin['joints']) && finite(skin['inverseBindMatrices']),
    )(value['skins']) &&
    array(
      (node) =>
        record(node) &&
        optional(node, 'name', text) &&
        optional(node, 'children', array(finite)) &&
        optional(node, 'skin', finite) &&
        optional(node, 'mesh', finite),
    )(value['nodes']) &&
    array(
      (mesh) =>
        record(mesh) &&
        array(
          (primitive) =>
            record(primitive) &&
            dictionary(finite)(primitive['attributes']) &&
            optional(primitive, 'material', finite),
        )(mesh['primitives']),
    )(value['meshes']) &&
    array(
      (animation) =>
        record(animation) &&
        text(animation['name']) &&
        array(
          (channel) =>
            record(channel) &&
            finite(channel['sampler']) &&
            record(channel['target']) &&
            finite(channel['target']['node']) &&
            text(channel['target']['path']),
        )(animation['channels']) &&
        array(
          (sampler) =>
            record(sampler) &&
            finite(sampler['input']) &&
            finite(sampler['output']) &&
            optional(sampler, 'interpolation', text),
        )(animation['samplers']),
    )(value['animations']) &&
    array((material) => record(material) && optional(material, 'name', text))(value['materials'])
  );
}
export function readFixtureGlb(value: unknown): FixtureGlb {
  assert.ok(
    glb(value),
    'GLB fixture contains typed geometry, animation and embedded-resource declarations',
  );
  return value;
}

export function externalImageUris(value: unknown): string[] {
  assert.ok(record(value), 'GLB resource declaration is an object');
  const images = value['images'];
  if (images === undefined) {
    return [];
  }
  assert.ok(Array.isArray(images), 'GLB images are an array');
  const uris: string[] = [];
  for (const candidate of images) {
    const image: unknown = candidate;
    assert.ok(record(image), 'GLB image is an object');
    const uri = image['uri'];
    if (uri !== undefined) {
      assert.ok(text(uri), 'GLB external image URI is a string');
      uris.push(uri);
    }
  }
  return uris;
}
