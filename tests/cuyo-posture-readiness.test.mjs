import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,actionCosts,firearmShotOptions,stanceCost,getReachable,teamCanSee} from '../game/tactical.js';
import {cuyoCrouchOrder} from './cuyo-route-driver.mjs';
const finite=unit=>Object.fromEntries(['hp','maxHp','bleeding','bandaged','loaded','ammo','ammunition','ammunitionChoice','medkits','inventory','weapon','condition'].map(key=>[key,unit[key]]));

// Declared native arena, not an earned campaign. Its one accepted stance tests
// actual AP/time payment and retained field supplies; no shot or fight runs.
test('a useful public crouched shot retains the paid contact posture',()=>{
 const width=18,height=5,state=createBattle([{id:'shooter',x:2,y:2,facing:2,weapon:1800,loaded:1,ammo:2,marksmanship:90,condition:100,stance:'standing',medkits:0}],{
  width,height,seed:45,hour:12,
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',cover:0,blocked:false})),
  enemies:[{id:'contact',x:8,y:2,weapon:0,activeSlot:'unarmed',loaded:0,ammo:0,patrol:false,overwatch:false}],
 }),before=structuredClone(state),unit=state.units.find(u=>u.id==='shooter');
 const action=cuyoCrouchOrder(state,unit,{avoidCivilians:true});
 assert.deepEqual(action,{type:'stance',unitId:unit.id,stance:'crouched'});
 assert.deepEqual(state,before,'selection must leave all native fields unchanged');
 const next=actBattle(state,action),position=next.units.find(u=>u.id===unit.id),target=next.units.find(u=>u.id==='contact');
 assert.equal(next.lastError,null);assert.equal(position.stance,'crouched');
 assert.equal(position.ap,unit.ap-stanceCost(unit,'crouched'));assert.ok(next.elapsedSeconds>state.elapsedSeconds);
 assert.deepEqual(finite(position),finite(unit));assert.deepEqual(state,before);
 const costs=actionCosts(next,position,target),aim=Math.min(4,Math.floor((position.ap-costs.fire)/costs.aim));
 assert.ok(firearmShotOptions(next,position,target,aim).some(option=>option.chance>=25&&option.damageFactor>0&&!option.interveningFriendly&&!option.shots?.some(hand=>hand.interveningFriendly)));
});
