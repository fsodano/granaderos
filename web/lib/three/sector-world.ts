import {Group,Mesh,Scene,Vector3} from 'three';
import {buildBuilding,buildIndependentWalls,effectiveRooms,shownUpperSurfaces} from './world-buildings';
import {buildCannon} from './world-artillery';
import {WorldGeometry,disposeWorldNode} from './world-geometry';
import {buildLoot} from './world-items';
import {animateWorldNode,buildClimbLinks,buildLight,buildSmoke} from './world-lights';
import {WorldMaterials,illuminationAt,worldKey} from './world-materials';
import {activeClimbLinks,buildClimbCovers,climbOpenings,type ClimbOpening} from './world-climb-openings';
import {buildProps} from './world-props';
import {buildTerrainChunk,buildUpperSurfaces,chunkKey,terrainChunks} from './world-terrain';
import {buildVegetationChunk,softenedFoliage} from './world-vegetation';
import type {SectorWorld,WorldInput,WorldNode,WorldOptions,WorldPoint,WorldTile} from './world-types';

export type {SectorWorld,WorldInput,WorldOptions} from './world-types';

/** Rendering consumes admitted records. It never derives collision or visibility. */
export function createSectorWorld(scene:Scene,options:WorldOptions):SectorWorld{
  if(!Number.isFinite(options.tileMetres)||options.tileMetres<=0)throw Error('World tileMetres must be positive');
  const T=options.tileMetres,root=new Group(),geometry=new WorldGeometry(),materials=new WorldMaterials(options),nodes=new Map<string,WorldNode>();
  root.name='sector-world';scene.add(root);
  let disposed=false,input:WorldInput|undefined,chunks=new Map<string,WorldTile[]>(),desired=new Set<string>(),time=0;
  let openings:ClimbOpening[]=[];
  let vegetationBase=new Map<string,string>(),upperBase='',upperAlways:readonly WorldTile[]=[],upperSupported:readonly WorldTile[]=[];
  const signature=(value:unknown)=>JSON.stringify(value);
  const retain=(id:string,key:string,build:()=>Group)=>{
    desired.add(id);const existing=nodes.get(id);if(existing?.signature===key)return existing.object as Group;
    if(existing)disposeWorldNode(existing.object);const object=build();root.add(object);nodes.set(id,{id,signature:key,object,anchors:object.userData.anchorNodes});return object;
  };
  const lit=(points:readonly WorldPoint[])=>points.map(point=>illuminationAt(input!,point));
  const updateCutaways=()=>{
    if(!input)return;
    for(const [id,tiles]of chunks){
      const vegetation=tiles.filter(tile=>['forest','scrub'].includes(tile.type)&&!tile.buildingId);if(!vegetation.length)continue;
      retain(`vegetation:${id}`,`${vegetationBase.get(id)}:${softenedFoliage(vegetation,input).join(';')}`,()=>buildVegetationChunk(id,vegetation,input!,T,geometry,materials));
    }
    const supported=upperSupported.filter(surface=>(input!.admittedActorPoints??[]).some(point=>(point.tacticalLevel??0)===(surface.tacticalLevel??0)&&Math.abs(point.x-surface.x)<.65&&Math.abs(point.y-surface.y)<.65)),surfaces=[...upperAlways,...supported];
    if(surfaces.length)retain('upper-surfaces',`${upperBase}:${supported.map(worldKey).join(';')}`,()=>buildUpperSurfaces(surfaces,input!,T,geometry,materials));
    else{const node=nodes.get('upper-surfaces');if(node){disposeWorldNode(node.object);nodes.delete('upper-surfaces');}}
    const shown=openings.filter(opening=>surfaces.some(surface=>(surface.tacticalLevel??0)===opening.level&&Math.abs((surface.elevation??0)-opening.height)<1e-6&&(surface.x+.5)*T>opening.minX&&(surface.x-.5)*T<opening.maxX&&(surface.y+.5)*T>opening.minZ&&(surface.y-.5)*T<opening.maxZ));
    const active=activeClimbLinks(input.admittedActorPoints??[]);
    if(shown.length)retain('climb-covers',signature([shown,[...active].filter(id=>shown.some(opening=>opening.linkId===id)).sort(),lit(shown.map(opening=>({x:(opening.minX+opening.maxX)/2/T,y:(opening.minZ+opening.maxZ)/2/T,tacticalLevel:opening.level})))]),()=>buildClimbCovers(shown,active,input!,T,geometry,materials));
    else{const node=nodes.get('climb-covers');if(node){disposeWorldNode(node.object);nodes.delete('climb-covers');}}

  };
  const update=(next:WorldInput)=>{
    if(disposed)throw Error('Cannot update a disposed sector world');
    for(const source of [next,next.terrain])for(const key of ['units','npcs','players','enemies'])if(key in source)throw Error(`Sector world must not receive the ${key} roster`);
    input=next;time=next.timeSeconds??time;desired=new Set();chunks=terrainChunks(next.terrain.tiles);
    vegetationBase=new Map([...chunks].map(([id,tiles])=>{const vegetation=tiles.filter(tile=>['forest','scrub'].includes(tile.type)&&!tile.buildingId);return [id,signature([vegetation,lit(vegetation)])];}));
    openings=climbOpenings(next,T);
    upperAlways=shownUpperSurfaces({...next,admittedActorPoints:[]});const always=new Set(upperAlways);upperSupported=(next.terrain.upperSurfaces??[]).filter(surface=>!always.has(surface));upperBase=signature([next.terrain.upperSurfaces,openings,lit(next.terrain.upperSurfaces??[]),[...effectiveRooms(next)].sort(),next.cursorLevel]);
    const heights=new Map(next.terrain.tiles.map(tile=>[worldKey(tile),tile.elevation??0]));
    for(const [id,tiles]of chunks){
      const edges=tiles.flatMap(tile=>[[tile.x-1,tile.y],[tile.x+1,tile.y],[tile.x,tile.y-1],[tile.x,tile.y+1]].map(([x,y])=>heights.get(`0:${x},${y}`)));
      retain(`terrain:${id}`,signature([tiles,edges,next.terrain.sceneId??next.terrain.sectorId,lit(tiles)]),()=>buildTerrainChunk(id,tiles,next,T,geometry,materials));
    }
    updateCutaways();
    const known=[...effectiveRooms(next)].sort(),allWalls=next.terrain.tiles.filter(tile=>['wall','door','window'].includes(tile.type));
    for(const building of next.terrain.buildings??[]){
      const tiles=next.terrain.tiles.filter(tile=>tile.buildingId===building.id),surfaces=(next.terrain.upperSurfaces??[]).filter(tile=>tile.buildingId===building.id);
      retain(`building:${building.id}`,signature([building,tiles,surfaces,openings,known,next.cursorLevel,lit(tiles),lit(surfaces)]),()=>buildBuilding(building,next,T,geometry,materials));
    }
    const independent=allWalls.filter(tile=>!tile.buildingId);
    if(independent.length)retain('independent-walls',signature([independent,lit(independent)]),()=>buildIndependentWalls(next,T,geometry,materials));
    const propChunks=new Map<string,NonNullable<WorldInput['terrain']['props']>[number][]>();
    for(const prop of next.terrain.props??[]){const key=`${prop.tacticalLevel??0}:${chunkKey(prop)}`,list=propChunks.get(key)??[];list.push(prop);propChunks.set(key,list);}
    for(const [id,props]of propChunks)retain(`props:${id}`,signature([props,lit(props)]),()=>buildProps(id,props,next,T,geometry,materials));
    if(next.terrain.climbLinks?.length){
      const elevation=(point:WorldPoint)=>point.elevation??(point.tacticalLevel?next.terrain.upperSurfaces:next.terrain.tiles)?.find(surface=>worldKey(surface)===worldKey(point))?.elevation??0;
      retain('climb-links',signature([next.terrain.climbLinks,next.terrain.climbLinks.map(link=>[elevation(link.from),elevation(link.to)]),lit(next.terrain.climbLinks.map(link=>link.from))]),()=>buildClimbLinks(next,T,geometry,materials));
    }
    for(const cannon of next.cannons??[])retain(`cannon:${cannon.id}`,signature([cannon,illuminationAt(next,cannon)]),()=>buildCannon(cannon,next,T,geometry,materials));
    for(const [n,pile]of (next.loot??[]).entries()){
      const id=pile.id??`${worldKey(pile)}:${n}`;retain(`loot:${id}`,signature([pile,illuminationAt(next,pile)]),()=>buildLoot(id,pile,next,T,geometry,materials));
    }
    for(const [n,source]of (next.terrain.lights??[]).entries()){
      const id=source.id??`${worldKey(source)}:${source.type??'campfire'}:${n}`;retain(`light:${id}`,signature([source,next.terrain.night,illuminationAt(next,source),n<12]),()=>buildLight(id,source,next,T,geometry,materials,n<12));
    }
    for(const [n,source]of (next.smoke??[]).entries())if(source.turns!==0&&source.remainingSeconds!==0){
      const id=source.id??`${worldKey(source)}:${n}`;retain(`smoke:${id}`,signature([source,illuminationAt(next,source)]),()=>buildSmoke(id,source,next,T,geometry,materials));
    }
    for(const [id,node]of nodes)if(!desired.has(id)){disposeWorldNode(node.object);nodes.delete(id);}
    root.updateMatrixWorld(true);
  };
  const updateActors=(points:readonly WorldPoint[])=>{
    if(disposed||!input)return;input={...input,admittedActorPoints:points};updateCutaways();
  };
  const tick=(_deltaSeconds:number,timeSeconds:number)=>{
    if(disposed)return;time=timeSeconds;for(const node of nodes.values())if(node.object.userData.kind==='light'||node.object.userData.kind==='smoke')animateWorldNode(node.object as Group,time,Boolean(input?.reducedMotion));
  };
  const inspect=()=>{
    let objects=0,meshes=0,triangles=0;const ids=new Set<string>();
    root.traverse(object=>{objects++;if(object.userData.semanticId)ids.add(object.userData.semanticId);for(const id of object.userData.semanticIds??[])ids.add(id);if(object instanceof Mesh){meshes++;triangles+=(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3;}});
    return {objects,meshes,triangles,chunks:[...nodes.keys()].filter(key=>key.startsWith('terrain:')).length,semanticIds:[...ids].sort(),pendingTextures:materials.pending,assetErrors:[...materials.errors],disposed};
  };
  const anchor=(id:string,role:string)=>{const node=nodes.get(`cannon:${id}`)??nodes.get(id),point=node?.anchors?.get(role);if(!point||disposed)return null;root.updateMatrixWorld(true);return point.getWorldPosition(new Vector3());};
  const dispose=()=>{if(disposed)return;disposed=true;for(const node of nodes.values())disposeWorldNode(node.object);nodes.clear();root.removeFromParent();materials.dispose();geometry.dispose();input=undefined;chunks.clear();};
  return {update,updateActors,tick,inspect,anchor,dispose};
}
