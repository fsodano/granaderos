import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync,mkdirSync,symlinkSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {Box3,Vector3} from '../web/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../web/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const publicRoot=new URL('../web/public/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('models/characters/manifest.json',publicRoot)));
const loaded=new Map();
function load(url){
 if(loaded.has(url))return loaded.get(url);
 // CPU geometry verification does not need browser image decoding. Keep the
 // exact published buffers, sparse morph accessors, skeleton, and motions.
 const bytes=readFileSync(new URL(`.${url}`,publicRoot)),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length));
 delete doc.images;delete doc.textures;delete doc.samplers;
 doc.materials=(doc.materials??[]).map(material=>({name:material.name}));
 const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),binary=bytes.subarray(20+length),header=Buffer.from(bytes.subarray(0,20));
 header.writeUInt32LE(20+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);
 const buffer=Buffer.concat([header,padded,binary]),promise=new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.length),'');loaded.set(url,promise);return promise;
}
async function asset(id,lod){
 const appearance=manifest.appearances[id],library=manifest.animationLibraries[appearance.gender];
 const [body,animation,equipment,garments]=await Promise.all([load(appearance.lods[lod].url),load(library.url),load(manifest.equipment.url),load(manifest.garments[appearance.gender].url)]);
 return {manifest,appearance,body,animation,equipment,garments,clips:library.clips,lod};
}
function visual(id,posture='standing',extra={}){
 return {key:`unit:${id}`,id,kind:'unit',appearance:id,skin:'light',side:'player',tacticalLevel:0,position:[0,0,0],yaw:0,posture,mounted:false,action:'idle',idleAction:'idle',equipment:'unarmed',items:[],garments:{headwear:null,outfit:null,legwear:null},selected:false,bodyHeights:{},...extra};
}
function clothMesh(actor,id,lod){return actor.model.getObjectByName(`Human_${id==='friar'?'outfit':'legwear'}_LOD${lod}`);}
function clothBounds(mesh){
 const bounds=new Box3(),position=mesh.geometry.attributes.position;
 mesh.updateWorldMatrix(true,false);mesh.skeleton.update();
 for(let i=0;i<position.count;i++){
  const rest=new Vector3().fromBufferAttribute(position,i);
  if(rest.y>.92||Math.hypot(rest.x,rest.z)<.20)continue;
  bounds.expandByPoint(mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld));
 }
 assert.ok(!bounds.isEmpty(),'Published long hem has measurable geometry');return bounds;
}
function settle(actor,start=0){for(let i=0;i<12;i++)actor.tick(.1,start+i*100);actor.root.updateMatrixWorld(true);}

for(const id of ['friar','woman-shawl'])for(const lod of [0,1,2]){
 test(`${id} LOD ${lod} keeps sparse cloth shapes valid and grounded in the actual runtime`,async()=>{
  const record=manifest.appearances[id].lods[lod],bytes=readFileSync(new URL(`.${record.url}`,publicRoot));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);assert.equal(bytes.length,record.bytes);assert.equal(manifest.complete,true);
  const source=await asset(id,lod),actor=new ActorRuntime(source,visual(id,'prone')),mesh=clothMesh(actor,id,lod);
  assert.deepEqual(mesh.morphTargetDictionary,{cloth_crouched:0,cloth_prone:1,...(record.nativeClothBootSupport?{cloth_prone_boot_clearance:2}:{})});assert.equal(mesh.skeleton.bones.length,53);
  for(const target of mesh.geometry.morphAttributes.position){
   const largest=Math.max(...target.array.map(Math.abs));
   assert.ok(target.array.every(Number.isFinite),'Sparse index/value compaction preserves finite values');
   assert.ok(largest>.01&&largest<.15,`Authored cloth offsets remain centimetres, got ${largest}`);
  }
  const clip=source.animation.animations.find(clip=>clip.name===record.nativeClothSupport.sourceClip),sourcePoseHash=createHash('sha256').update(JSON.stringify({name:clip.name,duration:clip.duration,tracks:clip.tracks.map(track=>({name:track.name,type:track.ValueTypeName,times:Array.from(track.times),values:Array.from(track.values),interpolation:track.getInterpolation()}))})).digest('hex');
  assert.equal(record.nativeClothSupport.sourcePoseHash,sourcePoseHash,'Cloth correction names its exact current native pose');
  assert.equal(record.nativeClothSupport.retainedRestMeshAndRig,true);
  const baseNormals=mesh.geometry.attributes.normal,proneNormals=mesh.geometry.morphAttributes.normal[1];
  for(let i=0;i<baseNormals.count;i++){
   const normal=new Vector3().fromBufferAttribute(baseNormals,i).add(new Vector3().fromBufferAttribute(proneNormals,i));
   assert.ok(Number.isFinite(normal.length())&&Math.abs(normal.length()-1)<.00001,'Prone cloth normals stay finite and unit length');
  }
  settle(actor);const prone=clothBounds(mesh);
  assert.ok(prone.max.y<.33,`Prone cloth rests over the legs, top ${prone.max.y}`);
  assert.ok(prone.min.y>-.025,`Prone hem remains at the floor, bottom ${prone.min.y}`);
  assert.ok(mesh.morphTargetInfluences[1]>.999);
  actor.update(visual(id,'prone',{action:'crawl'}),1200);
  for(let i=0;i<16;i++){
   actor.tick(.1,1200+i*100);actor.root.updateMatrixWorld(true);const crawling=clothBounds(mesh);
   assert.ok(crawling.max.y<.37&&crawling.min.y>-.035,`Crawl cloth stays over the moving legs, bounds ${crawling.min.y}..${crawling.max.y}`);
  }
  actor.update(visual(id,'crouched'),1500);settle(actor,1500);const crouched=clothBounds(mesh);
  assert.ok(crouched.min.y>-.025,`Crouched hem remains at the floor, bottom ${crouched.min.y}`);
  assert.ok(mesh.morphTargetInfluences[0]>.999&&mesh.morphTargetInfluences[1]<.001);
  actor.update(visual(id),3000);settle(actor,3000);
  assert.ok(mesh.morphTargetInfluences.every(weight=>weight<.001),'Standing outfit returns to its native rest shape');
  assert.ok(source.body.scene.getObjectByName(mesh.name).morphTargetInfluences.every(weight=>weight===0),'Actor pose cannot change the shared source asset');
  actor.dispose();
 });
}

test('long cloth blends through paid posture transitions and respects replacement clothing',async()=>{
 const source=await asset('friar',1),actor=new ActorRuntime(source,visual('friar')),mesh=clothMesh(actor,'friar',1);
 actor.update(visual('friar','prone',{action:'stance:standing:prone',cue:{id:'lower-cloth',action:'stance:standing:prone',startedAt:0,durationMs:1000,fromPosture:'standing',toPosture:'prone'}}),0);
 for(let time=0;time<=500;time+=50)actor.tick(.05,time);
 assert.ok(mesh.morphTargetInfluences[1]>.35&&mesh.morphTargetInfluences[1]<.65,'Cloth follows the partially lowered body');
 actor.update(visual('friar','prone',{garments:{headwear:null,outfit:'linen_shirt',legwear:null}}),1100);settle(actor,1100);
 assert.equal(mesh.visible,false,'A replacement shirt still hides the original habit');
 const owned=[];actor.model.traverse(node=>{if(node.name.startsWith('garment_linen_shirt'))owned.push(node);});
 assert.ok(owned.some(node=>node.visible),'The replacement shirt stays visible');
 assert.ok(actor.model.getObjectByName('Human_legwear_LOD1').visible&&actor.model.getObjectByName('Human_footwear_LOD1').visible,'Underlying legs and boots remain available');
 actor.update(visual('friar'),2500);settle(actor,2500);assert.equal(mesh.visible,true);actor.dispose();
});

test('the production packer preserves sparse cloth accessors when unused binary views move',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'granaderos-cloth-pack-')),path=join(folder,'sparse.glb');
 try{
  const pieces=[Buffer.from(new Float32Array([0,0,0,1,0,0,0,1,0]).buffer),Buffer.from([0,0,1,0,2,0,0,0]),Buffer.alloc(4,99),Buffer.from([2,0,0,0]),Buffer.from(new Float32Array([0,.125,0]).buffer)],binary=Buffer.concat(pieces);let offset=0;
  const doc={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1,targets:[{POSITION:3}]}],extras:{targetNames:['cloth_prone']}}],buffers:[{byteLength:binary.length}],bufferViews:pieces.map(piece=>{const view={buffer:0,byteOffset:offset,byteLength:piece.length};offset+=piece.length;return view;}),accessors:[
   {bufferView:0,componentType:5126,type:'VEC3',count:3,max:[1,1,0],min:[0,0,0]},
   {bufferView:1,componentType:5123,type:'SCALAR',count:3},
   {bufferView:2,componentType:5121,type:'SCALAR',count:4},
   {componentType:5126,type:'VEC3',count:3,min:[0,0,0],max:[0,.125,0],sparse:{count:1,indices:{bufferView:3,componentType:5121},values:{bufferView:4}}},
  ]};
  const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),header=Buffer.alloc(20),chunk=Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);chunk.writeUInt32LE(binary.length,0);chunk.writeUInt32LE(0x004e4942,4);
  writeFileSync(path,Buffer.concat([header,padded,chunk,binary]));
  const packer=new URL('../assets/source/characters-3d/authoring/',import.meta.url).pathname;
  const result=spawnSync('python3',['-c','import sys;sys.path.insert(0,sys.argv[1]);from gltf_pack import pack;pack(sys.argv[2],{})',packer,path],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const bytes=readFileSync(path),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');let mesh;gltf.scene.traverse(node=>{if(node.isMesh)mesh=node;});
  mesh.morphTargetInfluences[0]=1;assert.ok(mesh.getVertexPosition(2,new Vector3()).distanceTo(new Vector3(0,1.125,0))<.000001,'Sparse index still selects vertex 2 and the 12.5 cm value survives compaction');
 }finally{rmSync(folder,{recursive:true,force:true});}
});


test('native cloth fitting is read-only when the current source pose is already recorded',()=>{
 const folder=mkdtempSync(join(tmpdir(),'granaderos-cloth-repeat-')),output=join(folder,'proposal.json'),root=new URL('../',import.meta.url).pathname;
 const files=['models/characters/manifest.json',...['friar','woman-shawl'].flatMap(id=>[0,1,2].map(lod=>`models/characters/${id}-lod${lod}.glb`))];
 const hashes=()=>files.map(file=>createHash('sha256').update(readFileSync(new URL(file,publicRoot))).digest('hex'));
 try{
  const before=hashes(),result=spawnSync('node',['tools/characters-3d/fit-long-cloth-support.mjs',output],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);const rows=JSON.parse(readFileSync(output));assert.equal(rows.length,6);assert.ok(rows.every(row=>row.unchanged));assert.deepEqual(hashes(),before);
 }finally{rmSync(folder,{recursive:true,force:true});}
});

test('a changed native pose rejects a second nonlinear fit before writing any body',()=>{
 const folder=mkdtempSync(join(tmpdir(),'granaderos-cloth-stale-')),root=new URL('../',import.meta.url).pathname,models=join(folder,'web/public/models/characters');
 try{
  mkdirSync(models,{recursive:true});mkdirSync(join(folder,'tests'));mkdirSync(join(folder,'tools/characters-3d'),{recursive:true});
  for(const name of ['published-actor-fixture.mjs','tactical-render-loader.mjs'])writeFileSync(join(folder,'tests',name),readFileSync(join(root,'tests',name)));
  for(const name of ['lib','node_modules'])symlinkSync(join(root,'web',name),join(folder,'web',name),'dir');
  const modelRoot=join(root,'web/public/models/characters');for(const name of readdirSync(modelRoot))if(name!=='manifest.json')symlinkSync(join(modelRoot,name),join(models,name));
  const changed=structuredClone(manifest);changed.appearances.friar.lods[0].nativeClothSupport.sourcePoseHash='changed-source';writeFileSync(join(models,'manifest.json'),JSON.stringify(changed));
  const output=join(folder,'proposal.json'),result=spawnSync('node',[join(root,'tools/characters-3d/fit-long-cloth-support.mjs'),output],{cwd:folder,encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/Native cloth basis changed; regenerate the authored body before refitting/);
  assert.ok(!readdirSync(folder).includes('proposal.json'),'The rejected fit writes no candidate');assert.equal(JSON.parse(readFileSync(join(models,'manifest.json'))).appearances.friar.lods[0].nativeClothSupport.sourcePoseHash,'changed-source');
 }finally{rmSync(folder,{recursive:true,force:true});}
});
