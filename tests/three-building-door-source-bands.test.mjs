import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,WorldBatch,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {addDoorLeaf}=await import('../web/lib/three/world-building-doors.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {ARCHITECTURE_REVIEW_TEMPLATES,createArchitectureReviewBattle}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const T=1.2360585147470482;
function render(battle){const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:p=>p}),input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},state=JSON.stringify(battle),building=buildBuilding(battle.buildings[0],input,T,geometry,materials);building.updateMatrixWorld(true);assert.equal(JSON.stringify(battle),state);return {building,dispose(){disposeWorldNode(building);geometry.dispose();materials.dispose();}};}
const close=(a,b)=>assert.ok(Math.abs(a-b)<2e-6,`${a} != ${b}`);
test('authored cross bands retain the Opening source proportions and colour on both leaf faces',()=>{
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:p=>p});
 for(const style of ['plank','double','arched','barn'])for(const sign of [-1,1])for(const height of [.8,1.88,1.9149,2.4]){
  const width=style==='double'?.37:.74,batch=new WorldBatch(geometry);addDoorLeaf(batch,materials,{width,height,sign,style,broken:false,light:1,sourceBands:true});const leaf=batch.finish('source-door'),band=leaf.children.find(c=>c.material.name==='world:door-cross-band');assert.ok(band);close(band.material.color.getHex(),0x4b4435);
  const bounds=new Box3().setFromObject(band),wide=style!=='plank';close(bounds.max.x-bounds.min.x,width*(wide?26/28:16/18));close(bounds.min.y,height*(7-1.3/2)/33);close(bounds.max.y,height*(24+1.3/2)/33);close(bounds.min.z,-.054);close(bounds.max.z,.054);
  for(const y of [7/33,24/33])for(const face of [-1,1]){const hit=new Raycaster(new Vector3(sign*width*.5,height*y,face*.2),new Vector3(0,0,-face),0,.4).intersectObject(leaf,true)[0];assert.equal(hit.object.material.name,'world:door-cross-band');close(hit.point.z*face,.054);}
  assert.ok(bounds.min.y>=0&&bounds.max.y<=height);assert.ok(bounds.min.x>=Math.min(0,sign*width)-1e-6&&bounds.max.x<=Math.max(0,sign*width)+1e-6);disposeWorldNode(leaf);
 }geometry.dispose();materials.dispose();
});
test('all fourteen compiled templates and roof edits retain supported bands at four rotations',()=>{
 let bands=0,doors=0;
 for(const {id}of ARCHITECTURE_REVIEW_TEMPLATES)for(const rotation of [0,90,180,270])for(const roof of ['original','slab','roof-route']){
  const battle=createArchitectureReviewBattle(id,rotation,'exterior',roof),r=render(battle);
  r.building.traverse(node=>{if(!node.isGroup||!node.name.startsWith('door-leaf:'))return;doors++;const band=node.children.find(c=>c.material.name==='world:door-cross-band');assert.equal(Boolean(band),node.userData.style!=='panelled',`${id}/${rotation}/${roof}`);if(band){bands++;const wood=node.children.find(c=>c.material.name==='world:wood'),a=new Box3().setFromObject(wood),b=new Box3().setFromObject(band);assert.ok(b.min.y>=a.min.y&&b.max.y<=a.max.y);}});r.dispose();
 }assert.ok(bands>=100&&doors>=168);
});
test('short cutaways and unrequested legacy leaves retain their existing band and hardware rules',()=>{
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:p=>p});
 for(const style of ['plank','panelled','double','arched','barn'])for(const sourceBands of [false,true])for(const height of [.28,1.91]){
  const batch=new WorldBatch(geometry);addDoorLeaf(batch,materials,{width:.37,height,sign:-1,style,broken:true,light:1,sourceBands});const leaf=batch.finish('retained-door');assert.equal(leaf.children.some(c=>c.material.name==='world:door-cross-band'),sourceBands&&height>=.75&&style!=='panelled');if(height<.75)assert.equal(leaf.children.some(c=>['world:iron','world:brass','world:door-cross-band'].includes(c.material.name)),false);disposeWorldNode(leaf);
 }geometry.dispose();materials.dispose();
 const battle=createArchitectureReviewBattle('capilla',90,'exterior');battle.buildings[0]={...battle.buildings[0],kind:undefined,architecture:'chapel',wallFinish:undefined};const r=render(battle);let bands=0;r.building.traverse(n=>{if(n.material?.name==='world:door-cross-band')bands++;});assert.equal(bands,0);r.dispose();
});
test('real open doors keep the standing approach and sight rays clear with source-sized bands',()=>{
 let rays=0;
 for(const id of ['casa','capilla','iglesia','barraca','ayuntamiento','pulperia','almacen','deposito','herreria','caballeriza','estancia'])for(const rotation of [0,90,180,270])for(const roof of ['original','slab','roof-route']){
  const battle=createArchitectureReviewBattle(id,rotation,'exterior',roof);battle.tiles=battle.tiles.map(t=>t.type==='door'?{...t,open:true,blocked:false}:t);const r=render(battle);
  r.building.traverse(door=>{if(!door.name.startsWith('door:'))return;for(const hinge of door.children){const leaf=hinge.children[0],wood=leaf.children.find(c=>c.material.name==='world:wood'),bounds=new Box3().setFromObject(wood);assert.ok(Number.isFinite(bounds.min.x));}
   // The semantic opening's centre is the hinge midpoint in the closed pose.
   const hinge=door.children[0],leaf=hinge.children[0],wood=leaf.children.find(c=>c.material.name==='world:wood'),local=new Box3().setFromBufferAttribute(wood.geometry.getAttribute('position')),w=local.max.x-local.min.x,centre=hinge.position.clone(),onX=Math.abs(Math.sin(hinge.rotation.y-Math.PI*.48))<1e-6;
   if(onX)centre.x+=w*(door.children.length>1?1:.5);else centre.z+=w*(door.children.length>1?1:.5);
   for(const height of [.5,1,1.65])for(const direction of [-1,1]){const origin=centre.clone();origin.y+=height;const rayDirection=onX?new Vector3(0,0,direction):new Vector3(direction,0,0);origin.addScaledVector(rayDirection,-T*.7);assert.equal(new Raycaster(origin,rayDirection,0,T*1.4).intersectObject(door,true).length,0,`${id}/${rotation}/${roof}/${height}: door band obstructs the real standing aperture`);rays++;}
  });r.dispose();
 }assert.ok(rays>=792);
});
