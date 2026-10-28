import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AnimationClip,AnimationMixer,Group,InterpolateDiscrete,InterpolateLinear,LoopOnce,Object3D,QuaternionKeyframeTrack,Vector3,VectorKeyframeTrack,Matrix4} from '../web/node_modules/three/build/three.module.js';
import {pathToFileURL} from 'node:url';
const library=process.env.CHARACTER_REVIEW_LIBRARY?pathToFileURL(process.env.CHARACTER_REVIEW_LIBRARY.replace(/\/$/,'')+'/'):new URL('../web/public/models/characters/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',library),'utf8'));
const format={5121:['readUInt8',1,255],5123:['readUInt16LE',2,65535],5125:['readUInt32LE',4,4294967295],5126:['readFloatLE',4]};
const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
function glb(url){
 const bytes=readFileSync(new URL(url.replace('/models/characters/',''),library)),size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size)),binary=bytes.subarray(28+size),cache=new Map();
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
  result.push({time,...read(point,scene)});
 }
 mixer.stopAllAction();mixer.uncacheRoot(scene);return result;
}

const transitions=['transition.stand.prone','transition.prone.stand','transition.crouch.prone','transition.prone.crouch'];
function vertices(bank,kind){
 const skin=bank.body.json.skins[0],names=skin.joints.map(i=>bank.body.json.nodes[i].name),result=[];
 for(const node of bank.body.json.nodes){
  if(node.mesh===undefined||node.skin===undefined||!node.name.includes({boot:'footwear',sleeve:'outfit',hand:'skin',seat:'legwear'}[kind]))continue;
  for(const primitive of bank.body.json.meshes[node.mesh].primitives){
   const p=bank.body.access(primitive.attributes.POSITION),j=bank.body.access(primitive.attributes.JOINTS_0),w=bank.body.access(primitive.attributes.WEIGHTS_0);
   for(let i=0;i<p.length/3;i++){
    const joints=j.slice(i*4,i*4+4),weights=w.slice(i*4,i*4+4);
    if(kind==='hand'&&weights.reduce((sum,v,k)=>sum+(/^(hand_|thumb_|index_|middle_|ring_|pinky_)/.test(names[joints[k]])?v:0),0)<.5)continue;
    if(kind==='seat'&&weights.reduce((sum,v,k)=>sum+(names[joints[k]]==='pelvis'?v:0),0)<.5)continue;
    if(kind==='sleeve'&&weights.reduce((sum,v,k)=>sum+(names[joints[k]].startsWith('lowerarm_')?v:0),0)<.5)continue;
    result.push({point:new Vector3().fromArray(p,i*3),joints,weights});
   }
  }
 }
 assert.ok(result.length>20,`Actual ${kind} vertices are present`);return result;
}
function floorProbe(bank,scene,points){
 const skin=bank.body.json.skins[0],ib=bank.body.access(skin.inverseBindMatrices);
 const matrices=skin.joints.map((index,i)=>new Matrix4().multiplyMatrices(scene.getObjectByName(bank.body.json.nodes[index].name).matrixWorld,new Matrix4().fromArray(ib,i*16)));
 let lowest=Infinity;
 for(const vertex of points){const p=new Vector3();for(let i=0;i<4;i++)if(vertex.weights[i])p.addScaledVector(vertex.point.clone().applyMatrix4(matrices[vertex.joints[i]]),vertex.weights[i]);lowest=Math.min(lowest,p.y);}
 return lowest;
}
for(const [gender,bank]of Object.entries(banks)){
 test(`${gender} crawl clock retains complete planted-surface pull records`,()=>{
  const spec=bank.specs.find(s=>s.name==='prone.crawl.unarmed'),measurement=spec.strideMeasurement;
  // PR209 replaced the old median of positive elbow-pivot velocities with
  // actual planted sleeve displacement. The independent skin-contact and
  // slip measurement is in characters-prone-arm-support.test.mjs.
  assert.equal(measurement.method,'native forearm planted pull displacement');
  assert.deepEqual(measurement.pulls.map(p=>[p.hand,p.from,p.to]),[['r',0,.5],['l',.5,1]]);
  const duration=clip(bank.data,spec.name).duration;
  for(const pull of measurement.pulls){assert.ok(pull.distance>.1&&pull.distance<.2);assert.ok(Math.abs(pull.duration-duration*.5)<.000002);}
  const measured=measurement.pulls.reduce((sum,p)=>sum+p.distance,0)/duration;
  assert.ok(Math.abs(measured-spec.nativeStrideSpeed)<.000002,'Complete skin pulls determine the distance clock');
 });
 test(`${gender} crawl alternates both leg assists with a small body weight transfer`,()=>{
  const values=samples(bank,'prone.crawl.unarmed',point=>({pelvis:point('pelvis'),feet:['l','r'].map(side=>point('foot_'+side)),knees:['l','r'].map(side=>point('calf_'+side))}),120);
  const range=(items,key)=>Math.max(...items.map(p=>p[key]))-Math.min(...items.map(p=>p[key]));
  for(let side=0;side<2;side++){
   assert.ok(range(values.map(v=>v.feet[side]),'z')>.08,'Each boot takes part in the crawl');
   assert.ok(range(values.map(v=>v.knees[side]),'z')>.05,'Each knee assists the forearm pull');
  }
  const peak=side=>values.reduce((best,v,i)=>v.feet[side].z>values[best].feet[side].z?i:best,0)/120;
  const separation=Math.abs(peak(0)-peak(1));
  assert.ok(separation>.30&&separation<.70,'The two leg draws are in opposite parts of the cycle');
  const sway=range(values.map(v=>v.pelvis),'x');
  assert.ok(sway>.01&&sway<.06,'The pelvis transfers a modest amount of weight');
 });
 test(`${gender} crawl and recovery retain real contact clearance without limb snaps`,()=>{
  const sleeve=vertices(bank,'sleeve'),boot=vertices(bank,'boot'),hand=vertices(bank,'hand'),seat=vertices(bank,'seat');
  for(const name of ['prone.crawl.unarmed','life.stand.die','life.prone.die','life.stand.recover','life.prone.recover','life.crouch.recover']){
   const values=samples(bank,name,(point,scene)=>({joints:['head','pelvis','hand_l','hand_r','lowerarm_l','lowerarm_r','calf_l','calf_r','foot_l','foot_r'].map(point),hand:floorProbe(bank,scene,hand),seat:floorProbe(bank,scene,seat),sleeve:floorProbe(bank,scene,sleeve),boot:floorProbe(bank,scene,boot)}));
   for(let i=0;i<values.length;i++){
    assert.ok(values[i].sleeve>-.002,`${name} ${values[i].time}: actual sleeve clears the floor`);
    assert.ok(values[i].boot>-.002,`${name} ${values[i].time}: actual sole and boot shaft clear the floor`);
    assert.ok(values[i].hand>-.002,`${name} ${values[i].time}: actual palm and fingers clear the floor`);
    assert.ok(values[i].seat>-.002,`${name} ${values[i].time}: fitted breeches seat clears the floor`);
    if(name==='life.stand.recover')assert.ok(values[i].boot<.020,`${name} ${values[i].time}: a boot supports the rise as the palms release`);
    if(i)for(let joint=0;joint<values[i].joints.length;joint++){
     const speed=values[i].joints[joint].distanceTo(values[i-1].joints[joint])/(values[i].time-values[i-1].time);
     assert.ok(speed<(name.endsWith('.die')?6:3),`${name} ${values[i].time}: no sudden inverse-kinematics branch change (${speed} m/s)`);
    }
   }
  }
 });
 test(`${gender} fallen arms rest on the floor and recovery starts at that same pose`,()=>{
  const names=bank.body.json.skins[0].joints.map(i=>bank.body.json.nodes[i].name);
  const read=point=>({joints:Object.fromEntries(names.map(name=>[name,point(name)]))});
  for(const posture of ['stand','prone']){
   const settled=samples(bank,`life.${posture}.die`,read,1)[1];
   const dead=samples(bank,`life.${posture}.dead`,read,1)[0];
   const recovery=samples(bank,`life.${posture}.recover`,read,1)[0];
   for(const name of names){
    assert.ok(settled.joints[name].distanceTo(dead.joints[name])<.0001,`${posture} ${name}: fall ends in the resting pose`);
    assert.ok(dead.joints[name].distanceTo(recovery.joints[name])<.001,`${posture} ${name}: recovery starts without a pose jump`);
   }
   for(const side of ['l','r']){
    assert.ok(dead.joints['lowerarm_'+side].y<.085,`${posture}: settled elbow is supported`);
    assert.ok(dead.joints['hand_'+side].y<.075,`${posture}: settled hand is not held in the air`);
   }
  }
 });
 test(`${gender} every exported clip preserves duration and strictly increasing time`,()=>{
  for(const spec of bank.specs){
   const definition=bank.data.json.animations.find(a=>a.name===spec.name);assert.ok(definition,spec.name);
   const native=spec.nativeSidewaysSupport;
   if(native){assert.match(spec.name,/^stand\.strafe(Left|Right)\.(unarmed|long-gun|short-gun|blade|knife|lance)$/);assert.equal(native.method,'native-sideways-leg-rotations');}
   assert.ok(Math.abs(clip(bank.data,spec.name).duration-(native?.nativeCycleDuration??spec.duration))<.000002,`${spec.name}: exact declared endpoint is retained`);
   for(const sampler of definition.samplers){const times=bank.data.access(sampler.input);for(let i=1;i<times.length;i++)assert.ok(times[i]>times[i-1],`${spec.name}: no duplicate or reversed key times`);}
  }
 });
 test(`${gender} exported loops close and retained lateral cycles keep their measured seams`,()=>{
  for(const spec of bank.specs.filter(s=>s.loop)){
   const result=samples(bank,spec.name,point=>({joints:['head','hand_l','hand_r','foot_l','foot_r'].map(point)}),1);
   // PR216 and PR223 retain the original shorter stored lateral period.
   // Its measured full-body seam is below 17 mm; complete native boot
   // support across that seam is checked in characters-sideways-support.
   const retained=/^stand\.strafe(Left|Right)\.(unarmed|long-gun|short-gun|blade|knife|lance)$/.test(spec.name);
   if(retained)assert.equal(spec.nativeSidewaysSupport?.method,'native-sideways-leg-rotations');
   result[0].joints.forEach((p,i)=>assert.ok(p.distanceTo(result[1].joints[i])<(retained ? .017 : .00003),`${spec.name}: terminal seam stays inside its native contract`));
  }
 });
 test(`${gender} posture changes have supported sleeves and continuous native limbs`,()=>{
  const sleeve=vertices(bank,'sleeve'),boot=vertices(bank,'boot');
  for(const name of transitions){
   const result=samples(bank,name,(point,scene)=>({points:['hand_l','hand_r','calf_l','calf_r'].map(point),elbows:['lowerarm_l','lowerarm_r'].map(point),sleeve:floorProbe(bank,scene,sleeve),boot:floorProbe(bank,scene,boot)}));
   for(let i=0;i<result.length;i++){
    assert.ok(result[i].sleeve>-.002,`${name} ${result[i].time}: actual sleeve remains above the ground`);
    assert.ok(result[i].boot>-.006,`${name} ${result[i].time}: actual boot remains at the floor`);
    for(const elbow of result[i].elbows)assert.ok(elbow.y>.05,`${name}: elbow has room for the sleeve`);
    if(i)for(let j=0;j<result[i].points.length;j++)assert.ok(result[i].points[j].distanceTo(result[i-1].points[j])<.045,`${name}: no one-frame limb snap`);
   }
  }
 });
 test(`${gender} crouched gait and low work do not bury the exported boots`,()=>{
  const boot=vertices(bank,'boot');
  for(const name of ['crouch.walk.unarmed','crouch.strafeRight.unarmed','crouch.strafeLeft.knife','stand.gesture.pickup','stand.gesture.heal','stand.gesture.free']){
   const result=samples(bank,name,(point,scene)=>({floor:floorProbe(bank,scene,boot),hand:point('hand_r')}),90);
   assert.ok(Math.min(...result.map(s=>s.floor))>-.006,`${name}: no buried boot`);
   if(name.includes('.gesture.'))assert.ok(Math.min(...result.map(s=>s.hand.y))<.16,`${name}: working hand reaches the low object`);
  }
 });
 test(`${gender} prone and crawl retain grounded, mostly extended leg support`,()=>{
  const boot=vertices(bank,'boot');
  for(const name of ['prone.idle.unarmed','prone.crawl.unarmed']){
   const result=samples(bank,name,(point,scene)=>({floor:floorProbe(bank,scene,boot),legs:['l','r'].map(side=>({hip:point('thigh_'+side),knee:point('calf_'+side),ankle:point('foot_'+side)}))}),60);
   for(const sample of result){
    assert.ok(sample.floor>-.006,`${name}: actual boot clears the floor throughout the loop`);
    const bend=sample.legs.map(({hip,knee,ankle})=>Math.PI-hip.clone().sub(knee).angleTo(ankle.clone().sub(knee)));
    assert.ok(Math.min(...bend)<.7,`${name}: one leg stays extended`);
    if(name.includes('.idle.'))assert.ok(Math.max(...bend)<.7,`${name}: both resting legs stay extended`);
    for(const {hip,knee,ankle}of sample.legs){assert.ok(Math.abs(knee.x-hip.x)<.25,`${name}: no extreme hip splay`);assert.ok(knee.y>.05&&ankle.y>.08,`${name}: native knee and ankle remain clear of the floor`);}
   }
  }
 });
}
