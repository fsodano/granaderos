import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSectorMap,MAP_IDS} from '../game/maps.js';
import {OPERATIVES} from '../game/data.js';
import {createBattle,movementStepCost,hasLineOfSight} from '../game/tactical.js';
import {accessStepsFrom,sameCell,spaceKey,surfaceAt,tacticalLevel,validateTacticalSpace} from '../game/tactical-space.js';
import {sectorExits,boundaryMatches,inwardFromBoundary} from '../game/tactical-exits.js';
import {propBlocksAt} from '../game/props.js';
import {obstacleVolumesAt} from '../game/sight-geometry.js';
import {enterSector} from '../game/world.js';

const houseCounts={buenos_aires:4,ensenada:6,san_nicolas:4,santa_fe:4,cordoba:3,mendoza:3,tucuman:4,salta:4,jujuy:4};
const operative=OPERATIVES.find(unit=>unit.id===4);
const request=sector=>({sector,squad:[operative],enemies:[],exploration:true,hour:12});
const point=p=>({x:p.x,y:p.y,tacticalLevel:tacticalLevel(p)});

function groundExitRoutes(state,unit){
 const exits=sectorExits(state.sectorId),walkable=p=>{const surface=surfaceAt(state,p);return surface&&!surface.blocked&&!propBlocksAt(state,p.x,p.y,tacticalLevel(p));};
 const seeds=state.tiles.filter(tile=>walkable(tile)&&exits.some(exit=>boundaryMatches(state,tile,exit.edge)&&Number.isFinite(movementStepCost(state,unit,tile,inwardFromBoundary(tile,exit.edge)))));
 assert.ok(seeds.length,`${state.sectorId}: there must be a real usable sector boundary`);
 const reached=new Set(seeds.map(spaceKey)),queue=seeds.map(point);
 for(let i=0;i<queue.length;i++){
  const from=queue[i],next=accessStepsFrom(state,from);
  for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]])next.push({...point(from),x:from.x+dx,y:from.y+dy});
  for(const to of next){
   if(reached.has(spaceKey(to))||!walkable(to))continue;
   // Both ascent and descent must be legal. The actual movement helper checks
   // supporting floors, diagonal corners, props, stance and authored access.
   if(!Number.isFinite(movementStepCost(state,unit,from,to))||!Number.isFinite(movementStepCost(state,unit,to,from)))continue;
   reached.add(spaceKey(to));queue.push(point(to));
  }
 }
 return reached;
}

for(const sector of MAP_IDS)test(`${sector}: every authored house roof has a legal route to a ground sector exit`,()=>{
 const map=buildSectorMap(request(sector)),state=createBattle(map.squad,{...map,deferContact:true}),before=structuredClone(state);
 const houses=state.buildings.filter(b=>b.architecture==='house'&&b.roof==='terrace');
 assert.equal(houses.length,houseCounts[sector]??0,'current authored house coverage must not silently shrink');
 if(!houses.length){assert.equal(state.upperSurfaces,undefined);assert.equal(state.climbLinks,undefined);return;}
 validateTacticalSpace(state);const reached=groundExitRoutes(state,state.units[0]);
 assert.equal(state.climbLinks.length,houses.length*2-(sector==='jujuy'?1:0));
 for(const building of houses){
  const roof=state.upperSurfaces.filter(surface=>surface.buildingId===building.id),links=state.climbLinks.filter(link=>link.id.startsWith(`${building.id}:climb:`));
  assert.equal(roof.length,building.width*building.height,building.id+' keeps the complete slab');
  assert.ok(links.some(link=>link.id.endsWith(':west')),building.id+' has a west access');
  for(const link of links){
   assert.equal(link.from.tacticalLevel,0);assert.equal(link.to.tacticalLevel,1);
   assert.ok(reached.has(spaceKey(link.from))&&reached.has(spaceKey(link.to)),link.id+' joins the ground exit network');
   assert.equal(surfaceAt(state,link.to).elevation-(surfaceAt(state,link.from).elevation??0),3,'single-storey climb height');
   assert.equal(surfaceAt(state,link.from).buildingId,undefined,'access starts outside the ground room/wall');
   assert.ok(!propBlocksAt(state,link.from.x,link.from.y));
   assert.ok(link.id.endsWith(':west')?link.from.x===building.x-1&&link.to.x===building.x:link.id.endsWith(':north')&&link.from.y===building.y-1&&link.to.y===building.y);
  }
  for(const surface of roof){
   assert.equal(surface.elevation,3);assert.equal(surface.tacticalLevel,1);assert.equal(surface.kind,'roof');
   const chimney=surface.x===building.x+1&&surface.y===building.y+1;
   const parapet=surface.x===building.x+building.width-1||surface.y===building.y+building.height-1;
   assert.equal(surface.blocked,chimney||parapet,`${surface.id}: match the existing house silhouette`);
   const volumes=obstacleVolumesAt(state,surface);
   assert.ok(volumes.some(volume=>volume.kind==='slab'&&volume.solid),surface.id+' keeps its ceiling beneath decor');
   if(surface.blocked){
    assert.ok(surface.cover>0);assert.ok(volumes.some(volume=>volume.kind==='cover'&&volume.blocksSight));
    if(chimney)assert.ok(surface.obstacleHeight>=1.4&&surface.obstacleHeight<=1.5,'chimney reaches its existing cap');
    else assert.ok(surface.obstacleHeight>=.44&&surface.obstacleHeight<=.71,'parapet and optional front ornament height');
   }else assert.ok(reached.has(spaceKey(surface)),`${surface.id}: roof cell must not strand an actor`);
  }
  const interior=roof.find(surface=>!surface.blocked&&surfaceAt(state,{x:surface.x,y:surface.y})?.type==='floor');
  assert.ok(interior,building.id+' retains separate usable ground and roof cells');
  const below={x:interior.x,y:interior.y,hp:100,stance:'standing'},above={...below,tacticalLevel:1};
  assert.equal(hasLineOfSight(state,below,above),false,building.id+' ceiling blocks upward sight');
  assert.equal(hasLineOfSight(state,above,below),false,building.id+' ceiling blocks downward sight');
  const wall=state.tiles.find(tile=>tile.buildingId===building.id&&tile.type==='wall'&&tile.x===building.x&&tile.y>building.y&&tile.y<building.y+building.height-1&&surfaceAt(state,{x:tile.x-1,y:tile.y})&&!surfaceAt(state,{x:tile.x-1,y:tile.y}).blocked&&surfaceAt(state,{x:tile.x+1,y:tile.y})?.type==='floor');
  assert.ok(wall,building.id+' retains a testable ground wall');
  assert.equal(hasLineOfSight(state,{x:wall.x-1,y:wall.y,hp:100},{x:wall.x+1,y:wall.y,hp:100}),false,building.id+' wall still separates the room from the street');
 }
 if(sector==='jujuy')assert.deepEqual(state.climbLinks.filter(link=>link.id.startsWith('jujuy:building:')).map(link=>link.id),['jujuy:building:climb:west'],'the northern cliff must not become an access');
 assert.deepEqual(state,before,'topology queries must not mutate the battle');
});

test('tall mansions and pitched roofs keep their existing architecture and receive no lowered terrace',()=>{
 let houses=0,mansions=0,links=0,walkable=0;
 for(const sector of MAP_IDS){
  const map=buildSectorMap(request(sector));
  for(const building of map.buildings){
   const roof=(map.upperSurfaces??[]).filter(surface=>surface.buildingId===building.id);
   if(building.architecture==='house'&&building.roof==='terrace'){houses++;walkable+=roof.filter(surface=>!surface.blocked).length;}
   else assert.equal(roof.length,0,building.id+' is not a supported single-storey house');
   if(building.architecture==='mansion'){mansions++;assert.equal(building.roof,'terrace','mansion art stays flat and tall, without a 3 m playable floor');}
  }
  links+=(map.climbLinks??[]).length;
 }
 assert.equal(houses,36);assert.equal(links,71);assert.equal(walkable,688);assert.ok(mansions>0);
});

test('explicit empty or custom roof geometry overrides campaign authoring before and after expansion',()=>{
 for(const compactLayout of [true,false]){
  for(const override of [{upperSurfaces:[]},{climbLinks:[]},{upperSurfaces:[],climbLinks:[]}]){
   const input={...request('buenos_aires'),compactLayout,...override},before=structuredClone(input),map=buildSectorMap(input);
   assert.equal((map.upperSurfaces??[]).length,0);assert.equal((map.climbLinks??[]).length,0);assert.deepEqual(input,before);
  }
  const upper={id:'custom:platform',x:17,y:8,tacticalLevel:1,elevation:2.5,type:'floor',kind:'platform',blocked:false,cover:17};
  const link={id:'custom:access',kind:'climb',from:{x:17,y:9,tacticalLevel:0},to:{x:17,y:8,tacticalLevel:1}};
  const input={...request('buenos_aires'),compactLayout,upperSurfaces:[upper],climbLinks:[link]},before=structuredClone(input),map=buildSectorMap(input),dx=compactLayout?0:22,dy=compactLayout?0:16;
  assert.deepEqual(map.upperSurfaces,[{...upper,x:upper.x+dx,y:upper.y+dy}]);
  assert.deepEqual(map.climbLinks,[{...link,from:{...link.from,x:link.from.x+dx,y:link.from.y+dy},to:{...link.to,x:link.to.x+dx,y:link.to.y+dy}}]);
  assert.deepEqual(input,before);validateTacticalSpace({...map,units:[]});
 }
});

test('reentry preserves old decorative roofs and saved custom supports instead of adding current campaign terraces',()=>{
 for(const custom of [false,true]){
  const input={...request('buenos_aires'),upperSurfaces:custom?[{id:'kept:platform',x:17,y:8,tacticalLevel:1,elevation:2.5,type:'floor',kind:'platform',blocked:false,cover:17}]:[],climbLinks:[]};
  const previous=enterSector(input);
  if(!custom){delete previous.upperSurfaces;delete previous.climbLinks;}
  const door=previous.tiles.find(tile=>tile.type==='door');Object.assign(door,{open:true,blocked:false,blocksSight:false});
  const before=structuredClone(previous),returning={...request('buenos_aires'),upperSurfaces:[],climbLinks:[],squad:previous.units.filter(unit=>unit.side==='player').map(unit=>({...unit,entryReason:'resident'}))};
  const returned=enterSector(returning,previous),again=enterSector(returning,returned);
  for(const state of [returned,again]){
   assert.deepEqual(state.upperSurfaces,before.upperSurfaces);assert.deepEqual(state.climbLinks,before.climbLinks);
   assert.deepEqual(state.tiles,before.tiles);assert.deepEqual(state.buildings,before.buildings);assert.deepEqual(state.props,before.props);
   assert.ok(sameCell(state.units[0],before.units[0]));validateTacticalSpace(state);
  }
  assert.deepEqual(previous,before,'the stored old/custom map remains immutable');
 }
});
