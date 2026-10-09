import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import sharp from '../web/node_modules/sharp/lib/index.js';
import {historicalApparelView} from './character-predecessor-fixture.mjs';

// Verify the active correction and colour layers before restoring/replaying the
// frozen apparel output. Keep all old golden anchors and assertions unchanged.
const {readGlb,manifest,assets}=historicalApparelView(),root=new URL('..',import.meta.url);
const baseline=JSON.parse(readFileSync(new URL('./character-apparel-surfaces-baseline.json',import.meta.url)));
const hash=raw=>createHash('sha256').update(raw).digest('hex');
const cache=new Map();
function pixels(uri){if(!cache.has(uri))cache.set(uri,sharp(new URL(uri,assets).pathname).ensureAlpha().raw().toBuffer({resolveWithObject:true}));return cache.get(uri);}
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v;}
function setPath(v,path,value){for(const k of path.slice(0,-1))v=v[k];v[path.at(-1)]=value;}
const linear=v=>v/255<=.04045?v/255/12.92:((v/255+.055)/1.055)**2.4;
const encoded=v=>Math.round(255*(v<=.0031308?v*12.92:1.055*v**(1/2.4)-.055));
const pigments={granadero:{outfit:['35,44,59'],legwear:['38,46,58']},worker:{outfit:['173,162,137','101,86,67'],legwear:['101,86,67']},royalist:{outfit:['206,199,179'],legwear:['202,194,175']},surgeon:{outfit:['74,58,49'],legwear:['64,56,51']},gaucho:{outfit:['111,88,61'],legwear:['64,58,49']},friar:{outfit:['86,63,41'],legwear:['86,63,41']},'woman-scout':{outfit:['91,100,74'],legwear:['149,139,118']},'woman-shawl':{outfit:['200,188,162','91,44,53'],legwear:['49,48,49']}};
const image=(doc,texture)=>doc.images[doc.textures[texture.index].source];

function restoredDocument(json,meta){
 const doc=structuredClone(json);
 for(const item of meta.primitives){assert.equal(doc.meshes[item.mesh].primitives[item.primitive].material,item.material);doc.meshes[item.mesh].primitives[item.primitive].material=item.originalMaterial;}
 for(const patch of meta.documentPatches)setPath(doc,patch.path,patch.before);
 for(const [key,count]of [['materials','originalMaterialCount'],['textures','originalTextureCount'],['images','originalImageCount']])if(doc[key])doc[key]=doc[key].slice(0,meta[count]);
 delete doc.extras.apparelSurface;if(!meta.originalHadExtras)delete doc.extras;
 return doc;
}

for(const [preset,appearance]of Object.entries(manifest.appearances))for(const record of appearance.lods)test(`${preset} LOD${record.lod} broad surfaces preserve exact preceding cloth forms and protected pigment roles`,async()=>{
 const {json,access}=readGlb(record.url),meta=record.apparelSurface,raw=readFileSync(new URL(`${preset}-lod${record.lod}.glb`,assets));
 assert.ok(meta,'The delivered body has a reversible material-only receipt');
 assert.deepEqual(json.extras.apparelSurface,meta);
 assert.equal(meta.beforeSha256,baseline.bodies[`${preset}-lod${record.lod}`]);assert.equal(typeof meta.beforeBytes,'number');assert.equal(meta.originalRecord,undefined);
 assert.equal(meta.recipe.sourceSha256,hash(readFileSync(new URL('../assets/source/characters-3d/authoring/apparel_surfaces.py',import.meta.url))));
 assert.equal(meta.recipe.installerSha256,hash(readFileSync(new URL('../tools/characters-3d/build-apparel-surfaces.py',import.meta.url))));
 assert.deepEqual(meta.recipe.foldSourceSha256,baseline.foldSourceSha256);
 const binary=raw.subarray(28+raw.readUInt32LE(12));assert.equal(binary.length,meta.originalBinaryBytes);assert.equal(hash(binary),meta.originalBinarySha256,'Every original binary byte, including complete folded colour arrays, remains exact');
 for(const [uri,pin]of Object.entries(meta.originalImages))assert.equal(hash(readFileSync(new URL(uri,assets))),pin,'Every previous external map is exact');
 const restored=restoredDocument(json,meta);assert.equal(hash(Buffer.from(JSON.stringify(stable(restored)))),meta.originalJSONSha256,'Only the surface material bindings and explicit donor patches change old JSON');
 assert.deepEqual(json.accessors,restored.accessors);assert.deepEqual(json.bufferViews,restored.bufferViews);assert.deepEqual(json.animations,restored.animations);assert.deepEqual(json.skins,restored.skins);
 assert.deepEqual(json.extras.clothDepth,record.clothDepth);assert.deepEqual(json.extras.familyClothDepth,record.familyClothDepth);
 let changedPixels=0,protectedPixels=0;
 for(const item of meta.primitives){
  const previous=json.materials[item.originalMaterial],active=json.materials[item.material],copy=structuredClone(active);
  assert.equal(active.name,previous.name,'Logical material names stay exact');assert.deepEqual(active.normalTexture,previous.normalTexture);
  for(const map of item.maps){
   assert.equal(image(json,active.pbrMetallicRoughness[map.field]).uri,map.uri);assert.equal(hash(readFileSync(new URL(map.uri,assets))),map.sha256);assert.equal(map.uri,`textures/${map.sha256.slice(0,20)}.png`);
   copy.pbrMetallicRoughness[map.field]=previous.pbrMetallicRoughness[map.field];
  }
  assert.deepEqual(copy,previous,'Factors,extensions,normals,opacity and all other material fields stay exact');
  const oldColor=image(json,previous.pbrMetallicRoughness.baseColorTexture).uri,newColor=image(json,active.pbrMetallicRoughness.baseColorTexture).uri;
  const oldMR=image(json,previous.pbrMetallicRoughness.metallicRoughnessTexture).uri,newMR=image(json,active.pbrMetallicRoughness.metallicRoughnessTexture).uri;
  const [a,b,c,d]=await Promise.all([pixels(oldColor),pixels(newColor),pixels(oldMR),pixels(newMR)]);assert.deepEqual(a.info,b.info);assert.deepEqual(c.info,d.info);
  const roles=new Map(item.roles.map(r=>[r.tile.join(','),r.role]));assert.ok(roles.size>0);
  const fold=(record.clothDepth??record.familyClothDepth)?.primitives.find(r=>r.mesh===item.mesh&&r.primitive===item.primitive);
  const anchor=json.materials[fold?.originalMaterial??item.originalMaterial],anchorURI=image(json,anchor.pbrMetallicRoughness.baseColorTexture).uri,anchorPixels=await pixels(anchorURI);
  for(let y=0;y<a.info.height;y++)for(let x=0;x<a.info.width;x++){
   const offset=(y*a.info.width+x)*4,old=[...a.data.subarray(offset,offset+4)],next=[...b.data.subarray(offset,offset+4)],mr=[...c.data.subarray(offset,offset+4)],nextMR=[...d.data.subarray(offset,offset+4)],role=roles.get(`${Math.floor(x/32)},${Math.floor(y/32)}`);
   assert.equal(next[3],old[3]);assert.equal(nextMR[0],mr[0]);assert.equal(nextMR[2],mr[2]);assert.equal(nextMR[3],mr[3]);
   if(!role){assert.deepEqual(next,old,'Protected facings,seams,trim and other palette pixels remain exact');assert.deepEqual(nextMR,mr);protectedPixels++;continue;}
   const anchorPigment=[...anchorPixels.data.subarray(offset,offset+3)].join(',');
   if(role==='cloth'){
    assert.ok(pigments[preset][item.part].includes(anchorPigment));assert.ok([224,232].includes(mr[1]));assert.equal(mr[2],0);assert.deepEqual(nextMR,mr,'Already matte cloth roughness stays exact');
    for(let channel=0;channel<3;channel++){assert.ok(next[channel]>=encoded(linear(old[channel])*.82)-1);assert.ok(next[channel]<=encoded(linear(old[channel])*1.24)+1);}
   }else{
    assert.equal(role,'boot');assert.equal(item.part,'footwear');assert.equal(anchorPigment,'35,31,27');assert.equal(mr[1],171);assert.equal(mr[2],0);assert.ok(nextMR[1]>=Math.round(.74*255)&&nextMR[1]<=Math.round(.82*255));
    for(let channel=0;channel<3;channel++){assert.ok(next[channel]>=encoded(linear(old[channel])*.96)-1);assert.ok(next[channel]<=encoded(linear(old[channel])*1.24)+1);}
   }
   if(next.some((v,i)=>v!==old[i]))changedPixels++;
  }
  const primitive=json.meshes[item.mesh].primitives[item.primitive];
  assert.deepEqual(access(primitive.attributes.COLOR_0),access(restored.meshes[item.mesh].primitives[item.primitive].attributes.COLOR_0),'Surface pass keeps the exact active folded colour accessor');
  if(item.part!=='footwear'){
   const uv=access(primitive.attributes.TEXCOORD_0),ratios=[],sampled=new Set();
   for(let i=0;i<uv.length;i+=2){
    const x=Math.min(a.info.width-1,Math.max(0,Math.floor(uv[i]*a.info.width))),y=Math.min(a.info.height-1,Math.max(0,Math.floor(uv[i+1]*a.info.height)));
    if(roles.get(`${Math.floor(x/32)},${Math.floor(y/32)}`)!=='cloth')continue;
    const offset=(y*a.info.width+x)*4,old=[0,1,2].reduce((sum,c)=>sum+linear(a.data[offset+c]),0),next=[0,1,2].reduce((sum,c)=>sum+linear(b.data[offset+c]),0);
    ratios.push(next/old);sampled.add(`${x},${y}`);
   }
   assert.ok(ratios.length>100&&sampled.size>50,'Broad regions reach many actual active garment UV samples');
   assert.ok(Math.max(...ratios)-Math.min(...ratios)>.25,'Actual garment samples reach both broad pigment regions');
   assert.ok(ratios.filter(v=>v>1.06).length>ratios.length*.05&&ratios.filter(v=>v<.94).length>ratios.length*.05,'Both regions affect a meaningful portion of the garment, not only unused texels');
  }
 }
 assert.ok(changedPixels>100&&protectedPixels>100,'Changes are confined to broad main garment/boot regions');
 assert.equal(json.meshes.reduce((sum,m)=>sum+m.primitives.length,0),record.drawCalls,'No new primitive or draw call');
 assert.equal(meta.recordPatches.length,meta.documentPatches.length);
 if(record.lod&&['friar','woman-shawl'].includes(preset)){assert.equal(record.nativeClothTopology.sourceSha256,manifest.appearances[preset].lods[0].sha256);assert.equal(meta.documentPatches.length,1);}
 if(preset==='woman-shawl'){
  const mi=json.nodes.find(n=>n.name===`Human_legwear_LOD${record.lod}`).mesh;assert.deepEqual(json.meshes[mi].primitives,restored.meshes[mi].primitives,'Inset rust hem keeps its active colour material and UV1 binding exact');
 }
});

test('equipment metal roughness changes only the two named fittings while complete binary and blade/leather materials remain exact',()=>{
 const record=manifest.equipment,{json}=readGlb(record.url),meta=record.apparelSurface,raw=readFileSync(new URL('equipment.glb',assets)),binary=raw.subarray(28+raw.readUInt32LE(12));
 assert.ok(meta);assert.equal(meta.beforeSha256,baseline.equipment);assert.equal(meta.originalRecord,undefined);
 assert.equal(hash(binary),meta.originalBinarySha256);assert.equal(binary.length,meta.originalBinaryBytes);
 const restored=restoredDocument(json,meta);assert.equal(hash(Buffer.from(JSON.stringify(stable(restored)))),meta.originalJSONSha256);
 const changed=new Set();
 for(const item of meta.primitives){
  const before=json.materials[item.originalMaterial],after=json.materials[item.material];assert.ok(['Equipment_Blackened_Steel','Equipment_Aged_Brass'].includes(before.name));changed.add(before.name);
  assert.equal(after.name,before.name);assert.equal(after.pbrMetallicRoughness.roughnessFactor,.48);
  const copy=structuredClone(after);copy.pbrMetallicRoughness.roughnessFactor=before.pbrMetallicRoughness.roughnessFactor;assert.deepEqual(copy,before,'Base colour,metallic values and every other material field stay exact');
 }
 assert.deepEqual([...changed].sort(),['Equipment_Aged_Brass','Equipment_Blackened_Steel']);
 assert.deepEqual(json.materials.slice(0,meta.originalMaterialCount),restored.materials);
 assert.deepEqual(json.nodes,restored.nodes);assert.deepEqual(json.accessors,restored.accessors);assert.deepEqual(json.bufferViews,restored.bufferViews);
 for(const name of ['Equipment_Polished_Blade','Equipment_Grip_Leather','Equipment_Walnut','Cream_Crossbelts'])for(let mi=0;mi<json.meshes.length;mi++)for(let pi=0;pi<json.meshes[mi].primitives.length;pi++)if(restored.materials[restored.meshes[mi].primitives[pi].material].name===name)assert.equal(json.meshes[mi].primitives[pi].material,restored.meshes[mi].primitives[pi].material,'Every protected blade,grip,wood and belt primitive retains its original material');
});

test('both frozen fold recipe sources and native animation banks remain exact',()=>{
 for(const [name,pin]of Object.entries(baseline.foldSourceSha256))assert.equal(hash(readFileSync(new URL(`../assets/source/characters-3d/authoring/${name}`,import.meta.url))),pin);
 for(const [gender,record]of Object.entries(manifest.animationLibraries))assert.equal(hash(readFileSync(new URL(record.url.replace('/models/characters/',''),assets))),baseline.banks[gender]);
});

test('fresh broad surfaces reproduce installed bytes, unwind exact predecessor GLBs, repeat exactly, and reject corrupt maps/recipes/binary and late collisions before writes',()=>{
 const result=JSON.parse(execFileSync('python3',['-c',String.raw`
from pathlib import Path
import copy,hashlib,importlib.util,json,shutil,subprocess,tempfile,sys
root=Path.cwd()
sys.path.insert(0,str(root/'tools/characters-3d'))
from coarse_garment_context import create_historical_snapshot
def module(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
tool=module('surface_test_installer',root/'tools/characters-3d/build-apparel-surfaces.py');glb=module('surface_test_glb',root/'tools/characters-3d/merge-animation-bank.py')
digest=lambda raw:hashlib.sha256(raw).hexdigest()
with tempfile.TemporaryDirectory(prefix='granaderos-apparel-test-') as folder:
 target=Path(folder)/'root';out=target/'web/public/models/characters'
 snapshot=create_historical_snapshot(root,target,stage='apparel');assert snapshot['releasedInputsExact']
 mp=out/'manifest.json';installed=json.loads(mp.read_text());manifest=copy.deepcopy(installed);expected={p.name:digest(p.read_bytes())for p in out.glob('*.glb')};originals={}
 groups=[(p,manifest['appearances'][p]['lods'])for p in tool.recipe_for(root)[0].PRESETS]+[('equipment',[manifest['equipment']])]
 for preset,records in groups:
  for i,record in enumerate(records):
   path=out/Path(record['url']).name;doc,binary=glb.read_glb(path);meta=record['apparelSurface'];doc,binary=tool.restore_body(doc,binary,meta);raw=tool.encode_glb(doc,binary);assert digest(raw)==meta['beforeSha256'];path.write_bytes(raw);originals[path.name]=raw
   previous=tool.restore_record(record)
   if preset=='equipment':manifest['equipment']=previous
   else:manifest['appearances'][preset]['lods'][i]=previous
 mp.write_text(json.dumps(manifest));baseline_manifest=mp.read_bytes()
 command=['python3',str(target/'tools/characters-3d/build-apparel-surfaces.py'),'--root',str(target)]
 run=lambda extra=[]:subprocess.run(command+extra,capture_output=True,text=True)
 first=run();assert first.returncode==0,first.stderr;assert {p.name:digest(p.read_bytes())for p in out.glob('*.glb')}==expected
 files=lambda:{str(p.relative_to(out)):digest(p.read_bytes())for p in out.rglob('*')if p.is_file()}
 final=files();assert run().returncode==0 and files()==final;assert run(['--verify-only']).returncode==0 and files()==final
 installed=json.loads(mp.read_text());metas=[r['apparelSurface']for p in tool.recipe_for(root)[0].PRESETS for r in installed['appearances'][p]['lods']]
 uris=list(dict.fromkeys(m['uri']for meta in metas for primitive in meta['primitives']for m in primitive['maps']))
 # Collisions in the final generated map reject the full batch, including all
 # earlier absent map destinations. Restore native predecessor bytes privately.
 with tempfile.TemporaryDirectory(prefix='granaderos-apparel-collision-') as collision_folder:
  collision=Path(collision_folder);shutil.copytree(target,collision,dirs_exist_ok=True);co=collision/'web/public/models/characters'
  for name,raw in originals.items():(co/name).write_bytes(raw)
  (co/'manifest.json').write_bytes(baseline_manifest);(co/uris[0]).unlink();(co/uris[-1]).write_bytes(b'collision')
  pins={str(p.relative_to(co)):digest(p.read_bytes())for p in co.rglob('*')if p.is_file()}
  reject=subprocess.run(['python3',str(collision/'tools/characters-3d/build-apparel-surfaces.py'),'--root',str(collision)],capture_output=True,text=True)
  assert reject.returncode!=0 and 'Content-addressed apparel surface collision' in reject.stderr
  assert pins=={str(p.relative_to(co)):digest(p.read_bytes())for p in co.rglob('*')if p.is_file()}
 source=target/'assets/source/characters-3d/authoring/apparel_surfaces.py';old=source.read_bytes();source.write_bytes(old+b'\n# changed recipe\n');reject=run();assert reject.returncode!=0 and 'Changed apparel surface recipe' in reject.stderr and files()==final;source.write_bytes(old)
 image=out/uris[0];old=image.read_bytes();image.write_bytes(old+b'changed');pins=files();reject=run();assert reject.returncode!=0 and 'Delivered apparel surface map changed' in reject.stderr and files()==pins;image.write_bytes(old)
 uri=next(iter(metas[0]['originalImages']));image=out/uri;old=image.read_bytes();image.write_bytes(old+b'changed');pins=files();reject=run();assert reject.returncode!=0 and 'Retained apparel source texture changed' in reject.stderr and files()==pins;image.write_bytes(old)
 # A corrected manifest hash cannot hide a changed original colour stream.
 path=out/'granadero-lod0.glb';doc,binary=glb.read_glb(path);binary[0]^=1;raw=tool.encode_glb(doc,binary);path.write_bytes(raw);changed=json.loads(mp.read_text());changed['appearances']['granadero']['lods'][0].update(bytes=len(raw),sha256=digest(raw));mp.write_text(json.dumps(changed));pins=files();reject=run();assert reject.returncode!=0 and 'Original apparel binary changed' in reject.stderr and files()==pins
 print(json.dumps({'freshDeterministic':True,'exactPreviousGLBs':True,'repeatExact':True,'verifyOnlyExact':True,'lateCollisionRejected':True,'changedRecipeRejected':True,'ownedMapRejected':True,'sourceMapRejected':True,'nativeBinaryRejected':True,'allRejectionsWriteNothing':True}))
`],{cwd:root,encoding:'utf8',maxBuffer:1024*1024}));
 assert.equal(Object.keys(result).length,10);assert.ok(Object.values(result).every(v=>v===true));
});
