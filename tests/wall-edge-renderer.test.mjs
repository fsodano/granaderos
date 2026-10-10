import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as markup} from '../web/node_modules/react-dom/server.node.js';
import {buildBuilding as makeBuilding} from '../game/buildings.js';
import {createSceneTerrainCache} from '../game/scene-terrain.js';
import {wallEdgeCenter,wallEdgeCells} from '../game/wall-geometry.js';
import {entranceFrame} from '../game/building-profile.js';
import {isometricWallEdge} from '../web/lib/editor-wall-edge.js';
import {ARCHITECTURE_REVIEW_TEMPLATES,createArchitectureReviewBattle} from '../web/app/renderer-sandbox/architecture-fixtures.js';
const {Box3,Raycaster,Vector3,Scene,Mesh}=await import('../web/node_modules/three/build/three.module.js');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {createSectorWorld}=await import('../web/lib/three/sector-world.ts');
const {buildBuildingObjects}=await import('../web/app/TacticalBuildings.tsx');
const {worldWallRecords,buildingWallAtPoint}=await import('../web/lib/three/world-wall-records.ts');
const {wallEdgeControlObjects}=await import('../web/app/TacticalWallEdgeControls.tsx');
const T=1.2360585147470482,project=(x,y)=>({x:(x-y)*26,y:(x+y)*14});
function render(battle){const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),input={terrain:battle,revealedRooms:battle.revealedRooms},building=buildBuilding(battle.buildings[0],input,T,geometry,materials);building.updateMatrixWorld(true);return {building,dispose(){disposeWorldNode(building);geometry.dispose();materials.dispose();}};}
function simple(){const built=makeBuilding({id:'edge-house',x:2,y:2,width:4,height:4,doors:[{x:3,y:6,axis:'x',id:'edge-door'}]});return {...built,width:10,height:10,buildings:[built.building],revealedRooms:[],props:[],lights:[],units:[],npcs:[],artillery:[],smoke:[]};}

test('wall fabric is one thin edge; both neighboring cell centres stay clear',()=>{
 const battle=simple(),before=JSON.stringify(battle),r=render(battle),fabric=r.building.getObjectByName('building-fabric:edge-house');
 for(const cell of [{x:2,y:3},{x:1,y:3}])assert.equal(new Raycaster(new Vector3(cell.x*T,1,cell.y*T),new Vector3(0,0,1),0,.20).intersectObject(fabric,true).length,0);
 const hit=new Raycaster(new Vector3(1*T,1,3*T),new Vector3(1,0,0),0,T).intersectObject(fabric,true)[0];assert.ok(hit);assert.ok(Math.abs(hit.point.x-(1.5*T-.09))<1e-5);
 assert.equal(battle.tiles.filter(tile=>tile.blocked).length,0);assert.equal(battle.buildings[0].rooms[0].cells.length,16);assert.equal(JSON.stringify(battle),before);r.dispose();
});

test('disclosed floors cover each whole footprint cell and meet boundary walls',()=>{
 const battle=simple();battle.revealedRooms=battle.buildings[0].rooms.map(room=>room.id);const r=render(battle);
 for(const tile of battle.tiles)for(const [dx,dy]of [[0,0],[-.40,-.40],[.40,.40]]){const hit=new Raycaster(new Vector3((tile.x+dx)*T,.5,(tile.y+dy)*T),new Vector3(0,-1,0),0,.55).intersectObject(r.building,true)[0];assert.ok(hit,`${tile.x},${tile.y} floor`);assert.ok(Math.abs(hit.point.y-.006)<1e-5);}
 const objects=buildBuildingObjects({state:battle,revealed:new Set(battle.revealedRooms),project,light:()=>1});assert.equal(objects.filter(object=>object.key.startsWith('architecture-floor')).length,16);assert.equal(objects.filter(object=>object.key.startsWith('architecture-')&&markup(h('svg',null,object.node)).includes('data-wall-edge=')).length,16);r.dispose();
});

test('native catalogue families retain attached facade geometry through all four rotations',()=>{
 const expected={posta:'posta-corner-piers',barraca:'barracks-gate',casa:'house-facade',capilla:'chapel-piers',iglesia:'church-nave',cabildo:'cabildo-facade',ayuntamiento:'townhall-columns',palacio:'palace-facade',pulperia:'work-porch',almacen:'warehouse-buttresses',deposito:'depot-facade',estancia:'farmhouse-gallery',herreria:'smithy-chimney',caballeriza:'stable-timber-frame'};
 for(const {id}of ARCHITECTURE_REVIEW_TEMPLATES)for(const rotation of [0,90,180,270]){
  const battle=createArchitectureReviewBattle(id,rotation,'exterior'),b=battle.buildings[0],r=render(battle),details=r.building.getObjectByName(`building-details:${b.id}`),frame=entranceFrame(b);assert.equal(frame.width,rotation%180?b.height:b.width);
  const names=[];details.traverse(object=>names.push(object.name));assert.ok(names.some(name=>name.includes(expected[id])),`${id}/${rotation} facade family`);
  const shell=new Box3(new Vector3((b.x-.5)*T,0,(b.y-.5)*T),new Vector3((b.x+b.width-.5)*T,r.building.userData.height+.05,(b.y+b.height-.5)*T));
  const support=shell.clone();support.max.y=new Box3().setFromObject(r.building.getObjectByName(`building-fabric:${b.id}`)).max.y;
  for(const detail of details.children){const box=new Box3().setFromObject(detail);if(!box.isEmpty())assert.ok(box.intersectsBox(support.clone().expandByVector(new Vector3(.65*T,.15,.65*T))),`${id}/${rotation}: attached facade ${detail.name}`);}
  details.traverse(object=>{if(!(object instanceof Mesh)||!object.geometry.getAttribute('position').count)return;const box=new Box3().setFromObject(object);assert.ok([box.min.x,box.min.y,box.min.z,box.max.x,box.max.y,box.max.z].every(Number.isFinite));assert.ok(box.min.x>shell.min.x-1.4*T&&box.max.x<shell.max.x+1.4*T&&box.min.z>shell.min.z-1.4*T&&box.max.z<shell.max.z+1.4*T,`${id}/${rotation}: contained facade`);assert.ok(box.min.y>=-.01,`${id}/${rotation}: supported altitude`);});
  const doors=battle.wallEdges.filter(edge=>edge.type==='door');for(const edge of doors){const center=wallEdgeCenter(edge);assert.ok(r.building.getObjectByName(`door:${edge.doorId}`));const endpoints=wallEdgeCells(edge);assert.equal(Math.abs(endpoints[0].x-center.x)+Math.abs(endpoints[0].y-center.y),.5);}
  r.dispose();
 }
});


test('open edge door apertures clear standing bodies through all catalogue rotations',()=>{
 for(const {id}of ARCHITECTURE_REVIEW_TEMPLATES)for(const rotation of [0,90,180,270]){
  const battle=createArchitectureReviewBattle(id,rotation,'exterior');battle.wallEdges=battle.wallEdges.map(edge=>edge.type==='door'?{...edge,open:true}:edge);const b=battle.buildings[0],r=render(battle);
  for(const edge of battle.wallEdges.filter(edge=>edge.type==='door')){const center=wallEdgeCenter(edge),normal=edge.axis==='x'?new Vector3(0,0,1):new Vector3(1,0,0);for(const height of [1.3,1.8]){const start=new Vector3(center.x*T,height,center.y*T).addScaledVector(normal,-.42*T),hits=new Raycaster(start,normal,0,.84*T).intersectObject(r.building,true);assert.equal(hits.length,0,`${id}/${rotation}: ${edge.doorId} clear standing aperture`);}}
  r.dispose();
 }
});

test('partition endpoints cannot support exterior artwork through an opening',()=>{
 const built=makeBuilding({id:'junction-house',x:2,y:2,width:5,height:5,doors:[{id:'junction-before',x:2,y:3,axis:'y'},{id:'junction-door',x:2,y:4,axis:'y'}]}),partition={id:'partition',buildingId:built.building.id,x:2,y:4,axis:'x',type:'wall'},walls=worldWallRecords({terrain:{tiles:built.tiles,wallEdges:[...built.wallEdges,partition]}}),point={x:1.5,y:3.5};
 assert.equal(buildingWallAtPoint(walls,point,built.building).type,'door');
 assert.equal(buildingWallAtPoint(walls,point,built.building,'wall'),undefined,'the internal T-junction has no facade bearing wall');
 for(const rotation of [0,90,180,270]){
  const battle=createArchitectureReviewBattle('estancia',rotation,'exterior'),b=battle.buildings[0];
  battle.wallEdges=battle.wallEdges.map(edge=>{const perimeter=edge.axis==='x'?edge.y===b.y||edge.y===b.y+b.height:edge.x===b.x||edge.x===b.x+b.width;return perimeter?{...edge,type:'door',doorId:edge.doorId??`opening:${edge.id}`,open:true}:edge;});
  const before=JSON.stringify(battle),r=render(battle),names=[];r.building.traverse(object=>names.push(object.name));
  assert.ok(!names.some(name=>name.includes('farmhouse-chimney')),`${rotation}: Three chimneys need an exterior wall`);
  const svg=buildBuildingObjects({state:battle,revealed:new Set(),project,light:()=>1}).map(object=>markup(h('svg',null,object.node))).join('');
  assert.ok(!svg.includes('farmhouse-chimney'),`${rotation}: SVG chimneys need an exterior wall`);assert.equal(JSON.stringify(battle),before);r.dispose();
 }
});

test('door controls send the edge identity for mouse and keyboard while preserving source coordinates',()=>{
 const battle=createArchitectureReviewBattle('casa',0,'exterior'),unit=battle.units[0],calls=[],objects=wallEdgeControlObjects({state:battle,players:[unit],revealed:new Set(),cursorLevel:0,mode:'move',interactive:true,hover:null,viewport:null,project,onTile:point=>calls.push(point),onHover:()=>{}}),edge=battle.wallEdges.find(edge=>edge.type==='door'),control=objects.find(object=>object.key===`edge-control-${edge.id}`);assert.ok(control);control.node.props.onClick();let prevented=false;control.node.props.onKeyDown({key:'Enter',preventDefault(){prevented=true;}});assert.ok(prevented);assert.equal(calls.length,2);for(const target of calls){assert.equal(target.wallEdgeId,edge.id);assert.equal(target.x,edge.x);assert.equal(target.y,edge.y);assert.equal(target.axis,edge.axis);}
});

test('editor selects every side of a cell and accepts outer footprint boundaries',()=>{
 const box={left:0,top:0,width:1040,height:560},camera={x:0,y:0,width:1040,height:560},origin={x:500,y:40},bounds={width:10,height:10};
 for(const [point,expected]of [[{x:4,y:3.5},{x:4,y:4,axis:'x'}],[{x:4,y:4.5},{x:4,y:5,axis:'x'}],[{x:3.5,y:4},{x:4,y:4,axis:'y'}],[{x:4.5,y:4},{x:5,y:4,axis:'y'}],[{x:9.5,y:4},{x:10,y:4,axis:'y'}]]){const p=project(point.x,point.y);assert.deepEqual(isometricWallEdge({x:p.x+origin.x,y:p.y+origin.y},box,camera,origin,bounds),expected);}
});

test('door and breach changes invalidate retained terrain and Three wall geometry',()=>{
 const battle=simple(),cache=createSceneTerrainCache(),first=cache(battle),changed={...battle,wallEdges:battle.wallEdges.map(edge=>edge.type==='door'?{...edge,open:true}:edge)};assert.notEqual(cache(changed),first);
 delete battle.units;delete battle.npcs;delete changed.units;delete changed.npcs;
 const scene=new Scene(),world=createSectorWorld(scene,{tileMetres:T,assetUrl:path=>path});world.update({terrain:battle});const before=scene.getObjectByName('building:edge-house');world.update({terrain:changed});const after=scene.getObjectByName('building:edge-house');assert.notEqual(before,after);assert.equal(after.getObjectByName('door:edge-door').userData.open,true);
 const breached={...changed,wallEdges:changed.wallEdges.map(edge=>edge.type==='wall'?{...edge,type:'rubble',destroyed:true}:edge)};world.update({terrain:breached});assert.notEqual(scene.getObjectByName('building:edge-house'),after);world.dispose();
});
