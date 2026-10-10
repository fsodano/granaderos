import {previewStrategicRoute} from '../game/strategic-route.js';
import {MAX_SAVE_BYTES,saveByteLength} from '../game/save-limits.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {sleepOrderReason} from '../game/sleep.js';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {secureArea} from './controlled-area-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,serializeCampaign,restoreCampaign,isSupplied,operativeLocation,dailyIncome} from '../game/campaign.js';
import {WORLD_CELLS,worldCell,locationId,worldOwner,cellTravelPlan,cellTravelReason,cellLegHours} from '../game/world-cells.js';
import {defaultContentPackage} from '../game/content-package.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {hiringArrivalReason} from '../game/hiring-arrivals.js';
import {buildSectorMap} from '../game/maps.js';
import {enterSector} from '../game/world.js';
import {actBattle,getReachable,hasLineOfSight} from '../game/tactical.js';
import {entryFromSector} from '../game/tactical-exits.js';
import {sameSurface,spacePoint} from '../game/tactical-space.js';
import {wallEdgeCells} from '../game/wall-geometry.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {expandCellScene} from '../game/cell-scene-storage.js';
import {completeTestTravel} from './campaign-test-helpers.mjs';
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
test('walking back after a real rural exit replaces the arrival record and permits time, save and reentry',()=>{
 let p=visit(ready());const exit=p.battle.exits.find(e=>e.destination==='cell-27-27');assert.ok(exit);
 const destination=getReachable(p.battle,p.battle.units.find(u=>u.id==='110')).filter(cell=>(cell.tacticalLevel??0)===0&&cell.y===0).sort((a,b)=>a.cost-b.cost)[0];assert.ok(destination);
 p.battle=actBattle(p.battle,{type:'move',unitId:'110',x:destination.x,y:destination.y});assert.equal(p.battle.lastError,null);
 p.battle=actBattle(p.battle,{type:'exit',unitIds:['110'],exitId:exit.id});assert.equal(p.battle.lastError,null);
 let s=leave(p);assert.equal(s.operativeState[110].arrival.exitId,exit.id);assert.equal(s.location,'cell-27-27');
 const hour=s.hour;s=travel(s,'retiro');assert.ok(s.hour>hour);
 s=order(s,{type:'wait',hours:1});s=saved(s).campaign;
 const record=s.operativeState[110],entry=entryFromSector('cell-27-27','retiro');
 assert.equal(record.location,'retiro');assert.equal(record.arrival.fromSector,'cell-27-27');assert.equal(record.arrival.toSector,'retiro');
 assert.equal(record.arrival.exitId,undefined);assert.equal(record.arrival.entryEdge,entry.entryEdge);assert.deepEqual(record.arrival.entryAnchor,entry.entryAnchor);
 p=visit(s);const actor=p.battle.units.find(u=>u.id==='110');assert.equal(actor.y,0,'the return uses the actual northern boundary');
 assert.deepEqual(saved(p.campaign,p.battle),p);
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
  // Reentry uses the boundary reached by this march, not the earlier visit's
  // position. Walk back to the retained item before trying to collect it.
  const item=pair.battle.groundItems[0],near=getReachable(pair.battle,pair.battle.units[0]).filter(p=>sameSurface(p,item)&&Math.hypot(p.x-item.x,p.y-item.y)<=1.5&&hasLineOfSight(pair.battle,p,item)).sort((a,b)=>a.cost-b.cost)[0];assert.ok(near);
  if(near.cost){pair.battle=actBattle(pair.battle,{type:'move',unitId:'110',...spacePoint(near)});assert.equal(pair.battle.lastError,null);}
  if(pair.battle.units[0].x!==item.x||pair.battle.units[0].y!==item.y){pair.battle=actBattle(pair.battle,{type:'look',unitId:'110',x:item.x,y:item.y});assert.equal(pair.battle.lastError,null);}
  const count=pair.battle.units[0].rations;pair.battle=actBattle(pair.battle,{type:'loot',unitId:'110',groundId:`supplies-${index}`});assert.equal(pair.battle.lastError,null);
  const collected=pair.battle.units[0].rations-count;assert.ok(collected>0&&collected<=index+1);const remainder=index+1-collected;assert.equal(pair.battle.groundItems[0].count,remainder);s=saved(leave(pair)).campaign;
  pair=visit(s);assert.equal(pair.battle.groundItems[0].count,remainder);s=leave(pair);
 }
});
test('separate city districts retain different terrain, doors and source identities without copying landmark loot',()=>{
 const a=buildSectorMap({sector:'cell-26-28',enemies:[],squad:[]}),b=buildSectorMap({sector:'cell-25-29',enemies:[],squad:[]});
 assert.notDeepEqual(a.tiles,b.tiles);assert.equal(a.buildings.length,2);assert.ok(a.buildings.every(x=>x.id.startsWith('cell-26-28:')));
 let pair=visit(travel(ready(),'cell-26-28'));const door=pair.battle.wallEdges.find(t=>t.type==='door'),u=pair.battle.units[0];
 Object.assign(u,wallEdgeCells(door)[0]);const wasOpen=door.open;
 pair.battle=actBattle(pair.battle,{type:'door',unitId:u.id,doorId:door.doorId});assert.equal(pair.battle.lastError,null);
 assert.notEqual(pair.battle.wallEdges.find(t=>t.id===door.id).open,wasOpen);
 let s=saved(leave(pair)).campaign;s=travel(s,'cell-25-29');let other=visit(s);assert.equal(other.battle.wallEdges.find(t=>t.type==='door').open,wasOpen);s=leave(other);
 s=travel(s,'cell-26-28');pair=visit(s);assert.notEqual(pair.battle.wallEdges.find(t=>t.id===door.id).open,wasOpen);
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
test('a contract expiring between cells retains its traveler until the next real arrival and saves departure there',()=>{
 let s=ready();s.contracts[110].expiresAt=2;const path=cellTravelPlan(s,'cell-26-27').path;
 s=travel(s,'cell-26-27');assert.equal(s.location,path[2]);assert.equal(s.squad.length,0);assert.equal(s.hour,cellLegHours(path[0],path[1])+cellLegHours(path[1],path[2]));
 assert.equal(s.operativeState[110].location,path[2]);assert.equal(s.recruited.includes(110),false);assert.equal(saved(s).campaign.location,path[2]);
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
 let s=ready();s.sectors.salta.owner='patriot';s.location='cell-11-7';s.squads[0].location=s.location;s.operativeState[110].location=s.location;s.hour=118;launchEnemyGroup(s,'north','salta',{immediate:true});
 s=travel(s,'salta');assert.equal(s.hour,120);assert.equal(s.sectors.salta.owner,'royalist');assert.equal(s.location,'cell-11-7');assert.match(s.log.map(l=>l.text).join(' '),/regresa por la etapa recorrida/);assert.equal(s.squads[0].journey,undefined);assert.ok(saved(s));
});
test('an assault from an adjacent field keeps its exact origin when retreating and saving',()=>{
 let s=travel(ready(),'cell-21-26');s=order(s,{type:'attack',sector:'san_nicolas'});
 assert.equal(s.pendingBattle.origin,'cell-21-26');let pair=saved(s,enterSector(s.pendingBattle));
 assert.ok(pair.battle.units.some(u=>u.side==='enemy'));
 const exit=pair.battle.exits.find(e=>e.destination==='cell-21-26');assert.ok(exit);assert.equal(pair.battle.units.find(u=>u.id==='110').x,0);
 pair.battle=actBattle(pair.battle,{type:'exit',unitIds:['110'],exitId:exit.id});assert.equal(pair.battle.lastError,null);assert.equal(pair.battle.status,'retreat');
 pair=syncBattleTime(pair.campaign,pair.battle);assert.equal(pair.error,null);
 s=order(pair.campaign,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'retreat',sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 assert.equal(s.location,'cell-21-26');assert.equal(saved(s).campaign.squads[0].location,'cell-21-26');assert.equal(visit(s).battle.sectorId,'cell-21-26');
});
test('saved cell locations and scene receipts cannot alias another cell, open water or a legacy anchor',()=>{
 const s=travel(ready(),'cell-26-27');
 for(const location of ['cell-27-28','cell-99-0',WORLD_CELLS.find(c=>!c.land).id]){
  const bad=structuredClone(s);bad.location=location;bad.squads[0].location=location;assert.throws(()=>restoreCampaign(serializeCampaign(bad)));
 }
 const pair=visit(s),wrong=structuredClone(pair.battle);wrong.sourceMapId='cell-27-27';assert.throws(()=>saved(pair.campaign,wrong),/celda/);
 for(const source of ['cell-27-27','retiro',null,undefined]){const report=structuredClone(wrong);report.sourceMapId=source;const rejected=dispatchCampaign(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:report,survivors:report.units});assert.match(rejected.lastError,/celda/);assert.deepEqual({...rejected,lastError:null},pair.campaign);}
 const completed=leave(pair);completed.sectorStates['cell-26-27'].sectorId='cell-27-27';assert.throws(()=>saved(completed),/sectores|celda/);
});
test('land cell placements can launch with the live character-presence adapter',()=>{
 const d=defaultContentPackage();d.placements[0].sectors=['cell-26-27'];assert.deepEqual(campaignContentReport(d).blocked,[]);
});
test('forty visited cells fit the existing browser save limit after actual marches and field sleep',()=>{
 let s=order(ready(),{type:'renewContract',id:110,term:'fortnight'});const rest=s=>{if(s.operativeState[110].fatigue<60)return s;const hour=s.hour;s=order(s,{type:'setSleep',operativeId:110,asleep:true});for(let i=0;s.operativeState[110].asleep&&i<24;i++)s=advanceCampaignHours(s,1);assert.equal(s.operativeState[110].asleep,false);assert.ok(s.hour>hour);return saved(s).campaign;};
 for(let col=27;col>=8;col--)s=rest(leave(visit(travel(s,`cell-${col}-29`))));
 for(let col=8;col<=27;col++)s=rest(leave(visit(travel(s,`cell-${col}-28`))));
 const encoded=encodeSave(s);assert.ok(saveByteLength(encoded)<MAX_SAVE_BYTES,`${saveByteLength(encoded)} bytes`);
 const restored=decodeSave(encoded).campaign;assert.equal(Object.keys(restored.sectorStates).length,40);assert.equal(restored.location,'retiro');
 for(const [id,scene]of Object.entries(restored.sectorStates)){assert.equal(scene.sectorId,id);assert.equal(scene.sourceMapId,id);}
 const returned=completeTestTravel(restored,{sector:'cell-8-29'});assert.equal(returned.location,'cell-8-29');assert.equal(returned.squads[0].journey,undefined);assert.equal(visit(returned).battle.sourceMapId,'cell-8-29');
});
test('compressed active and retained cells preserve all terrain fields and accept earlier tile arrays',()=>{
 const pair=visit(travel(ready(),'cell-26-28'));
 const wall=pair.battle.wallEdges.find(t=>t.type==='wall');Object.assign(wall,{type:'rubble',blocked:false,blocksSight:false,cover:17});
 const expected=JSON.parse(JSON.stringify(pair.battle.tiles)),expectedEdges=structuredClone(pair.battle.wallEdges),before=JSON.stringify(pair.battle);
 const wire=encodeSave(pair.campaign,pair.battle);assert.equal(JSON.stringify(pair.battle),before);assert.equal(JSON.parse(wire).battle.tiles.format,'cell-tiles-v1');
 assert.deepEqual(decodeSave(wire).battle.tiles,expected);
 assert.deepEqual(decodeSave(wire).battle.wallEdges,expectedEdges);
 const s=leave(pair);assert.ok(Array.isArray(s.sectorStates[s.location].tiles)||s.sectorStates[s.location].tiles.format==='cell-tiles-v1');const returned=visit(saved(s).campaign);assert.deepEqual(returned.battle.tiles,expected);assert.deepEqual(returned.battle.wallEdges,expectedEdges);
 const old=JSON.parse(encodeSave(s));old.campaign.sectorStates[s.location]=expandCellScene(s.sectorStates[s.location]);
 const expanded=visit(decodeSave(JSON.stringify(old)).campaign);assert.deepEqual(expanded.battle.tiles,expected);assert.deepEqual(expanded.battle.wallEdges,expectedEdges);
 const oldActive=JSON.parse(wire);oldActive.battle=pair.battle;const active=decodeSave(JSON.stringify(oldActive)).battle;assert.deepEqual(active.tiles,expected);assert.deepEqual(active.wallEdges,expectedEdges);
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


test('field sleep recovers on safe land, but occupied districts and their enemy groups prevent it',()=>{
 const field=travel(ready(),'cell-26-27');assert.equal(worldOwner(field,field.location),'neutral');const fatigue=field.operativeState[110].fatigue;
 let s=order(field,{type:'setSleep',operativeId:110,asleep:true});s=advanceCampaignHours(s,1);assert.ok(s.operativeState[110].fatigue<fatigue);assert.ok(saved(s));
 const district=travel(ready(),'cell-26-28');assert.equal(sleepOrderReason(district,110,true),'');
 for(const blocked of [s=>s.sectors.buenos_aires.owner='royalist',s=>launchEnemyGroup(s,'interior','buenos_aires',{immediate:true})]){const s=structuredClone(district);blocked(s);assert.match(sleepOrderReason(s,110,true),/seguro/);const rejected=dispatchCampaign(s,{type:'setSleep',operativeId:110,asleep:true});assert.ok(rejected.lastError);assert.deepEqual({...rejected,lastError:null},s);}
});

test('queued field assault retains the same march, entry and finite equipment as an immediate attack',()=>{
 const base=travel(ready(),'cell-21-26'),hour=base.hour;
 const immediate=order(base,{type:'attack',sector:'san_nicolas'});
 const before=structuredClone(base),preview=previewStrategicRoute(base,base.activeSquadId,'san_nicolas');assert.equal(preview.valid,true);assert.equal(preview.hours,2);assert.deepEqual(preview.action,{type:'attack',sector:'san_nicolas',mode:'march',queue:true});assert.deepEqual(base,before);
 let queued=order(base,preview.action);assert.equal(queued.hour,hour);assert.equal(queued.squads[0].journey.legHours,2);queued=saved(queued).campaign;
 queued=advanceCampaignHours(queued,2);assert.equal(queued.squads[0].journey.status,'ready');queued=order(saved(queued).campaign,{type:'beginAssault',sector:'san_nicolas'});
 assert.equal(immediate.hour,hour+2);assert.equal(queued.hour,immediate.hour);assert.equal(queued.pendingBattle.origin,base.location);assert.deepEqual(queued.pendingBattle.squad,immediate.pendingBattle.squad);assert.deepEqual(queued.resources,immediate.resources);assert.deepEqual(queued.ammunitionShops,immediate.ammunitionShops);assert.ok(saved(queued,enterSector(queued.pendingBattle)));
 for(const mode of ['posta','carts','flotilla']){const rejected=dispatchCampaign(base,{type:'attack',sector:'san_nicolas',mode});assert.ok(rejected.lastError);assert.deepEqual({...rejected,lastError:null},base);}
 const bad=order(base,{type:'attack',sector:'san_nicolas',queue:true});bad.squads[0].journey.path[0]='cell-20-26';bad.squads[0].location='cell-20-26';bad.location='cell-20-26';assert.throws(()=>saved(bad),/ruta/);
});
