import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {GLTFLoader} from '../web/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {Texture} from '../web/node_modules/three/build/three.module.js';
import {assets as root,manifest} from './character-predecessor-fixture.mjs';

for (const lod of [0, 1, 2]) test(`woman-shawl LOD${lod} uses a separate base-colour UV without changing native surface maps`, async () => {
  const raw = readFileSync(new URL(`woman-shawl-lod${lod}.glb`, root));
  const loader = new GLTFLoader();
  // Use the real parser/material setup. Stub only image I/O for this CPU
  // channel test; normal HUD captures verify the real decoded PNG appearance.
  loader.register(parser => ({name: 'native-hem-source-textures', loadTexture(index) {
    const texture = new Texture();
    texture.userData.sourceURI = parser.json.images[parser.json.textures[index].source].uri;
    return Promise.resolve(texture);
  }}));
  const asset = await loader.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
  const mesh = asset.scene.getObjectByName(`Human_legwear_LOD${lod}`), material = mesh.material;
  assert.equal(material.name, 'Apparel_Atlas_Charcoal_Legwear_Rust_Hem');
  assert.equal(material.map.channel, 1, 'Only base colour uses the new UV');
  assert.equal(material.normalMap.channel, 0); assert.equal(material.roughnessMap.channel, 0); assert.equal(material.metalnessMap.channel, 0);
  assert.notEqual(material.map.userData.sourceURI, material.normalMap.userData.sourceURI);
  const position = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv, pigment = mesh.geometry.attributes.uv1;
  assert.equal(uv.count, position.count); assert.equal(pigment.count, position.count);
  const recipe = mesh.userData.nativeSkirtHem;
  assert.deepEqual(recipe, manifest.appearances['woman-shawl'].lods[lod].nativeSkirtHem);
  assert.deepEqual(recipe.rustSRGB, [105, 50, 40]); assert.deepEqual(recipe.charcoalSRGB, [49, 48, 49]);
  assert.ok(Math.abs(recipe.nativeBandWidth - 4 / 367 * 1.76) < .0002, 'Band width follows the retained source ratio within 0.2 mm');
  assert.ok(Math.abs(recipe.nativeBandCentreInset - 16 / 367 * 1.76) < 1e-12);
  const [bottom, top] = recipe.restHeightRange, centre = (recipe.rustRows[0] + recipe.rustRows[1]) / 2, span = recipe.imageSize[1] - 4;
  const offset = centre - (top - bottom - recipe.nativeBandCentreInset) / (top - bottom) * span;
  const adjacent = Array.from({length: position.count}, () => new Set()), indices = mesh.geometry.index;
  for (let i = 0; i < indices.count; i += 3) {
    const tri = [0, 1, 2].map(n => indices.getX(i + n));
    for (let n = 0; n < 3; n++) {adjacent[tri[n]].add(tri[(n + 1) % 3]); adjacent[tri[(n + 1) % 3]].add(tri[n]);}
  }
  const hem = Array.from({length: position.count}, (_, i) => i).filter(i => Math.abs(position.getY(i) - bottom) < .002);
  const shell = new Set([hem[0]]), queue = [hem[0]];
  for (let i = 0; i < queue.length; i++) for (const next of adjacent[queue[i]]) if (!shell.has(next)) {shell.add(next); queue.push(next);}
  assert.equal(shell.size, 675); assert.ok(hem.every(i => shell.has(i)));
  assert.equal(recipe.sewnSkirtSelection, 'indexed-component-at-authored-hem');
  assert.equal(recipe.sewnSkirtVertexCount, 675); assert.equal(recipe.nativeUnderlayerVertexCount, position.count - 675);
  assert.deepEqual(recipe.nativeUnderlayerColourUV, [.5, .25]);
  for (let i = 0; i < position.count; i++) {
    assert.equal(pigment.getX(i), .5);
    if (shell.has(i)) {
      const ratio = Math.max(0, Math.min(1, (top - position.getY(i)) / (top - bottom)));
      assert.ok(Math.abs(pigment.getY(i) - (offset + ratio * span) / recipe.imageSize[1]) < 3.1e-8, 'Sewn colour height mapping remains independent of sparse skirt vertices');
    } else assert.equal(pigment.getY(i), .25, 'Every native underlayer vertex samples only the fixed charcoal patch');
  }
  for (let i = 0; i < indices.count; i += 3) {
    const mask = [0, 1, 2].map(n => shell.has(indices.getX(i + n)));
    assert.ok(mask.every(Boolean) || mask.every(v => !v), 'No triangle interpolates colour between the sewn skirt and native trousers');
    if (mask.every(Boolean)) for (let n = 0; n < 3; n++) for (let k = n + 1; k < 3; k++) {
      const a = indices.getX(i + n), b = indices.getX(i + k);
      if (Math.abs(position.getY(a) - position.getY(b)) < 1e-8) assert.equal(pigment.getY(a), pigment.getY(b), 'Equal-height sewn seam vertices retain equal stripe phase');
    }
  }
  assert.equal(mesh.geometry.morphAttributes.position.length, 3);
  const shawl = asset.scene.getObjectByName(`Human_outfit_LOD${lod}`);
  assert.equal(shawl.material.map.channel, 0, 'The shawl keeps its original atlas and UV');
  assert.ok(!shawl.geometry.attributes.uv1);
  asset.scene.traverse(node => { if (node.geometry) node.geometry.dispose(); });
});


test('authored hem recipe rejects a skirt joined to the native underlayer', () => {
  const recipe = execFileSync('python3', ['-c', `
from pathlib import Path
import importlib.util, json
root=Path.cwd()
def module(name, path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
source=module('source',root/'assets/source/characters-3d/authoring/appearance_palette.py')
glb=module('glb',root/'tools/characters-3d/merge-animation-bank.py')
dec=module('dec',root/'tools/characters-3d/build-long-cloth-support.py').decoded
doc,binary=glb.read_glb(root/'web/public/models/characters/woman-shawl-lod0.glb')
p=next(doc['meshes'][n['mesh']]['primitives'][0] for n in doc['nodes'] if n.get('name')=='Human_legwear_LOD0')
positions=dec(doc,binary,p['attributes']['POSITION'])[1];indices=[v[0] for v in dec(doc,binary,p['indices'])[1]]
shell=source.woman_shawl_sewn_skirt_vertices(positions,indices)
outer=next(i for i in range(len(positions)) if i not in shell)
joined=indices+[next(iter(shell)),outer,outer]
rejected=False
try:source.woman_shawl_sewn_skirt_vertices(positions,joined)
except AssertionError:rejected=True
print(json.dumps({'rejected':rejected,'sewn':len(shell),'underlayer':source.woman_shawl_hem_uv(0,False),'inset':source.WOMAN_SHAWL_HEM_CENTRE_INSET}))
  `], {cwd: new URL('..', import.meta.url), encoding: 'utf8'});
  const actual = JSON.parse(recipe);
  assert.equal(actual.rejected, true); assert.equal(actual.sewn, 675);
  assert.deepEqual(actual.underlayer, [.5, .25]); assert.equal(actual.inset, 16 / 367 * 1.76);
});

test('rust pixels stay inset and the native underlayer samples the charcoal region', () => {
  const raw = execFileSync('python3', ['-c', `
from pathlib import Path
from PIL import Image
import json
root=Path.cwd();image=Image.open(root/'web/public/models/characters/textures/0620e2e93cecf73291dd.png').convert('RGBA')
colours={};rust=[]
for y in range(image.height):
 for x in range(image.width):
  pixel=image.getpixel((x,y));key=','.join(map(str,pixel));colours[key]=colours.get(key,0)+1
  if pixel==(105,50,40,255):rust.append(y)
levels=[];level=0
while True:
 levels.append({'level':level,'size':list(image.size),'underlayerBoxMip':image.getpixel((image.width//2,image.height//4))})
 if image.size==(1,1):break
 image=image.resize((max(1,image.width//2),max(1,image.height//2)),Image.Resampling.BOX);level+=1
print(json.dumps({'colours':colours,'rustRows':sorted(set(rust)),'mips':levels}))
  `], {cwd: new URL('..', import.meta.url), encoding: 'utf8'});
  const actual = JSON.parse(raw);
  assert.deepEqual(actual.colours, {'49,48,49,255': 8032, '105,50,40,255': 160});
  assert.deepEqual(actual.rustRows, [231, 232, 233, 234, 235]);
  for (const level of actual.mips.slice(0, -1)) assert.deepEqual(level.underlayerBoxMip, [49, 48, 49, 255]);
  assert.deepEqual(actual.mips.at(-1).underlayerBoxMip, [51, 49, 49, 255], 'The final one-pixel mip has a small uniform colour average; it carries no stripe geometry');
});
