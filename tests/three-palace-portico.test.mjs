import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {buildingArtInset}=await import('../web/lib/three/world-building-placement.ts');
const {entranceFrame}=await import('../game/building-profile.js');
const {buildTerrace}=await import('../game/buildings.js');
const {createArchitectureReviewBattle}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const T=1.2360585147470482,V=25.066666666666666,rotations=[0,90,180,270],features=['palace-pediment','palace-portico-entablature','palace-portico-roof','palace-portico-return','palace-portico-crest'];
function fixture(rotation,view='exterior',roof='original'){
 const battle=createArchitectureReviewBattle('palacio',rotation,view,roof),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},frame=entranceFrame({...b,walls:battle.tiles}),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 const feature=(building,name)=>building.getObjectByName(`building-detail:${b.id}:${name}`),point=(u,v,y)=>{const p=frame.at(u,v);return new Vector3((p.x+buildingArtInset(b,input))*T,y,(p.y+buildingArtInset(b,input))*T);},center=frame.doorU-buildingArtInset(b,input)*(frame.u.x+frame.u.y);
 const build=()=>{const building=buildBuilding(b,input,T,geometry,materials);building.updateMatrixWorld(true);return building;},dispose=building=>{disposeWorldNode(building);geometry.dispose();materials.dispose();};
 return {b,input,frame,feature,point,center,build,dispose};
}

test('the actual palace portico has a shallow tiled gable, thick tympanum and joined supporting entablature at four rotations',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation),before=JSON.stringify(f.input),building=f.build(),height=building.userData.height,eave=height+7/V,peak=eave+27/V,roof=f.feature(building,'palace-portico-roof'),pediment=f.feature(building,'palace-pediment'),beam=f.feature(building,'palace-portico-entablature'),crest=f.feature(building,'palace-portico-crest');
  assert.ok(roof.getObjectByName(`building-roof-edges:${f.b.id}:palace-portico`),'the portico must have joined fascia, underside and ridge');assert.ok(roof.children.some(child=>child.material?.name==='world:clay'));
  const bounds=new Box3().setFromObject(roof);assert.ok(Math.abs(bounds.min.y-(eave+1/V-.075))<1e-5);assert.ok(Math.abs(bounds.max.y-(peak+1/V+.095))<1e-5,'the small portico ridge must rise above the main roof');assert.ok(bounds.max.y>height+31/V);
  const beamBounds=new Box3().setFromObject(beam),stone=beam.children.find(child=>child.material.name==='world:stone'),stoneBounds=new Box3().setFromObject(stone);assert.ok(Math.abs(beamBounds.min.y-(height-.12))<1e-5,'the returns must join the retained upper pilasters');assert.ok(Math.abs(stoneBounds.min.y-(height+1/V))<1e-5);assert.ok(Math.abs(stoneBounds.max.y-(height+8/V))<1e-5);
  const ray=new Raycaster(f.point(f.center+.28/T,-1.39,eave+.72),new Vector3(f.frame.v.x,0,f.frame.v.y),0,T*1.6),hits=ray.intersectObject(pediment,true).filter(hit=>hit.object.material.name==='world:ochre');assert.ok(hits.length>=2);assert.ok(Math.abs(hits.at(-1).distance-hits[0].distance-.18)<1e-5,'the tympanum must be closed masonry with real depth');
  const returnRay=new Raycaster(f.point(f.center+.28/T,2.2,eave+.72),new Vector3(-f.frame.v.x,0,-f.frame.v.y),0,T*1.6),returnHits=returnRay.intersectObject(f.feature(building,'palace-portico-return'),true).filter(hit=>hit.object.material.name==='world:ochre');assert.ok(returnHits.length>=2);assert.ok(Math.abs(returnHits.at(-1).distance-returnHits[0].distance-.18)<1e-5,'the roof return must close the gable above the main hip');
  const badgeBounds=new Box3().setFromObject(crest);assert.ok(badgeBounds.min.y>eave+.10&&badgeBounds.max.y<eave+.58,'the geometric badge must fit inside the real tympanum');
  const tileMesh=roof.children.find(child=>child.material?.name==='world:clay'),uv=tileMesh.geometry.getAttribute('uv'),us=[],vs=[];for(let n=0;n<uv.count;n++){us.push(uv.getX(n));vs.push(uv.getY(n));}assert.ok(Math.abs(Math.max(...us)-1.59*T)<1e-5);assert.ok(Math.abs(Math.max(...vs)-Math.hypot(3*T,27/V))<1e-5,'portico texture density must use real roof-slope metres');assert.equal(JSON.stringify(f.input),before);f.dispose(building);
 }
});

test('palace roof clearance includes the portico return and keeps distant walking slabs intact',()=>{
 for(const rotation of rotations)for(const mode of ['blocked','ground','front-route','return-route','inner-route']){
  const f=fixture(rotation),upper=buildTerrace({...f.b,roof:'terrace'},{elevation:4.9});f.input.terrain.upperSurfaces=upper.upperSurfaces.map(surface=>({...surface,blocked:true,obstacleHeight:0}));
  if(mode!=='blocked'){const p=f.frame.at(f.frame.doorU,mode==='inner-route'?3:mode==='return-route'?1:0),surface=f.input.terrain.upperSurfaces.find(surface=>surface.x===p.x&&surface.y===p.y);surface.blocked=false;if(mode==='ground')surface.tacticalLevel=0;}
  const before=JSON.stringify(f.input),building=f.build(),present=['blocked','ground','inner-route'].includes(mode);for(const feature of features)assert.equal(Boolean(f.feature(building,feature)),present,`${rotation}/${mode}/${feature}`);assert.equal(JSON.stringify(f.input),before);f.dispose(building);
 }
});

test('the palace portico preserves roof finishes and omits unsupported, short and inspected shells',()=>{
 for(const rotation of rotations){
  for(const finish of ['clay','aged','thatch']){
   const f=fixture(rotation);f.b.roofFinish=finish;f.b.wallFinish='brick';const before=JSON.stringify(f.input),building=f.build();assert.ok(f.feature(building,'palace-portico-roof').children.some(child=>child.material?.name===`world:${finish}`));assert.ok(f.feature(building,'palace-pediment').children.some(child=>child.material.name==='world:brick'));assert.equal(JSON.stringify(f.input),before);f.dispose(building);
  }
  const f=fixture(rotation);for(const u of [3,5]){const p=f.frame.at(u,0);f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y).type='rubble';}const unsupported=f.build();for(const feature of features)assert.equal(Boolean(f.feature(unsupported,feature)),false);f.dispose(unsupported);
  for(const roof of ['slab','roof-route']){const g=fixture(rotation,'exterior',roof),building=g.build();assert.equal(building.userData.height,3);for(const feature of features)assert.equal(Boolean(g.feature(building,feature)),false);g.dispose(building);}
  for(const view of ['partial','interior']){const g=fixture(rotation,view),building=g.build();assert.ok(g.input.revealedRooms.length>0);for(const feature of features)assert.equal(Boolean(g.feature(building,feature)),false);g.dispose(building);}
 }
});
