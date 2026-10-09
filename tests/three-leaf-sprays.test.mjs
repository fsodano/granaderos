import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3,Scene,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildVegetationChunk}=await import('../web/lib/three/world-vegetation.ts');
const {createSectorWorld}=await import('../web/lib/three/sector-world.ts');
const T=1.2360585147470482,options={tileMetres:T,assetUrl:path=>path},tiles=[1,4,5,8].map(x=>({x,y:0,type:'forest',elevation:1.25}));
const signature=group=>group.children.map(m=>({material:m.material.name,opacity:m.material.opacity,positions:Array.from(m.geometry.getAttribute('position').array),normals:Array.from(m.geometry.getAttribute('normal').array),colours:Array.from(m.geometry.getAttribute('color').array)}));
const points=geometry=>{const p=geometry.getAttribute('position');return Array.from({length:p.count},(_,n)=>new Vector3().fromBufferAttribute(p,n));};
const unique=points=>[...new Map(points.map(p=>[p.toArray().join(','),p])).values()];
function planes(points){
 const result=new Map();
 for(let a=0;a<points.length;a++)for(let b=a+1;b<points.length;b++)for(let c=b+1;c<points.length;c++){
  const normal=new Vector3().crossVectors(points[b].clone().sub(points[a]),points[c].clone().sub(points[a]));if(normal.lengthSq()<1e-10)continue;normal.normalize();let distance=normal.dot(points[a]);const gaps=points.map(p=>normal.dot(p)-distance);
  if(gaps.every(v=>v>=-1e-6)){normal.negate();distance=-distance;}else if(!gaps.every(v=>v<=1e-6))continue;
  const key=[...normal.toArray(),distance].map(v=>Math.round(v*1e5)).join(',');result.set(key,{normal,distance});
 }
 return [...result.values()];
}
function mask(geometry,offset,pixels){
 const view=offset.clone().normalize(),right=new Vector3().crossVectors(new Vector3(0,1,0),view).normalize(),up=new Vector3().crossVectors(view,right),p=points(geometry),result=new Set(),edge=(a,b,x,y)=>(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);
 for(let n=0;n<p.length;n+=3){
  const t=p.slice(n,n+3).map(v=>[50+v.dot(right)*pixels,50-v.dot(up)*pixels]),direction=Math.sign(edge(t[0],t[1],...t[2]));if(!direction)continue;
  for(let y=Math.floor(Math.min(...t.map(p=>p[1])));y<=Math.ceil(Math.max(...t.map(p=>p[1])));y++)for(let x=Math.floor(Math.min(...t.map(p=>p[0])));x<=Math.ceil(Math.max(...t.map(p=>p[0])));x++)if([0,1,2].every(i=>edge(t[i],t[(i+1)%3],x+.5,y+.5)*direction>=0))result.add(`${x},${y}`);
 }
 return result;
}

test('open folded leaves preserve every old crown hull plane with fewer triangles',()=>{
 const library=new WorldGeometry();
 for(let variant=0;variant<3;variant++){
  const old=library.get('crown-'+variant),leaf=library.get('leaf-spray-'+variant),oldPoints=unique(points(old)),vertices=points(leaf),tips=vertices.filter((_,n)=>n%6===2),oldPlanes=planes(oldPoints),tipPlanes=planes(tips);
  assert.ok(vertices.length/3<=80);assert.equal(vertices.length/6,variant===0?32:35);assert.ok(oldPlanes.length>20&&tipPlanes.length>20);
  for(const plane of oldPlanes)for(const p of vertices)assert.ok(plane.normal.dot(p)<=plane.distance+1e-6,'leaves do not expand the old crown envelope');
  for(const plane of tipPlanes)for(const p of oldPoints)assert.ok(plane.normal.dot(p)<=plane.distance+1e-6,'all original support directions and rotated bounds remain present');
  for(let n=0;n<vertices.length;n+=6){assert.deepEqual(vertices[n].toArray(),vertices[n+3].toArray());assert.deepEqual(vertices[n+2].toArray(),vertices[n+4].toArray());for(let t=0;t<6;t+=3)assert.ok(new Vector3().crossVectors(vertices[n+t+1].clone().sub(vertices[n+t]),vertices[n+t+2].clone().sub(vertices[n+t])).length()>1e-5);}
  for(const offset of [new Vector3(5,4.2,5),new Vector3(-5,4.2,-5)])for(const pixels of [25,50]){const before=mask(old,offset,pixels),after=mask(leaf,offset,pixels),gaps=[...before].filter(p=>!after.has(p));assert.ok(gaps.length>before.size*.15,'readable projected gaps replace the formerly closed lobe');assert.ok(after.size>before.size*.20,'the crown does not become isolated tiny dots');}
 }
 library.dispose();
});

test('native trees and shrubs retain exact bounds, roots, branches, poplar shape and material batches',()=>{
 const library=new WorldGeometry(),materials=new WorldMaterials(options),baseline={get:kind=>library.get(kind.startsWith('leaf-spray-')?kind.replace('leaf-spray-','crown-'):kind)};
 for(const tile of [...tiles,{x:1,y:5,type:'scrub',elevation:1.25}]){
  const input={terrain:{width:12,height:8,tiles:[Object.freeze(tile)]}},before=JSON.stringify(input),old=buildVegetationChunk('old',[tile],input,T,baseline,materials),next=buildVegetationChunk('new',[tile],input,T,library,materials),oldBounds=new Box3().setFromObject(old),newBounds=new Box3().setFromObject(next);
  assert.deepEqual(newBounds.min.toArray(),oldBounds.min.toArray());assert.deepEqual(newBounds.max.toArray(),oldBounds.max.toArray());assert.deepEqual(signature(next).filter(m=>m.material==='world:trunk'),signature(old).filter(m=>m.material==='world:trunk'),'complete trunk and fork streams stay exact');assert.deepEqual(next.children.map(m=>m.material),old.children.map(m=>m.material));
  const count=group=>group.children.reduce((sum,m)=>sum+m.geometry.getAttribute('position').count/3,0);assert.ok(count(next)<count(old));assert.equal(JSON.stringify(input),before);disposeWorldNode(old);disposeWorldNode(next);
 }
 library.dispose();materials.dispose();
});

test('foliage repeatability, actor fade and admission retain existing cache and disposal rules',()=>{
 const scene=new Scene(),world=createSectorWorld(scene,options),a={x:5,y:3,type:'forest',elevation:.65},remote={x:24,y:22,type:'forest'},hidden={x:4,y:3,type:'forest',buildingId:'hidden-house'},input={terrain:{width:32,height:24,tiles:[a,remote,hidden]}};world.update(input);const root=scene.getObjectByName('sector-world'),first=root.getObjectByName('vegetation:0,0'),far=root.getObjectByName('vegetation:3,2'),positions=signature(first).map(m=>m.positions);let releases=0;first.children[0].geometry.addEventListener('dispose',()=>releases++);
 world.update({...input,timeSeconds:123,reducedMotion:true});assert.equal(root.getObjectByName('vegetation:0,0').uuid,first.uuid);
 world.updateActors([{x:5.1,y:3.1,tacticalLevel:1}]);assert.equal(root.getObjectByName('vegetation:0,0').uuid,first.uuid);
 world.updateActors([{x:5.1,y:3.1}]);const faded=root.getObjectByName('vegetation:0,0');assert.equal(releases,1);assert.deepEqual(signature(faded).map(m=>m.positions),positions);assert.equal(root.getObjectByName('vegetation:3,2').uuid,far.uuid);const leaf=faded.children.find(m=>m.material.name!=='world:trunk');assert.equal(leaf.material.opacity,.42);assert.equal(leaf.castShadow,false);assert.equal(leaf.material.depthWrite,false);
 world.updateActors([]);assert.deepEqual(signature(root.getObjectByName('vegetation:0,0')),signature(first));world.update({terrain:{...input.terrain,tiles:[remote]}});assert.equal(root.getObjectByName('vegetation:0,0'),undefined);assert.equal(root.getObjectByName('vegetation:3,2').uuid,far.uuid);world.dispose();
 const library=new WorldGeometry(),materials=new WorldMaterials(options),visible=buildVegetationChunk('visible',[a],{terrain:{width:8,height:8,tiles:[a]}},T,library,materials),admitted=buildVegetationChunk('admitted',[a,hidden],input,T,library,materials);assert.deepEqual(signature(admitted),signature(visible));let disposals=0;const cached=library.get('leaf-spray-0');cached.addEventListener('dispose',()=>disposals++);assert.equal(library.get('leaf-spray-0'),cached);disposeWorldNode(visible);disposeWorldNode(admitted);materials.dispose();library.dispose();assert.equal(disposals,1);
});
