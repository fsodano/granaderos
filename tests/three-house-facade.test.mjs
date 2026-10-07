import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3,Mesh,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {entranceFrame}=await import('../game/building-profile.js');
const {createArchitectureReviewBattle}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const T=1.2360585147470482,V=25.066666666666666,rotations=[0,90,180,270];
function fixture(rotation,view='exterior',roof='original'){
 const battle=createArchitectureReviewBattle('casa',rotation,view,roof),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},frame=entranceFrame({...b,walls:battle.tiles}),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 const point=(u,v,y)=>{const p=frame.at(u,v);return new Vector3(p.x*T,y,p.y*T);};
 return {b,input,frame,point,feature:(building,name)=>building.getObjectByName(`building-detail:${b.id}:${name}`),build(){const before=JSON.stringify(input),building=buildBuilding(b,input,T,geometry,materials);building.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before);return building;},dispose(building){disposeWorldNode(building);geometry.dispose();materials.dispose();}};
}

test('actual house piers retain the source footprint, visible coping, stone foot and solid-cell support at four rotations',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation),building=f.build(),node=f.feature(building,'house-corner-piers'),height=building.userData.height;assert.ok(node);const body=node.children.find(mesh=>mesh.material.name==='world:adobe'),foot=node.children.find(mesh=>mesh.material.name==='world:stone'),coping=node.children.find(mesh=>mesh.material.name==='world:house-pier-coping');assert.equal(body.material.userData.architectureFinish.textureOpacity,.36);assert.equal(foot.material.color.getHexString(),'a99a79');assert.equal(foot.material.userData.architectureFinish.textureOpacity,.60);assert.equal(coping.material.color.getHexString(),'cab48e');
  node.traverse(mesh=>{if(mesh instanceof Mesh){const p=mesh.geometry.getAttribute('position');for(let n=0;n<p.count;n++)assert.equal(f.input.terrain.tiles.find(tile=>tile.x===Math.round(p.getX(n)/T)&&tile.y===Math.round(p.getZ(n)/T))?.type,'wall','every pier point must stay in an intact blocked corner');}});
  for(const u of [0,f.frame.width]){
   const hit=new Raycaster(f.point(u,-.24,height+2),new Vector3(0,-1,0),0,3).intersectObject(building,true)[0];assert.ok(hit);assert.ok(hit.object===coping,'both source coping faces must remain exposed beyond the real hip eave');assert.ok(Math.abs(hit.point.y-(height-.5/V))<1e-5);
   const out=new Vector3(-f.frame.v.x,0,-f.frame.v.y),ray=new Raycaster(f.point(u,-1,1.3),out.clone().negate(),0,2*T),bodyHit=ray.intersectObject(node,true)[0];assert.ok(bodyHit);assert.ok(Math.abs(bodyHit.distance-.78*T)<1e-5,'the source shaft face must remain at front v=-.22');
  }f.dispose(building);
 }
});

test('the house timber hood spans the real doorway above a full standing aperture and below the roof',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation);f.frame.door.open=true;const building=f.build(),hood=f.feature(building,'house-door-hood'),height=building.userData.height;assert.ok(hood);const bounds=new Box3().setFromObject(hood);assert.ok(hood.children.every(mesh=>mesh.material.name==='world:wood'));assert.ok(Math.abs(bounds.min.y-height*.87)<1e-5);assert.ok(Math.abs(bounds.max.y-(height*.87+3/V))<1e-5);assert.ok(bounds.max.y<height-.05);
  const p=hood.children[0].geometry.getAttribute('position'),us=[],vs=[];for(let n=0;n<p.count;n++){const x=p.getX(n)/T-f.frame.origin.x,z=p.getZ(n)/T-f.frame.origin.y;us.push(x*f.frame.u.x+z*f.frame.u.y);vs.push(x*f.frame.v.x+z*f.frame.v.y);}assert.ok(Math.abs(Math.max(...us)-Math.min(...us)-1.44)<1e-5);assert.ok(Math.abs(Math.min(...vs)+.22)<1e-5);assert.ok(Math.abs(Math.max(...vs)-.13)<1e-5);
  for(const offset of [-.20,0,.20])for(const y of [1.3,1.8]){const start=f.point(f.frame.doorU,-1,y).add(new Vector3(offset*f.frame.u.x,0,offset*f.frame.u.y));assert.equal(new Raycaster(start,new Vector3(f.frame.v.x,0,f.frame.v.y),0,2*T).intersectObject(building,true).length,0,'a full standing body must pass through the authored door');}f.dispose(building);
 }
});

test('edited house corners remove only unsupported piers while all corner openings keep their original shell fallback',()=>{
 for(const rotation of rotations)for(const type of ['rubble','door','window']){
  const f=fixture(rotation),p=f.frame.at(0,0),tile=f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y);tile.type=type;f.input.terrain.tiles=[f.frame.door,...f.input.terrain.tiles.filter(tile=>tile!==f.frame.door)];const building=f.build(),node=f.feature(building,'house-corner-piers');assert.ok(node,'the other intact corner must keep its supported pier');node.traverse(mesh=>{if(mesh instanceof Mesh){const p=mesh.geometry.getAttribute('position');for(let n=0;n<p.count;n++)assert.equal(f.input.terrain.tiles.find(tile=>tile.x===Math.round(p.getX(n)/T)&&tile.y===Math.round(p.getZ(n)/T))?.type,'wall');}});f.dispose(building);
 }
});

test('house facade respects short authored slabs, roof routes, overlapping low upper surfaces and normal room disclosure',()=>{
 for(const rotation of rotations){
  for(const roof of ['slab','terrace','roof-route']){const f=fixture(rotation,'exterior',roof),building=f.build();for(const name of ['house-corner-piers','house-door-hood']){const node=f.feature(building,name);assert.ok(node);assert.ok(new Box3().setFromObject(node).max.y<building.userData.height-.015,'all ground facade parts must remain below the real upper surface');}f.dispose(building);}
  const short=fixture(rotation,'exterior','slab');short.input.terrain.upperSurfaces=short.input.terrain.upperSurfaces.map(surface=>({...surface,elevation:1.8}));const shortBuilding=short.build();assert.equal(Boolean(short.feature(shortBuilding,'house-door-hood')),false,'omit a hood that cannot fit above the actual shortened door');assert.ok(new Box3().setFromObject(short.feature(shortBuilding,'house-corner-piers')).max.y<1.8);short.dispose(shortBuilding);
  for(const blocked of [false,true]){const f=fixture(rotation),corners=[f.frame.at(0,0),f.frame.at(f.frame.width,0)],door=f.frame.door;f.input.terrain.upperSurfaces=[...corners,door].map(p=>({...p,kind:'platform',type:'floor',tacticalLevel:1,elevation:2.2,blocked,buildingId:f.b.id}));const building=f.build();for(const name of ['house-corner-piers','house-door-hood'])assert.equal(Boolean(f.feature(building,name)),blocked,'only a usable overlapping low upper surface excludes a facade part');f.dispose(building);}
  for(const view of ['partial','interior']){const f=fixture(rotation,view),building=f.build();for(const name of ['house-corner-piers','house-door-hood'])assert.equal(Boolean(f.feature(building,name)),false,'ordinary room disclosure must remove exterior facade parts');f.dispose(building);}
 }
});
