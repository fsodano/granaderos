import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {Color,MeshStandardMaterial} from '../web/node_modules/three/build/three.module.js';
import {applySkinPalette} from '../game/skin-palette.js';
import {manifest,readGlb} from './character-bank-fixture.mjs';
const directory=process.env.GRANADEROS_CHARACTER_LIBRARY?pathToFileURL(resolve(process.env.GRANADEROS_CHARACTER_LIBRARY)+sep):new URL('../web/public/models/characters/',import.meta.url);
const generated=new URL('../assets/source/characters-3d/authoring/generated/granadero-skin-colour.png',import.meta.url);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} differs from ${b}`);

test('a coloured albedo reproduces each selected tone and changes palettes without accumulating tint',()=>{
 const reference=[.846873231509858,.4232676699860717,.2788942634768104],material=new MeshStandardMaterial();material.userData.skinAlbedoReference=reference;
 for(const tone of [...Object.values(manifest.skinTones),manifest.skinTones.light]){
  applySkinPalette(material,tone);const target=new Color(tone);
  for(const [i,key]of ['r','g','b'].entries())close(material.color[key]*reference[i],target[key]);
 }
 const clone=material.clone();applySkinPalette(clone,manifest.skinTones.dark);assert.notDeepEqual(clone.color,material.color,'Actor-owned material changes do not alter another palette instance');material.dispose();clone.dispose();
});
test('legacy and invalid-reference materials retain the existing Three palette colour',()=>{
 for(const reference of [undefined,null,[],[1,1],[1,0,1],[1,-1,1],[1,Infinity,1],['1',1,1]]){
  const material=new MeshStandardMaterial();if(reference!==undefined)material.userData.skinAlbedoReference=reference;
  for(const tone of Object.values(manifest.skinTones)){applySkinPalette(material,tone);assert.deepEqual(material.color,new Color(tone));}
  material.dispose();
 }
});
for(const lod of manifest.appearances.granadero.lods)test(`Granadero LOD${lod.lod} keeps generated albedo separate from native surface maps`,()=>{
 const {json,access}=readGlb(lod.url),mi=json.materials.findIndex(m=>m.name==='Skin'),skin=json.materials[mi],colour=skin.pbrMetallicRoughness.baseColorTexture,normal=skin.normalTexture,roughness=skin.pbrMetallicRoughness.metallicRoughnessTexture;
 assert.equal(colour.texCoord,1);assert.equal(normal.texCoord??0,0);assert.equal(roughness.texCoord??0,0);
 const image=json.images[json.textures[colour.index].source],png=readFileSync(new URL(image.uri,directory));assert.equal(digest(png),digest(readFileSync(generated)),'The original generated PNG bytes are packaged intact');assert.equal(skin.extras.skinAlbedoSourceSha256,digest(png));
 assert.equal(skin.extras.skinAlbedoReferenceSpace,'linear-srgb');assert.ok(skin.extras.skinAlbedoReference.every(value=>Number.isFinite(value)&&value>0));
 const target=new Color(manifest.skinTones.light);for(const [i,key]of ['r','g','b'].entries())close(skin.pbrMetallicRoughness.baseColorFactor[i]*skin.extras.skinAlbedoReference[i],target[key]);
 const handJoints=new Set(json.skins[0].joints.map((node,index)=>/^(hand_|thumb_|index_|middle_|ring_|pinky_)/.test(json.nodes[node].name)?index:-1));handJoints.delete(-1);
 for(const primitive of json.meshes.flatMap(m=>m.primitives).filter(p=>p.material===mi)){
  const uv0=access(primitive.attributes.TEXCOORD_0),uv1=access(primitive.attributes.TEXCOORD_1),joint=access(primitive.attributes.JOINTS_0),weight=access(primitive.attributes.WEIGHTS_0),position=access(primitive.attributes.POSITION),count=json.accessors[primitive.attributes.POSITION].count;
  assert.equal(uv0.length,count*2);assert.equal(uv1.length,count*2);let faceMoved=0,hands=0;
  for(let vertex=0;vertex<count;vertex++){
   const delta=Math.hypot(uv1[vertex*2]-uv0[vertex*2],uv1[vertex*2+1]-uv0[vertex*2+1]);assert.ok(Number.isFinite(delta)&&delta<.005,'Registration remains local and bounded');
   if(position[vertex*3+1]>1.55&&delta>1e-6)faceMoved++;
   if([0,1,2,3].some(slot=>handJoints.has(joint[vertex*4+slot])&&weight[vertex*4+slot]>.5)){hands++;assert.equal(delta,0,'Hand and nail UV registration is unchanged');}
  }
  assert.ok(faceMoved>0&&hands>0,'The test samples actual face and hand skin');
 }
});
test('the seven other appearance families keep their existing palette and native albedo domain',()=>{
 for(const appearance of Object.values(manifest.appearances).filter(a=>a.id!=='granadero'))for(const lod of appearance.lods){const {json}=readGlb(lod.url),skin=json.materials.find(m=>m.name===appearance.materials.skin);assert.equal(skin.extras?.skinAlbedoReference,undefined);assert.equal(skin.pbrMetallicRoughness.baseColorTexture.texCoord??0,0);}
});


test('offline review colours match the live palette for generated and native albedos',()=>{
 const references=[null,[.846873231509858,.4232676699860717,.2788942634768104],[],[1,1],[1,0,1],[true,1,1],['1',1,1]];
 const cases=references.flatMap(reference=>Object.values(manifest.skinTones).map(tone=>({tone,reference})));
 const source=fileURLToPath(new URL('../tools/characters-3d/render-review.py',import.meta.url));
 const result=spawnSync(process.platform==='win32'?'python':'python3',['-c',
  "import importlib.util,json,sys;spec=importlib.util.spec_from_file_location('review',sys.argv[1]);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);print(json.dumps([module.skin_palette_linear(c['tone'],c['reference']) for c in json.load(sys.stdin)]))",source],
  {input:JSON.stringify(cases),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);const actual=JSON.parse(result.stdout);assert.equal(actual.length,cases.length);
 for(const [index,{tone,reference}] of cases.entries()){
  const material=new MeshStandardMaterial();material.userData.skinAlbedoReference=reference;applySkinPalette(material,tone);
  for(const [component,key]of ['r','g','b'].entries())assert.ok(Math.abs(actual[index][component]-material.color[key])<1e-9,`${tone} ${JSON.stringify(reference)} ${key}`);
  assert.equal(actual[index][3],1);material.dispose();
 }
});
