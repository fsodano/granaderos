import test from 'node:test';import assert from 'node:assert/strict';
import {advanceDetentionCare} from '../game/detention-care.js';
import {validateCampaignDetention} from '../game/campaign-detention.js';
const roster=[{id:3,name:'Herido',maxHp:80},{id:4,name:'Compañero',maxHp:70}];
function fixture(){
 const captured=(hp,maxHp,medkits)=>({captured:true,alive:true,capturedSector:'tucuman',capturedAt:1,hp,maxHp,energy:80,bleeding:hp<15?8:0,bandaged:0,medkits,inventory:{},unconscious:hp<15});
 return {hour:2,pendingBattle:null,operativeState:{3:captured(3,80,0),4:captured(70,70,3)},sectorStates:{tucuman:{sectorId:'tucuman',units:[{id:'guard',side:'enemy',hp:60,medical:40,medkits:0,dexterity:70,experienceLevel:2,energy:80}],npcs:[]}},enemyGroups:[{units:[{id:'guard',energy:80}]}]};
}
test('custody care uses another captive’s actual dressings and requires multiple finite strokes',()=>{
 const s=fixture(),before=s.operativeState[3].hp;
 const messages=advanceDetentionCare(s,roster);assert.equal(messages.length,1);assert.ok(s.operativeState[3].hp>before&&s.operativeState[3].hp<15);assert.equal(s.operativeState[4].medkits,2);assert.equal(s.sectorStates.tucuman.units[0].energy,77);assert.equal(s.enemyGroups[0].units[0].energy,77);
 const once=structuredClone(s);assert.deepEqual(advanceDetentionCare(s,roster),[]);assert.deepEqual(s,once);
 s.hour++;advanceDetentionCare(s,roster);assert.equal(s.operativeState[3].hp,15);assert.equal(s.operativeState[3].bleeding,0);assert.equal(s.operativeState[4].medkits,1);
 const after=structuredClone(s);s.hour++;assert.deepEqual(advanceDetentionCare(s,roster),[]);assert.equal(s.operativeState[3].hp,15);assert.equal(s.operativeState[4].medkits,1);
 assert.equal(after.detentionRecords['captive:3:1'].care.length,2);assert.doesNotThrow(()=>validateCampaignDetention(s));
});
test('no supplies, no able guard, or an active tactical sector grants no care',()=>{
 for(const alter of [s=>{s.operativeState[4].medkits=0;},s=>{s.sectorStates.tucuman.units[0].hp=0;},s=>{s.sectorStates.tucuman.units[0].medical=0;},s=>{s.sectorStates.tucuman.units[0].energy=2;},s=>{s.pendingBattle={sector:'tucuman'};}]){
  const s=fixture();alter(s);const before=structuredClone(s);assert.deepEqual(advanceDetentionCare(s,roster),[]);assert.deepEqual(s,before);
 }
});
test('a dead prisoner cannot receive care or supply another prisoner',()=>{
 const s=fixture();Object.assign(s.operativeState[4],{hp:0,alive:false,captured:false,capturedSector:null});const before=structuredClone(s);assert.deepEqual(advanceDetentionCare(s,roster),[]);assert.deepEqual(s,before);
});
