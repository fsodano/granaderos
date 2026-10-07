import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AnimationClip,AnimationMixer,Group,InterpolateDiscrete,InterpolateLinear,LoopOnce,Object3D,QuaternionKeyframeTrack,Vector3,VectorKeyframeTrack} from '../web/node_modules/three/build/three.module.js';
const publicRoot=new URL('../web/public/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('models/characters/manifest.json',publicRoot),'utf8'));
const format={5121:['readUInt8',1,255],5123:['readUInt16LE',2,65535],5125:['readUInt32LE',4,4294967295],5126:['readFloatLE',4]};
const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
function glb(url){
 const bytes=readFileSync(new URL(`.${url}`,publicRoot)),size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size)),binary=bytes.subarray(28+size),cache=new Map();
 const access=index=>{
  if(cache.has(index))return cache.get(index);
  const a=json.accessors[index],view=json.bufferViews[a.bufferView],[read,size,max]=format[a.componentType],width=widths[a.type];
  assert.ok(width);assert.equal(a.sparse,undefined,'Published bank uses packed accessors');
  const values=Array.from({length:a.count*width},(_,i)=>{const value=binary[read]((view.byteOffset??0)+(a.byteOffset??0)+Math.floor(i/width)*(view.byteStride??size*width)+i%width*size);return a.normalized?value/max:value;});
  cache.set(index,values);return values;
 };
 return {json,access};
}
function rig(json){
 const nodes=json.nodes.map(def=>{const node=new Object3D();node.name=def.name;if(def.matrix)node.matrix.fromArray(def.matrix).decompose(node.position,node.quaternion,node.scale);else{if(def.translation)node.position.fromArray(def.translation);if(def.rotation)node.quaternion.fromArray(def.rotation);if(def.scale)node.scale.fromArray(def.scale);}return node;});
 json.nodes.forEach((def,i)=>(def.children??[]).forEach(child=>nodes[i].add(nodes[child])));
 const scene=new Group();for(const i of json.scenes[json.scene??0].nodes)scene.add(nodes[i]);scene.updateMatrixWorld(true);return scene;
}
function clip(data,name){
 const def=data.json.animations.find(entry=>entry.name===name);assert.ok(def,`Exported motion ${name} exists`);
 return new AnimationClip(name,-1,def.channels.map(channel=>{const sampler=def.samplers[channel.sampler],property={translation:'position',rotation:'quaternion',scale:'scale'}[channel.target.path],Track=property==='quaternion'?QuaternionKeyframeTrack:VectorKeyframeTrack;assert.ok(['LINEAR','STEP'].includes(sampler.interpolation??'LINEAR'));return new Track(`${data.json.nodes[channel.target.node].name}.${property}`,data.access(sampler.input),data.access(sampler.output),sampler.interpolation==='STEP'?InterpolateDiscrete:InterpolateLinear);}));
}
const banks=Object.fromEntries([['male','granadero'],['female','woman-scout']].map(([gender,appearance])=>[gender,{body:glb(manifest.appearances[appearance].lods[0].url),data:glb(manifest.animationLibraries[gender].url),specs:manifest.animationLibraries[gender].clips}]));
function samples(bank,name,read,sampleCount){
 const scene=rig(bank.body.json),animation=clip(bank.data,name),mixer=new AnimationMixer(scene),action=mixer.clipAction(animation).setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();
 const bones=bank.body.json.skins[0].joints.map(index=>scene.getObjectByName(bank.body.json.nodes[index].name)),native=bones.map(bone=>bone.position.length());
 const point=name=>{const node=scene.getObjectByName(name);assert.ok(node,`Native joint ${name}`);return node.getWorldPosition(new Vector3());};
 const result=[],count=sampleCount??Math.ceil(animation.duration*120);
 for(let i=0;i<=count;i++){
  const time=animation.duration*i/count;mixer.setTime(time);scene.updateMatrixWorld(true);
  for(let j=0;j<bones.length;j++)if(bones[j].name!=='Root')assert.ok(Math.abs(bones[j].position.length()-native[j])<.0001,`${name}: ${bones[j].name} retains its native bone length`);
  result.push({time,...read(point,scene,time)});
 }
 mixer.stopAllAction();mixer.uncacheRoot(scene);return result;
}

const equipmentData=glb(manifest.equipment.url),equipment=rig(equipmentData.json);
const meshByName=new Map(equipmentData.json.nodes.filter(node=>node.mesh!==undefined).map(node=>[node.name,node.mesh]));
function positionAt(keys,time){
 let position=keys[0].position;
 for(let i=1;i<keys.length;i++){
  const a=keys[i-1],b=keys[i];if(time>=b.time){position=b.position;continue;}
  const fraction=Math.max(0,(time-a.time)/(b.time-a.time));return a.position.map((v,axis)=>v+(b.position[axis]-v)*fraction);
 }
 return position;
}
for(const [gender,bank]of Object.entries(banks))for(const posture of ['stand','crouch','prone','mounted']){
 test(`${gender} ${posture} loading contacts fit every exported rifle and preserve native support`,()=>{
  for(const itemId of ['1800','1801','1802','1803','1804','1807'])for(const gesture of ['reload','unload']){
   const base=`${posture}.${gesture}.long-gun`,name=manifest.equipment.items[itemId].clipOverrides[base];
   assert.equal(name,`${base}.${itemId}`);const spec=bank.specs.find(clip=>clip.name===name);
   assert.equal(spec.loadingContact.method,'native palm and item muzzle');
   assert.deepEqual(spec.markers,{contact:spec.duration*.45,ready:spec.duration*.92});
   const values=samples(bank,name,(point,scene,time)=>{
    const right=scene.getObjectByName('socket_handRight_rifle'),left=scene.getObjectByName('socket_handLeft_tool');
    let item=right.getObjectByName(`item_${itemId}`);if(!item){item=equipment.getObjectByName(`item_${itemId}`).clone(true);right.add(item);}
    item.position.fromArray(positionAt(spec.gripOffsets[0].keys,time));scene.updateMatrixWorld(true);
    const palm=left.getWorldPosition(new Vector3()),muzzle=point(`muzzle_${itemId}`),barrel=right.localToWorld(new Vector3(1,0,0)).sub(right.getWorldPosition(new Vector3())).normalize(),rod=left.localToWorld(new Vector3(0,1,0)).sub(palm).normalize();
    let lowest;
    if(Math.abs(time-spec.duration*(gesture==='reload'?.36:.25))<.00001){
     lowest=Infinity;item.traverse(node=>{const mesh=equipmentData.json.meshes[meshByName.get(node.name)];if(!mesh)return;
      for(const primitive of mesh.primitives){const positions=equipmentData.access(primitive.attributes.POSITION);for(let i=0;i<positions.length;i+=3)lowest=Math.min(lowest,node.localToWorld(new Vector3(...positions.slice(i,i+3))).y);}
     });
    }
    return {palm,muzzle,barrel,rod,lowest,support:item.worldToLocal(right.getWorldPosition(new Vector3())),feet:['foot_l','foot_r'].map(point)};
   },100);
   const read=fraction=>values[Math.round(fraction*(values.length-1))];
   for(const fraction of gesture==='reload'?[.36,.46]:[.25]){
    const value=read(fraction);if(value.lowest!==undefined)assert.ok(value.lowest>-.01,`${name}: actual stock remains above the ground (${value.lowest.toFixed(4)} m)`);assert.ok(value.palm.distanceTo(value.muzzle)<.006,`${name}: palm meets actual muzzle within 6 mm (${(value.palm.distanceTo(value.muzzle)*1000).toFixed(2)} mm)`);
   }
   for(const fraction of gesture==='reload'?[.50,.58,.66,.70,.79,.83]:[.25,.45]){
    const value=read(fraction),relative=value.palm.clone().sub(value.muzzle),axial=relative.dot(value.barrel);
    // The rod is 3 mm in radius and the authored muzzle is 10.5 mm. A 6 mm
    // centre tolerance leaves it inside the muzzle through 30 Hz bake blends.
    assert.ok(relative.clone().addScaledVector(value.barrel,-axial).length()<.006,`${name} at ${fraction}: working palm stays inside the muzzle clearance (${(relative.clone().addScaledVector(value.barrel,-axial).length()*1000).toFixed(2)} mm)`);
    assert.ok(value.rod.dot(value.barrel)<-.9999,`${name}: ramrod points into the barrel`);
    const expected=new Vector3(...spec.loadingContact.support);assert.ok(value.support.distanceTo(expected)<.0001,`${name}: support palm encloses the authored barrel grip`);
   }
   const start=read(0),end=read(1);
   assert.ok(start.support.length()<.0001&&end.support.length()<.0001,'The weapon returns to the ordinary trigger grip at each clip boundary');
   for(const fraction of [.36,.58,.70,1])for(const [i,foot]of read(fraction).feet.entries())assert.ok(foot.distanceTo(start.feet[i])<.0001,'Loading keeps the support feet planted');
   if(gesture==='reload')assert.deepEqual(spec.propCues,[{item:'ramrod',socket:'socket_handLeft_tool',start:2.208,end:4.128}]);
  }
 });
}
