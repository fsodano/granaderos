import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign as dispatch,encountersFor,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {buildSectorMap} from '../game/maps.js';
import {createBattle,actBattle} from '../game/tactical.js';
const order=(s,a)=>{const n=dispatch(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
function visit(s,sector,actor=4){s=order(s,{type:'travel',sector});s=order(s,{type:'visitSector'});const map=buildSectorMap(s.pendingBattle);let battle=createBattle(map.squad,map);battle=actBattle(battle,{type:'move',unitId:String(actor),x:2,y:7});assert.equal(battle.lastError,null);return {s,battle};}
test('each sector has a local encounter and local recruits cannot bypass the meeting',()=>{
 const s=initialCampaign();for(const id of Object.keys(s.sectors))assert.ok(encountersFor(s,id).length>0,id);assert.ok(dispatch(s,{type:'recruitCivic',id:100}).lastError);s.sectors.mendoza.owner='patriot';assert.ok(dispatch(s,{type:'recruit',id:2}).lastError);
});
test('physical talk, leadership and regional commitments all gate Brown recruitment',()=>{
 let s=initialCampaign();s.sectors.san_nicolas.owner='patriot';s.reputation.foreign=30;s=order(s,{type:'wait',hours:48});let result=visit(s,'ensenada',3);s=result.s;const battle=result.battle,cash=s.resources.treasury;
 let denied=dispatch(s,{type:'talkNPC',npcId:'brown',approach:'recruit',unitId:3,sectorState:battle});assert.match(denied.lastError,/liderazgo/);assert.equal(denied.resources.treasury,cash);
 let next=actBattle(battle,{type:'move',unitId:'3',x:1,y:7});next=actBattle(next,{type:'move',unitId:'4',x:2,y:7});assert.equal(next.lastError,null);
 s=order(s,{type:'talkNPC',npcId:'brown',approach:'direct',unitId:4,sectorState:next});assert.equal(s.lastConversation.speaker,'Guillermo Brown');s=order(s,{type:'talkNPC',npcId:'brown',approach:'recruit',unitId:4,sectorState:next});assert.ok(s.recruited.includes(5));assert.ok(s.pendingBattle.squad.some(o=>o.id===5));assert.equal(s.lastConversation.outcome,'recruited');assert.equal(encountersFor(s,'ensenada').some(n=>n.id==='brown'),false);
 const paid=s.resources.treasury;assert.ok(dispatch(s,{type:'talkNPC',npcId:'brown',approach:'recruit',unitId:4,sectorState:next}).lastError);assert.equal(s.resources.treasury,paid);
});
test('conversation requires adjacency and a cleared tactical situation',()=>{
 const result=visit(initialCampaign(),'buenos_aires'),s=result.s,battle=result.battle;const far=structuredClone(battle);far.units.find(u=>u.id==='4').x=10;assert.ok(dispatch(s,{type:'talkNPC',npcId:'sosa',approach:'friendly',unitId:4,sectorState:far}).lastError);
 const fighting=structuredClone(battle);fighting.mode='combat';fighting.sectorCleared=false;fighting.status='active';assert.ok(dispatch(s,{type:'talkNPC',npcId:'sosa',approach:'friendly',unitId:4,sectorState:fighting}).lastError);
});
test('visits issue and return finite ammunition instead of erasing or generating rounds',()=>{
 let s=initialCampaign();const total=s.resources.cartridges;s=order(s,{type:'visitSector'});const issued=s.pendingBattle.issuedCartridges;assert.equal(issued,20);assert.equal(s.resources.cartridges,total-issued);const map=buildSectorMap(s.pendingBattle),battle=createBattle(map.squad,map);
 s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player').map(u=>({...u,id:Number(u.id)}))});assert.equal(s.resources.cartridges,total);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});
