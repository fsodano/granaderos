import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3,Mesh,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding,normalizedBuilding}=await import('../web/lib/three/world-buildings.ts');
const {buildingAppearance}=await import('../game/building-appearance.js');
const {ARCHITECTURE_REVIEW_TEMPLATES}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const {createArchitectureReviewBattle}=await import('./legacy-building-fixtures.mjs');
const T=1.2360585147470482,epsilon=1e-5;
function render(battle,tiles=battle.tiles){
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),input={terrain:{width:battle.width,height:battle.height,tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},before=JSON.stringify(input),b=battle.buildings[0],building=buildBuilding(b,input,T,geometry,materials);
 building.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before,'surface details must not change authored geometry, movement, or disclosure');
 return {building,surfaces:building.getObjectByName(`building-surfaces:${b.id}`),dispose(){disposeWorldNode(building);geometry.dispose();materials.dispose();}};
}
function hit(surfaces,b,tile,y){
 const onY=tile.y===b.y||tile.y===b.y+b.height-1,sign=onY?(tile.y===b.y?-1:1):(tile.x===b.x?-1:1),start=onY?new Vector3(tile.x*T,y,(tile.y+.4+sign)*T):new Vector3((tile.x+.4+sign)*T,y,tile.y*T),direction=onY?new Vector3(0,0,-sign):new Vector3(-sign,0,0);
 return new Raycaster(start,direction,0,T*1.6).intersectObject(surfaces,true);
}
test('four rotations of all fourteen templates retain a jointed 20 cm footing and clear doors/windows',()=>{
 let checked=0,openings=0;
 for(const {id}of ARCHITECTURE_REVIEW_TEMPLATES)for(const rotation of [0,90,180,270]){
  const battle=createArchitectureReviewBattle(id,rotation,'exterior'),b=battle.buildings[0],r=render(battle),stone=r.surfaces.children.find(child=>child.material?.name==='world:stone'),bounds=new Box3().setFromObject(stone);
  assert.ok(stone,`${id}/${rotation}: a base course must remain visible`);assert.ok(Math.abs(bounds.min.y)<epsilon);assert.ok(Math.abs(bounds.max.y-.20)<epsilon);
  // A real mortar joint is an unpainted gap in the blocks, rather than a
  // texture stretched to each wall segment. Probe a long solid front cell.
  const wall=battle.tiles.find(tile=>tile.buildingId===b.id&&tile.type==='wall'&&tile.y===b.y&&tile.x>b.x&&tile.x<b.x+b.width-1);
  if(wall){const first=(wall.x-.5)*T,last=(wall.x+.5)*T,joint=Math.ceil((first+.03)/.40)*.40;
   if(joint<last-.03){const start=new Vector3(joint,.10,(wall.y+.4)*T-1),ray=new Raycaster(start,new Vector3(0,0,1),0,2);assert.equal(ray.intersectObject(stone,true).length,0,'the world-aligned joint must remain open between stones');}}
  for(const tile of battle.tiles.filter(tile=>tile.buildingId===b.id&&['door','window'].includes(tile.type)&&(tile.x===b.x||tile.x===b.x+b.width-1||tile.y===b.y||tile.y===b.y+b.height-1))){
   assert.equal(hit(r.surfaces,b,tile,tile.type==='door'?.10:1.30).length,0,`${id}/${rotation}: surface details must leave the ${tile.type} clear`);openings++;
  }
  const finish=buildingAppearance(normalizedBuilding(b)).wallFinish,wear=r.surfaces.children.find(child=>child.material?.name==='world:plaster-wear');
  assert.equal(Boolean(wear),['limewash','ochre','adobe'].includes(finish),`${id}/${rotation}: only plaster exposes an undercoat`);
  r.dispose();checked++;
 }
 assert.equal(checked,56);assert.ok(openings>=300);
});
test('surface scenery stays in authored wall cells through all catalogue cutaways and breach edits',()=>{
 let checked=0;
 for(const {id}of ARCHITECTURE_REVIEW_TEMPLATES)for(const rotation of [0,90,180,270])for(const view of ['exterior','partial','interior']){
  const battle=createArchitectureReviewBattle(id,rotation,view),r=render(battle),cells=new Set(battle.tiles.filter(tile=>tile.buildingId===battle.buildings[0].id&&['wall','door','window'].includes(tile.type)).map(tile=>`${tile.x},${tile.y}`));
  r.surfaces.traverse(child=>{if(child instanceof Mesh){const p=child.geometry.getAttribute('position');for(let n=0;n<p.count;n++){
   const x=p.getX(n)/T,y=p.getZ(n)/T;let supported=false;
   for(let cx=Math.ceil(x-.5-epsilon);cx<=Math.floor(x+.5+epsilon);cx++)for(let cy=Math.ceil(y-.5-epsilon);cy<=Math.floor(y+.5+epsilon);cy++)if(cells.has(`${cx},${cy}`))supported=true;
   assert.ok(supported,`${id}/${rotation}/${view}: paint or footing entered an authored floor cell at ${x},${y}`);
  }}});r.dispose();checked++;
 }
 assert.equal(checked,168);
 for(const rotation of [0,90,180,270]){const battle=createArchitectureReviewBattle('ayuntamiento',rotation,'exterior'),tiles=battle.tiles.map(tile=>tile.type==='wall'?{...tile,type:'rubble'}:tile),r=render(battle,tiles);
  assert.equal(r.surfaces.children.some(child=>child.material?.name==='world:plaster-wear'),false,'a breach must remove its plaster fragments');r.dispose();}
});
test('metric slabs and legal roof routes keep lower facade details below the upper surface',()=>{
 for(const id of ['casa','capilla','ayuntamiento'])for(const rotation of [0,90,180,270])for(const roof of ['slab','roof-route']){
  const battle=createArchitectureReviewBattle(id,rotation,'exterior',roof),r=render(battle),bounds=new Box3().setFromObject(r.surfaces);
  assert.ok(bounds.max.y<1.5);assert.equal(r.building.userData.height,3);r.dispose();
 }
});
test('lower-wall wear is stable across rebuilds without changing authored finish colours',()=>{
 for(const finish of ['limewash','ochre','adobe','brick','stone']){
  const battle=createArchitectureReviewBattle('ayuntamiento',90,'exterior');battle.buildings=battle.buildings.map(b=>({...b,wallFinish:finish}));
  const first=render(battle),second=render(battle),signature=r=>r.surfaces.children.map(child=>({material:child.material.name,colour:child.material.color.getHexString(),vertices:[...child.geometry.getAttribute('position').array]}));
  assert.deepEqual(signature(first),signature(second));const fabric=first.building.getObjectByName(`building-fabric:${battle.buildings[0].id}`);
  assert.ok(fabric.children.some(child=>child.material.name===`world:${finish}`),'the authored finish must remain on the main wall fabric');first.dispose();second.dispose();
 }
});
