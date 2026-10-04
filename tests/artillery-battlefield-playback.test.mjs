import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,actionCosts,artilleryCosts} from '../game/tactical.js';
import {battleFrameDuration} from '../game/battle-playback.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:TacticalThreeScene}=await import('../web/app/TacticalThreeScene.tsx');
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
const unit=(state,id)=>state.units.find(actor=>actor.id===String(id));
function field(){
 return createBattle([{id:20,x:1,y:2,facing:2},{id:21,x:2,y:2,facing:2},{id:22,x:1,y:3,facing:2},{id:23,x:1,y:6}],{
  width:32,height:9,seed:45,tiles:Array.from({length:288},(_,i)=>({x:i%32,y:Math.floor(i/32),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'target',x:7,y:3,hp:200,maxHp:200,morale:100,patrol:false,overwatch:false},{id:'reserve',x:29,y:7,morale:100,patrol:false,overwatch:false}],
  artillery:[{id:'gun',type:'field8',x:2,y:3,side:'player',facing:0,loaded:true,ammo:4}],
 });
}

for(const type of ['artillery','artilleryReload','artilleryMove','artilleryPivot'])test(`mounted Battlefield records ${type} for its admitted crew and commits once`,async t=>{
 let battle=field();if(type==='artilleryReload')battle.artillery[0].loaded=false;
 const before=structuredClone(battle),action={type,artilleryId:'gun',x:type==='artilleryMove'?3:12,y:3,mode:'solid'},request={unitId:'20',aim:0,hitLocation:'torso',...action};
 const expected=presentedActBattle(before,request),commits=[],frames=new Map();let now=1000,serial=0;
 const clock={now:()=>now,request:callback=>{frames.set(++serial,callback);return serial;},cancel:id=>frames.delete(id)};
 assert.equal(expected.state.lastError,null);
 const props=()=>({battle,onChange:next=>{battle=next;commits.push(next);return next;},onFinish(){}}),mounted=await mountBattlefield(t,Battlefield,props(),{clock,virtualTimers:true});
 const panel=()=>nodes(mounted.tree()).find(node=>node.props?.onOrder&&node.props?.onEndTurn),scene=()=>nodes(mounted.tree()).find(node=>node.type===TacticalThreeScene);
 await mounted.act(async()=>panel().props.onOrder(action));
 let crewCues=0;
 for(const frame of expected.frames){
  assert.deepEqual(commits,[],'presentation does not commit intermediate snapshots');assert.equal(panel().props.busy,true);
  if(frame.type==='prepare'){
   const crew=scene().props.actors.filter(actor=>['20','21','22'].includes(actor.id));
   assert.equal(crew.length,3);assert.ok(crew.every(actor=>actor.action===(type==='artillery'?'artilleryFire':type)));
   assert.equal(new Set(crew.map(actor=>actor.cue.id)).size,3,'each actual crew member owns a separate cue');crewCues++;
   assert.equal(scene().props.actors.find(actor=>actor.id==='23').cue,undefined,'unassigned soldiers do not join the action');
   assert.equal(scene().props.actors.some(actor=>actor.id==='reserve'),false,'hidden enemies are not disclosed');
  }
  await mounted.act(async()=>panel().props.onOrder(action));assert.deepEqual(commits,[],'repeated input during playback cannot spend a second action');
  assert.equal(await mounted.nextDelay(),battleFrameDuration(frame));
 }
 assert.equal(crewCues,1);assert.deepEqual(commits,[expected.state]);assert.deepEqual(battle,actBattle(before,request));
 if(type==='artilleryReload'){
  const cost=artilleryCosts(before,unit(before,20),before.artillery[0]).reload;
  for(const id of [20,21,22])assert.equal(unit(battle,id).ap,unit(before,id).ap-cost,`crew ${id} pays one reload`);
  assert.equal(battle.artillery[0].loaded,true);assert.equal(battle.artillery[0].ammo,3);assert.equal(unit(battle,23).ap,unit(before,23).ap);
 }
 await mounted.render(props());now+=1000;const callbacks=[...frames.values()];frames.clear();await mounted.act(async()=>{for(const callback of callbacks)callback(now);});
 assert.equal(panel().props.busy,false,'input resumes after the recorded action and any paid crew movement');
 assert.ok(scene().props.actors.filter(actor=>['20','21','22'].includes(actor.id)).every(actor=>actor.cue===undefined),'the finished action does not emit a second accepted cue');
});

test('mounted Battlefield presents partial artillery reload work once without consuming an unloaded round',async t=>{
 const battle=field();battle.artillery[0].loaded=false;unit(battle,20).ap=25;
 const before=structuredClone(battle),commits=[],action={type:'artilleryReload',artilleryId:'gun'},expected=actBattle(before,{unitId:'20',aim:0,hitLocation:'torso',...action});
 const mounted=await mountBattlefield(t,Battlefield,{battle,onChange:next=>{commits.push(next);return next;},onFinish(){}},{virtualTimers:true});
 const panel=()=>nodes(mounted.tree()).find(node=>node.props?.onOrder&&node.props?.onEndTurn);
 await mounted.act(async()=>panel().props.onOrder(action));assert.equal(panel().props.busy,true);await mounted.settle();
 assert.deepEqual(commits,[expected]);assert.equal(expected.lastError,null);
 for(const id of [20,21,22])assert.equal(unit(expected,id).ap,unit(before,id).ap-25);
 assert.equal(expected.artillery[0].loaded,false);assert.equal(expected.artillery[0].ammo,before.artillery[0].ammo);assert.deepEqual(battle,before);
});

test('mounted Battlefield uses the accepted horse state to emit exactly one mount or dismount cue',async t=>{
 let battle=field();unit(battle,20).horse=true;unit(battle,20).mounted=false;
 const commits=[],props=()=>({battle,onChange:next=>{battle=next;commits.push(next);return next;},onFinish(){}}),mounted=await mountBattlefield(t,Battlefield,props(),{virtualTimers:true});
 const panel=()=>nodes(mounted.tree()).find(node=>node.props?.onOrder&&node.props?.onEndTurn),scene=()=>nodes(mounted.tree()).find(node=>node.type===TacticalThreeScene),visual=()=>scene().props.actors.find(actor=>actor.id==='20');
 const cueIds=[];
 for(const semantic of ['mount','dismount']){
  const before=structuredClone(battle),cost=actionCosts(before,unit(before,20)).mount,count=commits.length;
  await mounted.act(async()=>panel().props.onOrder({type:'mount'}));
  assert.equal(commits.length,count+1);assert.equal(battle.lastError,null);assert.equal(unit(battle,20).ap,unit(before,20).ap-cost);
  assert.equal(visual().cue,undefined,'the order itself does not guess mount versus dismount');
  await mounted.render(props());
  assert.equal(visual().action,semantic);assert.equal(visual().cue.action,semantic);assert.equal(visual().cue.fromPosture,semantic==='mount'?'standing':'mounted');assert.equal(visual().mounted,semantic==='mount');
  const id=visual().cue.id;cueIds.push(id);await mounted.render(props());assert.equal(visual().cue.id,id,'the same committed state cannot restart the cue');
  await mounted.act(async()=>scene().props.onCueComplete('unit:20',id));assert.equal(visual().cue,undefined);
 }
 assert.equal(new Set(cueIds).size,2);
 // A rejected order must not fabricate a transition or pay another mount cost.
 unit(battle,20).ap=0;await mounted.render(props());const before=structuredClone(battle);
 await mounted.act(async()=>panel().props.onOrder({type:'mount'}));await mounted.render(props());
 assert.ok(battle.lastError);assert.equal(unit(battle,20).mounted,false);assert.equal(unit(battle,20).ap,unit(before,20).ap);assert.equal(visual().cue,undefined);
});
