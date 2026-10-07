import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Mesh,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {buildingArtInset,buildingFloorRectangles}=await import('../web/lib/three/world-building-placement.ts');
const {entranceFrame,getBuildingProfile}=await import('../game/building-profile.js');
const {roomDecorProfile}=await import('../game/room-dressing.js');
const {ARCHITECTURE_REVIEW_TEMPLATES,createArchitectureReviewBattle}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const T=1.2360585147470482,V=25.066666666666666,rotations=[0,90,180,270];
function fixture(id,rotation,view='exterior',roof='original'){
 const battle=createArchitectureReviewBattle(id,rotation,view,roof),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},frame=entranceFrame({...b,walls:battle.tiles}),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 return {b,input,frame,build(){const before=JSON.stringify(input),building=buildBuilding(b,input,T,geometry,materials);building.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before);return building;},dispose(building){disposeWorldNode(building);geometry.dispose();materials.dispose();}};
}

test('only warehouse, posta and supported authored house, stable and farmhouse templates without corner openings use a centred shell',()=>{
 for(const {id}of ARCHITECTURE_REVIEW_TEMPLATES)for(const rotation of rotations){const f=fixture(id,rotation);assert.equal(buildingArtInset(f.b,f.input),['almacen','posta','casa','caballeriza','estancia'].includes(id)?0:.4);f.dispose(f.build());}
 for(const id of ['almacen','posta','casa','caballeriza','estancia'])for(const rotation of rotations)for(const type of ['door','window'])for(const corner of ['near','far']){
  const f=fixture(id,rotation),tile=f.input.terrain.tiles.find(tile=>tile.x===(corner==='near'?f.b.x:f.b.x+f.b.width-1)&&tile.y===(corner==='near'?f.b.y:f.b.y+f.b.height-1));tile.type=type;tile.doorId='edited-corner';assert.equal(buildingArtInset(f.b,f.input),.4);const building=f.build(),opening=building.userData.openings.find(opening=>opening.id==='edited-corner'),lower=f.b.y+.4,upper=f.b.y+f.b.height-1+.4,first=Math.max(tile.y-.5,lower)*T,last=Math.min(tile.y+.5,upper)*T;
  assert.equal(opening.width,Math.min(.60*T,(last-first)*.65),'the clipped original corner opening width must be retained exactly');if(type==='door'){const hinge=building.getObjectByName('door:edited-corner').children[0];assert.equal(hinge.position.x,(tile.x+.4)*T);assert.equal(hinge.position.z,(first+last)*.5-opening.width*.5,'the original clipped doorway crossing must retain its centre');}f.dispose(building);
 }
});

test('normal warehouse, posta, house, stable and farmhouse room disclosure retains the floor finish right up to each centred wall',()=>{
 for(const id of ['almacen','posta','casa','caballeriza','estancia'])for(const rotation of rotations){
  const f=fixture(id,rotation,'interior'),building=f.build(),cells=f.b.rooms.flatMap((room,index)=>room.cells.map(cell=>({...cell,roomIndex:index}))),x1=f.b.x+f.b.width-1,y1=f.b.y+f.b.height-1;
  for(const [side,target]of [['left',f.b.x+1],['right',x1-1],['north',f.b.y+1],['south',y1-1]]){const cell=cells.find(cell=>['left','right'].includes(side)?cell.x===target:cell.y===target);assert.ok(cell);const x=side==='left'?f.b.x*T+.13:side==='right'?x1*T-.13:cell.x*T,z=side==='north'?f.b.y*T+.13:side==='south'?y1*T-.13:cell.y*T,decor=roomDecorProfile(f.b,f.b.rooms[cell.roomIndex],cell.roomIndex),expected=`world:terrain-${decor.floor==='stone'?'cobble':decor.floor}`,hit=new Raycaster(new Vector3(x,.50,z),new Vector3(0,-1,0),0,.6).intersectObject(building,true)[0];assert.ok(hit,'the wall-side floor strip must be filled');assert.ok(Math.abs(hit.point.y-.006)<1e-6);assert.equal(hit.object.material.name,expected,'the return must keep the disclosed room’s authored floor finish');}
  assert.equal(building.getObjectByName(`building-detail:${f.b.id}:warehouse-buttresses`),undefined);f.dispose(building);
 }
});

test('centred warehouse supports expose equal physical relief and retain their intact side-wall cells at four rotations',()=>{
 for(const rotation of rotations){
  const f=fixture('almacen',rotation),building=f.build(),support=building.getObjectByName(`building-detail:${f.b.id}:warehouse-buttresses`),fabric=building.getObjectByName(`building-fabric:${f.b.id}`);assert.ok(support);
  for(const u of [0,f.frame.width])for(let v=2;v<f.frame.depth;v+=3){const p=f.frame.at(u,v);if(f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y)?.type!=='wall')continue;const sign=u===0?-1:1,out=new Vector3(sign*f.frame.u.x,0,sign*f.frame.u.y),start=new Vector3(p.x*T,1,p.y*T).addScaledVector(out,2*T),ray=new Raycaster(start,out.clone().negate(),0,3*T),body=ray.intersectObject(support,true)[0],wall=ray.intersectObject(fabric,true)[0];assert.ok(body&&wall);assert.ok(Math.abs(wall.distance-body.distance-(.39*T-.09))<1e-5,'both sides must expose the same approximately 39 cm masonry depth');}
  support.traverse(child=>{if(child instanceof Mesh){const p=child.geometry.getAttribute('position');for(let n=0;n<p.count;n++)assert.equal(f.input.terrain.tiles.find(tile=>tile.x===Math.round(p.getX(n)/T)&&tile.y===Math.round(p.getZ(n)/T))?.type,'wall');}});f.dispose(building);
 }
});

test('centred warehouse roof, gables and open door crossing join the actual shell through every rotation',()=>{
 for(const rotation of rotations){
  const f=fixture('almacen',rotation),door=f.frame.door;door.open=true;const building=f.build(),fabric=building.getObjectByName(`building-fabric:${f.b.id}`),height=building.userData.height,profile=getBuildingProfile(f.b),roof=fabric.children.find(child=>child.material.name==='world:aged');assert.ok(roof);const p=roof.geometry.getAttribute('position'),xs=[],zs=[];for(let n=0;n<p.count;n++){xs.push(p.getX(n));zs.push(p.getZ(n));}assert.ok(Math.abs(Math.min(...xs)-(f.b.x-profile.eave)*T)<1e-5);assert.ok(Math.abs(Math.max(...xs)-(f.b.x+f.b.width-1+profile.eave)*T)<1e-5);assert.ok(Math.abs(Math.min(...zs)-(f.b.y-profile.eave)*T)<1e-5);assert.ok(Math.abs(Math.max(...zs)-(f.b.y+f.b.height-1+profile.eave)*T)<1e-5);
  const rise=Math.min(profile.roofRise/V,Math.max(.4,f.frame.width*.28)),gable=fabric.children.find(child=>child.material.name==='world:stone'),positions=gable.geometry.getAttribute('position');for(const v of [0,f.frame.depth])for(const u of [0,f.frame.width*.5,f.frame.width]){const point=f.frame.at(u,v),y=height+(u===f.frame.width*.5?rise:0);assert.ok(Array.from({length:positions.count},(_,n)=>n).some(n=>Math.abs(positions.getX(n)-point.x*T)<1e-5&&Math.abs(positions.getZ(n)-point.y*T)<1e-5&&Math.abs(positions.getY(n)-y)<1e-5),'the gable must rest on the same wall and ridge coordinates');}
  const out=new Vector3(-f.frame.v.x,0,-f.frame.v.y);for(const offset of [-.20,0,.20])for(const y of [1.3,1.8]){const start=new Vector3(door.x*T+f.frame.u.x*offset,y,door.y*T+f.frame.u.y*offset).addScaledVector(out,T),ray=new Raycaster(start,out.clone().negate(),0,2*T);assert.equal(ray.intersectObject(building,true).length,0,'the standing body crossing must remain clear across the open doorway');}assert.equal(building.userData.openings.find(opening=>opening.id===door.doorId).width,.60*T);f.dispose(building);
 }
});

test('warehouse loading canopy posts and their header expose continuous timber beside the centred wall at four rotations',()=>{
 for(const rotation of rotations){
  const f=fixture('almacen',rotation),building=f.build(),canopy=building.getObjectByName(`building-detail:${f.b.id}:loading-canopy`),fabric=building.getObjectByName(`building-fabric:${f.b.id}`),out=new Vector3(-f.frame.v.x,0,-f.frame.v.y);assert.ok(canopy);
  const supports=[Math.round(f.frame.doorU-1),Math.round(f.frame.doorU+1)].filter(u=>{const p=f.frame.at(u,0);return f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y)?.type==='wall';});assert.equal(supports.length,2);
  for(const u of supports){const p=f.frame.at(u,0),start=new Vector3(p.x*T,1.5,p.y*T).addScaledVector(out,T),ray=new Raycaster(start,out.clone().negate(),0,2*T),post=ray.intersectObject(canopy,true)[0],wall=ray.intersectObject(fabric,true)[0];assert.ok(post&&wall);assert.equal(post.object.material.name,'world:wood');assert.ok(wall.distance-post.distance>.30,'the post must expose its full outer face rather than being buried inside the wall');}
  canopy.traverse(child=>{if(child instanceof Mesh){const p=child.geometry.getAttribute('position');for(let n=0;n<p.count;n++)if(p.getY(n)<1.8)assert.equal(f.input.terrain.tiles.find(tile=>tile.x===Math.round(p.getX(n)/T)&&tile.y===Math.round(p.getZ(n)/T))?.type,'wall');}});f.dispose(building);
 }
});

test('warehouse floor returns meet the centred wall without changing rooms, levels or physical hatch clipping',()=>{
 for(const rotation of rotations){
  const f=fixture('almacen',rotation,'interior'),before=JSON.stringify(f.input),cell=f.b.rooms.flatMap(room=>room.cells).find(cell=>cell.x===f.b.x+1&&cell.y===f.b.y+1);assert.ok(cell);const parts=buildingFloorRectangles(f.b,f.input,{...cell,elevation:0},T,[],0);assert.equal(parts.length,1);assert.equal(parts[0].minX,f.b.x*T+.09);assert.equal(parts[0].minZ,f.b.y*T+.09);assert.equal(parts[0].maxX,(cell.x+.5)*T);assert.equal(parts[0].maxZ,(cell.y+.5)*T);
  const opening={linkId:'return-hatch',level:0,height:0,minX:f.b.x*T+.10,maxX:f.b.x*T+.30,minZ:f.b.y*T+.10,maxZ:f.b.y*T+.30},clipped=buildingFloorRectangles(f.b,f.input,{...cell,elevation:0},T,[opening],0);assert.ok(clipped.length>1);for(const part of clipped)assert.ok(part.maxX<=opening.minX||part.minX>=opening.maxX||part.maxZ<=opening.minZ||part.minZ>=opening.maxZ,'an extended floor must still preserve the physical hatch');
  const upper=buildingFloorRectangles(f.b,f.input,{...cell,tacticalLevel:1,elevation:3},T,[],0);assert.deepEqual(upper,[{minX:(cell.x-.5)*T,maxX:(cell.x+.5)*T,minZ:(cell.y-.5)*T,maxZ:(cell.y+.5)*T}]);const door=f.frame.door,boundary=buildingFloorRectangles(f.b,f.input,{x:door.x,y:door.y,elevation:0},T,[],0);assert.deepEqual(boundary,[{minX:(door.x-.5)*T,maxX:(door.x+.5)*T,minZ:(door.y-.5)*T,maxZ:(door.y+.5)*T}],'authored perimeter and threshold floors keep their original footprints');assert.equal(JSON.stringify(f.input),before);f.dispose(f.build());
 }
});
