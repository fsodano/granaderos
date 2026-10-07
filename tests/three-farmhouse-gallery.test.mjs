import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Mesh,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {buildingArtInset}=await import('../web/lib/three/world-building-placement.ts');
const {entranceFrame}=await import('../game/building-profile.js');
const {createArchitectureReviewBattle}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const T=1.2360585147470482,V=25.066666666666666,rotations=[0,90,180,270];
function fixture(rotation,view='exterior',roof='original'){
 const battle=createArchitectureReviewBattle('estancia',rotation,view,roof),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},frame=entranceFrame({...b,walls:battle.tiles}),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 const point=(u,v,y)=>{const p=frame.at(u,v);return new Vector3(p.x*T,y,p.y*T);};
 const wall=(u,v)=>{const p=frame.at(u,v);return input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y);};
 return {b,input,frame,point,wall,feature:(building,name='farmhouse-gallery')=>building.getObjectByName(`building-detail:${b.id}:${name}`),build(){const before=JSON.stringify(input),building=buildBuilding(b,input,T,geometry,materials);building.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before);return building;},dispose(building){disposeWorldNode(building);geometry.dispose();materials.dispose();}};
}
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<2e-5,`${actual} vs ${expected}`);
function supported(f,node){let count=0;node.traverse(mesh=>{if(mesh instanceof Mesh){const p=mesh.geometry.getAttribute('position');for(let n=0;n<p.count;n++)if(p.getY(n)<1.9){count++;assert.equal(f.input.terrain.tiles.find(tile=>tile.x===Math.round(p.getX(n)/T)&&tile.y===Math.round(p.getZ(n)/T))?.type,'wall','every low gallery member must stay inside its actual intact bearing cell');}}});assert.ok(count>0);}

test('the real farmhouse front and return posts expose their source-sized timber at all four rotations',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation),building=f.build(),gallery=f.feature(building),fabric=building.getObjectByName(`building-fabric:${f.b.id}`),front=[...new Set([0,.3,.7,1].map(r=>Math.round(f.frame.width*r)))].filter(u=>f.wall(u,0)?.type==='wall'),length=Math.round(f.frame.depth*.57),out=new Vector3(-f.frame.v.x,0,-f.frame.v.y);assert.ok(gallery.children.length);supported(f,gallery);
  for(const u of front.filter(u=>u>0&&u<f.frame.width)){const ray=new Raycaster(f.point(u,-1,1.3),out.clone().negate(),0,2*T),post=ray.intersectObject(gallery,true)[0],wall=ray.intersectObject(fabric,true)[0];assert.ok(post&&wall);assert.equal(post.object.material.name,'world:wood');near(wall.distance-post.distance,.375*T-.09);}
  const cornerHit=new Raycaster(f.point(-.30,-1,1.3),out.clone().negate(),0,2*T).intersectObject(building,true)[0];assert.ok(cornerHit);assert.equal(cornerHit.object.material.name,'world:wood','the joined outer corner must have one exposed real post');
  const sideOut=new Vector3(-f.frame.u.x,0,-f.frame.u.y),sideRay=new Raycaster(f.point(-1,length,1.3),sideOut.clone().negate(),0,2*T),post=sideRay.intersectObject(gallery,true)[0],wall=sideRay.intersectObject(fabric,true)[0];assert.ok(post&&wall);near(wall.distance-post.distance,.375*T-.09);
  const stone=gallery.getObjectByName(`building-detail:${f.b.id}:farmhouse-gallery-fabric`).children.find(mesh=>mesh.material.name==='world:stone');assert.equal(stone.material.color.getHexString(),'a99a79');assert.equal(stone.material.userData.architectureFinish.textureOpacity,.60);f.dispose(building);
 }
});

test('farmhouse canopy planes meet at the same mitred corner with closed roof edges and non-overlapping timber beams',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation),building=f.build(),gallery=f.feature(building),fabric=f.feature(building,'farmhouse-gallery-fabric'),roof=fabric.children.find(mesh=>mesh.material.name===`world:${f.b.roofFinish}`),p=roof.geometry.getAttribute('position'),low=building.userData.height-4/V,high=building.userData.height+3/V;assert.ok(roof);
  for(const [u,v,y]of [[-.45,-.45,low],[.42,.42,high]]){const q=f.point(u,v,y);assert.ok(Array.from({length:p.count},(_,n)=>n).filter(n=>Math.abs(p.getX(n)-q.x)<2e-5&&Math.abs(p.getZ(n)-q.z)<2e-5&&Math.abs(p.getY(n)-y)<2e-5).length>=2,'both canopy planes must share their same real corner endpoints');}
  const edges=gallery.getObjectByName(`building-roof-edges:${f.b.id}:farmhouse-gallery`);assert.ok(edges&&edges.children.some(mesh=>mesh.material.name===`world:${f.b.roofFinish}`),'the mitred joint retains its single rounded roof cap');
  const hits=new Raycaster(f.point(-.20,-.247,low+.04),new Vector3(0,-1,0),0,.1).intersectObject(fabric,true).filter(hit=>Math.abs(hit.point.y-low)<1e-5);assert.equal(hits.length,1,'the two header boxes must not paint duplicate coplanar faces at their overlap');f.dispose(building);
 }
});

test('farmhouse gallery support edits preserve front and return openings, intact cell containment and standing doorway rays',()=>{
 for(const rotation of rotations)for(const side of ['front','return'])for(const type of ['window','door','rubble']){
  const f=fixture(rotation),u=side==='front'?Math.round(f.frame.width*.3):0,v=side==='front'?0:Math.round(f.frame.depth*.57);f.wall(u,v).type=type;f.input.terrain.tiles=[f.frame.door,...f.input.terrain.tiles.filter(tile=>tile!==f.frame.door)];const building=f.build(),gallery=f.feature(building);supported(f,gallery);const start=side==='front'?f.point(u,-1,1.3):f.point(-1,v,1.3),direction=side==='front'?new Vector3(f.frame.v.x,0,f.frame.v.y):new Vector3(f.frame.u.x,0,f.frame.u.y);assert.equal(new Raycaster(start,direction,0,2*T).intersectObject(gallery,true).length,0,'a changed bearing cell must retain its exact low opening');f.dispose(building);
 }
 for(const rotation of rotations){const f=fixture(rotation);f.frame.door.open=true;const building=f.build();for(const offset of [-.20,0,.20])for(const y of [1.3,1.8]){const start=f.point(f.frame.doorU,-1,y).add(new Vector3(offset*f.frame.u.x,0,offset*f.frame.u.y));assert.equal(new Raycaster(start,new Vector3(f.frame.v.x,0,f.frame.v.y),0,2*T).intersectObject(building,true).length,0);}f.dispose(building);}
});

test('farmhouse ground galleries retain blocked roofs but exclude usable roof routes and low upper platforms',()=>{
 for(const rotation of rotations){
  for(const roof of ['slab','terrace']){const f=fixture(rotation,'exterior',roof),building=f.build(),gallery=f.feature(building);assert.ok(gallery.children.length>0);supported(f,gallery);f.dispose(building);}
  const route=fixture(rotation,'exterior','roof-route'),routeBuilding=route.build();assert.equal(route.feature(routeBuilding).children.length,0,'the canopy return and roof cannot occupy an actual usable upper roof route');route.dispose(routeBuilding);
  const short=fixture(rotation,'exterior','slab');short.input.terrain.upperSurfaces=short.input.terrain.upperSurfaces.map(surface=>({...surface,elevation:1.8}));const shortBuilding=short.build();assert.equal(short.feature(shortBuilding).children.length,0,'short edited roofs cannot fit a safe ground doorway canopy');short.dispose(shortBuilding);
  for(const blocked of [true,false]){const f=fixture(rotation),p=f.frame.at(0,0);f.input.terrain.upperSurfaces=[{...p,kind:'platform',type:'floor',tacticalLevel:1,elevation:2.2,blocked,buildingId:f.b.id}];const building=f.build();assert.equal(f.feature(building).children.length>0,blocked,'only a usable overlapping low upper platform excludes both joined spans');f.dispose(building);}
  for(const view of ['partial','interior']){const f=fixture(rotation,view),building=f.build();assert.equal(Boolean(f.feature(building)),false);f.dispose(building);}
 }
});
