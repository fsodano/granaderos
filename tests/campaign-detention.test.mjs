import {detentionManifest} from '../game/detention.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,restoreCampaign,serializeCampaign,rosterFor} from '../game/campaign.js';
import {launchEnemyGroup,queueEnemyEncounter} from '../game/enemy-groups.js';
import {actBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {syncBattleTime} from '../game/time.js';
import {advanceCivilianBleeding,applyCivilianHarm} from '../game/civilian-harm.js';
import {encodeSave,decodeSave} from '../game/save.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
function captured({custodySupplies=0,sameSectorRescue=false}={}){
 let s=initialCampaign();s=order(s,{type:'recruitCivic',id:112,term:'week'});s.operativeState[112].location=s.location;s=order(s,{type:'purchaseMedicalSupplies',operativeId:112,quantity:2});s=order(s,{type:'squad',ids:[3,4,10]});s.operativeState[112].location='buenos_aires';s.location='humahuaca';s.squads[0].location=s.location;s.sectors.humahuaca.owner='patriot';
 launchEnemyGroup(s,'north','humahuaca',{immediate:true});s=order(s,{type:'wait',hours:1});s=order(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'tactical'});
 let b=enterSector(s.pendingBattle);const u=b.units.find(u=>Number(u.id)===3);u.hp=11;u.bleeding=2;u.bandaged=20;u.unconscious=true;u.stance='prone';u.movementMode='prone';
 for(const u of b.units.filter(u=>u.side==='player')){u.surrendered=true;u.ap=0;u.medkits=custodySupplies;}b.status='defeat';
 s=order(s,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'defeat',sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
 for(const id of ['cordoba','tucuman','salta','jujuy'])s.sectors[id].owner='patriot';s.location=sameSectorRescue?'humahuaca':'jujuy';s.squad=[112];s.squads[0].members=[112];s.squads[0].location=s.location;
 return order(s,{type:'attack',sector:'humahuaca'});
}
function start(options){const next=prepareCampaignBattle(captured(options));assert.equal(next.error,null,next.error);return next;}
function sync(campaign,battle){const next=syncBattleTime(campaign,battle);assert.equal(next.error,null,next.error);return next;}
test('real capture deploys equipment-free prisoners and full saves retain wounds and custody',()=>{
 const {campaign,battle}=start(),n=battle.npcs.find(n=>n.detention?.operativeId===3);
 assert.ok(n);assert.equal(n.hp,11);assert.equal(n.bleeding,2);assert.equal(n.weapon,undefined);assert.equal(n.inventory,undefined);
 const restored=decodeSave(encodeSave(campaign,battle));assert.equal(restored.campaign.operativeState[3].hp,11);assert.deepEqual(restored.battle.npcs,battle.npcs);
 assert.deepEqual(restoreCampaign(serializeCampaign(campaign)),campaign);
});
test('prisoner bleeding settles once and a missing or impersonated prisoner rejects the whole report',()=>{
 let {campaign,battle}=start();const npc=battle.npcs.find(n=>n.detention?.operativeId===3);advanceCivilianBleeding(battle,npc,2);
 ({campaign,battle}=sync(campaign,battle));assert.equal(campaign.operativeState[3].hp,7);
 const again=sync(campaign,battle);assert.deepEqual(again.campaign,campaign);
 for(const alter of [b=>{b.npcs=b.npcs.filter(n=>n.id!==npc.id);},b=>{b.npcs.find(n=>n.id===npc.id).detention.capturedAt++;},b=>{b.npcs.find(n=>n.id===npc.id).hp++;}]){
  const forged=structuredClone(battle);alter(forged);const rejected=syncBattleTime(campaign,forged);assert.ok(rejected.error);assert.deepEqual(rejected.campaign,campaign);
 }
 assert.equal(decodeSave(encodeSave(campaign,battle)).campaign.operativeState[3].hp,7);
});
test('fatal bleeding clears live custody, remains dead on save, and grants no civilian loyalty reward',()=>{
 let {campaign,battle}=start();const npc=battle.npcs.find(n=>n.detention?.operativeId===3),events=structuredClone(campaign.cityLoyaltyEvents);
 advanceCivilianBleeding(battle,npc,6);({campaign,battle}=sync(campaign,battle));
 const r=campaign.operativeState[3];assert.equal(r.hp,0);assert.equal(r.alive,false);assert.equal(r.captured,false);assert.equal(r.capturedContract,null);assert.deepEqual(r.capturedAmmunition,{loaded:0,ammo:0});assert.deepEqual(campaign.cityLoyaltyEvents,events);
 assert.deepEqual(restoreCampaign(serializeCampaign(campaign)),campaign);assert.equal(decodeSave(encodeSave(campaign,battle)).campaign.operativeState[3].alive,false);
 const missing=structuredClone(campaign);delete missing.detentionRecords[npc.id];assert.throws(()=>restoreCampaign(serializeCampaign(missing)));
});

test('ordinary finite first aid updates captive health and keeps acknowledgement through reload',()=>{
 let {campaign,battle}=start();const npc=battle.npcs.find(n=>n.detention?.operativeId===3),medic=battle.units.find(u=>u.id==='112');
 // Isolate treatment settlement with adjacent valid map cells. This does not
 // prove the rescue squad can reach the guarded room in actual combat.
 const tile=battle.tiles.find(t=>!t.blocked&&Math.abs(t.x-npc.x)+Math.abs(t.y-npc.y)===1&&!battle.units.some(u=>u.x===t.x&&u.y===t.y)&&!battle.npcs.some(n=>n.x===t.x&&n.y===t.y));assert.ok(tile);
 medic.x=tile.x;medic.y=tile.y;medic.activeSlot='medical';const supplies=medic.medkits;
 battle=actBattle(battle,{type:'useItem',unitId:medic.id,targetKind:'npc',targetId:npc.id});assert.equal(battle.lastError,null,battle.lastError);
 assert.equal(battle.units.find(u=>u.id===medic.id).medkits,supplies-1);assert.equal(battle.npcs.find(n=>n.id===npc.id).hp,15);
 ({campaign,battle}=sync(campaign,battle));assert.equal(campaign.operativeState[3].hp,15);assert.equal(campaign.operativeState[3].bleeding,0);
 const loaded=decodeSave(encodeSave(campaign,battle));assert.deepEqual(sync(loaded.campaign,loaded.battle).campaign,campaign);
});

test('reentry keeps prisoner positions and wound acknowledgements without replacing them from old sector health',()=>{
 let {campaign,battle}=start();const npc=battle.npcs.find(n=>n.detention?.operativeId===3);advanceCivilianBleeding(battle,npc,2);
 ({campaign,battle}=sync(campaign,battle));
 // Rebuild the same validated deployment, as an encounter restoration does.
 const request=structuredClone(campaign.pendingBattle);
 request.detainedPrisoners=request.detainedPrisoners.map(n=>structuredClone(campaign.detentionRecords[n.id].npc));
 const restored=enterSector(request,battle),again=restored.npcs.find(n=>n.id===npc.id);
 assert.equal(again.hp,7);assert.equal(again.bleeding,2);assert.deepEqual([again.x,again.y],[npc.x,npc.y]);
 const forged=structuredClone(campaign);forged.pendingBattle.detainedPrisoners=[];assert.throws(()=>restoreCampaign(serializeCampaign(forged)));
});

test('sector victory releases only living prisoners and a later visit retains the dead body',()=>{
 let {campaign,battle}=start();const npc=battle.npcs.find(n=>n.detention?.operativeId===3);advanceCivilianBleeding(battle,npc,6);
 ({campaign,battle}=sync(campaign,battle));
 // Scripted victory isolates campaign custody settlement, not battle balance.
 for(const u of battle.units.filter(u=>u.side==='enemy')){u.hp=0;u.bleeding=0;u.bandaged=0;}battle.status='victory';battle.sectorCleared=true;
 campaign=order(campaign,{type:'battleResult',battleId:battle.battleId,outcome:'victory',sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
 assert.equal(campaign.operativeState[3].alive,false);assert.equal(campaign.recruited.includes(3),false);assert.equal(campaign.operativeState[4].captured,false);assert.ok(campaign.recruited.includes(4));
 campaign=order(campaign,{type:'squad',ids:[112]});campaign=order(campaign,{type:'visitSector'});({campaign,battle}=prepareCampaignBattle(campaign));
 const body=battle.npcs.find(n=>n.id===npc.id);assert.ok(body);assert.equal(body.hp,0);assert.equal(body.stance,'prone');
 assert.equal(decodeSave(encodeSave(campaign,battle)).campaign.operativeState[3].alive,false);
});

test('guards stabilize prisoners with finite confiscated dressings during elapsed campaign time',()=>{
 const campaign=captured({custodySupplies:2}),r=campaign.operativeState[3],receipt=campaign.detentionRecords[`captive:3:${r.capturedAt}`];
 assert.equal(r.hp,15);assert.equal(r.bleeding,0);assert.equal(r.captured,true);assert.equal(r.unconscious,false);
 assert.equal([3,4,10].reduce((n,id)=>n+campaign.operativeState[id].medkits,0),5);
 assert.equal(receipt.care.length,1);assert.equal(receipt.care[0].dressings,1);assert.equal(receipt.care[0].hpBefore,11);assert.equal(receipt.care[0].hpAfter,15);
 assert.ok(campaign.log.some(entry=>entry.text.includes('equipo incautado')));
 assert.deepEqual(restoreCampaign(serializeCampaign(campaign)),campaign);
 const {campaign:next,battle,error}=prepareCampaignBattle(campaign);assert.equal(error,null);assert.equal(battle.npcs.find(n=>n.detention?.operativeId===3).hp,15);
 assert.deepEqual(decodeSave(encodeSave(next,battle)).campaign,next);
 const forged=structuredClone(campaign);forged.detentionRecords[receipt.npc.id].care[0].dressings=0;assert.throws(()=>restoreCampaign(serializeCampaign(forged)));
});

function freeAdjacentPrisoner(){
 let {campaign,battle}=start({custodySupplies:2});const npc=battle.npcs.find(n=>n.detention?.operativeId===3),rescuer=battle.units.find(u=>u.id==='112');
 const tile=battle.tiles.find(t=>!t.blocked&&Math.abs(t.x-npc.x)+Math.abs(t.y-npc.y)===1&&!battle.units.some(u=>u.x===t.x&&u.y===t.y)&&!battle.npcs.some(n=>n.x===t.x&&n.y===t.y));assert.ok(tile);rescuer.x=tile.x;rescuer.y=tile.y;
 battle=actBattle(battle,{type:'free',unitId:rescuer.id,targetKind:'npc',targetId:npc.id});assert.equal(battle.lastError,null);return sync(campaign,battle);
}
test('freed restraints and escort persist while service, contract and equipment stay in custody',()=>{
 const {campaign,battle}=freeAdjacentPrisoner(),npc=battle.npcs.find(n=>n.detention?.operativeId===3),r=campaign.operativeState[3];
 assert.equal(npc.detention.freed,true);assert.equal(r.captured,true);assert.equal(campaign.recruited.includes(3),false);assert.equal(campaign.contracts[3],undefined);assert.ok(r.capturedContract);
 const loaded=decodeSave(encodeSave(campaign,battle));assert.deepEqual(loaded.battle.npcs,battle.npcs);assert.deepEqual(sync(loaded.campaign,loaded.battle).campaign,campaign);
 const forged=structuredClone(battle);delete forged.npcs.find(n=>n.id===npc.id).detentionRelease;assert.ok(syncBattleTime(campaign,forged).error);
});
test('an unsuccessful relief attempt restores detention and retains the paid release attempt',()=>{
 let {campaign,battle}=freeAdjacentPrisoner();const id=battle.npcs.find(n=>n.detention?.operativeId===3).id;
 for(const u of battle.units.filter(u=>u.side==='player')){u.surrendered=true;u.ap=0;}battle.status='defeat';
 campaign=order(campaign,{type:'battleResult',battleId:battle.battleId,outcome:'defeat',sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
 const receipt=campaign.detentionRecords[id];assert.equal(receipt.npc.detention.freed,false);assert.equal(receipt.npc.escort,undefined);assert.equal(receipt.npc.detentionRelease,undefined);assert.equal(receipt.releaseAttempts.length,1);assert.equal(receipt.releaseAttempts[0].outcome,'recaptured');assert.equal(campaign.operativeState[3].captured,true);
 assert.deepEqual(restoreCampaign(serializeCampaign(campaign)),campaign);
});

test('two actual captures in the same hour receive distinct identities and cannot reuse old custody health',()=>{
 let campaign=captured({sameSectorRescue:true}),battle=enterSector(campaign.pendingBattle,campaign.sectorStates.humahuaca);
 const first=battle.npcs.find(n=>n.detention?.operativeId===3);assert.equal(campaign.operativeState[3].capturedAt,campaign.hour);
 for(const u of battle.units.filter(u=>u.side==='enemy')){u.hp=0;u.bleeding=0;u.bandaged=0;}battle.status='victory';battle.sectorCleared=true;
 campaign=order(campaign,{type:'battleResult',battleId:battle.battleId,outcome:'victory',sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
 assert.equal(campaign.operativeState[3].captured,false);
 launchEnemyGroup(campaign,'north','humahuaca',{immediate:true});queueEnemyEncounter(campaign);
 campaign=order(campaign,{type:'respondToEncounter',groupId:campaign.pendingEncounter.groupId,choice:'tactical'});battle=enterSector(campaign.pendingBattle,campaign.sectorStates.humahuaca);
 for(const u of battle.units.filter(u=>u.side==='player')){u.surrendered=true;u.ap=0;}battle.status='defeat';
 campaign=order(campaign,{type:'battleResult',battleId:battle.battleId,outcome:'defeat',sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
 const record=campaign.operativeState[3],second=detentionManifest(campaign,rosterFor(campaign),'humahuaca').find(n=>n.detention.operativeId===3);
 assert.equal(record.captureSequence,2);assert.equal(record.capturedAt,first.detention.capturedAt);assert.notEqual(second.id,first.id);assert.equal(second.detention.captureSequence,2);assert.equal(second.detention.freed,false);assert.equal(second.detentionRelease,undefined);
 assert.deepEqual(restoreCampaign(serializeCampaign(campaign)),campaign);
});

test('prisoner wait and follow orders survive full saves and cannot lose acknowledged history',()=>{
 let {campaign,battle}=freeAdjacentPrisoner();const id=battle.npcs.find(n=>n.detention?.operativeId===3).id;
 for(const escortOrder of ['wait','follow']){
  battle=actBattle(battle,{type:'prisonerEscort',unitId:'112',targetKind:'npc',targetId:id,escortOrder});assert.equal(battle.lastError,null);
  ({campaign,battle}=sync(campaign,battle));const saved=decodeSave(encodeSave(campaign,battle));assert.deepEqual(saved.battle.npcs,battle.npcs);
 }
 const forged=structuredClone(battle),npc=forged.npcs.find(n=>n.id===id);delete npc.detentionOrders;
 assert.ok(syncBattleTime(campaign,forged).error);
});


test('a freed prisoner who dies remains dead with the release history on later sector entry',()=>{
 let {campaign,battle}=freeAdjacentPrisoner();const npc=battle.npcs.find(n=>n.detention?.operativeId===3),id=npc.id;
 applyCivilianHarm(battle,npc,{source:battle.units.find(u=>u.side==='enemy'),damage:npc.hp});({campaign,battle}=sync(campaign,battle));
 assert.equal(campaign.operativeState[3].alive,false);
 // Scripted victory tests body custody and reentry, not rescue battle balance.
 for(const u of battle.units.filter(u=>u.side==='enemy')){u.hp=0;u.bleeding=0;u.bandaged=0;}battle.status='victory';battle.sectorCleared=true;
 campaign=order(campaign,{type:'battleResult',battleId:battle.battleId,outcome:'victory',sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
 campaign=order(campaign,{type:'squad',ids:[112]});campaign=order(campaign,{type:'visitSector'});({campaign,battle}=prepareCampaignBattle(campaign));
 const body=battle.npcs.find(n=>n.id===id);assert.equal(body.hp,0);assert.equal(body.detention.freed,true);assert.notEqual(body.detentionRelease.battleId,battle.battleId);
 assert.equal(decodeSave(encodeSave(campaign,battle)).campaign.operativeState[3].alive,false);
});
