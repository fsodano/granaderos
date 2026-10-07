import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildVegetationChunk}=await import('../web/lib/three/world-vegetation.ts');
const T=1.2360585147470482;
const inputFor=(tiles,overrides={})=>({terrain:{width:16,height:8,tiles},...overrides});
function build(input){
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 const group=buildVegetationChunk('test',input.terrain.tiles,input,T,geometry,materials);
 return {group,dispose(){disposeWorldNode(group);materials.dispose();geometry.dispose();}};
}
const signature=group=>group.children.map(mesh=>({material:mesh.material.name,opacity:mesh.material.opacity,positions:Array.from(mesh.geometry.getAttribute('position').array),colours:Array.from(mesh.geometry.getAttribute('color').array)}));
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}

test('vegetation stays deterministic, bounded and rooted at the admitted cell and elevation',()=>{
 const sizes=[];
 for(const x of [2,3,6,8,10,11]){
  const tile={x,y:3,type:'forest',elevation:1.4},input=freeze(inputFor([tile])),before=JSON.stringify(input),a=build(input),b=build(input);
  assert.deepEqual(signature(a.group),signature(b.group));assert.equal(JSON.stringify(input),before);
  const bounds=new Box3().setFromObject(a.group),size=bounds.getSize(new Vector3());sizes.push(size.y);
  assert.ok(bounds.min.y>=tile.elevation-.025&&bounds.min.y<=tile.elevation+.025,'root remains at the authored ground height');
  assert.ok(size.y>2.5&&size.y<5.5,'forest retains adult tree proportions');
  assert.ok(bounds.min.x>x*T-1.8&&bounds.max.x<x*T+1.8&&bounds.min.z>3*T-1.8&&bounds.max.z<3*T+1.8,'canopy remains local to the rooted cell');
  for(const mesh of a.group.children)for(const value of mesh.geometry.getAttribute('position').array)assert.ok(Number.isFinite(value));
  a.dispose();b.dispose();
 }
 assert.ok(Math.max(...sizes)-Math.min(...sizes)>.8,'different cells retain visible height variation');
});

test('forest and scrub retain chunk batching within the previous geometry budget',()=>{
 const trees=[2,3,6,8,10,11].map(x=>({x,y:3,type:'forest'})),shrubs=[{x:4,y:3,type:'forest'},{x:5,y:3,type:'forest'},{x:1,y:5,type:'scrub'}];
 const input=inputFor([...trees,...shrubs,{x:13,y:3,type:'forest',buildingId:'occupied-house'},{x:14,y:3,type:'grass'}]),result=build(input);
 const triangles=result.group.children.reduce((total,mesh)=>total+mesh.geometry.getAttribute('position').count/3,0);
 assert.ok(triangles<=trees.length*2160+shrubs.length*320,'vegetation does not exceed the prior tree/shrub triangle allowance');
 assert.ok(result.group.children.length<=3,'one batch per existing opaque vegetation material');
 const visible=build(inputFor([...trees,...shrubs]));
 assert.deepEqual(signature(result.group),signature(visible.group),'building and grass cells contribute no tree geometry');
 result.dispose();visible.dispose();
});

test('actor canopy fading preserves geometry and only admits nearby actors on the same level',()=>{
 const tiles=[{x:8,y:3,type:'forest'}],base=build(inputFor(tiles)),near=build(inputFor(tiles,{admittedActorPoints:[{x:8.1,y:3.1}]}));
 const upper=build(inputFor(tiles,{admittedActorPoints:[{x:8.1,y:3.1,tacticalLevel:1}]})),far=build(inputFor(tiles,{admittedActorPoints:[{x:11,y:3}]}));
 assert.deepEqual(near.group.userData.softenedCells,['8,3']);assert.deepEqual(upper.group.userData.softenedCells,[]);assert.deepEqual(far.group.userData.softenedCells,[]);
 for(const result of [near,upper,far])assert.deepEqual(result.group.children.map(mesh=>Array.from(mesh.geometry.getAttribute('position').array)),base.group.children.map(mesh=>Array.from(mesh.geometry.getAttribute('position').array)));
 const foliage=near.group.children.find(mesh=>mesh.material.name!=='world:trunk');assert.equal(foliage.material.opacity,.42);assert.equal(foliage.castShadow,false);
 assert.equal(near.group.children.find(mesh=>mesh.material.name==='world:trunk').material.opacity,1);
 for(const result of [base,near,upper,far])result.dispose();
});
