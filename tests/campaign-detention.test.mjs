import {applyHorseAction} from '../game/horses.js';
import {detentionManifest} from '../game/detention.js';
import {refreshMilitaryCondition} from '../game/actor-condition.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,restoreCampaign,serializeCampaign,rosterFor} from '../game/campaign.js';
import {launchEnemyGroup,queueEnemyEncounter} from '../game/enemy-groups.js';
import {actBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {syncBattleTime} from '../game/time.js';
import {runCivilianPhase} from '../game/npc-ai.js';
import {advanceCivilianBleeding,applyCivilianHarm} from '../game/civilian-harm.js';
import {encodeSave,decodeSave} from '../game/save.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
function captured({custodySupplies=0,sameSectorRescue=false,captiveEnergy=100,captureSecond=0}={}){
 let s=initialCampaign();if(captureSecond)s=order(s,{type:'advanceStrategicTime',seconds:captureSecond});s=order(s,{type:'recruitCivic',id:112,term:'week'});s.operativeState[112].location=s.location;s.operativeState[112].medkits=4; // Declared finite rescue dressings in the prepared detention scenario.
s=order(s,{type:'squad',ids:[3,4,10]});s.operativeState[112].location='buenos_aires';s.location='humahuaca';s.squads[0].location=s.location;s.sectors.humahuaca.owner='patriot';
 launchEnemyGroup(s,'north','humahuaca',{immediate:true});s=order(s,{type:'wait',hours:1});s=order(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'tactical'});
 let b=enterSector(s.pendingBattle);const u=b.units.find(u=>Number(u.id)===3);u.hp=11;u.energy=captiveEnergy;u.bleeding=2;u.bandaged=20;u.unconscious=true;u.stance='prone';u.movementMode='prone';
 for(const u of b.units.filter(u=>u.side==='player')){u.surrendered=true;u.ap=0;u.medkits=custodySupplies;refreshMilitaryCondition(u);}b.status='defeat';
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
test('capture settlement records seconds, validates them and admits earlier saves without that field',()=>{
 const campaign=captured({captureSecond:121});assert.equal(campaign.operativeState[3].capturedAtSecond,121);
 assert.deepEqual(restoreCampaign(serializeCampaign(campaign)),campaign);
 const invalid=structuredClone(campaign);invalid.operativeState[3].capturedAtSecond=3600;assert.throws(()=>restoreCampaign(serializeCampaign(invalid)),/prisionero/);
 const legacy=structuredClone(campaign);delete legacy.operativeState[3].capturedAtSecond;
 assert.equal(restoreCampaign(serializeCampaign(legacy)).operativeState[3].capturedAtSecond,undefined);
});
test('loaded prisoner breath recovery keeps campaign health and save receipts in agreement',()=>{
 let {campaign,battle}=start({captiveEnergy:30});
 const id=battle.npcs.find(n=>n.detention?.operativeId===3).id;
 const before=structuredClone(campaign.operativeState[3]);
 for(const expected of [40,50]){
  runCivilianPhase(battle);
  assert.equal(battle.npcs.find(n=>n.id===id).energy,expected);
  ({campaign,battle}=sync(campaign,battle));
  assert.equal(campaign.operativeState[3].energy,expected);
  assert.equal(campaign.detentionRecords[id].npc.energy,expected);
  for(const key of ['hp','bleeding','bandaged','captured','capturedAt','capturedSector'])assert.equal(campaign.operativeState[3][key],before[key]);
  const loaded=decodeSave(encodeSave(campaign,battle));
  assert.deepEqual(sync(loaded.campaign,loaded.battle).campaign,campaign);
  ({campaign,battle}=loaded);
 }
 const forged=structuredClone(battle);forged.npcs.find(n=>n.id===id).energy=101;
 assert.ok(syncBattleTime(campaign,forged).error);
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
 for(const u of battle.units.filter(u=>u.side==='enemy')){u.hp=0;u.bleeding=0;u.bandaged=0;refreshMilitaryCondition(u);}battle.status='victory';battle.sectorCleared=true;
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
 for(const u of battle.units.filter(u=>u.side==='enemy')){u.hp=0;u.bleeding=0;u.bandaged=0;refreshMilitaryCondition(u);}battle.status='victory';battle.sectorCleared=true;
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
 for(const u of battle.units.filter(u=>u.side==='enemy')){u.hp=0;u.bleeding=0;u.bandaged=0;refreshMilitaryCondition(u);}battle.status='victory';battle.sectorCleared=true;
 campaign=order(campaign,{type:'battleResult',battleId:battle.battleId,outcome:'victory',sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
 campaign=order(campaign,{type:'squad',ids:[112]});campaign=order(campaign,{type:'visitSector'});({campaign,battle}=prepareCampaignBattle(campaign));
 const body=battle.npcs.find(n=>n.id===id);assert.equal(body.hp,0);assert.equal(body.detention.freed,true);assert.notEqual(body.detentionRelease.battleId,battle.battleId);
 assert.equal(decodeSave(encodeSave(campaign,battle)).campaign.operativeState[3].alive,false);
});


function escapeAdjacentPrisoner(){
 let {campaign,battle}=freeAdjacentPrisoner();const npc=battle.npcs.find(n=>n.detention?.operativeId===3),leader=battle.units.find(u=>u.id==='112');
 // Explicit boundary positions isolate physical crossing and return settlement.
 const cells=battle.tiles.filter(t=>t.x===battle.width-1&&!t.blocked&&!battle.units.some(u=>u!==leader&&u.x===t.x&&u.y===t.y));
 const cell=cells.find(t=>cells.some(v=>v.y===t.y+1));assert.ok(cell);leader.x=cell.x;leader.y=cell.y;npc.x=cell.x;npc.y=cell.y+1;
 battle=actBattle(battle,{type:'exit',unitIds:['112'],exitId:'humahuaca:jujuy'});assert.equal(battle.lastError,null);assert.ok(battle.npcs.find(n=>n.id===npc.id).departure);return {campaign,battle,id:npc.id};
}
test('physical escape restores only the escaped prisoner and leaves finite equipment on the hostile map',()=>{
 let {campaign,battle,id}=escapeAdjacentPrisoner();
 // A retained captured horse isolates custody settlement without granting it to the escape.
 campaign.horseState=applyHorseAction(campaign.horseState,{type:'acquire',location:'humahuaca',funds:180});const horse=campaign.horseState.horses.at(-1);horse.custody={kind:'captured',sector:'humahuaca',operativeId:3};
 const before=structuredClone(campaign.operativeState[3]),cash=campaign.resources.treasury;
 ({campaign,battle}=sync(campaign,battle));assert.equal(campaign.operativeState[3].captured,true);assert.equal(decodeSave(encodeSave(campaign,battle)).battle.npcs.find(n=>n.id===id).departure.destination,'jujuy');
 campaign=order(campaign,{type:'battleResult',battleId:battle.battleId,outcome:'retreat',sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
 const r=campaign.operativeState[3],receipt=campaign.detentionRecords[id],field=campaign.sectorStates.humahuaca;
 assert.equal(r.captured,false);assert.equal(r.location,'jujuy');assert.equal(r.hp,before.hp);assert.equal(campaign.loadouts[3].weapon,0);assert.equal(campaign.loadouts[3].blade,0);assert.deepEqual(r.inventory,{});assert.equal(r.medkits,0);assert.equal(campaign.resources.treasury,cash);assert.equal(campaign.horseState.horses.at(-1).location,'humahuaca');assert.equal(campaign.horseState.horses.at(-1).assignedTo,null);assert.equal(campaign.horseState.horses.at(-1).custody.kind,'field');assert.equal(campaign.operativeState[4].captured,true);assert.equal(campaign.sectors.humahuaca.owner,'royalist');
 assert.equal(campaign.contracts[3].expiresAt,before.capturedContract.expiresAt===null?null:campaign.hour+before.capturedContract.expiresAt-before.capturedAt);assert.ok(campaign.recruited.includes(3));
 const cache=field.groundItems.filter(g=>receipt.escape.cacheIds.includes(g.id));assert.ok(cache.length);assert.equal(cache.find(g=>g.item==='medkits').count,before.medkits);assert.ok(cache.some(g=>g.item==='weapon'&&g.loaded===before.capturedAmmunition.loaded));
 assert.deepEqual(restoreCampaign(serializeCampaign(campaign)),campaign);
 const missing=structuredClone(campaign);delete missing.detentionRecords[id].escape;assert.throws(()=>restoreCampaign(serializeCampaign(missing)));
 const duplicate=dispatchCampaign(campaign,{type:'battleResult',battleId:battle.battleId,outcome:'retreat',sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});assert.ok(duplicate.lastError);assert.deepEqual(duplicate.sectorStates.humahuaca.groundItems,field.groundItems);
});

test('escape retains paid service time and refuses a destination occupied after deployment',()=>{
 let {campaign,battle}=escapeAdjacentPrisoner();const r=campaign.operativeState[3];r.capturedContract={kind:'paid',term:'week',started:r.capturedAt,expiresAt:r.capturedAt+6,paid:200};
 const occupied=structuredClone(campaign);occupied.sectors.jujuy.owner='royalist';
 const action={type:'battleResult',battleId:battle.battleId,outcome:'retreat',sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')};
 const rejected=dispatchCampaign(occupied,action);assert.ok(rejected.lastError);assert.equal(rejected.operativeState[3].captured,true);assert.equal(rejected.detentionRecords[Object.keys(rejected.detentionRecords)[0]]?.escape,undefined);
 campaign=order(campaign,action);assert.equal(campaign.contracts[3].expiresAt,campaign.hour+6);assert.deepEqual(restoreCampaign(serializeCampaign(campaign)),campaign);
});
test('a prisoner with an expired contract escapes without receiving free service',()=>{
 let {campaign,battle}=escapeAdjacentPrisoner();const r=campaign.operativeState[3];r.capturedContract={kind:'paid',term:'day',started:0,expiresAt:r.capturedAt,paid:20};
 campaign=order(campaign,{type:'battleResult',battleId:battle.battleId,outcome:'retreat',sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
 assert.equal(campaign.operativeState[3].captured,false);assert.equal(campaign.operativeState[3].location,'jujuy');assert.equal(campaign.recruited.includes(3),false);assert.equal(campaign.contracts[3],undefined);assert.deepEqual(restoreCampaign(serializeCampaign(campaign)),campaign);
});
test('equipment left by an escaped prisoner can be recovered once through ordinary field pickup',()=>{
 let {campaign,battle,id}=escapeAdjacentPrisoner();campaign=order(campaign,{type:'battleResult',battleId:battle.battleId,outcome:'retreat',sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
 const cacheIds=campaign.detentionRecords[id].escape.cacheIds;
 campaign=order(campaign,{type:'squad',ids:[112]});campaign=order(campaign,{type:'attack',sector:'humahuaca'});({campaign,battle}=prepareCampaignBattle(campaign));
 assert.ok(!battle.npcs.some(n=>n.id===id));const stack=battle.groundItems.find(g=>cacheIds.includes(g.id)&&g.item==='medkits'),leader=battle.units.find(u=>u.id==='112');assert.ok(stack);
 const tile=battle.tiles.find(t=>!t.blocked&&Math.abs(t.x-stack.x)+Math.abs(t.y-stack.y)===1&&!battle.units.some(u=>u.x===t.x&&u.y===t.y)&&!battle.npcs.some(n=>n.x===t.x&&n.y===t.y));assert.ok(tile);leader.x=tile.x;leader.y=tile.y;const before=leader.medkits;
 battle=actBattle(battle,{type:'lootBatch',unitId:'112',items:[{groundId:stack.id,count:1}]});assert.equal(battle.lastError,null);assert.equal(battle.units.find(u=>u.id==='112').medkits,before+1);assert.equal(battle.groundItems.find(g=>g.id===stack.id).count,stack.count-1);
 ({campaign,battle}=sync(campaign,battle));assert.deepEqual(decodeSave(encodeSave(campaign,battle)).battle.groundItems,battle.groundItems);
 const second=actBattle(battle,{type:'lootBatch',unitId:'112',items:[{groundId:stack.id,count:stack.count}]});assert.ok(second.lastError);
});
