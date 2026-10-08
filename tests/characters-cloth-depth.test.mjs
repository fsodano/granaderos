import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readGlb,manifest,assets} from './character-predecessor-fixture.mjs';
import sharp from '../web/node_modules/sharp/lib/index.js';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const source=new URL('../assets/source/characters-3d/authoring/cloth_depth.py',import.meta.url);
const expectedSource=hash(readFileSync(source));
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));return value;}
const pixelCache=new Map();
function pixels(uri){if(!pixelCache.has(uri))pixelCache.set(uri,sharp(new URL(uri,assets).pathname).removeAlpha().raw().toBuffer({resolveWithObject:true}));return pixelCache.get(uri);}
const linear=value=>value/255<=.04045?value/255/12.92:((value/255+.055)/1.055)**2.4;
const navy=new Set(['35,44,59','38,46,58']);

for(const preset of ['granadero','worker'])for(const record of manifest.appearances[preset].lods)test(`${preset} LOD${record.lod} cloth depth retains all original surface resources and native data`,async()=>{
 const {json,access}=readGlb(record.url),meta=record.clothDepth;
 const bytes=readFileSync(new URL(record.url.replace('/models/characters/',''),assets)),jsonBytes=bytes.readUInt32LE(12),binary=bytes.subarray(28+jsonBytes);
 assert.ok(meta,'The pilot is installed and has a preservation receipt');
 assert.equal(meta.recipe.sourceSha256,expectedSource);
 assert.deepEqual(json.extras.clothDepth,meta);
 assert.deepEqual(meta.recipe.factorBounds,[.76,1.48]);
 assert.equal(meta.recipe.navyAlbedoHeadroom,1.52);
 assert.equal(hash(binary.subarray(0,meta.originalBinaryBytes)),meta.originalBinarySha256,'The complete previous binary remains an exact prefix');
 const restored=structuredClone(json);let changed=0,protectedCount=0;
 for(const item of meta.primitives){
  const primitive=json.meshes[item.mesh].primitives[item.primitive],current=access(primitive.attributes.COLOR_0),previous=access(item.originalColourAccessor);
  const oldMaterial=json.materials[item.originalMaterial],material=json.materials[item.material];
  const oldImage=json.images[json.textures[oldMaterial.pbrMetallicRoughness.baseColorTexture.index].source],image=json.images[json.textures[material.pbrMetallicRoughness.baseColorTexture.index].source];
  const [oldPixels,newPixels]=await Promise.all([pixels(oldImage.uri),pixels(image.uri)]),uv=access(primitive.attributes.TEXCOORD_0);
  assert.deepEqual(newPixels.info,oldPixels.info);
  if(preset==='worker'){assert.equal(item.originalMaterial,item.material);assert.equal(item.colourUri,null);assert.equal(item.colourSha256,null);}
  else{
   assert.equal(image.uri,item.colourUri);assert.notEqual(item.originalMaterial,item.material);
   const textureHash=hash(readFileSync(new URL(image.uri,assets)));assert.equal(textureHash,item.colourSha256);assert.equal(image.uri,`textures/${textureHash.slice(0,20)}.png`,'New colour texture bytes are content addressed');
   const cloned=structuredClone(material);cloned.name=oldMaterial.name;delete cloned.extras.originalMaterial;if(!oldMaterial.extras)delete cloned.extras;
   cloned.pbrMetallicRoughness.baseColorTexture=oldMaterial.pbrMetallicRoughness.baseColorTexture;assert.deepEqual(cloned,oldMaterial,'Only an owned colour-map binding changes; normal/roughness/metal/skin resources stay exact');
   let lifted=0;
   for(let pixel=0;pixel<oldPixels.data.length;pixel+=oldPixels.info.channels){
    const before=[...oldPixels.data.subarray(pixel,pixel+3)],after=[...newPixels.data.subarray(pixel,pixel+3)];
    if(navy.has(before.join(','))){assert.ok(after.every((value,c)=>value>before[c]));lifted++;}
    else assert.deepEqual(after,before,'Every trim/leather/other palette pixel stays exact');
   }
   assert.ok(lifted>0);
  }
  assert.equal(primitive.attributes.COLOR_0,item.colourAccessor);
  assert.equal(current.length,previous.length);assert.equal(item.vertexCount,json.accessors[item.colourAccessor].count);
  const width=json.accessors[item.colourAccessor].type==='VEC4'?4:3;let vertices=0;
  for(let i=0;i<current.length;i+=width){
   let differs=false;for(let c=0;c<width;c++){
    assert.ok(Number.isFinite(current[i+c])&&current[i+c]>=0&&current[i+c]<=1);
    if(c===3)assert.equal(current[i+c],previous[i+c],'Opacity stays exact');
    if(current[i+c]!==previous[i+c])differs=true;
    if(c<3&&previous[i+c]>0){
     const vertex=i/width,x=Math.min(oldPixels.info.width-1,Math.max(0,Math.floor(uv[vertex*2]*oldPixels.info.width))),y=Math.min(oldPixels.info.height-1,Math.max(0,Math.floor(uv[vertex*2+1]*oldPixels.info.height))),offset=(y*oldPixels.info.width+x)*oldPixels.info.channels+c;
     const factor=current[i+c]*linear(newPixels.data[offset])/(previous[i+c]*linear(oldPixels.data[offset]));
     assert.ok(factor>=.76-1e-6&&factor<=(preset==='worker'?1.04:1.48)+1e-6,'The combined albedo/vertex response stays within restrained form contrast');
    }
   }
   if(differs)vertices++;else protectedCount++;
  }
  assert.equal(vertices,item.changedVertices);changed+=vertices;
  restored.meshes[item.mesh].primitives[item.primitive].attributes.COLOR_0=item.originalColourAccessor;
  restored.meshes[item.mesh].primitives[item.primitive].material=item.originalMaterial;
 }
 assert.ok(changed>100,'The real cloth surface changes at every LOD');
 if(preset==='granadero')assert.ok(protectedCount>100,'Uniform trim/belts retain their original vertex colours');
 restored.accessors=restored.accessors.slice(0,meta.originalAccessorCount);
 restored.bufferViews=restored.bufferViews.slice(0,meta.originalViewCount);
 restored.materials=restored.materials.slice(0,meta.originalMaterialCount);restored.textures=restored.textures.slice(0,meta.originalTextureCount);restored.images=restored.images.slice(0,meta.originalImageCount);
 restored.buffers=[{byteLength:meta.originalBinaryBytes}];
 delete restored.extras.clothDepth;if(!meta.originalHadExtras)delete restored.extras;
 assert.equal(hash(Buffer.from(JSON.stringify(stable(restored)))),meta.originalJSONSha256,'Restoring two garment colour references gives the complete original JSON, including maps, UVs, rig, sockets and morphs');
 const cost=json.meshes.reduce((sum,m)=>sum+m.primitives.length,0);assert.equal(cost,record.drawCalls,'No extra primitive or draw call');
});

test('the six other appearance families keep their current colour resources',()=>{
 for(const [preset,appearance]of Object.entries(manifest.appearances))if(!['granadero','worker'].includes(preset))for(const lod of appearance.lods){
  assert.equal(lod.clothDepth,undefined);assert.equal(readGlb(lod.url).json.extras?.clothDepth,undefined);
 }
});

test('a fresh cloth pilot is deterministic, repeatable, and rejects altered delivered colours or recipes before any write',()=>{
 const result=JSON.parse(execFileSync('python3',['-c',String.raw`
from pathlib import Path
import copy,hashlib,importlib.util,json,shutil,struct,subprocess,tempfile,sys
root=Path.cwd();sys.path.insert(0,str(root/'tools/characters-3d'))
from apparel_surface_context import create_predecessor_snapshot
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
glb=module('cloth_test_glb',root/'tools/characters-3d/merge-animation-bank.py')
digest=lambda raw:hashlib.sha256(raw).hexdigest()
with tempfile.TemporaryDirectory(prefix='granaderos-cloth-depth-test-') as folder:
 target=Path(folder)/'root';create_predecessor_snapshot(root,target);assets=target/'web/public/models/characters'
 manifest=json.loads((assets/'manifest.json').read_text())
 for preset in ('granadero','worker'):
  for record in manifest['appearances'][preset]['lods']:
   path=assets/Path(record['url']).name;doc,binary=glb.read_glb(path);meta=record.pop('clothDepth')
   for item in meta['primitives']:
    primitive=doc['meshes'][item['mesh']]['primitives'][item['primitive']];primitive['attributes']['COLOR_0']=item['originalColourAccessor'];primitive['material']=item['originalMaterial']
   doc['accessors']=doc['accessors'][:meta['originalAccessorCount']];doc['bufferViews']=doc['bufferViews'][:meta['originalViewCount']]
   doc['materials']=doc['materials'][:meta['originalMaterialCount']];doc['textures']=doc['textures'][:meta['originalTextureCount']];doc['images']=doc['images'][:meta['originalImageCount']]
   del doc['extras']['clothDepth']
   if not meta['originalHadExtras']:del doc['extras']
   destination=assets/path.name;raw=glb.write_glb(destination,doc,binary[:meta['originalBinaryBytes']]);record.update(bytes=len(raw),sha256=digest(raw))
 manifest_path=assets/'manifest.json';manifest_path.write_text(json.dumps(manifest))
 baseline={str(p.relative_to(target)):p.read_bytes()for p in assets.rglob('*')if p.is_file()}
 command=['python3',str(target/'tools/characters-3d/build-cloth-depth.py'),'--root',str(target)]
 first=subprocess.run(command,capture_output=True,text=True);assert first.returncode==0,first.stderr
 files=lambda:{str(p.relative_to(assets)):digest(p.read_bytes())for p in assets.rglob('*')if p.is_file()}
 after=files();second=subprocess.run(command,capture_output=True,text=True);assert second.returncode==0,second.stderr;assert after==files(),'Repeated run changes released files'
 # A collision in a later map cannot leave an earlier new map behind.
 with tempfile.TemporaryDirectory(prefix='granaderos-cloth-depth-collision-') as collision_folder:
  collision=Path(collision_folder)/'root';shutil.copytree(target,collision)
  for relative,raw in baseline.items():(collision/relative).write_bytes(raw)
  installed=json.loads(manifest_path.read_text());uris=list(dict.fromkeys(item['colourUri']for record in installed['appearances']['granadero']['lods']for item in record['clothDepth']['primitives']))
  assert len(uris)==2
  collision_assets=collision/'web/public/models/characters';(collision_assets/uris[0]).unlink();(collision_assets/uris[1]).write_bytes(b'collision')
  collision_files=lambda:{str(p.relative_to(collision_assets)):digest(p.read_bytes())for p in collision_assets.rglob('*')if p.is_file()}
  pinned=collision_files();rejection=subprocess.run(['python3',str(collision/'tools/characters-3d/build-cloth-depth.py'),'--root',str(collision)],capture_output=True,text=True)
  assert rejection.returncode!=0 and 'Existing texture name has different pixels' in rejection.stderr;assert pinned==collision_files()
 # A fresh source recipe cannot silently multiply a completed pass again.
 source=target/'assets/source/characters-3d/authoring/cloth_depth.py';source.write_text(source.read_text()+'\n# changed recipe\n')
 rejection=subprocess.run(command,capture_output=True,text=True);assert rejection.returncode!=0 and 'Changed cloth recipe' in rejection.stderr;assert after==files()
 shutil.copy2(root/'assets/source/characters-3d/authoring/cloth_depth.py',source)
 # External owned map bytes are checked too; a valid GLB digest is insufficient.
 installed=json.loads(manifest_path.read_text());uri=installed['appearances']['granadero']['lods'][0]['clothDepth']['primitives'][0]['colourUri'];image=assets/uri;original_png=image.read_bytes();image.write_bytes(original_png+b'changed');pinned=files()
 rejection=subprocess.run(command,capture_output=True,text=True);assert rejection.returncode!=0 and 'Delivered navy colour atlas changed' in rejection.stderr;assert pinned==files();image.write_bytes(original_png)
 # Keep the manifest digest valid while corrupting only the appended colour.
 path=assets/'granadero-lod0.glb';doc,binary=glb.read_glb(path);meta=doc['extras']['clothDepth'];a=doc['accessors'][meta['primitives'][0]['colourAccessor']];v=doc['bufferViews'][a['bufferView']];start=v['byteOffset']
 struct.pack_into('<f',binary,start,.123456);raw=glb.write_glb(path,doc,binary)
 manifest=json.loads(manifest_path.read_text());record=manifest['appearances']['granadero']['lods'][0];record.update(bytes=len(raw),sha256=digest(raw));manifest_path.write_text(json.dumps(manifest));pinned=files()
 rejection=subprocess.run(command,capture_output=True,text=True);assert rejection.returncode!=0 and 'Delivered cloth colours changed' in rejection.stderr;assert pinned==files()
 print(json.dumps({'fresh':True,'repeatExact':True,'textureCollisionRejected':True,'changedRecipeRejected':True,'changedTextureRejected':True,'changedColourRejected':True,'rejectionsWriteNothing':True}))
`],{cwd:new URL('..',import.meta.url),encoding:'utf8',maxBuffer:1024*1024}));
 assert.deepEqual(result,{fresh:true,repeatExact:true,textureCollisionRejected:true,changedRecipeRejected:true,changedTextureRejected:true,changedColourRejected:true,rejectionsWriteNothing:true});
});
