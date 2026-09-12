import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {buildBuilding} from '../game/buildings.js';
import {BUILDING_TYPES} from '../game/building-types.js';
const {buildBuildingObjects}=await import('../web/app/TacticalBuildings.tsx');
const project=(x,y)=>({x:(x-y)*26,y:(x+y)*14});
const built=buildBuilding({id:'house',x:2,y:2,width:6,height:5,doors:[{x:4,y:6},{x:5,y:6,open:true}],windows:[{x:7,y:4}]});
const state={tiles:built.tiles,buildings:[built.building]};
const objects=(open)=>buildBuildingObjects({state,project,light:()=>.6,revealed:new Set(open?['house:interior']:[])});
test('unknown interiors retain a complete roof and have no revealed floor details',()=>{
 const closed=objects(false),opened=objects(true);
 assert.equal(closed.filter(o=>o.key.startsWith('architecture-floor')).length,0);
 assert.match(render(closed.find(o=>o.key.startsWith('architecture-roof')).node),/data-roof-form="flat"/);
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
 // The corner starts near the southern edge at project(2.4,2.4).
 const matrix=markup.match(/matrix\(([^)]+)\)/)[1].split(' ').map(Number);
 assert.ok(Math.abs(matrix[4])<1e-9);
 assert.ok(Math.abs(matrix[5]-67.2)<1e-9);
 assert.ok(!/NaN|Infinity/.test(objects(false).map(o=>render(o.node)).join('')));
});

test('doors clear a standing soldier, retain separate leaf states, and cut back to low thresholds',()=>{
 const closed=objects(false),opened=objects(true);
 const door=render(closed.find(o=>o.key==='architecture-4-6-x').node);
 const openDoor=render(closed.find(o=>o.key==='architecture-5-6-x').node);
 assert.match(door,/<rect x="8" y="-48" width="24" height="48" fill="url\(#building-recess\)"/);
 assert.ok(!door.includes('skewY(-25)'));
 assert.match(openDoor,/translate\(8 0\) skewY\(-25\) scale\(\.22 1\)/);
 assert.ok(Object.values(BUILDING_TYPES).every(style=>style.height>=60),'Even a simple farmhouse has headroom above the 48 pixel doorway.');
 const cut=render(opened.find(o=>o.key==='architecture-4-6-x').node);
 assert.match(cut,/data-opening-height="9"/);
 assert.ok(!cut.includes('y="-48"'),'Entering the enlarged house still exposes the floor and occupants.');
});

test('flat roof eaves align with the enlarged wall height without stretching the ground footprint',()=>{
 const roof=render(objects(false).find(o=>o.key==='architecture-roof-house:interior').node);
 const left=state.buildings[0].x-.18,right=state.buildings[0].x+state.buildings[0].width-.82;
 const bottom=state.buildings[0].y+state.buildings[0].height-.82;
 const p=project(left+.4,bottom+.4),q=project(right+.4,bottom+.4);
 const eave=BUILDING_TYPES.house.height+1.6;
 assert.ok(roof.includes(`M${p.x},${p.y-eave}L${q.x},${q.y-eave}`),'Eave endpoints remain on the authored ground corners.');
});

test('revealed room flooring reaches the structural wall planes without an indoor grass strip',()=>{
 const floor=render(objects(true).find(o=>o.key==='architecture-floor-house:interior-6-5').node);
 const frontCorner=project(7.4,6.4);
 assert.ok(floor.includes(`${frontCorner.x},${frontCorner.y}`));
 assert.match(floor,/data-floor-surface="true"[^>]*fill="url\(#terrain-floor\)"/);
});

test('separate roof rooms keep independent facade texture scales',()=>{
 const built=buildBuilding({id:'two-room-house',architecture:'house',x:1,y:1,width:10,height:7});
 const cells=built.building.rooms[0].cells;
 built.building.rooms=[{id:'west',cells:cells.filter(c=>c.x<5)},{id:'east',cells:cells.filter(c=>c.x>=5)}];
 const nodes=buildBuildingObjects({state:{tiles:built.tiles,buildings:[built.building]},project,light:()=>1,revealed:new Set()});
 const markup=nodes.filter(o=>o.key.startsWith('architecture-roof')).map(o=>render(o.node)).join('');
 const ids=[...markup.matchAll(/<pattern id="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,4);
 assert.equal(new Set(ids).size,ids.length,'Different room widths must not share an inherited pattern.');
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
