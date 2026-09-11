import test from 'node:test';
import assert from 'node:assert/strict';
import {propCells,propBlocksAt,propPlacementError} from '../game/props.js';
import {createBattle,getReachable,actBattle,hasLineOfSight} from '../game/tactical.js';
import {buildSectorMap,MAP_IDS} from '../game/maps.js';
import {buildBuilding} from '../game/buildings.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {enterSector} from '../game/world.js';
const tiles=Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',blocked:false,cover:0}));
const bed={id:'bed',type:'bed',x:3,y:2,footprint:{width:1,height:2},blocksMovement:true};
const battle=()=>createBattle([{id:1,x:2,y:2}],{width:8,height:8,tiles,props:[bed],exploration:true,enemies:[]});
test('both footprint cells block movement; routes go around and movement cannot enter furniture',()=>{
 const s=battle(),reachable=getReachable(s,'1');
 assert.deepEqual(propCells(bed),[{x:3,y:2},{x:3,y:3}]);
 assert.ok(!reachable.some(c=>propBlocksAt(s,c.x,c.y)));
 const path=reachable.find(c=>c.x===4&&c.y===2).path;
 assert.equal(path.length,4);
 assert.ok(path.every(c=>!propBlocksAt(s,c.x,c.y)));
 const blocked=actBattle(s,{type:'move',unitId:1,x:3,y:3});assert.ok(blocked.lastError);
 const moved=actBattle(s,{type:'move',unitId:1,x:4,y:2});assert.equal(moved.lastError,null);assert.equal(moved.units[0].x,4);
 // Movement collision is independent of visibility and can be changed by code.
 assert.equal(hasLineOfSight(s,{x:2,y:2},{x:4,y:2}),true);
 s.props=[];assert.equal(getReachable(s,'1').find(c=>c.x===4&&c.y===2).path.length,2);
});
test('charges and artillery crew movement cannot pass through furniture',()=>{
 const charge=createBattle([{id:1,x:1,y:2,weapon:1809}],{width:8,height:8,tiles,props:[bed],enemies:[{id:'enemy',x:5,y:2}]});
 const rejected=actBattle(charge,{type:'charge',unitId:1,targetId:'enemy'});
 assert.ok(rejected.lastError);assert.equal(rejected.units[0].x,1);
 const gun=createBattle([{id:1,x:1,y:2},{id:2,x:2,y:1}],{width:8,height:8,tiles,props:[bed],enemies:[{id:'enemy',x:7,y:7}],artillery:[{id:'gun',x:2,y:2,type:'bronze4'}]});
 assert.ok(actBattle(gun,{type:'artilleryMove',unitId:1,artilleryId:'gun',x:3,y:2}).lastError);
 const diagonal=createBattle([{id:1,x:1,y:1,weapon:1809}],{width:8,height:8,tiles,props:[{...bed,x:2,y:1,footprint:{width:1,height:1}}],enemies:[{id:'enemy',x:4,y:4}]});
 assert.match(actBattle(diagonal,{type:'charge',unitId:1,targetId:'enemy'}).lastError,/esquina/);
});
test('placement rejects blocked doors, disconnected aisles and overlapping or out-of-room footprints',()=>{
 const built=buildBuilding({id:'house',x:1,y:1,width:6,height:6,doors:[{x:3,y:6}]}),s={tiles:built.tiles,buildings:[built.building],props:[]};
 const prop={...bed,roomId:'house:interior',x:2,y:2};
 assert.equal(propPlacementError(s,prop),null);
 assert.match(propPlacementError(s,{...prop,x:3,y:4}),/door/);
 assert.match(propPlacementError(s,{...prop,x:1}),/obstacle/);
 assert.match(propPlacementError(s,{...prop,x:4,footprint:{width:1,height:4}}),/walking space/);
 assert.match(propPlacementError({...s,props:[prop]},{...prop,id:'another'}),/overlaps/);
});
test('all authored rooms preserve door access and connected walking space; spawns avoid props',()=>{
 for(const sector of MAP_IDS){
  const s=buildSectorMap({sector,squad:[{id:1}],enemies:[{id:'enemy'}],cannons:1});
  for(const p of s.props){assert.ok(p.footprint);assert.equal(propPlacementError({...s,props:s.props.filter(v=>v.id!==p.id)},p),null,`${sector}: ${p.id}`);}
  for(const entity of [...s.squad,...s.enemies,...s.artillery])assert.equal(propBlocksAt(s,entity.x,entity.y),false,sector);
 }
});
test('footprints persist in saves and re-entry, with safe legacy defaults and malformed data rejection',()=>{
 const s=battle(),loaded=validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
 assert.deepEqual(loaded.props,s.props);assert.ok(propBlocksAt(loaded,3,3));
 const legacy=battle();delete legacy.props[0].footprint;assert.deepEqual(propCells(validateBattleSnapshot(legacy).props[0]),[{x:3,y:2}]);
 for(const footprint of [{width:0,height:2},{width:1.5,height:1},{width:9,height:1},{width:8,height:8},null]){
  const broken=battle();broken.props[0].footprint=footprint;
  assert.throws(()=>validateBattleSnapshot(broken));
 }
 const previous=enterSector({sector:'yatasto',squad:[{id:1}],enemies:[],exploration:true});
 const prop=previous.props[0];assert.ok(prop);previous.units[0].x=prop.x;previous.units[0].y=prop.y;
 const entered=enterSector({sector:'yatasto',squad:[{id:1}],enemies:[],exploration:true},previous);
 assert.deepEqual(entered.props,previous.props);
 assert.equal(propBlocksAt(entered,entered.units[0].x,entered.units[0].y),false);
});
