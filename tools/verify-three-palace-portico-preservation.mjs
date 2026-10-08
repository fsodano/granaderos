import {register} from 'node:module';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Run against either source tree. This probe owns no renderer or game state.
const root=resolve(process.argv[2]??'.'),output=process.argv[3];
if(!output)throw Error('usage: node verify-three-palace-portico-preservation.mjs <source-root> <output.json>');
const source=p=>pathToFileURL(resolve(root,p)).href;
register(source('tests/tactical-render-loader.mjs'),import.meta.url);
const {Mesh}=await import(source('web/node_modules/three/build/three.module.js'));
const {WorldGeometry,disposeWorldNode}=await import(source('web/lib/three/world-geometry.ts'));
const {WorldMaterials}=await import(source('web/lib/three/world-materials.ts'));
const {buildBuilding}=await import(source('web/lib/three/world-buildings.ts'));
const {getBuildingProfile}=await import(source('game/building-profile.js'));
// Omit only the supported ordinary palace porch roof and its rear closure.
// All main roofing, source cornices/bands, openings and other buildings remain
// in the proof. Eligibility is independent of the proposed return helper.
const eligible=(b,input,height)=>b.kind==='palace'&&Number.isFinite(height)&&height>=4&&buildingArtInset(b,input)===0&&(!Boolean(b.architecture&&(!b.kind||b.roof==='terrace'))||b.wallFinish!==undefined)&&b.roof!=='terrace'&&!(input.terrain.upperSurfaces??[]).some(s=>s.kind==='roof'&&s.buildingId===b.id)&&getBuildingProfile(b).roofShape==='hip';
const {buildingArtInset}=await import(source('web/lib/three/world-building-placement.ts'));
const {buildingAppearance}=await import(source('game/building-appearance.js'));
const {createArchitectureReviewBattle}=await import(source('web/app/renderer-sandbox/architecture-fixtures.js'));
const T=1.2360585147470482,records=[];
for(const id of ['casa','posta','barraca','iglesia','capilla','cabildo','ayuntamiento','palacio','pulperia','almacen','deposito','estancia','herreria','caballeriza'])for(const rotation of [0,90,180,270])for(const view of (['ayuntamiento','palacio'].includes(id)?['exterior','partial','interior']:['exterior']))for(const roof of (['ayuntamiento','palacio'].includes(id)?['original','slab','roof-route']:['original']))for(const finish of (['ayuntamiento','palacio'].includes(id)?['limewash','ochre','adobe','stone','brick']:[undefined])){
 const s=createArchitectureReviewBattle(id,rotation,view,roof),b=s.buildings[0];if(finish)b.wallFinish=finish;
 const input={terrain:{width:s.width,height:s.height,tiles:s.tiles,buildings:s.buildings,upperSurfaces:s.upperSurfaces},revealedRooms:s.revealedRooms},g=new WorldGeometry(),m=new WorldMaterials({tileMetres:T,assetUrl:p=>p}),before=JSON.stringify(input),n=buildBuilding(b,input,T,g,m),meshes=[];
 n.updateMatrixWorld(true);const join=eligible(b,input,n.userData.height),roofName=`world:${b.roofFinish??(b.roof==='thatch'?'thatch':buildingAppearance(b).roofFinish)}`;
 n.traverse(o=>{if(!(o instanceof Mesh))return;let ancestor=o;while(ancestor){if(join&&['palace-portico-roof','palace-portico-return'].some(name=>ancestor.name===`building-detail:${b.id}:${name}`))return;ancestor=ancestor.parent;}const hash=createHash('sha256');for(const [name,a]of Object.entries(o.geometry.attributes).sort()){hash.update(name);hash.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));}if(o.geometry.index)hash.update(Buffer.from(o.geometry.index.array.buffer));const material=o.material;meshes.push({name:o.name,geometry:hash.digest('hex'),matrix:o.matrixWorld.elements,material:{name:material.name,colour:material.color?.getHexString(),roughness:material.roughness,metalness:material.metalness,vertexColors:material.vertexColors,map:material.map?.name,userData:material.userData,polygonOffset:material.polygonOffset,polygonOffsetFactor:material.polygonOffsetFactor,polygonOffsetUnits:material.polygonOffsetUnits}});});
 if(JSON.stringify(input)!==before)throw Error('authored state mutated');records.push({id,rotation,view,roof,finish,height:n.userData.height,openings:n.userData.openings,cutaway:n.userData.cutawayRooms,meshes});disposeWorldNode(n);g.dispose();m.dispose();
}
await writeFile(output,JSON.stringify(records,null,2)+'\n');console.log(`${records.length} actual compiled states; ${records.reduce((n,r)=>n+r.meshes.length,0)} unrelated meshes, including the main roof, current stone band and plaster cornice`);
