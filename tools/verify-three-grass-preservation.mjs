import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {register} from 'node:module';
register('../tests/tactical-render-loader.mjs',import.meta.url);
const base=new URL('../',import.meta.url),url=p=>new URL(p,base).href,sha=b=>createHash('sha256').update(b).digest('hex');
const {WorldGeometry,disposeWorldNode}=await import(url('web/lib/three/world-geometry.ts'));
const {WorldMaterials}=await import(url('web/lib/three/world-materials.ts'));
const {buildTerrainChunk}=await import(url('web/lib/three/world-terrain.ts'));
const {TILE_METRES:T}=await import(url('web/lib/three/projection.ts'));
const {DoubleSide}=await import(url('web/node_modules/three/build/three.module.js'));
const oldGeometry=readFileSync(new URL('docs/art/reviews/ground-grass/before-world-geometry.ts.txt',base),'utf8'),oldTerrain=readFileSync(new URL('docs/art/reviews/ground-grass/before-world-terrain.ts.txt',base),'utf8');
assert.equal(sha(oldGeometry),'01576ea58465d4a0e2d602336fb759afd01938f3ef537f95e650c968e012de0f');assert.equal(sha(oldTerrain),'d8cfbb1189ae0f5ab9de2fcec8580e306bb6411a74d50a04aa1c463f0ae45bbc');
const scratch=mkdtempSync(join(tmpdir(),'granaderos-grass-before-'));const geometryPath=join(scratch,'geometry.ts'),terrainPath=join(scratch,'terrain.ts');
writeFileSync(geometryPath,oldGeometry.replaceAll("'three'",JSON.stringify(url('web/node_modules/three/build/three.module.js'))).replaceAll("'three/addons/utils/BufferGeometryUtils.js'",JSON.stringify(url('web/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js'))));
writeFileSync(terrainPath,oldTerrain.replaceAll("'three'",JSON.stringify(url('web/node_modules/three/build/three.module.js'))).replaceAll("'../../../game/regional-terrain.js'",JSON.stringify(url('game/regional-terrain.js'))).replaceAll("'./world-geometry'",JSON.stringify(pathToFileURL(geometryPath).href)).replaceAll("'./world-materials'",JSON.stringify(url('web/lib/three/world-materials.ts'))).replaceAll("'./world-climb-openings'",JSON.stringify(url('web/lib/three/world-climb-openings.ts'))));
const {WorldGeometry:OldGeometry}=await import(pathToFileURL(geometryPath).href),{buildTerrainChunk:oldBuild}=await import(pathToFileURL(terrainPath).href);
const signature=mesh=>({name:mesh.name,material:mesh.material.name,opacity:mesh.material.opacity,castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow,attributes:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([k,a])=>[k,sha(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength))]))});
function rootAndHeight(p,start,count){let bottom=Infinity,top=-Infinity;for(let n=start;n<start+count;n++){bottom=Math.min(bottom,p.getY(n));top=Math.max(top,p.getY(n));}let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;for(let n=start;n<start+count;n++)if(Math.abs(p.getY(n)-bottom)<1e-6){x0=Math.min(x0,p.getX(n));x1=Math.max(x1,p.getX(n));z0=Math.min(z0,p.getZ(n));z1=Math.max(z1,p.getZ(n));}return {root:[(x0+x1)/2,bottom,(z0+z1)/2],height:top-bottom};}
const rows=[];let unchangedMeshes=0,tufts=0;
try{for(const x of [-8,-1,0,7,23])for(const y of [-3,0,11])for(const elevation of [0,.4,1.7])for(const type of ['grass','scrub','forest','dirt','rubble','water'])for(const night of [false,true]){
 const tile={x,y,type,elevation},neighbour={x:x+1,y,type:'dirt',elevation:elevation-.2},input={terrain:{width:32,height:24,tiles:[tile,neighbour],night},illumination:{['0:'+x+','+y]:.4}},saved=JSON.stringify(input),materials=new WorldMaterials({tileMetres:T,assetUrl:p=>p}),geometry=new WorldGeometry(),old=new OldGeometry(),a=buildTerrainChunk('proof',input.terrain.tiles,input,T,geometry,materials),b=oldBuild('proof',input.terrain.tiles,input,T,old,materials);
 assert.equal(JSON.stringify(input),saved);assert.equal(a.children.length,b.children.length,'Draw batches remain exact');
 const oldOther=b.children.filter(m=>m.material.name!=='world:grass').map(signature),newOther=a.children.filter(m=>m.material.name!=='world:grass').map(signature);assert.deepEqual(newOther,oldOther,'Ground, skirts, rocks/rubble and materials remain byte exact');unchangedMeshes+=oldOther.length;
 const grass=a.children.find(m=>m.material.name==='world:grass'),before=b.children.find(m=>m.material.name==='world:grass');assert.equal(Boolean(grass),Boolean(before));
 if(grass){assert.equal(grass.material,before.material);assert.equal(grass.material.side,DoubleSide,'Existing material renders both leaf faces');assert.equal(grass.castShadow,before.castShadow);assert.equal(grass.receiveShadow,before.receiveShadow);const p=grass.geometry.getAttribute('position'),q=before.geometry.getAttribute('position'),newCount=geometry.get('grass-tuft').getAttribute('position').count,oldCount=old.get('cone').toNonIndexed().getAttribute('position').count;assert.equal(newCount/3,9);assert.equal(oldCount/3,20);assert.equal(p.count/newCount,q.count/oldCount);assert.ok(p.count<q.count,'Triangle budget decreases');
  for(let n=0;n<p.count/newCount;n++){const now=rootAndHeight(p,n*newCount,newCount),was=rootAndHeight(q,n*oldCount,oldCount);assert.ok(now.root.every((v,i)=>Math.abs(v-was.root[i])<1e-5),'Actual rooted centres remain exact within Float32 precision');assert.ok(Math.abs(now.root[1]-elevation)<1e-6,'Real ground support');assert.ok(now.height>=.19999&&now.height<=.30001);tufts++;}
  for(const name of ['position','normal','color','uv'])for(const v of grass.geometry.getAttribute(name).array)assert.ok(Number.isFinite(v));
 }
 rows.push({x,y,elevation,type,night,batches:a.children.length,oldTriangles:b.children.reduce((n,m)=>n+m.geometry.getAttribute('position').count/3,0),currentTriangles:a.children.reduce((n,m)=>n+m.geometry.getAttribute('position').count/3,0)});disposeWorldNode(a);disposeWorldNode(b);geometry.dispose();old.dispose();materials.dispose();
}
const out=resolve(process.argv.find(a=>a.startsWith('--output='))?.slice(9)||'artifacts/three-grass-preservation.json');mkdirSync(resolve(out,'..'),{recursive:true});writeFileSync(out,JSON.stringify({sourcePins:{beforeGeometry:sha(oldGeometry),beforeTerrain:sha(oldTerrain),currentGeometry:sha(readFileSync(new URL('web/lib/three/world-geometry.ts',base))),currentTerrain:sha(readFileSync(new URL('web/lib/three/world-terrain.ts',base)))},cases:rows.length,unchangedNonGrassMeshes:unchangedMeshes,rootedTufts:tufts,trianglesPerTuft:{before:20,current:9},rows,scope:'Actual merged terrain geometry. Rooted centres/elevations, all non-grass attributes, existing materials/batches/shadows and admitted state retained; grass leaf shape and 20–30cm height intentionally change. No scene-FPS or full terrain-art acceptance.'},null,2)+'\n');console.log(JSON.stringify({cases:rows.length,unchangedMeshes,tufts,trianglesPerTuft:{before:20,current:9}}));}finally{rmSync(scratch,{recursive:true,force:true})}
