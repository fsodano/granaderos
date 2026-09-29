import {secureArea} from './controlled-area-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,serializeCampaign,restoreCampaign,isSupplied,operativeLocation,dailyIncome} from '../game/campaign.js';
import {WORLD_CELLS,worldCell,locationId,worldOwner,cellTravelPlan,cellTravelReason} from '../game/world-cells.js';
import {defaultContentPackage} from '../game/content-package.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {hiringArrivalReason} from '../game/hiring-arrivals.js';
import {buildSectorMap} from '../game/maps.js';
import {enterSector} from '../game/world.js';
import {actBattle} from '../game/tactical.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {expandCellScene} from '../game/cell-scene-storage.js';
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
const ready=()=>order(secureArea(initialCampaign(42),'buenos_aires','ensenada'),{type:'recruitCivic',id:110,term:'week'});
const saved=(s,b=null)=>decodeSave(encodeSave(s,b));
const travel=(s,sector)=>order(s,{type:'travel',sector});
const visit=s=>{const campaign=order(s,{type:'visitSector'});return {campaign,battle:enterSector({...campaign.pendingBattle,hour:campaign.hour},campaign.sectorStates[campaign.location])};};
const leave=({campaign,battle})=>{const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null);return order(pair.campaign,{type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});};

test('each physical cell has one runtime identity; only the exact legacy anchor retains a locality key',()=>{
 assert.equal(WORLD_CELLS.length,1188);assert.equal(new Set(WORLD_CELLS.map(c=>c.location)).size,1188);
 assert.equal(locationId('cell-27-28'),'retiro');assert.equal(locationId('cell-25-28'),'buenos_aires');
 assert.equal(locationId('cell-26-28'),'cell-26-28');assert.equal(locationId('cell-25-29'),'cell-25-29');
 for(const bad of ['cell-36-0','cell--1-0','cell-0-33','cell-01-1','constructor'])assert.equal(locationId(bad),null);
});
test('real travel and visits preserve two rural and two urban cells across campaign and active-scene saves',()=>{
 let s=ready();const income=dailyIncome(s),locations=['cell-27-27','cell-26-27','cell-26-28','cell-25-29'];
 for(const [index,id]of locations.entries()){
  const before=s.hour,plan=cellTravelPlan(s,id);s=travel(s,id);
  assert.equal(s.location,id);assert.equal(s.hour,before+plan.hours);assert.equal(operativeLocation(s,110),id);
  const entered=visit(s);let pair=saved(entered.campaign,entered.battle);assert.equal(pair.battle.sectorId,id);assert.equal(pair.battle.sourceMapId,id);
  assert.equal(pair.battle.npcs.length,0);assert.equal(pair.battle.units.some(u=>u.militia),false);
  assert.equal(pair.battle.groundItems.some(g=>g.type==='money'),false);
  const unit=pair.battle.units[0];pair.battle.groundItems.push({id:`supplies-${index}`,type:'rations',count:index+1,x:unit.x,y:unit.y});
  // The real return/save/reentry path must retain each independent scene.
  s=saved(leave(pair)).campaign;assert.equal(dailyIncome(s),income);assert.equal(Object.keys(s.sectors).length,13);
 }
 for(const [index,id]of locations.entries()){
  s=travel(s,id);let pair=visit(s);assert.equal(pair.battle.groundItems.length,1);assert.equal(pair.battle.groundItems[0].id,`supplies-${index}`);
  const count=pair.battle.units[0].rations;pair.battle=actBattle(pair.battle,{type:'loot',unitId:'110',groundId:`supplies-${index}`});assert.equal(pair.battle.lastError,null);
  const collected=pair.battle.units[0].rations-count;assert.ok(collected>0&&collected<=index+1);const remainder=index+1-collected;assert.equal(pair.battle.groundItems[0].count,remainder);s=saved(leave(pair)).campaign;
  pair=visit(s);assert.equal(pair.battle.groundItems[0].count,remainder);s=leave(pair);
 }
});
test('separate city districts retain different terrain, doors and source identities without copying landmark loot',()=>{
 const a=buildSectorMap({sector:'cell-26-28',enemies:[],squad:[]}),b=buildSectorMap({sector:'cell-25-29',enemies:[],squad:[]});
 assert.notDeepEqual(a.tiles,b.tiles);assert.equal(a.buildings.length,2);assert.ok(a.buildings.every(x=>x.id.startsWith('cell-26-28:')));
 let pair=visit(travel(ready(),'cell-26-28'));const door=pair.battle.tiles.find(t=>t.type==='door'),u=pair.battle.units[0];
 Object.assign(u,{x:door.x,y:door.y+1});const wasOpen=door.open;
 pair.battle=actBattle(pair.battle,{type:'door',unitId:u.id,x:door.x,y:door.y});assert.equal(pair.battle.lastError,null);
 assert.notEqual(pair.battle.tiles.find(t=>t.x===door.x&&t.y===door.y).open,wasOpen);
 let s=saved(leave(pair)).campaign;s=travel(s,'cell-25-29');let other=visit(s);assert.equal(other.battle.tiles.find(t=>t.type==='door').open,wasOpen);s=leave(other);
 s=travel(s,'cell-26-28');pair=visit(s);assert.notEqual(pair.battle.tiles.find(t=>t.x===door.x&&t.y===door.y).open,wasOpen);
 assert.throws(()=>enterSector(pair.campaign.pendingBattle,other.battle),/otra celda/);
});
test('grid routing uses land, avoids occupied districts and checks winter closure without moving or charging on rejection',()=>{
 const s=ready(),water=WORLD_CELLS.find(c=>!c.land).id;
 for(const id of [water,'cell-12-7','cell-13-7','cell-99-99']){
  const next=dispatchCampaign(s,{type:'travel',sector:id});assert.ok(next.lastError);assert.deepEqual({...next,lastError:null},s);
 }
 assert.equal(worldOwner(s,'cell-27-27'),'neutral');assert.equal(worldOwner(s,'cell-13-7'),'royalist');
 const plan=cellTravelPlan(s,'cell-11-7');assert.ok(plan.path.length>10);assert.ok(plan.path.every(id=>worldCell(id).land&&worldOwner(s,id)!=='royalist'));
 const winter={...s,hour:90*24,sectors:{...s.sectors,uspallata:{...s.sectors.uspallata,owner:'patriot'}}};assert.match(cellTravelReason(winter,'uspallata'),/nieve/);assert.equal(cellTravelPlan(winter,'uspallata').path.length,0);
 const summer={...s,sectors:{...s.sectors,uspallata:{...s.sectors.uspallata,owner:'patriot'}}};assert.equal(cellTravelReason(summer,'uspallata'),null);
});
test('a contract expiring between cells stops at the last reached cell and saves its departure there',()=>{
 let s=ready();s.contracts[110].expiresAt=3;const path=cellTravelPlan(s,'cell-26-27').path;
 s=travel(s,'cell-26-27');assert.equal(s.location,path[1]);assert.equal(s.squad.length,0);assert.equal(s.hour,3);
 assert.equal(s.operativeState[110].location,path[1]);assert.equal(s.recruited.includes(110),false);assert.equal(saved(s).campaign.location,path[1]);
});
test('safe arrivals during a cell march stay at their destination, without joining or moving into a nearby district',()=>{
 const d=defaultContentPackage();d.characters.find(c=>c.id==='person-110').arrivalHours=0;d.characters.find(c=>c.id==='person-111').arrivalHours=2;
 let s=order(initialCampaign(42,d),{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'recruitCivic',id:111,term:'week',destination:'retiro'});
 s=travel(s,'cell-26-27');assert.deepEqual(s.squad,[110]);assert.equal(s.operativeState[111].location,'retiro');assert.equal(s.contracts[111].started,2);
 assert.equal(saved(s).campaign.operativeState[111].location,'retiro');
 assert.ok(hiringArrivalReason(s,'cell-26-28'));assert.ok(hiringArrivalReason(s,'cell-27-27'));
});
test('unrelated squads keep their exact cells and cannot exchange personnel from neighboring districts',()=>{
 let s=ready();s=order(s,{type:'recruitCivic',id:111,term:'week'});s=order(s,{type:'createSquad',ids:[111],name:'Segunda escuadra'});
 s=travel(s,'cell-26-28');s=order(s,{type:'selectSquad',id:'squad-1'});assert.equal(s.location,'retiro');
 assert.ok(dispatchCampaign(s,{type:'squad',ids:[110,111]}).lastError);
 s=saved(s).campaign;s=order(s,{type:'selectSquad',id:'squad-2'});assert.equal(s.location,'cell-26-28');
 s=travel(s,'retiro');s=order(s,{type:'squad',ids:[110,111]});assert.deepEqual(s.squad,[110,111]);
});
test('cells do not manufacture locality services, income, militia, or supply and reject unsupported transport',()=>{
 let s=travel(ready(),'cell-26-28');assert.equal(isSupplied(s,s.location),false);const money=s.resources.treasury;
 for(const a of [{type:'militia',trainerId:110},{type:'fortify'},{type:'diplomacy',kind:'requisition'},{type:'resupply',operativeId:110},{type:'travel',sector:'retiro',mode:'flotilla'}]){
  const next=dispatchCampaign(s,a);assert.ok(next.lastError);assert.equal(next.resources.treasury,money);assert.deepEqual(next.sectors,s.sectors);
 }
 s=travel(s,'cell-25-28');assert.equal(s.location,'buenos_aires');assert.equal(isSupplied(s,s.location),true);
 s=travel(s,'retiro');assert.equal(s.location,'retiro');assert.equal(saved(s).campaign.location,'retiro');
});
test('a raid that takes the next town during a leg halts before that town without undoing elapsed time',()=>{
 let s=ready();s.sectors.salta.owner='patriot';s.location='cell-11-7';s.squads[0].location=s.location;s.hour=118;
 s=travel(s,'salta');assert.equal(s.hour,120);assert.equal(s.sectors.salta.owner,'royalist');assert.equal(s.location,'cell-11-7');assert.match(s.log.map(l=>l.text).join(' '),/se detiene/);assert.ok(saved(s));
});
test('an assault from an adjacent field keeps its exact origin when retreating and saving',()=>{
 let s=travel(ready(),'cell-21-26');s=order(s,{type:'attack',sector:'san_nicolas'});
 assert.equal(s.pendingBattle.origin,'cell-21-26');let pair=saved(s,enterSector(s.pendingBattle));
 assert.ok(pair.battle.units.some(u=>u.side==='enemy'));
 s=order(pair.campaign,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'retreat',sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 assert.equal(s.location,'cell-21-26');assert.equal(saved(s).campaign.squads[0].location,'cell-21-26');assert.equal(visit(s).battle.sectorId,'cell-21-26');
});
test('saved cell locations and scene receipts cannot alias another cell, open water or a legacy anchor',()=>{
 const s=travel(ready(),'cell-26-27');
 for(const location of ['cell-27-28','cell-99-0',WORLD_CELLS.find(c=>!c.land).id]){
  const bad=structuredClone(s);bad.location=location;bad.squads[0].location=location;assert.throws(()=>restoreCampaign(serializeCampaign(bad)));
 }
 const pair=visit(s),wrong=structuredClone(pair.battle);wrong.sourceMapId='cell-27-27';assert.throws(()=>saved(pair.campaign,wrong),/celda/);
 assert.ok(dispatchCampaign(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:wrong,survivors:wrong.units}).lastError);
 const completed=leave(pair);completed.sectorStates['cell-26-27'].sectorId='cell-27-27';assert.throws(()=>saved(completed),/sectores|celda/);
});
test('land cell placements can launch with the live character-presence adapter',()=>{
 const d=defaultContentPackage();d.placements[0].sectors=['cell-26-27'];assert.deepEqual(campaignContentReport(d).blocked,[]);
});
test('forty visited cells fit the existing browser save limit and remain separate after a continuous march',()=>{
 let s=ready();
 for(let col=27;col>=8;col--)s=leave(visit(travel(s,`cell-${col}-29`)));
 for(let col=8;col<=27;col++)s=leave(visit(travel(s,`cell-${col}-28`)));
 const encoded=encodeSave(s);assert.ok(encoded.length<1_000_000,`${encoded.length} characters`);
 const restored=decodeSave(encoded).campaign;assert.equal(Object.keys(restored.sectorStates).length,40);assert.equal(restored.location,'retiro');
 for(const [id,scene]of Object.entries(restored.sectorStates)){assert.equal(scene.sectorId,id);assert.equal(scene.sourceMapId,id);}
 assert.equal(visit(travel(restored,'cell-8-29')).battle.sourceMapId,'cell-8-29');
});
test('compressed active and retained cells preserve all terrain fields and accept earlier tile arrays',()=>{
 const pair=visit(travel(ready(),'cell-26-28'));
 const wall=pair.battle.tiles.find(t=>t.type==='wall');Object.assign(wall,{type:'rubble',blocked:false,blocksSight:false,cover:17});
 const expected=JSON.parse(JSON.stringify(pair.battle.tiles)),before=JSON.stringify(pair.battle);
 const wire=encodeSave(pair.campaign,pair.battle);assert.equal(JSON.stringify(pair.battle),before);assert.equal(JSON.parse(wire).battle.tiles.format,'cell-tiles-v1');
 assert.deepEqual(decodeSave(wire).battle.tiles,expected);
 const s=leave(pair);assert.equal(s.sectorStates[s.location].tiles.format,'cell-tiles-v1');assert.deepEqual(visit(saved(s).campaign).battle.tiles,expected);
 const old=JSON.parse(encodeSave(s));old.campaign.sectorStates[s.location]=expandCellScene(s.sectorStates[s.location]);
 assert.deepEqual(visit(decodeSave(JSON.stringify(old)).campaign).battle.tiles,expected);
 const oldActive=JSON.parse(wire);oldActive.battle=pair.battle;assert.deepEqual(decodeSave(JSON.stringify(oldActive)).battle.tiles,expected);
});
test('malformed or excessive compressed terrain is rejected before scene allocation',()=>{
 const pair=visit(travel(ready(),'cell-26-28')),wire=encodeSave(pair.campaign,pair.battle);
 for(const mutate of [
  p=>p.format='unknown',p=>p.runs[0]=p.palette.length,p=>p.runs[1]=-1,p=>p.runs[1]=1000000000,
  p=>p.runs.pop(),p=>p.palette[0].x=0,p=>p.runs.push(0,1),p=>p.palette.push({type:'grass',blocked:false,cover:0}),
  p=>{p.palette=[{type:'grass',blocked:false,cover:0,note:'x'.repeat(5000)}];p.runs=[0,3072];},
 ]){const bad=JSON.parse(wire);mutate(bad.battle.tiles);assert.throws(()=>decodeSave(JSON.stringify(bad)),/comprimido/);}
 const bad=JSON.parse(wire);bad.battle.sourceMapId='retiro';assert.throws(()=>decodeSave(JSON.stringify(bad)),/comprimido/);
});
