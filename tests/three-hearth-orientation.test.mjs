import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import {createFurnishingsDetailBattle} from '../web/app/renderer-sandbox/furnishings-detail-fixture.js';
const {Box3,Scene}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildProps,visualPropRotation}=await import('../web/lib/three/world-props.ts');
const {createSectorWorld}=await import('../web/lib/three/sector-world.ts');
const {presentWorld}=await import('../web/lib/three/presentation.ts');
const T=1.2360585147470482,eps=1e-5;
const cells=(width,height)=>Array.from({length:width*height},(_,n)=>({x:1+n%width,y:1+Math.floor(n/width)}));
function input(roomCells=cells(3,5),level=0){
 return {terrain:{tiles:[],buildings:[{id:'home',x:0,y:0,width:7,height:7,rooms:[{id:'kitchen',tacticalLevel:level,cells:roomCells}]}]},revealedRooms:['kitchen']};
}
function hearth(options={}){
 return {id:'kitchen:dressing-0',type:'hearth',roomId:'kitchen',buildingId:'home',decorative:true,generatedRoomDressing:true,blocksMovement:false,x:1,y:1,tacticalLevel:0,footprint:{width:1,height:1},...options};
}
function shapeHash(group){
 const hash=createHash('sha256');
 for(const mesh of group.children){hash.update(mesh.material.name);for(const name of ['position','normal','uv','color'])hash.update(mesh.geometry.getAttribute(name).array);}
 return hash.digest('hex');
}
function render(prop,worldInput){
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),group=buildProps('hearth',[prop],worldInput,T,geometry,materials);
 return {group,dispose(){disposeWorldNode(group);geometry.dispose();materials.dispose();}};
}
function admitted(battle){
 const guard=battle.units[0],terrain={tiles:battle.tiles,buildings:battle.buildings,props:battle.props,night:battle.night};
 return presentWorld(battle,terrain,[guard],new Set(battle.revealedRooms),[{key:`unit:${guard.id}`,kind:'unit',actor:guard}],0);
}

test('generated hearths use the longest inward run in all four directions with stable ties',()=>{
 const cases=[
  [0,hearth({x:2,y:4}),input(cells(3,4))],
  [90,hearth({x:1,y:2}),input(cells(4,3))],
  [180,hearth({x:2,y:1}),input(cells(3,4))],
  [270,hearth({x:4,y:2}),input(cells(4,3))],
  [180,hearth(),input(cells(4,5))],
  [90,hearth(),input(cells(4,4))],
 ];
 for(const [expected,prop,worldInput]of cases){
  const before=structuredClone({prop,worldInput});assert.equal(visualPropRotation(prop,worldInput),expected);
  const reverse=structuredClone(worldInput);reverse.terrain.buildings[0].rooms[0].cells.reverse();assert.equal(visualPropRotation(prop,reverse),expected,'room cell order must not resolve a tie');
  assert.deepEqual({prop,worldInput},before);
 }
 assert.equal(visualPropRotation(hearth({x:1,y:3}),input(cells(3,8))),90,'an opening along a wall must not beat the inward wall normal');
 assert.equal(visualPropRotation(hearth({tacticalLevel:1}),input(cells(3,5),1)),180);
});

test('explicit, authored, undisclosed and unmatched hearths keep their exact default rotation',()=>{
 const base=hearth(),worldInput=input();
 for(const rotation of [0,90,180,270])assert.equal(visualPropRotation({...base,rotation},worldInput),rotation);
 for(const change of [
  {decorative:false},{generatedRoomDressing:false},{generatedRoomDressing:undefined},{type:'table'},{id:'authored-hearth'},{id:'kitchen:dressing-x'},{id:'another-room:dressing-0'},
  {roomId:undefined},{buildingId:undefined},{roomId:'missing'},{buildingId:'missing'},{x:6,y:6},{tacticalLevel:1},
 ])assert.equal(visualPropRotation({...base,...change},worldInput),0,JSON.stringify(change));
 for(const changed of [
  {...worldInput,revealedRooms:[]},
  {...worldInput,revealedRooms:undefined},
  {...worldInput,terrain:{tiles:[]}},
  input([],0),input(cells(3,5),1),input([{x:1,y:1}],0),
 ])assert.equal(visualPropRotation(base,changed),0);
 assert.equal(visualPropRotation(base,{...worldInput,revealedRooms:new Set(['kitchen'])}),180);
 const mixed=input(cells(3,5).map(cell=>({...cell,tacticalLevel:1})),0);assert.equal(visualPropRotation(base,mixed),0,'different-level cells cannot orient a ground hearth');
});

test('derived turns match the entire explicit hearth geometry, light, floor, height and footprint',()=>{
 const positions=[[0,2,4,3,4],[90,1,2,4,3],[180,2,1,3,4],[270,4,2,4,3]];
 for(const [rotation,x,y,width,height]of positions)for(const footprint of [{width:1,height:1},{width:2,height:1},{width:1,height:2}])for(const obstacleHeight of [.4,.7,1])for(const elevation of [0,3]){
  const prop=hearth({x,y,footprint,obstacleHeight,elevation}),worldInput={...input(cells(width,height)),terrain:{...input(cells(width,height)).terrain,night:true},illumination:{[`0:${x},${y}`]:.25}},before=structuredClone({prop,worldInput});
  const derived=render(prop,worldInput),explicit=render({...prop,rotation},worldInput);assert.equal(visualPropRotation(prop,worldInput),rotation);assert.equal(shapeHash(derived.group),shapeHash(explicit.group),'all stone, embers, logs, cookware and attributes must match the existing explicit turn');
  const bounds=new Box3().setFromObject(derived.group),outside=obstacleHeight*.73-.09<.412,visualHeight=outside?Math.max(obstacleHeight,obstacleHeight*.73+.102,.424):obstacleHeight;
  assert.ok(bounds.min.x>=(x-.5)*T-eps&&bounds.max.x<=(x+footprint.width-.5)*T+eps);
  assert.ok(bounds.min.z>=(y-.5)*T-eps&&bounds.max.z<=(y+footprint.height-.5)*T+eps);
  assert.ok(Math.abs(bounds.min.y-elevation)<eps);assert.ok(Math.abs(bounds.max.y-elevation-visualHeight)<eps);
  assert.equal(derived.group.children.length,5);assert.equal(derived.group.children.reduce((n,mesh)=>n+mesh.geometry.getAttribute('position').count/3,0),outside?756:720);
  for(const mesh of derived.group.children)for(const value of mesh.geometry.getAttribute('color').array)assert.ok(Math.abs(value-(.27+.73*.25))<eps);
  assert.deepEqual({prop,worldInput},before);derived.dispose();explicit.dispose();
 }
});

test('room cell changes rebuild only a changed hearth yaw and dispose its old prop batch once',()=>{
 const prop=hearth(),scene=new Scene(),world=createSectorWorld(scene,{tileMetres:T,assetUrl:path=>path}),south={...input(cells(3,5)),terrain:{...input(cells(3,5)).terrain,props:[prop]}},east={...input(cells(5,3)),terrain:{...input(cells(5,3)).terrain,props:[prop]}};
 world.update(south);const root=scene.getObjectByName('sector-world'),first=root.getObjectByName('props:0:0,0');let disposed=0;
 for(const mesh of first.children)mesh.geometry.addEventListener('dispose',()=>disposed++);
 world.update(south);assert.equal(root.getObjectByName('props:0:0,0'),first);assert.equal(disposed,0);
 world.update(east);const second=root.getObjectByName('props:0:0,0');assert.notEqual(second,first);assert.equal(disposed,5);assert.equal(visualPropRotation(prop,east),90);
 const explicit=render({...prop,rotation:90},east);assert.equal(shapeHash(second),shapeHash(explicit.group));explicit.dispose();
 const longer={...input(cells(6,3)),terrain:{...input(cells(6,3)).terrain,props:[prop]}};world.update(longer);assert.equal(root.getObjectByName('props:0:0,0'),second,'a room edit with the same resolved yaw must reuse the prop batch');
 world.update(east);assert.equal(root.getObjectByName('props:0:0,0'),second);assert.equal(disposed,5);
 const removed={...east,terrain:{...east.terrain,props:[]}};world.update(removed);assert.equal(root.getObjectByName('props:0:0,0'),undefined);world.dispose();world.dispose();assert.equal(disposed,5);
});

test('the ordinary furnishings admission turns the visible kitchen hearth without changing snapshots',()=>{
 const battle=createFurnishingsDetailBattle(),before=structuredClone(battle),shown=admitted(battle),prop=shown.terrain.props.find(item=>item.type==='hearth');
 assert.ok(prop);assert.equal(prop.id,'furnishings-detail-house:kitchen:dressing-0');assert.deepEqual([prop.x,prop.y],[10,5]);assert.equal(prop.rotation,undefined);assert.equal(visualPropRotation(prop,shown),180);
 const world=createSectorWorld(new Scene(),{tileMetres:T,assetUrl:path=>path});world.update(shown);assert.ok(world.inspect().semanticIds.includes(`prop:${prop.id}`));
 const hidden=admitted(createFurnishingsDetailBattle('exterior'));assert.equal(hidden.terrain.props.length,0);world.update(hidden);assert.equal(world.inspect().semanticIds.filter(id=>id.startsWith('prop:')).length,0);world.dispose();assert.deepEqual(battle,before);
 assert.equal(prop.rotation,undefined,'derived orientation must not enter the saved or admitted prop');
});

test('an authored decorative hearth cannot claim generated origin through its ID or saved fields',()=>{
 const battle=createFurnishingsDetailBattle(),roomId='furnishings-detail-house:kitchen',authored={id:`${roomId}:dressing-999`,type:'hearth',x:10,y:5,roomId,buildingId:'furnishings-detail-house',decorative:true,generatedRoomDressing:true,blocksMovement:false,footprint:{width:1,height:1}};
 const source={...battle,props:[...battle.props,authored]},before=structuredClone(source),shown=admitted(source),prop=shown.terrain.props.find(item=>item.id===authored.id);
 assert.ok(prop);assert.equal(prop.generatedRoomDressing,false);assert.equal(visualPropRotation(prop,shown),0);assert.equal(prop.rotation,undefined);assert.deepEqual(source,before);
 assert.ok(shown.terrain.props.some(item=>item.type==='hearth'&&item.generatedRoomDressing),'real generated hearth origin must survive the normal admission path');
});
