import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup} from '../web/node_modules/react-dom/server.node.js';
import {buildSectorMap} from '../game/maps.js';
import {buildBuilding} from '../game/buildings.js';
import {tileIllumination} from '../game/tactical.js';
import {tacticalViewport} from '../game/tactical-viewport.js';
const {buildBuildingObjects,createBuildingRenderer}=await import('../web/app/TacticalBuildings.tsx');

const project=(x,y)=>({x:1276+(x-y)*26,y:65+(x+y)*14});
const viewAt=(x,y)=>{const p=project(x,y);return tacticalViewport({x:p.x-240,y:p.y-135,width:480,height:270});};
const markup=objects=>objects.map(({key,depth,node})=>({key,depth,html:renderToStaticMarkup(createElement('svg',null,node))}));
const brightness=state=>(x,y)=>state.night?.27+tileIllumination(state,x,y)*.73:1;
const argsFor=(state,revealed=new Set())=>({state,revealed,project,light:brightness(state)});
const firstView=viewAt(23,19),shiftedView=viewAt(27,19),outsideView={x:10000,y:10000,width:400,height:300};

test('cached architectural markup exactly matches a fresh build across pans and room visibility',()=>{
 for(const sector of ['retiro','buenos_aires']){
  const state=buildSectorMap({sector,squad:[],enemies:[]}),before=structuredClone(state);
  for(const revealed of [new Set(),new Set(state.buildings.flatMap(b=>b.rooms.map(r=>r.id)))]){
   const args=argsFor(state,revealed),draw=createBuildingRenderer(args);
   for(const viewport of [firstView,shiftedView,outsideView,firstView,undefined]){
    assert.deepEqual(markup(draw(viewport)),markup(buildBuildingObjects({...args,viewport})),`${sector}: ${JSON.stringify(viewport)}`);
   }
  }
  assert.deepEqual(state,before);
 }
});

test('camera shifts reuse exact retained objects and their JSX without rebuilding lighting',()=>{
 const state=buildSectorMap({sector:'retiro',squad:[],enemies:[]});
 for(const revealed of [new Set(),new Set(state.buildings.flatMap(b=>b.rooms.map(r=>r.id)))]){
  let lightCalls=0;
  const draw=createBuildingRenderer({...argsFor(state,revealed),light:()=>{lightCalls++;return .6;}});
  const first=draw(firstView),before=new Map(first.map(object=>[object.key,object])),initialCalls=lightCalls;
  assert.ok(initialCalls>0);
  const repeat=draw(firstView);
  assert.equal(lightCalls,initialCalls,'an unchanged viewport does not rebuild any lit node');
  for(const object of repeat)assert.equal(object,before.get(object.key));
  const shifted=draw(shiftedView),shared=shifted.filter(object=>before.has(object.key));
  assert.ok(shared.length>1);assert.ok(shifted.some(object=>!before.has(object.key)),'the pan introduces new objects');
  assert.ok(shared.some(object=>object.key.startsWith(revealed.size?'architecture-floor-':'architecture-roof-')));
  for(const object of shared){assert.equal(object,before.get(object.key));assert.equal(object.node,before.get(object.key).node);}
 }
});

test('leaving a viewport evicts its nodes while retaining only objects present in the latest view',()=>{
 const args=argsFor(buildSectorMap({sector:'retiro',squad:[],enemies:[]})),draw=createBuildingRenderer(args);
 const first=draw(firstView),old=new Map(first.map(object=>[object.key,object]));
 assert.ok(first.length>1);
 assert.deepEqual(draw(outsideView).map(object=>object.key),['architecture-materials']);
 const returned=draw(firstView);
 assert.deepEqual(markup(returned),markup(first));
 for(const object of returned){
  if(object.key==='architecture-materials')assert.equal(object,old.get(object.key));
  else {assert.notEqual(object,old.get(object.key));assert.notEqual(object.node,old.get(object.key).node);}
 }
});

test('new state and room factories replace cached doors, breaches, cutaways, and independent roofs',()=>{
 const built=buildBuilding({id:'house',x:2,y:2,width:10,height:7,doors:[{x:4,y:8},{x:9,y:8}]});
 const cells=built.building.rooms[0].cells;
 built.building.rooms=[{id:'west',cells:cells.filter(c=>c.x<7)},{id:'east',cells:cells.filter(c=>c.x>=7)}];
 const state={tiles:built.tiles,buildings:[built.building]},args=argsFor(state),before=createBuildingRenderer(args)();
 const changed=structuredClone(state);
 Object.assign(changed.tiles.find(t=>t.x===4&&t.y===8),{open:true,blocked:false,blocksSight:false});
 Object.assign(changed.tiles.find(t=>t.x===2&&t.y===4),{type:'rubble',blocked:false,blocksSight:false});
 const nextArgs=argsFor(changed),after=createBuildingRenderer(nextArgs)();
 assert.deepEqual(markup(after),markup(buildBuildingObjects(nextArgs)));
 assert.notDeepEqual(markup(after),markup(before));
 assert.equal(after.some(object=>object.key==='architecture-2-4-y'),false);
 const door=after.find(object=>object.key==='architecture-4-8-x');
 assert.match(renderToStaticMarkup(door.node),/skewY\(-25\)/);
 assert.notEqual(door,before.find(object=>object.key===door.key));
 const roomArgs=argsFor(changed,new Set(['west'])),opened=createBuildingRenderer(roomArgs)();
 assert.deepEqual(markup(opened),markup(buildBuildingObjects(roomArgs)));
 assert.deepEqual(opened.filter(object=>object.key.startsWith('architecture-roof-')).map(object=>object.key),['architecture-roof-east']);
 assert.ok(opened.some(object=>object.key.startsWith('architecture-floor-west-')));
 assert.equal(opened.some(object=>object.key.startsWith('architecture-floor-east-')),false);
 assert.match(renderToStaticMarkup(opened.find(object=>object.key==='architecture-4-8-x').node),/data-cutaway="true"/);
 assert.match(renderToStaticMarkup(opened.find(object=>object.key==='architecture-9-8-x').node),/data-cutaway="false"/);
});

test('new lighting and projection factories update brightness and geometry without stale nodes',()=>{
 const built=buildBuilding({id:'house',x:2,y:2,width:6,height:5,doors:[{x:4,y:6,open:true}]});
 const state={width:12,height:12,tiles:built.tiles,buildings:[built.building],night:true,lights:[{x:4,y:7,radius:8,intensity:1}]};
 const revealed=new Set(['house:interior']),args=argsFor(state,revealed),first=createBuildingRenderer(args)();
 const floorKey='architecture-floor-house:interior-4-5',initialFloor=first.find(object=>object.key===floorKey);
 for(const changed of [{...state,lights:[{...state.lights[0],extinguished:true}]},{...state,night:false}]){
  const nextArgs=argsFor(changed,revealed),next=createBuildingRenderer(nextArgs)();
  assert.deepEqual(markup(next),markup(buildBuildingObjects(nextArgs)));
  const floor=next.find(object=>object.key===floorKey);
  assert.notEqual(floor,initialFloor);
  assert.notEqual(renderToStaticMarkup(floor.node),renderToStaticMarkup(initialFloor.node));
  assert.ok(renderToStaticMarkup(floor.node).includes(`brightness(${brightness(changed)(4,5)})`));
 }
 const shiftedArgs={...args,project:(x,y)=>{const p=project(x,y);return {x:p.x+13,y:p.y+7};}};
 const shifted=createBuildingRenderer(shiftedArgs)();
 assert.deepEqual(markup(shifted),markup(buildBuildingObjects(shiftedArgs)));
 assert.notDeepEqual(markup(shifted),markup(first));
});
