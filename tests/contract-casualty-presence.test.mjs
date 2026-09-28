import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {fight} from './opening-driver.mjs';
import {order,saved} from './local-contract-fixture.mjs';
let cached;
function paidCasualty(){
 if(cached)return structuredClone(cached);
 let s=initialCampaign(8,defaultContentPackage());for(const id of [128,142,123,115,131,110])s=order(s,{type:'recruitCivic',id,term:'day'});s=order(s,{type:'wait',hours:6});s=order(s,{type:'attack',sector:'buenos_aires'});const request=s.pendingBattle,{battle}=fight(request);assert.equal(battle.status,'victory');const victim=battle.units.find(u=>u.side==='player'&&u.hp===0);assert.ok(victim);const pair=syncBattleTime(s,battle);assert.equal(pair.error,null);const restored=decodeSave(encodeSave(pair.campaign,pair.battle));s=order(restored.campaign,{type:'battleResult',battleId:request.id,outcome:'victory',sectorState:restored.battle,survivors:restored.battle.units.filter(u=>u.side==='player')});
 const id=Number(victim.id);assert.equal(s.operativeState[id].alive,false);assert.equal(s.contentPresence.people[`person-${id}`].recruited,true);cached={campaign:s,id};return structuredClone(cached);
}

test('an actual hired casualty remains dead and saveable when its contract expires after a fresh capital victory',()=>{
 const {campaign:before,id}=paidCasualty(),death=before.operativeState[id].deathMinute,corpse=structuredClone(before.sectorStates.buenos_aires.units.find(u=>Number(u.id)===id));let s=order(before,{type:'wait',hours:before.contracts[id].expiresAt-before.hour});assert.ok(!s.recruited.includes(id));assert.equal(s.contracts[id],undefined);s=saved({campaign:s}).campaign;assert.equal(s.contentPresence.people[`person-${id}`].recruited,false);assert.equal(s.contentPresence.people[`person-${id}`].alive,false);assert.equal(s.contentPresence.people[`person-${id}`].sector,null);assert.equal(s.operativeState[id].hp,0);assert.equal(s.operativeState[id].deathMinute,death);assert.deepEqual(s.sectorStates.buenos_aires.units.find(u=>Number(u.id)===id),corpse);assert.deepEqual(s.contentPresence.receipts,before.contentPresence.receipts);assert.deepEqual(s.contentPresence.events,before.contentPresence.events);
 s=order(s,{type:'recruitCivic',id:136,term:'week'});s=order(s,{type:'wait',hours:6});assert.deepEqual(saved({campaign:s}).campaign.recruited,[136]);assert.ok(dispatchCampaign(s,{type:'recruitCivic',id,term:'week'}).lastError);
});

test('removing a confirmed casualty from service clears only its roster presence and never restores its body',()=>{
 const {campaign:before,id}=paidCasualty(),cash=before.resources.treasury,death=before.operativeState[id].deathMinute;const s=order(before,{type:'dismiss',id});assert.equal(s.resources.treasury,cash);assert.equal(s.operativeState[id].deathMinute,death);assert.equal(s.operativeState[id].alive,false);assert.equal(saved({campaign:s}).campaign.contentPresence.people[`person-${id}`].recruited,false);assert.equal(s.sectorStates.buenos_aires.units.find(u=>Number(u.id)===id).hp,0);
});

test('older stale deceased-service flags can be repaired without accepting a living actor, health change or revived placement',()=>{
 const {campaign:before,id}=paidCasualty(),s=order(before,{type:'wait',hours:before.contracts[id].expiresAt-before.hour}),wire=JSON.parse(encodeSave(s));wire.campaign.contentPresence.people[`person-${id}`].recruited=true;const restored=decodeSave(JSON.stringify(wire));assert.equal(restored.campaign.contentPresence.people[`person-${id}`].recruited,false);assert.equal(restored.campaign.operativeState[id].hp,0);assert.equal(wire.campaign.contentPresence.people[`person-${id}`].recruited,true);
 for(const mutate of [p=>p.alive=true,p=>p.hp=1,p=>p.sector='cell-27-27']){const forged=structuredClone(wire);mutate(forged.campaign.contentPresence.people[`person-${id}`]);assert.throws(()=>decodeSave(JSON.stringify(forged)),/apariciones/);}
});
