import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {actBattle,getReachable,knifeThrowPreview} from '../game/tactical.js';
import {heldThrowingKnife,KNIFE_THROW} from '../game/thrown-knife.js';
import {sameCell,spacePoint,tacticalLevel} from '../game/tactical-space.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';

const actor=battle=>battle.units.find(unit=>unit.id==='128');
const order=(campaign,action)=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const act=(battle,action)=>{const next=actBattle(battle,{unitId:'128',...action});assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const sync=(campaign,battle)=>{const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null);return pair;};
const knifeStacks=battle=>battle.groundItems.filter(item=>item.weapon===1813&&item.count>0);
function knifeCount(battle){
 return battle.units.reduce((total,unit)=>total+Number(unit.blade===1813)+Number(unit.weapon===1813&&!unit.weaponDropped)+(unit.offHand?.weapon===1813?unit.offHand.count:0)+Object.values(unit.inventory??{}).reduce((sum,item)=>sum+(item.weapon===1813?item.count:0),0),0)+knifeStacks(battle).reduce((sum,item)=>sum+item.count,0);
}
function start(){
 let campaign=initialCampaign(45);
 assert.deepEqual(campaign.squad,[]);assert.equal(campaign.location,'retiro');
 const treasury=campaign.resources.treasury;
 campaign=order(campaign,{type:'recruitCivic',id:128,term:'day'});
 assert.ok(campaign.resources.treasury<treasury);assert.deepEqual(campaign.squad,[128]);
 const hireBalance=campaign.resources.treasury;
 campaign=order(campaign,{type:'purchaseEquipment',item:1813,quantity:1});
 assert.ok(campaign.resources.treasury<hireBalance);assert.equal(campaign.armory[1813],1);
 const purchased=campaign.armoryItems.find(item=>item.item===1813);assert.ok(purchased);
 campaign=order(campaign,{type:'equip',operativeId:128,slot:'blade',itemId:1813,instanceId:purchased.id});
 assert.equal(campaign.armory[1813],0);assert.ok(!campaign.armoryItems.some(item=>item.id===purchased.id));
 campaign=order(campaign,{type:'visitSector'});
 const pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);
 let battle=pair.battle;campaign=pair.campaign;
 assert.equal(battle.width,64);assert.equal(battle.height,48);assert.equal(battle.mode,'exploration');assert.equal(battle.status,'active');
 assert.deepEqual(Object.entries(campaign.sectors).filter(([,sector])=>sector.owner==='patriot').map(([id])=>id),['retiro']);
 const before=actor(battle);assert.equal(before.activeSlot,'primary');assert.equal(before.blade,1813);
 battle=act(battle,{type:'weapon',slot:'blade'});
 const held=heldThrowingKnife(actor(battle));assert.equal(held.slot,'blade');assert.equal(held.record.weapon,1813);assert.equal(held.record.condition,purchased.condition);
 assert.equal(held.record.instanceId,purchased.instanceId);
 assert.equal(actor(battle).ap,before.ap);assert.equal(knifeCount(battle),1);
 return {campaign,battle,record:structuredClone(held.record)};
}
function assertExactKnife(stack,record){
 assert.equal(stack.weapon,1813);assert.equal(stack.count,1);
 assert.deepEqual(Object.fromEntries(Object.keys(record).map(key=>[key,stack[key]])),record);
 // Newly bought facones have no persistent instanceId. Preserve that contract
 // instead of injecting a test identity; the ground ledger supplies its own ID.
 assert.equal(Object.hasOwn(stack,'instanceId'),Object.hasOwn(record,'instanceId'));
}
function throwToGround(battle,record){
 const unit=actor(battle),target=getReachable(battle,unit).filter(point=>point.path.length===2).map(spacePoint).find(point=>{
  const preview=knifeThrowPreview(battle,unit,point,{aim:2,hitLocation:'torso'});
  return preview.valid&&!preview.flight.blocked&&!preview.flight.victimId;
 });
 assert.ok(target,'the real Retiro deployment has a reachable clear ground target');
 const before=structuredClone(battle),next=act(battle,{type:'throwKnife',...target,aim:2,hitLocation:'torso'});
 assert.deepEqual(battle,before);assert.equal(actor(next).ap,unit.ap);assert.equal(actor(next).energy,unit.energy-KNIFE_THROW.energy);
 assert.ok(next.elapsedSeconds>battle.elapsedSeconds);assert.ok(sameCell(actor(next),unit));
 assert.equal(actor(next).blade??0,0);assert.equal(actor(next).activeSlot,'unarmed');assert.equal(heldThrowingKnife(actor(next)),null);
 assert.equal(actor(next).ammo,unit.ammo);assert.equal(actor(next).loaded,unit.loaded);assert.equal(actor(next).hp,unit.hp);
 assert.equal(next.mode,'exploration');assert.equal(next.status,'active');assert.equal(knifeCount(next),1);
 const [pile]=knifeStacks(next);assert.ok(pile);assertExactKnife(pile,record);assert.equal(tacticalLevel(pile),0);assert.ok(pile.id);
 return {battle:next,pile};
}
function leave(campaign,battle){
 const pair=sync(campaign,battle);
 return order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(unit=>unit.side==='player')});
}
function reenter(campaign){
 campaign=order(campaign,{type:'visitSector'});const pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);return pair;
}

test('a paid recruit throws a purchased facon at real Retiro ground and resumes the exact finite pickup transaction',()=>{
 let {campaign,battle,record}=start();const thrown=throwToGround(battle,record);battle=thrown.battle;
 ({campaign,battle}=sync(campaign,battle));
 const saved=decodeSave(encodeSave(campaign,battle));assert.deepEqual(saved.campaign,campaign);assert.deepEqual(saved.battle,battle);
 assert.deepEqual(saved.battle.groundItems.find(item=>item.id===thrown.pile.id),thrown.pile);
 const rejected=actBattle(saved.battle,{type:'throwKnife',unitId:'128',x:thrown.pile.x,y:thrown.pile.y,tacticalLevel:0});
 assert.ok(rejected.lastError);assert.deepEqual(rejected.units,saved.battle.units);assert.deepEqual(rejected.groundItems,saved.battle.groundItems);assert.equal(rejected.elapsedSeconds,saved.battle.elapsedSeconds);
 const action={type:'loot',groundId:thrown.pile.id,count:1},expected=act(battle,action),resumed=act(saved.battle,action);
 assert.deepEqual(resumed,expected,'save/resume retains the next actual approach, item transfer, energy and clock');
 assert.equal(resumed.groundItems.find(item=>item.id===thrown.pile.id).count,0);assert.equal(knifeCount(resumed),1);
 const recovered=Object.values(actor(resumed).inventory).find(item=>item.weapon===1813);assertExactKnife(recovered,record);
 assert.equal(actor(resumed).blade??0,0);assert.equal(actor(resumed).ap,actor(battle).ap);assert.ok(resumed.elapsedSeconds>battle.elapsedSeconds);
 assert.ok(Math.max(Math.abs(actor(resumed).x-thrown.pile.x),Math.abs(actor(resumed).y-thrown.pile.y))<=1);
});

test('campaign returns never reissue the thrown blade and its actual recovery permits exactly one further throw',()=>{
 let {campaign,battle,record}=start();const thrown=throwToGround(battle,record);battle=thrown.battle;
 const position=spacePoint(actor(battle));
 for(let visit=0;visit<2;visit++){
  campaign=leave(campaign,battle);assert.equal(campaign.pendingBattle,null);assert.equal(campaign.loadouts[128].blade,0);assert.equal(campaign.armory[1813],0);
  assert.deepEqual(campaign.sectorStates.retiro.groundItems.find(item=>item.id===thrown.pile.id),thrown.pile);
  const saved=decodeSave(encodeSave(campaign));assert.deepEqual(saved.campaign,campaign);campaign=saved.campaign;
  ({campaign,battle}=reenter(campaign));
  assert.equal(actor(battle).blade??0,0);assert.equal(heldThrowingKnife(actor(battle)),null);assert.equal(actor(battle).activeSlot,'unarmed');
  assert.deepEqual(spacePoint(actor(battle)),position);assert.equal(new Set(battle.units.map(unit=>unit.id)).size,battle.units.length);
  assert.deepEqual(battle.groundItems.find(item=>item.id===thrown.pile.id),thrown.pile);assert.equal(knifeCount(battle),1);
 }
 battle=act(battle,{type:'loot',groundId:thrown.pile.id,count:1});
 const key=Object.keys(actor(battle).inventory).find(key=>actor(battle).inventory[key].weapon===1813);assert.ok(key);
 battle=act(battle,{type:'equipLoot',inventoryKey:key,slot:'blade'});
 assert.equal(heldThrowingKnife(actor(battle)).slot,'blade');assert.deepEqual(heldThrowingKnife(actor(battle)).record,record);assert.equal(knifeCount(battle),1);
 assert.ok(!actor(battle).inventory[key],'equipping transfers the recovered stack out of the backpack');
 const second=throwToGround(battle,record);battle=second.battle;
 assert.notEqual(second.pile.id,thrown.pile.id);assert.equal(battle.groundItems.find(item=>item.id===thrown.pile.id).count,0);
 campaign=leave(campaign,battle);campaign=decodeSave(encodeSave(campaign)).campaign;
 assert.equal(campaign.loadouts[128].blade,0);assert.equal(campaign.armory[1813],0);
 ({campaign,battle}=reenter(campaign));
 assert.equal(actor(battle).blade??0,0);assert.equal(knifeCount(battle),1);assert.deepEqual(battle.groundItems.find(item=>item.id===second.pile.id),second.pile);
 const saved=decodeSave(encodeSave(campaign,battle));assert.deepEqual(saved.battle,battle);
});
