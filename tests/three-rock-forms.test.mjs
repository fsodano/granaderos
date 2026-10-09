import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {IcosahedronGeometry,Scene,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,WorldBatch,disposeWorldNode,seeded}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {ROCK_FORM_COUNT}=await import('../web/lib/three/world-rock-forms.ts');
const {buildTerrainChunk}=await import('../web/lib/three/world-terrain.ts');
const {createSectorWorld}=await import('../web/lib/three/sector-world.ts');
const T=1.2360585147470482,options={tileMetres:T,assetUrl:path=>path},tile=(x,y,extra={})=>({x,y,type:'stone',material:'stone',blocked:true,elevation:1.25,...extra});
const signature=group=>group.children.map(mesh=>({material:mesh.material.name,positions:Array.from(mesh.geometry.getAttribute('position').array),normals:Array.from(mesh.geometry.getAttribute('normal').array),colours:Array.from(mesh.geometry.getAttribute('color').array),uv:Array.from(mesh.geometry.getAttribute('uv').array)}));
function oldRocks(t,geometry,materials){
 const batch=new WorldBatch(geometry),x=t.x*T,z=t.y*T,height=t.elevation??0,h=t.obstacleHeight??(t.blocked?1.05:.22),scale=t.blocked?.65:.24,seed=seeded(t.x,t.y);
 batch.primitive('rock',materials.get('stone'),[x+.10,height+h*.42,z],[scale,h*.56,scale*.75]);batch.primitive('rock',materials.get('stone'),[x-.22,height+h*.23,z+.17],[scale*.6,h*.35,scale*.6],undefined,.91+seed*.09);return batch.finish('before');
}

test('three asymmetric rock forms retain the old twenty-face closed mesh, bounds and useful flat normals',()=>{
 const library=new WorldGeometry(),base=library.get('rock'),original=new IcosahedronGeometry(1,0);for(const name of ['position','normal','uv'])assert.deepEqual(Array.from(base.getAttribute(name).array),Array.from(original.getAttribute(name).array),'generic rubble/hearth rock stays exact');original.dispose();base.computeBoundingBox();const baseP=base.getAttribute('position'),forms=[],extent=base.boundingBox.max.x,shoulder=Math.min(...Array.from(baseP.array).filter(v=>v>0));
 for(let variant=0;variant<ROCK_FORM_COUNT;variant++){
  const geometry=library.get(`rock-form-${variant}`),p=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),edges=new Map(),corners=new Set();geometry.computeBoundingBox();
  assert.equal(p.count/3,20);assert.deepEqual(geometry.boundingBox.min.toArray(),base.boundingBox.min.toArray());assert.deepEqual(geometry.boundingBox.max.toArray(),base.boundingBox.max.toArray());assert.deepEqual(Array.from(geometry.getAttribute('uv').array),Array.from(base.getAttribute('uv').array),'texture coordinates and texture detail are retained');
  let broadTop=0;
  for(let n=0;n<p.count;n+=3){
   const points=[0,1,2].map(i=>new Vector3().fromBufferAttribute(p,n+i)),direction=new Vector3().crossVectors(points[1].clone().sub(points[0]),points[2].clone().sub(points[0]));assert.ok(direction.length()>1e-3);direction.normalize();
   for(const point of points)assert.ok(Math.abs(point.z)+(1-shoulder/extent)*Math.abs(point.x)<=extent+1e-7,'each corner stays inside the original six-sided plan footprint');
   assert.ok(direction.dot(points[0].clone().add(points[1]).add(points[2]).multiplyScalar(1/3))>0,'original triangle winding still faces outside');
   for(let i=0;i<3;i++)assert.ok(new Vector3().fromBufferAttribute(normal,n+i).distanceTo(direction)<1e-6,'each retained face has its geometric normal');
   if(direction.y>.98&&points.every(p=>p.y>.65))broadTop++;
   for(let i=0;i<3;i++){const a=points[i].toArray().join(','),b=points[(i+1)%3].toArray().join(','),key=[a,b].sort().join('|');corners.add(a);const row=edges.get(key)??[];row.push(`${a}|${b}`);edges.set(key,row);}
  }
  assert.ok(broadTop>=1,'a broad flatter top is present');assert.equal(corners.size,12);assert.equal(edges.size,30);for(const [key,rows]of edges){assert.equal(rows.length,2,'every edge remains closed');const [a,b]=key.split('|');assert.deepEqual([...rows].sort(),[`${a}|${b}`,`${b}|${a}`].sort());}
  const mirrorGap=[...corners].filter(key=>{const [x,y,z]=key.split(',').map(Number);return !corners.has([-x,y,z].join(','));}).length;assert.ok(mirrorGap>=8,'shape loses the original bilateral symmetry');forms.push(Array.from(p.array));assert.notDeepEqual(forms.at(-1),Array.from(baseP.array));
 }
 assert.notDeepEqual(forms[0],forms[1]);assert.notDeepEqual(forms[1],forms[2]);let releases=0;const cached=library.get('rock-form-0');cached.addEventListener('dispose',()=>releases++);assert.equal(library.get('rock-form-0'),cached);library.dispose();assert.equal(releases,1);
});

test('real rock cells preserve their old transforms, root depth, authored height and material budget',()=>{
 const library=new WorldGeometry(),materials=new WorldMaterials(options);
 for(const t of [tile(3,4),tile(-2,-5,{obstacleHeight:.60}),tile(7,7,{obstacleHeight:1.65}),tile(6,4,{blocked:false,roomId:'keeps-fragments-clear'})]){
  const input={terrain:{width:8,height:8,tiles:[Object.freeze(t)]}},before=JSON.stringify(t),old=oldRocks(t,library,materials),group=buildTerrainChunk('candidate',[t],input,T,library,materials),mesh=group.children.find(m=>m.material.name==='world:stone'),oldMesh=old.children[0];
  mesh.geometry.computeBoundingBox();oldMesh.geometry.computeBoundingBox();assert.equal(mesh.geometry.getAttribute('position').count/3,40);assert.deepEqual(mesh.geometry.boundingBox.min.toArray(),oldMesh.geometry.boundingBox.min.toArray());assert.deepEqual(mesh.geometry.boundingBox.max.toArray(),oldMesh.geometry.boundingBox.max.toArray());assert.ok(mesh.geometry.boundingBox.max.y<=t.elevation+(t.obstacleHeight??(t.blocked?1.05:.22)),'existing obstruction height is not exceeded');
  assert.equal(group.children.filter(m=>m.material.name==='world:stone').length,1);assert.equal(mesh.material,oldMesh.material);assert.equal(mesh.material.roughness,.94);assert.deepEqual(Array.from(mesh.geometry.getAttribute('color').array),Array.from(oldMesh.geometry.getAttribute('color').array));assert.deepEqual(Array.from(mesh.geometry.getAttribute('uv').array),Array.from(oldMesh.geometry.getAttribute('uv').array));assert.equal(JSON.stringify(t),before);disposeWorldNode(old);disposeWorldNode(group);
 }
 library.dispose();materials.dispose();
});

test('rock variation is seeded from admitted coordinates and stays identical across chunk splits',()=>{
 const library=new WorldGeometry(),materials=new WorldMaterials(options),tiles=Array.from({length:16},(_,n)=>tile(n-8,3)),input={terrain:{width:16,height:8,tiles}},whole=buildTerrainChunk('whole',tiles,input,T,library,materials),left=buildTerrainChunk('left',tiles.slice(0,8),input,T,library,materials),right=buildTerrainChunk('right',tiles.slice(8),input,T,library,materials),repeat=buildTerrainChunk('repeat',tiles,{...input,timeSeconds:123,reducedMotion:true},T,library,materials);
 const rows=group=>signature(group).filter(m=>m.material==='world:stone').flatMap(m=>Array.from({length:m.positions.length/9},(_,n)=>JSON.stringify(m.positions.slice(n*9,n*9+9)))).sort();assert.deepEqual(rows(whole),[...rows(left),...rows(right)].sort());assert.deepEqual(signature(whole),signature(repeat));
 const forms=new Set(tiles.map(t=>Math.floor(seeded(t.x,t.y,1201)*ROCK_FORM_COUNT)%ROCK_FORM_COUNT));assert.equal(forms.size,ROCK_FORM_COUNT);for(const group of [whole,left,right,repeat])disposeWorldNode(group);library.dispose();materials.dispose();
});

test('unadmitted rock cells disappear and authored height changes rebuild only the affected chunk',()=>{
 const a=tile(3,4),remote=tile(24,22),input={terrain:{width:32,height:24,tiles:[a,remote]}},scene=new Scene(),world=createSectorWorld(scene,options);world.update(input);const root=scene.getObjectByName('sector-world'),first=root.getObjectByName('terrain:0,0'),far=root.getObjectByName('terrain:3,2'),stone=first.children.find(m=>m.material.name==='world:stone');let releases=0;stone.geometry.addEventListener('dispose',()=>releases++);world.update(input);assert.equal(root.getObjectByName('terrain:0,0').uuid,first.uuid);
 world.update({terrain:{...input.terrain,tiles:[{...a,obstacleHeight:.60},remote]}});assert.equal(releases,1);assert.equal(root.getObjectByName('terrain:3,2').uuid,far.uuid);const changed=root.getObjectByName('terrain:0,0');assert.notEqual(changed.uuid,first.uuid);
 world.update({terrain:{...input.terrain,tiles:[remote]}});assert.equal(root.getObjectByName('terrain:0,0'),undefined);assert.equal(root.getObjectByName('terrain:3,2').uuid,far.uuid);world.dispose();
});
