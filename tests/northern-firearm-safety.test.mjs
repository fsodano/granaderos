import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave} from '../game/save.js';
import {createBattle,firearmShotOptions} from '../game/tactical.js';
import {northernCombatOrder} from './northern-route.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {recoveryMendozaOrder} from './recovery-mendoza-driver.mjs';

function selectedForecast(battle,unit,action){
 if(action?.type!=='fire')return null;
 const target=battle.units.find(actor=>actor.id===action.targetId);
 return firearmShotOptions(battle,unit,target,action.aim??0).find(option=>option.aim===(action.aim??0)&&option.hitLocation===(action.hitLocation??'torso'));
}
function assertSafeFire(battle,unit,action){
 if(action?.type!=='fire')return;
 const option=selectedForecast(battle,unit,action);assert.ok(option,'a selected fire order has a current public forecast');
 assert.equal(Boolean(option.interveningFriendly||option.shots?.some(shot=>shot.interveningFriendly)),false,'the order must not knowingly shoot through a friendly body');
}

test('the genuine retained Mendoza pre-shot state cannot reintroduce its known friendly-ray shot through the normal or low-chance fallback',()=>{
 const raw=gunzipSync(readFileSync(new URL('./fixtures/northern-known-friendly-fire.save.json.gz',import.meta.url))),proof=JSON.parse(readFileSync(new URL('./fixtures/northern-known-friendly-fire.provenance.json',import.meta.url)));
 assert.equal(createHash('sha256').update(raw).digest('hex'),proof.sha256);
 const {battle}=decodeSave(raw.toString()),before=structuredClone(battle),unit=battle.units.find(actor=>actor.id==='142');
 assert.deepEqual([battle.turn,battle.phase,battle.status],[4,'interrupt','active']);assert.equal(proof.replayedPrefixOrders,116);
 const original=proof.nextRecordedAction,unsafe=selectedForecast(battle,unit,original);
 assert.equal(unsafe.interveningFriendly,true);assert.equal(unsafe.chance,41);assert.equal(unsafe.damageFactor,.640625);
 // These are selection checks on the exact witnessed state. No order is
 // applied, no body/equipment changes and no victory outcome is asserted.
 for(const controller of [northernCombatOrder,tucumanCombatOrder,recoveryMendozaOrder])assertSafeFire(battle,unit,controller(battle,unit));
 assert.deepEqual(battle,before);
});

// Declared flat geometry isolates the public firing-lane guard. It does not
// create a campaign injury, casualty, resource stock or outcome.
function lane({alternative=false}={}){
 return createBattle([{id:'shooter',x:2,y:3,weapon:1802,loaded:1,ammo:2,stance:'prone',marksmanship:100,dexterity:100,agility:100},{id:'friend',x:5,y:3,weapon:1800,stance:'standing'}],{
  width:22,height:12,seed:45,tiles:Array.from({length:264},(_,index)=>({x:index%22,y:Math.floor(index/22),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'behind-friend',x:8,y:3,hp:100,stance:'standing',patrol:false,overwatch:false},...(alternative?[{id:'clear-lane',x:10,y:6,hp:100,stance:'standing',patrol:false,overwatch:false}]:[])],
 });
}

test('ranked northern shots select an existing clear-lane alternative instead of the known friendly ray',()=>{
 const battle=lane({alternative:true}),before=structuredClone(battle),unit=battle.units.find(actor=>actor.id==='shooter'),unsafe=battle.units.find(actor=>actor.id==='behind-friend');
 assert.ok(firearmShotOptions(battle,unit,unsafe,4).some(option=>option.chance>=25&&option.interveningFriendly),'the unsafe target is a tempting admitted-probability shot');
 const action=northernCombatOrder(battle,unit);assert.equal(action?.type,'fire');assert.equal(action.targetId,'clear-lane');assertSafeFire(battle,unit,action);
 assert.deepEqual(battle,before);
});

test('an unsafe original fire fallback cannot bypass either northern selection or the existing Tucuman fallback',()=>{
 const battle=lane(),before=structuredClone(battle),unit=battle.units.find(actor=>actor.id==='shooter'),target=battle.units.find(actor=>actor.id==='behind-friend');
 const options=firearmShotOptions(battle,unit,target,4);assert.ok(options.some(option=>option.chance>=25&&option.damageFactor>0));
 assert.ok(options.filter(option=>option.chance>0).every(option=>option.interveningFriendly||option.shots?.some(shot=>shot.interveningFriendly)));
 for(const controller of [northernCombatOrder,tucumanCombatOrder]){const action=controller(battle,unit);assert.ok(action,'a blocked shot retains the native safe alternative');assert.notEqual(action.type,'fire');assertSafeFire(battle,unit,action);}
 assert.deepEqual(battle,before);
});
