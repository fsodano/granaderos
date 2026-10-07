import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3,Mesh,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {postaPiers}=await import('../web/lib/three/world-posta-piers.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {entranceFrame}=await import('../game/building-profile.js');
const {createArchitectureReviewBattle}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const T=1.2360585147470482,V=25.066666666666666,rotations=[0,90,180,270];
function fixture(rotation,roof='original'){
 const battle=createArchitectureReviewBattle('posta',rotation,'exterior',roof),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},frame=entranceFrame({...b,walls:battle.tiles}),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),shell=buildBuilding(b,input,T,geometry,materials),height=shell.userData.height;disposeWorldNode(shell);
 return {b,input,frame,height,build(){const before=JSON.stringify(input),piers=postaPiers(b,input,T,height,0,geometry,materials);piers.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before);return piers;},dispose(piers){disposeWorldNode(piers);geometry.dispose();materials.dispose();}};
}

test('centred posta capitals remain visibly exposed beyond the actual hip eave through all four rotations',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),building=buildBuilding(f.b,f.input,T,geometry,materials);building.updateMatrixWorld(true);const piers=building.getObjectByName(`building-detail:${f.b.id}:posta-corner-piers`);
  for(const u of [0,f.frame.width]){const p=f.frame.at(u,-.40),ray=new Raycaster(new Vector3(p.x*T,f.height+3,p.y*T),new Vector3(0,-1,0),0,5),hit=ray.intersectObject(building,true)[0];assert.ok(hit);assert.ok(hit.object.parent===piers,'the actual hip roof and canopy must not hide the front capital');assert.equal(hit.object.material.name,'world:trim');assert.ok(Math.abs(hit.point.y-(f.height-1.5/V))<1e-5,'the exposed cap must remain on its supported real height');}
  disposeWorldNode(building);geometry.dispose();materials.dispose();f.dispose(f.build());
 }
});

test('centred posta thin porch posts expose their full face and preserve a standing doorway crossing at four rotations',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});f.frame.door.open=true;const building=buildBuilding(f.b,f.input,T,geometry,materials);building.updateMatrixWorld(true);const porch=building.getObjectByName(`building-detail:${f.b.id}:posta-masonry-veranda`),fabric=building.getObjectByName(`building-fabric:${f.b.id}`),out=new Vector3(-f.frame.v.x,0,-f.frame.v.y),posts=Array.from({length:Math.floor(f.frame.width)+1},(_,u)=>u).filter(u=>u>0&&u<f.frame.width&&u%2===0&&f.input.terrain.tiles.find(tile=>{const p=f.frame.at(u,0);return tile.x===p.x&&tile.y===p.y;})?.type==='wall');assert.ok(posts.length>0);
  for(const u of posts){const p=f.frame.at(u,0),ray=new Raycaster(new Vector3(p.x*T,1.5,p.y*T).addScaledVector(out,T),out.clone().negate(),0,2*T),post=ray.intersectObject(porch,true)[0],wall=ray.intersectObject(fabric,true)[0];assert.ok(post&&wall);assert.equal(post.object.material.name,'world:ochre');assert.ok(wall.distance-post.distance>.30,'the source thin post must not remain buried in the main shell');}
  for(const offset of [-.20,0,.20])for(const y of [1.3,1.8]){const door=f.frame.door,ray=new Raycaster(new Vector3(door.x*T+f.frame.u.x*offset,y,door.y*T+f.frame.u.y*offset).addScaledVector(out,T),out.clone().negate(),0,2*T);assert.equal(ray.intersectObject(building,true).length,0,'the standing character must keep a clear route through the open entrance');}
  disposeWorldNode(building);geometry.dispose();materials.dispose();f.dispose(f.build());
 }
});

test('the actual posta porch separates its corner piers from thin supported posts and keeps all openings clear',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation),before=JSON.stringify(f.input),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),building=buildBuilding(f.b,f.input,T,geometry,materials);building.updateMatrixWorld(true);const piers=building.getObjectByName(`building-detail:${f.b.id}:posta-corner-piers`),porch=building.getObjectByName(`building-detail:${f.b.id}:posta-masonry-veranda`);assert.ok(piers&&porch);assert.ok(porch.getObjectByName(`building-roof-edges:${f.b.id}:posta-masonry-veranda`));assert.ok(porch.children.some(child=>child.material.name==='world:aged'),'the porch must retain the original aged roof finish');
  for(const tile of f.input.terrain.tiles.filter(tile=>tile.buildingId===f.b.id&&['door','window'].includes(tile.type))){const onY=tile.y===f.b.y||tile.y===f.b.y+f.b.height-1,sign=onY?(tile.y===f.b.y?-1:1):(tile.x===f.b.x?-1:1),y=tile.type==='window'?1.3:1.9,start=onY?new Vector3(tile.x*T,y,(tile.y+.4+sign)*T):new Vector3((tile.x+.4+sign)*T,y,tile.y*T),direction=onY?new Vector3(0,0,-sign):new Vector3(-sign,0,0);for(const detail of [piers,porch])assert.equal(new Raycaster(start,direction,0,T*1.6).intersectObject(detail,true).length,0,'porch details must keep the standing doorway and window centre clear');}
  assert.equal(JSON.stringify(f.input),before);disposeWorldNode(building);geometry.dispose();materials.dispose();f.dispose(f.build());
 }
});

test('posta corner piers and porch supports follow normal partial and complete room disclosure',()=>{
 for(const rotation of rotations)for(const view of ['partial','interior']){
  const battle=createArchitectureReviewBattle('posta',rotation,view),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},before=JSON.stringify(input),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),building=buildBuilding(b,input,T,geometry,materials);for(const name of ['posta-corner-piers','posta-masonry-veranda'])assert.equal(Boolean(building.getObjectByName(`building-detail:${b.id}:${name}`)),false);assert.equal(JSON.stringify(input),before);disposeWorldNode(building);geometry.dispose();materials.dispose();
 }
});

test('posta corner shafts, stone feet and capitals remain visible and fully inside their actual four-rotation wall cells',()=>{
 for(const rotation of rotations){
  const f=fixture(rotation),piers=f.build(),bounds=new Box3().setFromObject(piers);assert.equal(bounds.min.y,0);assert.ok(Math.abs(bounds.max.y-(f.height-1.5/V))<1e-5);assert.ok(piers.children.some(child=>child.material.name==='world:stone'));assert.ok(piers.children.some(child=>child.material.name==='world:ochre'),'the current authored posta pigment must remain');
  piers.traverse(child=>{if(child instanceof Mesh){const p=child.geometry.getAttribute('position');for(let n=0;n<p.count;n++)assert.equal(f.input.terrain.tiles.find(tile=>tile.x===Math.round(p.getX(n)/T)&&tile.y===Math.round(p.getZ(n)/T))?.type,'wall','every stepped pier part must stay inside an intact support cell');}});
  for(const u of [0,f.frame.width]){const p=f.frame.at(u,0),out=new Vector3(-f.frame.v.x,0,-f.frame.v.y),start=new Vector3(p.x*T,1.5,p.y*T).addScaledVector(out,2*T);assert.ok(new Raycaster(start,out.clone().negate(),0,3*T).intersectObject(piers,true).length>0,'the shaft must expose a continuous face beside the corner');}f.dispose(piers);
 }
});

test('posta piers follow real flat roofs and omit corners edited into doors, windows or breaches',()=>{
 for(const rotation of rotations){
  for(const roof of ['slab','terrace','roof-route']){const f=fixture(rotation,roof),piers=f.build();assert.ok(new Box3().setFromObject(piers).max.y<f.height-.05,'capitals must remain below the authored upper walking surface');f.dispose(piers);}
  for(const type of ['door','window','rubble']){const f=fixture(rotation),entrance=f.frame.door;for(const u of [0,f.frame.width]){const p=f.frame.at(u,0);f.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y).type=type;}f.input.terrain.tiles=[entrance,...f.input.terrain.tiles.filter(tile=>tile!==entrance)];const piers=f.build();assert.equal(piers.children.length,0,'an unsupported corner must not retain a solid pier');f.dispose(piers);}
 }
});
