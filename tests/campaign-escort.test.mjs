import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {applyQuestEscortOrders,validateQuestEscortOrders} from '../game/quest-escort.js';
import {actBattle,getReachable} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {approachNPC} from './approach-npc.mjs';
import {secureArea} from './secured-area-fixture.mjs';
import {applyCivilianHarm} from '../game/civilian-harm.js';
const npcId='local-jujuy',questId='jujuy-arriero';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const sync=pair=>{const next=syncBattleTime(pair.campaign,pair.battle);assert.equal(next.error,null,next.error);return decodeSave(encodeSave(next.campaign,next.battle));};
function ready(extraLeader=false){
 // Established-sector setup isolates escort interaction, not campaign conquest.
 let campaign=secureArea(initialCampaign(8),['jujuy','humahuaca']);campaign=order(campaign,{type:'recruitCivic',id:112,term:'week'});
 if(extraLeader)campaign=order(campaign,{type:'recruitCivic',id:122,term:'week'});
 campaign.location='jujuy';campaign.squads.find(q=>q.id===campaign.activeSquadId).location='jujuy';for(const id of campaign.recruited)campaign.operativeState[id].location='jujuy';
 campaign=order(campaign,{type:'visitSector'});let pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);
 pair.battle=approachNPC(pair.battle,'112',npcId);return sync(pair);
}
function talk(pair,approach,unitId=112){
 const campaign=order(pair.campaign,{type:'talkNPC',npcId,unitId,approach,sectorState:pair.battle});
 return sync({campaign,battle:applyQuestEscortOrders(campaign,pair.battle)});
}
function walk(pair,point){const battle=actBattle(pair.battle,{type:'move',unitId:'112',x:point.x,y:point.y});assert.equal(battle.lastError,null,battle.lastError);return sync({...pair,battle});}
function wait(pair){const battle=actBattle(pair.battle,{type:'rest'});assert.equal(battle.lastError,null,battle.lastError);return sync({...pair,battle});}
test('accepted escort follows real movement, waits locally, reaches the exit and rewards once through full saves',()=>{
 let pair=talk(ready(),'quest');const start=structuredClone(pair.battle.npcs.find(n=>n.id===npcId));
 assert.deepEqual(pair.campaign.quests[questId].escortOrder,{leaderId:'112',waiting:false});
 const premature=dispatchCampaign(pair.campaign,{type:'talkNPC',npcId,unitId:112,approach:'quest',sectorState:pair.battle});assert.ok(premature.lastError);assert.equal(premature.quests[questId].status,'offered');
 pair=talk(pair,'escortWait');assert.equal(pair.battle.npcs.find(n=>n.id===npcId).escort.waiting,true);
 pair=wait(pair);assert.deepEqual([pair.battle.npcs.find(n=>n.id===npcId).x,pair.battle.npcs.find(n=>n.id===npcId).y],[start.x,start.y]);
 pair=talk(pair,'escortFollow');
 const leader=pair.battle.units.find(u=>u.id==='112'),dest=getReachable(pair.battle,leader).filter(p=>p.x===0).sort((a,b)=>a.cost-b.cost)[0];assert.ok(dest);
 pair=walk(pair,dest);pair=wait(pair);
 const npc=pair.battle.npcs.find(n=>n.id===npcId),unit=pair.battle.units.find(u=>u.id==='112');
 assert.ok(Math.abs(unit.x-npc.x)+Math.abs(unit.y-npc.y)<=1);assert.ok(npc.x!==start.x||npc.y!==start.y);
 const cash=pair.campaign.resources.treasury,events=pair.campaign.cityLoyaltyEvents.length;
 const blocked=structuredClone(pair.campaign);blocked.sectors.humahuaca.owner='royalist';const unsafe=dispatchCampaign(blocked,{type:'talkNPC',npcId,unitId:112,approach:'quest',sectorState:pair.battle});assert.ok(unsafe.lastError);assert.equal(unsafe.quests[questId].status,'offered');
 pair=talk(pair,'quest');assert.equal(pair.campaign.quests[questId].status,'completed');assert.equal(pair.campaign.resources.treasury,cash);assert.equal(pair.campaign.cityLoyaltyEvents.length,events+1);assert.equal(pair.battle.npcs.find(n=>n.id===npcId).escort.waiting,true);
 const denied=dispatchCampaign(pair.campaign,{type:'talkNPC',npcId,unitId:112,approach:'quest',sectorState:pair.battle});assert.ok(denied.lastError);assert.equal(denied.cityLoyaltyEvents.length,events+1);
 let campaign=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});campaign=decodeSave(encodeSave(campaign)).campaign;campaign=order(campaign,{type:'visitSector'});pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);assert.equal(pair.campaign.quests[questId].status,'completed');assert.equal(pair.battle.npcs.find(n=>n.id===npcId).escort.waiting,true);
});
test('escort death permanently fails the accepted quest and saved directives cannot be forged',()=>{
 let pair=talk(ready(),'quest');
 for(const patch of [{leaderId:'999',waiting:false},{leaderId:'112',waiting:true}]){const invalid=structuredClone(pair);invalid.battle.npcs.find(n=>n.id===npcId).escort=patch;assert.throws(()=>decodeSave(encodeSave(invalid.campaign,invalid.battle)));}
 const missing=structuredClone(pair);missing.battle.npcs=[];assert.throws(()=>decodeSave(encodeSave(missing.campaign,missing.battle)));
 const unknown=structuredClone(pair.battle);unknown.npcs.find(n=>n.id===npcId).id='unknown-escort';assert.throws(()=>validateQuestEscortOrders(pair.campaign,unknown));
 applyCivilianHarm(pair.battle,pair.battle.npcs.find(n=>n.id===npcId),{source:pair.battle.units.find(u=>u.id==='112'),damage:100,breathLoss:0,intentional:true});pair=sync(pair);
 assert.equal(pair.campaign.quests[questId].status,'failed');assert.equal(pair.battle.npcs.find(n=>n.id===npcId).escort.waiting,true);assert.equal(pair.campaign.cityLoyaltyEvents.filter(e=>e.kind==='quest').length,0);
});

test('leadership changes require a present adjacent speaker and retain the escort position',()=>{
 let pair=talk(ready(true),'quest');
 pair.battle=approachNPC(pair.battle,'122',npcId);pair=sync(pair);
 const before=structuredClone(pair.battle.npcs.find(n=>n.id===npcId));pair=talk(pair,'escortFollow',122);
 const after=pair.battle.npcs.find(n=>n.id===npcId);assert.equal(after.escort.leaderId,'122');assert.deepEqual([after.x,after.y],[before.x,before.y]);
 const invalid=structuredClone(pair);invalid.battle.units.find(u=>u.id==='112').x=50;
 const rejected=dispatchCampaign(invalid.campaign,{type:'talkNPC',npcId,unitId:112,approach:'escortFollow',sectorState:invalid.battle});assert.ok(rejected.lastError);assert.equal(rejected.quests[questId].escortOrder.leaderId,'122');
});

test('an unfinished escort keeps its order and local position through return and reentry',()=>{
 let pair=talk(ready(),'quest');pair=talk(pair,'escortWait');const before=structuredClone(pair.battle.npcs.find(n=>n.id===npcId));
 let campaign=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 campaign=decodeSave(encodeSave(campaign)).campaign;campaign=order(campaign,{type:'visitSector'});pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);pair=sync(pair);
 const after=pair.battle.npcs.find(n=>n.id===npcId);assert.deepEqual(after.escort,before.escort);assert.deepEqual([after.x,after.y],[before.x,before.y]);assert.equal(pair.campaign.quests[questId].status,'offered');
});
