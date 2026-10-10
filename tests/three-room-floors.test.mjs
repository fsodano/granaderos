import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Raycaster,Scene,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,WorldBatch,cellTop,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding,effectiveRooms,normalizedBuilding}=await import('../web/lib/three/world-buildings.ts');
const {roomFloorFinish,roomFloorPart,floorJointDistance,FLOOR_BOARD_LENGTH,FLOOR_JOINT_HALF_WIDTH}=await import('../web/lib/three/world-room-floors.ts');
const {buildingArtInset,buildingFloorRectangles}=await import('../web/lib/three/world-building-placement.ts');
const {climbOpenings}=await import('../web/lib/three/world-climb-openings.ts');
const {createSectorWorld}=await import('../web/lib/three/sector-world.ts');
const {roomDecorProfile}=await import('../game/room-dressing.js');
const {createArchitectureReviewBattle}=await import('./legacy-building-fixtures.mjs');
const T=1.2360585147470482,options={tileMetres:T,assetUrl:path=>path};
const arrays=mesh=>Object.fromEntries(['position','normal','uv'].map(name=>[name,Array.from(mesh.geometry.getAttribute(name).array)]));
function originalFloors(b0,input,geometry,materials){
 const b=normalizedBuilding(b0),batch=new WorldBatch(geometry),known=effectiveRooms(input),inset=buildingArtInset(b,input),openings=climbOpenings(input,T),base=input.terrain.tiles.find(tile=>tile.x===b.x&&tile.y===b.y)?.elevation??0;
 for(const [index,room]of b.rooms.entries())if(known.has(room.id)){
  const decor=roomDecorProfile(b,room,index),material=materials.terrain(decor.floor==='stone'?'cobble':decor.floor),level=room.tacticalLevel??0;
  for(const cell of room.cells){const cellLevel=cell.tacticalLevel??level,y=(cellLevel?input.terrain.upperSurfaces:input.terrain.tiles)?.find(tile=>tile.x===cell.x&&tile.y===cell.y&&(tile.tacticalLevel??0)===cellLevel)?.elevation??base;for(const rect of buildingFloorRectangles(b,input,{...cell,tacticalLevel:cellLevel,elevation:y},T,openings,inset))cellTop(batch,material,rect.minX,rect.minZ,rect.maxX,rect.maxZ,y+.006);}
 }
 return batch.finish('original-floor');
}

test('room finish keeps the retained metric floor geometry and semantic material at all rotations',()=>{
 const geometry=new WorldGeometry(),materials=new WorldMaterials(options);
 for(const id of ['casa','estancia','palacio','cabildo'])for(const rotation of [0,90,180,270]){
  const battle=createArchitectureReviewBattle(id,rotation,'interior'),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},before=JSON.stringify(input),reference=originalFloors(b,input,geometry,materials),candidate=buildBuilding(b,input,T,geometry,materials).getObjectByName(`building-fabric:${b.id}`);
  for(const old of reference.children){const fresh=candidate.children.find(mesh=>mesh.material.name===old.material.name);assert.ok(fresh);assert.deepEqual(arrays(fresh),arrays(old),'all oriented corners, up normals and continuous metre UVs stay exact');assert.equal(fresh.geometry.getAttribute('position').count/3,old.geometry.getAttribute('position').count/3);assert.equal(fresh.material.roughness,.94);}
  assert.equal(candidate.children.filter(mesh=>mesh.material.name.startsWith('world:terrain-')).length,reference.children.length,'same shared floor batch count');assert.equal(JSON.stringify(input),before);disposeWorldNode(reference);disposeWorldNode(candidate.parent);
 }
 geometry.dispose();materials.dispose();
});

test('common world samples keep same-room cell joints continuous without RNG, time or cell-order dependence',()=>{
 const room={id:'office',name:'Despacho',cells:[{x:1,y:1},{x:2,y:1},{x:1,y:2},{x:2,y:2}]},doors=[{x:1,y:0,type:'door',buildingId:'house'}],finish=roomFloorFinish(room,doors,T,'wood'),repeat=roomFloorFinish({...room,id:'renamed',cells:[...room.cells].reverse()},[...doors].reverse(),T,'wood'),geometry=new WorldGeometry(),materials=new WorldMaterials(options),batch=new WorldBatch(geometry),old=new WorldBatch(geometry);
 for(const cell of room.cells){const rect={minX:(cell.x-.5)*T,maxX:(cell.x+.5)*T,minZ:(cell.y-.5)*T,maxZ:(cell.y+.5)*T};roomFloorPart(batch,materials.roomFloor('wood'),rect,.006,0,.8,finish);cellTop(old,materials.terrain('wood'),rect.minX,rect.minZ,rect.maxX,rect.maxZ,.006,.8);}
 const candidate=batch.finish('floor'),original=old.finish('old');assert.deepEqual(arrays(candidate.children[0]),arrays(original.children[0]));const p=candidate.children[0].geometry.getAttribute('position'),uv=candidate.children[0].geometry.getAttribute('uv'),colour=candidate.children[0].geometry.getAttribute('color'),seen=new Map();
 for(let n=0;n<p.count;n++){const key=[p.getX(n),p.getY(n),p.getZ(n)].join(','),row=[uv.getX(n),uv.getY(n),colour.getX(n),colour.getY(n),colour.getZ(n)];if(seen.has(key))assert.deepEqual(row,seen.get(key),'duplicated cell-edge vertices share exact UV and shade');seen.set(key,row);assert.ok(Math.abs(colour.getX(n)-finish.shade(p.getX(n),p.getZ(n),0)*.8)<1e-6);}
 for(let n=0;n<40;n++){const x=n*.23,z=n*.13;assert.equal(finish.shade(x,z,0),repeat.shade(x,z,0));assert.ok(finish.shade(x,z,0)>=.9325&&finish.shade(x,z,0)<=1.2675);assert.ok(Math.abs(floorJointDistance(x,z)-floorJointDistance(x+FLOOR_BOARD_LENGTH,z))<1e-12);}
 for(const x of [.5*T,1.5*T,2.5*T])for(const mix of [.1,.3,.7,.9]){const z0=.5*T,z1=1.5*T;assert.ok(Math.abs(finish.shade(x,z0+(z1-z0)*mix,0)-(finish.shade(x,z0,0)*(1-mix)+finish.shade(x,z1,0)*mix))<1e-12,'a new clip vertex retains the shade interpolated by its adjacent unsplit cell edge');}
 assert.ok(FLOOR_JOINT_HALF_WIDTH*2>=.025&&FLOOR_JOINT_HALF_WIDTH*2<=.035,'joint width is bounded in metres');assert.ok(floorJointDistance(.825,.05)<1e-12);assert.ok(floorJointDistance(.825,.40)>.2,'board-end columns stagger between existing courses');disposeWorldNode(candidate);disposeWorldNode(original);geometry.dispose();materials.dispose();
});

test('wear reads only adjacent admitted doors at the same level and leaves dirt and ruin floors exact',()=>{
 const room={id:'office',tacticalLevel:0,cells:[{x:1,y:1},{x:2,y:1}]},plain=roomFloorFinish(room,[],T,'wood'),door={x:1,y:0,type:'door'},near=roomFloorFinish(room,[door],T,'wood');assert.ok(near.shade(T,T*.5,0)>plain.shade(T,T*.5,0)+.09);assert.equal(near.shade(T,T*3,0),plain.shade(T,T*3,0));
 for(const invalid of [{...door,tacticalLevel:1},{...door,x:50,y:50}])assert.equal(roomFloorFinish(room,[invalid],T,'wood').shade(T,T*.5,0),plain.shade(T,T*.5,0));assert.equal(near.shade(T,T*.5,1),plain.shade(T,T*.5,1));for(const kind of ['dirt','stone'])assert.equal(roomFloorFinish(room,[door],T,kind).shade(T,T*.5,0),1);
 const materials=new WorldMaterials(options),wood=materials.get('wood'),upperWood=materials.terrain('wood'),floor=materials.roomFloor('wood');assert.equal(materials.roomFloor('wood'),floor);assert.notEqual(upperWood,floor);assert.equal(wood.userData.roomFloorJoints,undefined);assert.equal(upperWood.userData.roomFloorJoints,undefined);assert.equal(floor.name,upperWood.name);assert.equal(floor.userData.roomFloorJoints,true);const shader={fragmentShader:'#include <map_fragment>'};floor.onBeforeCompile(shader,{});assert.ok(shader.fragmentShader.includes('fwidth( vMapUv.x )'));assert.ok(shader.fragmentShader.includes('sampledDiffuseColor.rgb *= 1.0 - 0.44 * floorMask;'));assert.ok(shader.fragmentShader.includes('#ifdef USE_MAP'),'shader work stays inside the existing map branch');let disposed=0;floor.addEventListener('dispose',()=>disposed++);materials.dispose();materials.dispose();assert.equal(disposed,1);
});

test('every clipped floor fragment retains the exact plane and aperture area without a raised seam',()=>{
 const geometry=new WorldGeometry(),materials=new WorldMaterials(options),room={id:'upper',name:'Dormitorio',tacticalLevel:1,cells:[{x:1,y:1,tacticalLevel:1}]},b={id:'house',x:0,y:0,width:4,height:4,kind:'house',rooms:[room]},input={terrain:{width:4,height:4,tiles:[],upperSurfaces:[]}},holes=[{linkId:'a',level:1,height:3,minX:.9,maxX:1.2,minZ:1,maxZ:1.4},{linkId:'b',level:1,height:3,minX:1.3,maxX:1.6,minZ:1.45,maxZ:1.7}],parts=buildingFloorRectangles(b,input,{x:1,y:1,tacticalLevel:1,elevation:3},T,holes,0),batch=new WorldBatch(geometry),old=new WorldBatch(geometry),finish=roomFloorFinish(room,[],T,'wood');
 for(const part of parts){roomFloorPart(batch,materials.roomFloor('wood'),part,3.006,1,1,finish);cellTop(old,materials.terrain('wood'),part.minX,part.minZ,part.maxX,part.maxZ,3.006);}
 const candidate=batch.finish('clipped'),original=old.finish('old');assert.deepEqual(arrays(candidate.children[0]),arrays(original.children[0]));candidate.updateMatrixWorld(true);for(const hole of holes)for(const x of [hole.minX+.001,hole.maxX-.001])for(const z of [hole.minZ+.001,hole.maxZ-.001])assert.equal(new Raycaster(new Vector3(x,3.5,z),new Vector3(0,-1,0),0,1).intersectObject(candidate,true).length,0);for(const part of parts){const hit=new Raycaster(new Vector3((part.minX+part.maxX)/2,3.5,(part.minZ+part.maxZ)/2),new Vector3(0,-1,0),0,1).intersectObject(candidate,true)[0];assert.ok(hit);assert.ok(Math.abs(hit.point.y-3.006)<1e-6);}
 assert.equal(candidate.children.length,1);assert.equal(candidate.children[0].geometry.getAttribute('position').count/3,parts.length*2);disposeWorldNode(candidate);disposeWorldNode(original);geometry.dispose();materials.dispose();
});

test('room admission stays exact and semantic/door edits rebuild only their building with disposal',()=>{
 const building=(id,x)=>({id,x,y:0,width:5,height:5,kind:'house',rooms:[{id:`${id}:office`,name:'Despacho',cells:[{x:x+1,y:1},{x:x+2,y:1}]}]}),a=building('a',0),b=building('b',24),tile=(x,y,type,buildingId)=>({x,y,type,buildingId,elevation:0}),tiles=[tile(1,1,'floor','a'),tile(2,1,'floor','a'),tile(1,0,'door','a'),tile(25,1,'floor','b'),tile(26,1,'floor','b')],terrain={width:32,height:8,tiles,buildings:[a,b]},scene=new Scene(),world=createSectorWorld(scene,options);world.update({terrain,revealedRooms:[]});const root=scene.getObjectByName('sector-world');for(const id of ['a','b'])assert.equal(root.getObjectByName(`building-fabric:${id}`).children.some(m=>m.material.name.startsWith('world:terrain-')),false);
 const input={terrain,revealedRooms:['a:office','b:office']};world.update(input);const first=root.getObjectByName('building:a'),remote=root.getObjectByName('building:b'),mesh=first.getObjectByName('building-fabric:a').children.find(m=>m.material.name==='world:terrain-wood');let released=0;mesh.geometry.addEventListener('dispose',()=>released++);world.update({...input,timeSeconds:9,reducedMotion:true});assert.equal(root.getObjectByName('building:a'),first);
 const revised={...a,rooms:[{...a.rooms[0],purpose:'reception'}]};world.update({...input,terrain:{...terrain,buildings:[revised,b]}});assert.equal(released,1);assert.equal(root.getObjectByName('building:b'),remote);const change=root.getObjectByName('building:a');assert.notEqual(change,first);assert.ok(change.getObjectByName('building-fabric:a').children.some(m=>m.material.name==='world:terrain-floor'));
 world.update({...input,terrain:{...terrain,tiles:tiles.map(t=>t.type==='door'?{...t,x:2}:t),buildings:[revised,b]}});assert.notEqual(root.getObjectByName('building:a'),change);assert.equal(root.getObjectByName('building:b'),remote);world.update({terrain,revealedRooms:['b:office']});assert.equal(root.getObjectByName('building-fabric:a').children.some(m=>m.material.name.startsWith('world:terrain-')),false);world.dispose();
});
