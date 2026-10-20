import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {AnimationMixer,LoopOnce,Object3D,Quaternion,Vector3} from '../web/node_modules/three/build/three.module.js';
import {clone} from '../web/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import {publishedActor} from './published-actor-fixture.mjs';
const {idleBreathingClip,idleBreathingTiming}=await import('../web/lib/three/idle-breathing.ts');
const {readableHumanClip}=await import('../web/lib/three/readable-human-stance.ts');
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const world=(model,name)=>model.getObjectByName(name).getWorldPosition(new Vector3());
const orientation=(model,name)=>model.getObjectByName(name).getWorldQuaternion(new Quaternion()).normalize();
const digest=clip=>createHash('sha256').update(JSON.stringify(clip.toJSON())).digest('hex');
function player(asset,clip){const model=clone(asset.body.scene),mixer=new AnimationMixer(model),action=mixer.clipAction(clip).setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();action.timeScale=0;return {model,sample(fraction){action.enabled=true;action.paused=false;action.time=clip.duration*fraction;mixer.update(0);model.updateMatrixWorld(true);},dispose(){mixer.stopAllAction();mixer.uncacheRoot(model);}};}
function clips(asset,source){const rest=readableHumanClip(source,asset.body.scene,asset.manifest.bones,source.name),breathing=idleBreathingClip(rest,asset.body.scene,asset.manifest.bones,source.name);return {rest,breathing};}
const range=values=>Math.max(...values)-Math.min(...values);
for(const appearance of ['granadero','woman-scout'])test(`${appearance} standing rest breathes through the chest and shoulders with a restrained head`,async()=>{
 const asset=await publishedActor(appearance,2);
 for(const source of asset.animation.animations.filter(clip=>clip.name.startsWith('stand.idle.'))){
  const hash=digest(source),{rest,breathing}=clips(asset,source);assert.notEqual(breathing,rest,source.name);assert.equal(idleBreathingClip(rest,asset.body.scene,asset.manifest.bones,source.name),breathing);
  const before=player(asset,rest),after=player(asset,breathing),chest=[],shoulder=[],head=[],headTurns=[];
  // Include interpolated poses between the 60 Hz bake keys.
  try{for(let i=0;i<=240;i++){
   const fraction=i/240;before.sample(fraction);after.sample(fraction);
   const old=before.model,current=after.model;chest.push(world(current,'spine_03').y);shoulder.push(world(current,'upperarm_l').y);head.push(world(current,'head').y);
   if(i===0)headTurns.push(orientation(current,'head'));else headTurns.push(headTurns[0].angleTo(orientation(current,'head')));
   for(const bone of ['Root','pelvis','thigh_l','calf_l','foot_l','thigh_r','calf_r','foot_r']){
    assert.ok(world(old,bone).distanceTo(world(current,bone))<1e-7,source.name+' planted lower body: '+bone);
    assert.ok(orientation(old,bone).angleTo(orientation(current,bone))<1e-6);
   }
   for(const side of ['l','r'])for(const [a,b]of [['upperarm','lowerarm'],['lowerarm','hand']])assert.ok(Math.abs(world(old,a+'_'+side).distanceTo(world(old,b+'_'+side))-world(current,a+'_'+side).distanceTo(world(current,b+'_'+side)))<1e-6,'arm lengths stay unchanged');
   if(!source.name.endsWith('.unarmed'))for(const side of ['l','r']){
    assert.ok(world(old,'hand_'+side).distanceTo(world(current,'hand_'+side))<.00015,source.name+' held hand contact');
    assert.ok(orientation(old,'hand_'+side).angleTo(orientation(current,'hand_'+side))<.0005,source.name+' held hand orientation');
   }
  }
  assert.ok(range(chest)>.003&&range(chest)<.010,source.name+' chest rise');assert.ok(range(shoulder)>.005&&range(shoulder)<.015,source.name+' shoulder rise');
  assert.ok(range(head)<range(shoulder),source.name+' head is not the main movement');assert.ok(Math.max(...headTurns.slice(1))<.025,source.name+' gaze stays steady');
  const names=['spine_03','head','upperarm_l','hand_l'];before.sample(0);after.sample(0);const start=names.map(n=>[world(after.model,n),orientation(after.model,n),world(before.model,n),orientation(before.model,n)]);before.sample(1);after.sample(1);
  // The lance has a small authored wrap in its retained body/hand tracks.
  // Breathing closes its own loop without increasing that existing seam.
  for(const [i,n]of names.entries()){assert.ok(start[i][0].distanceTo(world(after.model,n))<start[i][2].distanceTo(world(before.model,n))+.0001,n+' loop position');assert.ok(start[i][1].angleTo(orientation(after.model,n))<start[i][3].angleTo(orientation(before.model,n))+.0005,n+' loop orientation');}
  assert.equal(digest(source),hash,'the published animation is unchanged');
  }finally{before.dispose();after.dispose();}
 }
});

test('per-actor breathing phases and pace are stable and spread a group across the cycle',()=>{
 const keys=Array.from({length:12},(_,i)=>'unit:'+i),values=keys.map(idleBreathingTiming);
 assert.deepEqual(keys.map(idleBreathingTiming),values);assert.equal(new Set(values.map(v=>v.phase)).size,12);
 assert.ok(range(values.map(v=>v.phase))>.8);assert.ok(new Set(values.map(v=>Math.floor(v.phase*4))).size===4);
 for(const value of values){assert.ok(value.phase>=0&&value.phase<1);assert.ok(value.period>=4.2&&value.period<=5);}
});

test('non-idle, mounted, low stance, injury and replacement-rig clips are unchanged',async()=>{
 const asset=await publishedActor('granadero',2);let count=0;
 for(const clip of asset.animation.animations.filter(clip=>!clip.name.startsWith('stand.idle.'))){assert.equal(idleBreathingClip(clip,asset.body.scene,asset.manifest.bones,clip.name),clip,clip.name);count++;}
 assert.ok(count>100);const idle=asset.animation.animations.find(clip=>clip.name==='stand.idle.unarmed');assert.equal(idleBreathingClip(idle,new Object3D(),{},idle.name),idle);
});

const visual=(key,change={})=>({key,id:key,kind:'unit',appearance:'granadero',skin:'light',side:'player',position:[0,0,0],yaw:0,tacticalLevel:0,posture:'standing',mounted:false,action:'idle',idleAction:'idle',equipment:'long-gun',items:[{id:'1800',reference:'primary',socket:'handRight'}],garments:{},selected:false,bodyHeights:{},...change});
test('actual identical actors start at different phases and retain identity through LOD recreation and updates',async()=>{
 const asset=await publishedActor('granadero',2),aVisual=visual('unit:1'),bVisual=visual('unit:2'),before=JSON.stringify([aVisual,bVisual]),a=new ActorRuntime(asset,aVisual),b=new ActorRuntime(asset,bVisual),recreated=new ActorRuntime(await publishedActor('granadero',1),aVisual);
 try{
  for(const actor of [a,b,recreated])actor.tick(0,0);assert.notEqual(a.action.time,b.action.time);assert.equal(a.action.time,recreated.action.time);
  a.root.updateMatrixWorld(true);b.root.updateMatrixWorld(true);assert.ok(world(a.model,'spine_03').distanceTo(world(b.model,'spine_03'))>.001,'the visible chest poses differ');
  for(let i=1;i<=20;i++){a.tick(.05,i*50);recreated.tick(.05,i*50);}assert.equal(a.action.time,recreated.action.time);
  const time=a.action.time;a.update({...aVisual,selected:true},1000);assert.equal(a.action.time,time,'selection does not restart a breath');
  a.tick(0,1000);const snapshot=world(a.model,'head');for(let i=0;i<10;i++)a.tick(0,1000);assert.ok(snapshot.distanceTo(world(a.model,'head'))<1e-8,'no frame jitter or accumulated offset');
  a.tick(.1,1100,true);assert.equal(a.action.time,0);const still=world(a.model,'spine_03');a.tick(.1,1200,true);assert.ok(still.distanceTo(world(a.model,'spine_03'))<1e-8,'reduced motion stays still');
  assert.equal(JSON.stringify([aVisual,bVisual]),before,'presentation does not change the game records');
 }finally{a.dispose();b.dispose();recreated.dispose();}
});

test('leaving breathing retains paid action timing and returning uses the same cached idle pose',async()=>{
 const asset=await publishedActor('granadero',2),v=visual('unit:transition'),actor=new ActorRuntime(asset,v);const idle=actor.action.getClip();
 try{
  actor.update({...v,action:'fire',cue:{id:'shot',action:'fire',startedAt:1000,durationMs:1000}},1000);actor.tick(0,1500);
  assert.equal(actor.action.getClip(),asset.animation.animations.find(clip=>clip.name==='stand.fire.long-gun'));assert.equal(actor.action.time,actor.action.getClip().duration*.5);
  actor.update(v,1700);for(let i=0;i<12;i++)actor.tick(1/60,1700+i*1000/60);assert.equal(actor.action.getClip(),idle);
  actor.update({...v,mounted:true},2000);assert.equal(actor.action.getClip(),readableHumanClip(asset.animation.animations.find(clip=>clip.name==='mounted.idle.long-gun'),asset.body.scene,asset.manifest.bones,'mounted.idle.long-gun'));
 }finally{actor.dispose();}
});
