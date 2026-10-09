import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Scene,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,WorldBatch,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {dryWeeds}=await import('../web/lib/three/world-dry-weeds.ts');
const {buildTerrainChunk}=await import('../web/lib/three/world-terrain.ts');
const {createSectorWorld}=await import('../web/lib/three/sector-world.ts');
const T=1.2360585147470482,options={tileMetres:T,assetUrl:path=>path};
const tile=(x,y,extra={})=>({x,y,type:'grass',elevation:1.25,...extra});
function weeds(t,kind='dry-grass',light=1){
 const geometry=new WorldGeometry(),materials=new WorldMaterials(options),batch=new WorldBatch(geometry);dryWeeds(batch,t,kind,T,materials,light);const group=batch.finish('weeds');
 return {group,dispose(){disposeWorldNode(group);materials.dispose();geometry.dispose();}};
}
const signature=group=>group.children.map(mesh=>({material:mesh.material.name,positions:Array.from(mesh.geometry.getAttribute('position').array),colours:Array.from(mesh.geometry.getAttribute('color').array)}));
const active=(()=>{for(let y=0;y<8;y++)for(let x=0;x<8;x++){const t=tile(x,y),result=weeds(t),present=result.group.children.length;result.dispose();if(present)return t;}throw Error('The native fixture contains no dry stem');})();
const dryTriangles=group=>group.children.filter(mesh=>mesh.material.name==='world:grass').flatMap(mesh=>{
 const p=mesh.geometry.getAttribute('position'),c=mesh.geometry.getAttribute('color'),rows=[];
 for(let n=0;n<p.count;n+=3)if(c.getX(n)!==c.getY(n))rows.push({positions:Array.from(p.array.slice(n*3,n*3+9)),colours:Array.from(c.array.slice(n*3,n*3+9))});
 return rows;
});

test('dry stems are sparse, thin, branched and bounded at twelve triangles per cell',()=>{
 let occupied=0,empty=0,total=0;const counts=new Set(),profiles=new Set();
 for(let y=0;y<24;y++)for(let x=0;x<32;x++){
  const t=tile(x,y),result=weeds(t),mesh=result.group.children[0];
  if(!mesh){empty++;result.dispose();continue;}
  occupied++;assert.equal(result.group.children.length,1);assert.equal(mesh.material.name,'world:grass');assert.equal(mesh.material.roughness,.94);assert.equal(mesh.material.map,null);
  const p=mesh.geometry.getAttribute('position'),c=mesh.geometry.getAttribute('color'),triangles=p.count/3;total+=triangles;counts.add(triangles);assert.ok(triangles===6||triangles===12);
  for(let start=0;start<p.count;start+=18){
   const v=Array.from({length:18},(_,n)=>new Vector3().fromBufferAttribute(p,start+n)),root=v[0].clone().add(v[1]).multiplyScalar(.5),height=v[8].y-t.elevation;
   assert.ok(Math.abs(v[0].y-t.elevation)<1e-6&&Math.abs(v[1].y-t.elevation)<1e-6,'both stem edges meet the exact ground');
   assert.ok(height>=T*.24-1e-6&&height<=T*.42+1e-6);assert.ok(v[0].distanceTo(v[1])>=T*.012-1e-6&&v[0].distanceTo(v[1])<=T*.018+1e-6,'stem thickness remains 15–22 mm');
   assert.deepEqual(v[12].toArray(),v[6].toArray());assert.deepEqual(v[13].toArray(),v[7].toArray());assert.deepEqual(v[15].toArray(),v[7].toArray());assert.deepEqual(v[16].toArray(),v[6].toArray());
   assert.ok(v[14].y>v[12].y&&v[14].y<v[8].y&&v[17].y>v[15].y&&v[17].y<v[8].y,'branches join the middle and stop below the tip');
   for(const point of v){assert.ok(point.y>=t.elevation-1e-6);assert.ok(Math.abs(point.x-t.x*T)<=T*.5+1e-6&&Math.abs(point.z-t.y*T)<=T*.5+1e-6,'complete stem stays inside its own admitted cell');}
   for(let n=0;n<18;n+=3)assert.ok(new Vector3().crossVectors(v[n+1].clone().sub(v[n]),v[n+2].clone().sub(v[n])).length()>1e-6,'each thin face has nonzero area');
   const lean=v[8].clone().sub(root);profiles.add([height,lean.x,lean.z,v[14].distanceTo(v[17])].map(value=>Math.round(value*1e4)).join(','));
  }
  for(let n=0;n<c.count;n++){assert.ok(c.getX(n)>c.getY(n)&&c.getY(n)>c.getZ(n),'dry pigment differs from the retained grey-green tuft');assert.ok(c.getX(n)<=.80+1e-6);}
  result.dispose();
 }
 assert.ok(occupied>40&&occupied<768*.30);assert.ok(empty>occupied*2,'bare cells interrupt the silhouettes');assert.deepEqual([...counts].sort((a,b)=>a-b),[6,12]);assert.ok(profiles.size>50,'height, lean and branch spacing vary beyond rounding');assert.ok(total/768<3);
});

test('dry weeds reproduce native geometry without changing admitted tile records',()=>{
 const t=Object.freeze({...active,elevation:2.125}),before=JSON.stringify(t),a=weeds(t),b=weeds(t),dark=weeds(t,'dry-grass',.27);
 assert.deepEqual(signature(a.group),signature(b.group));assert.equal(JSON.stringify(t),before);
 assert.deepEqual(signature(a.group).map(v=>v.positions),signature(dark.group).map(v=>v.positions));assert.ok(signature(dark.group)[0].colours.every((v,n)=>Math.abs(v-signature(a.group)[0].colours[n]*.27)<1e-6));
 a.dispose();b.dispose();dark.dispose();
});

test('roads, rooms, blocked cells, upper levels and green terrain receive no dry stems',()=>{
 for(const change of [{type:'road'},{type:'stone'},{type:'forest'},{type:'floor'},{type:'water'},{type:'rubble'},{buildingId:'house'},{roomId:'room'},{blocked:true},{tacticalLevel:1}]){const result=weeds({...active,...change});assert.equal(result.group.children.length,0);result.dispose();}
 for(const kind of ['green-grass','dirt','mud','floor','cobble']){const result=weeds(active,kind);assert.equal(result.group.children.length,0);result.dispose();}
 const result=weeds({...active,type:'scrub'});assert.ok(result.group.children.length);result.dispose();
});

test('native terrain shares its grass batch and removes weeds through existing cache/disposal rules',()=>{
 const input={terrain:{width:32,height:24,tiles:[active,tile(24,22,{type:'floor'})]}},scene=new Scene(),world=createSectorWorld(scene,options);world.update(input);const root=scene.getObjectByName('sector-world'),id=`terrain:${Math.floor(active.x/8)},${Math.floor(active.y/8)}`,first=root.getObjectByName(id),remote=root.getObjectByName('terrain:3,2'),grass=first.children.find(mesh=>mesh.material.name==='world:grass');
 assert.equal(first.children.filter(mesh=>mesh.material.name==='world:grass').length,1,'weeds and retained tufts merge into the same material batch');assert.ok(dryTriangles(first).length);
 let releases=0;grass.geometry.addEventListener('dispose',()=>releases++);world.update({...input,timeSeconds:3,reducedMotion:true});assert.equal(root.getObjectByName(id).uuid,first.uuid,'presentation time does not rebuild static weeds');
 world.update({terrain:{...input.terrain,tiles:[{...active,roomId:'hidden-room'},input.terrain.tiles[1]]}});assert.equal(releases,1);assert.equal(dryTriangles(root.getObjectByName(id)).length,0);assert.equal(root.getObjectByName('terrain:3,2').uuid,remote.uuid);
 world.update({terrain:{...input.terrain,tiles:[input.terrain.tiles[1]]}});assert.equal(root.getObjectByName(id),undefined,'no geometry is created for a removed or unadmitted cell');world.dispose();
 const geometry=new WorldGeometry(),materials=new WorldMaterials(options),part=buildTerrainChunk('single',[active],input,T,geometry,materials),single=weeds(active);assert.deepEqual(dryTriangles(part),dryTriangles(single.group));disposeWorldNode(part);materials.dispose();geometry.dispose();single.dispose();
});

test('dry stems keep identical geometry when admitted cells are split at a chunk border',()=>{
 const tiles=[...Array.from({length:12},(_,x)=>tile(x-5,-3)),...Array.from({length:12},(_,x)=>tile(x-5,-2,{type:'scrub'}))],input={terrain:{width:12,height:2,tiles}},geometry=new WorldGeometry(),materials=new WorldMaterials(options);
 const whole=buildTerrainChunk('whole',tiles,input,T,geometry,materials),left=buildTerrainChunk('left',tiles.filter(t=>t.x<0),input,T,geometry,materials),right=buildTerrainChunk('right',tiles.filter(t=>t.x>=0),input,T,geometry,materials),canonical=group=>dryTriangles(group).map(row=>JSON.stringify(row)).sort();
 assert.ok(canonical(whole).length);assert.deepEqual([...canonical(left),...canonical(right)].sort(),canonical(whole));for(const group of [whole,left,right])disposeWorldNode(group);materials.dispose();geometry.dispose();
});
