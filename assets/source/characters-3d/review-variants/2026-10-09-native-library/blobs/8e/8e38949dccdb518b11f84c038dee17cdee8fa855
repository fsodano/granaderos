import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {Box3,Vector3,Raycaster} from '../web/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../web/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
// A private complete library can use this exact suite before publication.
const libraryRoot=process.env.GRANADEROS_CHARACTER_LIBRARY
 ?pathToFileURL(resolve(process.env.GRANADEROS_CHARACTER_LIBRARY)+sep)
 :new URL('../web/public/models/characters/',import.meta.url);
function libraryAsset(url){
 const prefix='/models/characters/';assert.ok(url.startsWith(prefix),'Asset belongs to the character library');
 return new URL(url.slice(prefix.length),libraryRoot);
}
const manifest=JSON.parse(readFileSync(new URL('manifest.json',libraryRoot)));
const loaded=new Map();
function load(url){
 if(loaded.has(url))return loaded.get(url);
 // CPU geometry verification does not need browser image decoding. Keep the
 // exact published buffers, sparse morph accessors, skeleton, and motions.
 const bytes=readFileSync(libraryAsset(url)),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length));
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
function probeCloth(actor,id,lod){
 const cloth=clothMesh(actor,id,lod),boots=actor.model.getObjectByName(`Human_footwear_LOD${lod}`),ray=new Raycaster(),clearances=[];
 actor.root.updateMatrixWorld(true);cloth.skeleton.update();boots.skeleton.update();cloth.computeBoundingSphere();boots.computeBoundingSphere();
 for(const side of ['l','r']){
  const knee=actor.model.getObjectByName(`calf_${side}`).getWorldPosition(new Vector3()),ankle=actor.model.getObjectByName(`foot_${side}`).getWorldPosition(new Vector3());
  for(const t of [.30,.65]){
   const p=knee.clone().lerp(ankle,t);ray.set(new Vector3(p.x,2,p.z),new Vector3(0,-1,0));
   const bootHit=ray.intersectObject(boots,false)[0],clothHit=ray.intersectObject(cloth,false)[0];
   if(bootHit)clearances.push(clothHit?clothHit.point.y-bootHit.point.y:-1);
  }
 }
 const peaks={centre:-Infinity,left:-Infinity,right:-Infinity};
 for(let i=0;i<cloth.geometry.attributes.position.count;i++){
  const rest=new Vector3().fromBufferAttribute(cloth.geometry.attributes.position,i);if(rest.y>.85)continue;
  const delta=new Vector3().fromBufferAttribute(cloth.geometry.morphAttributes.position[1],i);if(delta.length()<.005)continue;
  const p=cloth.getVertexPosition(i,new Vector3()).applyMatrix4(cloth.matrixWorld);if(p.z<-.64||p.z>-.33)continue;
  if(Math.abs(p.x)<.05)peaks.centre=Math.max(peaks.centre,p.y);
  if(p.x<-.15)peaks.left=Math.max(peaks.left,p.y);if(p.x>.15)peaks.right=Math.max(peaks.right,p.y);
 }
 return {clearances,peaks};
}

function settle(actor,start=0){for(let i=0;i<12;i++)actor.tick(.1,start+i*100);actor.root.updateMatrixWorld(true);}

for(const id of ['friar','woman-shawl'])for(const lod of [0,1,2]){
 test(`${id} LOD ${lod} keeps sparse cloth shapes valid and grounded in the actual runtime`,async()=>{
  const record=manifest.appearances[id].lods[lod],bytes=readFileSync(libraryAsset(record.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);assert.equal(bytes.length,record.bytes);assert.equal(manifest.complete,true);
  const source=await asset(id,lod),actor=new ActorRuntime(source,visual(id,'prone')),mesh=clothMesh(actor,id,lod);
  assert.deepEqual(mesh.morphTargetDictionary,{cloth_crouched:0,cloth_prone:1,cloth_supine:2});assert.equal(mesh.skeleton.bones.length,53);
  for(const target of mesh.geometry.morphAttributes.position){
   const largest=Math.max(...target.array.map(Math.abs));
   assert.ok(target.array.every(Number.isFinite),'Sparse index/value compaction preserves finite values');
   assert.ok(largest>.01&&largest<.45,`A bounded rest-space cloth envelope must remain below 45 cm, got ${largest}`);
  }
  settle(actor);const prone=clothBounds(mesh);
  assert.ok(prone.max.y<.37,`Prone cloth rests over the legs, top ${prone.max.y}`);
  assert.ok(prone.min.y>-.015,`Prone hem remains at the floor, bottom ${prone.min.y}`);
  assert.ok(mesh.morphTargetInfluences[1]>.999);
  const contact=probeCloth(actor,id,lod);
  assert.equal(contact.clearances.length,4,'Both calf surfaces have two measurable support probes');
  assert.ok(contact.clearances.every(clearance=>clearance>.006&&clearance<.10),`Prone cloth clears the actual calf boots: ${contact.clearances}`);
  // The extended prone legs are closer together than the previous wide-knee
  // pose. Require a visible depression relative to the supported ridge height,
  // rather than forcing the cloth eight centimetres into a narrower gap.
  const ridge=Math.min(contact.peaks.left,contact.peaks.right),supportHeight=ridge-Math.max(0,prone.min.y);
  assert.ok(ridge-contact.peaks.centre>supportHeight*.25,`Cloth settles between the legs: centre ${contact.peaks.centre}, ridge ${ridge}, supported height ${supportHeight}`);
  actor.update(visual(id,'prone',{action:'crawl'}),1200);
  const duration=source.clips.find(clip=>clip.name==='prone.crawl.unarmed').duration;
  for(let i=0;i<24;i++){
   actor.tick(.12,1200+duration*1000*(i+.03)/24);actor.root.updateMatrixWorld(true);const crawling=clothBounds(mesh),contact=probeCloth(actor,id,lod);
   assert.ok(crawling.max.y<.39&&crawling.min.y>-.015,`Crawl cloth stays grounded over moving legs, bounds ${crawling.min.y}..${crawling.max.y}`);
   assert.equal(contact.clearances.length,4,'Every crawl sample covers both calf boots');
   assert.ok(contact.clearances.every(clearance=>clearance>.006),`Crawl cloth must not cut through the calf boots: ${contact.clearances}`);
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

for(const id of ['friar','woman-shawl'])for(const lod of [0,1,2]){
 test(`${id} LOD ${lod} keeps face-up and face-down fallen cloth above ground`,async()=>{
  const source=await asset(id,lod);
  for(const posture of ['standing','prone'])for(const action of ['die','collapse']){
   const clip=source.clips.find(c=>c.name===`life.${posture==='standing'?'stand':'prone'}.${action}`),duration=clip.duration;
   const actor=new ActorRuntime(source,visual(id,posture,{action,cue:{id:`cloth:${posture}:${action}`,action,startedAt:0,durationMs:duration*1000}})),mesh=clothMesh(actor,id,lod);
   let previous;
   for(let step=0;step<40;step++){
    const time=duration*(step+.5)/40;actor.tick(duration/40,time*1000);actor.root.updateMatrixWorld(true);
    const weights=mesh.morphTargetInfluences;
    assert.ok(weights.every(w=>Number.isFinite(w)&&w>=-.00001&&w<=1.00001),'Orientation split remains finite and normalized');
    assert.ok(weights[1]+weights[2]<=1.00001,'Prone and supine envelopes form one continuous blend');
    if(previous)assert.ok(Math.max(...weights.map((w,i)=>Math.abs(w-previous[i])))<.28,'Changing torso orientation does not pop between garment shapes');
    previous=weights.slice();
    if(time>=(clip.markers?.ground??duration*.68)){
     const bounds=clothBounds(mesh);
     assert.ok(bounds.min.y>-.02,`Fallen ${posture} cloth must stay above the floor: ${bounds.min.y}`);
     assert.ok(bounds.max.y<.55,`Fallen ${posture} cloth remains around the legs: ${bounds.max.y}`);
    }
   }
   assert.ok(mesh.morphTargetInfluences[posture==='standing'?2:1]>.90,`The settled ${posture} fall selects the matching cloth surface`);
   actor.dispose();
  }
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
