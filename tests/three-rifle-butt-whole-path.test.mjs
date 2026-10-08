import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {register} from 'node:module';import test from 'node:test';
register('./tactical-render-loader.mjs',import.meta.url);
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {presentActors}=await import('../web/lib/three/presentation.ts');
const {TILE_METRES}=await import('../web/lib/three/projection.ts');
const {publishedActor}=await import('./published-actor-fixture.mjs');
const {createBattle,presentedActBattle,actBattle}=await import('../game/tactical.js');
const {Vector3,Triangle,Matrix4,Quaternion}=await import('../web/node_modules/three/build/three.module.js');
const {capsuleSurfaceGap}=await import('./skinned-surface-contact-fixture.mjs');

async function pair(appearance='granadero',diagonal=false,posture='standing',weapon=1800,lod=0,options={}){
 const squad=[{id:'sabre',name:'Culata',x:6,y:10,facing:2,spriteAppearance:appearance,weapon,weaponInstanceId:'rifle-butt-owned',activeSlot:'primary',weaponMode:'melee',loaded:1,ammo:12,blade:0,condition:81,agility:90,dexterity:85,strength:85,wisdom:80,experienceLevel:7,energy:100,stance:'standing',movementMode:'walk',skinTone:'brown',headwear:null,outfit:null,legwear:null}],enemy={id:'target-sabre',name:'Realista',x:7,y:10+(diagonal?1:0),facing:6,weapon:1800,loaded:1,ammo:6,hp:100,morale:100,patrol:false,overwatch:false,marksmanship:55,spriteAppearance:'royalist',skinTone:'light',stance:posture,movementMode:posture==='crouched'?'crouch':'walk'};
 if(options.offhand)squad[0].offHand={weapon:1806,loaded:1,count:1,weight:1.2,condition:57,jammed:false,instanceId:'rifle-butt-owned-left'};
 const state=createBattle(squad,{id:'rifle-butt-contact',width:24,height:20,seed:45,tiles:Array.from({length:480},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),enemies:[enemy,{id:'reserve',x:22,y:18,patrol:false,overwatch:false}]});
 for(const actor of state.units)actor.ap=actor.id==='sabre'?100:0;const unit=state.units.find(unit=>unit.id==='sabre'),target=state.units.find(unit=>unit.id==='target-sabre');
 if(options.bayonet)unit.weaponFittings={bayonet:{weapon:1811,fittingPattern:'india_socket',condition:80,instanceId:'owned-fixed-bayonet'}};
 const before=JSON.stringify(state),result=presentedActBattle(state,{type:'melee',unitId:unit.id,targetId:target.id}),contact=result.frames.find(frame=>frame.type==='contact');
 assert.ok(contact,`The real rules admit one paid strike: ${result.state.lastError}`);assert.equal(JSON.stringify(state),before);assert.deepEqual(result.state,actBattle(state,{type:'melee',unitId:unit.id,targetId:target.id}));
 assert.equal(result.frames.filter(frame=>frame.type==='contact'&&frame.unitId===unit.id).length,1);assert.equal(result.state.units.find(actor=>actor.id===unit.id).loaded,unit.loaded);assert.equal(result.state.units.find(actor=>actor.id===unit.id).ammo,unit.ammo);
 const frame={...contact,sequenceId:'rifle-butt-contact-review',actionId:1,index:1,startedAt:420,durationMs:650,actionStartedAt:0,actionDurationMs:1970};
 const admitted=frame.state.units.filter(actor=>['sabre','target-sabre'].includes(actor.id)).map(actor=>({key:`unit:${actor.id}`,kind:'unit',actor})),actors=presentActors(frame.state,admitted,{},new Set(),{frame,now:420}),attacker=actors.find(actor=>actor.id==='sabre'),defender=actors.find(actor=>actor.id==='target-sabre');
 assert.ok(attacker.cue.contactTarget);assert.ok(attacker.cue.contactSupport.floors.length);
 const [asset,other]=await Promise.all([publishedActor(appearance,lod),publishedActor(defender.appearance,lod)]),body=new ActorRuntime(other,defender);body.tick(.1,1070);body.root.updateMatrixWorld(true);
 return {attacker,defender,asset,body,frame,result,state,weapon};
}
function faces(root,accept=()=>true){
 const result=[];root.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!mesh.visible||!accept(mesh))return;
  const index=mesh.geometry.index,vertices=[],accepted=[];const vertex=i=>vertices[i]??(vertices[i]=mesh.localToWorld(mesh.getVertexPosition(i,new Vector3()))),keep=i=>accepted[i]??(accepted[i]=accept(mesh,i));
  for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(!ids.every(keep))continue;const face=ids.map(vertex);if(new Triangle(...face).getArea()>1e-10)result.push(face);}
 });return result;
}
function capFaces(runtime,weapon){
 const item=runtime.model.getObjectByName(`primary:${weapon}`);assert.ok(item);item.updateWorldMatrix(true,true);const meshes=[];item.traverse(mesh=>{if(mesh.isMesh&&mesh.visible&&mesh.material.name==='Equipment_Aged_Brass')meshes.push(mesh);});assert.ok(meshes.length);
 const points=meshes.map(mesh=>Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>item.worldToLocal(mesh.localToWorld(new Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i))))),bottom=Math.min(...points.flatMap(vertices=>vertices.map(point=>point.x))),faces=[];
 for(let m=0;m<meshes.length;m++){const mesh=meshes[m],index=mesh.geometry.index;for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(!ids.every(vertex=>Math.abs(points[m][vertex].x-bottom)<1e-6))continue;const face=ids.map(vertex=>item.localToWorld(points[m][vertex].clone()));if(new Triangle(...face).getArea()>1e-10)faces.push(face);}}
 assert.equal(faces.length,2,'The measured contact part is the two actual exported brass butt-face triangles');return faces;
}
function gap(a,b){
 // Only surface gaps within the 1 mm assertion matter. This conservative
 // triangle-AABB filter removes rifle parts far from either actual palm.
 const low=new Vector3(Infinity,Infinity,Infinity),high=new Vector3(-Infinity,-Infinity,-Infinity);for(const face of a)for(const point of face){low.min(point);high.max(point);}low.addScalar(-.00101);high.addScalar(.00101);
 const near=b.filter(face=>!['x','y','z'].some(axis=>Math.max(...face.map(point=>point[axis]))<low[axis]||Math.min(...face.map(point=>point[axis]))>high[axis]));let minimum=Infinity;
 for(const face of a)for(let i=0;i<3;i++){const start=face[i],end=face[(i+1)%3];if(start.distanceToSquared(end)<1e-12)continue;minimum=Math.min(minimum,capsuleSurfaceGap(start,end,0,near));if(minimum<=1e-8)return minimum;}return minimum;
}
function weaponFaces(runtime,weapon,forestock=false){const item=runtime.model.getObjectByName(`primary:${weapon}`),faces=[];item.traverse(mesh=>{if(!mesh.isMesh||!mesh.visible||forestock&&mesh.material.name!=='Equipment_Walnut')return;const p=mesh.geometry.attributes.position,index=mesh.geometry.index;for(let i=0;i<index.count;i+=3)faces.push([0,1,2].map(offset=>mesh.localToWorld(new Vector3().fromBufferAttribute(p,index.getX(i+offset)))));});return faces;}
function palmFaces(runtime,side='r'){return faces(runtime.model,(mesh,index)=>{if(mesh.material.name!=='Skin')return false;if(index===undefined)return true;let weight=0;for(let slot=0;slot<4;slot++)if(mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getComponent(index,slot)].name===`hand_${side}`)weight+=mesh.geometry.attributes.skinWeight.getComponent(index,slot);return weight>.5;});}
function lowestSole(runtime){const mesh=runtime.model.getObjectByName(runtime.asset.appearance.parts.footwear.replace('{lod}',String(runtime.asset.lod))),p=mesh.geometry.attributes.position;let minimum=Infinity;for(let i=0;i<p.count;i++)minimum=Math.min(minimum,mesh.localToWorld(mesh.getVertexPosition(i,new Vector3())).y);return minimum;}
function nativeBones(asset){const bones=new Map();asset.body.scene.traverse(node=>{if(node.isBone)bones.set(node.name,{position:node.position.clone(),scale:node.scale.clone()});});return bones;}
function assertNative(runtime,bones,position){assert.deepEqual(runtime.root.position.toArray(),position);assert.ok(Math.abs(runtime.root.rotation.y-runtime.visual.yaw)<1e-10);runtime.model.traverse(node=>{const original=bones.get(node.name);if(!original)return;if(node.name!=='Root')assert.ok(node.position.distanceTo(original.position)<1e-6,`${node.name} native offset`);assert.ok(node.scale.distanceTo(original.scale)<1e-6,`${node.name} native scale`);});}
function assertGuard(runtime,source){
 // The finger grip remains authored. Both whole palms translate with the gun;
 // neither native hand orientation nor any bone offset/length is changed.
 for(const side of ['l','r']){
  const hand=runtime.model.getObjectByName(`hand_${side}`),native=source.model.getObjectByName(`hand_${side}`),currentWorld=hand.getWorldQuaternion(new Quaternion()),nativeWorld=native.getWorldQuaternion(new Quaternion());
  assert.ok(currentWorld.toArray().every((value,index)=>Math.abs(value-nativeWorld.toArray()[index])<1e-6),`${side} native wrist rotation`);
  hand.traverse(node=>{if(!node.isBone||node===hand)return;const original=source.model.getObjectByName(node.name);assert.ok(node.quaternion.toArray().every((value,index)=>Math.abs(value-original.quaternion.toArray()[index])<1e-8),`${node.name} native finger grip`);});
 }
}
function gripMatrix(runtime,weapon,side='r'){const item=runtime.model.getObjectByName(`primary:${weapon}`);return new Matrix4().copy(runtime.model.getObjectByName(`hand_${side}`).matrixWorld).invert().multiply(item.matrixWorld);}
function assertGrip(runtime,source,weapon){for(const side of ['l','r']){const current=gripMatrix(runtime,weapon,side).elements,native=gripMatrix(source,weapon,side).elements;assert.ok(current.every((value,index)=>Math.abs(value-native[index])<1e-6),`The same owned rifle keeps its native ${side} wrist grip`);}}
function assertPalms(runtime,weapon,label){
 const rule=runtime.clipSpec.nativeHandContacts,time=runtime.action.time;
 let sides=['l','r'];
 if(rule){
  assert.equal(rule.version,1);assert.equal(rule.space,'skinned-hand-to-stock');
  const holds=side=>rule.hands[side].some(([start,end])=>time>=start-1e-7&&time<=end+1e-7);
  sides=[['l','left'],['r','right']].filter(([,side])=>holds(side)).map(([side])=>side);
  assert.ok(sides.length>0,label+' always has an authored holding hand');
  const [start,end]=rule.powered;
  assert.ok(start<=runtime.clipSpec.markers.contact&&end>=runtime.clipSpec.markers.contact);
  if(time>=start-1e-7&&time<=end+1e-7)assert.deepEqual(sides,['l','r'],label+' both palms hold during powered strike');
 }
 const surfaces=weaponFaces(runtime,weapon);
 for(const side of sides)assert.ok(gap(palmFaces(runtime,side),surfaces)<=.001,`${label} actual ${side} holding palm on rifle surface`);
 if(sides.includes('l'))assert.ok(gap(palmFaces(runtime,'l'),weaponFaces(runtime,weapon,true))<=.001,`${label} actual left palm on walnut stock`);
}
function assertIntendedWrists(runtime,source,label){
 const plan=runtime.meleeFit.plan;
 if(!plan){
  assert.equal(runtime.visual.action,runtime.visual.idleAction,label+' completes in its native idle');
  for(const side of ['l','r'])assert.ok(runtime.model.getObjectByName(`hand_${side}`).getWorldPosition(new Vector3()).distanceTo(source.model.getObjectByName(`hand_${side}`).getWorldPosition(new Vector3()))<1e-8,label+' final '+side+' wrist returns exactly to source');
  return;
 }
 const time=runtime.action.time,contact=runtime.clipSpec.markers.contact,end=runtime.action.getClip().duration,smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);},weight=time<=contact?smooth(time/contact):1-smooth((time-contact)/(end*.9-contact)),delta=plan.hand.clone().applyQuaternion(runtime.root.quaternion).multiplyScalar(weight);
 for(const side of ['l','r']){
  // This desired endpoint comes from a separately rendered source wrist,
  // rather than the fit's clamped hand or its accumulated diagnostics.
  const a=source.model.getObjectByName(`upperarm_${side}`).getWorldPosition(new Vector3()),b=source.model.getObjectByName(`lowerarm_${side}`).getWorldPosition(new Vector3()),c=source.model.getObjectByName(`hand_${side}`).getWorldPosition(new Vector3()),length=a.distanceTo(b)+b.distanceTo(c),desired=c.add(delta),shoulder=runtime.model.getObjectByName(`upperarm_${side}`).getWorldPosition(new Vector3()),wrist=runtime.model.getObjectByName(`hand_${side}`).getWorldPosition(new Vector3());
  assert.ok(Math.max(0,shoulder.distanceTo(desired)-(length-.001))<1e-7,`${label} intended ${side} wrist stays within native arm reach`);
  assert.ok(wrist.distanceTo(desired)<1e-6,`${label} actual ${side} wrist reaches the independently defined endpoint`);
 }
}

const {AnimationMixer,LoopOnce}=await import('../web/node_modules/three/build/three.module.js');const {clone}=await import('../web/node_modules/three/examples/jsm/utils/SkeletonUtils.js');
function geometry(asset,model){const mesh=model.getObjectByName(asset.appearance.parts.footwear.replace('{lod}',String(asset.lod))),rest=asset.body.scene.getObjectByName(mesh.name),sides={};rest.updateMatrixWorld(true);for(const side of ['l','r']){const indices=[];for(let i=0;i<mesh.geometry.attributes.position.count;i++)if((mesh.geometry.attributes.position.getX(i)>0)===(side==='l'))indices.push(i);const points=indices.map(i=>rest.getVertexPosition(i,new Vector3()).applyMatrix4(rest.matrixWorld)),low=Math.min(...points.map(p=>p.y)),outline=indices.filter((_,i)=>points[i].y<=low+.003);assert.ok(indices.length>200&&outline.length>=40);sides[side]={indices,outline};}return {mesh,sides};}
function bootSample(g,height=0,translation=new Vector3()){return Object.fromEntries(['l','r'].map(side=>{const points=g.sides[side].indices.map(i=>g.mesh.getVertexPosition(i,new Vector3()).applyMatrix4(g.mesh.matrixWorld).add(translation)),outline=g.sides[side].outline.map(i=>g.mesh.getVertexPosition(i,new Vector3()).applyMatrix4(g.mesh.matrixWorld).add(translation)),minimum=Math.min(...points.map(p=>p.y))-height,soleMinimum=Math.min(...outline.map(p=>p.y))-height,soleMaximum=Math.max(...outline.map(p=>p.y))-height,centroid=outline.reduce((s,p)=>s.add(p),new Vector3()).divideScalar(outline.length);return [side,{points,outline,minimum,soleMinimum,soleMaximum,span:soleMaximum-soleMinimum,centroid}];}));}
function speedMetrics(){return {centroid:0,outline:0,wholeBoot:0};}
function speeds(now,before,dt,max){if(!before||dt<=0)return;for(const side of ['l','r']){max.centroid=Math.max(max.centroid,now[side].centroid.distanceTo(before[side].centroid)/dt);for(const key of ['points','outline'])for(let i=0;i<now[side][key].length;i++)max[key==='points'?'wholeBoot':'outline']=Math.max(max[key==='points'?'wholeBoot':'outline'],now[side][key][i].distanceTo(before[side][key][i])/dt);}}
function gait(asset,name='stand.walk.blade'){const model=clone(asset.body.scene),mixer=new AnimationMixer(model),clip=asset.animation.animations.find(c=>c.name===name),spec=asset.clips.find(c=>c.name===clip.name),speed=spec.nativeStrideSpeed??spec.locomotionSpeed,action=mixer.clipAction(clip).setLoop(LoopOnce,1).play(),g=geometry(asset,model),maximum=speedMetrics();action.clampWhenFinished=true;action.timeScale=0;let previous;const count=Math.ceil(clip.duration*240),dt=clip.duration/count;for(let i=0;i<=count;i++){action.time=i*dt;mixer.update(0);model.updateMatrixWorld(true);const feet=bootSample(g,0,new Vector3(0,0,i*dt*speed));speeds(feet,previous,dt,maximum);previous=feet;}mixer.stopAllAction();return {clip:clip.name,sourceSpeed:speed,duration:clip.duration,halfStride:speed*clip.duration/2,nativeSampleHz:240,maximum};}
function snapshotBones(model){const values={};model.traverse(b=>{if(b.isBone)values[b.name]=[...b.position.toArray(),...b.quaternion.toArray(),...b.scale.toArray(),...b.matrixWorld.elements];});return values;}
function boneDifference(a,b){let max=0;for(const name of Object.keys(a))for(let i=0;i<a[name].length;i++)max=Math.max(max,Math.abs(a[name][i]-b[name][i]));return max;}
function independentWrists(runtime,source,plan,time){const smooth=v=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);},weight=time<=plan.contact?smooth(time/plan.contact):1-smooth((time-plan.contact)/((plan.handRecovery??plan.duration*.9)-plan.contact)),delta=plan.hand.clone().applyQuaternion(runtime.root.quaternion).multiplyScalar(weight),out={};for(const side of ['l','r']){const a=source.model.getObjectByName(`upperarm_${side}`).getWorldPosition(new Vector3()),b=source.model.getObjectByName(`lowerarm_${side}`).getWorldPosition(new Vector3()),c=source.model.getObjectByName(`hand_${side}`).getWorldPosition(new Vector3()),length=a.distanceTo(b)+b.distanceTo(c),desired=c.add(delta),shoulder=runtime.model.getObjectByName(`upperarm_${side}`).getWorldPosition(new Vector3()),actual=runtime.model.getObjectByName(`hand_${side}`).getWorldPosition(new Vector3());out[side]={clamp:Math.max(0,shoulder.distanceTo(desired)-(length-.001)),endpoint:actual.distanceTo(desired)};}return out;}
function bodyMinimum(runtime){let low=Infinity;runtime.model.traverse(mesh=>{if(!mesh.isSkinnedMesh||!mesh.visible)return;for(let i=0;i<mesh.geometry.attributes.position.count;i++)low=Math.min(low,mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld).y-runtime.visual.position[1]);});return low;}
function insideFloor(point,floors){return floors.some(f=>point.x>=f.minX-1e-8&&point.x<=f.maxX+1e-8&&point.z>=f.minZ-1e-8&&point.z<=f.maxZ+1e-8);}

test('all48 owned rifle pairings satisfy independent both-wrist and complete boot paths at240Hz',async t=>{
 const gaits=new Map();
 for(const appearance of ['granadero','woman-scout'])for(const diagonal of [false,true])for(const posture of ['standing','crouched'])for(const weapon of [1800,1801,1802,1803,1804,1807]){
  const f=await pair(appearance,diagonal,posture,weapon),saved=JSON.stringify(f.result),frameSaved=JSON.stringify(f.frame.state),cue={...f.attacker.cue,phase:undefined,phaseStartedAt:0,startedAt:0,durationMs:1000};delete cue.phaseDurationMs;const shown={...f.attacker,cue},completed=[],runtime=new ActorRuntime(f.asset,shown,(key,id)=>completed.push({key,id}),()=>({model:f.body.model,root:f.body.root})),source=new ActorRuntime(f.asset,shown),g=geometry(f.asset,runtime.model),native=nativeBones(f.asset),surfaces=faces(f.body.model),label=`${appearance}/${diagonal?'diagonal':'cardinal'}/${posture}/${weapon}`;
  if(!gaits.has(appearance))gaits.set(appearance,gait(f.asset));const walk=gaits.get(appearance);let previous,maximum=speedMetrics(),maximumClamp=0,maximumEndpoint=0,maximumSupportingOutline=0;
  try{
   runtime.tick(0,0);source.tick(0,0);assert.ok(runtime.meleeFit.plan?.twoHands,label+' has a real admitted two-hand fit');assert.ok(runtime.meleeFit.plan.step.length()<=walk.halfStride&&runtime.meleeFit.plan.rearStep.length()<=walk.halfStride,label+' fits within a measured half walking stride');
   // This isolates the native full1s path at a fixed contact heading. Real
   // idle-start and paid prepare/contact turn boundaries have separate tests.
   const times=[...new Set([...Array.from({length:241},(_,i)=>i/240),.42,.57])].sort((a,b)=>a-b);
   for(const time of times){
    runtime.update(shown,time*1000);source.update(shown,time*1000);runtime.tick(0,time*1000);source.tick(0,time*1000);runtime.root.updateMatrixWorld(true);source.root.updateMatrixWorld(true);assertNative(runtime,native,shown.position);assertGuard(runtime,source);assertGrip(runtime,source,weapon);const feet=bootSample(g,shown.position[1]),supportSide=feet.l.minimum<=feet.r.minimum?'l':'r',support=feet[supportSide],plan=runtime.meleeFit.plan;
    assert.ok(Math.min(feet.l.minimum,feet.r.minimum)>=-.001,label+' complete weighted boots clear floor at'+time);assert.ok(support.minimum<=.008&&support.soleMinimum>=-.001&&support.soleMaximum<=.008,label+' complete supporting outline remains within floor bounds at'+time);maximumSupportingOutline=Math.max(maximumSupportingOutline,support.soleMaximum);
    for(const side of ['l','r'])for(const point of feet[side].points)assert.ok(insideFloor(point,cue.contactSupport.floors),label+' complete boot stays over disclosed floor at'+time);
    if(time<1){assert.ok(plan?.twoHands,label+' retains its admitted fit for the complete finite path');const wrists=independentWrists(runtime,source,plan,time);for(const side of ['l','r']){maximumClamp=Math.max(maximumClamp,wrists[side].clamp);maximumEndpoint=Math.max(maximumEndpoint,wrists[side].endpoint);assert.ok(wrists[side].clamp<1e-7,label+' independently requested '+side+' wrist is never clamped at'+time);assert.ok(wrists[side].endpoint<1e-6,label+' actual '+side+' wrist reaches its independent endpoint at'+time);}}
    if(previous)speeds(feet,previous.feet,time-previous.time,maximum);assert.ok(maximum.centroid<=walk.maximum.centroid+1e-5,label+' actual sole centroid speed remains within measured native walking');assert.ok(maximum.outline<=walk.maximum.outline+1e-5,label+' every actual sole outline point remains within measured native walking');assert.ok(maximum.wholeBoot<=walk.maximum.wholeBoot+1e-5,label+' every weighted boot-shaft point remains within measured native walking');
    if(time===.42){assert.ok(gap(capFaces(runtime,weapon),surfaces)<=.001,label+' actual owned brass butt cap contacts current native target skin/cloth');assertPalms(runtime,weapon,label);assert.ok(bodyMinimum(runtime)>=-.001,label+' actual full body surface clears floor at contact');}
    previous={time,feet};
   }
   assert.equal(completed.length,1,label+' completes once');assert.equal(runtime.visual.action,runtime.visual.idleAction);assert.ok(boneDifference(snapshotBones(runtime.model),snapshotBones(source.model))<1e-12,label+' exact native final guard returns');assert.equal(JSON.stringify(f.result),saved);assert.equal(JSON.stringify(f.frame.state),frameSaved);
   t.diagnostic(JSON.stringify({appearance,diagonal,posture,weapon,maximumClamp,maximumEndpoint,maximumSupportingOutline,maximumSpeed:maximum,walkingCap:walk.maximum}));
  }finally{runtime.dispose();source.dispose();f.body.dispose();}
 }
});
