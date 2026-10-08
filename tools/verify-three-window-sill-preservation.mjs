import {register} from 'node:module';register('../tests/tactical-render-loader.mjs',import.meta.url);
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {ARCHITECTURE_REVIEW_TEMPLATES,createArchitectureReviewBattle} from '../web/app/renderer-sandbox/architecture-fixtures.js';
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const oldPath=process.argv.find(a=>a.startsWith('--before-buildings='))?.slice(19);
assert.ok(oldPath,'Pass --before-buildings=<exact predecessor world-buildings.ts>');
const output=resolve(process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'artifacts/window-sill-preservation.json');
const scratch=await mkdtemp(join(tmpdir(),'granaderos-window-sill-before-'));
const oldSource=await readFile(resolve(oldPath),'utf8'),base=new URL('../web/lib/three/world-buildings.ts',import.meta.url);
const resolved=oldSource.replace(/(from\s+|import\s*)'([^']+)'/g,(_,prefix,path)=>prefix+JSON.stringify(path==='three'?new URL('../web/node_modules/three/build/three.module.js',import.meta.url).href:path.startsWith('.')?new URL(path+(/\.[^./]+$/.test(path)?'':'.ts'),base).href:path));
await writeFile(join(scratch,'before.ts'),resolved);
const beforeBuild=(await import(pathToFileURL(join(scratch,'before.ts')).href)).buildBuilding;
const sha=b=>createHash('sha256').update(b).digest('hex'),T=1.2360585147470482;
function signature(node){
  const result={};node.traverse(mesh=>{
    if(!mesh.isMesh||mesh.name.startsWith('window-sills:'))return;
    const geometry=mesh.geometry,attributes={};for(const [name,a]of Object.entries(geometry.attributes))attributes[name]={itemSize:a.itemSize,normalized:a.normalized,type:a.array.constructor.name,sha256:sha(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength))};
    const m=mesh.material;result[mesh.name]={attributes,index:geometry.index?sha(Buffer.from(geometry.index.array.buffer,geometry.index.array.byteOffset,geometry.index.array.byteLength)):null,transform:mesh.matrixWorld.toArray(),material:{name:m.name,colour:m.color.toArray(),opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,side:m.side,roughness:m.roughness,metalness:m.metalness,bumpScale:m.bumpScale,polygonOffset:m.polygonOffset,polygonOffsetFactor:m.polygonOffsetFactor,polygonOffsetUnits:m.polygonOffsetUnits,shaderKey:m.customProgramCacheKey()},castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow};
  });return result;
}
function build(battle,fn){
  const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:p=>p}),input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},raw=JSON.stringify(input),node=fn(battle.buildings[0],input,T,geometry,materials);node.updateMatrixWorld(true);assert.equal(JSON.stringify(input),raw);
  return {node,dispose(){disposeWorldNode(node);geometry.dispose();materials.dispose();}};
}
try{
  const cases=[];let meshes=0,sillTriangles=0;const combined=createHash('sha256');
  for(const {id}of ARCHITECTURE_REVIEW_TEMPLATES)for(const rotation of [0,90,180,270])for(const view of ['exterior','partial','interior'])for(const roof of ['original','slab','roof-route']){
    const battle=createArchitectureReviewBattle(id,rotation,view,roof),old=build(battle,beforeBuild),current=build(battle,buildBuilding),a=signature(old.node),b=signature(current.node);assert.deepEqual(b,a,`${id}/${rotation}/${view}/${roof}: every non-sill mesh remains exact`);assert.deepEqual(current.node.userData,old.node.userData,'Saved opening dimensions and room disclosure stay exact');
    let triangles=0;current.node.getObjectByName(`window-sills:${battle.buildings[0].id}`).traverse(n=>{if(n.isMesh)triangles+=(n.geometry.index?.count??n.geometry.getAttribute('position').count)/3;});assert.equal(old.node.getObjectByName(`window-sills:${battle.buildings[0].id}`),undefined,'The exact predecessor lacks this source detail');
    meshes+=Object.keys(a).length;sillTriangles+=triangles;combined.update(JSON.stringify(a));cases.push({id,rotation,view,roof,exactMeshes:Object.keys(a).length,sillTriangles:triangles});old.dispose();current.dispose();
  }
  assert.equal(cases.length,504);assert.ok(sillTriangles>0);await mkdir(resolve(output,'..'),{recursive:true});const report={beforeSourceSha256:sha(oldSource),currentBuildSourceSha256:sha(await readFile(base)),cases,exactNonSillMeshes:meshes,combinedSha256:combined.digest('hex'),sillTrianglesAcrossCases:sillTriangles,scope:'All fourteen templates, four rotations, three disclosure states and three roof states. Complete attributes, indices, transforms, material properties, shadow flags, opening records and disclosure remain exact. Only the new sill group is excluded.'};await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({cases:cases.length,exactNonSillMeshes:meshes,combinedSha256:report.combinedSha256,sillTrianglesAcrossCases:sillTriangles}));
}finally{await rm(scratch,{recursive:true,force:true});}
