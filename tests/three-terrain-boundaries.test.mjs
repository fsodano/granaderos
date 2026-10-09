import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Scene,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildTerrainChunk}=await import('../web/lib/three/world-terrain.ts');
const {createSectorWorld}=await import('../web/lib/three/sector-world.ts');
const T=1.2360585147470482;
const tile=(x,y,type='road',extra={})=>({x,y,type,elevation:1.25,...extra});
const inputFor=tiles=>({terrain:{width:32,height:16,tiles,sceneId:'settlement'},revealedRooms:[]});
const options={tileMetres:T,assetUrl:path=>path};
function build(tiles,all=tiles){
 const geometry=new WorldGeometry(),materials=new WorldMaterials(options),group=buildTerrainChunk('test',tiles,inputFor(all),T,geometry,materials);
 return {group,dispose(){disposeWorldNode(group);materials.dispose();geometry.dispose();}};
}
function tops(group,height=1.25){
 return group.children.filter(mesh=>mesh.material.name.startsWith('world:terrain-')).flatMap(mesh=>{
  const p=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv'),faces=[];
  for(let n=0;n<p.count;n+=3){const points=[0,1,2].map(c=>new Vector3().fromBufferAttribute(p,n+c));if(points.every(v=>Math.abs(v.y-height)<1e-6))faces.push({points,material:mesh.material.name,uv:[0,1,2].map(c=>[uv.getX(n+c),uv.getY(n+c)])});}
  return faces;
 });
}
const area=faces=>faces.reduce((sum,{points:[a,b,c]})=>sum+new Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a)).length()/2,0);
function coverage(faces,x,z){
 return faces.filter(({points:[a,b,c]})=>{
  const denominator=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z),u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/denominator,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/denominator;
  return u>1e-8&&v>1e-8&&1-u-v>1e-8;
 });
}
const signature=group=>group.children.map(mesh=>({material:mesh.material.name,positions:Array.from(mesh.geometry.getAttribute('position').array),uv:Array.from(mesh.geometry.getAttribute('uv').array),colours:Array.from(mesh.geometry.getAttribute('color').array)}));

test('equal-height dirt/grass top is a disjoint flat partition with continuous metric UVs',()=>{
 for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){
  const soil=tile(7,3),grass=tile(7+dx,3+dy,'grass'),result=build([soil],[soil,grass]),faces=tops(result.group);
  assert.equal(faces.length,10,'one changed soil cell adds eight top triangles');
  assert.ok(Math.abs(area(faces)-T*T)<1e-5,'materials retain exactly one cell area');
  assert.equal(faces.filter(f=>f.material==='world:terrain-dry-grass').length,2);
  for(const {points,uv}of faces)for(let c=0;c<3;c++){
   assert.ok(Math.abs(uv[c][0]-points[c].x)<1e-6);assert.ok(Math.abs(uv[c][1]-(points[c].z+soil.elevation))<1e-6);
   assert.ok(points[c].x>=(soil.x-.5)*T-1e-6&&points[c].x<=(soil.x+.5)*T+1e-6);
   assert.ok(points[c].z>=(soil.y-.5)*T-1e-6&&points[c].z<=(soil.y+.5)*T+1e-6);
  }
  for(const {points:[a,b,c]}of faces)assert.ok(new Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a)).y>0,'both materials face upwards');
  for(let x=0;x<13;x++)for(let z=0;z<13;z++)assert.equal(coverage(faces,(soil.x-.5+(x+.379)/13)*T,(soil.y-.5+(z+.617)/13)*T).length,1,'no uncovered or overlapping interiors');
  result.dispose();
 }
});

test('four irregular edges stay within a measured per-cell geometry/material budget',()=>{
 const soil=tile(3,3),neighbours=[tile(2,3,'grass'),tile(4,3,'forest'),tile(3,2,'scrub'),tile(3,4,'grass')],result=build([soil],[soil,...neighbours]),faces=tops(result.group);
 assert.equal(faces.length,28,'four edges add at most26 triangles to the old two-triangle top');
 assert.ok(Math.abs(area(faces)-T*T)<1e-5);
 assert.equal(result.group.children.filter(mesh=>mesh.material.name.startsWith('world:terrain-')).length,3,'at most one existing batch per dirt/dry-grass/green-grass material');
 result.dispose();
});

test('edge width/depth/position vary by presentation coordinates and retain exact repeatability',()=>{
 const profiles=[],widths=[],depths=[],centres=[],rounded=value=>Math.round(value*1e4);
 for(const x of [1,3,6,8,11]){
  const soil=tile(x,3),grass=tile(x+1,3,'grass'),input=inputFor([soil,grass]),before=JSON.stringify(input);
  for(const t of input.terrain.tiles)Object.freeze(t);Object.freeze(input.terrain.tiles);
  const a=build([soil],input.terrain.tiles),b=build([soil],input.terrain.tiles);
  assert.deepEqual(signature(a.group),signature(b.group));assert.equal(JSON.stringify(input),before);
  const points=tops(a.group).filter(f=>f.material.endsWith('dry-grass')).flatMap(f=>f.points).map(p=>[p.x-x*T,p.z-3*T]);
  const xValues=points.map(p=>p[0]),zValues=points.map(p=>p[1]);
  profiles.push(JSON.stringify(points.map(p=>p.map(rounded))));widths.push(rounded(Math.max(...zValues)-Math.min(...zValues)));depths.push(rounded(T*.5-Math.min(...xValues)));centres.push(rounded((Math.max(...zValues)+Math.min(...zValues))/2));a.dispose();b.dispose();
 }
 assert.equal(new Set(profiles).size,profiles.length,'an identical sawtooth is not repeated across cells');
 for(const values of [widths,depths,centres])assert.ok(new Set(values).size>=4,'each broad profile dimension varies beyond float rounding');
});

test('an otherwise soil-only eight-cell chunk edge adds64 triangles and one retained grass batch',()=>{
 const soil=Array.from({length:64},(_,n)=>tile(n%8,Math.floor(n/8))),grass=Array.from({length:8},(_,y)=>tile(8,y,'grass'));
 const plain=build(soil,[...soil,...grass.map(t=>({...t,buildingId:'excluded'}))]),changed=build(soil,[...soil,...grass]),triangles=group=>group.children.reduce((sum,mesh)=>sum+mesh.geometry.getAttribute('position').count/3,0);
 assert.equal(triangles(changed.group)-triangles(plain.group),64);
 assert.equal(changed.group.children.length-plain.group.children.length,1);
 assert.equal(changed.group.children.find(mesh=>mesh.material.name==='world:terrain-dry-grass').geometry.getAttribute('position').count/3,16,'all eight tongues merge into one existing grass-material batch');
 plain.dispose();changed.dispose();
});

test('missing, raised, blocked, indoor and upper neighbours retain the original two-triangle top',()=>{
 const soil=tile(7,3),cases=[null,tile(8,3,'grass',{elevation:1.25000001}),tile(8,3,'grass',{blocked:true}),tile(8,3,'grass',{buildingId:'hidden-house'}),tile(8,3,'grass',{roomId:'hidden-room'}),tile(8,3,'grass',{tacticalLevel:1}),tile(8,3,'floor'),tile(8,3,'water')];
 for(const neighbour of cases){const result=build([soil],[soil,...(neighbour?[neighbour]:[])]);assert.equal(tops(result.group).length,2);result.dispose();}
 for(const extra of [{buildingId:'house'},{roomId:'unrevealed'},{blocked:true},{tacticalLevel:1}]){const indoor={...soil,...extra},result=build([indoor],[indoor,tile(8,3,'grass')]);assert.equal(tops(result.group).length,2);result.dispose();}
 const paved=tile(7,3,'stone',{material:'cobble'}),result=build([paved],[paved,tile(8,3,'grass')]);assert.equal(tops(result.group).length,2);result.dispose();
});

test('admitted neighbour across a chunk seam gives the same top as a combined build',()=>{
 const left=tile(7,3),right=tile(8,3,'grass'),a=build([left],[left,right]),b=build([right],[left,right]),combined=build([left,right]),split=[...tops(a.group),...tops(b.group)];
 assert.ok(Math.abs(area(split)-2*T*T)<1e-5);assert.ok(Math.abs(area(tops(combined.group))-area(split))<1e-6);
 for(let n=0;n<15;n++)for(const side of [-1,1])assert.equal(coverage(split,7.5*T+side*.003*T,(2.5+(n+.371)/15)*T).length,1,'both sides of the shared edge stay covered');
 const canonical=faces=>faces.map(f=>JSON.stringify([f.material,f.points.map(p=>p.toArray())])).sort();assert.deepEqual(canonical(split),canonical(tops(combined.group)));
 a.dispose();b.dispose();combined.dispose();
});

test('neighbour type/material/outdoor/height changes invalidate the affected chunk only',()=>{
 const left=tile(7,3),right=tile(8,3,'grass'),remote=tile(24,3),scene=new Scene(),world=createSectorWorld(scene,options),original=inputFor([left,right,remote]);world.update(original);const root=scene.getObjectByName('sector-world');
 for(const change of [{type:'forest'},{material:'wood'},{buildingId:'hidden-house'},{roomId:'hidden-room'},{blocked:true},{elevation:1.5}]){
  world.update(original);const before=root.getObjectByName('terrain:0,0'),unrelated=root.getObjectByName('terrain:3,0');let disposed=0;for(const mesh of before.children)mesh.geometry.addEventListener('dispose',()=>disposed++);
  const input=inputFor([left,{...right,...change},remote]);world.update(input);assert.notEqual(root.getObjectByName('terrain:0,0').uuid,before.uuid);assert.equal(disposed,before.children.length,'obsolete geometry is disposed');assert.equal(root.getObjectByName('terrain:3,0').uuid,unrelated.uuid);
  const rebuilt=root.getObjectByName('terrain:0,0');world.update(input);assert.equal(root.getObjectByName('terrain:0,0').uuid,rebuilt.uuid,'repeat update retains rebuilt geometry');
 }
 world.dispose();
});
