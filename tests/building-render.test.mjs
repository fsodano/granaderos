import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {buildBuilding} from '../game/buildings.js';
const {buildBuildingObjects}=await import('../web/app/TacticalBuildings.tsx');
const project=(x,y)=>({x:(x-y)*26,y:(x+y)*14});
const built=buildBuilding({id:'house',x:2,y:2,width:6,height:5,doors:[{x:4,y:6},{x:5,y:6,open:true}],windows:[{x:7,y:4}]});
const state={tiles:built.tiles,buildings:[built.building]};
const objects=(open)=>buildBuildingObjects({state,project,light:()=>.6,revealed:new Set(open?['house:interior']:[])});
test('unknown interiors retain a complete roof and have no revealed floor details',()=>{
 const closed=objects(false),opened=objects(true);
 assert.equal(closed.filter(o=>o.key.startsWith('architecture-floor')).length,0);
 assert.match(render(closed.find(o=>o.key.startsWith('architecture-roof')).node),/data-building-gable="true"/);
 assert.equal(opened.filter(o=>o.key.startsWith('architecture-roof')).length,0);
 const floors=opened.filter(o=>o.key.startsWith('architecture-floor'));
 assert.equal(floors.length,built.building.rooms[0].cells.length);
 assert.ok(floors.every(f=>f.depth<Math.min(...opened.filter(o=>o.key.startsWith('architecture-2')).map(o=>o.depth))));
});
test('front doors, windows and corners cut away without changing collision or door state',()=>{
 const before=JSON.stringify(state),opened=objects(true);
 for(const key of ['architecture-4-6-x','architecture-5-6-x','architecture-7-4-y','architecture-7-6-x','architecture-7-6-y']){
  const markup=render(opened.find(o=>o.key===key).node);
  assert.match(markup,/data-cutaway="true"/);
  assert.match(markup,/pointer-events="none"/);
  assert.match(markup,/brightness\(0.6\)/);
 }
 assert.match(render(opened.find(o=>o.key==='architecture-3-2-x').node),/data-cutaway="false"/);
 assert.equal(JSON.stringify(state),before);
});
test('corner segments meet at the footprint corner instead of projecting half a cell outside',()=>{
 const corner=objects(false).find(o=>o.key==='architecture-2-2-x');
 const markup=render(corner.node);
 // A corner is half a segment, beginning at project(2,2), not project(1.5,2).
 assert.match(markup,/matrix\(0.325 0.175 0 1 0 56\)/);
 assert.ok(!/NaN|Infinity/.test(objects(false).map(o=>render(o.node)).join('')));
});

test('two-cell furniture uses its projected footprint while keeping its height fixed',async()=>{
 const {buildPropObjects}=await import('../web/app/TacticalProps.tsx');
 const prop={id:'long-bed',type:'bed',x:3,y:3,footprint:{width:1,height:2}};
 const objects=buildPropObjects({state:{tiles:[],props:[prop]},project,light:()=>1,revealed:new Set()});
 const markup=render(objects[0].node);
 assert.match(markup,/data-footprint="1x2"/);
 // Foot-end corner is project(3.4,4.4), with the bed surface eight pixels above it.
 const p=project(3,3),end=project(3.4,4.4);
 assert.ok(markup.includes(`${end.x-p.x},${end.y-p.y-8}`));
 assert.equal(objects[0].depth,7.02);
});
