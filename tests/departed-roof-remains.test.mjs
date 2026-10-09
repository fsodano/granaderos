import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {completeTestTravel} from './campaign-test-helpers.mjs';
import {dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {createBattle,endTurn} from '../game/tactical.js';
import {placeBuilding,buildTerrace} from '../game/buildings.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {validateDeploymentReturnState} from '../game/deployment-return.js';

const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
const report=(campaign,battle)=>({type:'leaveSector',battleId:campaign.pendingBattle.id,outcome:battle.status,sectorState:battle,survivors:battle.units.filter(unit=>unit.side==='player')});
function departedRoofBody(){
 let campaign=order(initialCampaign(),{type:'visitSector'});
 const request=campaign.pendingBattle,width=64,height=48;
 const ground=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',cover:0,blocked:false}));
 const {building,tiles}=placeBuilding(ground,{id:'retained-roof',x:41,y:44,width:3,height:3,roof:'terrace'});
 const geometry=buildTerrace(building,{climbPoints:[{id:'south',from:{x:42,y:47},to:{x:42,y:46}}]});
 // Declared local-service scene with an existing wound and routed soldier.
 // The ordinary reducer finds the roof route, climbs, crosses the real exit,
 // spends time, and then preserves the actual bleeding death after departure.
 let battle=createBattle(request.squad.map((unit,i)=>({...unit,x:i?43+i:41,y:i?47:46,...(unit.id===3?{tacticalLevel:1,hp:28,bleeding:3,bandaged:0,routed:true,condition:27}:{})})),{
  ...request,width,height,tiles,buildings:[building],...geometry,enemies:[],npcs:request.npcs,props:[],
 });
 battle=endTurn(battle);
 const departed=battle.units.find(unit=>unit.id==='3');
 assert.equal(battle.lastError,null);assert.ok(departed.hp>0);assert.equal(departed.departure.destination,'buenos_aires');
 assert.ok(departed.fleePath.some(point=>point.tacticalLevel===1));assert.ok(departed.fleePath.some(point=>point.kind==='climb'));
 battle=endTurn(battle);
 const corpse=structuredClone(battle.units.find(unit=>unit.id==='3'));
 assert.equal(battle.lastError,null);assert.equal(corpse.hp,0);assert.ok(battle.elapsedSeconds>corpse.departure.elapsedSeconds);
 campaign=order(campaign,report(campaign,battle));
 return {campaign,corpse};
}

test('native roof departure and death retain source paths while destination arrival initializes a local corpse clone',()=>{
 let {campaign,corpse}=departedRoofBody();
 const expected=structuredClone(corpse);delete expected.entryEdge;delete expected.entryAnchor;delete expected.entryReason;
 assert.deepEqual(campaign.sectorRemains.buenos_aires[0].unit,expected);
 assert.deepEqual(campaign.sectorStates.retiro.units.find(unit=>unit.id==='3'),corpse);
 campaign=restoreCampaign(serializeCampaign(campaign));
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 const queued=structuredClone(campaign.sectorRemains.buenos_aires);
 const source=structuredClone(campaign.sectorStates.retiro);
 campaign=order(campaign,{type:'visitSector'});
 let battle=enterSector(campaign.pendingBattle,campaign.sectorStates.retiro);
 assert.deepEqual(campaign.sectorStates.retiro,source,'entering the source does not rewrite its original departure paths');
 assert.deepEqual(campaign.sectorRemains.buenos_aires,queued);
 campaign=order(campaign,report(campaign,battle));
 campaign=completeTestTravel(campaign,{sector:'buenos_aires'});
 campaign=order(campaign,{type:'visitSector'});
 const before=structuredClone(campaign);
 battle=enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires);
 const body=battle.units.find(unit=>unit.id==='3');
 assert.deepEqual(campaign,before,'destination initialization changes only the new tactical clone');
 assert.deepEqual(campaign.sectorRemains.buenos_aires,queued,'raw queued custody still includes the original source paths');
 assert.equal(body.hp,0);assert.equal(body.tacticalLevel??0,0);assert.equal(body.y,0);
 assert.equal(body.lastMovePath,undefined);assert.equal(body.fleePath,undefined);
 for(const key of ['weapon','blade','condition','loaded','ammo','inventory','weaponFittings','medkits'])assert.deepEqual(body[key],expected[key]);
 assert.deepEqual(decodeSave(encodeSave(campaign,battle)),{campaign,battle});
 campaign=order(campaign,report(campaign,battle));
 assert.deepEqual(campaign.sectorRemains.buenos_aires,[]);
 assert.equal(campaign.operativeState[3].alive,false);
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
});

test('departed roof corpse admission rejects unsupported source paths and never invents missing roof geometry',()=>{
 const {campaign}=departedRoofBody();
 for(const edit of [
  state=>state.sectorRemains.buenos_aires[0].unit.fleePath[0]={x:0,y:0,tacticalLevel:1},
  state=>{delete state.sectorStates.retiro.upperSurfaces;delete state.sectorStates.retiro.climbLinks;},
  state=>{delete state.sectorStates.retiro;state.pendingBattle={sector:'retiro',width:64,height:48};},
 ]){
  const invalid=structuredClone(campaign);edit(invalid);const before=structuredClone(invalid);
  assert.throws(()=>validateDeploymentReturnState(invalid));
  assert.deepEqual(invalid.sectorRemains,before.sectorRemains,'rejection preserves the actual corpse record');
 }
});
