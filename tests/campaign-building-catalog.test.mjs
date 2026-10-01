import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from '../web/node_modules/react-dom/server.node.js';
import {buildSectorMap,MAP_IDS} from '../game/maps.js';
const {buildBuildingObjects}=await import('../web/app/TacticalBuildings.tsx');
const project=(x,y)=>({x:(x-y)*26,y:(x+y)*14});
const render=(state,revealed=new Set(),cursorLevel=0)=>buildBuildingObjects({state,revealed,cursorLevel,project,light:()=>1}).map(o=>renderToStaticMarkup(o.node)).join('');

test('fresh campaign landmarks and neighbourhoods render with the same catalog as editor shells',()=>{
 let checked=0;
 for(const sector of MAP_IDS){
  const map=buildSectorMap({sector,squad:[],enemies:[]}),before=structuredClone(map);
  for(const building of map.buildings){
   assert.ok(building.kind,`${building.id}: catalog kind`);
   if(building.roof==='terrace')continue;
   const state={...map,buildings:[building],tiles:map.tiles.filter(t=>t.buildingId===building.id)};
   const editor=structuredClone(state);delete editor.buildings[0].architecture;
   for(const revealed of [new Set(),new Set([building.rooms[0].id]),new Set(building.rooms.map(r=>r.id))]){
    const actual=render(state,revealed);
    assert.equal(actual,render(editor,revealed),building.id+' uses the editor walls, roof and cutaway');
    assert.ok(!/NaN|Infinity/.test(actual),building.id);
   }
   const exterior=render(state);
   assert.match(exterior,/data-roof-shape=/,building.id);
   assert.ok(!exterior.includes('data-roof-form='),building.id+' cannot silently select the old pitched roof');
   checked++;
  }
  assert.deepEqual(map,before,'rendering cannot alter geometry or save metadata');
 }
 assert.ok(checked>40,'include generated neighbourhoods, not just landmarks');
});

test('catalog selection preserves flat playable terraces and their roof-level inspection',()=>{
 const map=buildSectorMap({sector:'buenos_aires',squad:[],enemies:[]}),house=map.buildings.find(b=>b.architecture==='house'),before=structuredClone(map);
 const state={...map,buildings:[house],tiles:map.tiles.filter(t=>t.buildingId===house.id)},revealed=new Set(house.rooms.map(r=>r.id));
 assert.match(render(state),/data-roof-form="flat"/);
 assert.ok(!render(state,revealed).includes('data-roof-room='));
 assert.match(render(state,revealed,1),/data-roof-form="flat"/);
 assert.ok(map.climbLinks.some(link=>link.id.startsWith(house.id+':')));
 assert.deepEqual(map,before);
});
