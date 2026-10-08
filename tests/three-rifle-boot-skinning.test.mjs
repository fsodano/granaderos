import assert from 'node:assert/strict';
import test from 'node:test';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {NativeMeleeContactFit}=await import('../web/lib/three/melee-contact-fit.ts');
const {presentActors}=await import('../web/lib/three/presentation.ts');
const {publishedActor}=await import('./published-actor-fixture.mjs');
const {createBattle,presentedActBattle,actBattle}=await import('../game/tactical.js');
const {Vector3,Float32BufferAttribute,Group,AnimationMixer,LoopOnce}=await import('../web/node_modules/three/build/three.module.js');
const {clone}=await import('../web/node_modules/three/examples/jsm/utils/SkeletonUtils.js');

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
function cueVisual(f,occupied=false){
 const cue={...f.attacker.cue,phase:undefined,phaseStartedAt:0,startedAt:0,durationMs:1000};delete cue.phaseDurationMs;
 return {...f.attacker,cue,...(occupied?{items:f.attacker.items.map(item=>item.reference==='offhand'?{...item,socket:'handLeft'}:item)}:{})};
}
function compareSkin(fit,buffer,label){
 const boot=fit.completeBoot,mesh=boot.mesh,points=fit.completeBootPoints.call({previewFit:fit},buffer);assert.equal(points,buffer,'Correctly sized Float64 output is reused');assert.equal(points.length,boot.vertices.length*3);
 const direct=new Vector3(),expected=new Vector3();let maximum=0;
 for(let i=0;i<boot.vertices.length;i++){
  // Three's complete vertex path includes current morphs, native bind and
  // inverse-bind transforms, all skin weights and the current mesh parent.
  // It is independent of the scalar helper and inverse-bind point cache.
  mesh.getVertexPosition(boot.vertices[i],expected).applyMatrix4(mesh.matrixWorld);fit.solePoint(boot,boot.vertices[i],direct);
  for(let axis=0;axis<3;axis++){
   const actual=points[i*3+axis],reference=expected.getComponent(axis);assert.ok(Number.isFinite(actual),label+' finite whole boot coordinate');assert.ok(Math.abs(actual-reference)<1e-10,label+' batch agrees with full Three skinning');assert.ok(Math.abs(direct.getComponent(axis)-reference)<1e-10,label+' scalar solePoint agrees with full Three skinning');maximum=Math.max(maximum,Math.abs(actual-reference));
  }
 }
 return maximum;
}
function bonePose(model){const out=[];model.traverse(node=>{if(node.isBone)out.push([node.name,...node.position.toArray(),...node.quaternion.toArray(),...node.scale.toArray(),...node.matrixWorld.elements]);});return out;}
function checkFallbackSkin(runtime,buffer,label){
 const mesh=runtime.meleeFit.completeBoot.mesh,geometry=mesh.geometry,mode=mesh.bindMode,position=mesh.position.clone(),quaternion=mesh.quaternion.clone(),scale=mesh.scale.clone(),influences=mesh.morphTargetInfluences,dictionary=mesh.morphTargetDictionary,copy=geometry.clone();
 try{
  mesh.bindMode='detached';mesh.position.add(new Vector3(.031,.024,-.017));mesh.rotation.set(.02,-.03,.01);mesh.scale.set(1.02,.97,1.01);runtime.root.updateMatrixWorld(true);compareSkin(runtime.meleeFit,buffer,label+'/detached');
  const p=geometry.attributes.position,relative=new Float32Array(p.count*3);for(let i=0;i<relative.length;i++)relative[i]=((i%17)-8)*.0001;copy.morphAttributes.position=[new Float32BufferAttribute(relative,3)];copy.morphTargetsRelative=true;mesh.geometry=copy;mesh.updateMorphTargets();
  for(const weight of [.37,.73]){mesh.morphTargetInfluences[0]=weight;runtime.root.updateMatrixWorld(true);compareSkin(runtime.meleeFit,buffer,label+'/detached relative morph '+weight);}
  mesh.bindMode='attached';mesh.position.copy(position);mesh.quaternion.copy(quaternion);mesh.scale.copy(scale);
  for(const weight of [.21,.69]){mesh.morphTargetInfluences[0]=weight;runtime.root.updateMatrixWorld(true);compareSkin(runtime.meleeFit,buffer,label+'/attached relative morph '+weight);}
  const absolute=new Float32Array(p.count*3);for(let i=0;i<p.count;i++)for(let axis=0;axis<3;axis++)absolute[i*3+axis]=p.getComponent(i,axis)+relative[i*3+axis];copy.morphAttributes.position=[new Float32BufferAttribute(absolute,3)];copy.morphTargetsRelative=false;mesh.updateMorphTargets();mesh.morphTargetInfluences[0]=.43;runtime.root.updateMatrixWorld(true);compareSkin(runtime.meleeFit,buffer,label+'/attached absolute morph');
 }finally{mesh.geometry=geometry;mesh.bindMode=mode;mesh.position.copy(position);mesh.quaternion.copy(quaternion);mesh.scale.copy(scale);mesh.morphTargetInfluences=influences;mesh.morphTargetDictionary=dictionary;runtime.root.updateMatrixWorld(true);copy.dispose();}
 compareSkin(runtime.meleeFit,buffer,label+'/restored attached cache');
}

test('scalar solePoint and full boot batch match Three skinning for native/fitted actors, every LOD and deformation fallback',async()=>{
 for(const appearance of ['granadero','woman-scout'])for(const lod of [0,1,2]){
  const f=await pair(appearance,false,'standing',1800,lod),visual=cueVisual(f),runtime=new ActorRuntime(f.asset,visual,undefined,()=>({model:f.body.model,root:f.body.root})),native=new ActorRuntime(f.asset,visual);
  try{
   runtime.tick(0,0);native.tick(0,0);assert.ok(Boolean(runtime.meleeFit.plan),'Coordinate cases use a genuinely admitted rifle fit');const buffer=new Float64Array(runtime.meleeFit.completeBoot.vertices.length*3),nativeBuffer=new Float64Array(native.meleeFit.completeBoot.vertices.length*3);
   for(const time of [0,.1,.189,.42,.5375,.9,1]){runtime.update(visual,time*1000);native.update(visual,time*1000);runtime.tick(0,time*1000);native.tick(0,time*1000);runtime.root.updateMatrixWorld(true);native.root.updateMatrixWorld(true);compareSkin(runtime.meleeFit,buffer,`${appearance}/LOD${lod}/fitted/${time}`);compareSkin(native.meleeFit,nativeBuffer,`${appearance}/LOD${lod}/native/${time}`);}
   checkFallbackSkin(runtime,buffer,`${appearance}/LOD${lod}`);
   const wrong=runtime.meleeFit.completeBootPoints.call({previewFit:runtime.meleeFit},new Float64Array(2));assert.ok(wrong instanceof Float64Array);assert.equal(wrong.length,buffer.length);
   const model=clone(f.asset.body.scene),root=new Group();root.position.set(2.13,.17,-3.61);root.rotation.set(.07,.93,-.05);root.scale.set(1.01,.98,1.02);root.add(model);root.updateMatrixWorld(true);const mixer=new AnimationMixer(model),clip=f.asset.animation.animations.find(c=>c.name==='stand.walk.long-gun'),action=mixer.clipAction(clip).setLoop(LoopOnce,1).play(),fit=new NativeMeleeContactFit(model,root,f.asset.appearance.parts.footwear.replace('{lod}',String(lod)));action.timeScale=0;action.clampWhenFinished=true;const walkBuffer=new Float64Array(fit.completeBoot.vertices.length*3);
   for(const fraction of [0,.1,.189,.42,.5375,.9,1]){action.time=fraction*clip.duration;mixer.update(0);root.updateMatrixWorld(true);compareSkin(fit,walkBuffer,`${appearance}/LOD${lod}/transformed walk/${fraction}`);}mixer.stopAllAction();fit.dispose();
  }finally{runtime.dispose();native.dispose();f.body.dispose();}
 }
});

/** Instrument the actual helper, so extra priority poses cannot stand in for
 * the complete accepted physical admission. Synchronous read-only probes only. */
function instrumentAcceptedRiflePaths(Type){
 const prototype=Type.prototype,originals=new Map(),records=[];let current;
 function patch(name,wrap){const original=prototype[name];assert.equal(typeof original,'function',name);originals.set(name,original);prototype[name]=wrap(original);}
 patch('pathAllowed',original=>function(plan,clip,...args){
  const before=current,record={twoHands:Boolean(plan.twoHands),duration:clip.duration,contact:plan.contact,pair:this.rifleSpeedPair?[...this.rifleSpeedPair]:undefined,body:plan.body.toArray(),step:plan.step.toArray(),rear:plan.rearStep.toArray(),pose:[],floor:[],bodyChecks:[],bootSpeed:[],handReachMaximum:0,footReachMaximum:0,fit:this};current=record;
  try{return record.accepted=original.call(this,plan,clip,...args);}finally{current=before;delete record.fit;records.push(record);}
 });
 patch('pose',original=>function(plan,time){const result=original.call(this,plan,time);if(current&&this===current.fit.previewFit){current.pose.push(time);current.handReachMaximum=Math.max(current.handReachMaximum,this.handReachError);current.footReachMaximum=Math.max(current.footReachMaximum,this.footReachError);}return result;});
 patch('floorAllowed',original=>function(...args){const result=original.apply(this,args);if(current&&this===current.fit)current.floor.push({time:current.pose.at(-1),allowed:result});return result;});
 patch('bodyAllowed',original=>function(...args){const result=original.apply(this,args);if(current&&this===current.fit)current.bodyChecks.push({time:current.pose.at(-1),allowed:result});return result;});
 patch('bootSpeedAllowed',original=>function(points,before,dt){const result=original.call(this,points,before,dt);if(current&&this===current.fit)current.bootSpeed.push({time:current.pose.at(-1),dt,allowed:result});return result;});
 return {records,restore(){for(const [name,original]of originals)prototype[name]=original;},assertAccepted(record){
  assert.equal(record.accepted,true);assert.equal(record.twoHands,true);
  const count=Math.ceil(record.duration*240),chronological=Array.from({length:count+1},(_,i)=>Math.min(record.duration,i/240)),prefix=[record.contact,...(record.pair??[])];
  assert.deepEqual(record.pose,[...prefix,...chronological],'The priority poses precede, and never replace, all chronological240Hz poses');
  assert.deepEqual(record.pose.slice(-chronological.length),chronological,'Every accepted path has the exact complete chronological suffix');
  assert.deepEqual(record.floor.map(v=>v.time),[record.contact,...chronological],'Contact and every chronological pose run the complete swept floor gate');assert.ok(record.floor.every(v=>v.allowed));
  assert.deepEqual(record.bodyChecks.map(v=>v.time),[record.contact,...chronological.filter((_,i)=>i%4===0)],'Contact and every fourth chronological pose retain the conservative body gate');assert.ok(record.bodyChecks.every(v=>v.allowed));
  const chronologicalSpeed=chronological.flatMap((time,i)=>i&&time>chronological[i-1]?[time]:[]),speedPrefix=record.pair?[record.pair[1]]:[];
  assert.deepEqual(record.bootSpeed.map(v=>v.time),[...speedPrefix,...chronologicalSpeed],'Every increasing chronological adjacent pair keeps the full boot point-speed gate');assert.ok(record.bootSpeed.every(v=>v.allowed));
  assert.ok(record.handReachMaximum<1e-7,'The complete accepted native wrist path is still strictly reachable');assert.ok(record.footReachMaximum<.001);
  return {chronologicalSamples:chronological.length,prioritySamples:record.pair?.length??0,contactSamples:1,floorChecks:record.floor.length,bodyChecks:record.bodyChecks.length,bootSpeedChecks:record.bootSpeed.length};
 }};
}


test('a learned rifle speed pair never replaces accepted chronological240Hz gates; occupied guard stays finite native',async()=>{
 const instrument=instrumentAcceptedRiflePaths(NativeMeleeContactFit);
 try{for(const [diagonal,occupied]of [[false,false],[true,false],[false,true]]){
  const f=await pair('granadero',diagonal,'standing',1800,0,{offhand:occupied}),visual=cueVisual(f,occupied),completions=[],resolver=occupied?()=>assert.fail('An occupied left support hand must not read a paired target'):()=>({model:f.body.model,root:f.body.root}),runtime=new ActorRuntime(f.asset,visual,(key,id)=>completions.push({key,id}),resolver),native=new ActorRuntime(f.asset,visual),start=instrument.records.length;
  try{
   runtime.tick(0,0);native.tick(0,0);const records=instrument.records.slice(start),accepted=records.filter(record=>record.accepted);
   if(occupied){assert.ok(!runtime.meleeFit.plan);assert.equal(records.length,0);for(let i=0;i<=240;i++){const now=i/240*1000;runtime.update(visual,now);native.update(visual,now);runtime.tick(0,now);native.tick(0,now);runtime.root.updateMatrixWorld(true);native.root.updateMatrixWorld(true);assert.ok(!runtime.meleeFit.plan);assert.deepEqual(bonePose(runtime.model),bonePose(native.model),'Every unsupported native bone/transform stays exact');}assert.equal(completions.length,1);}
   else{assert.ok(Boolean(runtime.meleeFit.plan));assert.equal(accepted.length,1);const count=instrument.assertAccepted(accepted[0]);assert.equal(count.chronologicalSamples,241);if(diagonal){assert.ok(records.some(record=>!record.accepted&&record.bootSpeed.some(gate=>!gate.allowed)),'This case actually learns a complete-boot speed rejection');assert.equal(count.prioritySamples,2);assert.equal(count.bootSpeedChecks,241);}else{assert.equal(count.prioritySamples,0);assert.equal(count.bootSpeedChecks,240);}}
  }finally{runtime.dispose();native.dispose();f.body.dispose();}
 }}finally{instrument.restore();}
});
