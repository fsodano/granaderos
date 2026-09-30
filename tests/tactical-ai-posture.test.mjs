import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,canSee,stanceCost} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';

function field(){
 const state=createBattle([{id:'p',x:2,y:2,facing:2,weapon:1800,marksmanship:0,condition:30,patrol:false,medkits:0}],{
  seed:45,width:18,height:5,enemies:[{id:'e',x:6,y:2,weapon:1800,loaded:0}],
  tiles:Array.from({length:90},(_,i)=>({x:i%18,y:Math.floor(i/18),type:'grass',cover:0,blocked:false})),
 });
 state.units[0].ap=18;return state;
}

test('automatic firing posture pays for both the stance and the following shot',()=>{
 const state=field(),before=structuredClone(state),unit=state.units[0];
 const action=chooseEnemyAction(state,unit);
 assert.deepEqual(action,{type:'stance',unitId:'p',stance:'prone'});
 assert.deepEqual(state,before,'planning must not spend resources or change posture');
 const positioned=actBattle(state,action),actor=positioned.units[0];
 assert.equal(positioned.lastError,null);
 assert.equal(actor.ap,unit.ap-stanceCost(unit,'prone'));
 assert.equal(actor.loaded,unit.loaded);
 const shot=chooseEnemyAction(positioned,actor);
 assert.equal(shot.type,'fire');assert.equal(shot.targetId,'e');
 const fired=actBattle(positioned,shot);
 assert.equal(fired.lastError,null);assert.equal(fired.units[0].ap,0);
 assert.equal(fired.units[0].loaded,unit.loaded-1);
});

test('automatic firing posture cannot spend unavailable AP or target unseen soldiers',()=>{
 for(const ap of [0,1,4,8]){
  const state=field();state.units[0].ap=ap;
  assert.equal(chooseEnemyAction(state,state.units[0]),null);
 }
 const state=field();state.units[0].facing=6;
 assert.equal(canSee(state,state.units[0],state.units[1]),false);
 const order=chooseEnemyAction(state,state.units[0]);
 assert.notEqual(order?.type,'stance');assert.notEqual(order?.type,'fire');
 const moved=structuredClone(state);moved.units[1].x=14;
 assert.deepEqual(chooseEnemyAction(moved,moved.units[0]),order);
});
