import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {actBattle,inventoryMapPreview,endTurn,completedTacticalVictory} from '../game/tactical.js';
import {automaticOrder} from '../game/autonomous-orders.js';
import {enterSector} from '../game/world.js';
import {inventoryUsage,equipmentFingerprint} from '../game/tactical-inventory.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {approachNPC} from './approach-npc.mjs';

const npcId='local-retiro';
const order=(campaign,action)=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,next.lastError);return next;};
const sync=(campaign,battle)=>{const result=syncBattleTime(campaign,battle);assert.equal(result.error,null,result.error);return result;};

test('a later real defense keeps the NPC and exact poncho delivered during the previous visit',()=>{
 let campaign=initialCampaign(8);const originalCash=campaign.resources.treasury;
 campaign=order(campaign,{type:'recruitCivic',id:110,term:'week'});assert.ok(campaign.resources.treasury<originalCash);const originalPonchos=campaign.resources.ponchos;
 campaign=order(campaign,{type:'sectorInventory',sector:'retiro',operativeId:110,direction:'issueOutfit'});assert.equal(campaign.resources.ponchos,originalPonchos-1);
 campaign=order(campaign,{type:'visitSector'});let pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null,pair.error);
 pair=sync(pair.campaign,approachNPC(pair.battle,'110',npcId));
 const actor=pair.battle.units.find(u=>u.id==='110'),npc=pair.battle.npcs.find(n=>n.id===npcId),source=inventoryUsage(actor).slots.find(slot=>slot.entry?.kind==='outfit');assert.ok(source);
 const preview=inventoryMapPreview(pair.battle,actor,{type:'inventoryMap',unitId:actor.id,sourceId:source.id,expectedSource:equipmentFingerprint(actor,source.id),count:1,intent:'auto',x:npc.x,y:npc.y,tacticalLevel:npc.tacticalLevel??0,targetId:npcId});assert.equal(preview.valid,true,preview.reason);
 pair=sync(pair.campaign,actBattle(pair.battle,preview.action));
 const receipt=structuredClone(pair.battle.npcs.find(n=>n.id===npcId).questGifts);assert.equal(receipt.length,1);assert.equal(pair.campaign.conversations[npcId].giftCount,1);assert.equal(pair.campaign.quests['retiro-uniformes'].status,'offered');
 pair=decodeSave(encodeSave(pair.campaign,pair.battle));
 campaign=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 campaign=decodeSave(encodeSave(campaign)).campaign;assert.deepEqual(campaign.sectorStates.retiro.npcs.find(n=>n.id===npcId).questGifts,receipt);
 // Schedule a real finite enemy column, then use the ordinary encounter response.
 // No units, items, battle outcomes or deployment snapshots are manufactured.
 const group=launchEnemyGroup(campaign,'coast','retiro',{immediate:true});assert.ok(group);assert.equal(group.units.length,group.initialStrength);
 campaign=order(campaign,{type:'wait',hours:1});assert.equal(campaign.pendingEncounter.groupId,group.id);
 campaign=order(campaign,{type:'respondToEncounter',groupId:group.id,choice:'tactical'});assert.equal(campaign.pendingBattle.defenseGroupId,group.id);assert.ok(campaign.pendingBattle.npcs.some(n=>n.id===npcId));
 const previous=structuredClone(campaign.sectorStates.retiro);assert.ok(previous.npcs.some(n=>n.id==='cabral'&&n.operativeId===3));
 const explicit=enterSector({...campaign.pendingBattle,npcs:[]},previous);assert.deepEqual(explicit.npcs,[],'an explicit empty roster remains authoritative');assert.deepEqual(campaign.sectorStates.retiro,previous);
 const before=structuredClone(campaign);pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null,pair.error);assert.deepEqual(campaign,before);
 assert.ok(pair.battle.npcs.some(n=>n.id==='cabral'),'unrecruited residents stay in a defended town');
 const legacy=enterSector({...campaign.pendingBattle,npcs:undefined},previous);assert.equal(legacy.npcs.some(n=>n.operativeId!==undefined),false,'legacy omitted rosters cannot resurrect named recruits');
 assert.equal(pair.battle.npcs.filter(n=>n.id===npcId).length,1);assert.deepEqual(pair.battle.npcs.find(n=>n.id===npcId).questGifts,receipt);
 const explicitOwner=enterSector({...campaign.pendingBattle,npcs:[previous.npcs.find(n=>n.id===npcId)]},previous);assert.equal(explicitOwner.npcs.length,1);assert.deepEqual(explicitOwner.npcs[0].questGifts,receipt);
 assert.equal(pair.battle.units.filter(u=>u.side==='player'&&u.id==='110').length,1);assert.equal(pair.battle.units.filter(u=>u.side==='enemy').length,group.initialStrength);
 assert.equal(pair.campaign.conversations[npcId].giftCount,1);assert.equal(pair.campaign.resources.ponchos,originalPonchos-1);assert.deepEqual(pair.campaign.cityLoyaltyEvents,before.cityLoyaltyEvents);
 const saved=decodeSave(encodeSave(pair.campaign,pair.battle));assert.deepEqual(saved.battle.npcs.find(n=>n.id===npcId).questGifts,receipt);assert.deepEqual(sync(saved.campaign,saved.battle).campaign,saved.campaign);
 // Continue the saved defense through ordinary finite orders and enemy turns.
 // The fixture tests custody after the actual result, not a chosen casualty count.
 let battle=saved.battle,actions=0;
 for(let window=0;window<200&&battle.status==='active'&&!completedTacticalVictory(battle);window++){
  for(const id of battle.units.filter(u=>u.side==='player'&&!u.militia).map(u=>u.id))for(let attempt=0;attempt<16&&battle.status==='active'&&!completedTacticalVictory(battle);attempt++){
   const action=automaticOrder(battle,battle.units.find(u=>u.id===id));if(!action)break;const next=actBattle(battle,action);if(next.lastError)break;battle=next;actions++;
  }
  if(battle.status==='active'&&!completedTacticalVictory(battle)){const next=endTurn(battle);assert.equal(next.lastError,null,next.lastError);battle=next;}
 }
 const outcome=completedTacticalVictory(battle)?'victory':battle.status;assert.ok(['victory','defeat','retreat'].includes(outcome),`actual defense did not finish: ${outcome}`);assert.ok(actions>0);assert.ok(battle.elapsedSeconds>saved.battle.elapsedSeconds);
 pair=sync(saved.campaign,battle);campaign=order(pair.campaign,{type:'battleResult',battleId:pair.campaign.pendingBattle.id,outcome,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 assert.equal(campaign.pendingBattle,null);assert.deepEqual(campaign.sectorStates.retiro.npcs.find(n=>n.id===npcId).questGifts,receipt);assert.equal(campaign.conversations[npcId].giftCount,1);assert.equal(campaign.quests['retiro-uniformes'].status,'offered');assert.equal(campaign.cityLoyaltyEvents.filter(e=>e.id==='npc-retiro-uniformes'||e.eventId==='npc-retiro-uniformes').length,0);
 const returned=decodeSave(encodeSave(campaign)).campaign;assert.deepEqual(returned.sectorStates.retiro.npcs.find(n=>n.id===npcId).questGifts,receipt);assert.deepEqual(returned,campaign);
});
