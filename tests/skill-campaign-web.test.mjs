import {MATURITY_HOURS} from '../game/horses.js';
import {assertTradeRejected} from './commerce-gear-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign as freshCampaign,dispatchCampaign,rosterFor,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {enterSector} from '../game/world.js';
import {defaultContentPackage} from '../game/content-package.js';
test('earned practice persists through sector return and is applied exactly once on re-entry',()=>{
 let s=initialCampaign();const base=rosterFor(s).find(o=>o.id===3).marksmanship;s=dispatchCampaign(s,{type:'visitSector'});const battle=enterSector(s.pendingBattle);const u=battle.units.find(u=>u.id==='3');u.trainedStats={marksmanship:1};u.skillPractice={marksmanship:5};u.marksmanship=base+1;
 s=dispatchCampaign(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:battle,survivors:battle.units.map(u=>({...u,id:Number(u.id)}))});assert.equal(s.lastError,null);assert.equal(rosterFor(s).find(o=>o.id===3).marksmanship,base+1);s=restoreCampaign(serializeCampaign(s));s=dispatchCampaign(s,{type:'visitSector'});assert.equal(s.pendingBattle.squad.find(o=>o.id===3).marksmanship,base+1);assert.deepEqual(s.pendingBattle.squad.find(o=>o.id===3).skillPractice,{marksmanship:5});
});
test('riding practice earned by moving persists without double applying its skill bonus',async()=>{
 const {actBattle}=await import('../game/tactical.js');
 const content=defaultContentPackage(),rider=content.characters.find(c=>c.id==='person-110');rider.arrivalHours=0;rider.ridingSkill=35;
 let s=dispatchCampaign(freshCampaign(8,content),{type:'recruitCivic',id:110,term:'month'});assert.equal(s.lastError,null);assertTradeRejected(s,{type:'horseAction',order:{type:'acquire',sex:'mare'}});
 // This isolated saved practice scenario already owns one unassigned mature mare.
 s.horseState.horses=[{id:'horse-1',name:'Mora',sex:'mare',location:'retiro',bornAt:s.hour-MATURITY_HOURS,stamina:100,condition:100,feed:7,assignedTo:null,hired:false,hireUntil:null,pregnantUntil:null}];s.horseState.nextId=2;
 s=dispatchCampaign(s,{type:'horseAction',order:{type:'assign',horseId:'horse-1',operativeId:110}});assert.equal(s.lastError,null);s.operativeState[110].skillPractice={ridingSkill:39};s.operativeState[110].practiceSeed=0;s=dispatchCampaign(s,{type:'visitSector'});let battle=enterSector(s.pendingBattle);const u=battle.units.find(u=>u.id==='110');
 battle=actBattle(battle,{type:'mount',unitId:u.id});assert.equal(battle.lastError,null);const start=u.ridingSkill;assert.ok(start>0&&start<100);
 const {getReachable}=await import('../game/tactical.js');const dest=getReachable(battle,u).find(p=>p.cost>0);assert.ok(dest);
 battle=actBattle(battle,{type:'move',unitId:u.id,x:dest.x,y:dest.y});assert.equal(battle.lastError,null);assert.equal(battle.units.find(v=>v.id===u.id).trainedStats.ridingSkill,1);
 s=dispatchCampaign(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:battle,survivors:battle.units.map(v=>({...v,id:Number(v.id)}))});assert.equal(s.lastError,null);
 s=restoreCampaign(serializeCampaign(s));s=dispatchCampaign(s,{type:'visitSector'});assert.equal(s.lastError,null);assert.equal(s.pendingBattle.squad.find(v=>v.id===110).ridingSkill,start+1);
});
