import test from 'node:test';
import {applyCivilianHarm} from '../game/civilian-harm.js';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {actBattle,getNpcGiftResult} from '../game/tactical.js';
import {equipmentFingerprint,inventoryUsage} from '../game/tactical-inventory.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {validateQuestGifts} from '../game/quests.js';
import {approachNPC} from './approach-npc.mjs';
import {secureArea} from './secured-area-fixture.mjs';
const npcId='local-tucuman',questId='tucuman-vendas';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
function ready(){
 // Established-sector fixture isolates delivery. It is not campaign-route evidence.
 let campaign=secureArea(initialCampaign(8),['tucuman']);
 campaign=order(campaign,{type:'recruitCivic',id:112,term:'week'});
 campaign.operativeState[112].medkits=7; // Declared carried stock for this isolated delivery scenario.
 campaign.location='tucuman';campaign.squads.find(s=>s.id===campaign.activeSquadId).location='tucuman';campaign.operativeState[112].location='tucuman';
 campaign=decodeSave(encodeSave(campaign)).campaign;
 campaign=order(campaign,{type:'visitSector'});let pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);
 pair.battle=approachNPC(pair.battle,'112',npcId);return sync(pair);
}
function sync(pair){const next=syncBattleTime(pair.campaign,pair.battle);assert.equal(next.error,null,next.error);return decodeSave(encodeSave(next.campaign,next.battle));}
function offer(pair,count,item='medkits'){
 const b=pair.battle,u=b.units.find(u=>u.id==='112'),npc=b.npcs.find(n=>n.id===npcId),slot=inventoryUsage(u).slots.find(s=>s.entry?.item===item&&s.entry.count>=count);
 assert.ok(slot,'the selected quantity is physically carried');
 const battle=actBattle(b,{type:'inventoryMap',unitId:u.id,sourceId:slot.id,expectedSource:equipmentFingerprint(u,slot.id),count,intent:'auto',x:npc.x,y:npc.y,tacticalLevel:npc.tacticalLevel??0,targetId:npc.id});
 assert.equal(battle.lastError,null,battle.lastError);return {pair:sync({...pair,battle}),result:getNpcGiftResult(b,battle)};
}
test('selected finite dressings persist as partial delivery, complete once and survive reentry',()=>{
 let pair=ready();const before=structuredClone(pair),initial=pair.battle.units.find(u=>u.id==='112').medkits;
 let attempt=offer(pair,1);assert.equal(attempt.result.status,'accepted');pair=attempt.pair;
 assert.equal(pair.campaign.quests[questId].status,'offered');assert.equal(pair.campaign.conversations[npcId].giftCount,1);
 assert.equal(pair.battle.units.find(u=>u.id==='112').medkits,initial-1);
 const rejected=offer(pair,3);assert.equal(rejected.result.status,'refused');assert.equal(rejected.pair.battle.units.find(u=>u.id==='112').medkits,initial-1);
 attempt=offer(rejected.pair,2);assert.equal(attempt.result.status,'accepted');pair=attempt.pair;
 assert.equal(pair.campaign.quests[questId].status,'completed');assert.equal(pair.campaign.conversations[npcId].giftCount,3);
 assert.equal(pair.battle.units.find(u=>u.id==='112').medkits,initial-3);assert.equal(pair.campaign.resources.treasury,before.campaign.resources.treasury);
 const events=structuredClone(pair.campaign.cityLoyaltyEvents);assert.equal(events.length,before.campaign.cityLoyaltyEvents.length+1);
 const repeated=offer(pair,1);assert.equal(repeated.result.status,'refused');assert.deepEqual(repeated.pair.campaign.cityLoyaltyEvents,events);pair=repeated.pair;
 let campaign=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 campaign=decodeSave(encodeSave(campaign)).campaign;campaign=order(campaign,{type:'visitSector'});pair=prepareCampaignBattle(campaign);
 assert.equal(pair.battle.npcs.find(n=>n.id===npcId).questGifts.length,3);assert.deepEqual(pair.campaign.cityLoyaltyEvents,events);
});
test('wrong supplies and forged receipt quantities cannot fulfill the medical errand',()=>{
 const pair=ready(),refused=offer(pair,1,'rations');assert.equal(refused.result.status,'refused');assert.equal(refused.pair.campaign.quests[questId],undefined);
 for(const gift of [{item:'medkits',count:2,weight:.2},{item:'rations',count:1,weight:.2},{item:'medkits',count:1,weight:0},{item:'medkits',count:1,weight:.2,weapon:1800}])assert.throws(()=>validateQuestGifts({id:npcId,questGifts:[gift]}));
});

test('contact death preserves delivered supplies and permanently fails only the unfinished medical errand',()=>{
 for(const count of [1,3]){
  let pair=offer(ready(),count).pair;
  const gifts=structuredClone(pair.battle.npcs.find(n=>n.id===npcId).questGifts),remaining=pair.battle.units.find(u=>u.id==='112').medkits;
  const earned=pair.campaign.cityLoyaltyEvents.filter(e=>e.kind==='quest');
  applyCivilianHarm(pair.battle,pair.battle.npcs.find(n=>n.id===npcId),{source:pair.battle.units.find(u=>u.id==='112'),damage:100,breathLoss:0,intentional:true});
  pair=sync(pair);
  assert.equal(pair.campaign.quests[questId].status,count===3?'completed':'failed');
  assert.deepEqual(pair.battle.npcs.find(n=>n.id===npcId).questGifts,gifts);
  assert.equal(pair.battle.units.find(u=>u.id==='112').medkits,remaining);
  assert.deepEqual(pair.campaign.cityLoyaltyEvents.filter(e=>e.kind==='quest'),earned);
  const duplicate=sync(pair);assert.deepEqual(duplicate.campaign.quests,pair.campaign.quests);assert.deepEqual(duplicate.campaign.log,pair.campaign.log);
  const invalid=structuredClone(pair);invalid.battle.npcs.find(n=>n.id===npcId).questGifts=[];
  assert.throws(()=>decodeSave(encodeSave(invalid.campaign,invalid.battle)));
  const denied=dispatchCampaign(pair.campaign,{type:'talkNPC',npcId,unitId:112,approach:'quest',sectorState:pair.battle});
  assert.ok(denied.lastError);assert.deepEqual(denied.quests,pair.campaign.quests);
 }
});
