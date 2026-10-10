import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave} from '../game/save.js';
import {createBattle,actBattle,teamCanSee,hasLineOfSight,firearmShotOptions,actionCosts,stanceCost,interruptAvailable} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {spacePoint} from '../game/tactical-space.js';
import {combatOrder} from './opening-driver.mjs';
import {northernCombatOrder} from './northern-route.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';

const risk=option=>Boolean(option.interveningFriendly||option.shots?.some(shot=>shot.interveningFriendly));
const known=(battle,unit)=>({...battle,units:battle.units.filter(other=>other.side===unit.side||teamCanSee(battle,unit.side,other)),npcs:(battle.npcs??[]).filter(other=>teamCanSee(battle,unit.side,other))});
function usefulShots(battle,unit){
 const shots=[];
 for(const target of battle.units.filter(other=>other.side==='enemy'&&other.hp>=15&&!other.departure&&!other.surrendered&&!other.unconscious&&!other.routed&&teamCanSee(battle,unit.side,other))){
  const costs=actionCosts(battle,unit,target);if(unit.ap<costs.fire||!hasLineOfSight(battle,unit,target))continue;
  const aim=Math.min(4,Math.floor((unit.ap-costs.fire)/costs.aim));
  for(const option of firearmShotOptions(battle,unit,target,aim))if(option.chance>=25&&option.damageFactor>0&&!risk(option))shots.push({targetId:target.id,paidFire:costs.fire+option.aim*costs.aim,...option});
 }
 return shots;
}
function paidPreview(battle,unit,stance){
 const cost=stanceCost(unit,stance),position={...unit,stance,movementMode:stance==='prone'?'prone':stance==='crouched'?'crouch':'walk',momentum:0,weaponReady:false,ap:unit.ap-cost};
 const view=known(battle,unit),posed={...view,units:view.units.map(other=>other.id===unit.id?position:other)};
 return {stance,cost,remainingAP:position.ap,weaponReady:position.weaponReady,shots:usefulShots(posed,position)};
}

test('the exact earned original Córdoba blocked-fire pair admits the cheapest paid useful posture without executing an order',t=>{
 const raw=gunzipSync(readFileSync(new URL('./fixtures/northern-known-friendly-posture.save.json.gz',import.meta.url))),proof=JSON.parse(readFileSync(new URL('./fixtures/northern-known-friendly-posture.provenance.json',import.meta.url)));
 assert.equal(createHash('sha256').update(raw).digest('hex'),proof.sha256);
 const pair=decodeSave(raw.toString()),before=structuredClone(pair),battle=pair.battle,unit=battle.units.find(actor=>actor.id==='113');
 assert.deepEqual([battle.sectorId,battle.turn,battle.phase,battle.status],['cordoba',3,'player','active']);assert.equal(interruptAvailable(battle,unit),true);
 assert.deepEqual(combatOrder(battle,unit),proof.originalAction);assert.equal(chooseEnemyAction(known(battle,unit),unit),null);
 const target=battle.units.find(actor=>actor.id===proof.originalAction.targetId),original=firearmShotOptions(battle,unit,target,0).find(option=>option.hitLocation==='torso');assert.equal(risk(original),true);
 assert.equal(usefulShots(known(battle,unit),unit).length,0,'there is no useful safe current shot');
 const crouch=paidPreview(battle,unit,'crouched'),standing=paidPreview(battle,unit,'standing');
 assert.deepEqual([crouch.cost,crouch.remainingAP,crouch.weaponReady],[3,70,false]);assert.equal(standing.cost,6);
 assert.ok(crouch.shots.length>0);assert.ok(standing.shots.length>0);assert.ok(crouch.shots.some(shot=>shot.targetId==='enemy-9'&&shot.hitLocation==='head'&&shot.aim===0&&shot.paidFire===10));
 for(const shot of crouch.shots)assert.ok(shot.paidFire<=crouch.remainingAP);
 const action={type:'stance',unitId:'113',stance:'crouched'};
 for(const controller of [northernCombatOrder,tucumanCombatOrder])assert.deepEqual(controller(battle,unit),action);
 // Declared private-occupant removal changes only a selector input clone.
 // It is not a campaign save, action or altered earned outcome.
 const privateVariant=structuredClone(battle),observed=known(battle,unit);
 privateVariant.units=privateVariant.units.filter(other=>observed.units.some(actor=>actor.id===other.id));privateVariant.npcs=privateVariant.npcs.filter(other=>observed.npcs.some(actor=>actor.id===other.id));
 assert.ok(privateVariant.units.length<battle.units.length);
 const privateBefore=structuredClone(privateVariant);
 assert.deepEqual(northernCombatOrder(privateVariant,privateVariant.units.find(actor=>actor.id===unit.id)),action);assert.deepEqual(privateVariant,privateBefore);
 assert.deepEqual(pair,before,'every earned campaign and battle field remains unchanged');
 t.diagnostic(JSON.stringify({case:'earned-original-Cordoba-pure-posture-selection',scope:'exact official paired original input; zero tactical or campaign actions; no victory claim',fixtureSha256:proof.sha256,original:proof.originalAction,originalForecast:original,nativeAction:null,selected:action,apBefore:unit.ap,crouched:{cost:crouch.cost,remainingAP:crouch.remainingAP,safeUsefulShots:crouch.shots},standing:{cost:standing.cost,remainingAP:standing.remainingAP,safeUsefulShots:standing.shots},inputUnchanged:true,privateInputVariantUnchanged:true}));
});

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
