import test from 'node:test';import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {enterSector} from '../game/world.js';
test('earned practice persists through sector return and is applied exactly once on re-entry',()=>{
 let s=initialCampaign();const base=rosterFor(s).find(o=>o.id===3).marksmanship;s=dispatchCampaign(s,{type:'visitSector'});const battle=enterSector(s.pendingBattle);const u=battle.units.find(u=>u.id==='3');u.trainedStats={marksmanship:1};u.skillPractice={marksmanship:5};u.marksmanship=base+1;
 s=dispatchCampaign(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:battle,survivors:battle.units.map(u=>({...u,id:Number(u.id)}))});assert.equal(s.lastError,null);assert.equal(rosterFor(s).find(o=>o.id===3).marksmanship,base+1);s=restoreCampaign(serializeCampaign(s));s=dispatchCampaign(s,{type:'visitSector'});assert.equal(s.pendingBattle.squad.find(o=>o.id===3).marksmanship,base+1);assert.deepEqual(s.pendingBattle.squad.find(o=>o.id===3).skillPractice,{marksmanship:5});
});
