import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3,Mesh,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {entranceFrame,getBuildingProfile}=await import('../game/building-profile.js');
const {buildingDetails}=await import('../web/app/TacticalBuildingDetails.tsx');
const {ArchitectureVolume}=await import('../web/app/TacticalBuildingVolumes.tsx');
const {createArchitectureReviewBattle}=await import('./legacy-building-fixtures.mjs');
const T=1.2360585147470482,V=25.066666666666666,rotations=[0,90,180,270];
function fixture(rotation,view='exterior',roof='original',id='iglesia'){
 const battle=createArchitectureReviewBattle(id,rotation,view,roof),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},frame=entranceFrame({...b,walls:battle.tiles}),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 return {b,input,frame,feature:building=>building.getObjectByName(`building-detail:${b.id}:bell-tower`),foot(building){return this.feature(building)?.children.find(mesh=>mesh.material.name==='world:stone'&&mesh.material.color.getHexString()==='a99a79');},build(){const before=JSON.stringify(input),building=buildBuilding(b,input,T,geometry,materials);building.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before);return building;},dispose(building){disposeWorldNode(building);geometry.dispose();materials.dispose();}};
}
function sourceFoot(f){
 let source;const visit=node=>{if(!node)return;if(Array.isArray(node)){for(const child of node)visit(child);return;}if(node.type===ArchitectureVolume&&node.props.label==='tower-stone-base')source=node.props;visit(node.props?.children);};
 for(const object of buildingDetails({...f.b,walls:f.input.terrain.tiles.filter(tile=>tile.buildingId===f.b.id)},new Set(),(x,y)=>({x:(x-y)*26,y:(x+y)*14})))visit(object.node);
 assert.ok(source,'the actual current parish sprite has a separate warm stone tower base');return source;
}

test('compact and reserved parish tower feet keep the exact current source height, warm stone recipe and actual foundation through all rotations',()=>{
 for(const rotation of rotations)for(const compact of [false,true])for(const roof of ['original','slab','terrace']){
  const f=fixture(rotation,'exterior',roof);if(compact)for(const u of [1,f.frame.width-1]){const p=f.frame.at(u,1);f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y).type='floor';}
  const source=sourceFoot(f),building=f.build(),foot=f.foot(building),tower=f.feature(building),bounds=new Box3().setFromObject(foot);assert.ok(foot);assert.equal(source.texture,'stone');assert.equal(foot.material.color.getHexString(),source.palette.base.slice(1));assert.equal(foot.material.userData.architectureFinish.textureOpacity,.60);assert.equal(foot.material.userData.architectureFinish.texture,'/art/architecture-stone-v2.png');assert.equal(foot.material.userData.architectureFinish.multiplyOpacity,0);assert.ok(Math.abs(bounds.min.y)<1e-5);assert.ok(Math.abs(bounds.max.y-source.top/V)<1e-5);assert.ok(Math.abs(bounds.max.x-bounds.min.x-(compact?.8:1.8)*T)<1e-5);assert.ok(Math.abs(bounds.max.z-bounds.min.z-(compact?.8:1.8)*T)<1e-5);
  const p=foot.geometry.getAttribute('position');for(let n=0;n<p.count;n++)assert.equal(f.input.terrain.tiles.find(tile=>tile.x===Math.round(p.getX(n)/T)&&tile.y===Math.round(p.getZ(n)/T))?.type,'wall','the warm foot cannot expand the reserved ground foundation');
  const body=tower.children.find(mesh=>mesh.material.name===`world:${f.b.wallFinish}`);assert.ok(Math.abs(new Box3().setFromObject(body).min.y-bounds.max.y)<1e-5,'the upper body starts at the top of the stone foot instead of overlapping its outer plane');f.dispose(building);
 }
});

test('the warm tower foot retains metre texture courses and ordinary day/night illumination',()=>{
 for(const rotation of rotations)for(const night of [false,true]){
  const f=fixture(rotation);f.input.terrain.night=night;f.input.illumination={[`0:${f.b.x},${f.b.y}`]:.5};const building=f.build(),foot=f.foot(building),p=foot.geometry.getAttribute('position'),uv=foot.geometry.getAttribute('uv'),colour=foot.geometry.getAttribute('color'),normal=foot.geometry.getAttribute('normal'),expected=night?.27+.73*.5:1;let checked=0;
  for(let n=0;n<p.count;n++){for(const channel of ['getX','getY','getZ'])assert.ok(Math.abs(colour[channel](n)-expected)<1e-6);if(n%3===0&&Math.abs(normal.getY(n))<.5)for(const next of [n+1,n+2])if(Math.abs(p.getY(n)-p.getY(next))>.40){assert.ok(Math.abs(Math.abs(uv.getY(n)-uv.getY(next))-Math.abs(p.getY(n)-p.getY(next)))<1e-5);checked++;}}assert.ok(checked>0);f.dispose(building);
 }
});

test('edited church foundations and standing openings remain clear after the separate tower foot',()=>{
 for(const rotation of rotations)for(const type of ['door','window','rubble']){
  const f=fixture(rotation),corner=f.frame.at(f.frame.width,0),tile=f.input.terrain.tiles.find(tile=>tile.x===corner.x&&tile.y===corner.y);tile.type=type;f.input.terrain.tiles=[f.frame.door,...f.input.terrain.tiles.filter(tile=>tile!==f.frame.door)];f.frame.door.open=true;const building=f.build(),foot=f.foot(building);assert.ok(foot,'the other actual reserved foundation is still available');const p=foot.geometry.getAttribute('position');for(let n=0;n<p.count;n++)assert.equal(f.input.terrain.tiles.find(tile=>tile.x===Math.round(p.getX(n)/T)&&tile.y===Math.round(p.getZ(n)/T))?.type,'wall');
  const out=new Vector3(-f.frame.v.x,0,-f.frame.v.y);for(const offset of [-.20,0,.20])for(const y of [1.3,1.8]){const start=new Vector3(f.frame.door.x*T+offset*f.frame.u.x,y,f.frame.door.y*T+offset*f.frame.u.y).addScaledVector(out,T);assert.equal(new Raycaster(start,out.clone().negate(),0,2*T).intersectObject(foot,true).length,0);}f.dispose(building);
 }
});

test('tower feet follow normal route exclusion and disclosure while unpainted legacy and civic towers retain their previous materials',()=>{
 for(const rotation of rotations){
  for(const view of ['partial','interior']){const f=fixture(rotation,view),building=f.build();assert.equal(Boolean(f.foot(building)),false);f.dispose(building);}
  const route=fixture(rotation,'exterior','roof-route'),routeBuilding=route.build();assert.equal(Boolean(route.foot(routeBuilding)),false);route.dispose(routeBuilding);
  const short=fixture(rotation,'exterior','slab');short.input.terrain.upperSurfaces=short.input.terrain.upperSurfaces.map(surface=>({...surface,elevation:1.8}));const shortBuilding=short.build();assert.ok(Math.abs(new Box3().setFromObject(short.foot(shortBuilding)).max.y-(getBuildingProfile(short.b).plinthHeight+2)/V)<1e-5);short.dispose(shortBuilding);
  const legacy=fixture(rotation);legacy.b.architecture='church';legacy.b.kind=undefined;legacy.b.wallFinish=undefined;const legacyBuilding=legacy.build();assert.ok(legacy.feature(legacyBuilding));assert.equal(Boolean(legacy.foot(legacyBuilding)),false);legacy.dispose(legacyBuilding);
  const civic=fixture(rotation,'exterior','original','cabildo'),civicBuilding=civic.build(),tower=civicBuilding.getObjectByName(`building-detail:${civic.b.id}:civic-clock-tower`);assert.ok(tower);let meshes=0;tower.traverse(node=>{if(node instanceof Mesh){meshes++;assert.notEqual(node.material.name,'world:stone','the complete civic crown, including its nested cupola, cannot acquire a parish stone foot');}});assert.ok(meshes>0);assert.ok(tower.getObjectByName(`building-detail:${civic.b.id}:civic-cupola-roof`),'the actual source cupola remains part of the crown');civic.dispose(civicBuilding);
 }
});
