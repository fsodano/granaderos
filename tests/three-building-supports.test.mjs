import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Mesh,Box3,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {ARCHITECTURE_REVIEW_TEMPLATES,createArchitectureReviewBattle}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const T=1.2360585147470482,epsilon=1e-5;

function supported(details,tiles,label){
 const solid=new Set(tiles.filter(tile=>tile.type==='wall').map(tile=>`${tile.x},${tile.y}`));
 details.traverse(child=>{if(child instanceof Mesh){const positions=child.geometry.getAttribute('position');for(let n=0;n<positions.count;n++)if(positions.getY(n)<1.8){
  const qx=positions.getX(n)/T,qy=positions.getZ(n)/T;let inWall=false;
  // A shared tile edge belongs to either touching cell. This avoids treating
  // numerical boundary touches as penetrations into the neighbouring floor.
  for(let x=Math.ceil(qx-.5-epsilon);x<=Math.floor(qx+.5+epsilon);x++)for(let y=Math.ceil(qy-.5-epsilon);y<=Math.floor(qy+.5+epsilon);y++)if(solid.has(`${x},${y}`))inWall=true;
  assert.ok(inWall,`${label}/${child.parent.name}: low scenery extends outside an intact wall at ${qx},${qy}`);
 }}});
}

test('all fourteen actual compiled exteriors keep low architectural scenery in solid cells at four rotations',()=>{
 let checked=0;
 for(const {id}of ARCHITECTURE_REVIEW_TEMPLATES)for(const rotation of [0,90,180,270]){
  const battle=createArchitectureReviewBattle(id,rotation,'exterior'),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
  for(const edit of ['original','window','rubble']){
   const tiles=battle.tiles.map(tile=>tile.type==='wall'&&edit!=='original'?{...tile,type:edit}:tile),input={terrain:{width:battle.width,height:battle.height,tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},before=JSON.stringify(input),building=buildBuilding(battle.buildings[0],input,T,geometry,materials),details=building.getObjectByName(`building-details:${battle.buildings[0].id}`);
   supported(details,tiles,`${id}/${rotation}/${edit}`);assert.equal(JSON.stringify(input),before,'presentation must not change authored collision or disclosure');disposeWorldNode(building);checked++;
  }
  geometry.dispose();materials.dispose();
 }
 assert.equal(checked,168);
});

test('actual pulperia signs remain inside their intact wall support and above standing door height',()=>{
 for(const rotation of [0,90,180,270]){
  const battle=createArchitectureReviewBattle('pulperia',rotation,'exterior'),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings},revealedRooms:battle.revealedRooms},building=buildBuilding(battle.buildings[0],input,T,geometry,materials),sign=building.getObjectByName(`building-detail:${battle.buildings[0].id}:trade-sign`);
  assert.ok(sign);assert.ok(new Box3().setFromObject(sign).min.y>=1.9);sign.traverse(child=>{if(child instanceof Mesh){const p=child.geometry.getAttribute('position');for(let n=0;n<p.count;n++)assert.equal(battle.tiles.find(tile=>tile.x===Math.round(p.getX(n)/T)&&tile.y===Math.round(p.getZ(n)/T))?.type,'wall','a hanging plaque must not occupy the legal porch route');}});
  disposeWorldNode(building);geometry.dispose();materials.dispose();
 }
});

test('support corrections preserve every authored exterior doorway and window centre through four rotations',()=>{
 let openings=0;
 for(const {id}of ARCHITECTURE_REVIEW_TEMPLATES)for(const rotation of [0,90,180,270]){
  const battle=createArchitectureReviewBattle(id,rotation,'exterior'),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings},revealedRooms:battle.revealedRooms},building=buildBuilding(b,input,T,geometry,materials),details=building.getObjectByName(`building-details:${b.id}`);details.updateMatrixWorld(true);
  for(const tile of battle.tiles.filter(tile=>tile.buildingId===b.id&&['door','window'].includes(tile.type))){
   const onX=tile.x===b.x||tile.x===b.x+b.width-1,onY=tile.y===b.y||tile.y===b.y+b.height-1;if(!onX&&!onY)continue;
   const y=tile.type==='door'?1.9:1.3,sign=onY?(tile.y===b.y?-1:1):(tile.x===b.x?-1:1),start=onY?new Vector3(tile.x*T,y,(tile.y+.4+sign)*T):new Vector3((tile.x+.4+sign)*T,y,tile.y*T),direction=onY?new Vector3(0,0,-sign):new Vector3(-sign,0,0),ray=new Raycaster(start,direction,0,T*1.6);
   assert.equal(ray.intersectObject(details,true).length,0,`${id}/${rotation}: supports cover the ${tile.type} at ${tile.x},${tile.y}`);openings++;
  }
  disposeWorldNode(building);geometry.dispose();materials.dispose();
 }
 assert.ok(openings>=300,'the check must cover the full authored catalogue');
});

test('authored low palace slabs omit the decorative second floor and preserve the standing entrance',()=>{
 for(const rotation of [0,90,180,270]){
  const battle=createArchitectureReviewBattle('palacio',rotation,'exterior'),b=battle.buildings[0],door=battle.tiles.find(tile=>tile.buildingId===b.id&&tile.type==='door'&&(tile.x===b.x||tile.x===b.x+b.width-1||tile.y===b.y||tile.y===b.y+b.height-1)),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:[{x:b.x+2,y:b.y+2,type:'floor',kind:'roof',buildingId:b.id,tacticalLevel:1,elevation:3,blocked:false}]},revealedRooms:battle.revealedRooms},before=JSON.stringify(input),building=buildBuilding(b,input,T,geometry,materials),details=building.getObjectByName(`building-details:${b.id}`);
  assert.equal(building.userData.height,3);assert.equal(details.getObjectByName(`building-detail:${b.id}:palace-balcony`),undefined);assert.equal(details.getObjectByName(`building-detail:${b.id}:palace-upper-windows`),undefined);supported(details,battle.tiles,`palace-slab/${rotation}`);
  const onY=door.y===b.y||door.y===b.y+b.height-1,sign=onY?(door.y===b.y?-1:1):(door.x===b.x?-1:1),start=onY?new Vector3(door.x*T,1.9,(door.y+.4+sign)*T):new Vector3((door.x+.4+sign)*T,1.9,door.y*T),direction=onY?new Vector3(0,0,-sign):new Vector3(-sign,0,0);details.updateMatrixWorld(true);
  assert.equal(new Raycaster(start,direction,0,T*1.6).intersectObject(details,true).length,0,'metric slabs must not put a decorative balcony across the standing entrance');assert.equal(JSON.stringify(input),before);disposeWorldNode(building);geometry.dispose();materials.dispose();
 }
});
