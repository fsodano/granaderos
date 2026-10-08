import assert from 'node:assert/strict';
import {register} from 'node:module';
import test from 'node:test';
register('./tactical-render-loader.mjs',import.meta.url);
const {advanceSceneActors}=await import('../web/lib/three/scene-actors.ts');
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {admittedActors,presentActors}=await import('../web/lib/three/presentation.ts');
const {resolveContactTargetModel}=await import('../web/lib/three/contact-target-model.ts');
const {publishedActor}=await import('./published-actor-fixture.mjs');
const {createRendererSandboxBattle}=await import('../web/app/renderer-sandbox/fixtures.js');
const {presentedActBattle,actBattle}=await import('../game/tactical.js');
const {battleFrameDuration}=await import('../game/battle-playback.js');
const {Vector3,Triangle,Quaternion}=await import('../web/node_modules/three/build/three.module.js');
const {capsuleSurfaceGap}=await import('./skinned-surface-contact-fixture.mjs');

function meshFaces(mesh){
 const p=mesh.geometry.attributes.position,index=mesh.geometry.index,vertices=Array.from({length:p.count},(_,i)=>mesh.localToWorld(mesh.isSkinnedMesh?mesh.getVertexPosition(i,new Vector3()):new Vector3().fromBufferAttribute(p,i))),out=[];
 for(let i=0;i<index.count;i+=3){const face=[0,1,2].map(slot=>vertices[index.getX(i+slot)]);if(new Triangle(...face).getArea()>1e-10)out.push(face);}return out;
}
function bodyFaces(runtime){runtime.root.updateMatrixWorld(true);const out=[];runtime.model.traverse(mesh=>{if(mesh.isSkinnedMesh&&mesh.visible)out.push(...meshFaces(mesh));});return out;}
function oldStrikeGap(runtime,target){
 runtime.root.updateMatrixWorld(true);const item=runtime.model.getObjectByName('primary:1800'),hilt=runtime.action.getClip().name.endsWith('.hilt'),faces=[];item.traverse(mesh=>{if(mesh.isMesh&&mesh.visible&&(hilt?/Leather_Grip|Crossguard|Pommel/:/Curved_Blade/).test(mesh.name))faces.push(...meshFaces(mesh));});assert.ok(faces.length);const surface=bodyFaces(target);let minimum=Infinity;for(const face of faces)for(let i=0;i<3;i++){if(face[i].distanceToSquared(face[(i+1)%3])<1e-12)continue;minimum=Math.min(minimum,capsuleSurfaceGap(face[i],face[(i+1)%3],0,surface));if(minimum<=1e-8)return 0;}return minimum;
}
async function combat(posture='standing',appearance,diagonal=false){
 let state=createRendererSandboxBattle('combat');state=actBattle(state,{type:'move',unitId:'rifle',x:9,y:5});assert.equal(state.lastError,null);const order={type:'melee',unitId:'rifle',targetId:'target-rifle'};
 if(appearance)state.units.find(u=>u.id==='rifle').spriteAppearance=appearance;state.units.find(u=>u.id==='target-rifle').stance=posture;if(diagonal)state.units.find(u=>u.id==='target-rifle').y++;
 const result=presentedActBattle(state,order),durationMs=result.frames.map(battleFrameDuration),actionDurationMs=durationMs.reduce((a,b)=>a+b,0),entries=new Map(),trace=[],reads=[],revealed=new Set();let latest=[],currentNow=-200;
 const show=(state,frame,now)=>presentActors(state,admittedActors(state,state.units.filter(u=>u.side==='player'),revealed),{},revealed,{selected:'rifle',mode:'melee',frame,now});latest=show(state,undefined,-200);assert.equal(latest.length,13);assert.equal(latest.findIndex(v=>v.id==='rifle'),0);assert.equal(latest.findIndex(v=>v.id==='target-rifle'),7);
 for(const visual of latest){const asset=await publishedActor(visual.appearance,0),runtime=new ActorRuntime(asset,visual,undefined,target=>{const entry=entries.get(target.key),model=resolveContactTargetModel(target,latest,entry);reads.push({now:currentNow,target:target.key,accepted:Boolean(model),targetTicked:trace.some(event=>event[0]==='tick'&&event[1]===target.key)});return model;});const nativeTick=runtime.tick.bind(runtime),nativeUpdate=runtime.update.bind(runtime);let tickDepth=0;runtime.tick=(...args)=>{if(tickDepth===0)trace.push(['tick',runtime.visual.key]);tickDepth++;try{return nativeTick(...args);}finally{tickDepth--;}};runtime.update=(...args)=>{trace.push(['update',args[0].key]);return nativeUpdate(...args);};entries.set(visual.key,{runtime,visual,pending:false,error:false});}
 const run=(now,{refresh=true,active=()=>true,ambientPaused=false,reducedMotion=false}={})=>{if(refresh)latest=latest.map(visual=>({...visual}));const delta=(now-currentNow)/1000;currentNow=now;trace.length=0;const errors=[],activeActors=advanceSceneActors({visuals:latest,entry:key=>entries.get(key),active,delta,now,ambientPaused,reducedMotion,report:error=>errors.push(error)});assert.deepEqual(errors,[]);const ticks=trace.filter(event=>event[0]==='tick').map(event=>event[1]);assert.equal(new Set(ticks).size,ticks.length,'Each visible actor advances exactly once');assert.equal(ticks.length,activeActors);for(const visual of latest)assert.equal(entries.get(visual.key).visual,visual,'Every current identity is rebound before target resolution');return {ticks,activeActors};};
 run(-100);run(0);
 return {state,order,result,durationMs,actionDurationMs,entries,trace,reads,run,show,get latest(){return latest;},set latest(visuals){latest=visuals;},attacker:entries.get('unit:rifle').runtime,target:entries.get('unit:target-rifle').runtime,dispose(){for(const {runtime}of entries.values())runtime.dispose();}};
}
function frame(fixture,index,startedAt){return {...fixture.result.frames[index],index,sequenceId:'1:9',actionId:1,actionStartedAt:0,actionDurationMs:fixture.actionDurationMs,startedAt,durationMs:fixture.durationMs[index]};}


function brassButtFaces(runtime){
 const item=runtime.model.getObjectByName('primary:1800'),parts=[];assert.ok(item);item.updateWorldMatrix(true,true);item.traverse(mesh=>{if(mesh.isMesh&&mesh.visible&&mesh.material.name==='Equipment_Aged_Brass')parts.push(mesh);});
 const points=parts.map(mesh=>Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>item.worldToLocal(mesh.localToWorld(new Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i))))),bottom=Math.min(...points.flatMap(vertices=>vertices.map(p=>p.x))),faces=[];
 for(let m=0;m<parts.length;m++){const mesh=parts[m],index=mesh.geometry.index;for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(!ids.every(id=>Math.abs(points[m][id].x-bottom)<1e-6))continue;const face=ids.map(id=>item.localToWorld(points[m][id].clone()));if(new Triangle(...face).getArea()>1e-10)faces.push(face);}}
 assert.equal(faces.length,2);return faces;
}
function capGap(runtime,target){
 let minimum=Infinity;const surface=bodyFaces(target);
 for(const face of brassButtFaces(runtime))for(let i=0;i<3;i++){minimum=Math.min(minimum,capsuleSurfaceGap(face[i],face[(i+1)%3],0,surface));if(minimum<=1e-8)return 0;}return minimum;
}
function wristPath(runtime,native){
 const plan=runtime.meleeFit.plan;if(!plan)return;
 const time=runtime.action.time,contact=runtime.clipSpec.markers.contact,end=runtime.action.getClip().duration,smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);},weight=time<=contact?smooth(time/contact):1-smooth((time-contact)/(end*.9-contact)),delta=plan.hand.clone().applyQuaternion(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),native.visual.yaw)).multiplyScalar(weight);
 for(const side of ['l','r']){
  const a=native.model.getObjectByName(`upperarm_${side}`).getWorldPosition(new Vector3()),b=native.model.getObjectByName(`lowerarm_${side}`).getWorldPosition(new Vector3()),c=native.model.getObjectByName(`hand_${side}`).getWorldPosition(new Vector3()),length=a.distanceTo(b)+b.distanceTo(c),desired=c.add(delta),shoulder=runtime.model.getObjectByName(`upperarm_${side}`).getWorldPosition(new Vector3()),hand=runtime.model.getObjectByName(`hand_${side}`).getWorldPosition(new Vector3());
  assert.ok(Math.max(0,shoulder.distanceTo(desired)-(length-.001))<1e-7,`${side}: the separately mixed idle/strike wrist is reachable`);
  assert.ok(hand.distanceTo(desired)<1e-6,`${side}: the actual wrist reaches the independently mixed desired endpoint`);
 }
}
for(const hz of [24,60,240])test(`ordinary paid rifle preparation/contact stays supported through idle crossfade and refreshed13actor arrays at${hz}Hz`,async()=>{
 for(const posture of ['standing','crouched'])for(const appearance of ['granadero','woman-scout'])for(const diagonal of [false,true]){
  const f=await combat(posture,appearance,diagonal),before=JSON.stringify(f.result.state),original=JSON.stringify(f.state),initial=f.attacker.visual,native=new ActorRuntime(f.attacker.asset,initial);native.tick(.1,-100);native.tick(.1,0);let startedAt=0,previous,contactPlan,preparePlan,complete=0,maxSpeed=0;
  const sourceOffsets=new Map();native.model.traverse(node=>{if(node.isBone)sourceOffsets.set(node.name,{position:node.position.clone(),scale:node.scale.clone()});});
  f.attacker.onCueComplete=()=>complete++;
  for(let index=0;index<f.result.frames.length;index++){
   const shownFrame=frame(f,index,startedAt),state={...shownFrame.state,presentationVisibleIds:shownFrame.state.visibleIds};f.latest=f.show(state,shownFrame,startedAt);const duration=f.durationMs[index],stop=startedAt+duration;
   const times=duration?Array.from({length:Math.ceil(duration/(1000/hz))+1},(_,i)=>Math.ceil((startedAt-.000001)/(1000/hz))*(1000/hz)+i*(1000/hz)).filter(now=>now>=startedAt-.000001&&now<stop-.000001):[startedAt];
   for(const now of times){
    const delta=previous?(now-previous.now)/1000:0;f.run(now);const actor=f.attacker,turn=actor.visual.cue?.contactTurn,marker=actor.clipSpec.markers.contact,time=actor.action.time;
    let yaw=actor.visual.yaw;if(shownFrame.type==='prepare'&&turn){const fraction=Math.max(0,Math.min(1,time/(actor.action.getClip().duration*.1))),weight=fraction*fraction*(3-2*fraction),angle=Math.atan2(Math.sin(turn.toYaw-turn.fromYaw),Math.cos(turn.toYaw-turn.fromYaw));yaw=turn.fromYaw+angle*weight;}
    native.update({...actor.visual,yaw},now);native.tick(delta,now);actor.root.updateMatrixWorld(true);native.root.updateMatrixWorld(true);assert.ok(Math.abs(actor.root.rotation.y-yaw)<1e-7,'The paid turn uses its admitted heading');
    const root=actor.model.getObjectByName('Root').getWorldPosition(new Vector3());if(previous&&now>previous.now){const speed=root.distanceTo(previous.root)/((now-previous.now)/1000);maxSpeed=Math.max(maxSpeed,speed);assert.ok(speed<2,`${appearance}/${posture}/${diagonal}: a paid phase cannot jump the body (${speed} m/s)`);}
    if(['prepare','contact'].includes(shownFrame.type)){
     assert.ok(actor.meleeFit.plan,'The actual first refreshed array admits the native supported plan');wristPath(actor,native);assert.ok(actor.meleeFit.footReachError<.001);if(shownFrame.type==='prepare')preparePlan=actor.meleeFit.plan;else{contactPlan=actor.meleeFit.plan;assert.deepEqual(contactPlan.body.toArray(),preparePlan.body.toArray(),'Contact retains the admitted paid wind-up body');assert.deepEqual(contactPlan.step.toArray(),preparePlan.step.toArray());assert.deepEqual(contactPlan.rearStep.toArray(),preparePlan.rearStep.toArray());}
    }
    actor.model.traverse(node=>{const source=sourceOffsets.get(node.name);if(!source)return;if(node.name!=='Root')assert.ok(node.position.distanceTo(source.position)<1e-6,`${node.name} keeps its native segment offset`);assert.ok(node.scale.distanceTo(source.scale)<1e-6);});assert.deepEqual(actor.root.position.toArray(),actor.visual.position,'The gameplay cell transform stays authoritative');
    const boot=actor.model.getObjectByName(actor.asset.appearance.parts.footwear.replace('{lod}','0'));let minimum=Infinity;for(let vertex=0;vertex<boot.geometry.attributes.position.count;vertex++)minimum=Math.min(minimum,boot.localToWorld(boot.getVertexPosition(vertex,new Vector3())).y-actor.visual.position[1]);assert.ok(minimum>=-.001&&minimum<=.008,`Complete native boot support (${minimum})`);
    if(shownFrame.type==='contact'&&Math.abs(time-marker)<.001)assert.ok(capGap(actor,f.target)<.004,'Current target breathing retains the admitted actual brass contact surface tolerance');
    previous={now,root};
   }
   if(shownFrame.type==='contact'){f.run(stop-.000001);native.update({...f.attacker.visual,yaw:f.attacker.visual.yaw},stop-.000001);native.tick(0,stop-.000001);wristPath(f.attacker,native);assert.ok(capGap(f.attacker,f.target)<.004);}
   if(shownFrame.type==='impact')f.run(stop);
   startedAt=stop;
  }
  assert.ok(preparePlan&&contactPlan);assert.equal(complete,1,'The paid strike completes once');assert.equal(JSON.stringify(f.result.state),before);assert.equal(JSON.stringify(f.state),original);assert.deepEqual(f.result.state,actBattle(f.state,f.order));native.dispose();f.dispose();
 }
});
