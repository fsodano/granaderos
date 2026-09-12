import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from '../web/node_modules/react-dom/server.node.js';
import {BUILDING_TYPES} from '../game/building-types.js';
import {buildBuilding} from '../game/buildings.js';
import {buildSectorMap,MAP_IDS} from '../game/maps.js';
const {buildBuildingObjects}=await import('../web/app/TacticalBuildings.tsx');
const project=(x,y)=>({x:(x-y)*26,y:(x+y)*14});
test('every catalogue building renders a distinct exterior and removes tall details on entry',()=>{
 const exteriors=new Set();
 for(const architecture of Object.keys(BUILDING_TYPES)){
  const built=buildBuilding({id:'test',architecture,x:1,y:1,width:5,height:5,doors:[{x:3,y:5}]});
  const state={tiles:built.tiles,buildings:[built.building]},before=JSON.stringify(state);
  const render=revealed=>buildBuildingObjects({state,project,light:()=>1,revealed}).map(o=>renderToStaticMarkup(o.node)).join('');
  const exterior=render(new Set()),interior=render(new Set(['test:interior']));
  assert.match(exterior,new RegExp(`data-roof-material="${BUILDING_TYPES[architecture].roof}"`));
  assert.equal(exterior.includes('data-building-tower='),Boolean(BUILDING_TYPES[architecture].tower));
  assert.ok(!interior.includes('data-roof-room=')&&!interior.includes('data-building-tower='));
  assert.ok(!/NaN|Infinity/.test(exterior+interior));
  assert.equal(JSON.stringify(state),before);
  exteriors.add(exterior.replaceAll(architecture,'STYLE'));
 }
 assert.equal(exteriors.size,Object.keys(BUILDING_TYPES).length);
});
test('campaign maps actually place every building type and preserve named landmarks',()=>{
 const maps=MAP_IDS.map(sector=>buildSectorMap({sector}));
 const present=new Set(maps.flatMap(m=>m.buildings.map(b=>b.architecture)));
 for(const type of Object.keys(BUILDING_TYPES))assert.ok(present.has(type),type);
 const capital=maps.find(m=>m.sector==='buenos_aires');
 assert.equal(capital.buildings[0].architecture,'cabildo');
 assert.equal(capital.buildings[0].name,'Cabildo de Buenos Aires');
 assert.ok(capital.buildings[0].width>=8);
 assert.ok(capital.buildings.some(b=>b.architecture==='mansion'));
 assert.equal(maps.find(m=>m.sector==='yatasto').buildings[0].architecture,'estancia');
 assert.equal(maps.find(m=>m.sector==='san_lorenzo').buildings[0].architecture,'church');
 assert.ok(new Set(capital.buildings.map(b=>`${b.width}x${b.height}`)).size>=3);
});
