import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {CITIES} from '../game/cities.js';
import {mapTilesForSector} from '../game/strategic-map.js';
import {WORLD_CELLS,ROAD_LINKS,ROAD_SEGMENTS,worldCell,adjacentCells,roadConnects,roadEdgesForCell,cellLegHours,cellTravelPlan,cellWinterClosed} from '../game/world-cells.js';
import {previewStrategicRoute} from '../game/strategic-route.js';
import {squadTravelStatus,travelLegHours} from '../game/squad-travel.js';
import {worldCellPlan} from '../game/world-cell-map.js';
import {buildSectorMap} from '../game/maps.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {CAMPAIGN_SECTORS} from '../game/data.js';
import {enterSector} from '../game/world.js';
import {sectorExits,entryFromSector,boundaryMatches,inwardFromBoundary} from '../game/tactical-exits.js';
import {movementStepCost} from '../game/tactical.js';
import {completeTestTravel,restForMarch} from './campaign-test-helpers.mjs';
import {withOwnedMount} from './custody-gear-fixture.mjs';

const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
const saved=s=>decodeSave(encodeSave(s)).campaign;
const controlled=()=>{const s=initialCampaign();for(const region of Object.values(s.sectors))region.owner='patriot';return s;};

test('each campaign road connects its two places through land sectors with shared edges',()=>{
 assert.equal(ROAD_LINKS.length,16);
 for(const link of ROAD_LINKS){
  assert.equal(link.path[0],link.from);assert.equal(link.path.at(-1),link.to);
  for(let i=1;i<link.path.length;i++){
   assert.ok(worldCell(link.path[i]).land,`${link.from}–${link.to}`);
   assert.ok(adjacentCells(link.path[i-1],link.path[i]),'roads never skip a sector or connect only at a corner');
   assert.ok(roadConnects(link.path[i-1],link.path[i]));
  }
 }
 assert.equal(new Set(ROAD_SEGMENTS.map(s=>[s.from,s.to].sort().join('|'))).size,ROAD_SEGMENTS.length);
});

test('the default Buenos Aires–Córdoba route follows connected roads and costs less than open land',()=>{
 const s=controlled();s.location='buenos_aires';s.squads[0].location=s.location;
 for(const id of s.squad)s.operativeState[id].location=s.location;
 const before=structuredClone(s),preview=previewStrategicRoute(s,s.activeSquadId,'cordoba');
 assert.ok(preview.valid);assert.ok(preview.path.length>2);assert.deepEqual(s,before);
 let roadHours=0,fieldHours=0;
 for(let i=1;i<preview.path.length;i++){
  assert.ok(roadConnects(preview.path[i-1],preview.path[i]));
  roadHours+=cellLegHours(preview.path[i-1],preview.path[i]);
  fieldHours+=worldCell(preview.path[i]).biome==='mountain'?8:4;
 }
 assert.equal(preview.hours,roadHours);assert.ok(roadHours<fieldHours);
 const queued=order(s,preview.action);assert.deepEqual(queued.squads[0].journey.path,preview.path);assert.equal(squadTravelStatus(queued.squads[0]).remaining,preview.hours);assert.deepEqual(saved(queued),queued);
});

test('waypoints permit a longer land detour that bypasses a road patrol sector',()=>{
 const s=controlled();s.location='buenos_aires';s.squads[0].location=s.location;for(const id of s.squad)s.operativeState[id].location=s.location;
 const direct=previewStrategicRoute(s,s.activeSquadId,'cordoba');assert.ok(direct.path.includes('san_nicolas'));
 const detour=previewStrategicRoute(s,s.activeSquadId,'cordoba','march',['cell-18-27']);
 assert.ok(detour.valid);assert.ok(detour.path.includes('cell-18-27'));assert.ok(!detour.path.includes('san_nicolas'));assert.ok(detour.hours>direct.hours);
 assert.ok(detour.path.every(id=>worldCell(id).land));assert.deepEqual(detour.action.waypoints,['cell-18-27']);
 const queued=order(s,detour.action);assert.deepEqual(queued.squads[0].journey.path,detour.path);assert.deepEqual(saved(queued),queued);
});

test('a finite patrol closes the queued road while an actual rested waypoint march bypasses its occupied districts',t=>{
 // Declared established territory. The patrol uses the real finite reserve;
 // its occupation, route interruption, rest and detour all use the clock.
 let s=controlled();s.location='buenos_aires';s.squads[0].location=s.location;for(const id of s.squad)s.operativeState[id].location=s.location;
 const reserve=s.enemyReserves.remaining.interior,patrol=launchEnemyGroup(s,'interior','san_nicolas');assert.ok(patrol);
 const enemy=structuredClone(patrol),direct=previewStrategicRoute(s,s.activeSquadId,'cordoba');assert.ok(direct.valid);assert.ok(direct.path.includes('san_nicolas'));
 assert.equal(reserve-s.enemyReserves.remaining.interior,patrol.initialStrength);assert.equal(patrol.units.length,patrol.initialStrength);
 s=order(s,direct.action);assert.deepEqual(s.squads[0].journey.path,direct.path);assert.deepEqual(saved(s),s);s=saved(s);
 const enemyUnits=structuredClone(s.enemyGroups.find(group=>group.id===enemy.id).units);
 s=order(s,{type:'wait',hours:24});
 const stationed=s.enemyGroups.find(group=>group.id===enemy.id);assert.equal(stationed.status,'stationed');assert.equal(stationed.arrivalAt,enemy.arrivalAt);assert.equal(stationed.nextArrivalAt,enemy.nextArrivalAt);assert.equal(s.sectors.san_nicolas.owner,'royalist');
 const occupationHistory=structuredClone(s.encounterHistory);assert.equal(occupationHistory.length,1);assert.equal(occupationHistory[0].groupId,enemy.id);assert.equal(occupationHistory[0].sector,'san_nicolas');assert.deepEqual(occupationHistory[0].casualties,[]);
 assert.equal(s.squads[0].journey.status,'paused');assert.equal(s.squads[0].journey.reason,'blocked');assert.ok(s.squads[0].journey.path.includes('san_nicolas'));assert.notEqual(worldCell(s.location).locality,'san_nicolas');assert.equal(s.pendingEncounter,null);assert.equal(s.pendingBattle,null);assert.deepEqual(saved(s),s);
 s=order(s,{type:'cancelTravel',choice:'stop'});
 const waypoint='cell-18-27',detour=previewStrategicRoute(s,s.activeSquadId,'cordoba','march',[waypoint]);assert.ok(detour.valid);assert.ok(detour.path.includes(waypoint));assert.ok(detour.path.every(id=>worldCell(id).locality!=='san_nicolas'),'the detour bypasses every occupied district, not only the town anchor');
 const departure=s.hour,waypointIndex=detour.path.indexOf(waypoint),waypointHours=detour.path.slice(1,waypointIndex+1).reduce((hours,to,i)=>hours+travelLegHours(detour.path[i],to),0);
 s=order(s,detour.action);assert.deepEqual(s.squads[0].journey.path,detour.path);assert.deepEqual(saved(s),s);s=saved(s);
 s=order(s,{type:'wait',hours:waypointHours});assert.equal(s.location,waypoint,'the actual march reaches the selected off-road waypoint');assert.equal(s.hour,departure+waypointHours);assert.equal(s.pendingEncounter,null);assert.deepEqual(saved(s),s);
 s=order(s,{type:'wait',hours:24});assert.equal(s.squads[0].journey.status,'paused');assert.equal(s.squads[0].journey.reason,'exhausted');
 const pausedAt=s.hour,remainingPath=[...s.squads[0].journey.path];s=restForMarch(s);assert.ok(s.hour>pausedAt);assert.deepEqual(s.squads[0].journey.path,remainingPath);
 s=order(s,{type:'resumeTravel'});assert.equal(s.squads[0].journey.status,'moving');s=completeTestTravel(s,{sector:'cordoba'});
 assert.equal(s.location,'cordoba');assert.equal(s.squads[0].journey,undefined);assert.ok(s.hour>departure+detour.hours,'actual rest adds time to the planned march');assert.equal(s.pendingEncounter,null);assert.equal(s.pendingBattle,null);assert.deepEqual(s.encounterHistory,occupationHistory,'the detour creates no further encounter beyond the actual unopposed occupation');
 const retained=s.enemyGroups.find(group=>group.id===enemy.id);assert.equal(retained.status,'stationed');assert.equal(retained.target,'san_nicolas');assert.equal(retained.arrivalAt,enemy.arrivalAt);assert.equal(retained.nextArrivalAt,enemy.nextArrivalAt,'the off-road detour never adds a false crossing delay');assert.deepEqual(retained.units,enemyUnits);assert.equal(s.enemyReserves.remaining.interior,reserve-enemy.initialStrength);assert.equal(s.sectors.san_nicolas.owner,'royalist');assert.deepEqual(saved(s),s);
 t.diagnostic(JSON.stringify({patrolId:enemy.id,finiteStrength:enemy.initialStrength,patrolArrival:enemy.arrivalAt,detourHours:detour.hours,waypointArrival:departure+waypointHours,restedArrival:s.hour,occupiedSector:'san_nicolas'}));
});

test('adjacent districts in every city take one hour in both directions, including the Retiro seam',()=>{
 let checked=0;
 for(const city of CITIES){const cells=city.sectors.flatMap(mapTilesForSector).map(t=>worldCell(`cell-${t.col}-${t.row}`));
  for(const a of cells)for(const b of cells)if(adjacentCells(a.id,b.id)){
   for(const mode of ['march','horse'])assert.equal(travelLegHours(a.location,b.location,mode),1,`${city.id}: ${a.location} → ${b.location}`);
   checked++;
  }
 }
 assert.ok(checked>60);assert.equal(cellLegHours('cell-26-28','retiro'),1);
});

test('city preview, actual arrival, fatigue and saved progress agree at the one-hour boundary',()=>{
 let s=initialCampaign(),preview=previewStrategicRoute(s,s.activeSquadId,'cell-26-28');assert.equal(preview.hours,1);
 const start=s.hour,originalFatigue=s.operativeState[3].fatigue;
 s=order(s,preview.action);s=order(s,{type:'advanceStrategicTime',seconds:1800});
 assert.equal(s.location,'retiro');assert.equal(s.squads[0].journey.elapsedSecond,1800);s=saved(s);
 s=order(s,{type:'advanceStrategicTime',seconds:1800});assert.equal(s.location,'cell-26-28');assert.equal(s.hour,start+1);assert.equal(s.squads[0].journey,undefined);assert.equal(s.operativeState[3].fatigue,originalFatigue+2);assert.deepEqual(saved(s),s);
});

test('rural tactical road exits match neighboring roads; off-road sectors keep natural terrain',()=>{
 let checked=0;
 for(const cell of WORLD_CELLS.filter(c=>c.land&&!c.anchor)){
  const plan=worldCellPlan(cell.id),edges=roadEdgesForCell(cell.id);
  for(const [edge,x,y]of [['W',0,8],['E',19,8],['N',2,0],['S',2,15]]){
   assert.equal(plan.tiles[y*20+x].type==='road',edges.includes(edge),`${cell.id}: ${edge}`);
  }
  if(!edges.length)assert.equal(plan.tiles.some(t=>t.type==='road'),false);
  else checked++;
 }
 assert.ok(checked>70);
 const cell=WORLD_CELLS.find(c=>c.land&&!c.anchor&&!c.locality&&roadEdgesForCell(c.id).length===2);
 const expanded=buildSectorMap({sector:cell.location,enemies:[],squad:[]});
 for(const edge of roadEdgesForCell(cell.id))assert.ok(expanded.tiles.some(t=>t.type==='road'&&(edge==='N'?t.y===0:edge==='S'?t.y===expanded.height-1:edge==='W'?t.x===0:t.x===expanded.width-1)));
});

test('old named and diagonal-cell journeys retain their stored leg duration after loading',()=>{
 let named=initialCampaign();named.squads[0].journey={version:1,path:['retiro','buenos_aires'],mode:'march',startedAt:0,legHours:12,elapsed:0,status:'moving',returning:false,reason:null};
 named=saved(named);assert.equal(named.squads[0].journey.legHours,12);
 const early=order(named,{type:'wait',hours:3});assert.equal(early.location,'retiro');assert.equal(early.squads[0].journey.elapsed,3);assert.deepEqual(saved(early),early);
 const cell=initialCampaign();cell.squads[0].journey={version:1,path:['retiro','cell-26-28'],mode:'march',startedAt:0,legHours:2,elapsed:0,status:'moving',returning:false,reason:null};
 assert.equal(saved(cell).squads[0].journey.legHours,2);
 const bad=structuredClone(cell);bad.squads[0].journey.legHours=7;assert.throws(()=>saved(bad),/duración/);
});

test('a saved six-hour horse stage keeps its paid progress and new city routes use physical one-hour steps',()=>{
 let s=initialCampaign();for(const operativeId of s.squad){const mount=withOwnedMount(s);s=order(mount.state,{type:'horseAction',order:{type:'assign',horseId:mount.id,operativeId}});}
 // A declared journey from the preceding save format, already three hours in.
 s.hour=3;s.squads[0].journey={version:1,path:['retiro','buenos_aires'],mode:'horse',startedAt:0,legHours:6,elapsed:3,status:'moving',returning:false,reason:null};s=saved(s);
 s=order(s,{type:'wait',hours:2});assert.equal(s.location,'retiro');assert.equal(s.squads[0].journey.legHours,6);assert.equal(s.squads[0].journey.elapsed,5);s=saved(s);
 s=order(s,{type:'wait',hours:1});assert.equal(s.location,'buenos_aires');assert.equal(s.hour,6);assert.equal(s.squads[0].journey,undefined);
 const preview=previewStrategicRoute(s,s.activeSquadId,'retiro','horse');assert.equal(preview.hours,2);assert.equal(preview.path.length,3);
 s=order(s,preview.action);assert.equal(s.squads[0].journey.legHours,1);s=order(s,{type:'wait',hours:2});assert.equal(s.location,'retiro');assert.equal(s.hour,8);assert.deepEqual(saved(s),s);
});

test('fresh landmarks admit six soldiers from every adjacent land cell without changing their authored core',()=>{
 for(const town of CAMPAIGN_SECTORS){
  const baseline=buildSectorMap({sector:town.id,enemies:[],squad:[]},{restorePrevious:true});
  for(const exit of sectorExits(town.id).filter(e=>adjacentCells(town.id,e.destination))){
   const entry=entryFromSector(exit.destination,town.id),request={sector:town.id,squad:Array.from({length:6},(_,i)=>({id:i,entryReason:'arrival',...entry})),enemies:[],exploration:true};
   const battle=enterSector(request);assert.equal(battle.units.length,6);
   assert.equal(new Set(battle.units.map(u=>`${u.x},${u.y}`)).size,6);
   for(const unit of battle.units){assert.ok(boundaryMatches(battle,unit,entry.entryEdge),`${exit.destination} → ${town.id}`);assert.ok(Number.isFinite(movementStepCost(battle,unit,unit,inwardFromBoundary(unit,entry.entryEdge))));}
   const expanded=buildSectorMap({sector:town.id,enemies:[],squad:[]});
   // Authored walls, doors, furniture and water keep their original identity.
   const dx=(expanded.width-20)/2+(['ensenada','san_nicolas','santa_fe'].includes(town.id)?10:0),dy=(expanded.height-16)/2;
   for(const tile of baseline.tiles.filter(t=>t.x>=dx&&t.x<dx+20&&t.y>=dy&&t.y<dy+16)){
    const retained=expanded.tiles.find(t=>t.x===tile.x&&t.y===tile.y);
    assert.deepEqual(retained,tile,`${town.id}: authored square ${tile.x},${tile.y}`);
   }
   battle.sectorCleared=true;const before=structuredClone(battle.tiles),again=enterSector({...request,squad:[]},battle);assert.deepEqual(again.tiles,before,'reentry preserves existing terrain');
  }
 }
});

test('road speed applies only across a connected road edge and remains symmetric',()=>{
 const edge=ROAD_SEGMENTS.find(({from,to})=>!worldCell(from).locality&&!worldCell(to).locality&&worldCell(from).biome==='plains'&&worldCell(to).biome==='plains');assert.ok(edge);
 assert.equal(cellLegHours(edge.from,edge.to),2);assert.equal(cellLegHours(edge.to,edge.from),2);
 const destination=worldCell(edge.to),field=WORLD_CELLS.find(c=>c.land&&adjacentCells(c.id,destination.id)&&!roadConnects(c.id,destination.id));assert.ok(field);
 assert.equal(cellLegHours(field.location,destination.location),4,'approaching a road across a field pays the field crossing');
 assert.ok(cellTravelPlan({...controlled(),location:edge.from},edge.to,'horse').hours<cellTravelPlan({...controlled(),location:edge.from},edge.to).hours);
});

test('winter closing a Cuyo mountain leg causes a timed return; northern city streets stay open',()=>{
 const s=controlled(),first=WORLD_CELLS.find(c=>c.land&&!c.locality&&cellWinterClosed({hour:2160},c.id)&&WORLD_CELLS.some(n=>n.land&&!n.locality&&adjacentCells(c.id,n.id)&&cellWinterClosed({hour:2160},n.id))),second=WORLD_CELLS.find(n=>n.land&&!n.locality&&adjacentCells(first.id,n.id)&&cellWinterClosed({hour:2160},n.id));
 assert.ok(first&&second);s.hour=2157;s.location=first.location;s.squads[0].location=s.location;for(const id of s.squad)s.operativeState[id].location=s.location;
 let next=order(s,{type:'travel',sector:second.location,queue:true});assert.ok(next.squads[0].journey.legHours>=4);
 next=order(next,{type:'wait',hours:2});assert.equal(next.hour,2159);assert.equal(next.squads[0].journey.elapsed,2);
 next=order(next,{type:'wait',hours:1});assert.equal(next.hour,2160);assert.equal(next.location,first.location);assert.equal(next.squads[0].journey.returning,true);assert.equal(next.squads[0].journey.elapsed,1);assert.equal(next.squads[0].journey.reason,'winter');next=saved(next);
 next=order(next,{type:'wait',hours:1});assert.equal(next.hour,2161);assert.equal(next.location,first.location);assert.equal(next.squads[0].journey,undefined);assert.deepEqual(saved(next),next);
 assert.equal(cellWinterClosed({hour:2160},'jujuy'),false);assert.equal(cellWinterClosed({hour:2160},'cell-13-5'),false);assert.equal(cellLegHours('jujuy','cell-13-5'),1);
});
