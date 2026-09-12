import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {runOpeningCampaign} from './opening-campaign.mjs';
import {prepareNorthernSquad,prepareTucumanSquad,prepareRescueSquad,stabilizeRescued,fightNorthernSector} from './northern-route.mjs';

test('legal authored-map opening campaign wins San Nicolás then San Lorenzo',async t=>{
 const opening=runOpeningCampaign();let cordoba,tucumanLoss;
 await t.test('real San Lorenzo remains supply a local survivor after the completed mission',()=>{
  const start=opening.campaign,before=structuredClone(start),town=structuredClone(start.sectorStates.san_nicolas);
  const model=sectorInventoryModel(start,'san_lorenzo',rosterFor(start),1000);
  assert.equal(model.reason,null);
  const row=model.entries.find(r=>r.reachable&&JSON.parse(r.expected).item==='medkits');assert.ok(row);
  const action={type:'sectorInventory',sector:'san_lorenzo',operativeId:1000,direction:'take',sourceKey:row.key,expected:row.expected,count:1};
  const picked=dispatchCampaign(start,action);assert.equal(picked.lastError,null);
  assert.equal(picked.operativeState[1000].medkits,start.operativeState[1000].medkits+1);
  assert.deepEqual(picked.sectorStates.san_nicolas,town);assert.deepEqual(start,before);
  assert.equal(sectorInventoryModel(picked,'san_lorenzo',rosterFor(picked),1000).entries.some(r=>r.key===row.key),false);
  assert.ok(dispatchCampaign(picked,action).lastError);
  for(const id of opening.casualties)assert.equal(picked.operativeState[id].alive,false);
  assert.deepEqual(decodeSave(encodeSave(picked)).campaign,picked);
 });
 await t.test('survivors recover with finite supplies and paid replacements capture Córdoba',()=>{
  const before=structuredClone(opening.campaign),prepared=prepareNorthernSquad(opening.campaign);
  assert.deepEqual(opening.campaign,before);
  const result=fightNorthernSector(prepared.campaign,'cordoba');
  for(const id of opening.casualties)assert.equal(result.campaign.operativeState[id].alive,false);
  assert.equal(result.campaign.phase,2);assert.equal(result.campaign.completed,false);cordoba=result.campaign;
 });
 await t.test('paid recovery and renewals reach Tucumán; the actual defeat preserves deaths and captivity',()=>{
  assert.ok(cordoba);const before=structuredClone(cordoba),prepared=prepareTucumanSquad(cordoba);
  assert.deepEqual(cordoba,before);assert.equal(prepared.recovery.startHour,90);assert.equal(prepared.recovery.endHour,105);
  const result=fightNorthernSector(prepared.campaign,'tucuman',{expectedOutcome:'defeat'}),returned=result.campaign;
  assert.equal(result.summary.turns,5);assert.equal(result.summary.actions,80);
  assert.equal(returned.hour,117);assert.equal(returned.secondOfHour,341);
  for(const id of [...opening.casualties,1000,128])assert.equal(returned.operativeState[id].alive,false);
  for(const id of [115,112,142,105]){
   const record=returned.operativeState[id];assert.equal(record.alive,true);assert.equal(record.captured,true);assert.equal(record.capturedSector,'tucuman');
   assert.ok(!returned.recruited.includes(id));assert.ok(!returned.squads.some(squad=>squad.members.includes(id)));
   assert.ok(record.capturedContract);assert.equal(returned.contracts[id],undefined);
  }
  assert.equal(returned.operativeState[122].location,'cordoba');assert.equal(returned.operativeState[122].captured,false);
  assert.equal(returned.sectors.cordoba.owner,'patriot');assert.deepEqual(returned.squad,[]);
  assert.equal(returned.phase,2);assert.equal(returned.completed,false);assert.equal(returned.defeated,false);tucumanLoss=returned;
 });
 await t.test('reserves recapture the persistent garrison and stabilize the released captives with finite supplies',()=>{
  assert.ok(tucumanLoss);const before=structuredClone(tucumanLoss),prepared=prepareRescueSquad(tucumanLoss);
  assert.deepEqual(tucumanLoss,before);assert.equal(prepared.campaign.hour,129);
  const result=fightNorthernSector(prepared.campaign,'tucuman'),returned=result.campaign;
  assert.equal(result.summary.turns,4);assert.equal(result.summary.actions,86);
  assert.equal(returned.hour,141);assert.equal(returned.secondOfHour,365);
  for(const {id,record} of prepared.captives){
   const released=returned.operativeState[id];assert.equal(released.captured,false);assert.equal(released.hp,record.hp);assert.equal(released.bleeding,record.bleeding);
   assert.deepEqual(released.inventory,record.inventory);assert.equal(released.condition,record.condition);
   assert.deepEqual(released.capturedAmmunition,{loaded:0,ammo:0});assert.equal(released.capturedContract,null);
   assert.equal(returned.contracts[id].expiresAt,returned.hour+record.capturedContract.expiresAt-record.capturedAt);
  }
  const stable=stabilizeRescued(returned);assert.equal(stable.campaign.hour,142);
  for(const id of [...opening.casualties,1000,128])assert.equal(stable.campaign.operativeState[id].alive,false);
  assert.equal(stable.campaign.phase,2);assert.equal(stable.campaign.completed,false);
 });
});
