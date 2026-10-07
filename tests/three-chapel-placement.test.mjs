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
const T=1.2360585147470482,V=25.066666666666666,rotations=[0,90,180,270];
function fixture(rotation,view='exterior',roof='original'){
 const battle=createArchitectureReviewBattle('capilla',rotation,view,roof),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},frame=entranceFrame({...b,walls:battle.tiles}),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 return {b,input,frame,build(){const before=JSON.stringify(input),building=buildBuilding(b,input,T,geometry,materials);building.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before);return building;},dispose(building){disposeWorldNode(building);geometry.dispose();materials.dispose();}};
}

test('centred chapel placement requires both actual intact front corners and preserves unpainted legacy selection',()=>{
 for(const rotation of rotations){
  const normal=fixture(rotation);assert.equal(buildingArtInset(normal.b,normal.input),0);normal.dispose(normal.build());
  for(const uEnd of ['left','right'])for(const type of ['rubble','grass','door','window']){const f=fixture(rotation),p=f.frame.at(uEnd==='left'?0:f.frame.width,0),tile=f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y);tile.type=type;assert.equal(buildingArtInset(f.b,f.input),.4,`${rotation}/${uEnd}/${type}: a missing or opened bearing corner retains the whole original shell`);f.dispose(f.build());}
  const legacy=fixture(rotation);legacy.b.architecture='chapel';legacy.b.kind=undefined;legacy.b.wallFinish=undefined;assert.equal(buildingArtInset(legacy.b,legacy.input),.4);legacy.dispose(legacy.build());
 }
});

test('the actual chapel roof, wall centrelines and standing door crossing move together through four rotations',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation);f.frame.door.open=true;const building=f.build(),fabric=building.getObjectByName(`building-fabric:${f.b.id}`),roof=fabric.children.find(mesh=>mesh.material.name==='world:aged'),profile=getBuildingProfile(f.b);assert.ok(roof);
  const p=roof.geometry.getAttribute('position'),xs=[],zs=[];for(let n=0;n<p.count;n++){xs.push(p.getX(n));zs.push(p.getZ(n));}for(const [actual,expected]of [[Math.min(...xs),(f.b.x-profile.eave)*T],[Math.max(...xs),(f.b.x+f.b.width-1+profile.eave)*T],[Math.min(...zs),(f.b.y-profile.eave)*T],[Math.max(...zs),(f.b.y+f.b.height-1+profile.eave)*T]])assert.ok(Math.abs(actual-expected)<1e-5,'the gabled roof must follow the same centred authored footprint');
  const rise=Math.min(profile.roofRise/V,Math.max(.4,f.frame.width*.28)),wall=fabric.children.find(mesh=>mesh.material.name===`world:${f.b.wallFinish}`),vertices=wall.geometry.getAttribute('position');for(const v of [0,f.frame.depth])for(const u of [0,f.frame.width*.5,f.frame.width]){const point=f.frame.at(u,v),y=building.userData.height+(u===f.frame.width*.5?rise:0);assert.ok(Array.from({length:vertices.count},(_,n)=>n).some(n=>Math.abs(vertices.getX(n)-point.x*T)<1e-5&&Math.abs(vertices.getZ(n)-point.y*T)<1e-5&&Math.abs(vertices.getY(n)-y)<1e-5),'both chapel gables remain on the actual centred wall and ridge');}
  const out=new Vector3(-f.frame.v.x,0,-f.frame.v.y);for(const offset of [-.20,0,.20])for(const y of [1.3,1.8]){const start=new Vector3(f.frame.door.x*T+offset*f.frame.u.x,y,f.frame.door.y*T+offset*f.frame.u.y).addScaledVector(out,T);assert.equal(new Raycaster(start,out.clone().negate(),0,2*T).intersectObject(building,true).length,0,'the full standing aperture must follow the actual doorway cell');}
  assert.equal(building.userData.openings.find(opening=>opening.id===f.frame.door.doorId).width,.60*T);f.dispose(building);
 }
});

test('chapel floor returns preserve original upper/threshold footprints and physical hatch clipping',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation,'interior'),cell=f.b.rooms.flatMap(room=>room.cells).find(cell=>cell.x===f.b.x+1),before=JSON.stringify(f.input);assert.ok(cell);const normal=buildingFloorRectangles(f.b,f.input,{...cell,elevation:0},T,[],0);assert.equal(normal[0].minX,f.b.x*T+.09);
  // Use the actual left chapel floor and actual playable terrace cell.
  const hatch={linkId:'chapel-return-hatch',level:0,height:0,minX:f.b.x*T+.10,maxX:f.b.x*T+.30,minZ:cell.y*T-.10,maxZ:cell.y*T+.10},clipped=buildingFloorRectangles(f.b,f.input,{...cell,elevation:0},T,[hatch],0);assert.ok(clipped.length>1);for(const part of clipped)assert.ok(part.maxX<=hatch.minX||part.minX>=hatch.maxX||part.maxZ<=hatch.minZ||part.minZ>=hatch.maxZ);
  const route=fixture(rotation,'exterior','roof-route'),upper=route.input.terrain.upperSurfaces.find(surface=>!surface.blocked&&(surface.tacticalLevel??0)>0&&surface.x===cell.x&&surface.y===cell.y);assert.ok(upper);for(const point of [upper,{x:f.frame.door.x,y:f.frame.door.y,elevation:0}])assert.deepEqual(buildingFloorRectangles(f.b,f.input,point,T,[],0),[{minX:(point.x-.5)*T,maxX:(point.x+.5)*T,minZ:(point.y-.5)*T,maxZ:(point.y+.5)*T}]);assert.equal(JSON.stringify(f.input),before);f.dispose(f.build());route.dispose(route.build());
 }
});

test('the supported chapel bell gable joins its actual roof through original, slab, terrace and accessible roof states',()=>{
 for(const rotation of rotations)for(const roof of ['original','slab','terrace','roof-route']){
  const f=fixture(rotation,'exterior',roof),building=f.build(),bell=building.getObjectByName(`building-detail:${f.b.id}:chapel-bell-gable`);if(roof==='roof-route'){assert.equal(Boolean(bell),false);}else{
   assert.ok(bell);let bottom=Infinity;bell.traverse(mesh=>{if(mesh instanceof Mesh){const p=mesh.geometry.getAttribute('position');for(let n=0;n<p.count;n++)bottom=Math.min(bottom,p.getY(n));}});const rise=roof==='original'?Math.min(getBuildingProfile(f.b).roofRise/V,Math.max(.4,f.frame.width*.28)):0;assert.ok(Math.abs(bottom-(building.userData.height+rise*.62))<1e-5,'the bell gable must use the real pitched or flat roof rise');
   const out=new Vector3(-f.frame.v.x,0,-f.frame.v.y),start=new Vector3(f.frame.door.x*T,building.userData.height+rise*.62+.69,f.frame.door.y*T).addScaledVector(out,T);assert.equal(new Raycaster(start,out.clone().negate(),0,T*1.5).intersectObject(bell,true).length,0,'the arched bell stage remains a true opening');
  }f.dispose(building);
 }
 for(const rotation of rotations)for(const view of ['partial','interior']){const f=fixture(rotation,view),building=f.build();assert.equal(Boolean(building.getObjectByName(`building-detail:${f.b.id}:chapel-bell-gable`)),false);f.dispose(building);}
});
