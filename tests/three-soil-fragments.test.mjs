import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Scene,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,WorldBatch,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {soilFragments}=await import('../web/lib/three/world-soil-fragments.ts');
const {buildTerrainChunk}=await import('../web/lib/three/world-terrain.ts');
const {createSectorWorld}=await import('../web/lib/three/sector-world.ts');
const T=1.2360585147470482,options={tileMetres:T,assetUrl:path=>path};
function fragments(tile,kind='dirt',light=1){
 const geometry=new WorldGeometry(),materials=new WorldMaterials(options),batch=new WorldBatch(geometry);soilFragments(batch,tile,kind,T,materials,light);const group=batch.finish('fragments');
 return {group,dispose(){disposeWorldNode(group);materials.dispose();geometry.dispose();}};
}
const tile=(x,y,extra={})=>({x,y,type:'road',elevation:1.25,...extra});
const signature=group=>group.children.map(mesh=>({material:mesh.material.name,positions:Array.from(mesh.geometry.getAttribute('position').array),colours:Array.from(mesh.geometry.getAttribute('color').array),uv:Array.from(mesh.geometry.getAttribute('uv').array)}));
const active=(()=>{for(let y=0;y<8;y++)for(let x=0;x<8;x++){const t=tile(x,y),result=fragments(t),present=result.group.children.length;result.dispose();if(present)return t;}throw Error('The native fixture contains no fragment cluster');})();

test('soil has uneven sparse groups, bare patches and a strict18-triangle per-cell cap',()=>{
 let occupied=0,empty=0,total=0;const counts=new Set(),profiles=new Set();
 for(let y=0;y<24;y++)for(let x=0;x<32;x++){
  const t=tile(x,y),result=fragments(t),mesh=result.group.children[0];
  if(!mesh){empty++;result.dispose();continue;}
  occupied++;assert.equal(result.group.children.length,1,'all chips use one existing stone-material batch');
  const p=mesh.geometry.getAttribute('position'),triangles=p.count/3;counts.add(triangles);total+=triangles;assert.ok(triangles===12||triangles===18);assert.equal(mesh.material.name,'world:stone');assert.equal(mesh.material.roughness,.94);
  for(let start=0;start<p.count;start+=18){
   const points=Array.from({length:18},(_,n)=>new Vector3().fromBufferAttribute(p,start+n)),roots=new Set(points.filter(v=>Math.abs(v.y-t.elevation)<1e-6).map(v=>`${v.x},${v.z}`));
   assert.equal(roots.size,4,'four footprint corners meet the exact terrain surface');
   const width=Math.max(...points.map(v=>v.x))-Math.min(...points.map(v=>v.x)),depth=Math.max(...points.map(v=>v.z))-Math.min(...points.map(v=>v.z)),height=Math.max(...points.map(v=>v.y))-t.elevation;
   assert.ok(height>0&&height<=T*.013+1e-6);assert.ok(height<Math.max(width,depth)*.25,'chips remain shallow');
   for(const v of points){assert.ok(v.y>=t.elevation-1e-6);assert.ok(Math.abs(v.x-t.x*T)<=T*.5+1e-6);assert.ok(Math.abs(v.z-t.y*T)<=T*.5+1e-6);}
   for(let n=0;n<18;n+=3)assert.ok(new Vector3().crossVectors(points[n+1].clone().sub(points[n]),points[n+2].clone().sub(points[n])).y>0);
   profiles.add([width,depth,height].map(v=>Math.round(v*1e4)).join(','));
  }
  result.dispose();
 }
 assert.ok(occupied>80&&occupied<768*.35,'clusters are sparse across an outdoor field');assert.ok(empty>occupied);assert.deepEqual([...counts].sort((a,b)=>a-b),[12,18]);assert.ok(profiles.size>30,'flat forms and scale vary beyond rounding');assert.ok(total/768<5,'average cost remains below five triangles per eligible cell');
});

test('native fragment output is reproducible and does not change admitted tile records',()=>{
 const t=Object.freeze({...active,elevation:2.125}),before=JSON.stringify(t),a=fragments(t),b=fragments(t);
 assert.deepEqual(signature(a.group),signature(b.group));assert.equal(JSON.stringify(t),before);a.dispose();b.dispose();
});

test('admitted light dims chips without moving them or changing the shared stone material',()=>{
 const lit=fragments(active),dark=fragments(active,'dirt',.27),a=lit.group.children[0],b=dark.group.children[0];
 for(const key of ['position','normal','uv'])assert.deepEqual(b.geometry.getAttribute(key).array,a.geometry.getAttribute(key).array);
 assert.deepEqual(b.material.color,a.material.color);assert.equal(b.material.roughness,a.material.roughness);
 const ac=a.geometry.getAttribute('color').array,bc=b.geometry.getAttribute('color').array;
 assert.ok(bc.every((value,n)=>value>0&&value<ac[n]),'night illumination retains each muted chip while dimming every corner');
 lit.dispose();dark.dispose();
});

test('indoor, blocked, upper, paved and non-soil cells receive no fragments',()=>{
 for(const change of [{buildingId:'hidden-house'},{roomId:'hidden-room'},{blocked:true},{tacticalLevel:1},{type:'floor'},{type:'water'},{type:'grass'},{type:'rubble'}]){const result=fragments({...active,...change});assert.equal(result.group.children.length,0);result.dispose();}
 for(const kind of ['cobble','floor','mud','dry-grass','green-grass']){const result=fragments(active,kind);assert.equal(result.group.children.length,0);result.dispose();}
 const result=fragments({...active,type:'stone',material:'stone'});assert.ok(result.group.children.length);result.dispose();
});

test('real terrain integrates the same chips and retains shared disposal/cache rules',()=>{
 const input={terrain:{width:32,height:24,tiles:[active,tile(24,22,{type:'floor'})]}},scene=new Scene(),world=createSectorWorld(scene,options);world.update(input);const root=scene.getObjectByName('sector-world'),id=`terrain:${Math.floor(active.x/8)},${Math.floor(active.y/8)}`,first=root.getObjectByName(id),remote=root.getObjectByName('terrain:3,2'),stone=first.children.find(mesh=>mesh.material.name==='world:stone');assert.ok(stone);
 let releases=0;stone.geometry.addEventListener('dispose',()=>releases++);world.update(input);assert.equal(root.getObjectByName(id).uuid,first.uuid);
 world.update({terrain:{...input.terrain,tiles:[{...active,roomId:'hidden-room'},input.terrain.tiles[1]]}});assert.equal(releases,1);assert.equal(root.getObjectByName('terrain:3,2').uuid,remote.uuid);assert.equal(root.getObjectByName(id).children.some(mesh=>mesh.material.name==='world:stone'),false);world.dispose();
 const geometry=new WorldGeometry(),materials=new WorldMaterials(options),part=buildTerrainChunk('single',[active],input,T,geometry,materials),single=fragments(active);assert.deepEqual(signature(part).filter(m=>m.material==='world:stone'),signature(single.group));disposeWorldNode(part);materials.dispose();geometry.dispose();single.dispose();
});
