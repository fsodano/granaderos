import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';

const assets = new URL('../web/public/models/characters/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', assets), 'utf8'));
const digest = raw => createHash('sha256').update(raw).digest('hex');

function rgbaPng(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const data = [];
  let width, height, channels;
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4);
      assert.equal(chunk[8], 8); assert.ok([2, 6].includes(chunk[9]), 'RGB8 or RGBA8');
      assert.deepEqual([...chunk.subarray(10)], [0, 0, 0], 'Without interlacing'); channels = chunk[9] === 6 ? 4 : 3;
    }
    if (type === 'IDAT') data.push(chunk);
    offset += length + 12;
  }
  const filtered = inflateSync(Buffer.concat(data)), pixels = Buffer.alloc(width * height * channels);
  const paeth = (a, b, c) => { const p = a + b - c, x = Math.abs(p - a), y = Math.abs(p - b), z = Math.abs(p - c); return x <= y && x <= z ? a : y <= z ? b : c; };
  for (let y = 0; y < height; y++) {
    const row = y * width * channels, input = y * (width * channels + 1), filter = filtered[input];
    assert.ok(filter <= 4);
    for (let x = 0; x < width * channels; x++) {
      const a = x < channels ? 0 : pixels[row + x - channels], b = y ? pixels[row + x - width * channels] : 0, c = y && x >= channels ? pixels[row + x - width * channels - channels] : 0;
      pixels[row + x] = (filtered[input + 1 + x] + [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter]) & 255;
    }
  }
  return {width, height, pixel: (x, y) => [...pixels.subarray((y * width + x) * channels, (y * width + x + 1) * channels), ...(channels === 3 ? [255] : [])]};
}

for (const lod of [0, 1, 2]) test(`woman-shawl LOD${lod} separates the charcoal skirt from the retained burgundy shawl`, () => {
  const record = manifest.appearances['woman-shawl'].lods[lod], raw = readFileSync(new URL(`.${record.url}`, new URL('../web/public/', import.meta.url)));
  assert.equal(digest(raw), record.sha256); assert.equal(raw.length, record.bytes);
  const size = raw.readUInt32LE(12), doc = JSON.parse(raw.subarray(20, 20 + size)), binary = raw.subarray(28 + size);
  const node = doc.nodes.find(n => n.name === `Human_legwear_LOD${lod}`), primitive = doc.meshes[node.mesh].primitives[0];
  const material = doc.materials[primitive.material], retained = doc.materials.find(m => m.name === 'Apparel_Atlas' && m.normalTexture.index === material.normalTexture.index && m.pbrMetallicRoughness.metallicRoughnessTexture.index === material.pbrMetallicRoughness.metallicRoughnessTexture.index);
  assert.ok(retained, 'The original legwear material stays in the body');
  assert.equal(material.name, 'Apparel_Atlas_Charcoal_Legwear');
  const cloned = structuredClone(material); cloned.name = retained.name;
  cloned.pbrMetallicRoughness.baseColorTexture.index = retained.pbrMetallicRoughness.baseColorTexture.index;
  assert.deepEqual(cloned, retained, 'Roughness, normals, factors, extensions and every other material field stay exact');
  const color = m => rgbaPng(readFileSync(new URL(doc.images[doc.textures[m.pbrMetallicRoughness.baseColorTexture.index].source].uri, assets)));
  const atlas = color(material), old = color(retained);
  assert.equal(atlas.width, 128); assert.equal(atlas.height, 128);
  let changed = 0;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    if (x >= 32 && x < 64 && y >= 96 && y < 128) {
      assert.deepEqual(atlas.pixel(x, y), [49, 48, 49, 255]);
      assert.deepEqual(old.pixel(x, y), [91, 44, 53, 255]); changed++;
    } else assert.deepEqual(atlas.pixel(x, y), old.pixel(x, y), 'Other atlas pigments stay exact');
  }
  assert.equal(changed, 1024);
  const a = doc.accessors[primitive.attributes.TEXCOORD_0], view = doc.bufferViews[a.bufferView];
  assert.equal(a.componentType, 5126); assert.equal(a.type, 'VEC2'); assert.equal(a.sparse, undefined);
  for (let i = 0; i < a.count; i++) {
    const offset = (view.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (view.byteStride ?? 8);
    const x = binary.readFloatLE(offset) * 128 - .5, y = binary.readFloatLE(offset + 4) * 128 - .5;
    for (const px of [Math.floor(x), Math.ceil(x)]) for (const py of [Math.floor(y), Math.ceil(y)]) assert.deepEqual(atlas.pixel(px, py), [49, 48, 49, 255], 'The complete filtered UV neighborhood stays on the skirt pigment');
  }
  const outfit = doc.nodes.find(n => n.name === `Human_outfit_LOD${lod}`);
  assert.notEqual(doc.meshes[outfit.mesh].primitives[0].material, primitive.material, 'The shawl keeps its own retained atlas');
  if (lod) {
    assert.equal(record.nativeClothTopology.sourceSha256, manifest.appearances['woman-shawl'].lods[0].sha256);
    assert.equal(doc.meshes[node.mesh].extras.nativeClothTopology.sourceSha256, record.nativeClothTopology.sourceSha256);
  }
});
