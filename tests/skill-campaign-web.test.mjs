import test from 'node:test';import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {enterSector} from '../game/world.js';
test('earned practice persists through sector return and is applied exactly once on re-entry',()=>{
 let s=initialCampaign();const base=rosterFor(s).find(o=>o.id===3).marksmanship;s=dispatchCampaign(s,{type:'visitSector'});const battle=enterSector(s.pendingBattle);const u=battle.units.find(u=>u.id==='3');u.trainedStats={marksmanship:1};u.skillPractice={marksmanship:5};u.marksmanship=base+1;
 s=dispatchCampaign(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:battle,survivors:battle.units.map(u=>({...u,id:Number(u.id)}))});assert.equal(s.lastError,null);assert.equal(rosterFor(s).find(o=>o.id===3).marksmanship,base+1);s=restoreCampaign(serializeCampaign(s));s=dispatchCampaign(s,{type:'visitSector'});assert.equal(s.pendingBattle.squad.find(o=>o.id===3).marksmanship,base+1);assert.deepEqual(s.pendingBattle.squad.find(o=>o.id===3).skillPractice,{marksmanship:5});
});
test('riding practice earned by moving persists without double applying its skill bonus',async()=>{
 const {actBattle}=await import('../game/tactical.js');
 let s=initialCampaign();s.operativeState[3].skillPractice={ridingSkill:39};s=dispatchCampaign(s,{type:'visitSector'});let battle=enterSector(s.pendingBattle);const u=battle.units.find(u=>u.id==='3');
 battle=actBattle(battle,{type:'mount',unitId:u.id});assert.equal(battle.lastError,null);const start=u.ridingSkill??0;
 const {getReachable}=await import('../game/tactical.js');const dest=getReachable(battle,u).find(p=>p.cost>0);assert.ok(dest);
 battle=actBattle(battle,{type:'move',unitId:u.id,x:dest.x,y:dest.y});assert.equal(battle.lastError,null);assert.equal(battle.units.find(v=>v.id===u.id).trainedStats.ridingSkill,1);
 s=dispatchCampaign(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:battle,survivors:battle.units.map(v=>({...v,id:Number(v.id)}))});assert.equal(s.lastError,null);
 s=restoreCampaign(serializeCampaign(s));s=dispatchCampaign(s,{type:'visitSector'});assert.equal(s.lastError,null);assert.equal(s.pendingBattle.squad.find(v=>v.id===3).ridingSkill,start+1);
});
