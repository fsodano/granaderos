import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRendererSandboxBattle} from '../web/app/renderer-sandbox/fixtures.js';
import {actBattle,presentedActBattle} from '../game/tactical.js';
import {battleFrameDuration} from '../game/battle-playback.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
import {publishedActor} from './published-actor-fixture.mjs';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {admittedThrownRelease}=await import('../web/lib/three/action-timing.ts');
const {sampleAnimationTime:sample}=await import('../web/lib/three/animation-clock.ts');
const {presentActors}=await import('../web/lib/three/presentation.ts');
const {presentedFrameDuration}=await import('../web/lib/useEnemyPlayback.ts');
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:TacticalThreeScene}=await import('../web/app/TacticalThreeScene.tsx');
const manifest=JSON.parse(readFileSync(new URL('../web/public/models/characters/manifest.json',import.meta.url),'utf8'));
const nearly=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
const orders=[{type:'throwGrenade',unitId:'grenade',x:9,y:13},{type:'throwKnife',unitId:'knife',targetId:'target-knife',aim:0}];
for(const order of orders)test(`${order.type} recorded flight follows one release and retains the rules result`,()=>{
 const state=createRendererSandboxBattle('combat'),before=structuredClone(state),recorded=presentedActBattle(state,order),original=structuredClone(recorded.frames),frames=admittedThrownRelease(recorded.frames);
 assert.equal(recorded.state.lastError,null);assert.deepEqual(recorded.state,actBattle(before,order));assert.deepEqual(state,before);assert.deepEqual(recorded.frames,original);
 assert.deepEqual(frames.map(frame=>frame.type),['prepare','effect','result']);assert.deepEqual(frames.map(frame=>frame.releaseComplete),[undefined,undefined,true]);
 const clip=manifest.animationLibraries[order.type==='throwGrenade'?'female':'male'].clips.find(clip=>clip.name===`stand.gesture.${order.type==='throwGrenade'?'throw':'throwKnife'}`),delays=frames.map(frame=>presentedFrameDuration(frame,state));
 nearly(delays[0],clip.markers.release*1000);assert.ok(delays[1]>=(clip.duration-clip.markers.release)*1000);assert.equal(delays[2],battleFrameDuration(frames[2]));
 let startedAt=0,previousTime=0;
 for(const [index,frame]of frames.entries()){
  const actor=frame.state.units.find(actor=>actor.id===order.unitId),key=`unit:${actor.id}`,shown={...frame,sequenceId:'paid-throw',actionId:1,index,startedAt,durationMs:delays[index]},visual=presentActors(frame.state,[{kind:'unit',key,actor}],{},new Set(),{frame:shown,cues:{[key]:{id:'old',action:order.type,startedAt:0}},now:startedAt})[0];
  if(index<2){
   assert.equal(visual.action,order.type);assert.equal(visual.cue.phase,frame.type);
   const begin=sample({clip,action:visual.action,cue:visual.cue,now:startedAt}),end=sample({clip,action:visual.action,cue:visual.cue,now:startedAt+delays[index]});
   nearly(begin.time,previousTime);nearly(end.time,index===0?clip.markers.release:clip.duration);previousTime=end.time;
   if(index===0)assert.equal(end.complete,false);else assert.equal(end.complete,true);
  }else{
   assert.equal(visual.cue,undefined,'The result cannot restart a completed throw, including an old accepted cue');
   assert.ok(frames[index].impacts.length>0,'The actual damage result remains in the last frame');
   const impact=frames[index].impacts.find(impact=>impact.damage>0&&!impact.fatal),victim=frame.state.units.find(actor=>actor.id===impact.unitId),target=presentActors(frame.state,[{kind:'unit',key:`unit:${victim.id}`,actor:victim}],{},new Set(),{frame:shown})[0];
   assert.equal(target.action,'hit');assert.equal(target.cue.durationMs,delays[index]);
  }
  startedAt+=delays[index];
 }
 if(order.type==='throwGrenade')assert.equal(recorded.state.units.find(actor=>actor.id==='grenade').inventory.grenade.count,1,'Only the released grenade is consumed');
});
test('a hidden flight or actor cannot supply release completion evidence',()=>{
 const result=presentedActBattle(createRendererSandboxBattle('combat'),orders[0]);
 for(const change of [{unitId:null},{grenadeVisual:{visible:false}},{state:{units:[]}}]){
  const frames=structuredClone(result.frames);frames[1]={...frames[1],...change};assert.equal(admittedThrownRelease(frames)[2].releaseComplete,undefined);
 }
 for(const change of [{unitId:null},{performed:false},{unitId:'different'},{state:{units:[]}}]){
  const frames=structuredClone(result.frames);frames[2]={...frames[2],...change};assert.equal(admittedThrownRelease(frames)[2].releaseComplete,undefined);
 }
});
for(const order of orders)test(`${order.type} mounted Battlefield blocks input during native preparation and commits once`,async t=>{
 let battle=createRendererSandboxBattle('combat');battle.selected=order.unitId;
 const before=structuredClone(battle),expected=presentedActBattle(before,order),frames=admittedThrownRelease(expected.frames),commits=[];
 const props=()=>({battle,onChange:next=>{battle=next;commits.push(next);return next;},onFinish(){}}),mounted=await mountBattlefield(t,Battlefield,props(),{virtualTimers:true});
 const panel=()=>nodes(mounted.tree()).find(node=>node.props?.onOrder&&node.props?.onEndTurn),scene=()=>nodes(mounted.tree()).find(node=>node.type===TacticalThreeScene);
 // Battlefield supplies its selected unit when accepting an ordinary action.
 await mounted.act(async()=>panel().props.onOrder(order));
 for(const frame of frames){
  assert.equal(panel().props.busy,true);assert.deepEqual(commits,[]);
  const visual=scene().props.actors.find(actor=>actor.id===order.unitId);
  assert.equal(visual.cue?.phase,frame.type==='result'?undefined:frame.type);
  await mounted.act(async()=>panel().props.onOrder(order));assert.deepEqual(commits,[],'Repeated input cannot pay for another throw');
  assert.equal(await mounted.nextDelay(),presentedFrameDuration(frame,before));
 }
 assert.deepEqual(commits,[expected.state]);assert.deepEqual(battle,actBattle(before,order));
});
for(const count of [1,2])test(`published grenade recovery retains the owned weapon stow with ${count} grenade${count===1?'':'s'}`,async()=>{
 const state=createRendererSandboxBattle('combat'),source=state.units.find(unit=>unit.id==='grenade');source.inventory.grenade.count=count;
 const before=structuredClone(state),recorded=presentedActBattle(state,orders[0]),frames=admittedThrownRelease(recorded.frames),delays=frames.map(frame=>presentedFrameDuration(frame,state)),asset=await publishedActor('woman-scout');
 const clip=asset.clips.find(clip=>clip.name==='stand.gesture.throw'),total=delays.reduce((sum,delay)=>sum+delay,0);
 const shown=(index,start)=>{
  const frame=frames[index],actor=frame.state.units.find(unit=>unit.id==='grenade');
  return presentActors(frame.state,[{kind:'unit',key:'unit:grenade',actor}],{},new Set(),{frame:{...frame,sequenceId:'owned-grenade',actionId:1,index,startedAt:start,durationMs:delays[index],actionStartedAt:0,actionDurationMs:total},now:start})[0];
 };
 const prepare=shown(0,0),runtime=new ActorRuntime(asset,prepare),rifle=()=>runtime.model.getObjectByName('primary:1800'),grenade=()=>runtime.model.getObjectByName('inventory:grenade:grenade');
 const pose=(visual,now)=>{runtime.update(visual,now);runtime.tick(.1,now);runtime.tick(.1,now);};
 // Native preparation ends at the same marker that starts the visible flight.
 nearly(delays[0],clip.markers.release*1000);pose(prepare,delays[0]-1);
 assert.equal(rifle().parent.name,asset.appearance.sockets.back.node);assert.equal(grenade().parent.name,asset.appearance.sockets.handRight_tool.node);assert.equal(grenade().visible,true);
 const recovery=shown(1,delays[0]);
 for(const offset of [0,1,delays[1]/2,delays[1]-1]){
  pose(recovery,delays[0]+offset);assert.equal(rifle().parent.name,asset.appearance.sockets.back.node,'The rifle stays on the back through released follow-through');
  const released=grenade();if(count===2)assert.ok(released&&!released.visible,'Retained stock cannot appear as a second thrown grenade');else assert.equal(released,undefined,'The exhausted owned stack is absent from the admitted state');
  runtime.model.traverse(object=>{if(object.userData?.itemId&&['1800','1810'].includes(object.userData.itemId))assert.ok(!object.parent.name.startsWith('socket_hand'),'The balancing arms remain free through recovery');});
 }
 pose(shown(2,delays[0]+delays[1]),delays[0]+delays[1]);assert.equal(rifle().parent.name,asset.appearance.sockets.back.node);
 if(count===2)assert.equal(grenade().visible,true,'The remaining owned stack returns after completed follow-through');else assert.equal(grenade(),undefined);
 assert.deepEqual(state,before);assert.deepEqual(recorded.state,actBattle(before,orders[0]));assert.equal(recorded.state.units.find(unit=>unit.id==='grenade').inventory.grenade?.count??0,count-1);runtime.dispose();
});
