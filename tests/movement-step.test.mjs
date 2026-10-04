import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,getReachable} from '../game/tactical.js';
import {movementStep} from '../game/movement-step.js';
import {runBattleJob} from '../game/battle-job.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const tiles=(width,height)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
const field=(unit={},options={})=>createBattle([{id:'p',x:1,y:2,strength:75,...unit}],{width:16,height:8,tiles:tiles(16,8),exploration:true,enemies:[],hour:12,...options});
const move={type:'move',unitId:'p',x:12,y:2};
const actor=s=>s.units.find(u=>u.id==='p');
const physical=s=>{const {lastMovePath,...unit}=actor(s);return {unit,elapsedSeconds:s.elapsedSeconds,mode:s.mode,phase:s.phase,status:s.status,seed:s.seed};};

test('movement worker commits one cell and only reached cells cost energy and time',()=>{
 const before=field(),original=structuredClone(before),result=runBattleJob({battle:before,action:move,kind:'movement-step'});
 assert.equal(result.status,'moving');assert.equal(actor(result.state).x,2);assert.equal(actor(result.state).energy,99.95);assert.equal(result.state.elapsedSeconds,3);
 assert.equal(result.continuation.length,10);assert.equal(result.continuation.at(-1).x,12);assert.equal(actor(result.state).lastMovePath.length,1);
 assert.deepEqual(before,original);assert.doesNotThrow(()=>validateBattleSnapshot(result.state));
 // Cancelling this plan does not charge any of its remaining ten cells.
 assert.equal(actor(before).energy-actor(result.state).energy<.051,true);
});

test('completed incremental walk retains the ordinary route costs and a coherent journal',()=>{
 const before=field(),whole=actBattle(before,move);let current=before,continuation,result,count=0;
 do{result=movementStep(current,move,continuation);current=validateBattleSnapshot(JSON.parse(JSON.stringify(result.state)));continuation=result.continuation;count++;}while(result.status==='moving'&&count<30);
 assert.equal(result.status,'completed');assert.equal(count,11);assert.deepEqual(physical(current),physical(whole));
 assert.equal(current.log.at(-1),whole.log.at(-1));
});

test('a new destination discards the old remainder and running charges only later reached cells',()=>{
 const first=movementStep(field(),move),second=movementStep(first.state,move,first.continuation);
 assert.equal(actor(second.state).x,3);
 const changed={...move,x:3,y:6,movement:'run'};let result=movementStep(second.state,changed);
 assert.equal(actor(result.state).x,3);assert.equal(actor(result.state).y,3);assert.equal(actor(result.state).movementMode,'run');
 while(result.status==='moving')result=movementStep(result.state,changed,result.continuation);
 assert.equal(result.status,'completed');assert.equal(actor(result.state).x,3);assert.equal(actor(result.state).y,6);
 assert.equal(actor(result.state).energy,96.8);assert.equal(result.state.elapsedSeconds,10);
});

test('continuation rechecks changed terrain and rejects nonadjacent injected steps',()=>{
 const first=movementStep(field(),move),blocked=structuredClone(first.state),target=first.continuation[0];
 blocked.tiles.find(t=>t.x===target.x&&t.y===target.y).blocked=true;
 const result=movementStep(blocked,move,first.continuation);assert.equal(result.status,'stopped');assert.ok(result.state.lastError);assert.deepEqual(result.state.units,blocked.units);assert.equal(result.state.elapsedSeconds,blocked.elapsedSeconds);
 const jumped=movementStep(first.state,move,[{x:12,y:2}]);assert.equal(jumped.status,'stopped');assert.deepEqual(jumped.state.units,first.state.units);
 const wrong=movementStep(first.state,{...move,y:4},first.continuation);assert.equal(wrong.status,'stopped');assert.deepEqual(wrong.state.units,first.state.units);
});

test('contact and genuine exhaustion discard every unexecuted step',()=>{
 const tired=movementStep(field({energy:.05}),move);assert.equal(tired.status,'stopped');assert.equal(tired.continuation,null);assert.equal(actor(tired.state).x,2);assert.equal(actor(tired.state).energy,0);assert.equal(actor(tired.state).unconscious,true);
 const before=field({facing:2},{hour:5,secondOfHour:3599,enemies:[{id:'e',x:12,y:2,patrol:false,facing:6}]});
 let result=movementStep(before,move),count=0;
 while(result.status==='moving'&&count++<20)result=movementStep(result.state,move,result.continuation);
 assert.equal(result.status,'stopped');assert.equal(result.continuation,null);assert.equal(result.state.mode,'combat');assert.ok(actor(result.state).x<12);
});

test('a cached next step never diverts around hidden occupancy',()=>{
 const before=field({x:5,y:2,facing:2},{seed:45,enemies:[{id:'hidden',x:1,y:2,overwatch:false,patrol:false}]});
 const action={...move,x:1};let result=movementStep(before,action),count=0;
 while(result.status==='moving'&&count++<20)result=movementStep(result.state,action,result.continuation);
 assert.equal(result.status,'stopped');assert.ok(actor(result.state).x>1);assert.equal(actor(result.state).y,2);
});

test('incremental routes retain authored climb links and charge their real costs',()=>{
 const upperSurfaces=[1,2,3].map(x=>({id:`platform:${x}`,x,y:2,tacticalLevel:1,elevation:3,kind:'platform',type:'floor',blocked:false,cover:0}));
 const before=field({}, {upperSurfaces,climbLinks:[{id:'up',kind:'climb',from:{x:1,y:2,tacticalLevel:0},to:{x:1,y:2,tacticalLevel:1}}]});
 const action={...move,x:3,y:2,tacticalLevel:1},full=actBattle(before,action),first=movementStep(before,action);
 assert.equal(actor(first.state).x,1);assert.equal(actor(first.state).tacticalLevel,1);assert.equal(actor(first.state).lastMovePath[0].linkId,'up');assert.ok(actor(first.state).energy<99);
 let result=first;while(result.status==='moving')result=movementStep(result.state,action,result.continuation);
 assert.equal(result.status,'completed');assert.deepEqual(physical(result.state),physical(full));
});

test('combat steps pay stance and AP once, and foreign or inactive actors cannot march',()=>{
 const ground=tiles(16,8);for(const tile of ground)if(tile.y===4)Object.assign(tile,{type:'wall',blocked:true,blocksSight:true});
 const before=field({movementMode:'crouch'},{tiles:ground,enemies:[{id:'guard',x:14,y:6,patrol:false}]});before.mode='combat';before.sectorCleared=false;
 const action={...move,x:4,movement:'run'},full=actBattle(before,action);let result=movementStep(before,action);
 while(result.status==='moving')result=movementStep(result.state,action,result.continuation);
 assert.equal(result.status,'completed');assert.deepEqual(physical(result.state),physical(full));
 for(const change of [{side:'enemy'},{militia:true},{routed:true},{unconscious:true},{equipmentCursor:{stack:{}}}]){
  const state=field();Object.assign(actor(state),change);const refused=movementStep(state,move);assert.equal(refused.status,'stopped');assert.deepEqual(refused.state.units,state.units);
 }
});

test('an unaffordable cached combat step rejects without advancing time or paying posture',()=>{
 for(const movement of [undefined,'run']){
  const state=field({movementMode:movement?'crouch':'walk'});state.mode='combat';state.sectorCleared=false;actor(state).ap=1;
  const action={...move,x:2,...(movement?{movement}:{})},before=structuredClone(state),result=movementStep(state,action,[{x:2,y:2}]);
  assert.equal(result.status,'stopped');assert.ok(result.state.lastError);assert.deepEqual(result.state.units,state.units);assert.equal(result.state.elapsedSeconds,state.elapsedSeconds);assert.deepEqual(state,before);
 }
});
