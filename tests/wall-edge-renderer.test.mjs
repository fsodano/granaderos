import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as markup} from '../web/node_modules/react-dom/server.node.js';
import {buildBuilding as makeBuilding} from '../game/buildings.js';
import {createSceneTerrainCache} from '../game/scene-terrain.js';
import {wallEdgeCenter,wallEdgeCells} from '../game/wall-geometry.js';
import {createBattle,canSee} from '../game/tactical.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {createVariedRoofClimbBattle} from '../web/app/renderer-sandbox/varied-roof-climb-fixture.js';
import {wallEdgeEndpoints} from '../game/wall-geometry.js';
import {entranceFrame} from '../game/building-profile.js';
import {isometricWallEdge} from '../web/lib/editor-wall-edge.js';
import {ARCHITECTURE_REVIEW_TEMPLATES,createArchitectureReviewBattle} from '../web/app/renderer-sandbox/architecture-fixtures.js';
const {Box3,Raycaster,Vector3,Scene,Mesh}=await import('../web/node_modules/three/build/three.module.js');
const {ELEVATION_PIXELS_PER_METRE,surfaceDrawDepth}=await import('../web/lib/tactical-elevation.ts');
const {buildBuilding,buildIndependentWalls}=await import('../web/lib/three/world-buildings.ts');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {createSectorWorld}=await import('../web/lib/three/sector-world.ts');
const {buildBuildingObjects}=await import('../web/app/TacticalBuildings.tsx');
const {worldWallRecords,buildingWallAtPoint}=await import('../web/lib/three/world-wall-records.ts');
const {wallEdgeControlObjects}=await import('../web/app/TacticalWallEdgeControls.tsx');
const {default:TacticalMinimap}=await import('../web/app/TacticalMinimap.tsx');
const T=1.2360585147470482,project=(x,y)=>({x:(x-y)*26,y:(x+y)*14});
function render(battle,cursorLevel=0){const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),input={terrain:battle,revealedRooms:battle.revealedRooms,cursorLevel},building=buildBuilding(battle.buildings[0],input,T,geometry,materials);building.updateMatrixWorld(true);return {building,dispose(){disposeWorldNode(building);geometry.dispose();materials.dispose();}};}
function simple(){const built=makeBuilding({id:'edge-house',x:2,y:2,width:4,height:4,doors:[{x:3,y:6,axis:'x',id:'edge-door'}]});return {...built,width:10,height:10,buildings:[built.building],revealedRooms:[],props:[],lights:[],units:[],npcs:[],artillery:[],smoke:[]};}
function controlPath(edge,height,elevation=0){const [start,end]=wallEdgeEndpoints(edge),a=project(start.x,start.y),b=project(end.x,end.y);a.y-=elevation*ELEVATION_PIXELS_PER_METRE;b.y-=elevation*ELEVATION_PIXELS_PER_METRE;return `M${a.x},${a.y}L${b.x},${b.y}L${b.x},${b.y-height}L${a.x},${a.y-height}Z`;}
function hasFabricPlane(building,height){let found=false;building.traverse(object=>{if(object instanceof Mesh){const positions=object.geometry.getAttribute('position');for(let n=0;n<positions.count;n++)if(Math.abs(positions.getY(n)-height)<1e-5)found=true;}});return found;}
function privateShell(){
 const built=makeBuilding({id:'closed-shell',x:3,y:3,width:5,height:5,doors:[]}),tiles=Array.from({length:100},(_,n)=>({x:n%10,y:Math.floor(n/10),type:'grass',blocked:false,cover:0})),byCell=new Map(built.tiles.map(tile=>[`${tile.x},${tile.y}`,tile]));
 const edges=[...built.wallEdges,{id:'private-door-edge',doorId:'private-door',buildingId:'closed-shell',x:5,y:5,axis:'y',type:'door',open:false,locked:false,blocked:true,blocksSight:true,cover:0},{id:'private-wall-edge',buildingId:'closed-shell',x:6,y:5,axis:'y',type:'wall',blocked:true,blocksSight:true,cover:25}];
 return createBattle([{id:'observer',x:0,y:5}],{width:10,height:10,exploration:true,enemies:[],tiles:tiles.map(tile=>byCell.get(`${tile.x},${tile.y}`)??tile),buildings:[built.building],wallEdges:edges});
}
function minimapEdges(state,selected='observer'){
 return markup(h(TacticalMinimap,{state,units:[],selected,project,width:600,height:600,camera:{x:0,y:0,width:200,height:200},onCenter(){}})).match(/<path[^>]*data-minimap-wall-edge[^>]*>/g)??[];
}

test('minimap keeps unseen openings and breaches at their public static geometry',()=>{
 const state=privateShell(),before=JSON.stringify(state),closed=minimapEdges(state),known=playerKnownBattle(state),changed=structuredClone(state),door=changed.wallEdges.find(edge=>edge.id==='private-door-edge'),wall=changed.wallEdges.find(edge=>edge.id==='private-wall-edge');
 assert.equal(canSee(state,state.units[0],state.wallEdges.find(edge=>edge.id===door.id)),false);assert.equal(canSee(state,state.units[0],state.wallEdges.find(edge=>edge.id===wall.id)),false);
 Object.assign(door,{open:true,broken:true,structureDamage:65,blocked:false,blocksSight:false});Object.assign(wall,{type:'rubble',destroyed:true,structureDamage:100,blocked:false,blocksSight:false});
 assert.equal(canSee(changed,changed.units[0],door),false);assert.equal(canSee(changed,changed.units[0],wall),false);assert.deepEqual(playerKnownBattle(changed),known);assert.deepEqual(minimapEdges(changed),closed,'unseen live changes must not reach minimap colors or remove public wall lines');assert.equal(JSON.stringify(state),before);
});

test('minimap discloses observed edge changes and restricts edges to the selected level',()=>{
 const state=privateShell(),door=state.wallEdges.find(edge=>edge.id==='private-door-edge'),wall=state.wallEdges.find(edge=>edge.id==='private-wall-edge');state.units[0].x=4;state.units[0].y=5;
 assert.equal(canSee(state,state.units[0],door),true);const closed=minimapEdges(state).find(path=>path.includes(door.id));assert.ok(closed.includes('stroke="#786344"'));
 Object.assign(door,{open:true,blocked:false,blocksSight:false});Object.assign(wall,{type:'rubble',destroyed:true,structureDamage:100,blocked:false,blocksSight:false});assert.equal(canSee(state,state.units[0],wall),true);
 const open=minimapEdges(state);assert.ok(open.find(path=>path.includes(door.id)).includes('stroke="#bfac76"'));assert.ok(!open.some(path=>path.includes(wall.id)));
 const upper={id:'upper-private-edge',x:8,y:8,axis:'x',tacticalLevel:1,type:'wall',blocked:true,blocksSight:true};state.wallEdges.push(upper);assert.ok(!minimapEdges(state).some(path=>path.includes(upper.id)));
 state.units.push({...state.units[0],id:'upper-observer',tacticalLevel:1});const upperPaths=minimapEdges(state,'upper-observer');assert.equal(upperPaths.length,1);assert.ok(upperPaths[0].includes(upper.id));
});

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

test('edge controls follow raised building bases and explicit upper independent wall elevation',()=>{
 const state=createVariedRoofClimbBattle('tall-cardinal'),edge=state.wallEdges.find(edge=>edge.type==='door'),center=wallEdgeCenter(edge),args={state,players:[state.units[0]],revealed:new Set(),cursorLevel:0,mode:'move',interactive:true,hover:null,viewport:null,project,onTile(){},onHover(){},renderer:'three'},before=JSON.stringify(state),control=wallEdgeControlObjects(args).find(object=>object.key===`edge-control-${edge.id}`),r=render(state),roofHeight=Math.min(...state.upperSurfaces.filter(surface=>surface.kind==='roof').map(surface=>surface.elevation)),height=(roofHeight-1.2)*ELEVATION_PIXELS_PER_METRE;
 assert.ok(control);assert.equal(control.node.props.children[0].props.d,controlPath(edge,height,1.2));
 assert.equal(control.depth,surfaceDrawDepth(state,center,.02));const fabric=r.building.getObjectByName(`building-fabric:${state.buildings[0].id}`);assert.ok(hasFabricPlane(fabric,1.2),'fabric and controls share the 1.2 m base');assert.ok(hasFabricPlane(fabric,roofHeight),'fabric and controls share the authored roof height');r.dispose();assert.equal(JSON.stringify(state),before);
 const upper={id:'upper-edge',x:8,y:8,axis:'x',type:'door',doorId:'upper-door',tacticalLevel:1,elevation:4.3,obstacleHeight:3.7,open:false,blocked:true,blocksSight:true},platform=createVariedRoofClimbBattle('tall-cardinal');
 platform.wallEdges=[upper];platform.upperSurfaces=platform.upperSurfaces.map(surface=>({...surface,elevation:upper.elevation}));platform.units=platform.units.map((unit,n)=>n?unit:{...unit,x:8,y:7,tacticalLevel:1});
 const upperControl=wallEdgeControlObjects({...args,state:platform,players:[platform.units[0]],cursorLevel:1}).find(object=>object.key==='edge-control-upper-edge'),upperCenter=wallEdgeCenter(upper),saved=JSON.stringify(platform);
 assert.ok(upperControl);assert.equal(upperControl.node.props.children[0].props.d,controlPath(upper,upper.obstacleHeight*ELEVATION_PIXELS_PER_METRE,upper.elevation));assert.equal(upperControl.depth,surfaceDrawDepth(platform,upperCenter,.02));assert.ok(upperControl.depth>upperCenter.x+upperCenter.y,'upper controls use roof painter depth');
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),world=buildIndependentWalls({terrain:platform},T,geometry,materials);world.updateMatrixWorld(true);assert.ok(Math.abs(new Box3().setFromObject(world.getObjectByName('door:upper-door')).min.y-upper.elevation)<1e-5);assert.ok(hasFabricPlane(world,upper.elevation+upper.obstacleHeight),'independent control reaches its authored wall top');disposeWorldNode(world);geometry.dispose();materials.dispose();assert.equal(JSON.stringify(platform),saved);
});

test('SVG raised-wall controls keep the raw base and visible SVG wall height',()=>{
 const state=createVariedRoofClimbBattle('tall-cardinal'),edge=state.wallEdges.find(edge=>edge.type==='door'),revealed=new Set(),before=JSON.stringify(state),control=wallEdgeControlObjects({state,players:[state.units[0]],revealed,cursorLevel:0,mode:'move',interactive:true,hover:null,viewport:null,project,onTile(){},onHover(){}}).find(object=>object.key===`edge-control-${edge.id}`),wall=buildBuildingObjects({state,revealed,project,light:()=>1}).find(object=>object.key===`architecture-${edge.id}-${edge.axis}`);
 assert.ok(control);assert.ok(wall);assert.equal(control.node.props.children[0].props.d,controlPath(edge,wall.node.props['data-wall-height']));const center=wallEdgeCenter(edge);assert.equal(control.depth,center.x+center.y+.02);assert.equal(JSON.stringify(state),before);
});

test('disclosed front and interior edge controls match visible cutaway wall height',()=>{
 const state=createVariedRoofClimbBattle('tall-cardinal'),b=state.buildings[0],partition={id:'cutaway-partition',buildingId:b.id,x:b.x+1,y:b.y+2,axis:'x',type:'wall',blocked:true,blocksSight:true};state.wallEdges.push(partition);state.revealedRooms=b.rooms.map(room=>room.id);
 const revealed=new Set(state.revealedRooms),front=state.wallEdges.find(edge=>edge.axis==='x'&&edge.y===b.y+b.height),before=JSON.stringify(state);
 for(const edge of [front,partition])for(const renderer of ['svg','three']){const player={...state.units[0],x:edge.x,y:edge.y-1},control=wallEdgeControlObjects({state,players:[player],revealed,cursorLevel:0,mode:'move',interactive:true,hover:null,viewport:null,project,onTile(){},onHover(){},renderer}).find(object=>object.key===`edge-control-${edge.id}`);assert.ok(control,`${renderer} ${edge.id} control`);assert.equal(control.node.props.children[0].props.d,controlPath(edge,9,renderer==='three'?1.2:0));}
 const r=render(state);assert.ok(hasFabricPlane(r.building.getObjectByName(`building-fabric:${b.id}`),1.2+9/ELEVATION_PIXELS_PER_METRE),'Three fabric uses the same cutaway plane');r.dispose();assert.equal(JSON.stringify(state),before);
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
