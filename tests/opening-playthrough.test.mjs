import test from 'node:test';
import assert from 'node:assert/strict';
import {runOpeningCampaign} from './opening-campaign.mjs';
import {prepareNorthernSquad,fightNorthernSector} from './northern-route.mjs';

test('legal authored-map opening campaign wins San Nicolás then San Lorenzo',async t=>{
 const opening=runOpeningCampaign();
 await t.test('survivors recover with finite supplies and paid replacements capture Córdoba',()=>{
  const before=structuredClone(opening.campaign),prepared=prepareNorthernSquad(opening.campaign);
  assert.deepEqual(opening.campaign,before);
  const result=fightNorthernSector(prepared.campaign,'cordoba');
  for(const id of opening.casualties)assert.equal(result.campaign.operativeState[id].alive,false);
  assert.equal(result.campaign.phase,2);assert.equal(result.campaign.completed,false);
 });
});
