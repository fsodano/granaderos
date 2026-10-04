import {withCarriedPonchos} from './custody-gear-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,restoreCampaign,serializeCampaign,hasPendingNpcGiftProgress} from '../game/campaign.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {actBattle,inventoryMapPreview} from '../game/tactical.js';
import {equipmentFingerprint,inventoryUsage} from '../game/tactical-inventory.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {approachNPC} from './approach-npc.mjs';
import {secureArea} from './secured-area-fixture.mjs';

const npcId='local-retiro',questId='retiro-uniformes';
const actor=b=>b.units.find(u=>u.id==='110'),recipient=b=>b.npcs.find(n=>n.id===npcId);
const order=(campaign,action)=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,next.lastError);return next;};
const sync=(campaign,battle)=>{const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null,pair.error);return pair;};
let prepared;
function ready(){
 if(!prepared){
  let campaign=initialCampaign(8);assert.deepEqual(campaign.squad,[]);const cash=campaign.resources.treasury;
  campaign=order(campaign,{type:'recruitCivic',id:110,term:'day'});assert.ok(campaign.resources.treasury<cash);
  const stock=campaign.merchants.retiro.supplies.ponchos;
  campaign=withCarriedPonchos(campaign,110,2);
  assert.equal(campaign.merchants.retiro.supplies.ponchos,stock);
  campaign=order(campaign,{type:'visitSector'});let pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);
  pair.battle=approachNPC(pair.battle,'110',npcId);prepared=sync(pair.campaign,pair.battle);
  assert.equal(prepared.campaign.quests[questId],undefined);assert.equal(recipient(prepared.battle).questGifts?.length??0,0);
 }
 return structuredClone(prepared);
}
function offer(battle,item='outfit'){
 const unit=actor(battle),npc=recipient(battle),slot=inventoryUsage(unit).slots.find(s=>item==='outfit'?s.entry?.kind==='outfit':s.entry?.item===item);
 assert.ok(slot,`real ${item} in a pocket`);
 const request={type:'inventoryMap',unitId:unit.id,sourceId:slot.id,expectedSource:equipmentFingerprint(unit,slot.id),count:1,x:npc.x,y:npc.y,tacticalLevel:npc.tacticalLevel??0,targetId:npc.id,intent:'auto'};
 const before=structuredClone(battle),preview=inventoryMapPreview(battle,unit,request);assert.equal(preview.valid,true,preview.reason);
 const next=actBattle(battle,preview.action);assert.equal(next.lastError,null,next.lastError);assert.deepEqual(battle,before);return next;
}
function save(pair){const restored=decodeSave(encodeSave(pair.campaign,pair.battle));assert.deepEqual(restored.campaign,pair.campaign);return restored;}
function talk(pair,approach='direct'){
 pair.battle=approachNPC(pair.battle,'110',npcId);pair=sync(pair.campaign,pair.battle);
 return {...pair,campaign:order(pair.campaign,{type:'talkNPC',npcId,unitId:110,approach,sectorState:pair.battle})};
}

test('paid recruit delivers real selected ponchos, implicitly starts the errand and completes it once without confirmation',()=>{
 let pair=ready();const before=structuredClone(pair.campaign),gun=actor(pair.battle).activeSlot;
 pair=save(sync(pair.campaign,offer(pair.battle)));
 assert.equal(pair.campaign.quests[questId].status,'offered');assert.equal(pair.campaign.conversations[npcId].giftCount,1);assert.equal(pair.campaign.conversations[npcId].lastApproach,'gift');assert.equal(pair.campaign.lastConversation.outcome,'questProgress');assert.match(pair.campaign.lastConversation.text,/1 de 2/);assert.ok(!pair.campaign.lastConversation.options.includes('quest'));assert.equal(actor(pair.battle).activeSlot,gun);
 assert.equal(pair.campaign.cityLoyaltyEvents.length,before.cityLoyaltyEvents.length);assert.equal(recipient(pair.battle).questGifts.length,1);
 pair=save(sync(pair.campaign,offer(pair.battle)));
 assert.equal(pair.campaign.quests[questId].status,'completed');assert.equal(pair.campaign.conversations[npcId].giftCount,2);assert.equal(pair.campaign.lastConversation.outcome,'questCompleted');assert.equal(recipient(pair.battle).questGifts.length,2);
 for(const sector of ['retiro','buenos_aires'])assert.equal(pair.campaign.sectors[sector].loyalty,before.sectors[sector].loyalty+8);assert.equal(pair.campaign.sectors.ensenada.loyalty,before.sectors.ensenada.loyalty);
 assert.equal(pair.campaign.cityLoyaltyEvents.filter(e=>e.id==='npc-retiro-uniformes'||e.eventId==='npc-retiro-uniformes').length,1);
 assert.deepEqual(pair.campaign.resources,before.resources);assert.deepEqual(pair.campaign.merchants,before.merchants);
 const again=sync(pair.campaign,pair.battle);assert.deepEqual(again.campaign,pair.campaign);
 const confirm=dispatchCampaign(pair.campaign,{type:'talkNPC',npcId,unitId:110,approach:'quest',sectorState:pair.battle});assert.ok(confirm.lastError);assert.deepEqual(confirm.cityLoyaltyEvents,pair.campaign.cityLoyaltyEvents);
});

test('ordinary replies after a gift survive repeated sync, full save, leave and reentry without resetting receipt counts',()=>{
 let pair=ready();pair=sync(pair.campaign,offer(pair.battle));pair=talk(pair);const reply=pair.campaign.lastConversation.text;
 assert.equal(pair.campaign.conversations[npcId].lastApproach,'direct');assert.equal(pair.campaign.conversations[npcId].giftCount,1);
 pair=save(sync(pair.campaign,pair.battle));assert.equal(pair.campaign.lastConversation.text,reply);assert.equal(pair.campaign.conversations[npcId].lastApproach,'direct');
 let campaign=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 campaign=decodeSave(encodeSave(campaign)).campaign;campaign=order(campaign,{type:'visitSector'});pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);pair=sync(pair.campaign,pair.battle);
 assert.equal(recipient(pair.battle).questGifts.length,1);assert.equal(pair.campaign.lastConversation.text,reply);assert.equal(pair.campaign.conversations[npcId].giftCount,1);
 pair.battle=approachNPC(pair.battle,'110',npcId);pair=sync(pair.campaign,offer(pair.battle));assert.equal(pair.campaign.quests[questId].status,'completed');
 pair=talk(pair);const complete=structuredClone(pair.campaign);pair=save(sync(pair.campaign,pair.battle));assert.deepEqual(pair.campaign,complete);
});

test('refused selected supplies create no physical receipt, offer, acknowledgement or reward',()=>{
 const pair=ready(),before=structuredClone(pair.campaign),after=offer(pair.battle,'medkits');assert.equal(recipient(after).questGifts?.length??0,0);
 const next=sync(pair.campaign,after);assert.equal(next.campaign.quests[questId],undefined);assert.equal(next.campaign.conversations[npcId],undefined);assert.deepEqual(next.campaign.cityLoyaltyEvents,before.cityLoyaltyEvents);assert.equal(actor(next.battle).medkits,actor(pair.battle).medkits);
});

test('invalid gift snapshots reject time and quest changes together and leave both inputs intact',()=>{
 const pair=ready(),gift=offer(pair.battle);
 for(const mutate of [
  b=>b.sectorId='buenos_aires',b=>b.sceneId='yatasto',b=>b.battleId='other',
  b=>b.units.splice(b.units.indexOf(actor(b)),1),b=>actor(b).id='foreign',
  b=>recipient(b).id='foreign',b=>recipient(b).questGifts[0].condition=-1,
  b=>recipient(b).questGifts.push({...recipient(b).questGifts[0]}, {...recipient(b).questGifts[0]}),
  b=>b.tiles[0].x=-1,b=>{recipient(b).questGifts[0].instanceId='duplicate-gift';actor(b).inventory.copy=structuredClone(recipient(b).questGifts[0]);},
 ]){
  const bad=structuredClone(gift);mutate(bad);const before=structuredClone(pair.campaign),copy=structuredClone(bad),result=syncBattleTime(pair.campaign,bad);
  assert.ok(result.error,String(mutate));assert.equal(result.campaign,pair.campaign);assert.equal(result.battle,bad);assert.deepEqual(pair.campaign,before);assert.deepEqual(bad,copy);
 }
 const mismatched=structuredClone(pair.campaign);mismatched.pendingBattle.npcs=mismatched.pendingBattle.npcs.filter(n=>n.id!==npcId);const result=syncBattleTime(mismatched,gift);assert.ok(result.error);assert.equal(result.campaign,mismatched);
});

test('acknowledgements reject invalid counts and cannot become a public gift dialogue action',()=>{
 let pair=ready();pair=sync(pair.campaign,offer(pair.battle));
 for(const count of [-1,1.5,3,'1',null]){const invalid=structuredClone(pair.campaign);invalid.conversations[npcId].giftCount=count;assert.throws(()=>restoreCampaign(serializeCampaign(invalid)));}
 for(const count of [0,2,3,'1',null]){const invalid=structuredClone(pair.campaign);invalid.lastConversation.giftCount=count;assert.throws(()=>restoreCampaign(serializeCampaign(invalid)));}
 const missing=structuredClone(pair.campaign);delete missing.conversations[npcId].giftCount;assert.throws(()=>restoreCampaign(serializeCampaign(missing)));
 const wrong=structuredClone(pair.campaign);wrong.conversations.cabral={...wrong.conversations[npcId]};assert.throws(()=>restoreCampaign(serializeCampaign(wrong)));
 const external=dispatchCampaign(pair.campaign,{type:'talkNPC',npcId,unitId:110,approach:'gift',sectorState:pair.battle});assert.ok(external.lastError);
 const stale=structuredClone(pair.battle);delete recipient(stale).questGifts;assert.ok(syncBattleTime(pair.campaign,stale).error);
 const cheap={...pair.battle};Object.defineProperty(cheap,'tiles',{get(){throw Error('ordinary acknowledgement check scanned the full map');}});assert.equal(hasPendingNpcGiftProgress(pair.campaign,cheap),false);
});

test('acknowledged physical gifts cannot disappear with an omitted recipient at sync, return or full-save admission',()=>{
 const pair=ready(),accepted=sync(pair.campaign,offer(pair.battle));
 for(const omit of [b=>b.npcs=b.npcs.filter(n=>n.id!==npcId),b=>b.npcs=[],b=>delete b.npcs]){
  const bad=structuredClone(accepted.battle);omit(bad);const campaignBefore=structuredClone(accepted.campaign),battleBefore=structuredClone(bad);
  const result=syncBattleTime(accepted.campaign,bad);assert.match(result.error,/Falta el interlocutor|Faltan habitantes/);assert.equal(result.campaign,accepted.campaign);assert.equal(result.battle,bad);
  for(const action of [
   {type:'syncTacticalTime',battleId:accepted.campaign.pendingBattle.id,elapsedSeconds:bad.elapsedSeconds,sectorState:bad},
   {type:'leaveSector',battleId:accepted.campaign.pendingBattle.id,sectorState:bad,survivors:bad.units.filter(u=>u.side==='player')},
  ]){
   const rejected=dispatchCampaign(accepted.campaign,action);assert.match(rejected.lastError,/Falta el interlocutor|Faltan habitantes/);
   const {lastError,...actual}=rejected,{lastError:previousError,...expected}=accepted.campaign;assert.deepEqual(actual,expected);
  }
  assert.throws(()=>decodeSave(encodeSave(accepted.campaign,bad)),/Falta el interlocutor|Faltan habitantes/);
  assert.deepEqual(accepted.campaign,campaignBefore);assert.deepEqual(bad,battleBefore);
 }
});

test('campaign-only saves retain acknowledged receipts in the stored sector while unrelated deployments need no local receiver',()=>{
 const pair=ready(),accepted=sync(pair.campaign,offer(pair.battle));
 const stopped=order(accepted.campaign,{type:'leaveSector',battleId:accepted.campaign.pendingBattle.id,sectorState:accepted.battle,survivors:accepted.battle.units.filter(u=>u.side==='player')});
 assert.equal(stopped.pendingBattle,null);assert.equal(stopped.sectorStates.retiro.npcs.find(n=>n.id===npcId).questGifts.length,1);
 assert.deepEqual(decodeSave(encodeSave(stopped)).campaign,stopped);
 for(const omit of [c=>c.sectorStates.retiro.npcs=c.sectorStates.retiro.npcs.filter(n=>n.id!==npcId),c=>c.sectorStates.retiro.npcs=[],c=>delete c.sectorStates.retiro]){
  const bad=structuredClone(stopped);omit(bad);const before=structuredClone(bad);
  assert.throws(()=>restoreCampaign(serializeCampaign(bad)),/Falta el interlocutor|Faltan habitantes/);
  assert.throws(()=>decodeSave(encodeSave(bad)),/Falta el interlocutor|Faltan habitantes/);assert.deepEqual(bad,before);
 }
 // The cheap deployment probe checks the actual sector, never distant NPCs.
 const elsewhere={...accepted.campaign,pendingBattle:{...accepted.campaign.pendingBattle,sector:'san_nicolas'}};
 const distant={npcs:[]};Object.defineProperty(distant,'tiles',{get(){throw Error('receipt check scanned unrelated map');}});
 assert.equal(hasPendingNpcGiftProgress(elsewhere,distant),false);
});

test('a physical gift saved before its campaign acknowledgement remains recoverable and syncs once',()=>{
 const pair=ready(),gift=offer(pair.battle);
 // The existing clock-only dispatcher can save elapsed time before receipt feedback.
 // Preserve its exact clock contract; do not manufacture items or acknowledgement.
 const campaign=order(pair.campaign,{type:'syncTacticalTime',battleId:pair.campaign.pendingBattle.id,elapsedSeconds:gift.elapsedSeconds});
 const battle={...gift,syncedSeconds:gift.elapsedSeconds,savedHour:campaign.hour,savedSecond:campaign.secondOfHour??0};
 assert.equal(campaign.conversations[npcId],undefined);assert.equal(recipient(battle).questGifts.length,1);assert.equal(hasPendingNpcGiftProgress(campaign,battle),true);
 const restored=decodeSave(encodeSave(campaign,battle));assert.equal(restored.campaign.conversations[npcId],undefined);assert.equal(recipient(restored.battle).questGifts.length,1);
 const acknowledged=sync(restored.campaign,restored.battle);assert.equal(acknowledged.campaign.conversations[npcId].giftCount,1);assert.equal(acknowledged.campaign.quests[questId].status,'offered');
 assert.deepEqual(sync(acknowledged.campaign,acknowledged.battle).campaign,acknowledged.campaign);
});

test('an omitted deployment NPC list admits only its existing nonrecruitable same-scene gift owner',()=>{
 let pair=ready();pair=sync(pair.campaign,offer(pair.battle));
 let campaign=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 campaign=order(campaign,{type:'visitSector'});pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);pair.battle=approachNPC(pair.battle,'110',npcId);pair=sync(pair.campaign,pair.battle);
 const gift=offer(pair.battle),oldReceipt=structuredClone(recipient(pair.battle).questGifts);
 // Isolate admission for the omitted-roster request format used by defenses.
 // Both physical gifts and the prior sector snapshot came from real actions.
 const absent=structuredClone(pair.campaign);delete absent.pendingBattle.npcs;
 const completed=sync(absent,gift);assert.equal(completed.campaign.conversations[npcId].giftCount,2);assert.equal(completed.campaign.quests[questId].status,'completed');assert.deepEqual(recipient(completed.battle).questGifts.slice(0,1),oldReceipt);
 assert.deepEqual(sync(completed.campaign,completed.battle).campaign,completed.campaign);
 for(const mutate of [
  c=>c.pendingBattle.npcs=[],c=>c.pendingBattle.npcs=null,
  c=>delete c.sectorStates.retiro,c=>c.sectorStates.retiro.sectorId='buenos_aires',c=>c.sectorStates.retiro.sceneId='yatasto',
  c=>c.sectorStates.retiro.npcs=c.sectorStates.retiro.npcs.filter(n=>n.id!==npcId),
  c=>recipient(c.sectorStates.retiro).operativeId=110,c=>delete recipient(c.sectorStates.retiro).questGifts,
  c=>recipient(c.sectorStates.retiro).questGifts=[],c=>recipient(c.sectorStates.retiro).questGifts[0].condition=-1,
 ]){
  const bad=structuredClone(absent);mutate(bad);const before=structuredClone(bad),result=syncBattleTime(bad,gift);
  assert.ok(result.error,String(mutate));assert.equal(result.campaign,bad);assert.equal(result.battle,gift);assert.deepEqual(bad,before);
 }
});

test('full receipts do not reward the errand after its required Retiro control has been lost',()=>{
 let pair=ready();pair.battle=offer(offer(pair.battle));pair.campaign.sectors.retiro.owner='royalist';pair=sync(pair.campaign,pair.battle);
 assert.equal(pair.campaign.quests[questId].status,'offered');assert.equal(pair.campaign.conversations[npcId].giftCount,2);assert.ok(!pair.campaign.cityLoyaltyEvents.some(e=>(e.id??e.eventId)==='npc-retiro-uniformes'));
 assert.equal(pair.campaign.defeated,true,'the original loss of the starting region still ends the campaign');
});

test('the secured post errand offers and pays its treasury reward through normal dialogue',()=>{
 let campaign=initialCampaign(8);campaign=order(campaign,{type:'recruitCivic',id:110,term:'week'});secureArea(campaign,['buenos_aires','ensenada','san_nicolas']);
 campaign=order(campaign,{type:'travel',sector:'san_nicolas'});campaign=order(campaign,{type:'visitSector'});let pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);
 pair.battle=approachNPC(pair.battle,'110','local-san_nicolas');pair=sync(pair.campaign,pair.battle);
 const talkPowder=()=>order(pair.campaign,{type:'talkNPC',npcId:'local-san_nicolas',unitId:110,approach:'quest',sectorState:pair.battle});
 const cash=pair.campaign.resources.treasury;pair.campaign=talkPowder();assert.equal(pair.campaign.quests['posta-polvora'].status,'offered');assert.ok(pair.campaign.lastConversation.options.includes('quest'));assert.equal(pair.campaign.resources.treasury,cash);
 pair.campaign=talkPowder();assert.equal(pair.campaign.quests['posta-polvora'].status,'completed');assert.equal(pair.campaign.resources.treasury,cash+200);assert.equal(pair.campaign.conversations['local-san_nicolas'].giftCount,undefined);
});
