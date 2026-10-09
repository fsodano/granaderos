import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {Vector3,Raycaster,DoubleSide} from '../web/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../web/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const libraryRoot=process.env.GRANADEROS_CHARACTER_LIBRARY
 ?pathToFileURL(resolve(process.env.GRANADEROS_CHARACTER_LIBRARY)+sep)
 :new URL('../web/public/models/characters/',import.meta.url);
function libraryAsset(url){const prefix='/models/characters/';assert.ok(url.startsWith(prefix));return new URL(url.slice(prefix.length),libraryRoot);}
const manifest=JSON.parse(readFileSync(new URL('manifest.json',libraryRoot))),loaded=new Map();
function load(url){
 if(loaded.has(url))return loaded.get(url);
 // Keep published buffers, rig, and animation tracks. Browser image decoding
 // is not required for CPU contact checks on the actual skinned geometry.
 const bytes=readFileSync(libraryAsset(url)),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length));
 delete doc.images;delete doc.textures;delete doc.samplers;doc.materials=(doc.materials??[]).map(material=>({name:material.name}));
 const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),binary=bytes.subarray(20+length),header=Buffer.from(bytes.subarray(0,20));
 header.writeUInt32LE(20+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);
 const buffer=Buffer.concat([header,padded,binary]),promise=new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.length),'');loaded.set(url,promise);return promise;
}
async function asset(id){
 const appearance=manifest.appearances[id],library=manifest.animationLibraries[appearance.gender];
 const [body,animation,equipment,horse]=await Promise.all([load(appearance.lods[1].url),load(library.url),load(manifest.equipment.url),load(manifest.horse.lods[1].url)]);
 return {manifest,appearance,body,animation,equipment,horse,clips:library.clips,lod:1};
}
function visual(id,action,extra={}){
 const mounted=action!=='dismount';
 return {key:`unit:${id}`,id,kind:'unit',appearance:id,skin:'light',side:'player',tacticalLevel:0,position:[4,0,7],yaw:0,posture:'standing',mounted,action,idleAction:'idle',equipment:'unarmed',items:[],garments:{headwear:null,outfit:null,legwear:null},selected:false,bodyHeights:{},cue:{id:`${id}:${action}`,action,startedAt:0,fromPosture:mounted?'standing':'mounted'},...extra};
}
function point(actor,name){actor.root.updateMatrixWorld(true);return actor.root.worldToLocal(actor.model.getObjectByName(name).getWorldPosition(new Vector3()));}
function palm(actor,side){return point(actor,`hand_${side}`).lerp(point(actor,`middle_01_${side}`),.72);}
function sole(actor,side){
 const mesh=actor.model.getObjectByName('Human_footwear_LOD1'),position=mesh.geometry.attributes.position;mesh.updateWorldMatrix(true,false);mesh.skeleton.update();let low=Infinity;
 for(let index=0;index<position.count;index++){
  if(position.getY(index)>.14||(position.getX(index)>0)!==(side==='l'))continue;
  const posed=actor.root.worldToLocal(mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld));low=Math.min(low,posed.y);
 }
 return low;
}
function at(actor,spec,fraction){actor.tick(0,spec.duration*1000*fraction);actor.root.updateMatrixWorld(true);}
function closeVector(actual,expected,tolerance,message){assert.ok(actual.distanceTo(new Vector3(...expected))<tolerance,`${message}: ${actual.toArray()} != ${expected}`);}
function bootBall(actor,source,side){
 const rest=source.body.scene;rest.updateMatrixWorld(true);
 const foot=rest.getObjectByName('foot_'+side),ball=rest.getObjectByName('ball_'+side).getWorldPosition(new Vector3());
 rest.worldToLocal(ball);ball.y=.007;rest.localToWorld(ball);foot.worldToLocal(ball);
 return actor.root.worldToLocal(actor.model.getObjectByName('foot_'+side).localToWorld(ball));
}
function supportTarget(spec,side,fraction){
 const keys=spec.mountSupport[side==='l'?'frontKeys':'rearKeys'],time=spec.duration*fraction;
 if(time<=keys[0].time)return [...keys[0].position];
 for(let index=1;index<keys.length;index++){
  const a=keys[index-1],b=keys[index];if(time>b.time)continue;
  const u=(time-a.time)/(b.time-a.time),blend=u*u*(3-2*u);return a.position.map((value,axis)=>value+(b.position[axis]-value)*blend);
 }
 return [...keys.at(-1).position];
}

for(const id of ['granadero','woman-scout'])test(`${id} mounts from a supported side and reverses the same published path`,async()=>{
 const source=await asset(id),bank=manifest.animationLibraries[source.appearance.gender],bytes=readFileSync(libraryAsset(bank.url));
 assert.equal(manifest.complete,true);assert.equal(createHash('sha256').update(bytes).digest('hex'),bank.sha256);assert.equal(bytes.length,bank.bytes);
 const mount=bank.clips.find(clip=>clip.name==='life.mount'),dismount=bank.clips.find(clip=>clip.name==='life.dismount');
 assert.equal(mount.mountSupport.coordinateSpace,'gltf-model-local');assert.deepEqual(mount.freeHands,['handRight','handLeft']);
 const rising=new ActorRuntime(source,visual(id,'mount')),descending=new ActorRuntime(source,visual(id,'dismount'));
 for(let index=0;index<=54;index++){
  const t=index/60;at(rising,mount,t);if(index)at(descending,dismount,1-t);
  closeVector(rising.root.position,[4,0,7],1e-8,'Mount leaves the saved gameplay position intact');
  if(index)for(const name of ['pelvis','calf_l','calf_r','foot_l','foot_r','hand_l','hand_r'])closeVector(point(rising,name),point(descending,name).toArray(),.025,`${name} follows the same reverse path`);
  if(t<=.28)assert.ok(Math.abs(Math.min(sole(rising,'l'),sole(rising,'r')))<.035,'The side step has a supporting ground foot');
  if(t>=.20&&t<=.46){
   const horse=rising.root.children.find(node=>node!==rising.model),body=horse.getObjectByName('Horse_Body');
   const knee=rising.root.localToWorld(point(rising,'calf_l'));
   const ray=new Raycaster(knee.clone().add(new Vector3(2,0,0)),new Vector3(-1,0,0),0,2.025);
   assert.equal(ray.intersectObject(body,true).length,0,`The near knee clears the horse while entering the stirrup at ${t}`);
  }
  if(t>=.36&&t<=.70){
   closeVector(bootBall(rising,source,'l'),[mount.mountSupport.stirrup[0],mount.mountSupport.stirrup[1]+.010,mount.mountSupport.stirrup[2]],.012,'The native boot ball stays on the actual stirrup tread');
   assert.ok(Math.abs(sole(rising,'l')-mount.mountSupport.stirrup[1])<.045,'The published supporting sole rests on the iron stirrup');
   for(const side of ['l','r']){
    const target=supportTarget(mount,side,t);target[1]+=.010;
    closeVector(palm(rising,side),target,.035,`The ${side} palm supports the measured saddle edge`);
   }
  }
  if(t>=.57&&t<=.67){assert.ok(sole(rising,'r')>1.65,'The swinging boot clears the actual croup');assert.ok(point(rising,'calf_r').y>1.56,'The swinging knee stays above the horse');}
 }
 at(rising,mount,.05);assert.equal(rising.root.children.find(node=>node!==rising.model).visible,false,'The on-foot step clears the space before the horse enters view');
 at(rising,mount,.5);assert.equal(rising.root.children.find(node=>node!==rising.model).visible,true);
 at(descending,dismount,.9);assert.equal(descending.root.children.find(node=>node!==descending.model).visible,false,'The horse leaves view before the foot return');
 descending.tick(0,dismount.duration*1000+1);
 // Ground placement settles with the same short fade as the outgoing pose.
 for(let frame=1;frame<=24;frame++)descending.tick(1/120,dismount.duration*1000+1+frame*1000/120);
 closeVector(descending.model.position,[0,0,0],1e-8,'Dismount returns to normal ground placement after the pose blend');
 rising.dispose();descending.dispose();
});

for(const id of ['granadero','woman-scout'])test(`${id} keeps mounted joint paths continuous between exported keys`,async()=>{
 const source=await asset(id),native=source.body.parser.json;
 const names=native.skins[0].joints.map(index=>native.nodes[index].name);assert.equal(names.length,53);
 const monitored=['upperarm_l','upperarm_r','lowerarm_l','lowerarm_r','hand_l','hand_r','thigh_l','thigh_r','calf_l','calf_r','foot_l','foot_r'];
 for(const gesture of ['mount','dismount']){
  const spec=source.clips.find(clip=>clip.name===`life.${gesture}`),actor=new ActorRuntime(source,visual(id,gesture));
  assert.equal(spec.duration,2.3,'The repair preserves the timed gameplay action');
  const bones=Object.fromEntries(names.map(name=>[name,actor.model.getObjectByName(name)]));
  const lengths=Object.fromEntries(names.map(name=>[name,source.body.scene.getObjectByName(name).position.length()]));
  const count=Math.round(spec.duration*120),dt=spec.duration/count;let previous;
  for(let frame=0;frame<=count;frame++){
   // The exact duration hands control to mounted/standing idle. Test that
   // separate runtime transition independently of the authored clip path.
   at(actor,spec,Math.min(frame/count,1-1e-6));
   for(const name of names){
    assert.ok(bones[name].matrixWorld.elements.every(Number.isFinite),`${gesture} ${name} remains finite`);
    if(name!=='Root')assert.ok(Math.abs(bones[name].position.length()-lengths[name])<.00001,`${gesture} ${name} keeps its native length`);
   }
   const sample=Object.fromEntries(monitored.map(name=>[name,{position:point(actor,name),rotation:bones[name].quaternion.clone()}]));
   if(previous)for(const name of monitored){
    // Sample the actual interpolated hierarchy. Smooth endpoint positions
    // alone missed a 168 degree roll flip that threw a wrist 24 cm in 8 ms.
    const speed=sample[name].position.distanceTo(previous[name].position)/dt;
    const turn=sample[name].rotation.angleTo(previous[name].rotation)*180/Math.PI/dt;
    const maximumSpeed=name.startsWith('lowerarm')?4.5:name.startsWith('hand')?6:8;
    assert.ok(speed<maximumSpeed,`${gesture} ${name} has no IK position jump at ${frame*dt}: ${speed} m/s`);
    assert.ok(turn<1400,`${gesture} ${name} has no roll flip at ${frame*dt}: ${turn} degrees/s`);
    const time=frame*dt;
    if(name.startsWith('hand')&&time>=spec.mountSupport.supportedStart+dt&&time<=spec.mountSupport.supportedEnd){
     // A free leg can tuck quickly into the high stirrup. A loaded wrist
     // must follow the measured saddle grip without an equally fast jump.
     assert.ok(speed<1.5,`${gesture} ${name} remains planted while it carries weight at ${time}: ${speed} m/s`);
    }
   }
   previous=sample;
  }
  actor.dispose();
 }
});

test('mount support stows owned lance and rifle through the normal sockets, then restores them',async()=>{
 const source=await asset('granadero'),mount=source.clips.find(clip=>clip.name==='life.mount');
 for(const [id,equipment]of [['1812','blade'],['1800','long-gun']]){
  const actor=new ActorRuntime(source,visual('granadero','mount',{equipment,items:[{id,reference:'primary',socket:'handRight'}]}));
  at(actor,mount,.5);const object=actor.model.getObjectByName(`primary:${id}`);
  assert.ok(object.visible);assert.equal(object.userData.presentationStowed,true,'The owned weapon leaves both supporting hands');
  const item=manifest.equipment.items[id],fitting=mount.stowItems.find(entry=>entry.categories.includes(item.category)),socket=source.appearance.sockets[fitting?.socket??item.stowedSocket];assert.equal(object.parent.name,socket.node);
  actor.tick(0,mount.duration*1000+1);assert.equal(object.userData.presentationStowed,false);assert.equal(object.parent.name,source.appearance.sockets[`handRight_${item.grip}`].node);
  closeVector(actor.root.position,[4,0,7],1e-8,'Equipment presentation cannot move the saved unit');actor.dispose();
 }
});

test('the published lance head continues the shaft on its native upright axis',async()=>{
 const source=await asset('granadero'),lance=source.equipment.scene.getObjectByName(manifest.equipment.items['1812'].node);
 const shaft=lance.getObjectByName('Lance_Shaft'),head=lance.getObjectByName('Lance_Head');
 shaft.geometry.computeBoundingBox();head.geometry.computeBoundingBox();
 const a=shaft.geometry.boundingBox,b=head.geometry.boundingBox;
 assert.ok(a.max.y-a.min.y>2.64);assert.ok(b.max.y-b.min.y>.20);
 assert.ok(b.min.y<a.max.y&&b.max.y>a.max.y,'The spearhead joins the upper shaft');
 for(const box of [a,b])for(const axis of ['x','z'])assert.ok(Math.max(Math.abs(box.min[axis]),Math.abs(box.max[axis]))<.018,'The head and shaft share one axis');
});

for(const appearance of ['granadero','woman-scout'])test(`${appearance} keeps owned long weapons clear of the actual horse during mount and dismount`,async()=>{
 const source=await asset(appearance);
 for(const gesture of ['mount','dismount'])for(const [id,item]of Object.entries(manifest.equipment.items).filter(([,item])=>['lance','rifle'].includes(item.category))){
  const spec=source.clips.find(clip=>clip.name===`life.${gesture}`),actor=new ActorRuntime(source,visual(appearance,gesture,{equipment:item.category==='lance'?'blade':'long-gun',items:[{id,reference:'primary',socket:'handRight'}]}));
  const weapon=actor.model.getObjectByName(`primary:${id}`),horse=actor.root.children.find(node=>node!==actor.model),lines=[];
  weapon.traverse(node=>{
   if(!node.isMesh)return;node.geometry.computeBoundingBox();const box=node.geometry.boundingBox,centre=box.getCenter(new Vector3()),axis=item.category==='lance'?'y':'x';
   const across=axis==='y'?['x','z']:['y','z'];
   for(const offset of [[0,0],[-1,0],[1,0],[0,-1],[0,1]]){
    const a=centre.clone(),b=centre.clone();a[axis]=box.min[axis];b[axis]=box.max[axis];
    for(let i=0;i<2;i++){const key=across[i],value=centre[key]+offset[i]*(box.max[key]-box.min[key])*.5;a[key]=value;b[key]=value;}
    lines.push({mesh:node,a,b});
   }
  });
  horse.traverse(node=>{if(node.isMesh)for(const material of Array.isArray(node.material)?node.material:[node.material])material.side=DoubleSide;});
  // Keep this regression quick. A separate 60-sample visual acceptance pass
  // checked the full path; these points cover side support, swing and seat.
  for(const fraction of [.20,.28,.40,.55,.65,.78,.90,.98]){
   at(actor,spec,fraction);if(!horse.visible)continue;
   for(const {mesh,a,b}of lines){
    const start=mesh.localToWorld(a.clone()),end=mesh.localToWorld(b.clone()),ray=new Raycaster(start,end.clone().sub(start).normalize(),0,start.distanceTo(end));
    assert.deepEqual(ray.intersectObject(horse,true).map(hit=>hit.object.name),[],`${gesture} ${id} clears the horse at ${fraction}`);
   }
  }
  assert.ok(weapon.visible);assert.equal(actor.visual.items[0].id,id);actor.dispose();
 }
});
