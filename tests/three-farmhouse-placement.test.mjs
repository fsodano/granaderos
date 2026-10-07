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
const {createArchitectureReviewBattle}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const T=1.2360585147470482,rotations=[0,90,180,270];
function fixture(rotation,view='exterior',roof='original'){
 const battle=createArchitectureReviewBattle('estancia',rotation,view,roof),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},frame=entranceFrame({...b,walls:battle.tiles}),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 return {b,input,frame,build(){const before=JSON.stringify(input),building=buildBuilding(b,input,T,geometry,materials);building.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before);return building;},dispose(building){disposeWorldNode(building);geometry.dispose();materials.dispose();}};
}

test('centred farmhouse placement requires both actual intact front corners and preserves unpainted legacy selection',()=>{
 for(const rotation of rotations){
  const normal=fixture(rotation);assert.equal(buildingArtInset(normal.b,normal.input),0);normal.dispose(normal.build());
  for(const uEnd of ['left','right'])for(const type of ['rubble','grass','door','window']){const f=fixture(rotation),p=f.frame.at(uEnd==='left'?0:f.frame.width,0),tile=f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y);tile.type=type;assert.equal(buildingArtInset(f.b,f.input),.4,`${rotation}/${uEnd}/${type}: a missing or opened bearing corner retains the whole original shell`);f.dispose(f.build());}
  const legacy=fixture(rotation);legacy.b.architecture='farmhouse';legacy.b.kind=undefined;legacy.b.wallFinish=undefined;assert.equal(buildingArtInset(legacy.b,legacy.input),.4);legacy.dispose(legacy.build());
 }
});

test('the actual farmhouse roof, wall centrelines and standing door crossing move together through four rotations',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation);f.frame.door.open=true;const building=f.build(),fabric=building.getObjectByName(`building-fabric:${f.b.id}`),roof=fabric.children.find(mesh=>mesh.material.name==='world:clay'),profile=getBuildingProfile(f.b);assert.ok(roof);
  const p=roof.geometry.getAttribute('position'),xs=[],zs=[];for(let n=0;n<p.count;n++){xs.push(p.getX(n));zs.push(p.getZ(n));}for(const [actual,expected]of [[Math.min(...xs),(f.b.x-profile.eave)*T],[Math.max(...xs),(f.b.x+f.b.width-1+profile.eave)*T],[Math.min(...zs),(f.b.y-profile.eave)*T],[Math.max(...zs),(f.b.y+f.b.height-1+profile.eave)*T]])assert.ok(Math.abs(actual-expected)<1e-5,'the hip roof must follow the same centred authored footprint');
  const out=new Vector3(-f.frame.v.x,0,-f.frame.v.y);for(const offset of [-.20,0,.20])for(const y of [1.3,1.8]){const start=new Vector3(f.frame.door.x*T+offset*f.frame.u.x,y,f.frame.door.y*T+offset*f.frame.u.y).addScaledVector(out,T);assert.equal(new Raycaster(start,out.clone().negate(),0,2*T).intersectObject(building,true).length,0,'the full standing aperture must follow the actual doorway cell');}
  assert.equal(building.userData.openings.find(opening=>opening.id===f.frame.door.doorId).width,.60*T);f.dispose(building);
 }
});

test('farmhouse floor returns preserve original upper/threshold footprints and physical hatch clipping',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation,'interior'),cell=f.b.rooms.flatMap(room=>room.cells).find(cell=>cell.x===f.b.x+1&&cell.y===f.b.y+1),before=JSON.stringify(f.input);assert.ok(cell);const normal=buildingFloorRectangles(f.b,f.input,{...cell,elevation:0},T,[],0);assert.equal(normal[0].minX,f.b.x*T+.09);assert.equal(normal[0].minZ,f.b.y*T+.09);
  const hatch={linkId:'farmhouse-return-hatch',level:0,height:0,minX:f.b.x*T+.10,maxX:f.b.x*T+.30,minZ:f.b.y*T+.10,maxZ:f.b.y*T+.30},clipped=buildingFloorRectangles(f.b,f.input,{...cell,elevation:0},T,[hatch],0);assert.ok(clipped.length>1);for(const part of clipped)assert.ok(part.maxX<=hatch.minX||part.minX>=hatch.maxX||part.maxZ<=hatch.minZ||part.minZ>=hatch.maxZ);
  for(const point of [{...cell,tacticalLevel:1,elevation:3},{x:f.frame.door.x,y:f.frame.door.y,elevation:0}])assert.deepEqual(buildingFloorRectangles(f.b,f.input,point,T,[],0),[{minX:(point.x-.5)*T,maxX:(point.x+.5)*T,minZ:(point.y-.5)*T,maxZ:(point.y+.5)*T}]);assert.equal(JSON.stringify(f.input),before);f.dispose(f.build());
 }
});

test('paired farmhouse chimneys retain their actual solid support cells, roof rise and room disclosure after centring',()=>{
 for(const rotation of rotations)for(const roof of ['original','slab','terrace','roof-route']){
  const f=fixture(rotation,'exterior',roof),building=f.build();for(const name of ['farmhouse-chimney-left','farmhouse-chimney-right']){const node=building.getObjectByName(`building-detail:${f.b.id}:${name}`);if(roof==='roof-route'){assert.equal(Boolean(node),false);}else{assert.ok(node);node.traverse(mesh=>{if(mesh instanceof Mesh){const p=mesh.geometry.getAttribute('position');for(let n=0;n<p.count;n++)assert.equal(f.input.terrain.tiles.find(tile=>tile.x===Math.round(p.getX(n)/T)&&tile.y===Math.round(p.getZ(n)/T))?.type,'wall');}});}}f.dispose(building);
 }
 for(const rotation of rotations)for(const view of ['partial','interior']){const f=fixture(rotation,view),building=f.build();for(const name of ['farmhouse-chimney-left','farmhouse-chimney-right'])assert.equal(Boolean(building.getObjectByName(`building-detail:${f.b.id}:${name}`)),false);f.dispose(building);}
});
