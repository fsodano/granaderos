import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readGlb,manifest,assets} from './character-predecessor-fixture.mjs';
import sharp from '../web/node_modules/sharp/lib/index.js';

const hash=raw=>createHash('sha256').update(raw).digest('hex');
const root=new URL('..',import.meta.url);
const baseline=JSON.parse(readFileSync(new URL('./character-family-cloth-depth-baseline.json',import.meta.url)));
const families=['royalist','surgeon','gaucho','friar','woman-scout','woman-shawl'];
const pigments={royalist:{outfit:['206,199,179'],legwear:['202,194,175']},surgeon:{outfit:['74,58,49'],legwear:['64,56,51']},gaucho:{outfit:['111,88,61'],legwear:['64,58,49']},friar:{outfit:['86,63,41'],legwear:['86,63,41']},'woman-scout':{outfit:['91,100,74'],legwear:['149,139,118']},'woman-shawl':{outfit:['200,188,162','91,44,53'],legwear:['49,48,49']}};
const linear=value=>value/255<=.04045?value/255/12.92:((value/255+.055)/1.055)**2.4;
const cache=new Map();
function pixels(uri){if(!cache.has(uri))cache.set(uri,sharp(new URL(uri,assets).pathname).removeAlpha().raw().toBuffer({resolveWithObject:true}));return cache.get(uri);}
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v;}
function setPath(v,path,value){for(const k of path.slice(0,-1))v=v[k];v[path.at(-1)]=value;}

for(const preset of families)for(const record of manifest.appearances[preset].lods)test(`${preset} LOD${record.lod} preserves the exact native source and faction surface roles`,async()=>{
 const {json,access}=readGlb(record.url),meta=record.familyClothDepth;
 const raw=readFileSync(new URL(`${preset}-lod${record.lod}.glb`,assets)),binary=raw.subarray(28+raw.readUInt32LE(12));
 assert.ok(meta,'The family surface pass has an exact restoration receipt');
 assert.equal(meta.beforeSha256,baseline.bodies[`${preset}-lod${record.lod}`]);assert.equal(meta.originalRecord.sha256,meta.beforeSha256);
 assert.deepEqual(json.extras.familyClothDepth,meta);
 assert.equal(meta.recipe.sourceSha256,hash(readFileSync(new URL('../assets/source/characters-3d/authoring/family_cloth_depth.py',import.meta.url))));
 assert.equal(meta.recipe.installerSha256,hash(readFileSync(new URL('../tools/characters-3d/build-family-cloth-depth.py',import.meta.url))));
 assert.equal(hash(binary.subarray(0,meta.originalBinaryBytes)),meta.originalBinarySha256);
 for(const [uri,pin]of Object.entries(meta.originalImages))assert.equal(hash(readFileSync(new URL(uri,assets))),pin,'Old external images stay exact');
 const restored=structuredClone(json);let total=0,protectedTrim=0;
 for(const item of meta.primitives){
  const p=json.meshes[item.mesh].primitives[item.primitive],old=access(item.originalColourAccessor),current=access(item.colourAccessor),width=json.accessors[item.colourAccessor].type==='VEC4'?4:3;
  const original=json.materials[item.originalMaterial],active=json.materials[item.material];
  const image=m=>json.images[json.textures[m.pbrMetallicRoughness.baseColorTexture.index].source];
  const [a,b]=await Promise.all([pixels(image(original).uri),pixels(image(active).uri)]);assert.deepEqual(a.info,b.info);
  const texture=original.pbrMetallicRoughness.baseColorTexture,uv=access(p.attributes[`TEXCOORD_${texture.texCoord??0}`]);
  if(item.colourUri){
   assert.ok(['surgeon','gaucho','friar'].includes(preset));assert.equal(image(active).uri,item.colourUri);
   const bytes=readFileSync(new URL(item.colourUri,assets));assert.equal(hash(bytes),item.colourSha256);assert.equal(item.colourUri,`textures/${hash(bytes).slice(0,20)}.png`);
   const cloned=structuredClone(active);cloned.name=original.name;delete cloned.extras.originalMaterial;if(!original.extras)delete cloned.extras;
   cloned.pbrMetallicRoughness.baseColorTexture=original.pbrMetallicRoughness.baseColorTexture;assert.deepEqual(cloned,original,'Normals,roughness,metalness,extensions and other factors are exact');
   for(let offset=0;offset<a.data.length;offset+=a.info.channels){
    const before=[...a.data.subarray(offset,offset+3)],after=[...b.data.subarray(offset,offset+3)];
    if(pigments[preset][item.part].includes(before.join(',')))assert.ok(after.every((v,c)=>v>before[c]));
    else assert.deepEqual(after,before,'Trim,leather and other garment pigment pixels stay exact');
   }
  }else{assert.equal(item.material,item.originalMaterial);assert.equal(item.colourSha256,null);assert.deepEqual(b.data,a.data);}
  let changed=0;
  for(let vertex=0;vertex<item.vertexCount;vertex++){
   const x=Math.min(a.info.width-1,Math.max(0,Math.floor(uv[vertex*2]*a.info.width))),y=Math.min(a.info.height-1,Math.max(0,Math.floor(uv[vertex*2+1]*a.info.height))),offset=(y*a.info.width+x)*a.info.channels;
   const pigment=[...a.data.subarray(offset,offset+3)].join(',');let differs=false;
   for(let c=0;c<width;c++){
    const i=vertex*width+c;assert.ok(Number.isFinite(current[i])&&current[i]>=0&&current[i]<=1);
    if(c===3)assert.equal(current[i],old[i]);if(current[i]!==old[i])differs=true;
    if(c<3&&old[i]>0){const factor=current[i]*linear(b.data[offset+c])/(old[i]*linear(a.data[offset+c]));assert.ok(factor>=.70-1e-6&&factor<=1.26+1e-6);}
    if(!pigments[preset][item.part].includes(pigment))assert.equal(current[i],old[i],'Non-cloth vertex colours stay exact');
   }
   if(differs)changed++;else protectedTrim++;
  }
  assert.equal(changed,item.changedVertices);total+=changed;
  if(preset==='woman-shawl'&&item.part==='legwear'){
   assert.equal(active.name,'Apparel_Atlas_Charcoal_Legwear_Rust_Hem');assert.equal(texture.texCoord,1);
   const ix=access(p.indices),adj=Array.from({length:item.vertexCount},()=>new Set()),locked=new Set();
   for(let i=0;i<ix.length;i+=3){const tri=[ix[i],ix[i+1],ix[i+2]];for(const u of tri)for(const v of tri)if(u!==v)adj[u].add(v);
    const ys=tri.map(v=>uv[v*2+1]*256);if(Math.min(...ys)<=237&&Math.max(...ys)>=230)for(const v of tri)locked.add(v);
   }
   for(const v of [...locked])for(const next of adj[v])locked.add(next);
   assert.equal(locked.size,item.selection.protectedVertexCount);assert.equal(item.selection.drapeVertexCount,675);
   for(const v of locked)for(let c=0;c<width;c++)assert.equal(current[v*width+c],old[v*width+c],'Every rust-band crossing triangle and its buffer retain exact shading');
  }
  if(preset==='friar'&&item.part==='outfit')assert.equal(item.selection.drapeVertexCount,675);
  restored.meshes[item.mesh].primitives[item.primitive].attributes.COLOR_0=item.originalColourAccessor;
  restored.meshes[item.mesh].primitives[item.primitive].material=item.originalMaterial;
 }
 assert.ok(total>100);assert.ok(protectedTrim>100,'Trim/seams retain original colours');
 for(const patch of meta.documentPatches)setPath(restored,patch.path,patch.before);
 for(const [key,count]of [['accessors','originalAccessorCount'],['bufferViews','originalViewCount'],['materials','originalMaterialCount'],['textures','originalTextureCount'],['images','originalImageCount']])restored[key]=restored[key].slice(0,meta[count]);
 restored.buffers=meta.originalBuffers;delete restored.extras.familyClothDepth;if(!meta.originalHadExtras)delete restored.extras;
 assert.equal(hash(Buffer.from(JSON.stringify(stable(restored)))),meta.originalJSONSha256,'All native geometry,UVs,indices,weights,morphs,rig,sockets,actions and old resources restore exactly');
 assert.equal(json.meshes.reduce((sum,m)=>sum+m.primitives.length,0),record.drawCalls);
 if(record.lod&&['friar','woman-shawl'].includes(preset))assert.equal(record.nativeClothTopology.sourceSha256,manifest.appearances[preset].lods[0].sha256);
});

test('the accepted pilot bodies, recipe and both native animation banks remain exact',()=>{
 for(const preset of ['granadero','worker'])for(const record of manifest.appearances[preset].lods){assert.equal(hash(readFileSync(new URL(`${preset}-lod${record.lod}.glb`,assets))),baseline.bodies[`${preset}-lod${record.lod}`]);assert.equal(record.familyClothDepth,undefined);}
 assert.equal(hash(readFileSync(new URL('../assets/source/characters-3d/authoring/cloth_depth.py',import.meta.url))),baseline.pilotSourceSha256);
 for(const [gender,record]of Object.entries(manifest.animationLibraries))assert.equal(hash(readFileSync(new URL(record.url.replace('/models/characters/',''),assets))),baseline.banks[gender]);
});

test('family export restores exact baseline bytes, repeats exactly, and rejects recipe,colour,map and late collision changes before writes',()=>{
 const result=JSON.parse(execFileSync('python3',['-c',String.raw`
from pathlib import Path
import copy,hashlib,importlib.util,json,shutil,struct,subprocess,tempfile,sys
root=Path.cwd();sys.path.insert(0,str(root/'tools/characters-3d'))
from coarse_garment_context import create_historical_snapshot
def module(n,p):
 s=importlib.util.spec_from_file_location(n,p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
tool=module('family_test',root/'tools/characters-3d/build-family-cloth-depth.py');glb=module('family_glb',root/'tools/characters-3d/merge-animation-bank.py')
digest=lambda raw:hashlib.sha256(raw).hexdigest()
with tempfile.TemporaryDirectory(prefix='granaderos-family-depth-test-') as folder:
 target=Path(folder)/'root';snapshot=create_historical_snapshot(root,target,stage='folds');assert snapshot['releasedInputsExact'];out=target/'web/public/models/characters'
 manifest=json.loads((out/'manifest.json').read_text());expected={p.name:digest(p.read_bytes())for p in out.glob('*.glb')};originals={}
 for preset in tool.recipe_for(root)[0].PRESETS:
  for i,record in enumerate(manifest['appearances'][preset]['lods']):
   path=out/Path(record['url']).name;doc,binary=glb.read_glb(path);doc,binary=tool.restore_body(doc,binary,record['familyClothDepth']);raw=glb.write_glb(path,doc,binary)
   assert digest(raw)==record['familyClothDepth']['beforeSha256'];originals[path.name]=raw;manifest['appearances'][preset]['lods'][i]=tool.restore_record(record)
 mp=out/'manifest.json';baseline_manifest=json.dumps(manifest);mp.write_text(baseline_manifest)
 command=['python3',str(target/'tools/characters-3d/build-family-cloth-depth.py'),'--root',str(target)]
 run=lambda:subprocess.run(command,capture_output=True,text=True)
 first=run();assert first.returncode==0,first.stderr
 assert {p.name:digest(p.read_bytes())for p in out.glob('*.glb')}==expected,'Fresh export differs from delivered candidate'
 files=lambda:{str(p.relative_to(out)):digest(p.read_bytes())for p in out.rglob('*')if p.is_file()}
 final=files();second=run();assert second.returncode==0,second.stderr;assert files()==final
 installed=json.loads(mp.read_text());uris=list(dict.fromkeys(item['colourUri']for p in tool.recipe_for(root)[0].PRESETS for r in installed['appearances'][p]['lods']for item in r['familyClothDepth']['primitives']if item['colourUri']))
 with tempfile.TemporaryDirectory(prefix='granaderos-family-collision-') as collision_folder:
  collision=Path(collision_folder)/'root';shutil.copytree(target,collision);co=collision/'web/public/models/characters'
  for name,raw in originals.items():(co/name).write_bytes(raw)
  (co/'manifest.json').write_text(baseline_manifest);(co/uris[0]).unlink();(co/uris[-1]).write_bytes(b'collision')
  collision_files=lambda:{str(p.relative_to(co)):digest(p.read_bytes())for p in co.rglob('*')if p.is_file()}
  pins=collision_files();rejection=subprocess.run(['python3',str(collision/'tools/characters-3d/build-family-cloth-depth.py'),'--root',str(collision)],capture_output=True,text=True)
  assert rejection.returncode!=0 and 'Existing family texture name has different pixels' in rejection.stderr;assert collision_files()==pins
 source=target/'assets/source/characters-3d/authoring/family_cloth_depth.py';original_source=source.read_bytes();source.write_bytes(original_source+b'\n# changed recipe\n')
 rejection=run();assert rejection.returncode!=0 and 'Changed family cloth recipe' in rejection.stderr;assert files()==final;source.write_bytes(original_source)
 # Original external map bytes are part of the retained source contract.
 uri=next(iter(installed['appearances']['woman-shawl']['lods'][0]['familyClothDepth']['originalImages']));image=out/uri;old=image.read_bytes();image.write_bytes(old+b'changed');pins=files()
 rejection=run();assert rejection.returncode!=0 and 'Retained source texture changed' in rejection.stderr;assert files()==pins;image.write_bytes(old)
 image=out/uris[0];old=image.read_bytes();image.write_bytes(old+b'changed');pins=files()
 rejection=run();assert rejection.returncode!=0 and 'Delivered family colour atlas changed' in rejection.stderr;assert files()==pins;image.write_bytes(old)
 path=out/'royalist-lod0.glb';doc,binary=glb.read_glb(path);a=doc['accessors'][doc['extras']['familyClothDepth']['primitives'][0]['colourAccessor']];v=doc['bufferViews'][a['bufferView']];struct.pack_into('<f',binary,v['byteOffset'],.123456);raw=glb.write_glb(path,doc,binary)
 changed=json.loads(mp.read_text());changed['appearances']['royalist']['lods'][0].update(bytes=len(raw),sha256=digest(raw));mp.write_text(json.dumps(changed));pins=files()
 rejection=run();assert rejection.returncode!=0 and 'Delivered family cloth colours changed' in rejection.stderr;assert files()==pins
 print(json.dumps({'exactOriginalGLBs':True,'freshDeterministic':True,'repeatExact':True,'lateCollisionRejected':True,'changedRecipeRejected':True,'retainedMapRejected':True,'ownedMapRejected':True,'ownedColourRejected':True,'allRejectionsWriteNothing':True}))
`],{cwd:root,encoding:'utf8',maxBuffer:1024*1024}));
 assert.ok(Object.values(result).every(v=>v===true));assert.equal(Object.keys(result).length,9);
});
