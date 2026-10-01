import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP_LIBRARY} from '../game/map-library.js';
import {compileMap} from '../game/compile-map.js';
import {validateMap} from '../game/map-schema.js';
import {buildSectorMap} from '../game/maps.js';

test('the editable map catalogue provides the current building plans and full campaign sectors',()=>{
 for(const [id,doc]of Object.entries(MAP_LIBRARY)){
  assert.deepEqual(validateMap(doc).errors,[],id);
  const authored=compileMap(doc),map=buildSectorMap({sector:id,squad:[],enemies:[]});
  assert.equal(map.sourceMapRevision,doc.revision,id);
  assert.equal(map.width,64);assert.equal(map.height,48);
  for(const building of authored.buildings){
   const placed=map.buildings.find(b=>b.id===building.id);
   assert.ok(placed,id+': missing landmark');
   assert.equal(placed.width,building.width);assert.equal(placed.height,building.height);
   assert.equal(placed.architecture,building.architecture);
   for(const wall of building.walls){
    const actual=map.tiles.find(t=>t.x===wall.x+placed.x-building.x&&t.y===wall.y+placed.y-building.y);
    assert.equal(actual.type,wall.type);assert.equal(actual.doorId,wall.doorId);
   }
  }
 }
 assert.equal(MAP_LIBRARY.buenos_aires.buildings[0].architecture,'cabildo');
 assert.deepEqual([MAP_LIBRARY.buenos_aires.buildings[0].width,MAP_LIBRARY.buenos_aires.buildings[0].height],[11,6]);
 assert.deepEqual([MAP_LIBRARY.retiro.buildings[0].width,MAP_LIBRARY.retiro.buildings[0].height],[8,4]);
 const city=buildSectorMap({sector:'buenos_aires',squad:[],enemies:[]});
 assert.ok(city.upperSurfaces.length>0);assert.ok(city.climbLinks.length>0);
 const cell=buildSectorMap({sector:'cell-27-27',squad:[],enemies:[]});
 assert.equal(cell.worldCell,true);assert.equal(cell.buildings.length,0);
});

test('editable road anchors reject malformed or duplicated map entries',()=>{
 for(const value of [[{x:2,y:2}],[{x:0,y:-1}],[{x:0,y:3},{x:0,y:3}],{}]){
  const doc=structuredClone(MAP_LIBRARY.retiro);doc.boundaryRoads=value;
  assert.ok(validateMap(doc).errors.length>0);
 }
});
