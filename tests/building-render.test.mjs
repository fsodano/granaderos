import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {buildBuilding} from '../game/buildings.js';
import {entranceFrame,getBuildingProfile} from '../game/building-profile.js';
const {buildBuildingObjects}=await import('../web/app/TacticalBuildings.tsx');
const {buildingRoof}=await import('../web/app/TacticalRoof.tsx');
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
test('partition walls keep their axis and partial roofs use the complete building roof plane',async()=>{
 const {blankMap}=await import('../game/map-schema.js');const {applyMapCommands}=await import('../game/map-commands.js');const {compileMap}=await import('../game/compile-map.js');
 const result=applyMapCommands(blankMap(),[{type:'addBuilding',building:{id:'split',x:2,y:2,width:7,height:7}},...Array.from({length:5},(_,i)=>({type:'setWall',buildingId:'split',x:5,y:3+i,wallType:'wall'})),{type:'setWall',buildingId:'split',x:5,y:5,wallType:'door'}]);
 assert.deepEqual(result.errors,[]);const map=compileMap(result.document);assert.equal(map.buildings[0].rooms.length,2);
 const build=(revealed)=>buildBuildingObjects({state:map,project,light:()=>1,revealed:new Set(revealed)});
 assert.ok(build([]).some(o=>o.key==='architecture-5-4-y'));
 const roofs=build([]).filter(o=>o.key.startsWith('architecture-roof'));assert.equal(roofs.length,1);
 const partial=build([map.buildings[0].rooms[0].id]).filter(o=>o.key.startsWith('architecture-roof'));assert.equal(partial.length,1);assert.match(render(partial[0].node),/data-roof-partial="true"/);assert.ok(!/NaN|Infinity/.test(render(partial[0].node)));
 const fullSurfaces=roofSurfaces(roofs[0].node),partialSurfaces=roofSurfaces(partial[0].node);
 assert.equal(partialSurfaces.length,fullSurfaces.length);
 assert.ok(partialSurfaces.reduce((total,path)=>total+pathArea(path),0)<fullSurfaces.reduce((total,path)=>total+pathArea(path),0));
});
test('building types retain distinctive facades through transforms and cut away for interiors',async()=>{
 const {BUILDING_TEMPLATES}=await import('../game/map-templates.js');const {blankMap}=await import('../game/map-schema.js');const {applyMapCommands}=await import('../game/map-commands.js');const {compileMap}=await import('../game/compile-map.js');
 for(const [id,template] of Object.entries(BUILDING_TEMPLATES)){
  let result=applyMapCommands(blankMap({width:32,height:32}),[{type:'stampTemplate',id,template,x:3,y:3}]);assert.deepEqual(result.errors,[]);
  for(let turn=0;turn<4;turn++){
   const map=compileMap(result.document),b=map.buildings[0];
   const exterior=buildBuildingObjects({state:map,project,light:()=>1,revealed:new Set()});const detail=exterior.find(o=>o.key===`architecture-detail-${b.id}`);
   if(b.kind!=='house'){assert.ok(detail,`${id} detail`);assert.match(render(detail.node),new RegExp(`data-building-kind="${b.kind}"`));assert.ok(!/NaN|Infinity/.test(render(detail.node)));}
   const interior=buildBuildingObjects({state:map,project,light:()=>1,revealed:new Set(b.rooms.map(r=>r.id))});assert.ok(!interior.some(o=>o.key===`architecture-detail-${b.id}`));
   result=applyMapCommands(result.document,[{type:'rotateObject',id:b.id}]);assert.deepEqual(result.errors,[]);
  }
 }
});
test('material and opening families render separately without changing door collision',async()=>{
 const {WALL_FINISHES,DOOR_STYLES,WINDOW_STYLES}=await import('../game/building-appearance.js');const {WallSurface,Opening}=await import('../web/app/TacticalArchitectureMaterials.tsx');const React=await import('../web/node_modules/react/index.js');
 const surfaces=Object.keys(WALL_FINISHES).map(finish=>render(React.createElement('svg',null,React.createElement(WallSurface,{finish,height:46,x:2,y:3}))));assert.equal(new Set(surfaces).size,5);assert.ok(surfaces.every(s=>!s.includes('terrain-plaster')));
 for(const [type,styles] of [['door',DOOR_STYLES],['window',WINDOW_STYLES]]){const result=Object.keys(styles).map(style=>render(React.createElement('svg',null,React.createElement(Opening,{type,style,open:false,trim:'#eee'}))));assert.equal(new Set(result).size,5);assert.ok(result.every(s=>!s.includes('NaN')));}
});

function nodes(node) {
 if(!node||typeof node!=='object')return [];
 if(Array.isArray(node))return node.flatMap(nodes);
 return [node,...nodes(node.props?.children)];
}
function roofSurfaces(node) {
 return nodes(node).filter(n=>n.props?.['data-roof-surface']!==undefined)
  .map(n=>nodes(n.props.children).find(child=>child.type==='path').props.d);
}
function polygons(path) {
 return [...path.matchAll(/M([^MZ]+)Z/g)].map(match=>match[1].split('L').map(point=>point.split(',').map(Number)));
}
function signedPolygonArea(points) {
 return points.reduce((area,[x,y],i)=>{
  const [nextX,nextY]=points[(i+1)%points.length];return area+x*nextY-nextX*y;
 },0)/2;
}
function polygonArea(points) {return Math.abs(signedPolygonArea(points));}
function pathArea(path) {return polygons(path).reduce((area,poly)=>area+polygonArea(poly),0);}
function splitRoofFixture(kind,width=9,height=8) {
 const {building,tiles}=buildBuilding({id:`roof-${kind}`,x:0,y:0,width,height,doors:[{x:2,y:height-1}]});
 const split=Math.floor(width/2),cells=building.rooms[0].cells;
 return {...building,kind,walls:tiles.filter(t=>t.type!=='floor'),rooms:[
  {id:'left',cells:cells.filter(c=>c.x<split)},
  {id:'right',cells:cells.filter(c=>c.x>split)},
 ]};
}
function rotateRoofFixture(building) {
 const copy=structuredClone(building),turn=cell=>({...cell,x:building.x+building.height-1-(cell.y-building.y),y:building.y+(cell.x-building.x)});
 copy.width=building.height;copy.height=building.width;
 copy.walls=copy.walls.map(turn);copy.rooms=copy.rooms.map(room=>({...room,cells:room.cells.map(turn)}));
 return copy;
}

test('partial roofs partition each physical surface without moving its height or losing eaves',()=>{
 for(const kind of ['house','church','smithy']){
  let building=splitRoofFixture(kind);
  for(let turn=0;turn<4;turn++){
   const before=structuredClone(building),full=roofSurfaces(buildingRoof(building,new Set(),project,1)[0].node);
   const halves=['left','right'].map(id=>roofSurfaces(buildingRoof(building,new Set([id]),project,1)[0].node));
   assert.deepEqual(building,before,`${kind} rotation ${turn} must not change the map`);
   for(const [side,path] of full.entries()){
    const complete=pathArea(path),sum=pathArea(halves[0][side])+pathArea(halves[1][side]);
    assert.ok(Math.abs(sum-complete)<Math.max(1e-6,complete*1e-9),`${kind} rotation ${turn} side ${side}: ${sum} must cover ${complete}`);
    for(const half of halves)for(const polygon of polygons(half[side])){
     assert.ok(polygon.flat().every(Number.isFinite));
     // Convex roof panels cannot acquire vertices outside their full projected
     // boundary when a room is revealed. This also catches flattened clip tops.
     const outline=polygons(path)[0];
     for(const point of polygon){
      const signs=outline.map(([x,y],i)=>{const [nx,ny]=outline[(i+1)%outline.length];return (nx-x)*(point[1]-y)-(ny-y)*(point[0]-x);});
      assert.ok(signs.every(value=>value>=-1e-6)||signs.every(value=>value<=1e-6),`${kind} clipped point must remain on its roof panel`);
     }
    }
   }
   assert.deepEqual(buildingRoof(building,new Set(['left','right']),project,1),[]);
   building=rotateRoofFixture(building);
  }
 }
});

test('roof materials retain their physical scale through four building rotations',()=>{
 for(const kind of ['house','church','smithy']){
  let building=splitRoofFixture(kind);const scale=[];
  for(let turn=0;turn<4;turn++){
   const node=buildingRoof(building,new Set(),project,1)[0].node;
   const patterns=nodes(node).filter(n=>n.type==='pattern');
   assert.equal(patterns.length,kind==='house'?4:kind==='church'?2:1);
   assert.equal(entranceFrame(building).side,['south','west','north','east'][turn]);
   const dimensions=patterns.map(n=>[n.props.width,n.props.height]);
   if(turn===0)scale.push(...dimensions);else assert.deepEqual(dimensions,scale);
   for(const pattern of patterns){
    const matrix=pattern.props.patternTransform.match(/matrix\(([^)]+)\)/)[1].split(/\s+/).map(Number);
    assert.equal(matrix.length,6);assert.ok(matrix.every(Number.isFinite));
    assert.ok(Math.hypot(matrix[0],matrix[1])>0);assert.ok(Math.hypot(matrix[2],matrix[3])>0);
   }
   const markup=render(h('svg',null,node));assert.ok(!/NaN|Infinity/.test(markup));
   building=rotateRoofFixture(building);
  }
 }
});

test('gable and shed infill reach their roof planes at the wall lines',()=>{
 for(const kind of ['church','smithy']){
  const building=splitRoofFixture(kind),frame=entranceFrame(building),profile=getBuildingProfile(building);
  const node=buildingRoof(building,new Set(),project,1)[0].node;
  const vertices=nodes(node).filter(n=>n.props?.['data-building-gable'])
   .flatMap(n=>polygons(nodes(n.props.children).find(child=>child.type==='path').props.d)).flat();
  const base=profile.wallHeight+1,rise=Math.min(profile.roofRise,Math.max(10,frame.width*7));
  for(const u of [0,frame.width])for(const depth of [0,frame.depth]){
   const height=kind==='smithy'?base+rise*(depth+profile.eave)/(frame.depth+2*profile.eave):base+rise*profile.eave/(frame.width/2+profile.eave);
   const world=frame.at(u,depth),point=project(world.x,world.y);
   assert.ok(vertices.some(([x,y])=>Math.abs(x-point.x)<1e-6&&Math.abs(y-(point.y-height))<1e-6),`${kind} infill must meet roof at ${u},${depth}`);
  }
 }
});

test('a maximum-size partially revealed roof has bounded SVG complexity and preserves its model',()=>{
 const building=splitRoofFixture('house',64,64),before=structuredClone(building),revealed=new Set(['left']);
 const node=buildingRoof(building,revealed,project,1)[0].node,markup=render(h('svg',null,node));
 assert.ok(nodes(node).length<1500,'roof detail must not create a DOM element per tile facet');
 assert.ok(markup.length<2*1024*1024,'room clipping must keep a bounded SVG path payload');
 assert.ok(!/NaN|Infinity/.test(markup));
 assert.deepEqual(building,before);assert.deepEqual([...revealed],['left']);
 assert.match(markup,/data-roof-partial="true"/);
});

test('minimum-width and minimum-depth shells keep finite nonzero roof texture axes',()=>{
 for(const kind of ['house','posta','barracks','church','chapel','cabildo','townhall','palace','pulperia','warehouse','depot','farmhouse','smithy','stable']){
  for(const [width,height] of [[3,3],[3,64],[64,3]]){
   const built=buildBuilding({id:`narrow-${kind}`,x:0,y:0,width,height,doors:[{x:Math.floor(width/2),y:height-1}]});
   let building={...built.building,kind,walls:built.tiles.filter(t=>t.type!=='floor')};
   for(let turn=0;turn<4;turn++){
    const node=buildingRoof(building,new Set(),project,1)[0].node;
    for(const pattern of nodes(node).filter(n=>n.type==='pattern')){
     const values=pattern.props.patternTransform.match(/matrix\(([^)]+)\)/)[1].split(/\s+/).map(Number);
     assert.ok(values.every(Number.isFinite),`${kind} ${width}×${height} rotation ${turn}`);
     assert.ok(Math.hypot(values[0],values[1])>1e-6);
     assert.ok(Math.hypot(values[2],values[3])>1e-6);
    }
    assert.ok(nodes(node).filter(n=>n.type==='path').every(n=>!(/NaN|Infinity/.test(n.props.d??''))));
    building=rotateRoofFixture(building);
   }
  }
 }
});

function intersectConvex(subject,boundary) {
 let output=subject;const sign=Math.sign(signedPolygonArea(boundary));
 for(const [i,[x,y]] of boundary.entries()){
  const [nx,ny]=boundary[(i+1)%boundary.length],side=([px,py])=>sign*((nx-x)*(py-y)-(ny-y)*(px-x));
  const input=output;output=[];
  for(const [j,a] of input.entries()){
   const b=input[(j+1)%input.length],sa=side(a),sb=side(b);
   if(sa>=-1e-8)output.push(a);
   if((sa>=0)!==(sb>=0)){const t=sa/(sa-sb);output.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
 }
 return output;
}

test('mitring a canopy changes its boundary without skewing the roof tile courses',async()=>{
 const {ProjectedRoofSurface}=await import('../web/app/TacticalBuildingVolumes.tsx');
 let rectangle=[{x:0,y:0,z:20},{x:10,y:0,z:20},{x:10,y:2,z:30},{x:0,y:2,z:30}];
 let mitred=[...rectangle.slice(0,3),{x:1,y:2,z:30}];
 const matrix=points=>{
  const node=ProjectedRoofSurface({id:'canopy',points,project});
  const pattern=nodes(node).find(n=>n.type==='pattern');
  assert.ok(pattern,'a nonzero canopy has a roof texture');
  return pattern.props.patternTransform.match(/matrix\(([^)]+)\)/)[1].split(/\s+/).map(Number);
 };
 for(let turn=0;turn<4;turn++){
  const expected=matrix(rectangle),actual=matrix(mitred);
  actual.forEach((value,i)=>assert.ok(Math.abs(value-expected[i])<1e-9,`rotation ${turn}: clipping the high edge must preserve texture axis ${i}`));
  const rotate=p=>({...p,x:-p.y,y:p.x});
  rectangle=rectangle.map(rotate);mitred=mitred.map(rotate);
 }
});

test('a steep narrow hip culls its rear face without opening a hole in the roof',()=>{
 let building=splitRoofFixture('house',64,3);
 for(let turn=0;turn<4;turn++){
  const frame=entranceFrame(building),profile=getBuildingProfile(building),node=buildingRoof(building,new Set(),project,1)[0].node;
  const surfaces=roofSurfaces(node).map(path=>polygons(path)[0]);
  assert.equal(surfaces.length,3,`rotation ${turn} must omit the occluded hip end`);
  assert.ok(surfaces.every(poly=>signedPolygonArea(poly)<-1e-6),'visible hip faces must retain front-facing winding');
  const e=profile.eave,base=profile.wallHeight+1,rise=Math.min(profile.roofRise,Math.max(10,frame.width*7)),inset=Math.min(frame.width*.44,frame.depth*.3);
  const vertex=(u,d,z)=>{const world=frame.at(u,d),point=project(world.x,world.y);return [point.x,point.y-z];};
  const ends=[
   [vertex(frame.width+e,-e,base),vertex(-e,-e,base),vertex(frame.width/2,inset,base+rise)],
   [vertex(-e,frame.depth+e,base),vertex(frame.width+e,frame.depth+e,base),vertex(frame.width/2,frame.depth-inset,base+rise)],
  ];
  const rear=ends.find(poly=>signedPolygonArea(poly)>0);assert.ok(rear);
  // The removed face lies behind the union of visible roof surfaces. Thus
  // culling cannot expose the hollow interior or depend on an invented wall.
  const covered=surfaces.reduce((area,poly)=>area+polygonArea(intersectConvex(rear,poly)),0);
  assert.ok(Math.abs(covered-polygonArea(rear))<1e-5,`rotation ${turn} must keep a closed roof silhouette`);
  building=rotateRoofFixture(building);
 }
});
