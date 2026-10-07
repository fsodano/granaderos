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
const T=1.2360585147470482;

function fixture(rotation,view='exterior'){
 const battle=createArchitectureReviewBattle('ayuntamiento',rotation,view),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings},revealedRooms:battle.revealedRooms},frame=entranceFrame({...b,walls:battle.tiles.filter(tile=>tile.buildingId===b.id)}),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 const build=()=>buildBuilding(b,input,T,geometry,materials);
 const name=feature=>`building-detail:${b.id}:${feature}`;
 const actualDoor=frame.doorU-.4*(frame.u.x+frame.u.y);
 const point=(u,v,y)=>{const p=frame.at(u,v);return new Vector3((p.x+.4)*T,y,(p.y+.4)*T);};
 const localBounds=object=>{
  const bounds=new Box3();object.traverse(child=>{if(child instanceof Mesh){const p=child.geometry.getAttribute('position');for(let n=0;n<p.count;n++){
   const x=p.getX(n)/T-.4-frame.origin.x,z=p.getZ(n)/T-.4-frame.origin.y;
   bounds.expandByPoint(new Vector3(x*frame.u.x+z*frame.u.y,p.getY(n),x*frame.v.x+z*frame.v.y));
  }}});return bounds;
 };
 const dispose=object=>{disposeWorldNode(object);geometry.dispose();materials.dispose();};
 return {b,input,frame,build,name,actualDoor,point,localBounds,dispose};
}

test('the actual town hall has a broad curved clock crown and two low finials through four rotations',()=>{
 let expected;
 for(const rotation of [0,90,180,270]){
  const f=fixture(rotation),before=JSON.stringify(f.input),building=f.build(),height=building.userData.height,crown=building.getObjectByName(f.name('townhall-clock-pediment')),finials=building.getObjectByName(f.name('townhall-finials'));
  assert.ok(crown);assert.ok(finials);assert.equal(building.getObjectByName(f.name('civic-clock-tower')),undefined,'the town hall must have its own crown silhouette');
  const bounds=f.localBounds(crown),ends=f.localBounds(finials);
  assert.ok(bounds.min.y>height-.10&&bounds.min.y<height,'the entablature must join the existing facade');assert.ok(bounds.max.y>height+1.80&&bounds.max.y<height+2.05,'the wide curved crown must clear the hipped roof');
  assert.ok(bounds.max.x-bounds.min.x>4,'the pediment must span the two formal wall supports');assert.ok(Math.abs(bounds.getCenter(new Vector3()).x-f.actualDoor)<1e-5,'the clock must follow the actual entrance');
  assert.ok(ends.min.x<f.actualDoor-1.70&&ends.max.x>f.actualDoor+1.70,'the finials must stand on the two low crown wings');assert.ok(ends.min.y>height+.35&&ends.max.y<height+.80);
  const clock=crown.children.find(child=>child.material?.name==='world:linen');assert.ok(clock,'the crown must show its static clock face');assert.ok(new Box3().setFromObject(clock).min.y>height+.90);
  const values=[bounds.min.x-f.actualDoor,bounds.min.z,bounds.max.x-f.actualDoor,bounds.max.z];if(expected)values.forEach((value,n)=>assert.ok(Math.abs(value-expected[n])<1e-5,`${rotation} changes crown width or depth`));else expected=values;
  assert.equal(JSON.stringify(f.input),before);f.dispose(building);
 }
});

test('the town hall crown has a closed thick face and open space above its low shoulders',()=>{
 for(const rotation of [0,90,180,270]){
  const f=fixture(rotation),building=f.build(),height=building.userData.height,crown=building.getObjectByName(f.name('townhall-clock-pediment')),direction=new Vector3(f.frame.v.x,0,f.frame.v.y);building.updateMatrixWorld(true);
  const ray=new Raycaster(f.point(f.actualDoor-.25,-1,height+1.35),direction,0,T*1.6),hits=ray.intersectObject(crown,true).filter(hit=>hit.object.material.name==='world:limewash');
  assert.ok(hits.length>=2,'the closed crest must have front and back faces');assert.ok(hits.at(-1).distance-hits[0].distance>.60,'the curved crest must have real masonry depth');
  for(const side of [-1,1])assert.equal(new Raycaster(f.point(f.actualDoor+side*1.75,-1,height+.90),direction,0,T*1.6).intersectObject(crown,true).length,0,'the low wings must not become a rectangular tower');
  f.dispose(building);
 }
});

test('edited town hall supports omit the crown and finials without closing the authored openings',()=>{
 for(const rotation of [0,90,180,270])for(const type of ['window','door','rubble']){
  const f=fixture(rotation),point=f.frame.at(Math.round(f.frame.doorU+2),0),tile=f.input.terrain.tiles.find(tile=>tile.x===point.x&&tile.y===point.y);tile.type=type;
  const before=JSON.stringify(f.input),building=f.build();assert.equal(building.getObjectByName(f.name('townhall-clock-pediment')),undefined);assert.equal(building.getObjectByName(f.name('townhall-finials')),undefined);
  building.updateMatrixWorld(true);const u=f.frame.doorU+2-.4*(f.frame.u.x+f.frame.u.y),ray=new Raycaster(f.point(u,-1,type==='window'?1.3:1.9),new Vector3(f.frame.v.x,0,f.frame.v.y),0,T*1.6);
  assert.equal(ray.intersectObject(building.getObjectByName(`building-details:${f.b.id}`),true).length,0,'the edited opening must remain clear');assert.equal(JSON.stringify(f.input),before);f.dispose(building);
 }
});

test('town hall clearance follows the long shallow crown footprint rather than covering the inner roof',()=>{
 for(const rotation of [0,90,180,270])for(const mode of ['blocked','ground','front-route','inner-route']){
  const f=fixture(rotation),point=f.frame.at(f.frame.doorU+2,mode==='inner-route'?2:0);
  f.input.terrain.upperSurfaces=[{...point,type:'floor',kind:'roof',buildingId:f.b.id,tacticalLevel:mode==='ground'?0:1,elevation:4.7,blocked:mode==='blocked'}];
  const before=JSON.stringify(f.input),building=f.build(),present=mode!=='front-route';assert.equal(Boolean(building.getObjectByName(f.name('townhall-clock-pediment'))),present,`${rotation}/${mode}`);assert.equal(Boolean(building.getObjectByName(f.name('townhall-finials'))),present,`${rotation}/${mode} finials`);assert.equal(JSON.stringify(f.input),before);f.dispose(building);
 }
});

test('town hall crowns retain authored finishes and follow ordinary room cutaways',()=>{
 for(const rotation of [0,90,180,270]){
  const f=fixture(rotation);f.b.wallFinish='brick';f.b.roofFinish='thatch';const before=JSON.stringify(f.input),building=f.build(),crown=building.getObjectByName(f.name('townhall-clock-pediment'));
  assert.ok(crown.children.some(child=>child.material?.name==='world:brick'));assert.ok(crown.children.some(child=>child.material?.name==='world:linen'));assert.equal(JSON.stringify(f.input),before);f.dispose(building);
  for(const view of ['partial','interior']){
   const g=fixture(rotation,view),inside=g.build();assert.ok(g.input.revealedRooms.length>0,'the review must enter rooms with ordinary gameplay orders');assert.equal(inside.getObjectByName(g.name('townhall-clock-pediment')),undefined);assert.equal(inside.getObjectByName(g.name('townhall-finials')),undefined);g.dispose(inside);
  }
 }
});
