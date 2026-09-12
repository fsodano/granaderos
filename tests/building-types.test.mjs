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

test('roof forms include flat terraces, hipped thatch, a nave and twin warehouse gables',()=>{
 const forms={house:['flat'],farmhouse:['hip'],estancia:['hip','shed'],church:['gable-y'],mansion:['flat','hip'],cabildo:['gable-x'],pulperia:['shed'],warehouse:['gable-y'],barracks:['gable-x']};
 for(const [architecture,expected] of Object.entries(forms)){
  const built=buildBuilding({id:'form',architecture,x:1,y:1,width:6,height:5});
  const nodes=buildBuildingObjects({state:{tiles:built.tiles,buildings:[built.building]},project,light:()=>1,revealed:new Set()});
  const markup=nodes.map(o=>renderToStaticMarkup(o.node)).join('');
  for(const form of expected)assert.ok(markup.includes(`data-roof-form="${form}"`),`${architecture}: ${form}`);
  if(architecture==='warehouse')assert.equal((markup.match(/data-building-gable="true"/g)??[]).length,2);
  if(architecture==='cabildo'){assert.match(markup,/data-cabildo-dome="true"/);assert.match(markup,/data-cabildo-arcade="true"/);}
 }
});

test('Cabildo arcade preserves the visible state of each independently operated door',()=>{
 const built=buildBuilding({id:'c',architecture:'cabildo',x:1,y:1,width:8,height:4,doors:[{id:'left',x:4,y:4,open:true},{id:'right',x:5,y:4}]});
 const markup=buildBuildingObjects({state:{tiles:built.tiles,buildings:[built.building]},project,light:()=>1,revealed:new Set()}).map(o=>renderToStaticMarkup(o.node)).join('');
 assert.match(markup,/data-landmark-door="left"[\s\S]*?width="12"/);
 assert.match(markup,/data-landmark-door="right"[\s\S]*?width="100"/);
});
