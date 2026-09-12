import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,getReachable,movementStepCost,climbPreview} from '../game/tactical.js';

function fixture(exploration=true){
 const tiles=Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0}));
 const upperSurfaces=Array.from({length:12},(_,i)=>({id:`terrace:${i}`,x:4+i%4,y:4+Math.floor(i/4),tacticalLevel:1,elevation:3,kind:'roof',type:'floor',blocked:false,cover:0}));
 return createBattle([{id:'p',x:3,y:4,level:7,weapon:1800,energy:100}],{id:'terrace-movement',width:16,height:10,tiles,upperSurfaces,climbLinks:[{id:'terrace:access',kind:'climb',from:{x:3,y:4,tacticalLevel:0},to:{x:4,y:4,tacticalLevel:1}}],exploration,enemies:exploration?[]:[{id:'e',x:15,y:9,patrol:false,overwatch:false}],seed:45});
}
const climb=state=>actBattle(state,{type:'climb',unitId:'p',linkId:'terrace:access'});
const physical=state=>{const copy=structuredClone(state);delete copy.log;delete copy.lastError;return copy;};

test('an authored climb spends only energy and time during exploration and retains earned grade',()=>{
 const state=fixture();state.units[0].ap=3;const before=structuredClone(state),preview=climbPreview(state,state.units[0],{linkId:'terrace:access'}),next=climb(state);
 assert.equal(preview.valid,true);assert.equal(preview.pa,20);assert.equal(next.lastError,null);
 assert.deepEqual(state,before);assert.equal(next.units[0].ap,3);assert.equal(next.units[0].energy,88);assert.equal(next.elapsedSeconds,6);
 assert.equal(next.units[0].tacticalLevel,1);assert.equal(next.units[0].level,7);assert.deepEqual([next.units[0].x,next.units[0].y],[4,4]);
 const down=climb(next);assert.equal(down.lastError,null);assert.equal(down.units[0].tacticalLevel,0);assert.equal(down.units[0].energy,80);assert.equal(down.units[0].ap,3);assert.equal(down.elapsedSeconds,10);
});

test('combat climb costs are paid from current AP without a refill',()=>{
 const state=fixture(false);state.units[0].ap=40;const next=climb(state);
 assert.equal(next.lastError,null);assert.equal(next.units[0].ap,20);assert.equal(next.units[0].energy,88);assert.equal(next.elapsedSeconds,6);
 const down=climb(next);assert.equal(down.lastError,null);assert.equal(down.units[0].ap,5);assert.equal(down.units[0].energy,80);assert.equal(down.elapsedSeconds,6);
});

test('roof routes retain climb steps, walk on supported surfaces and leave downstairs occupants independent',()=>{
 const state=fixture();state.units.push({...structuredClone(state.units[0]),id:'under',x:4,y:4});
 const roof=getReachable(state,'p').find(p=>p.x===7&&p.y===6&&p.tacticalLevel===1);
 assert.ok(roof);assert.equal(roof.path[0].kind,'climb');assert.equal(roof.path[0].linkId,'terrace:access');assert.ok(roof.path.every(p=>p.tacticalLevel===1));
 const next=actBattle(state,{type:'move',unitId:'p',x:7,y:6,tacticalLevel:1});assert.equal(next.lastError,null);assert.equal(next.units[0].tacticalLevel,1);assert.deepEqual([next.units[0].x,next.units[0].y],[7,6]);
 assert.deepEqual(next.units[1],state.units[1]);
 assert.equal(movementStepCost(next,next.units[0],next.units[0],{x:8,y:6,tacticalLevel:1}),Infinity);
 const unsupported=actBattle(next,{type:'move',unitId:'p',x:8,y:6,tacticalLevel:1});assert.ok(unsupported.lastError);assert.deepEqual(physical(unsupported),physical(next));
});

test('blocked, mounted, prone, exhausted, unaffordable and remote climbs reject atomically',()=>{
 for(const patch of [{mounted:true},{stance:'prone'},{stance:'crouched'},{energy:11},{ap:19},{x:2},{entangled:true}]){
  const state=fixture(false);Object.assign(state.units[0],patch);const before=physical(state),next=climb(state);
  assert.ok(next.lastError,JSON.stringify(patch));assert.deepEqual(physical(next),before);
 }
 const state=fixture();state.units.push({...structuredClone(state.units[0]),id:'above',x:4,y:4,tacticalLevel:1});
 const blocked=climb(state);assert.ok(blocked.lastError);assert.deepEqual(physical(blocked),physical(state));
});
