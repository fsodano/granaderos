import {register} from 'node:module';
register('../tests/tactical-render-loader.mjs',import.meta.url);
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {ARCHITECTURE_REVIEW_TEMPLATES,createArchitectureReviewBattle} from '../web/app/renderer-sandbox/architecture-fixtures.js';
import {buildingStyle} from '../game/building-types.js';
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {Opening,WALL_COLOURS}=await import('../web/app/TacticalArchitectureMaterials.tsx');
const {createElement}=await import('../web/node_modules/react/index.js');
const {renderToStaticMarkup}=await import('../web/node_modules/react-dom/server.node.js');
const beforePath=process.argv.find(a=>a.startsWith('--before-buildings='))?.slice(19);
assert.ok(beforePath,'Pass --before-buildings=<exact predecessor world-buildings.ts>');
const output=resolve(process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'artifacts/window-frame-paint.json');
const scratch=await mkdtemp(join(tmpdir(),'granaderos-window-frame-before-'));
const source=await readFile(resolve(beforePath),'utf8'),base=new URL('../web/lib/three/world-buildings.ts',import.meta.url);
const resolved=source.replace(/(from\s+|import\s*)'([^']+)'/g,(_,prefix,path)=>prefix+JSON.stringify(path==='three'?new URL('../web/node_modules/three/build/three.module.js',import.meta.url).href:path.startsWith('.')?new URL(path+(/\.[^./]+$/.test(path)?'':'.ts'),base).href:path));
await writeFile(join(scratch,'before.ts'),resolved);
const beforeBuild=(await import(pathToFileURL(join(scratch,'before.ts')).href)).buildBuilding;
const sha=b=>createHash('sha256').update(b).digest('hex'),T=1.2360585147470482;
function bytes(a){return Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength);}
function attributes(g){return Object.fromEntries(Object.entries(g.attributes).map(([name,a])=>[name,{itemSize:a.itemSize,normalized:a.normalized,type:a.array.constructor.name,sha256:sha(bytes(a))}]));}
function paint(m,omitColour=false){const data=m.toJSON();delete data.uuid;delete data.metadata;delete data.name;if(omitColour)delete data.color;return {...data,shader:m.customProgramCacheKey()};}
function exact(mesh){return {attributes:attributes(mesh.geometry),index:mesh.geometry.index?sha(bytes(mesh.geometry.index)):null,transform:mesh.matrixWorld.toArray(),material:paint(mesh.material),castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow};}
function triangleBag(mesh,bag=new Map()){
 const g=mesh.geometry;assert.equal(g.index,null,'Existing frame primitives are nonindexed');
 const entries=Object.entries(g.attributes).sort(([a],[b])=>a.localeCompare(b));
 for(let n=0;n<g.getAttribute('position').count;n+=3){
  const key=entries.map(([name,a])=>{const stride=a.itemSize*a.array.BYTES_PER_ELEMENT;return name+':'+a.itemSize+':'+a.normalized+':'+a.array.constructor.name+':'+bytes(a).subarray(n*stride,(n+3)*stride).toString('base64');}).join('|');
  bag.set(key,(bag.get(key)??0)+1);
 }
 return bag;
}
function meshes(node){const result=new Map(),counts=new Map();node.traverse(n=>{if(n.isMesh){const stem=n.name+'|'+sha(JSON.stringify(paint(n.material))),ordinal=counts.get(stem)??0;counts.set(stem,ordinal+1);result.set(stem+'#'+ordinal,n);}});return result;}
function build(battle,fn){
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:p=>p}),input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},raw=JSON.stringify(input),node=fn(battle.buildings[0],input,T,geometry,materials);node.updateMatrixWorld(true);assert.equal(JSON.stringify(input),raw);
 return{node,dispose(){disposeWorldNode(node);geometry.dispose();materials.dispose();}};
}
try{
 const cases=[],combined=createHash('sha256');let exactMeshes=0,frameTriangles=0;
 // This is the actual React Opening pigment, not a second expected palette.
 for(const [finish,palette]of Object.entries(WALL_COLOURS))for(const style of ['barred','small','arched','lattice','shutters'])assert.match(renderToStaticMarkup(createElement(Opening,{type:'window',style,trim:palette.trim})),new RegExp('stroke="'+palette.trim+'"'));
 const arrangements=[];
 for(const {id}of ARCHITECTURE_REVIEW_TEMPLATES)for(const rotation of [0,90,180,270])for(const view of ['exterior','partial','interior'])for(const roof of ['original','slab','roof-route'])arrangements.push({id,rotation,view,roof,battle:createArchitectureReviewBattle(id,rotation,view,roof)});
 for(const finish of Object.keys(WALL_COLOURS))for(const style of ['barred','small','arched','lattice','shutters'])for(const rotation of [0,90,180,270]){const battle=createArchitectureReviewBattle('casa',rotation,'exterior');battle.buildings[0].wallFinish=finish;for(const tile of battle.tiles)if(tile.type==='window')tile.style=style;arrangements.push({id:'paint-'+finish+'-'+style,rotation,view:'exterior',roof:'original',battle});}
 for(const mode of ['unpainted-legacy','painted-legacy','breached','low-slab']){const battle=createArchitectureReviewBattle('capilla',0,'exterior',mode==='low-slab'?'slab':'original');if(mode.includes('legacy')){battle.buildings[0].architecture='chapel';battle.buildings[0].kind=undefined;battle.buildings[0].wallFinish=mode==='painted-legacy'?'ochre':undefined;}if(mode==='breached')for(const tile of battle.tiles)if(tile.type==='window')tile.type='rubble';if(mode==='low-slab')battle.upperSurfaces=battle.upperSurfaces.map(s=>({...s,elevation:1.8}));arrangements.push({id:mode,rotation:0,view:'exterior',roof:'original',battle});}
 for(const row of arrangements){
  const {battle}=row,old=build(battle,beforeBuild),current=build(battle,buildBuilding),a=meshes(old.node),b=meshes(current.node),frames=[...b.values()].filter(n=>n.material.name.startsWith('world:window-trim-')),trimName='building-fabric:'+battle.buildings[0].id+':world:trim',building=battle.buildings[0],legacy=Boolean(building.architecture&&(!building.kind||building.roof==='terrace')),oldColour=legacy?buildingStyle(building).trim:'#e0d2ad',trimKey=[...a].find(([key,n])=>n.name===trimName&&n.material.color.getHexString()===oldColour.slice(1))?.[0],beforeTrim=a.get(trimKey),afterTrim=b.get(trimKey);
  assert.ok(beforeTrim&&afterTrim);assert.deepEqual(current.node.userData,old.node.userData,'Opening dimensions and disclosure stay exact');
  for(const [name,mesh]of a)if(name!==trimKey){assert.ok(b.has(name),name);assert.deepEqual(exact(b.get(name)),exact(mesh),row.id+': every other mesh stays exact');combined.update(JSON.stringify(exact(mesh)));b.delete(name);exactMeshes++;}
  assert.deepEqual(paint(afterTrim.material),paint(beforeTrim.material));assert.deepEqual(afterTrim.matrixWorld.toArray(),beforeTrim.matrixWorld.toArray());assert.equal(afterTrim.castShadow,beforeTrim.castShadow);assert.equal(afterTrim.receiveShadow,beforeTrim.receiveShadow);
  const bag=triangleBag(afterTrim);let triangles=0;
  for(const mesh of frames){
   const finish=mesh.material.name.slice('world:window-trim-'.length);assert.ok(WALL_COLOURS[finish]);assert.equal(mesh.material.color.getHexString(),WALL_COLOURS[finish].trim.slice(1));assert.deepEqual(paint(mesh.material,true),paint(beforeTrim.material,true),'Only frame name and pigment change');assert.deepEqual(mesh.matrixWorld.toArray(),beforeTrim.matrixWorld.toArray());assert.equal(mesh.castShadow,beforeTrim.castShadow);assert.equal(mesh.receiveShadow,beforeTrim.receiveShadow);triangleBag(mesh,bag);triangles+=mesh.geometry.getAttribute('position').count/3;for(const [key,n]of b)if(n===mesh)b.delete(key);
  }
  assert.deepEqual(bag,triangleBag(beforeTrim),'Every old trim triangle retains all exact attributes, in its old material or the new source window pigment');b.delete(trimKey);assert.equal(b.size,0,'No other mesh is introduced');
  if(row.id==='unpainted-legacy'||row.id==='breached')assert.equal(frames.length,0);
  frameTriangles+=triangles;cases.push({...row,battle:undefined,exactMeshes:a.size-1,frameTriangles:triangles});old.dispose();current.dispose();
 }
 assert.equal(cases.length,608);assert.ok(frameTriangles>0);
 const report={beforeSourceSha256:sha(source),currentSourceSha256:sha(await readFile(base)),cases,exactNonFrameMeshes:exactMeshes,frameTriangles,combinedSha256:combined.digest('hex'),scope:'Actual React source paint; 504 catalogue states plus 100 paint/style/rotation cases and four edit/legacy cases. All prior trim triangles keep exact attributes/transforms/shadows. Only retained authored window frame pigment changes; all other meshes/materials/openings/disclosure remain exact.'};await mkdir(resolve(output,'..'),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({cases:cases.length,exactNonFrameMeshes:exactMeshes,frameTriangles,combinedSha256:report.combinedSha256}));
}finally{await rm(scratch,{recursive:true,force:true});}
