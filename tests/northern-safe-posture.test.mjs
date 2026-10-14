import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,teamCanSee,hasLineOfSight,firearmShotOptions,actionCosts,stanceCost,interruptAvailable} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {spacePoint} from '../game/tactical-space.js';

const risk=option=>Boolean(option.interveningFriendly||option.shots?.some(shot=>shot.interveningFriendly));
function usefulShots(battle,unit){
 const shots=[];
 for(const target of battle.units.filter(other=>other.side==='enemy'&&other.hp>=15&&!other.departure&&!other.surrendered&&!other.unconscious&&!other.routed&&teamCanSee(battle,unit.side,other))){
  const costs=actionCosts(battle,unit,target);if(unit.ap<costs.fire||!hasLineOfSight(battle,unit,target))continue;
  const aim=Math.min(4,Math.floor((unit.ap-costs.fire)/costs.aim));
  for(const option of firearmShotOptions(battle,unit,target,aim))if(option.chance>=25&&option.damageFactor>0&&!risk(option))shots.push({targetId:target.id,paidFire:costs.fire+option.aim*costs.aim,...option});
 }
 return shots;
}
// Declared native stance-cost arena. This proves the ordinary order's payment
// and replay, separately from the earned-input selector above. No campaign is
// created, no shot/end-turn loop runs and no actor receives supplies by order.
function stanceArena(ap){
 const width=12,height=6,battle=createBattle([{id:'shooter',x:1,y:2,facing:2,hp:80,maxHp:100,bandaged:20,bleeding:0,energy:75,weapon:1804,loaded:1,ammo:2,condition:96,stance:'prone',movementMode:'prone',weaponReady:true}],{
  width,height,seed:45,hour:12,
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'contact',x:8,y:2,hp:100,weapon:0,activeSlot:'unarmed',loaded:0,ammo:0,patrol:false,overwatch:false}],
 });
 // Explicit initial AP/readiness declaration, not an executed grant.
 const declared=battle.units.find(unit=>unit.id==='shooter');declared.ap=ap;declared.weaponReady=true;
 return validateBattleSnapshot(battle);
}
const actor=battle=>battle.units.find(unit=>unit.id==='shooter');
const finite=unit=>Object.fromEntries(['hp','maxHp','bandaged','bleeding','energy','weapon','loaded','ammo','medkits','condition','inventory','offHand'].map(key=>[key,unit[key]]));

test('the declared native crouch pays full AP/time, lowers the weapon and leaves a finite affordable safe shot with exact JSON replay',t=>{
 const battle=stanceArena(13),before=structuredClone(battle),unit=actor(battle),action={type:'stance',unitId:unit.id,stance:'crouched'};
 assert.equal(stanceCost(unit,action.stance),3);assert.equal(unit.weaponReady,true);
 const next=actBattle(battle,action),changed=actor(next);
 assert.equal(next.lastError,null);assert.equal(changed.stance,'crouched');assert.equal(changed.movementMode,'crouch');assert.equal(changed.ap,10);assert.equal(changed.weaponReady,undefined);assert.equal(changed.momentum,0);
 assert.deepEqual(spacePoint(changed),spacePoint(unit));assert.deepEqual(finite(changed),finite(unit));
 assert.ok(next.elapsedSeconds>battle.elapsedSeconds);
 const safe=usefulShots(next,changed);assert.ok(safe.length>0);assert.ok(safe.every(shot=>shot.paidFire<=changed.ap));
 assert.deepEqual(battle,before);
 const resumed=validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));assert.deepEqual(actBattle(resumed,action),next,'validated JSON round-trip repeats the full result; this is not an official campaign save');
 assert.doesNotThrow(()=>validateBattleSnapshot(next));
 t.diagnostic(JSON.stringify({case:'declared-native-paid-crouch',scope:'native stance-cost arena only; one stance plus exact replay; no shot or endTurn',action,paidAP:unit.ap-changed.ap,apBefore:unit.ap,apAfter:changed.ap,elapsedBefore:battle.elapsedSeconds,elapsedAfter:next.elapsedSeconds,finiteBefore:finite(unit),finiteAfter:finite(changed),safeAffordableShots:safe,inputUnchanged:true,jsonRoundTripExact:true}));
});

test('a declared native crouch one AP short refuses atomically',t=>{
 const battle=stanceArena(2),before=structuredClone(battle),action={type:'stance',unitId:'shooter',stance:'crouched'};
 const next=actBattle(battle,action);assert.ok(next.lastError);
 const {log:oldLog,lastError:oldError,...oldState}=battle,{log:newLog,lastError:newError,...newState}=next;
 assert.deepEqual(newState,oldState,'refusal cannot spend AP, time, energy, health or finite stock');assert.deepEqual(battle,before);
 t.diagnostic(JSON.stringify({case:'declared-native-crouch-one-AP-short',apBefore:actor(battle).ap,apAfter:actor(next).ap,requiredAP:stanceCost(actor(battle),'crouched'),elapsedBefore:battle.elapsedSeconds,elapsedAfter:next.elapsedSeconds,lastError:next.lastError,atomicRefusal:true,inputUnchanged:true}));
});
