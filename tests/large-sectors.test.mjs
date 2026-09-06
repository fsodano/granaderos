import {tacticalGridLabel} from '../game/tactical-grid.js';
import {initialCampaign} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSectorMap,MAP_IDS} from '../game/maps.js';
import {TACTICAL_SIZE} from '../game/sector-expansion.js';
import {CAMPAIGN_SECTORS,OPERATIVES} from '../game/data.js';
import {enterSector} from '../game/world.js';
import {createBattle,getReachable} from '../game/tactical.js';
import {propCells,propBlocksAt} from '../game/props.js';
const key=p=>`${p.x},${p.y}`;
const towns=CAMPAIGN_SECTORS.filter(s=>!['uspallata','los_patos','humahuaca'].includes(s.id));
function reachable(map,start,doors=false){
 const props=new Set(map.props.filter(p=>p.blocksMovement!==false).flatMap(propCells).map(key));
 const available=new Set(map.tiles.filter(t=>(!t.blocked||doors&&t.type==='door')&&!props.has(key(t))).map(key));
 const seen=new Set([key(start)]),queue=[start];
 for(let i=0;i<queue.length;i++)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const p={x:queue[i].x+dx,y:queue[i].y+dy},k=key(p);if(available.has(k)&&!seen.has(k)){seen.add(k);queue.push(p);}}
 return seen;
}
test('all new sectors contain 3072 unique squares and town sectors contain twenty enterable buildings',()=>{
 for(const sector of MAP_IDS){
  const map=buildSectorMap({sector,squad:OPERATIVES.slice(0,6),difficulty:4,cannons:3});
  assert.equal(map.width,TACTICAL_SIZE.width);assert.equal(map.height,TACTICAL_SIZE.height);
  assert.equal(map.tiles.length,3072);assert.equal(new Set(map.tiles.map(key)).size,3072);
  if(towns.some(t=>t.id===sector)){assert.equal(map.buildings.length,20,sector);assert.equal(map.buildings.filter(b=>b.purpose==='bar').length,1,`${sector}: civilian meeting place`);}
  const seen=reachable(map,map.squad[0],true);
  for(const b of map.buildings){
   assert.ok(map.tiles.some(t=>t.buildingId===b.id&&t.type==='door'&&seen.has(key(t))),`${sector}: ${b.id} needs an accessible entrance`);
   assert.ok(b.rooms.every(r=>r.cells.some(t=>seen.has(key(t)))),`${sector}: ${b.id} needs accessible floor`);
  }
  const units=[...map.squad,...map.enemies,...map.artillery];assert.equal(new Set(units.map(key)).size,units.length,sector);
  for(const u of units){assert.ok(seen.has(key(u)),`${sector}: disconnected troop`);assert.ok(!propBlocksAt(map,u.x,u.y));}
 }
});
test('new neighbourhoods leave at least two clear squares between buildings and stay outside the authored landmark',()=>{
 for(const sector of towns){
  const map=buildSectorMap({sector:sector.id});
  for(const b of map.buildings.filter(b=>b.id.includes(':neighbourhood-'))){
   for(const other of map.buildings.filter(o=>o!==b))assert.ok(b.x+b.width+2<=other.x||other.x+other.width+2<=b.x||b.y+b.height+2<=other.y||other.y+other.height+2<=b.y,`${b.id} / ${other.id}`);
   assert.ok(b.x>=2&&b.y>=2&&b.x+b.width<map.width&&b.y+b.height<map.height);
  }
 }
});
test('compact saved sectors keep their geometry, building IDs and ground gear on revisit',()=>{
 const req={sector:'cordoba',squad:[{id:1}],enemies:[],exploration:true};
 const prior=enterSector({...req,compactLayout:true});assert.equal(prior.width,20);
 prior.groundItems=[{id:'retained',type:'item',x:1,y:7,item:'ammo',count:3,weight:.04}];
 const before=structuredClone(prior),again=enterSector(req,prior);
 assert.equal(again.width,20);assert.equal(again.height,16);assert.deepEqual(again.tiles,prior.tiles);assert.deepEqual(again.groundItems,prior.groundItems);assert.deepEqual(prior,before);
});
test('expanded maps are deterministic, validate and retain their geometry on revisit',()=>{
 const req={sector:'mendoza',squad:[{id:1}],enemies:[],exploration:true};
 const a=enterSector(req),b=enterSector(req);assert.deepEqual(a,b);
 const again=enterSector(req,a);assert.equal(again.width,64);assert.deepEqual(again.tiles,a.tiles);assert.deepEqual(again.buildings,a.buildings);
});
test('expanded countryside can be crossed with the normal exploration pathfinder',()=>{
 const map=buildSectorMap({sector:'cordoba',squad:[{id:1}],enemies:[],exploration:true}),battle=createBattle(map.squad,map),u=battle.units[0];
 const reachable=getReachable(battle,u);assert.ok(reachable.some(t=>t.x===0));assert.ok(reachable.some(t=>t.x===63));assert.ok(reachable.some(t=>t.y===0));assert.ok(reachable.some(t=>t.y===47));
});


test('all fifteen expanded locations fit in the existing save limit and round-trip',()=>{
 const s=initialCampaign();
 for(const sector of MAP_IDS){const snapshot=enterSector({sector:sector==='yatasto'?'tucuman':sector,...(sector==='yatasto'?{sceneId:sector}:{}),squad:[],enemies:[],exploration:true});if(sector==='yatasto')s.sceneStates.yatasto=snapshot;else s.sectorStates[sector]=snapshot;}
 const saved=encodeSave(s),restored=decodeSave(saved);
 assert.ok(new TextEncoder().encode(saved).length<5_000_000);
 assert.equal(Object.keys(restored.campaign.sectorStates).length,14);assert.equal(Object.keys(restored.campaign.sceneStates).length,1);
 assert.equal(restored.campaign.sectorStates.retiro.width,64);
});
test('large tactical row labels remain readable after row Z',()=>{
 assert.equal(tacticalGridLabel(0,0),'A1');assert.equal(tacticalGridLabel(19,25),'Z20');assert.equal(tacticalGridLabel(0,26),'AA1');assert.equal(tacticalGridLabel(63,47),'AV64');
});


test('reinforcements without explicit coordinates deploy near the landmark with finite coordinates',()=>{
 const map=buildSectorMap({sector:'san_lorenzo',squad:[{id:1}],enemies:[],garrison:[{id:'militia'}],missionAllies:[{id:57,missionAlly:true}]});
 for(const u of [...map.garrison,...map.missionAllies]){assert.ok(Number.isInteger(u.x)&&Number.isInteger(u.y));assert.ok(u.x>=32&&u.y>=16);}
 const state=enterSector({sector:'san_lorenzo',squad:[{id:1}],enemies:[],garrison:[{id:'militia'}],missionAllies:[{id:57,missionAlly:true}]});
 assert.ok(state.units.every(u=>u.x>=32&&u.y>=16));
});

test('editor structures, contents and provenance move together into the larger map',()=>{
 const request={sector:'cordoba',squad:[{id:1}],enemies:[],exploration:true};
 const core=buildSectorMap({...request,compactLayout:true}),map=buildSectorMap(request);
 assert.equal(map.sourceMapId,core.sourceMapId);assert.equal(map.sourceMapRevision,core.sourceMapRevision);
 for(const original of core.buildings){
  const moved=map.buildings.find(b=>b.id===original.id);
  assert.deepEqual(moved.walls,original.walls.map(w=>({...w,x:w.x+22,y:w.y+16})));
  for(const wall of moved.walls)assert.equal(map.tiles[wall.y*map.width+wall.x].buildingId,moved.id);
 }
 assert.deepEqual(map.groundItems,core.groundItems.map(item=>({...item,x:item.x+22,y:item.y+16})));
 const previous=enterSector(request),again=enterSector(request,previous);
 assert.equal(again.sourceMapId,previous.sourceMapId);assert.equal(again.sourceMapRevision,previous.sourceMapRevision);
});
