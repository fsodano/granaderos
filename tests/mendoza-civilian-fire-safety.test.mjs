import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createBattle,firearmFlightPreview,firearmShotOptions} from '../game/tactical.js';
import {knownCivilianFireRisk,knownRouteShotSafety} from './route-fire-safety.mjs';
import {northernCombatOrder} from './northern-route.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {coastalCommandOrder} from './coastal-command-driver.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const proof=JSON.parse(readFileSync(new URL('./fixtures/mendoza-known-civilian.provenance.json',import.meta.url)));
function retained(index){
 const name=`mendoza-known-civilian-order-${index}.json.gz`,row=proof.files[name];
 const bytes=readFileSync(new URL(`./fixtures/${name}`,import.meta.url)),raw=gunzipSync(bytes);
 assert.equal(sha(bytes),row.gzipSha256);assert.equal(sha(raw),row.rawSha256);
 return JSON.parse(raw);
}
function assertSafe(battle,unit,action){
 if(action?.type!=='fire')return;
 const target=battle.units.find(other=>other.id===action.targetId);
 const option=firearmShotOptions(battle,unit,target,action.aim??0).find(o=>o.aim===(action.aim??0)&&o.hitLocation===(action.hitLocation??'torso'));
 assert.equal(knownRouteShotSafety(battle,unit,target)(option),true,'an admitted shot must avoid each known civilian and friendly ray');
}

for(const index of [66,107,129])test(`original Mendoza order ${index} exposes a known civilian risk that northern selection must reject`,()=>{
 const {battle,order}=retained(index),before=structuredClone(battle),unit=battle.units.find(u=>u.id===order.unitId),target=battle.units.find(u=>u.id===order.targetId);
 assert.equal(proof.terminalEqualsOriginal,true);assert.equal(proof.replayedOrders,636);
 assert.equal(knownCivilianFireRisk(battle,unit,target,order.hitLocation),true);
 const option=firearmShotOptions(battle,unit,target,order.aim).find(o=>o.aim===order.aim&&o.hitLocation===order.hitLocation);
 assert.ok(option.chance>0,'a positive target chance does not certify a civilian-safe ray');
 assert.equal(knownRouteShotSafety(battle,unit,target)(option),false);
 if(index===107){
  const impacts=firearmFlightPreview(battle,unit,target,order.hitLocation).bodyImpacts;
  assert.ok(impacts.findIndex(i=>i.victimKind==='npc'&&i.victimId==='san-martin')>impacts.findIndex(i=>i.victimKind==='unit'&&i.victimId===target.id),'the known civilian lies beyond the chosen enemy');
 }
 for(const controller of [northernCombatOrder,tucumanCombatOrder,coastalCommandOrder])assertSafe(battle,unit,controller(battle,unit));
 assert.deepEqual(battle,before,'selection preserves actual wounds, stocks, clock and original state');
});

function lane(npcs=[]){
 return createBattle([{id:'shooter',x:2,y:3,weapon:1802,loaded:1,ammo:2,stance:'prone',marksmanship:100,dexterity:100,agility:100}],{
  width:22,height:12,seed:45,tiles:Array.from({length:264},(_,i)=>({x:i%22,y:Math.floor(i/22),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'target',x:8,y:3,hp:100,stance:'standing',patrol:false,overwatch:false}],npcs,
 });
}
test('a hidden civilian cannot change clear public northern fire selection',()=>{
 const clear=lane(),hidden=lane([{id:'private',x:5,y:3,hp:100,stance:'standing',roomId:'unrevealed'}]),before=structuredClone(hidden);
 const unit=b=>b.units.find(u=>u.id==='shooter');
 const expected=northernCombatOrder(clear,unit(clear));assert.equal(expected?.type,'fire');
 assert.deepEqual(northernCombatOrder(hidden,unit(hidden)),expected);assert.deepEqual(hidden,before);
});
