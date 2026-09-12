import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {runOpeningCampaign} from './opening-campaign.mjs';
import {prepareNorthernSquad,fightNorthernSector} from './northern-route.mjs';

test('legal authored-map opening campaign wins San Nicolás then San Lorenzo',async t=>{
 const opening=runOpeningCampaign();
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
  assert.equal(result.campaign.phase,2);assert.equal(result.campaign.completed,false);
 });
});
