import test from 'node:test';
import assert from 'node:assert/strict';
import {blankMap,validateMap,parseMap,serializeMap,migrateMapDocument} from '../game/map-schema.js';
import {applyMapCommands} from '../game/map-commands.js';
import {compileMap,reachableMap} from '../game/compile-map.js';
import {wallEdgeCells,wallMovementBlocked} from '../game/wall-geometry.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {enterSector} from '../game/world.js';
import {destroyStructure} from '../game/structure-blast.js';
const edit=(doc,commands)=>{const result=applyMapCommands(doc,commands);assert.deepEqual(result.errors,[]);return result.document;};
const house=()=>edit(blankMap({width:12,height:12}),[{type:'addBuilding',building:{id:'house',x:2,y:2,width:5,height:4}}]);

test('new walls leave both adjacent floor cells usable and close only their shared edge',()=>{
 const map=compileMap(house());
 assert.equal(map.tiles.filter(t=>t.buildingId==='house').length,20);
 assert.ok(map.tiles.filter(t=>t.buildingId==='house').every(t=>t.type==='floor'&&!t.blocked));
 for(const edge of map.wallEdges){const [a,b]=wallEdgeCells(edge);assert.equal(wallMovementBlocked(map,a,b),true);assert.equal(wallMovementBlocked(map,b,a),true);}
 const door=map.wallEdges.find(w=>w.type==='door');door.open=true;
 const [a,b]=wallEdgeCells(door);assert.equal(wallMovementBlocked(map,a,b),false);
 assert.equal(wallMovementBlocked(map,{x:3,y:3},{x:4,y:3}),false);
});

test('opening edits distinguish the two edges at a corner and keep stable IDs through transforms',()=>{
 let doc=edit(house(),[{type:'setWall',buildingId:'house',x:2,y:2,axis:'x',wallType:'door',doorId:'north'},{type:'setWall',buildingId:'house',x:2,y:2,axis:'y',wallType:'window'},{type:'setOpeningStyle',buildingId:'house',x:2,y:2,axis:'x',style:'arched'},{type:'setOpeningStyle',buildingId:'house',x:2,y:2,axis:'y',style:'lattice'}]);
 const corner=doc.buildings[0].walls.filter(w=>w.x===2&&w.y===2);
 assert.deepEqual(corner.map(w=>[w.axis,w.type,w.style]).sort(),[['x','door','arched'],['y','window','lattice']]);
 const ids=doc.buildings[0].walls.map(w=>w.id).sort(),before=serializeMap({...doc,revision:0});
 for(let i=0;i<4;i++)doc=edit(doc,[{type:'rotateObject',id:'house'}]);
 assert.equal(serializeMap({...doc,revision:0}),before);
 assert.deepEqual(doc.buildings[0].walls.map(w=>w.id).sort(),ids);
 doc=edit(doc,[{type:'moveObject',id:'house',x:5,y:4}]);
 assert.deepEqual(doc.buildings[0].walls.map(w=>w.id).sort(),ids);
 assert.equal(doc.buildings[0].walls.find(w=>w.doorId==='north').style,'arched');
});

test('room identities stay stable when an internal edge door opens and furniture keeps both approaches clear',()=>{
 let doc=edit(house(),Array.from({length:4},(_,i)=>({type:'setWall',buildingId:'house',x:4,y:2+i,axis:'y',wallType:'wall'})));
 doc=edit(doc,[{type:'setWall',buildingId:'house',x:4,y:3,axis:'y',wallType:'door',doorId:'partition'}]);
 const before=doc.buildings[0].rooms.map(r=>r.id).sort();assert.equal(before.length,2);
 doc=edit(doc,[{type:'setDoor',id:'partition',open:true}]);
 assert.deepEqual(doc.buildings[0].rooms.map(r=>r.id).sort(),before);
 const denied=applyMapCommands(doc,[{type:'addObject',layer:'props',object:{id:'blocked-door',type:'chest',x:4,y:3}}]);
 assert.ok(denied.errors.some(e=>e.includes('puerta')));assert.equal(denied.document,doc);
});

test('schema rejects invalid axes, duplicate edges and edges outside the map before playtest',()=>{
 for(const mutate of [d=>d.buildings[0].walls[0].axis='z',d=>d.buildings[0].walls[0].x=-1,d=>d.buildings[0].walls[0].y=13,d=>d.buildings[0].walls.push({...d.buildings[0].walls[0],id:'duplicate'})]){const doc=house();mutate(doc);assert.equal(validateMap(doc).valid,false);}
 assert.equal(parseMap(serializeMap(house())).schemaVersion,2);
});

test('v1 import moves perimeter structures to edges and keeps door and room identity',()=>{
 const doc=blankMap({width:8,height:8});doc.schemaVersion=1;
 const walls=[];for(let y=2;y<5;y++)for(let x=2;x<6;x++)if(x===2||x===5||y===2||y===4)walls.push({x,y,type:'wall'});
 Object.assign(walls.find(w=>w.x===3&&w.y===4),{type:'door',doorId:'historic-door',open:false,locked:false});
 doc.buildings=[{id:'legacy',x:2,y:2,width:4,height:3,material:'adobe',roof:'tile',walls,rooms:[{id:'historic-room',name:'Archivo',cells:[{x:3,y:3},{x:4,y:3}]}]}];
 const converted=migrateMapDocument(doc),map=compileMap(converted);
 assert.equal(converted.schemaVersion,2);assert.deepEqual(doc.buildings[0].walls,walls);
 assert.equal(map.buildings[0].rooms[0].id,'historic-room');assert.equal(map.buildings[0].rooms[0].name,'Archivo');assert.equal(map.buildings[0].rooms[0].cells.length,12);
 assert.deepEqual(map.wallEdges.filter(w=>w.type==='door').map(w=>[w.doorId,w.x,w.y,w.axis]),[['historic-door',3,5,'x']]);
 assert.ok(reachableMap(map,{x:0,y:0}).has('3,3'));
});

test('edge door state and wall destruction persist in validated snapshots and sector reentry',()=>{
 const request={sector:'yatasto',squad:[{id:1}],enemies:[],exploration:true};
 const previous=enterSector(request),door=previous.wallEdges.find(w=>w.type==='door'),wall=previous.wallEdges.find(w=>w.type==='wall');
 Object.assign(door,{open:true,locked:false,blocked:false,blocksSight:false});destroyStructure(wall,'edge');
 const loaded=validateBattleSnapshot(JSON.parse(JSON.stringify(previous))),entered=enterSector(request,loaded);
 assert.deepEqual(entered.wallEdges,loaded.wallEdges);
 assert.equal(entered.wallEdges.find(w=>w.id===wall.id).destroyed,true);
 assert.equal(entered.wallEdges.find(w=>w.doorId===door.doorId).open,true);
 for(const mutate of [s=>s.wallEdges[0].axis='z',s=>s.wallEdges[0].x=-1,s=>s.wallEdges.push({...s.wallEdges[0],id:'duplicate'})]){const invalid=structuredClone(loaded);mutate(invalid);assert.throws(()=>validateBattleSnapshot(invalid));}
});
