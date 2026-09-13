import test from 'node:test';
import assert from 'node:assert/strict';
import {applyRegionalTerrain,regionalLandscape,terrainMaterial} from '../game/regional-terrain.js';
import {buildSectorMap,MAP_IDS} from '../game/maps.js';
import {expandSectorMap} from '../game/sector-expansion.js';
import {enterSector} from '../game/world.js';
import {createBattle,actBattle,movementEnergy,movementStepCost} from '../game/tactical.js';
import {concealmentAt} from '../game/projectile-cover.js';
import {propBlocksAt} from '../game/props.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const key=point=>`${point.x},${point.y}`;
const counts=map=>map.tiles.reduce((result,tile)=>({...result,[tile.type]:(result[tile.type]??0)+1}),{});
const request=sector=>({sector,squad:[{id:'scout',hp:100,weapon:1800,ammo:0}],enemies:[],exploration:true,hour:12});

test('unknown regions cannot select inherited object properties as landscapes',()=>{
 for(const sector of ['not-a-sector','constructor','toString','__proto__',undefined,null]){
  assert.equal(regionalLandscape(sector),'settlement');
  const map={sector,width:8,height:8,tiles:[{x:3,y:3,type:'grass',cover:0,blocked:false}]},before=structuredClone(map);
  assert.equal(applyRegionalTerrain(map,{x:0,y:0,width:1,height:1}),map);
  assert.deepEqual(map,before);
  assert.equal(terrainMaterial(map.tiles[0],sector),'dry-grass');
 }
});

test('new exterior terrain distinguishes wetland, woodland, scrub and dry foothills',()=>{
 const maps=Object.fromEntries(['ensenada','santa_fe','tucuman','cordoba','mendoza'].map(sector=>[sector,buildSectorMap(request(sector))]));
 const terrain=Object.fromEntries(Object.entries(maps).map(([id,map])=>[id,counts(map)]));
 for(const sector of ['ensenada','santa_fe'])assert.ok(terrain[sector].mud>=200,`${sector}: substantial marsh ground`);
 assert.ok(terrain.tucuman.forest>=400,'woodland continues beyond the landmark');
 assert.ok(terrain.cordoba.scrub>=400,'dry scrub has its own cover-bearing terrain');
 assert.ok(terrain.mendoza.stone>=300&&terrain.mendoza.scrub>=300,'foothills contain open stony ground and scrub');
 assert.ok(terrain.tucuman.forest>terrain.mendoza.forest*10);
 for(const map of Object.values(maps)){
  assert.ok(map.tiles.filter(t=>t.type==='forest').every(t=>t.cover>=20));
  assert.ok(map.tiles.filter(t=>t.type==='scrub').every(t=>t.cover>=15&&!t.blocked));
  assert.ok(map.tiles.filter(t=>t.type==='stone'&&t.material==='stone').every(t=>!t.blocked));
 }
});

test('geography does not consume or depend on battle RNG, season or weather',()=>{
 for(const sector of MAP_IDS){
  const dry=buildSectorMap({...request(sector),seed:1,hour:12,weather:{rain:0,humidity:2}});
  const wet=buildSectorMap({...request(sector),seed:9999,hour:5000,weather:{rain:80,humidity:9}});
  assert.deepEqual(wet.tiles,dry.tiles,sector);
  assert.deepEqual(wet.buildings,dry.buildings,sector);
  assert.equal(dry.seed,1);assert.equal(wet.seed,9999);
 }
});

test('regional ground does not alter the authored landmark when expanding compact plans',()=>{
 for(const sector of MAP_IDS){
  const core=buildSectorMap({...request(sector),compactLayout:true});
  const before=structuredClone(core),map=expandSectorMap(core);
  const dx=['ensenada','san_nicolas','santa_fe','san_lorenzo'].includes(sector)?32:22;
  for(const tile of core.tiles){
   // The pre-existing expansion fixes this compact Jujuy doorstep.
   if(sector==='jujuy'&&tile.x===10&&tile.y>=14)continue;
   assert.deepEqual(map.tiles[(tile.y+16)*map.width+tile.x+dx],{...tile,x:tile.x+dx,y:tile.y+16},`${sector}: ${key(tile)}`);
  }
  assert.deepEqual(core,before,'input authored plan remains reusable');
 }
});

test('regional pass preserves obstacles, props, roads, door approaches, deployments and boundary strips',()=>{
 const width=32,height=24;
 const map={sector:'tucuman',width,height,tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',cover:0,blocked:false})),
  buildings:[{x:5,y:5,width:5,height:4}],props:[{x:20,y:5,footprint:{width:3,height:2}}],squad:[{x:20,y:15}],enemies:[{x:25,y:15}],artillery:[{x:25,y:20}],lights:[{x:20,y:20}]};
 for(const [point,change] of [[{x:15,y:2},{type:'road'}],[{x:15,y:3},{type:'wall',blocked:true,cover:40}],[{x:15,y:4},{type:'mud'}],[{x:15,y:5},{buildingId:'interior',type:'grass'}]])Object.assign(map.tiles[point.y*width+point.x],change);
 const before=structuredClone(map),landmark={x:10,y:10,width:5,height:4};
 applyRegionalTerrain(map,landmark);
 const protectedPoints=[{x:15,y:2},{x:15,y:3},{x:15,y:4},{x:15,y:5},{x:4,y:5},{x:7,y:9},{x:10,y:8},{x:20,y:5},{x:22,y:6},{x:19,y:5},{x:20,y:15},{x:24,y:15},{x:25,y:20},{x:20,y:19},{x:10,y:10},{x:14,y:13}];
 for(let x=0;x<width;x++)for(const y of [0,1,height-2,height-1])protectedPoints.push({x,y});
 for(let y=0;y<height;y++)for(const x of [0,1,width-2,width-1])protectedPoints.push({x,y});
 for(const point of protectedPoints)assert.deepEqual(map.tiles[point.y*width+point.x],before.tiles[point.y*width+point.x],key(point));
 assert.ok(map.tiles.some(t=>t.type==='forest'),'the test must leave eligible landscape');
 assert.deepEqual(map.tiles.map(t=>t.blocked),before.tiles.map(t=>t.blocked),'no movement topology changes');
 for(const field of ['buildings','props','squad','enemies','artillery','lights'])assert.deepEqual(map[field],before[field]);
});

test('regional mud consumes extra energy and turn AP, but exploration keeps AP untouched',()=>{
 const map=buildSectorMap(request('ensenada')),state=createBattle(map.squad,map),unit=state.units[0];
 const mud=state.tiles.find(t=>t.type==='mud'&&!t.blocked&&!propBlocksAt(state,t.x,t.y)&&state.tiles.some(p=>p.x===t.x-1&&p.y===t.y&&!p.blocked&&!propBlocksAt(state,p.x,p.y)));
 assert.ok(mud);
 const from=state.tiles.find(t=>t.x===mud.x-1&&t.y===mud.y);
 Object.assign(unit,{x:from.x,y:from.y,energy:100,ap:0});
 const dry={...mud,type:'grass'};
 assert.ok(movementEnergy(unit,mud)>movementEnergy(unit,dry));
 const dryState=structuredClone(state);Object.assign(dryState.tiles[mud.y*state.width+mud.x],dry);
 assert.ok(movementStepCost(state,unit,from,mud)>movementStepCost(dryState,unit,from,dry));
 const moved=actBattle(state,{type:'move',unitId:unit.id,x:mud.x,y:mud.y});
 assert.equal(moved.lastError,null);assert.equal(moved.mode,'exploration');
 assert.equal(moved.units[0].ap,0);assert.equal(moved.units[0].energy,100-movementEnergy(unit,mud));
 const wood=buildSectorMap(request('tucuman')),scrub=buildSectorMap(request('cordoba'));
 assert.ok(concealmentAt(wood,wood.tiles.find(t=>t.type==='forest'))>=20);
 assert.ok(concealmentAt(scrub,scrub.tiles.find(t=>t.type==='scrub'))>=15);
});

test('saved regional ground, breaches and discovered equipment survive a different season',()=>{
 for(const sector of ['ensenada','tucuman','cordoba','mendoza']){
  const req=request(sector),first=enterSector(req);
  const wall=first.tiles.find(t=>t.type==='wall');Object.assign(wall,{blocked:false,blocksSight:false,type:'rubble',cover:20});
  const at=first.units[0];first.groundItems=[{id:'kept',x:at.x,y:at.y,item:'inventory:ammo:musket_75',kind:'ammunition',ammoType:'musket_75',name:'Cartucho de mosquete .75',count:3,weight:.04,type:'item',knownToPlayer:true}];
  const saved=validateBattleSnapshot(JSON.parse(JSON.stringify(first))),before=structuredClone(saved);
  const returned=enterSector({...req,hour:5000,weather:{rain:60,humidity:9}},saved);
  assert.deepEqual(returned.tiles,saved.tiles,sector);assert.deepEqual(returned.groundItems,saved.groundItems,sector);
  assert.deepEqual(saved,before,'reentry does not mutate the saved sector');
 }
});

test('existing terrain textures distinguish wet grass, dry scrub, loose rock and paving',()=>{
 assert.equal(terrainMaterial({type:'grass'},'tucuman'),'green-grass');
 assert.equal(terrainMaterial({type:'grass'},'mendoza'),'dry-grass');
 assert.equal(terrainMaterial({type:'scrub'},'cordoba'),'dry-grass');
 assert.equal(terrainMaterial({type:'mud'},'ensenada'),'mud');
 assert.equal(terrainMaterial({type:'stone',material:'stone'},'mendoza'),'dirt');
 assert.equal(terrainMaterial({type:'stone'},'buenos_aires'),'cobble');
 assert.equal(terrainMaterial({type:'floor',buildingId:'house'},'tucuman'),'floor');
});
