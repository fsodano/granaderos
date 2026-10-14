import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {actBattle,presentedActBattle} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {expandCellScene} from '../game/cell-scene-storage.js';
import {itemQuantity} from '../game/tactical-inventory.js';
import {stabilizeCreatedCuyoSurvivors} from './created-cuyo-route.mjs';
import {visit,leave} from './local-contract-fixture.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const saved=c=>decodeSave(encodeSave(c)).campaign;
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const person=(b,id)=>b.units.find(unit=>unit.id===String(id));

function declaredSelfAid(dropped){
 let c=initialCampaign(42);
 for(const id of [130,100]){
  const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day');assert.ok(quote.available,quote.reason);
  const cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'day'});assert.equal(c.resources.treasury,cash-quote.total);
 }
 c=order(c,{type:'wait',hours:6});assert.ok([130,100].every(id=>c.recruited.includes(id)));
 c=order(c,{type:'createSquad',name:'Socorro declarado',ids:[130,100],sector:'retiro'});
 let pair=visit(c);
 if(dropped){
  const battle=actBattle(pair.battle,{type:'drop',unitId:'130',item:'primary',count:1});assert.equal(battle.lastError,null);
  const next=syncBattleTime(pair.campaign,battle);assert.equal(next.error,null);pair={campaign:next.campaign,battle:next.battle};
  assert.equal(person(pair.battle,130).weaponDropped,true);assert.equal(person(pair.battle,130).activeSlot,'blade');
 }
 assert.equal(itemQuantity(person(pair.battle,130),'primary'),dropped?0:1);
 c=leave(pair);
 // Fresh declared clinical input, before official admission and the helper's
 // real visit. The primary loss is the actual paid drop above. The nominal
 // prior primary hand models a valid stale hand after loss; it grants no gun.
 const declared=structuredClone(c);Object.assign(declared.operativeState[130],{hp:55,bleeding:2,bandaged:0,activeSlot:'primary'});
 c=saved(declared);assert.equal(Boolean(c.operativeState[130].weaponDropped),dropped);assert.equal(c.operativeState[130].activeSlot,'primary');
 assert.equal(c.operativeState[130].medkits,2);assert.ok(contractExpiresSeconds(c.contracts[130])>clock(c)+3600);
 return c;
}

function verifySelfAid(dropped){
 const start=declaredSelfAid(dropped),before=structuredClone(start),events=[];
 const campaign=stabilizeCreatedCuyoSurvivors(start,{report:event=>events.push(event)}),aid=events.find(event=>event.event==='createdCuyoFieldAid');
 assert.ok(aid);assert.equal(aid.doctor,130);assert.deepEqual(aid.patients,[130]);assert.equal(aid.officialMidpoint,true);
 assert.equal(aid.steps.filter(action=>action.type==='useItem').length,1);assert.ok(aid.steps.some(action=>action.type==='useItem'&&action.unitId==='130'&&action.targetId==='130'));
 const returns=aid.steps.filter(action=>action.type==='weapon'&&action.slot==='primary');assert.equal(returns.length,dropped?0:1);
 assert.equal(campaign.operativeState[130].activeSlot,dropped?'medical':'primary');assert.equal(Boolean(campaign.operativeState[130].weaponDropped),dropped);
 assert.equal(campaign.operativeState[130].medkits,start.operativeState[130].medkits-1);assert.equal(campaign.operativeState[130].bleeding,0);
 assert.ok(campaign.operativeState[130].hp>=15&&campaign.operativeState[130].hp<=start.operativeState[130].hp,'finite noncritical aid does not replace the wound');
 assert.equal(campaign.resources.treasury,start.resources.treasury);assert.deepEqual(campaign.contracts,start.contracts);assert.deepEqual(campaign.loadouts,start.loadouts);
 for(const id of start.recruited){
  assert.equal(campaign.operativeState[id].alive,start.operativeState[id].alive);assert.ok(campaign.recruited.includes(id));
  for(const key of ['maxHp','inventory','ammo','ammoStock','carriedLoaded','weaponDropped','condition','primaryWeapon','bladeWeapon','weaponMetadata','weaponInstanceId','outfit','headwear','legwear'])assert.deepEqual(campaign.operativeState[id][key],start.operativeState[id][key],`${id}: ${key}`);
  if(id!==130){assert.equal(campaign.operativeState[id].hp,start.operativeState[id].hp);assert.equal(campaign.operativeState[id].medkits,start.operativeState[id].medkits);}
 }
 const oldScene=expandCellScene(start.sectorStates.retiro),newScene=expandCellScene(campaign.sectorStates.retiro);
 assert.deepEqual(newScene.droppedWeapons,oldScene.droppedWeapons,'aid does not recover or replace the actual dropped weapon');
 assert.deepEqual(newScene.groundItems,oldScene.groundItems);assert.deepEqual(campaign.artilleryDepots,start.artilleryDepots);assert.deepEqual(campaign.artilleryTransfers,start.artilleryTransfers);
 assert.ok(clock(campaign)>clock(start));assert.equal(campaign.pendingBattle,null);assert.equal(campaign.pendingEncounter,null);
 // Independently replay every emitted finite care step with presentation,
 // JSON/official saves and the actual strategic prelude/restoration orders.
 const restore=aid.orders.findIndex(action=>['assignToSquad','selectSquad'].includes(action.type));assert.ok(restore>=2);
 let replay=saved(start);for(const action of aid.orders.slice(0,restore))replay=order(replay,action);
 let pair=visit(replay);
 for(const action of aid.steps){
  const input=structuredClone(pair),battle=actBattle(pair.battle,action);assert.equal(battle.lastError,null);
  assert.deepEqual(presentedActBattle(pair.battle,action).state,battle);assert.deepEqual(pair,input);
  const next=syncBattleTime(pair.campaign,battle);assert.equal(next.error,null);pair=decodeSave(encodeSave(next.campaign,next.battle));
 }
 assert.equal(itemQuantity(person(pair.battle,130),'primary'),dropped?0:1);
 replay=leave(pair);for(const action of aid.orders.slice(restore))replay=order(replay,action);
 assert.deepEqual(saved(replay),campaign);assert.deepEqual(saved(campaign),campaign);assert.deepEqual(start,before);
}

test('finite self-aid leaves the Native medical hand when the nominal primary was actually dropped',()=>{
 verifySelfAid(true);
});

test('finite self-aid restores an intact actual primary through the ordinary paid Native hand order',()=>{
 verifySelfAid(false);
});
