import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {actBattle,inventoryMapPreview} from '../game/tactical.js';
import {equipmentFingerprint,inventoryUsage,handRecord} from '../game/tactical-inventory.js';
import {heldItemIds} from '../game/weapon-fittings.js';
import {spacePoint,sameCell,tacticalLevel} from '../game/tactical-space.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';

const actor=(battle,id='110')=>battle.units.find(unit=>unit.id===id);
const order=(campaign,action)=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const act=(battle,action)=>{const next=actBattle(battle,{unitId:'110',...action});assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const partitions=(unit,item)=>Object.fromEntries(inventoryUsage(unit).slots.filter(slot=>slot.entry?.item===item).map(slot=>[slot.id,slot.entry.count]));
const medicalTotal=battle=>battle.units.reduce((sum,unit)=>sum+unit.medkits,0)+battle.groundItems.filter(item=>item.item==='medkits').reduce((sum,item)=>sum+item.count,0);
const identityCount=(battle,id)=>battle.units.reduce((sum,unit)=>sum+heldItemIds(unit).filter(value=>value===id).length,0)+battle.groundItems.filter(item=>item.instanceId===id).reduce((sum,item)=>sum+item.count,0);
function synced(campaign,battle){const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null);return pair;}
function saved(campaign,battle){
 const pair=synced(campaign,battle),restored=decodeSave(encodeSave(pair.campaign,pair.battle));
 assert.deepEqual(restored.campaign,pair.campaign);assert.deepEqual(restored.battle,pair.battle);return restored;
}
function revisit(campaign,battle){
 const pair=synced(campaign,battle);
 campaign=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(unit=>unit.side==='player')});
 assert.equal(campaign.pendingBattle,null);
 const restored=decodeSave(encodeSave(campaign));assert.deepEqual(restored.campaign,campaign);
 campaign=order(restored.campaign,{type:'visitSector'});
 const entered=prepareCampaignBattle(campaign);assert.equal(entered.error,null);return entered;
}
function start(){
 let campaign=initialCampaign(8);assert.deepEqual(campaign.squad,[]);
 const cash=campaign.resources.treasury;
 for(const id of [110,131])campaign=order(campaign,{type:'recruitCivic',id,term:'day'});
 assert.ok(campaign.resources.treasury<cash);assert.deepEqual(campaign.squad,[110,131]);
 const hireCash=campaign.resources.treasury;
 campaign=order(campaign,{type:'purchaseMedicalSupplies',operativeId:110,quantity:3});
 campaign=order(campaign,{type:'purchaseEquipment',item:'1811:india_socket',quantity:1});
 assert.ok(campaign.resources.treasury<hireCash);
 const purchased=campaign.armoryItems.find(item=>item.fittingPattern==='india_socket');assert.ok(purchased?.instanceId);
 campaign=order(campaign,{type:'equip',operativeId:110,slot:'blade',itemId:'1811:india_socket',instanceId:purchased.id});
 const personal=()=>sectorInventoryModel(campaign,'retiro',rosterFor(campaign),110).personal;
 const arrange=(item,destinationId,count)=>{
  const unit=personal(),sourceId=inventoryUsage(unit).slots.find(slot=>slot.entry?.item===item).id,before=structuredClone(campaign);
  campaign=order(campaign,{type:'sectorInventory',sector:'retiro',operativeId:110,direction:'arrange',kind:'equipment',sourceId,destinationId,count,expectedSource:equipmentFingerprint(unit,sourceId),expectedDestination:equipmentFingerprint(unit,destinationId)});
  for(const key of ['hour','secondOfHour','resources','seed','sectorStates'])assert.deepEqual(campaign[key],before[key]);
  return sourceId;
 };
 assert.equal(personal().medkits,5);
 const source=arrange('medkits','large-4',2);arrange('torches','large-3',1);
 const medical=partitions(personal(),'medkits'),torches=partitions(personal(),'torches');
 assert.deepEqual(medical,{'large-4':2,[source]:3});
 campaign=order(campaign,{type:'visitSector'});const pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);
 const {battle}=pair;campaign=pair.campaign;
 assert.equal(campaign.location,'retiro');assert.equal(battle.width,64);assert.equal(battle.height,48);assert.equal(battle.mode,'exploration');assert.equal(battle.status,'active');
 assert.deepEqual(Object.entries(campaign.sectors).filter(([,sector])=>sector.owner==='patriot').map(([id])=>id),['retiro']);
 assert.deepEqual(partitions(actor(battle),'medkits'),medical);assert.deepEqual(partitions(actor(battle),'torches'),torches);assert.equal(medicalTotal(battle),7);
 assert.equal(actor(battle).bladeInstanceId,purchased.instanceId);assert.equal(identityCount(battle,purchased.instanceId),1);
 return {campaign,battle,source,torches,purchased};
}
function mapOrder(battle,sourceId,count,point,intent='ground',targetId){
 const unit=actor(battle),request={sourceId,expectedSource:equipmentFingerprint(unit,sourceId),count,...spacePoint(point),intent,...(targetId?{targetId}:{})};
 const before=structuredClone(battle),preview=inventoryMapPreview(battle,unit,request);
 assert.equal(preview.valid,true,preview.reason);assert.deepEqual(battle,before);assert.equal(preview.pa,0);assert.equal(preview.totalPA,0);
 const next=act(battle,preview.action);
 assert.deepEqual(battle,before);assert.ok(next.elapsedSeconds>battle.elapsedSeconds);assert.equal(next.mode,'exploration');assert.equal(next.status,'active');
 for(const person of battle.units){const after=actor(next,person.id);assert.ok(sameCell(after,person));for(const key of ['ap','hp','ammo','loaded'])assert.equal(after[key],person[key],key);}
 return {battle:next,preview,request};
}

test('a paid campaign map drop consumes only the selected partial pocket and survives repeated save/reentry',()=>{
 let {campaign,battle,source,torches}=start();
 const dropped=mapOrder(battle,'large-4',1,actor(battle));battle=dropped.battle;
 assert.equal(dropped.preview.kind,'drop');assert.equal(dropped.preview.action.tacticalLevel,0);
 assert.deepEqual(partitions(actor(battle),'medkits'),{'large-4':1,[source]:3});assert.deepEqual(partitions(actor(battle),'torches'),torches);assert.equal(medicalTotal(battle),7);
 const pile=battle.groundItems.find(item=>item.item==='medkits');assert.ok(pile);
 assert.deepEqual(pile,{item:'medkits',count:1,weight:.2,id:pile.id,type:'item',...spacePoint(actor(battle)),knownToPlayer:true});
 ({campaign,battle}=saved(campaign,battle));
 const stale={type:'inventoryMap',...dropped.request};assert.equal(inventoryMapPreview(battle,actor(battle),stale).valid,false);
 const rejected=actBattle(battle,{unitId:'110',...stale});assert.ok(rejected.lastError);
 for(const key of ['units','groundItems','elapsedSeconds','seed'])assert.deepEqual(rejected[key],battle[key]);
 const position=spacePoint(actor(battle));
 for(let visit=0;visit<2;visit++){
  ({campaign,battle}=revisit(campaign,battle));
  assert.deepEqual(spacePoint(actor(battle)),position);assert.equal(new Set(battle.units.map(unit=>unit.id)).size,battle.units.length);
  assert.deepEqual(partitions(actor(battle),'medkits'),{'large-4':1,[source]:3});assert.deepEqual(partitions(actor(battle),'torches'),torches);
  assert.deepEqual(battle.groundItems.find(item=>item.id===pile.id),pile);assert.equal(medicalTotal(battle),7);
  assert.equal(campaign.operativeState[110].medkits,4);assert.equal(campaign.operativeState[131].medkits,2);
 }
});

test('a canonical selected-pocket gift replays after save and explicit ground intent does not give its remaining item',()=>{
 let {campaign,battle,source,torches}=start();const recipient=actor(battle,'131');
 const before=saved(campaign,battle),given=mapOrder(battle,'large-4',1,recipient,'auto',recipient.id);
 assert.equal(given.preview.kind,'give');assert.deepEqual(given.preview.action.transferRoute,['110','131']);
 assert.deepEqual(act(before.battle,given.preview.action),given.battle,'resuming executes the same canonical give without a second copy');
 battle=given.battle;assert.equal(actor(battle).medkits,4);assert.equal(actor(battle,'131').medkits,3);assert.deepEqual(battle.groundItems,before.battle.groundItems);
 assert.deepEqual(partitions(actor(battle),'medkits'),{'large-4':1,[source]:3});assert.deepEqual(partitions(actor(battle),'torches'),torches);
 const ground=mapOrder(battle,'large-4',1,actor(battle,'131'),'ground','131');battle=ground.battle;
 assert.equal(ground.preview.kind,'drop');assert.equal(ground.preview.action.targetId,undefined);assert.deepEqual(ground.preview.action.transferRoute,[]);
 assert.deepEqual(partitions(actor(battle),'medkits'),{[source]:3});assert.equal(actor(battle,'131').medkits,3);assert.equal(medicalTotal(battle),7);
 const pile=battle.groundItems.find(item=>item.item==='medkits');assert.equal(pile.count,1);assert.ok(sameCell(pile,actor(battle,'131')));assert.equal(tacticalLevel(pile),0);
 ({campaign,battle}=saved(campaign,battle));({campaign,battle}=revisit(campaign,battle));
 assert.equal(actor(battle).medkits,3);assert.equal(actor(battle,'131').medkits,3);assert.equal(medicalTotal(battle),7);
 assert.deepEqual(partitions(actor(battle),'medkits'),{[source]:3});assert.deepEqual(partitions(actor(battle),'torches'),torches);assert.deepEqual(battle.groundItems.find(item=>item.id===pile.id),pile);
});

test('a purchased bayonet keeps its identity and metadata through map drop, campaign custody and real recovery',()=>{
 let {campaign,battle,source,torches,purchased}=start();const unit=actor(battle),record=handRecord(unit,'blade');
 const sourceId=inventoryUsage(unit).slots.find(slot=>slot.entry?.item==='blade').id;
 const dropped=mapOrder(battle,sourceId,1,unit);battle=dropped.battle;
 assert.equal(dropped.preview.kind,'drop');assert.equal(actor(battle).blade??0,0);assert.equal(identityCount(battle,purchased.instanceId),1);
 const pile=battle.groundItems.find(item=>item.instanceId===purchased.instanceId);assert.ok(pile);
 assert.deepEqual(pile,{item:'weapon',...record,id:pile.id,type:'item',...spacePoint(unit),knownToPlayer:true});
 assert.equal(pile.fittingPattern,'india_socket');assert.equal(pile.condition,purchased.condition);
 ({campaign,battle}=saved(campaign,battle));({campaign,battle}=revisit(campaign,battle));
 assert.equal(campaign.loadouts[110].blade,0);assert.equal(actor(battle).blade??0,0);assert.equal(identityCount(battle,purchased.instanceId),1);
 assert.deepEqual(battle.groundItems.find(item=>item.id===pile.id),pile);
 assert.deepEqual(partitions(actor(battle),'medkits'),{'large-4':2,[source]:3});assert.deepEqual(partitions(actor(battle),'torches'),torches);
 battle=act(battle,{type:'loot',groundId:pile.id,count:1});const key=Object.keys(actor(battle).inventory).find(key=>actor(battle).inventory[key].instanceId===purchased.instanceId);assert.ok(key);
 battle=act(battle,{type:'equipLoot',inventoryKey:key,slot:'blade'});
 assert.deepEqual(handRecord(actor(battle),'blade'),record);assert.equal(battle.groundItems.find(item=>item.id===pile.id).count,0);assert.equal(identityCount(battle,purchased.instanceId),1);
 ({campaign,battle}=saved(campaign,battle));({campaign,battle}=revisit(campaign,battle));
 assert.equal(campaign.loadouts[110].blade,1811);assert.equal(campaign.operativeState[110].bladeInstanceId,purchased.instanceId);
 assert.deepEqual(handRecord(actor(battle),'blade'),record);assert.equal(identityCount(battle,purchased.instanceId),1);assert.equal(medicalTotal(battle),7);
});
