import assert from 'node:assert/strict';
import {register} from 'node:module';
import test from 'node:test';
register('./tactical-render-loader.mjs',import.meta.url);
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {presentActors}=await import('../web/lib/three/presentation.ts');
const {publishedActor}=await import('./published-actor-fixture.mjs');
const {createBattle,presentedActBattle,actBattle}=await import('../game/tactical.js');
const {Vector3}=await import('../web/node_modules/three/build/three.module.js');

async function paidVisual(appearance){
 const state=createBattle([{id:'rifle',name:'Culata',x:6,y:10,facing:2,spriteAppearance:appearance,weapon:1800,weaponInstanceId:'guard-blend-owned-rifle',activeSlot:'primary',weaponMode:'melee',loaded:1,ammo:12,blade:0,condition:81,agility:90,dexterity:85,strength:85,wisdom:80,experienceLevel:7,energy:100,stance:'standing',movementMode:'walk',skinTone:'brown',headwear:null,outfit:null,legwear:null}],{id:'long-gun-guard-blend',width:24,height:20,seed:45,tiles:Array.from({length:480},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),enemies:[{id:'target',x:7,y:10,facing:6,weapon:1800,loaded:1,ammo:6,hp:100,morale:100,patrol:false,overwatch:false,spriteAppearance:'granadero',stance:'standing'},{id:'reserve',x:22,y:18,patrol:false,overwatch:false}]});
 for(const actor of state.units)actor.ap=actor.id==='rifle'?100:0;
 const before=JSON.stringify(state),order={type:'melee',unitId:'rifle',targetId:'target'},result=presentedActBattle(state,order),contact=result.frames.find(frame=>frame.type==='contact');
 assert.ok(contact,'The native source review starts from a legal owned-rifle action');assert.equal(JSON.stringify(state),before);assert.deepEqual(result.state,actBattle(state,order));
 const frame={...contact,sequenceId:'long-gun-guard-blend',actionId:1,index:1,startedAt:420,durationMs:650,actionStartedAt:0,actionDurationMs:1970},admitted=frame.state.units.filter(actor=>['rifle','target'].includes(actor.id)).map(actor=>({key:`unit:${actor.id}`,kind:'unit',actor})),visual=presentActors(frame.state,admitted,{},new Set(),{frame,now:420}).find(actor=>actor.id==='rifle');
 assert.ok(visual.cue.contactTarget);assert.ok(visual.cue.contactSupport.floors.length);
 return {visual,state,result};
}
function boots(asset,model){
 const mesh=model.getObjectByName(asset.appearance.parts.footwear.replace('{lod}',String(asset.lod))),rest=asset.body.scene.getObjectByName(mesh.name),sides={};rest.updateMatrixWorld(true);
 for(const side of ['l','r']){
  const indices=[];for(let i=0;i<mesh.geometry.attributes.position.count;i++)if((mesh.geometry.attributes.position.getX(i)>0)===(side==='l'))indices.push(i);
  const points=indices.map(i=>rest.getVertexPosition(i,new Vector3()).applyMatrix4(rest.matrixWorld)),low=Math.min(...points.map(p=>p.y)),outline=indices.filter((_,i)=>points[i].y<=low+.003);
  assert.ok(indices.length>200&&outline.length>=40,'Every boot vertex and its actual lower outline are measured');sides[side]={indices,outline};
 }
 return {mesh,sides};
}
function sampleBoots(g,height){
 return Object.fromEntries(['l','r'].map(side=>{
  const points=g.sides[side].indices.map(i=>g.mesh.getVertexPosition(i,new Vector3()).applyMatrix4(g.mesh.matrixWorld)),outline=g.sides[side].outline.map(i=>g.mesh.getVertexPosition(i,new Vector3()).applyMatrix4(g.mesh.matrixWorld)),minimum=Math.min(...points.map(p=>p.y))-height,top=Math.max(...outline.map(p=>p.y))-height;
  return [side,{points,minimum,top,span:top-(Math.min(...outline.map(p=>p.y))-height)}];
 }));
}
function boneOffsets(model){const result=new Map();model.traverse(bone=>{if(bone.isBone)result.set(bone.name,{position:bone.position.clone(),scale:bone.scale.clone()});});return result;}
function segmentLengths(model){return ['l','r'].flatMap(side=>[['thigh','calf'],['calf','foot'],['upperarm','lowerarm'],['lowerarm','hand']].map(([from,to])=>[`${from}_${side}`,`${to}_${side}`])).map(([from,to])=>({from,to,length:model.getObjectByName(from).getWorldPosition(new Vector3()).distanceTo(model.getObjectByName(to).getWorldPosition(new Vector3()))}));}

for(const appearance of ['granadero','woman-scout'])for(const cadence of [24,60,240])test(`${appearance} native rifle idle↔butt crossfade keeps complete boot support at ${cadence} Hz`,async()=>{
 const f=await paidVisual(appearance),asset=await publishedActor(appearance,0),saved=JSON.stringify(f.result),idle={...f.visual,action:f.visual.idleAction,cue:undefined},completed=[],runtime=new ActorRuntime(asset,idle,(key,id)=>completed.push({key,id})),guard=new ActorRuntime(asset,idle),dt=1/cadence;
 const g=boots(asset,runtime.model),native=boneOffsets(asset.body.scene),lengths=segmentLengths(runtime.model);
 const spec=asset.clips.find(clip=>clip.name==='stand.butt.long-gun');assert.equal(spec.playbackRate,1.25);assert.equal(spec.markers.contact,.42);assert.equal(runtime.action.getClip().name,'stand.idle.long-gun');
 // Hold the admitted cardinal contact heading to isolate source support. This
 // test keeps the runtime's ordinary .12 s fades and full finite native clock;
 // diagonal paid phase-turn coverage belongs to the presentation tests.
 for(let i=0;i<Math.ceil(.2*cadence);i++)runtime.tick(dt,-200+i*1000/cadence);
 const cue={...f.visual.cue,phase:undefined,phaseStartedAt:0,startedAt:0,durationMs:800};delete cue.phaseDurationMs;const shown={...f.visual,cue};runtime.update(shown,0);
 let previous,entryBlend=false,exitBlend=false,maximumSpeed=0;
 try{
  for(let i=0;i<=Math.ceil(1.2*cadence);i++){
   const now=i*1000/cadence;if(i>0)runtime.update(shown,now);runtime.tick(i===0?0:dt,now);runtime.root.updateMatrixWorld(true);const feet=sampleBoots(g,shown.position[1]),label=`${appearance}/${cadence} Hz/${now} ms`;
   assert.deepEqual(runtime.root.position.toArray(),shown.position);assert.equal(runtime.meleeFit.plan,undefined,'The repaired native source is checked without a runtime rifle fit');assert.ok(runtime.root.matrixWorld.elements.every(Number.isFinite));
   for(const side of ['l','r']){
    assert.ok(feet[side].minimum>.0015,label+' '+side+' complete boot clears the floor');assert.ok(feet[side].span<.007,label+' '+side+' complete sole keeps its bounded forefoot roll');
    if(previous)for(let j=0;j<feet[side].points.length;j++){const speed=feet[side].points[j].distanceTo(previous[side].points[j])/dt;maximumSpeed=Math.max(maximumSpeed,speed);assert.ok(speed<2,label+' '+side+' actual boot point moves continuously below 2 m/s');}
   }
   const supporting=feet.l.minimum<=feet.r.minimum?'l':'r';assert.ok(feet[supporting].minimum<.00225,label+' keeps a complete supporting boot at the 2 mm floor baseline');assert.ok(feet[supporting].top<.009,label+' supporting heel stays below 9 mm');
   runtime.model.traverse(bone=>{if(!bone.isBone)return;const original=native.get(bone.name);if(bone.name!=='Root')assert.ok(bone.position.distanceTo(original.position)<1e-5,label+' '+bone.name+' native offset');assert.ok(bone.scale.distanceTo(original.scale)<1e-5,label+' '+bone.name+' native scale');assert.ok(bone.matrixWorld.elements.every(Number.isFinite));});
   for(const segment of lengths)assert.ok(Math.abs(runtime.model.getObjectByName(segment.from).getWorldPosition(new Vector3()).distanceTo(runtime.model.getObjectByName(segment.to).getWorldPosition(new Vector3()))-segment.length)<1e-6,label+' native '+segment.from+' segment length');
   for(const side of ['l','r']){
    const hip=runtime.model.getObjectByName(`thigh_${side}`).getWorldPosition(new Vector3()),knee=runtime.model.getObjectByName(`calf_${side}`).getWorldPosition(new Vector3()),ankle=runtime.model.getObjectByName(`foot_${side}`).getWorldPosition(new Vector3());
    assert.ok(hip.distanceTo(knee)+knee.distanceTo(ankle)-hip.distanceTo(ankle)>.002,label+' '+side+' keeps the measured 2 mm leg reach reserve through the blend');
   }
   const active=runtime.mixer._actions.filter(action=>action.enabled&&action.isScheduled()),idleWeight=active.find(action=>action.getClip().name==='stand.idle.long-gun')?.getEffectiveWeight(),buttWeight=active.find(action=>action.getClip().name==='stand.butt.long-gun')?.getEffectiveWeight(),blending=idleWeight>0&&idleWeight<1&&buttWeight>0&&buttWeight<1;
   if(now>0&&now<120)entryBlend||=blending;if(now>=800&&now<1000)exitBlend||=blending;previous=feet;
  }
  assert.ok(entryBlend,'The normal idle-to-butt .12 s crossfade was sampled');assert.ok(exitBlend,'The normal butt-to-idle .12 s crossfade was sampled');assert.equal(completed.length,1);assert.equal(runtime.visual.action,runtime.visual.idleAction);assert.equal(runtime.action.getClip().name,'stand.idle.long-gun');
  guard.tick(0,1200);guard.root.updateMatrixWorld(true);const expected=sampleBoots(boots(asset,guard.model),shown.position[1]);
  for(const side of ['l','r']){assert.ok(Math.abs(previous[side].minimum-.002)<.00025);assert.ok(previous[side].top<.00225,'The full final guard sole is level');for(let i=0;i<previous[side].points.length;i++)assert.ok(previous[side].points[i].distanceTo(expected[side].points[i])<1e-6,'Every final boot point returns to the native idle guard');}
  assert.equal(JSON.stringify(f.result),saved);assert.ok(maximumSpeed>1,'The test measured the actual moving foot, not a static guard');
 }finally{runtime.dispose();guard.dispose();}
});
