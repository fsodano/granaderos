// Compare the complete rendered building, admitting only the two source bands.
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
register('../tests/tactical-render-loader.mjs',import.meta.url);
assert.ok(process.argv[2],'Pass the unchanged predecessor checkout as the first argument');
const beforeRoot=resolve(process.argv[2]),currentRoot=resolve(process.argv[3]??'.');
const moduleAt=async(root,file)=>import(pathToFileURL(resolve(root,file)).href);
const before=await moduleAt(beforeRoot,'web/lib/three/world-buildings.ts'),current=await moduleAt(currentRoot,'web/lib/three/world-buildings.ts');
const {WorldGeometry,disposeWorldNode}=await moduleAt(currentRoot,'web/lib/three/world-geometry.ts'),{WorldMaterials}=await moduleAt(currentRoot,'web/lib/three/world-materials.ts');
const {ARCHITECTURE_REVIEW_TEMPLATES,createArchitectureReviewBattle}=await moduleAt(currentRoot,'web/app/renderer-sandbox/architecture-fixtures.js');
const T=1.2360585147470482,hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function shape(building,old){
 const nodes=[],meshes=[],bands=[];building.updateMatrixWorld(true);
 building.traverse(node=>{
  const names=[];for(let p=node;p;p=p.parent)names.unshift(p.name);const name=names.join('/');
  if(node.isMesh&&node.material.name==='world:door-cross-band'){bands.push(name);return;}
  nodes.push({name,position:node.position.toArray(),quaternion:node.quaternion.toArray(),scale:node.scale.toArray(),userData:node.userData});if(!node.isMesh)return;
  const attributes=node.geometry.attributes,rows=[],p=attributes.position,leaf=node.parent,wood=leaf.name.startsWith('door-leaf:')?leaf.children.find(c=>c.material?.name==='world:wood'):undefined;
  let width=0,height=0,sign=1;if(wood){const a=wood.geometry.attributes.position;let lo=Infinity,hi=-Infinity,yl=Infinity,yh=-Infinity;for(let n=0;n<a.count;n++){lo=Math.min(lo,a.getX(n));hi=Math.max(hi,a.getX(n));yl=Math.min(yl,a.getY(n));yh=Math.max(yh,a.getY(n));}width=hi-lo;height=(yh-yl)/.98;sign=hi>width*.5?1:-1;}
  for(let n=0;n<p.count;n+=3){
   const band=old&&wood&&height>=.75&&leaf.userData.style!=='panelled'&&node.material.name==='world:iron'&&[.21,.73].some(y=>[0,1,2].every(k=>p.getX(n+k)*sign>=width*.09-1e-6&&p.getX(n+k)*sign<=width*.91+1e-6&&p.getY(n+k)>=height*y-.016-1e-6&&p.getY(n+k)<=height*y+.016+1e-6&&Math.abs(p.getZ(n+k))>=.038-1e-6&&Math.abs(p.getZ(n+k))<=.054+1e-6));
   if(band)continue;const row={};for(const key of Object.keys(attributes).sort()){const a=attributes[key];row[key]=Array.from(a.array.slice(n*a.itemSize,(n+3)*a.itemSize));}rows.push(JSON.stringify(row));
  }
  rows.sort();meshes.push({name,material:{name:node.material.name,color:node.material.color.toArray(),opacity:node.material.opacity,roughness:node.material.roughness,metalness:node.material.metalness},triangles:hash(rows),count:rows.length});
 });return {nodes:nodes.sort((a,b)=>a.name.localeCompare(b.name)),meshes:meshes.sort((a,b)=>a.name.localeCompare(b.name)),bands};
}
function render(builder,battle){const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:p=>p}),input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},saved=JSON.stringify(battle),building=builder.buildBuilding(battle.buildings[0],input,T,geometry,materials);assert.equal(JSON.stringify(battle),saved);return {building,dispose(){disposeWorldNode(building);materials.dispose();geometry.dispose();}};}
let states=0,meshes=0,bands=0;
for(const {id}of ARCHITECTURE_REVIEW_TEMPLATES)for(const rotation of [0,90,180,270])for(const roof of ['original','slab','roof-route'])for(const view of ['exterior','partial','interior']){
 const battle=createArchitectureReviewBattle(id,rotation,view,roof),a=render(before,battle),b=render(current,battle),first=shape(a.building,true),next=shape(b.building,false);assert.deepEqual(next.nodes,first.nodes,`${id}/${rotation}/${roof}/${view}: unrelated node transform/metadata changed`);assert.deepEqual(next.meshes,first.meshes,`${id}/${rotation}/${roof}/${view}: non-band geometry/material changed`);states++;meshes+=next.meshes.length;bands+=next.bands.length;a.dispose();b.dispose();
}
console.log(JSON.stringify({states,meshes,bands,beforeRoot,currentRoot,scope:'Only full authored non-panelled cross-band triangles are excluded. Every other vertex channel, material pigment/roughness/metalness, node transform/metadata and compiled gameplay input is exact. Four orientations, ordinary room disclosure and original/closed slab/usable roof.'},null,2));
