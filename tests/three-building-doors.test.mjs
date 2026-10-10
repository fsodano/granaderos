import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,WorldBatch,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {addDoorLeaf}=await import('../web/lib/three/world-building-doors.ts');
const {buildBuilding,normalizedBuilding}=await import('../web/lib/three/world-buildings.ts');
const {buildingAppearance}=await import('../game/building-appearance.js');
const {ARCHITECTURE_REVIEW_TEMPLATES}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const {createArchitectureReviewBattle}=await import('./legacy-building-fixtures.mjs');
const T=1.2360585147470482;
function render(battle,tiles=battle.tiles){
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),input={terrain:{width:battle.width,height:battle.height,tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},before=JSON.stringify(input),building=buildBuilding(battle.buildings[0],input,T,geometry,materials);
 assert.equal(JSON.stringify(input),before);building.updateMatrixWorld(true);return {building,dispose(){disposeWorldNode(building);geometry.dispose();materials.dispose();}};
}
test('retained door styles expose their panels, straps and barn braces on both leaf faces',()=>{
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 for(const style of ['plank','panelled','double','arched','barn']){
  const batch=new WorldBatch(geometry);addDoorLeaf(batch,materials,{width:.74,height:1.91,sign:1,style,broken:false,light:1});const leaf=batch.finish('door-review');leaf.updateMatrixWorld(true);
  for(const face of [-1,1]){
   const x=style==='panelled'?.74*.28:style==='barn'?.74*(.10+.40*(.88-.60)/.78):.74*.5,y=1.91*(style==='panelled'?.30:style==='barn'?.60:.73),hits=new Raycaster(new Vector3(x,y,face*.20),new Vector3(0,0,-face),0,.4).intersectObject(leaf,true);
   assert.ok(hits.length);assert.ok(hits[0].point.z*face>.039,'surface detail must lie on the camera-facing side');
   assert.equal(hits[0].object.material.name,style==='panelled'?'world:darkwood':style==='barn'?'world:timber-brace':'world:iron');
  }
  const brass=leaf.children.find(child=>child.material.name==='world:brass'),b=new Box3().setFromObject(brass);assert.ok(b.min.z<-.078&&b.max.z>.078,'handles must be readable from either side');disposeWorldNode(leaf);
 }
 geometry.dispose();materials.dispose();
});
test('actual compiled doors retain their authored styles and both faces at four catalogue rotations',()=>{
 let doors=0;
 for(const {id}of ARCHITECTURE_REVIEW_TEMPLATES)for(const rotation of [0,90,180,270]){
  const battle=createArchitectureReviewBattle(id,rotation,'exterior'),b=battle.buildings[0],r=render(battle),appearance=buildingAppearance(normalizedBuilding(b));
  for(const tile of battle.tiles.filter(tile=>tile.buildingId===b.id&&tile.type==='door')){
   const door=r.building.getObjectByName(`door:${tile.doorId??`door:${tile.x},${tile.y}`}`);assert.ok(door);assert.equal(door.userData.open,Boolean(tile.open));
   for(const hinge of door.children){const leaf=hinge.children[0],style=tile.style??appearance.doorStyle;assert.equal(leaf.userData.style,style);const brass=leaf.children.find(child=>child.material.name==='world:brass');assert.ok(brass,'full-height doors retain their hardware');const points=brass.geometry.getAttribute('position');let front=false,back=false;
    for(let n=0;n<points.count;n++){front||=points.getZ(n)>.078;back||=points.getZ(n)<-.078;}assert.ok(front&&back,`${id}/${rotation}: handle is missing on one door face`);
   }doors++;
  }r.dispose();
 }
 assert.ok(doors>=56);
});
test('open authored doors clear the standing opening at every rotation and breaches remove the leaves',()=>{
 let checked=0;
 for(const {id}of ARCHITECTURE_REVIEW_TEMPLATES)for(const rotation of [0,90,180,270]){
  const battle=createArchitectureReviewBattle(id,rotation,'exterior'),b=battle.buildings[0],tiles=battle.tiles.map(tile=>tile.type==='door'?{...tile,open:true,blocked:false}:tile),r=render(battle,tiles);
  for(const tile of tiles.filter(tile=>tile.buildingId===b.id&&tile.type==='door'&&(tile.x===b.x||tile.x===b.x+b.width-1||tile.y===b.y||tile.y===b.y+b.height-1))){
   const onY=tile.y===b.y||tile.y===b.y+b.height-1,sign=onY?(tile.y===b.y?-1:1):(tile.x===b.x?-1:1),start=onY?new Vector3(tile.x*T,1,(tile.y+.4+sign)*T):new Vector3((tile.x+.4+sign)*T,1,tile.y*T),direction=onY?new Vector3(0,0,-sign):new Vector3(-sign,0,0),door=r.building.getObjectByName(`door:${tile.doorId??`door:${tile.x},${tile.y}`}`);
   assert.equal(new Raycaster(start,direction,0,T*1.6).intersectObject(door,true).length,0,`${id}/${rotation}: new door relief covers the standing opening`);checked++;
  }r.dispose();
  const breached=render(battle,tiles.map(tile=>tile.type==='door'?{...tile,type:'rubble'}:tile));assert.equal(breached.building.children.some(child=>child.name.startsWith('door:')),false);breached.dispose();
 }assert.ok(checked>=56);
});
test('short room cutaways omit full-size hardware and preserve the existing low leaf',()=>{
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 for(const style of ['plank','panelled','double','arched','barn'])for(const sign of [-1,1]){
  const batch=new WorldBatch(geometry);addDoorLeaf(batch,materials,{width:.37,height:.28,sign,style,broken:true,light:1});const leaf=batch.finish('cut-door'),bounds=new Box3().setFromObject(leaf);
  assert.ok(bounds.min.y>=0&&bounds.max.y<=.28);assert.equal(leaf.children.some(child=>['world:iron','world:brass'].includes(child.material.name)),false);assert.ok(bounds.min.x>=Math.min(0,sign*.37)-1e-6&&bounds.max.x<=Math.max(0,sign*.37)+1e-6);disposeWorldNode(leaf);
 }geometry.dispose();materials.dispose();
 for(const rotation of [0,90,180,270])for(const roof of ['slab','roof-route'])for(const view of ['partial','interior']){const battle=createArchitectureReviewBattle('ayuntamiento',rotation,view,roof),r=render(battle);assert.equal(r.building.userData.height,3);r.dispose();}
});
