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
  let material = doc.materials[primitive.material];
  if (doc.meshes[node.mesh].extras.nativeSkirtHem) {
    assert.equal(material.name, 'Apparel_Atlas_Charcoal_Legwear_Rust_Hem');
    // The hem has its own active-map/channel checks. Keep this regression on
    // the retained charcoal recipe and original UV/material payloads.
    material = doc.materials.find(m => m.name === 'Apparel_Atlas_Charcoal_Legwear'
      && m.normalTexture.index === material.normalTexture.index
      && m.pbrMetallicRoughness.metallicRoughnessTexture.index === material.pbrMetallicRoughness.metallicRoughnessTexture.index);
    assert.ok(material, 'The retained charcoal material belongs to the active hem surface');
  }
  const retained = doc.materials.find(m => m.name === 'Apparel_Atlas' && m.normalTexture.index === material.normalTexture.index && m.pbrMetallicRoughness.metallicRoughnessTexture.index === material.pbrMetallicRoughness.metallicRoughnessTexture.index);
  assert.ok(retained, 'The original legwear material stays in the body');
  assert.equal(material.name, 'Apparel_Atlas_Charcoal_Legwear');
  const cloned = structuredClone(material); cloned.name = retained.name;
  cloned.pbrMetallicRoughness.baseColorTexture.index = retained.pbrMetallicRoughness.baseColorTexture.index;
  assert.deepEqual(cloned, retained, 'Roughness, normals, factors, extensions and every other material field stay exact');
  const color = m => rgbaPng(readFileSync(new URL(doc.images[doc.textures[m.pbrMetallicRoughness.baseColorTexture.index].source].uri, assets)));
  const atlas = color(material), old = color(retained);
  assert.equal(atlas.width, atlas.height); assert.equal(atlas.width % 32, 0);
  assert.equal(old.width, atlas.width); assert.equal(old.height, atlas.height);
  const a = doc.accessors[primitive.attributes.TEXCOORD_0], view = doc.bufferViews[a.bufferView];
  assert.equal(a.componentType, 5126); assert.equal(a.type, 'VEC2'); assert.equal(a.sparse, undefined);
  const uv = i => {
    const offset = (view.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (view.byteStride ?? 8);
    return [binary.readFloatLE(offset), binary.readFloatLE(offset + 4)];
  };
  const side = atlas.width / 32, tiles = new Set(Array.from({length:a.count}, (_,i) => uv(i).map(v=>Math.floor(v*side)).join(',')));
  assert.equal(tiles.size, 1); const [tx,ty] = [...tiles][0].split(',').map(Number);
  const originalPigment = old.pixel(tx*32,ty*32);
  assert.ok([[91,44,53,255],[49,48,49,255]].some(colour=>colour.every((v,i)=>v===originalPigment[i])), 'Source starts with legacy burgundy or current authored charcoal');
  let changed = 0;
  for (let y = 0; y < atlas.height; y++) for (let x = 0; x < atlas.width; x++) {
    if (x >= tx*32 && x < (tx+1)*32 && y >= ty*32 && y < (ty+1)*32) {
      assert.deepEqual(atlas.pixel(x, y), [49, 48, 49, 255]);
      assert.deepEqual(old.pixel(x, y), originalPigment); if (originalPigment[0]===91) changed++;
    } else assert.deepEqual(atlas.pixel(x, y), old.pixel(x, y), 'Other atlas pigments stay exact');
  }
  assert.equal(changed, originalPigment[0]===91 ? 1024 : 0);
  for (let i = 0; i < a.count; i++) {
    const [u,v] = uv(i), x = u * atlas.width - .5, y = v * atlas.height - .5;
    for (const px of [Math.floor(x), Math.ceil(x)]) for (const py of [Math.floor(y), Math.ceil(y)]) assert.deepEqual(atlas.pixel(px, py), [49, 48, 49, 255], 'The complete filtered UV neighborhood stays on the skirt pigment');
  }
  const outfit = doc.nodes.find(n => n.name === `Human_outfit_LOD${lod}`);
  assert.notEqual(doc.meshes[outfit.mesh].primitives[0].material, primitive.material, 'The shawl keeps its own retained atlas');
  const outfitPrimitive = doc.meshes[outfit.mesh].primitives[0], outfitAtlas = color(doc.materials[outfitPrimitive.material]);
  const oa = doc.accessors[outfitPrimitive.attributes.TEXCOORD_0], ov = doc.bufferViews[oa.bufferView];
  let burgundyVertices = 0;
  for (let i=0;i<oa.count;i++) {
    const offset=(ov.byteOffset??0)+(oa.byteOffset??0)+i*(ov.byteStride??8), x=Math.floor(binary.readFloatLE(offset)*outfitAtlas.width), y=Math.floor(binary.readFloatLE(offset+4)*outfitAtlas.height);
    if (outfitAtlas.pixel(x,y).join(',')==='91,44,53,255') burgundyVertices++;
  }
  assert.ok(burgundyVertices>=100, 'Actual shawl UVs still sample the source burgundy pigment');
  if (lod) {
    assert.equal(record.nativeClothTopology.sourceSha256, manifest.appearances['woman-shawl'].lods[0].sha256);
    assert.equal(doc.meshes[node.mesh].extras.nativeClothTopology.sourceSha256, record.nativeClothTopology.sourceSha256);
  }
});
