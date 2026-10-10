import {wallMovementBlocked} from './wall-geometry.js';
// Physical levels are independent of a recruit's earned `level`.
export const MAX_TACTICAL_LEVEL=8;
export const DEFAULT_SLAB_THICKNESS=.2;
const upperIndexes=new WeakMap();
export const tacticalLevel=point=>point?.tacticalLevel===undefined?0:point.tacticalLevel;
export const spaceKey=point=>`${tacticalLevel(point)}:${point.x},${point.y}`;
export const sameSurface=(a,b)=>tacticalLevel(a)===tacticalLevel(b);
export const sameCell=(a,b)=>sameSurface(a,b)&&a.x===b.x&&a.y===b.y;
export const spacePoint=point=>({x:point.x,y:point.y,tacticalLevel:tacticalLevel(point)});
const validLevel=level=>Number.isInteger(level)&&level>=0&&level<=MAX_TACTICAL_LEVEL;

export function surfaceAt(state,point){
 if(!point||!Number.isInteger(point.x)||!Number.isInteger(point.y)||!validLevel(tacticalLevel(point)))return null;
 if(point.x<0||point.y<0||point.x>=state.width||point.y>=state.height)return null;
 if(tacticalLevel(point)===0){
  const candidate=state.tiles?.[point.y*state.width+point.x];
  return candidate&&sameCell(candidate,point)?candidate:state.tiles?.find(tile=>sameCell(tile,point))??null;
 }
 const surfaces=state.upperSurfaces;if(!Array.isArray(surfaces))return null;
 let index=upperIndexes.get(surfaces);
 if(!index){index=new Map(surfaces.map(surface=>[spaceKey(surface),surface]));upperIndexes.set(surfaces,index);}
 return index.get(spaceKey(point))??null;
}
export function surfaceHeight(state,point){
 const surface=surfaceAt(state,point);return surface?surface.elevation??0:null;
}
export function surfacesAtLevel(state,level=0){
 return level===0?state.tiles??[]:(state.upperSurfaces??[]).filter(surface=>tacticalLevel(surface)===level);
}
// Geometry only. Occupants, furniture, AP and body condition belong to callers.
export function canWalkBetween(state,from,to){
 if(!sameSurface(from,to)||wallMovementBlocked(state,from,to))return false;
 const dx=Math.abs(to.x-from.x),dy=Math.abs(to.y-from.y),start=surfaceAt(state,from),end=surfaceAt(state,to);
 if(Math.max(dx,dy)!==1||!start||!end||start.blocked||end.blocked||surfaceHeight(state,from)!==surfaceHeight(state,to))return false;
 if(dx&&dy)for(const point of [{...spacePoint(from),x:to.x},{...spacePoint(from),y:to.y}]){
  const corner=surfaceAt(state,point);if(!corner||corner.blocked||surfaceHeight(state,point)!==surfaceHeight(state,from))return false;
 }
 return true;
}
export function accessStepsFrom(state,point){
 const steps=[];
 for(const link of state.climbLinks??[]){
  const to=sameCell(point,link.from)?link.to:sameCell(point,link.to)?link.from:null;
  if(to)steps.push({...spacePoint(to),kind:'climb',linkId:link.id,from:spacePoint(point)});
 }
 return steps;
}

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const finite=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const id=value=>typeof value==='string'&&value.length<=240&&/^[a-zA-Z0-9][a-zA-Z0-9:._-]*$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
const need=(ok,label)=>{if(!ok)throw Error(`El espacio táctico contiene ${label} inválidos.`);};
export function validateTacticalSpace(state){
 const coord=point=>object(point)&&Number.isInteger(point.x)&&Number.isInteger(point.y)&&point.x>=0&&point.y>=0&&point.x<state.width&&point.y<state.height&&validLevel(tacticalLevel(point));
 const surfaces=state.upperSurfaces===undefined?[]:state.upperSurfaces,links=state.climbLinks===undefined?[]:state.climbLinks;
 need(Array.isArray(surfaces)&&surfaces.length<=8192&&Array.isArray(links)&&links.length<=2000,'superficies o accesos');
 for(const tile of state.tiles??[]){need(tacticalLevel(tile)===0,'niveles del terreno');if(tile.elevation!==undefined)need(finite(tile.elevation,0,100),'alturas del terreno');}
 const ids=new Set(),cells=new Set(),columns=new Map();
 for(const surface of surfaces){
  need(coord(surface)&&tacticalLevel(surface)>0&&id(surface.id)&&!ids.has(surface.id)&&!cells.has(spaceKey(surface)),'identidades o posiciones de superficies');
  ids.add(surface.id);cells.add(spaceKey(surface));
  need(surface.type==='floor'&&['roof','platform'].includes(surface.kind)&&typeof surface.blocked==='boolean'&&finite(surface.cover,0,100),'superficies');
  need(finite(surface.elevation,0,100)&&surface.elevation>0,'alturas');
  const thickness=surface.slabThickness===undefined?DEFAULT_SLAB_THICKNESS:surface.slabThickness;
  need(finite(thickness,0,10)&&thickness>0&&thickness<=surface.elevation,'espesores');
  if(surface.blocksSight!==undefined)need(typeof surface.blocksSight==='boolean','visibilidad');
  if(surface.material!==undefined)need(['wood','adobe','stone','hay'].includes(surface.material),'materiales');
  for(const [key,max]of [['obstacleHeight',10],['projectileResistance',1000],['concealment',100]])if(surface[key]!==undefined)need(finite(surface[key],0,max),'cobertura');
  const ground=surfaceAt(state,{x:surface.x,y:surface.y});need(ground,'apoyos sobre el terreno');
  const column=`${surface.x},${surface.y}`,levels=columns.get(column)??[{tacticalLevel:0,elevation:ground.elevation??0}];levels.push(surface);columns.set(column,levels);
  if(surface.buildingId!==undefined){
   const building=(state.buildings??[]).find(b=>b.id===surface.buildingId);
   need(building&&surface.x>=building.x&&surface.y>=building.y&&surface.x<building.x+building.width&&surface.y<building.y+building.height,'pertenencia al edificio');
  }
  if(surface.roomId!==undefined)need((state.buildings??[]).flatMap(b=>b.rooms??[]).some(room=>room.id===surface.roomId&&room.cells?.some(cell=>sameCell(cell,surface))),'pertenencia a la habitación');
 }
 for(const levels of columns.values()){
  levels.sort((a,b)=>tacticalLevel(a)-tacticalLevel(b));
  for(let i=1;i<levels.length;i++)need(levels[i].elevation-(levels[i].slabThickness??DEFAULT_SLAB_THICKNESS)>levels[i-1].elevation,'orden de las alturas');
 }
 const endpoint=point=>coord(point)&&Object.keys(point).every(key=>['x','y','tacticalLevel'].includes(key))&&surfaceAt(state,point)&&!surfaceAt(state,point).blocked;
 const edges=new Set();
 for(const link of links){
  need(object(link)&&id(link.id)&&!ids.has(link.id)&&link.kind==='climb','identidades de accesos');ids.add(link.id);
  need(endpoint(link.from)&&endpoint(link.to),'extremos de accesos');
  need(tacticalLevel(link.to)-tacticalLevel(link.from)===1&&Math.abs(link.to.x-link.from.x)+Math.abs(link.to.y-link.from.y)<=1&&surfaceHeight(state,link.to)>surfaceHeight(state,link.from),'conexiones de accesos');
  const edge=`${spaceKey(link.from)}>${spaceKey(link.to)}`;need(!edges.has(edge),'accesos duplicados');edges.add(edge);
 }
 const supported=(point,label,walkable=false)=>{
  need(coord(point)&&surfaceAt(state,point),label);
  if(walkable&&tacticalLevel(point)>0)need(!surfaceAt(state,point).blocked,label);
 };
 const upperOccupants=new Set();
 for(const actor of [...(state.units??[]),...(state.npcs??[])]){
  const alive=(actor.hp??100)>0&&!actor.departure;
  supported(actor,'apoyos de personas',alive);
  if(tacticalLevel(actor)>0){
   need(!actor.mounted,'monturas fuera del suelo');
   // Bodies may share a cell; conscious people on an upper floor may not.
   if(alive&&!actor.unconscious){need(!upperOccupants.has(spaceKey(actor)),'ocupantes superpuestos');upperOccupants.add(spaceKey(actor));}
  }
  if(actor.departure)need(tacticalLevel(actor)===0&&tacticalLevel(actor.departure)===0,'salidas a nivel del suelo');
  for(const point of [actor.lastKnownEnemy,actor.lastShotPosition,actor.patrolOrigin,actor.ai?.destination])if(point)supported(point,'posiciones recordadas');
  for(const point of [...(actor.lastMovePath??[]),...(actor.fleePath??[])])supported(point,'rutas');
 }
 for(const item of [...(state.groundItems??[]),...(state.droppedWeapons??[]),...(state.lights??[]),...(state.smoke??[]),...(state.artillery??[])])supported(item,'apoyos de objetos');
 for(const prop of state.props??[]){
  const size=prop.footprint??{width:1,height:1};
  for(let dy=0;dy<size.height;dy++)for(let dx=0;dx<size.width;dx++){
   const point={...spacePoint(prop),x:prop.x+dx,y:prop.y+dy};supported(point,'apoyos del mobiliario');
   if(tacticalLevel(prop)>0){
    need(surfaceHeight(state,prop)===surfaceHeight(state,point),'altura del mobiliario');
    if(prop.blocksMovement!==false)need(!upperOccupants.has(spaceKey(point)),'personas dentro del mobiliario');
   }
  }
 }
 // Nothing is added to old flat saves. Their serialized form stays unchanged.
 return state;
}
