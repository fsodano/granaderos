import {register} from 'node:module';
register('./tactical-render-loader.mjs', import.meta.url);
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {Vector3} from '../web/node_modules/three/build/three.module.js';
import {publishedActor} from './published-actor-fixture.mjs';
import {BATTLE_PLAYBACK} from '../game/battle-playback.js';
const {ActorRuntime} = await import('../web/lib/three/actor-runtime.ts');
const guards = ['stand.idle.unarmed','stand.idle.long-gun','stand.idle.short-gun','stand.idle.blade','stand.idle.knife','stand.idle.lance','stand.aim.long-gun','stand.aim.short-gun','stand.brace.long-gun'];
const items = {unarmed:null,'long-gun':1800,'short-gun':1805,blade:1810,knife:1813,lance:1812};
const leg = /^(thigh|calf|foot|ball)_[lr]$/;
const records = [];
after(() => {if (process.env.GESTURE_CONTACT_METRICS) writeFileSync(process.env.GESTURE_CONTACT_METRICS, JSON.stringify(records,null,2)+'\n');});
const pose = model => {const rows=[];model.traverse(n=>{if(n.isBone) rows.push({n,p:n.position.toArray(),q:n.quaternion.toArray(),s:n.scale.toArray()});});return rows;};
function unchanged(rows) {for(const {n,p,q,s} of rows){assert.deepEqual(n.position.toArray(),p,n.name+' position');assert.deepEqual(n.scale.toArray(),s,n.name+' scale');if(!leg.test(n.name)) assert.deepEqual(n.quaternion.toArray(),q,n.name+' upper rotation');}}
function points(actor, mesh) {actor.root.updateMatrixWorld(true);mesh.skeleton.update();return Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld));}
function visual(anatomy, guard) {const [,idleAction,equipment]=guard.split('.');return {key:'unit:contact',id:'contact',kind:'unit',appearance:anatomy,skin:'light',side:'player',position:[6,.4,-4],yaw:Math.PI/2,tacticalLevel:0,posture:'standing',mounted:false,action:idleAction,idleAction,equipment:['knife','lance'].includes(equipment)?'blade':equipment,items:items[equipment]?[{id:String(items[equipment]),reference:'primary',socket:'handRight'}]:[],garments:{},selected:false,bodyHeights:{}};}

for(const anatomy of ['granadero','woman-scout']) for(const lod of [0,1,2]) for(const guard of guards) test(`${anatomy} LOD${lod} ${guard}: all three paid gestures, both transitions and all three arrivals`, async()=>{
 const asset=await publishedActor(anatomy,lod),v=visual(anatomy,guard),actor=new ActorRuntime(asset,v),mesh=actor.model.getObjectByName('Human_footwear_LOD'+lod),support=actor.gestureSupport,p=mesh.geometry.attributes.position,cut=Math.min(...Array.from({length:p.count},(_,i)=>p.getY(i)))+.003,sole=Array.from({length:p.count},(_,i)=>i).filter(i=>p.getY(i)<cut);
 assert.equal(sole.length,96,'All 48 native sole vertices per foot participate');
 const row={anatomy,lod,guard,transitions:18,min:Infinity,rawMin:Infinity,fullSpeed:0,rawFullSpeed:0,nearFloorSoleSpeed:0,rawNearFloorSoleSpeed:0,plantedToeSpeed:0,toeCorrectionError:0,maximumAdjustment:0,additionalHeelRoll:0,maximumReachError:0,sourceReturnSpeed:0,completed:0};
 let raw, before;const original=support.apply.bind(support);support.apply=(...args)=>{before=pose(actor.model);raw=points(actor,mesh);const clocks=actor.mixer._actions.map(a=>[a.time,a.timeScale,a.getEffectiveWeight()]),time=actor.mixer.time;original(...args);unchanged(before);assert.equal(actor.mixer.time,time);assert.deepEqual(actor.mixer._actions.map(a=>[a.time,a.timeScale,a.getEffectiveWeight()]),clocks);assert.equal(support.rejectedFits,0,'Every admitted native support fit succeeds');};
 actor.onCueComplete=()=>row.completed++;
 try {
  for(let i=0;i<20;i++)actor.tick(1/60,i*1000/60);
  for(const [actionIndex,action] of ['heal','loot','free'].entries()) for(const [delayIndex,delay] of [0,1000/60,2000/60].entries()) {
   const start=2000+(actionIndex*3+delayIndex)*2000,born=start-delay,cue={id:'contact-'+actionIndex+'-'+delayIndex,action,phase:'prepare',startedAt:born,phaseStartedAt:born,phaseDurationMs:BATTLE_PLAYBACK.action,durationMs:BATTLE_PLAYBACK.action*2};
   actor.update({...v,action,cue},start);
   let previous,previousRaw,previousToe,previousEntry=false,previousActive=false,result=false;
   for(let frame=0;frame<52;frame++) {
    const now=start+frame*1000/60;
    if(!result&&now>=born+BATTLE_PLAYBACK.action){actor.update({...v,action,cue:{...cue,phase:'result',phaseStartedAt:born+BATTLE_PLAYBACK.action}},now);result=true;}
    actor.tick(frame?1/60:0,now);
    const full=points(actor,mesh),toes=support.capture().map(g=>g.toe),entry=Boolean(support.plan?.entry),active=Boolean(support.plan);
    row.min=Math.min(row.min,...full.map(v=>v.y-.4));row.rawMin=Math.min(row.rawMin,...raw.map(v=>v.y-.4));
    row.maximumAdjustment=Math.max(row.maximumAdjustment,support.maximumAdjustment);row.additionalHeelRoll=Math.max(row.additionalHeelRoll,support.maximumHeelRoll);row.maximumReachError=Math.max(row.maximumReachError,support.maximumReachError);row.toeCorrectionError=Math.max(row.toeCorrectionError,support.maximumContactError);
    if(previous) for(let i=0;i<full.length;i++){row.fullSpeed=Math.max(row.fullSpeed,full[i].distanceTo(previous[i])*60);row.rawFullSpeed=Math.max(row.rawFullSpeed,raw[i].distanceTo(previousRaw[i])*60);if(previousActive&&!active)row.sourceReturnSpeed=Math.max(row.sourceReturnSpeed,full[i].distanceTo(previous[i])*60);}
    if(previous)for(const i of sole){if(full[i].y-.4<.003&&previous[i].y-.4<.003)row.nearFloorSoleSpeed=Math.max(row.nearFloorSoleSpeed,Math.hypot(full[i].x-previous[i].x,full[i].z-previous[i].z)*60);if(raw[i].y-.4<.003&&previousRaw[i].y-.4<.003)row.rawNearFloorSoleSpeed=Math.max(row.rawNearFloorSoleSpeed,Math.hypot(raw[i].x-previousRaw[i].x,raw[i].z-previousRaw[i].z)*60);}
    if(previousToe&&entry&&previousEntry)for(let i=0;i<2;i++)row.plantedToeSpeed=Math.max(row.plantedToeSpeed,Math.hypot(toes[i].x-previousToe[i].x,toes[i].z-previousToe[i].z)*60);
    for(const side of ['l','r']){const bones=['thigh','calf','foot'].map(name=>actor.model.getObjectByName(name+'_'+side).getWorldPosition(new Vector3())),definition=support.legs.find(l=>l.foot.name.endsWith(side));assert.ok(Math.abs(bones[0].distanceTo(bones[1])-definition.first)<1e-6);assert.ok(Math.abs(bones[1].distanceTo(bones[2])-definition.second)<1e-6);}
    assert.deepEqual(actor.root.position.toArray(),v.position);assert.equal(actor.root.rotation.y,v.yaw);
    previous=full;previousRaw=raw;previousToe=toes;previousEntry=entry;previousActive=active;
   }
   assert.equal(actor.clipSpec.name,guard);assert.equal(support.processedVertices,0,'Source rest performs no weighted scan');assert.equal(support.plan,undefined);
  }
  assert.equal(row.completed,9);assert.ok(row.min>.0018,'All complete weighted boots retain the floor '+row.min);assert.ok(row.maximumAdjustment<.13,'Native leg-only stance adaptation stays bounded '+row.maximumAdjustment);assert.ok(row.additionalHeelRoll<.06,'Only measured small reach roll is needed '+row.additionalHeelRoll);assert.ok(row.toeCorrectionError<.000002,'Actual weighted forefoot is fitted '+row.toeCorrectionError);assert.ok(row.plantedToeSpeed<.0001,'Forefoot contact stays planted throughout the paid gesture '+row.plantedToeSpeed);assert.ok(row.nearFloorSoleSpeed<.06,'Near-ground outline moves only for heel roll and exact source return '+row.nearFloorSoleSpeed);assert.ok(row.fullSpeed<row.rawFullSpeed*1.5,'No added full weighted boot speed snap '+row.fullSpeed+' / '+row.rawFullSpeed);records.push(row);
 } finally {actor.dispose();}
});

for(const anatomy of ['granadero','woman-scout']) for(const lod of [0,1,2]) for(const fps of [30,120,240])for(const timing of ['compressed','ordinary']) test(`${anatomy} LOD${lod} ${fps} Hz ${timing}: all guard handoffs and late frames stay continuous`,async()=>{
 const asset=await publishedActor(anatomy,lod),row={kind:'fine-frame-continuity',anatomy,lod,fps,timing,min:Infinity,speed:0,rawSpeed:0,plantedToeSpeed:0,returnCorrectionSpeed:0,returnWorldSpeed:0,rawReturnWorldSpeed:0};
 for(const guard of [...guards,'left-pistol-aim']){const base=visual(anatomy,guard==='left-pistol-aim'?'stand.aim.short-gun':guard),v=guard==='left-pistol-aim'?{...base,items:base.items.map(item=>({...item,socket:'handLeft'})),cue:{id:'fine-left-aim',action:'aim',hand:'handLeft',startedAt:0}}:base,actor=new ActorRuntime(asset,v),mesh=actor.model.getObjectByName('Human_footwear_LOD'+lod),h=actor.gestureSupport;let raw;const apply=h.apply.bind(h);h.apply=(...args)=>{raw=points(actor,mesh);const native=pose(actor.model);apply(...args);unchanged(native);assert.equal(h.rejectedFits,0);};
  try{for(let i=0;i<Math.ceil(.75*fps);i++)actor.tick(1/fps,i*1000/fps);const start=2000,born=start-2000/60,action=timing==='compressed'?'heal':'loot',cue={id:'fine',action,startedAt:born,...(timing==='compressed'?{phase:'prepare',phaseStartedAt:born,phaseDurationMs:300,durationMs:600}:{})};actor.update({...v,action,cue},start);let result=false,previous,previousRaw,previousToe,previousEntry=false,previousActive=false;
   for(let i=0;i<=Math.ceil((timing==='compressed'?.85:1.65)*fps);i++){const now=start+i*1000/fps;if(timing==='compressed'&&!result&&now>=born+300){actor.update({...v,action,cue:{...cue,phase:'result',phaseStartedAt:born+300}},now);result=true;}actor.tick(i?1/fps:0,now,true);const full=points(actor,mesh),toe=h.capture().map(g=>g.toe),entry=Boolean(h.plan?.entry),active=Boolean(h.plan);row.min=Math.min(row.min,...full.map(v=>v.y-.4));
    if(previous)for(let j=0;j<full.length;j++){row.speed=Math.max(row.speed,full[j].distanceTo(previous[j])*fps);row.rawSpeed=Math.max(row.rawSpeed,raw[j].distanceTo(previousRaw[j])*fps);if(previousActive&&!active){row.returnCorrectionSpeed=Math.max(row.returnCorrectionSpeed,full[j].clone().sub(raw[j]).distanceTo(previous[j].clone().sub(previousRaw[j]))*fps);row.returnWorldSpeed=Math.max(row.returnWorldSpeed,full[j].distanceTo(previous[j])*fps);row.rawReturnWorldSpeed=Math.max(row.rawReturnWorldSpeed,raw[j].distanceTo(previousRaw[j])*fps);}}
    if(previousToe&&entry&&previousEntry)for(let j=0;j<2;j++)row.plantedToeSpeed=Math.max(row.plantedToeSpeed,Math.hypot(toe[j].x-previousToe[j].x,toe[j].z-previousToe[j].z)*fps);previous=full;previousRaw=raw;previousToe=toe;previousEntry=entry;previousActive=active;
   }
   assert.equal(actor.clipSpec.name,guard==='left-pistol-aim'?'stand.aim.short-gun':guard);assert.equal(h.processedVertices,0);if(guard.startsWith('stand.idle.'))assert.equal(actor.action.time,0,'Reduced motion keeps the source idle clock');
  }finally{actor.dispose();}}
 records.push(row);assert.ok(row.min>.0018,'Complete boot floor '+row.min);assert.ok(row.speed<row.rawSpeed*(timing==='compressed'?1.6:2.6),'Bound full weighted surface speed against unchanged paid source '+row.speed+' / '+row.rawSpeed);assert.ok(row.returnWorldSpeed<row.rawSpeed*(timing==='compressed'?.2:.5),'Actual whole-boot handoff remains bounded by the retained source '+row.returnWorldSpeed);assert.ok(row.returnCorrectionSpeed<row.rawSpeed*(timing==='compressed'?.4:.75),'Record the difference from the retained fast raw blend '+row.returnCorrectionSpeed);assert.ok(row.plantedToeSpeed<.0004,'Contact has only float matrix residual '+row.plantedToeSpeed);
});

test('held contact is deterministic; finite failures, changed saved placement and interruption restore native bones',async()=>{
 const asset=await publishedActor('granadero',1),v=visual('granadero','stand.idle.long-gun'),actor=new ActorRuntime(asset,v),h=actor.gestureSupport;
 try{actor.tick(.1,100);actor.update({...v,action:'heal',cue:{id:'fallback',action:'heal',phase:'prepare',startedAt:100,phaseStartedAt:100,phaseDurationMs:300,durationMs:600}},100);actor.tick(.05,150);assert.ok(h.plan?.entry);const frame=pose(actor.model).map(r=>r.q);
  for(let i=0;i<16;i++){actor.tick(0,150);assert.deepEqual(pose(actor.model).map(r=>r.q),frame,'Held source time gives the same full leg pose');}
  for(const bad of [NaN,Infinity,-1]){actor.tick(0,150);const previous=actor.clipSpec,next=asset.clips.find(c=>c.name==='stand.idle.long-gun'),clip=asset.animation.animations.find(c=>c.name===next.name);h.restore();h.begin(previous,next,actor.mixer.time,clip);const native=pose(actor.model);h.apply(bad,0);for(const r of native)assert.deepEqual(r.n.quaternion.toArray(),r.q);assert.equal(h.processedVertices,0);assert.equal(h.plan,undefined);}
  actor.update(v,180);actor.tick(.1,190);actor.tick(.1,195);
  actor.update({...v,action:'heal',cue:{id:'placement',action:'heal',phase:'prepare',startedAt:200,phaseStartedAt:200,phaseDurationMs:300,durationMs:600}},200);actor.tick(.03,230);h.restore();const native=pose(actor.model);actor.root.position.x+=1;h.apply(actor.mixer.time,actor.action.time);assert.equal(h.rejectedFits,1);assert.equal(h.processedVertices,0);for(const r of native)assert.deepEqual(r.n.quaternion.toArray(),r.q);assert.equal(actor.root.position.x,7,'Never cancel an authored world-cell change to keep contact');actor.root.position.copy(new Vector3(...v.position));
  actor.update({...v,action:'door',cue:{id:'door',action:'door',startedAt:230,durationMs:500}},230);const apply=h.apply.bind(h);h.apply=(...args)=>{const rows=pose(actor.model);apply(...args);for(const r of rows)assert.deepEqual(r.n.quaternion.toArray(),r.q);assert.equal(h.processedVertices,0);};for(let i=0;i<12;i++)actor.tick(1/60,230+i*1000/60);
  assert.ok(pose(actor.model).every(r=>[...r.p,...r.q,...r.s].every(Number.isFinite)));
 }finally{actor.dispose();}
});

for(const anatomy of ['granadero','woman-scout'])for(const lod of [0,1,2])test(`${anatomy} LOD${lod}: full boot return converges to the native endpoint without a finite pose jump`,async()=>{
 const asset=await publishedActor(anatomy,lod),samples=[];
 for(const epsilon of [.004,.002,.001,.0005,.00025,.000125,.0000625]){const v=visual(anatomy,'stand.idle.long-gun'),actor=new ActorRuntime(asset,v),mesh=actor.model.getObjectByName('Human_footwear_LOD'+lod),h=actor.gestureSupport;
  try{actor.tick(.1,0,true);actor.tick(.1,100,true);actor.tick(.1,200,true);const cue={id:'convergence',action:'heal',phase:'prepare',startedAt:1000,phaseStartedAt:1000,phaseDurationMs:300,durationMs:600};actor.update({...v,action:'heal',cue},1000);for(let i=0;i<3;i++)actor.tick(.1,1000+i*100,true);actor.update({...v,action:'heal',cue:{...cue,phase:'result',phaseStartedAt:1300}},1300);for(let i=0;i<=3;i++)actor.tick(i?.1:0,1300+i*100,true);assert.ok(h.plan&&!h.plan.entry);
   actor.tick(.06,1660,true);actor.tick(.06-epsilon,1720-epsilon*1000,true);const near=points(actor,mesh);assert.equal(h.rejectedFits,0);actor.tick(epsilon+1e-7,1720.0001,true);const endpoint=points(actor,mesh);assert.equal(h.plan,undefined);samples.push({epsilon,delta:Math.max(...near.map((p,i)=>p.distanceTo(endpoint[i])))});
  }finally{actor.dispose();}}
 for(let i=1;i<samples.length;i++)assert.ok(samples[i].delta<samples[i-1].delta*.6,'The endpoint residual shrinks as the real interval shrinks '+JSON.stringify(samples));assert.ok(samples.at(-1).delta<.00005,'At 0.0625 ms all weighted boot points approach source within 0.05 mm '+samples.at(-1).delta);records.push({kind:'endpoint-convergence',anatomy,lod,samples});
});

for(const anatomy of ['granadero','woman-scout'])for(const lod of [0,1,2])test(`${anatomy} LOD${lod}: an immediate first paid cue uses the actual incoming equipment pose`,async()=>{
 const asset=await publishedActor(anatomy,lod),v=visual(anatomy,'stand.idle.long-gun'),actor=new ActorRuntime(asset,v),mesh=actor.model.getObjectByName('Human_footwear_LOD'+lod),h=actor.gestureSupport;
 try{actor.update({...v,action:'heal',cue:{id:'cold',action:'heal',phase:'prepare',startedAt:0,phaseStartedAt:0,phaseDurationMs:300,durationMs:600}},0);for(let i=0;i<10;i++){actor.tick(i?1/60:0,i*1000/60);assert.equal(h.rejectedFits,0);assert.ok(Math.min(...points(actor,mesh).map(p=>p.y-.4))>.0018);}assert.ok(h.plan?.entry);assert.ok(h.maximumAdjustment<h.contactAdjustmentLimit);
 }finally{actor.dispose();}
});

// Ordinary paid ground collection and self release have no phase or duration
// override. They retain the full native 1.4 s gesture, unlike medical playback.
for(const anatomy of ['granadero','woman-scout'])for(const lod of [0,1,2])test(`${anatomy} LOD${lod}: ordinary unphased loot and free retain native clocks and planted contact`,async()=>{
 const asset=await publishedActor(anatomy,lod),row={kind:'ordinary-native-timing',anatomy,lod,transitions:108,min:Infinity,rawMin:Infinity,speed:0,rawSpeed:0,plantedToeSpeed:0,maximumAdjustment:0,heelRoll:0,completed:0};
 for(const guard of guards){const v=visual(anatomy,guard),actor=new ActorRuntime(asset,v),mesh=actor.model.getObjectByName('Human_footwear_LOD'+lod),h=actor.gestureSupport;let raw;const apply=h.apply.bind(h);h.apply=(...args)=>{raw=points(actor,mesh);const native=pose(actor.model),time=actor.mixer.time,clocks=actor.mixer._actions.map(a=>[a.time,a.timeScale,a.getEffectiveWeight()]);apply(...args);unchanged(native);assert.equal(actor.mixer.time,time);assert.deepEqual(actor.mixer._actions.map(a=>[a.time,a.timeScale,a.getEffectiveWeight()]),clocks);assert.equal(h.rejectedFits,0);};actor.onCueComplete=()=>row.completed++;
  try{for(let i=0;i<20;i++)actor.tick(1/60,i*1000/60);
   for(const [actionIndex,action]of ['loot','free'].entries())for(const [delayIndex,delay]of [0,1000/60,2000/60].entries()){
    const start=2000+(actionIndex*3+delayIndex)*2200,born=start-delay,cue={id:'ordinary-'+actionIndex+'-'+delayIndex,action,startedAt:born};actor.update({...v,action,cue},start);let previous,previousRaw,previousToe,previousEntry=false;
    for(let frame=0;frame<102;frame++){const now=start+frame*1000/60;actor.tick(frame?1/60:0,now);const full=points(actor,mesh),foot=h.capture(),toe=foot.map(g=>g.toe),entry=Boolean(h.plan?.entry);row.min=Math.min(row.min,...full.map(v=>v.y-.4));row.rawMin=Math.min(row.rawMin,...raw.map(v=>v.y-.4));row.maximumAdjustment=Math.max(row.maximumAdjustment,h.maximumAdjustment);row.heelRoll=Math.max(row.heelRoll,h.maximumHeelRoll);
     if(actor.clipSpec.name.startsWith('stand.gesture.')){assert.ok(Math.abs(actor.action.time-Math.min(1.4,(now-born)/1000))<1e-6,'Unphased paid cues retain the native clock');assert.equal(actor.action.timeScale,0);}
     if(previous)for(let i=0;i<full.length;i++){row.speed=Math.max(row.speed,full[i].distanceTo(previous[i])*60);row.rawSpeed=Math.max(row.rawSpeed,raw[i].distanceTo(previousRaw[i])*60);}
     if(previousToe&&entry&&previousEntry)for(let i=0;i<2;i++)row.plantedToeSpeed=Math.max(row.plantedToeSpeed,Math.hypot(toe[i].x-previousToe[i].x,toe[i].z-previousToe[i].z)*60);assert.deepEqual(actor.root.position.toArray(),v.position);assert.equal(actor.root.rotation.y,v.yaw);previous=full;previousRaw=raw;previousToe=toe;previousEntry=entry;
    }
    assert.equal(actor.clipSpec.name,guard);assert.equal(h.plan,undefined);assert.equal(h.processedVertices,0);
   }
  }finally{actor.dispose();}}
 assert.equal(row.completed,54);assert.ok(row.min>.0018,'Full native-time weighted boots retain the floor '+row.min);assert.ok(row.plantedToeSpeed<.0001,'Native-duration reach remains planted '+row.plantedToeSpeed);assert.ok(row.maximumAdjustment<.13);assert.ok(row.heelRoll<.06);assert.ok(row.speed<row.rawSpeed*2.2,'Bound complete weighted boot speed '+row.speed+' / '+row.rawSpeed);records.push(row);
});

for(const anatomy of ['granadero','woman-scout'])for(const lod of [0,1,2])test(`${anatomy} LOD${lod}: real left-hand pistol aim enters normal paid gestures at all three arrivals`,async()=>{
 const asset=await publishedActor(anatomy,lod),base=visual(anatomy,'stand.aim.short-gun'),v={...base,items:base.items.map(item=>({...item,socket:'handLeft'})),cue:{id:'left-aim',action:'aim',hand:'handLeft',startedAt:0}},actor=new ActorRuntime(asset,v),mesh=actor.model.getObjectByName('Human_footwear_LOD'+lod),h=actor.gestureSupport,row={kind:'mirrored-pistol-entry',anatomy,lod,min:Infinity,maximumAdjustment:0,heelRoll:0,contactError:0,plantedToeSpeed:0,nearFloorSoleSpeed:0,entryNearFloorSoleSpeed:0,returnNearFloorSoleSpeed:0,returnKinematicBound:0,speed:0,rawSpeed:0,completed:0,transitions:18};actor.onCueComplete=()=>row.completed++;const radii=h.legs.map(leg=>{const pos=mesh.geometry.attributes.position,index=mesh.skeleton.bones.findIndex(bone=>bone===leg.foot),inverse=mesh.skeleton.boneInverses[index],left=leg.foot.name.endsWith('_l');return Math.max(...Array.from({length:pos.count},(_,i)=>i).filter(i=>(pos.getX(i)>0)===left&&pos.getY(i)<.010).map(i=>new Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.bindMatrix).applyMatrix4(inverse).distanceTo(leg.toe)));});assert.ok(radii.every(radius=>radius>0&&radius<.32),'Bound uses actual complete native sole levers');let raw;const apply=h.apply.bind(h);h.apply=(...args)=>{raw=points(actor,mesh);const native=pose(actor.model);apply(...args);unchanged(native);};
 try{for(const [actionIndex,action]of ['heal','loot','free'].entries())for(const [delayIndex,delay]of [0,1000/60,2000/60].entries()){
  const sequence=actionIndex*3+delayIndex,guardAt=sequence*2500;actor.update({...v,cue:{...v.cue,id:'left-aim-'+sequence,startedAt:guardAt}},guardAt);for(let i=0;i<12;i++)actor.tick(1/60,guardAt+i*1000/60);assert.equal(actor.actionHand,'handLeft');
  const start=guardAt+500,born=start-delay,compressed=action==='heal',cue={id:'left-gesture-'+sequence,action,startedAt:born,...(compressed?{phase:'prepare',phaseStartedAt:born,phaseDurationMs:300,durationMs:600}:{})};actor.update({...v,action,cue},start);let result=false,previous,previousRaw,previousToe,previousFoot,previousEntry=false;
  for(let i=0;i<(compressed?54:102);i++){const now=start+i*1000/60;if(compressed&&!result&&now>=born+300){actor.update({...v,action,cue:{...cue,phase:'result',phaseStartedAt:born+300}},now);result=true;}actor.tick(i?1/60:0,now);assert.equal(h.rejectedFits,0);const full=points(actor,mesh),foot=h.capture(),toe=foot.map(g=>g.toe),entry=Boolean(h.plan?.entry);row.min=Math.min(row.min,...full.map(p=>p.y-.4));row.maximumAdjustment=Math.max(row.maximumAdjustment,h.maximumAdjustment);row.heelRoll=Math.max(row.heelRoll,h.maximumHeelRoll);row.contactError=Math.max(row.contactError,h.maximumContactError);
   if(previous)for(let j=0;j<full.length;j++){row.speed=Math.max(row.speed,full[j].distanceTo(previous[j])*60);row.rawSpeed=Math.max(row.rawSpeed,raw[j].distanceTo(previousRaw[j])*60);if(mesh.geometry.attributes.position.getY(j)<.010&&full[j].y-.4<.003&&previous[j].y-.4<.003){const speed=Math.hypot(full[j].x-previous[j].x,full[j].z-previous[j].z)*60;row.nearFloorSoleSpeed=Math.max(row.nearFloorSoleSpeed,speed);if(entry&&previousEntry)row.entryNearFloorSoleSpeed=Math.max(row.entryNearFloorSoleSpeed,speed);else row.returnNearFloorSoleSpeed=Math.max(row.returnNearFloorSoleSpeed,speed);}}if(previousToe&&previousEntry&&entry)for(let j=0;j<2;j++)row.plantedToeSpeed=Math.max(row.plantedToeSpeed,Math.hypot(toe[j].x-previousToe[j].x,toe[j].z-previousToe[j].z)*60);if(previousFoot&&!entry)for(let side=0;side<2;side++){const linear=toe[side].distanceTo(previousFoot[side].toe),angular=2*radii[side]*Math.sin(foot[side].q.angleTo(previousFoot[side].q)/2);row.returnKinematicBound=Math.max(row.returnKinematicBound,(linear+angular)*60+.00025);}assert.deepEqual(actor.root.position.toArray(),v.position);assert.equal(actor.root.rotation.y,v.yaw);previous=full;previousRaw=raw;previousToe=toe;previousFoot=foot;previousEntry=entry;
  }
  assert.equal(actor.clipSpec.name,'stand.aim.short-gun');assert.equal(h.plan,undefined);assert.equal(h.processedVertices,0);
 }records.push(row);assert.equal(row.completed,9);assert.ok(row.min>.0018,'Actual mirrored incoming full boots remain supported '+row.min);assert.ok(row.maximumAdjustment<.13);assert.ok(row.heelRoll<.07);assert.ok(row.contactError<.000002);assert.ok(row.plantedToeSpeed<.0001);assert.ok(row.entryNearFloorSoleSpeed<.035,'Actual gesture contact remains planted '+row.entryNearFloorSoleSpeed);assert.ok(row.returnNearFloorSoleSpeed<=row.returnKinematicBound+.001,'Return surface follows the real toe translation and native rotational lever, with no extra vertex jump');assert.ok(row.speed<row.rawSpeed*1.6,'Complete boot speed is bounded against the unchanged paid source '+row.speed+' / '+row.rawSpeed); // The measured2.99m/s mirrored return remains a failed low-slip polish requirement.
 }finally{actor.dispose();}
});
