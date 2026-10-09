import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {AnimationClip,AnimationMixer,Group,InterpolateDiscrete,InterpolateLinear,LoopOnce,Object3D,Quaternion,QuaternionKeyframeTrack,Vector3,VectorKeyframeTrack} from '../web/node_modules/three/build/three.module.js';
const {sampleAnimationTime}=await import('../web/lib/three/animation-clock.ts');
const libraryRoot=process.env.GRANADEROS_CHARACTER_LIBRARY?pathToFileURL(resolve(process.env.GRANADEROS_CHARACTER_LIBRARY)+sep):new URL('../web/public/models/characters/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',libraryRoot),'utf8'));
const sourceHash=createHash('sha256').update(readFileSync(new URL('../assets/source/characters-3d/authoring/reviewed_motion.py',import.meta.url))).digest('hex');
const format={5121:['readUInt8',1,255],5123:['readUInt16LE',2,65535],5125:['readUInt32LE',4,4294967295],5126:['readFloatLE',4]};
const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
function glb(url){
 assert.ok(url.startsWith('/models/characters/'),'Asset belongs to the character library');
 const bytes=readFileSync(new URL(url.slice('/models/characters/'.length),libraryRoot)),size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size)),binary=bytes.subarray(28+size),cache=new Map();
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
const distanceRange=points=>Math.max(...points.map(p=>p.distanceTo(points[0])));
const expected={
 'stand.idle.unarmed':'Idle','stand.walk.unarmed':'Walk','stand.run.unarmed':'Run','stand.punch.unarmed':'Punch',
 'stand.idle.long-gun':'RifleAim','stand.aim.long-gun':'RifleAim','stand.brace.long-gun':'RifleAim','stand.fire.long-gun':'RifleFire','stand.walk.long-gun':'RifleWalk','stand.run.long-gun':'RifleRun','stand.bayonet.long-gun':'BayonetThrust','stand.butt.long-gun':'RifleButtStrike',
 'stand.idle.short-gun':'PistolAim','stand.aim.short-gun':'PistolAim','stand.fire.short-gun':'PistolFire','stand.walk.short-gun':'PistolWalk','stand.run.short-gun':'PistolRun','stand.butt.short-gun':'PistolStrike',
 'stand.idle.blade':'SabreReady','stand.brace.blade':'SabreReady','stand.slash.blade':'SabreSlash','stand.walk.blade':'SabreWalk','stand.run.blade':'SabreRun','stand.slash.blade.forehand':'SabreForehand','stand.slash.blade.backhand':'SabreBackhand','stand.slash.blade.thrust':'SabreThrust','stand.slash.blade.hilt':'SabreHiltStrike',
 'stand.idle.knife':'KnifeReady','stand.brace.knife':'KnifeReady','stand.slash.knife':'KnifeSlash','stand.walk.knife':'KnifeWalk','stand.run.knife':'KnifeRun','stand.slash.knife.backhand':'KnifeBackhand','stand.slash.knife.thrust':'KnifeThrust'
};
for(const [gender,bank]of Object.entries(banks)){
 test(`${gender} carried crawl variants retain their separate published pace`,()=>{
  const spec=bank.specs.find(entry=>entry.name==='prone.crawl.long-gun');
  assert.equal(spec.strideMeasurement.method,'median rearward forearm contact velocity');
  assert.deepEqual(spec.strideMeasurement.bones,['lowerarm_l','lowerarm_r']);
  assert.ok(spec.nativeStrideSpeed>.15&&spec.nativeStrideSpeed<.4);
  assert.ok(Math.abs(spec.strideDistance-spec.nativeStrideSpeed*spec.duration)<.000002);
  for(const variant of bank.specs.filter(entry=>entry.gesture==='crawl'&&entry.equipment!=='unarmed')){
   assert.equal(variant.nativeStrideSpeed,spec.nativeStrideSpeed,'Carried poses keep their existing travel calibration');
   assert.deepEqual(variant.strideMeasurement,spec.strideMeasurement);
  }
  const unarmed=bank.specs.find(entry=>entry.name==='prone.crawl.unarmed');
  assert.equal(unarmed.strideMeasurement.method,'native forearm planted pull displacement');
  assert.equal(unarmed.nativeArmSupport.alternatingRecovery,true);
 });
 test(`${gender} exported standing motions bind the reviewed poses and free playback speed`,()=>{
  for(const [name,reviewedName]of Object.entries(expected)){
   const spec=bank.specs.find(entry=>entry.name===name);assert.ok(spec,name);
   assert.equal(spec.reviewedPose?.name,reviewedName,name);
   assert.equal(spec.reviewedPose.origin,'approved-granadero-preview',name);
   // A selective export retains the real frozen-source digest of every
   // unchanged clip. It must not relabel those clips as newly rebuilt.
   assert.match(spec.reviewedPose.sourceSha256,/^[a-f0-9]{64}$/,`${name}: recorded source SHA-256`);
   if(spec.reviewedPose.nativeGrip){
    assert.match(spec.reviewedPose.nativeGrip.sourceSha256,/^[a-f0-9]{64}$/,`${name}: recorded native grip source SHA-256`);
    assert.equal(spec.reviewedPose.nativeGrip.anatomy,gender,`${name}: grip uses the native anatomy`);
   }
   assert.equal(spec.playbackRate,1.25);assert.equal(spec.timingAuthority,'simulation');
   assert.ok(Math.abs(clip(bank.data,name).duration-spec.duration)<.00001,`${name}: baked and declared duration match`);
   assert.equal(sampleAnimationTime({clip:spec,action:spec.gesture,now:0}).rate,1.25,`${name}: published clip controls free playback`);
   if(!spec.loop){const marker=spec.gesture==='fire'?'shot':'contact';assert.ok(spec.markers[marker]>0&&spec.markers[marker]<spec.duration,`${name}: contact remains inside the motion`);assert.equal(spec.markers.secondHit,undefined,'One paid strike has one contact');}
   if(['walk','run'].includes(spec.gesture))assert.ok(spec.locomotionSpeed>0,`${name}: native stride remains calibrated`);
  }
  assert.ok(!bank.specs.some(spec=>spec.reviewedPose?.name==='SabreCombination'),'Two-contact preview combination cannot replace one paid strike');
 });
 test(`${gender} fresh descending cuts record the current reviewed source provenance`,()=>{
  for(const name of ['stand.slash.blade','stand.slash.knife']){
   const spec=bank.specs.find(entry=>entry.name===name);assert.ok(spec,name);
   assert.equal(spec.reviewedPose?.sourceSha256,sourceHash,`${name}: rebuilt cut uses the current reviewed source`);
  }
 });
 test(`${gender} exported punch advances the body and recovers with an active free arm`,()=>{
  const values=samples(bank,'stand.punch.unarmed',(point,scene)=>({root:point('Root'),pelvis:point('pelvis'),chest:point('neck_01'),right:point('hand_r'),left:point('hand_l'),relativeLeft:scene.getObjectByName('spine_03').worldToLocal(point('hand_l')),front:point('foot_l'),rear:point('foot_r')}));
  const start=values[0],contact=bank.specs.find(spec=>spec.name==='stand.punch.unarmed').markers.contact;
  const support=values.filter(s=>s.time>=contact-.08&&s.time<=contact+.08);
  const forward=Math.max(...values.map(s=>s.root.z-start.root.z)),lean=Math.max(...values.map(s=>s.chest.z-s.pelvis.z-(start.chest.z-start.pelvis.z))),rearLift=Math.max(...values.filter(s=>s.time>=contact-.04).map(s=>s.rear.y-start.rear.y));
  assert.ok(forward>.16,`${gender}: body advances ${forward.toFixed(3)}m`);
  assert.ok(lean>.12,`${gender}: upper chest leans ${lean.toFixed(3)}m beyond the pelvis`);
  assert.ok(distanceRange(support.map(s=>s.front))<.01,'Lead foot supports contact');
  assert.ok(rearLift>.08,'Rear foot leaves the ground after the push');
  assert.ok(distanceRange(values.map(s=>s.right))>.35,'Fist fully extends');
  assert.ok(distanceRange(values.map(s=>s.left))>.12,'Free arm moves with the whole body');
  assert.ok(distanceRange(values.map(s=>s.relativeLeft))>.06,'Free arm also moves independently of the torso');
 assert.ok(start.right.distanceTo(values.at(-1).right)<.001,'Punch returns to guard');
 });
 test(`${gender} exported punch keeps the wrists stable and closes the knuckles at impact`,()=>{
  const values=samples(bank,'stand.punch.unarmed',(point,scene)=>({
   wrists:['l','r'].map(side=>scene.getObjectByName(`hand_${side}`).quaternion.clone()),
   knuckles:['index','middle','ring','pinky'].map(finger=>{
    const knuckle=point(`${finger}_01_r`),next=point(`${finger}_02_r`);
    return knuckle.clone().sub(point('hand_r')).angleTo(next.sub(knuckle))*180/Math.PI;
   }),
  }));
  for(let i=1;i<values.length;i++)for(let side=0;side<2;side++){
   const speed=values[i].wrists[side].angleTo(values[i-1].wrists[side])*180/Math.PI/(values[i].time-values[i-1].time);
   assert.ok(speed<720,`The wrist must not flip during preparation (${speed.toFixed(1)} degrees/s)`);
  }
  const contact=bank.specs.find(spec=>spec.name==='stand.punch.unarmed').markers.contact;
  const impact=values.reduce((a,b)=>Math.abs(a.time-contact)<Math.abs(b.time-contact)?a:b);
  assert.ok(impact.knuckles.every(angle=>angle>60&&angle<115),`All four knuckles must form a compact fist: ${impact.knuckles.map(angle=>angle.toFixed(1))}`);
 });
 test(`${gender} exported weapon and carry motions keep both arms active`,()=>{
  for(const name of ['stand.fire.long-gun','stand.fire.short-gun','stand.slash.blade','stand.slash.blade.backhand','stand.slash.knife','stand.slash.knife.backhand']){
   const values=samples(bank,name,point=>({left:point('hand_l')})),travel=distanceRange(values.map(s=>s.left));
   assert.ok(travel>(name.includes('.fire.')?.008:.06),`${name}: left hand moves ${travel.toFixed(4)}m`);
   assert.ok(values[0].left.distanceTo(values.at(-1).left)<.001,`${name}: left hand returns to guard`);
  }
  for(const equipment of ['long-gun','short-gun','blade','knife'])for(const gait of ['walk','run']){
   const name=`stand.${gait}.${equipment}`,values=samples(bank,name,(point,scene)=>({right:scene.getObjectByName('spine_03').worldToLocal(point('hand_r'))})),travel=distanceRange(values.map(s=>s.right));
   assert.ok(travel>(equipment==='long-gun'?.015:.06)&&travel<.4,`${name}: carry moves relative to the torso without flailing (${travel.toFixed(3)}m)`);
  }
 });
 test(`${gender} exported firearm firing grips keep native wrist and index anatomy`,()=>{
  const rest=rig(bank.body.json),restWrist=Object.fromEntries(['r','l'].map(side=>[side,rest.getObjectByName(`hand_${side}`).quaternion.clone().invert()]));
  for(const name of ['stand','crouch','prone','mounted'].flatMap(posture=>['aim','fire'].flatMap(gesture=>['long-gun','short-gun'].map(equipment=>`${posture}.${gesture}.${equipment}`)))){
   const values=samples(bank,name,(point,scene)=>{
    const wrists=(name.endsWith('short-gun')?['r']:['r','l']).map(side=>{
     const palm=point(`middle_01_${side}`).sub(point(`hand_${side}`)).normalize();
     const forearm=point(`hand_${side}`).sub(point(`lowerarm_${side}`)).normalize();
     const delta=new Quaternion().multiplyQuaternions(restWrist[side],scene.getObjectByName(`hand_${side}`).quaternion);
     let twist=2*Math.atan2(delta.y,delta.w)*180/Math.PI;twist=((twist+180)%360+360)%360-180;
     return {bend:palm.angleTo(forearm)*180/Math.PI,twist:Math.abs(twist)};
    });
    const long=point('middle_01_r').sub(point('hand_r')).normalize();
    const across=point('index_01_r').sub(point('pinky_01_r'));
    const normal=across.cross(long).normalize(),hinge=long.clone().cross(normal).normalize();
    const indexAbduction=[['index_01_r','index_02_r'],['index_02_r','index_03_r']].map(([a,b])=>Math.asin(Math.min(1,Math.abs(point(b).sub(point(a)).normalize().dot(hinge))))*180/Math.PI);
    return {wrists,indexAbduction};
   });
   for(const value of values){
    assert.ok(value.wrists.every(wrist=>wrist.bend<45),`${name}: a fitted stock must not require a folded wrist (${value.wrists.map(w=>w.bend.toFixed(1))} degrees)`);
    assert.ok(value.wrists.every(wrist=>wrist.twist<12),`${name}: pronation belongs in the forearm, not a wrist-only twist (${value.wrists.map(w=>w.twist.toFixed(1))} degrees)`);
    assert.ok(value.indexAbduction.every(angle=>angle<15),`${name}: the trigger finger must flex in its native plane, not bend sideways (${value.indexAbduction.map(a=>a.toFixed(1))} degrees)`);
   }
  }
 });
 test(`${gender} exported firearm aim follows the native right eye in every posture`,()=>{
  const rest=rig(bank.body.json);
  const eye=new Vector3(...(gender==='male'?[-.029511534,1.650874138,.131320670]:[-.031627864,1.642763257,.122219481]));
  const localEye=rest.getObjectByName('head').worldToLocal(eye);
  for(const posture of ['stand','crouch','prone','mounted'])for(const equipment of ['long-gun','short-gun']){
   const name=`${posture}.aim.${equipment}`,grip=equipment==='long-gun'?'rifle':'pistol',sight=grip==='rifle'?.078:.070;
   const values=samples(bank,name,(_point,scene)=>{
    const eye=scene.getObjectByName('head').localToWorld(localEye.clone());
    const gunEye=scene.getObjectByName(`socket_handRight_${grip}`).worldToLocal(eye);
    return {error:Math.hypot(gunEye.z,gunEye.y-sight)};
   },30);
   assert.ok(values.every(value=>value.error<.005),`${name}: native eye stays within 5 mm of the sight line`);
  }
 });
 test(`${gender} exported rifle carries keep the supporting palm on the fore-end`,()=>{
  // Read the native hand sockets from the published body and animate them
  // with the published bank. An unreachable IK target can look correct in
  // authoring code while the exported hand is several centimetres off it.
  for(const gait of ['walk','run']){
   const name=`stand.${gait}.long-gun`,values=samples(bank,name,(point,scene)=>({palm:scene.getObjectByName('socket_handRight_rifle').worldToLocal(point('socket_handLeft_rifle'))}));
   const grip=bank.specs.find(spec=>spec.name===name).reviewedPose?.nativeGrip;
   const support=new Vector3(...(grip?.supportPosition??[.22,.030,0]));
   if(grip)assert.equal(grip.space,'gltf-weapon-local');
   const worst=Math.max(...values.map(value=>value.palm.distanceTo(support)));
   assert.ok(worst<.006,`${name}: exported supporting palm stays within 6 mm of the fore-end (${(worst*1000).toFixed(1)} mm)`);
  }
 });
}
test('male and female exported motions use their separate native anatomy',()=>{
 const length=bank=>{const scene=rig(bank.body.json),point=name=>scene.getObjectByName(name).getWorldPosition(new Vector3());return point('upperarm_r').distanceTo(point('lowerarm_r'))+point('lowerarm_r').distanceTo(point('hand_r'));};
 assert.ok(Math.abs(length(banks.male)-length(banks.female))>.02,'Female bank does not reuse the male bind pose');
 assert.notEqual(banks.male.specs.find(s=>s.name==='stand.walk.unarmed').locomotionSpeed,banks.female.specs.find(s=>s.name==='stand.walk.unarmed').locomotionSpeed,'Each native anatomy has its own calibrated stride');
});
test('all eight appearances retain nonuniform skin and cloth pigments after LOD0 export',()=>{
 assert.equal(Object.keys(manifest.appearances).length,8);
 for(const appearance of Object.values(manifest.appearances)){
  const data=glb(appearance.lods.find(lod=>lod.lod===0).url);
  for(const role of ['skin','apparel']){
   const material=appearance.materials[role],primitives=data.json.meshes.flatMap(mesh=>mesh.primitives).filter(primitive=>data.json.materials[primitive.material].name===material);
   assert.ok(primitives.length,`${appearance.id}: ${material} is exported`);
   let varying=0;
   for(const primitive of primitives){
    assert.notEqual(primitive.attributes.COLOR_0,undefined,`${appearance.id}: ${material} keeps authored vertex pigments`);
    const accessor=data.json.accessors[primitive.attributes.COLOR_0],width=widths[accessor.type],colors=data.access(primitive.attributes.COLOR_0);
    assert.equal(accessor.count,data.json.accessors[primitive.attributes.POSITION].count);
    for(let channel=0;channel<3;channel++){
     let min=Infinity,max=-Infinity;for(let i=channel;i<colors.length;i+=width){min=Math.min(min,colors[i]);max=Math.max(max,colors[i]);}
     assert.ok(min>=0&&max<=1,`${appearance.id}: ${material} pigments are normalized`);
     if(max-min>.02)varying++;
    }
   }
   assert.ok(varying>=2,`${appearance.id}: ${material} has visible color variation rather than uniform plastic shading`);
  }
 }
});
