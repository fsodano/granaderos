import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {actBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {syncBattleTime} from '../game/time.js';
import {advanceCivilianBleeding} from '../game/civilian-harm.js';
import {encodeSave,decodeSave} from '../game/save.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
function captured(){
 let s=initialCampaign();s=order(s,{type:'recruitCivic',id:112,term:'week'});s.operativeState[112].location=s.location;s=order(s,{type:'purchaseMedicalSupplies',operativeId:112,quantity:2});s=order(s,{type:'squad',ids:[3,4,10]});s.operativeState[112].location='buenos_aires';s.location='humahuaca';s.squads[0].location=s.location;s.sectors.humahuaca.owner='patriot';
 launchEnemyGroup(s,'north','humahuaca',{immediate:true});s=order(s,{type:'wait',hours:1});s=order(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'tactical'});
 let b=enterSector(s.pendingBattle);const u=b.units.find(u=>Number(u.id)===3);u.hp=11;u.bleeding=2;u.bandaged=20;u.unconscious=true;u.stance='prone';u.movementMode='prone';
 for(const u of b.units.filter(u=>u.side==='player')){u.surrendered=true;u.ap=0;}b.status='defeat';
 s=order(s,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'defeat',sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
 for(const id of ['cordoba','tucuman','salta','jujuy'])s.sectors[id].owner='patriot';s.location='jujuy';s.squad=[112];s.squads[0].members=[112];s.squads[0].location=s.location;
 return order(s,{type:'attack',sector:'humahuaca'});
}
function start(){const next=prepareCampaignBattle(captured());assert.equal(next.error,null,next.error);return next;}
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
