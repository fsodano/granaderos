import {register} from 'node:module';
import {createHash} from 'node:crypto';
register('./tactical-render-loader.mjs',import.meta.url);
const {WorldGeometry,disposeWorldNode}=await import('../apps/web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../apps/web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../apps/web/lib/three/world-buildings.ts');
export const tileMetres=1.2360585147470482;

export function renderBuilding(map,building){
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres,assetUrl:path=>path});
 const input={terrain:{width:map.width,height:map.height,tiles:map.tiles,wallEdges:map.wallEdges,buildings:map.buildings,upperSurfaces:map.upperSurfaces},revealedRooms:[]};
 const object=buildBuilding(building,input,tileMetres,geometry,materials),meshes=[];
 object.updateMatrixWorld(true);
 object.traverseVisible(child=>{if(child.isMesh){
  const records=Array.isArray(child.material)?child.material:[child.material];
  meshes.push({name:child.name,materials:records.map(m=>({name:m.name,colour:m.color.getHexString()})),attributes:Object.fromEntries(Object.entries(child.geometry.attributes).map(([key,a])=>[key,Array.from(a.array)])),index:child.geometry.index?Array.from(child.geometry.index.array):null,matrix:Array.from(child.matrixWorld.elements)});
 }});
 const colours=new Set(meshes.flatMap(mesh=>mesh.materials.map(m=>m.colour))),materialNames=new Set(meshes.flatMap(mesh=>mesh.materials.map(m=>m.name)));
 const hash=createHash('sha256').update(JSON.stringify({height:object.userData.height,meshes})).digest('hex');
 const dispose=()=>{disposeWorldNode(object);geometry.dispose();materials.dispose();};
 return {object,meshes,colours,materialNames,hash,dispose};
}
