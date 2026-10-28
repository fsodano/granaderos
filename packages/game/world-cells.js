import {TRAVEL_BALANCE} from './travel-balance.js';
import {campaignWorld} from './campaign-definition.js';
import {scenarioFor} from './campaign-scenario.js';

const contexts=new WeakMap();
export function worldContext(value=null){
 const definition=campaignWorld(value);
 let context=contexts.get(definition);
 if(!context){context=compileWorldContext(definition);contexts.set(definition,context);}
 return context;
}
function compileWorldContext(definition){
 const CAMPAIGN_SECTORS=definition.sectors;
 const localities=new Map(CAMPAIGN_SECTORS.map(d=>[d.id,d]));
 const WORLD_CELLS=Object.freeze(definition.cells.map(cell=>Object.freeze({...cell})));
 const cityForSector=id=>definition.cities.find(city=>city.sectors.includes(id))??null;
const byCell=new Map(WORLD_CELLS.map(c=>[c.id,c]));
const byLocation=new Map(WORLD_CELLS.map(c=>[c.location,c]));
const worldCell=id=>byCell.get(id)??byLocation.get(id)??null;
const locationId=id=>worldCell(id)?.location??null;
const campaignPlace=id=>localities.get(id)??byLocation.get(id)??null;
const validWorldLocation=id=>Boolean(byLocation.get(id)?.land);
function worldOwner(state,id){
 const cell=worldCell(id);
 return cell?.locality?state.sectors[cell.locality]?.owner:cell?.land?'neutral':null;
}
function cellTravelReason(state,id){
 const cell=worldCell(id);
 if(!cell)return 'La celda no existe.';
 if(!cell.land)return 'Esta celda es agua abierta. La escuadra necesita una ruta de transporte por agua.';
 if(worldOwner(state,id)==='royalist')return 'La localidad está ocupada. Liberá su sector principal antes de recorrer sus barrios.';
 if(cellWinterClosed(state,id))return 'La nieve invernal ha cerrado los pasos.';
 return null;
}
function cellWinterClosed(state,id){
 const cell=worldCell(id),winter=definition.travel?.winter,month=scenarioFor(state).calendar(state).month;
 return Boolean(cell&&winter&&winter.biomes.includes(cell.biome)&&winter.theaters.includes(cell.theater)&&(!winter.excludeCities||!cityForSector(cell.locality))&&winter.months.includes(month));
}
function adjacentCells(a,b){
 const first=worldCell(a),second=worldCell(b);
 return Boolean(first&&second&&Math.abs(first.col-second.col)+Math.abs(first.row-second.row)===1);
}
// Keep the old diagonal projection only to validate journeys already in saves.
const legacyRoadCells=new Set();
for(const town of CAMPAIGN_SECTORS)for(const target of town.neighbors){
 const a=worldCell(town.id),b=worldCell(target);if(!a||!b)continue;
 const steps=Math.max(Math.abs(b.col-a.col),Math.abs(b.row-a.row));
 for(let i=0;i<=steps;i++){const cell=worldCell(`cell-${Math.round(a.col+(b.col-a.col)*i/(steps||1))}-${Math.round(a.row+(b.row-a.row)*i/(steps||1))}`);if(cell?.land)legacyRoadCells.add(cell.id);}
}
const neighbors=cell=>[[0,-1],[-1,0],[1,0],[0,1]].map(([dx,dy])=>byCell.get(`cell-${cell.col+dx}-${cell.row+dy}`)).filter(c=>c?.land);
const roadKey=(a,b)=>a<b?`${a}|${b}`:`${b}|${a}`;
const roadEdges=new Map();
const ROAD_CELLS=new Set();
const ROAD_SEGMENTS=[];
const connectRoad=(a,b)=>{
 const key=roadKey(a.id,b.id);if(roadEdges.has(key))return;
 roadEdges.set(key,true);ROAD_CELLS.add(a.id);ROAD_CELLS.add(b.id);
 ROAD_SEGMENTS.push(Object.freeze({from:a.location,to:b.location}));
};
// Connect each existing campaign link on land, through shared sector edges.
// A small distance penalty keeps the schematic road near its atlas corridor.
function roadPath(a,b){
 const costs=new Map([[a.id,0]]),parents=new Map(),open=new Set([a.id]);
 const dx=b.col-a.col,dy=b.row-a.row,length=Math.hypot(dx,dy)||1;
 while(open.size){
  let id=null;for(const candidate of open)if(id===null||costs.get(candidate)<costs.get(id))id=candidate;
  open.delete(id);
  if(id===b.id){const path=[b];while(parents.has(id)){id=parents.get(id);path.unshift(byCell.get(id));}return path;}
  for(const next of neighbors(byCell.get(id))){
   const distance=Math.abs(dx*(next.row-a.row)-dy*(next.col-a.col))/length;
   const cost=costs.get(id)+1+distance*.08+(next.biome==='mountain'?.15:0);
   if(cost>=(costs.get(next.id)??Infinity))continue;
   costs.set(next.id,cost);parents.set(next.id,id);open.add(next.id);
  }
 }
 throw Error(`El camino ${a.location}–${b.location} no tiene conexión terrestre.`);
}
const ROAD_LINKS=Object.freeze(CAMPAIGN_SECTORS.flatMap(town=>town.neighbors.filter(id=>town.id<id).map(target=>{
 const path=roadPath(worldCell(town.id),worldCell(target));
 for(let i=1;i<path.length;i++)connectRoad(path[i-1],path[i]);
 return Object.freeze({from:town.id,to:target,path:Object.freeze(path.map(c=>c.location))});
})));
const sameCityCells=(a,b)=>{
 const first=worldCell(a),second=worldCell(b),city=cityForSector(first?.locality)?.id;
 return Boolean(city&&city===cityForSector(second?.locality)?.id);
};
// District streets connect adjacent sectors of the same city, including Retiro.
for(const cell of WORLD_CELLS)if(cell.locality&&cityForSector(cell.locality))for(const next of neighbors(cell))if(sameCityCells(cell.id,next.id))connectRoad(cell,next);
Object.freeze(ROAD_SEGMENTS);
const roadConnects=(a,b)=>{const first=worldCell(a),second=worldCell(b);return Boolean(first&&second&&roadEdges.has(roadKey(first.id,second.id)));};
function roadEdgesForCell(id){
 const cell=worldCell(id);if(!cell)return [];
 return neighbors(cell).filter(next=>roadConnects(cell.id,next.id)).map(next=>next.col<cell.col?'W':next.col>cell.col?'E':next.row<cell.row?'N':'S');
}
const cellStepHours=(id,mode='march')=>{
 const cell=worldCell(id),road=ROAD_CELLS.has(cell?.id),base=cell?.biome==='mountain'?(road?TRAVEL_BALANCE.mountainRoadCellHours:TRAVEL_BALANCE.mountainCellHours):road?TRAVEL_BALANCE.roadCellHours:TRAVEL_BALANCE.plainCellHours;
 return mode==='horse'?Math.max(1,Math.floor(base*TRAVEL_BALANCE.horseHours/TRAVEL_BALANCE.roadWalkHours)):base;
};
function cellLegHours(from,to,mode='march'){
 if(adjacentCells(from,to)&&sameCityCells(from,to))return TRAVEL_BALANCE.cityCellHours;
 const cell=worldCell(to),road=roadConnects(from,to),base=cell?.biome==='mountain'?(road?TRAVEL_BALANCE.mountainRoadCellHours:TRAVEL_BALANCE.mountainCellHours):road?TRAVEL_BALANCE.roadCellHours:TRAVEL_BALANCE.plainCellHours;
 return mode==='horse'?Math.max(1,Math.floor(base*TRAVEL_BALANCE.horseHours/TRAVEL_BALANCE.roadWalkHours)):base;
}
// Version-1 journeys store the duration chosen when that leg was queued.
// Preserve only durations produced by the two earlier cost rules.
const legacyCellStepHours=(id,mode='march')=>{
 const cell=worldCell(id),base=cell?.biome==='mountain'?4:legacyRoadCells.has(cell?.id)?1:2;
 return mode==='horse'?Math.max(1,Math.floor(base/2)):base;
};
const previousCellStepHours=(id,mode='march')=>{
 const cell=worldCell(id),base=cell?.biome==='mountain'?8:legacyRoadCells.has(cell?.id)?2:4;
 return mode==='horse'?Math.max(1,Math.floor(base/2)):base;
};
function cellTravelPlan(state,destination,mode='march'){
 const start=worldCell(state.location),end=worldCell(destination);
 const reason=cellTravelReason(state,destination);
 if(!start||!end||reason)return {path:[],hours:0,reason:reason??'La ubicación actual no existe.'};
 // Dijkstra keeps the chosen route deterministic and accounts for relief.
 const costs=new Map([[start.id,0]]),parents=new Map(),open=new Set([start.id]);
 while(open.size){
  let id=null;
  for(const candidate of open)if(id===null||costs.get(candidate)<costs.get(id))id=candidate;
  open.delete(id);
  if(id===end.id){
   const path=[end.location];let cursor=id;
   while(parents.has(cursor)){cursor=parents.get(cursor);path.unshift(byCell.get(cursor).location);}
   return {path,hours:costs.get(id),reason:null};
  }
  const cell=byCell.get(id);
  for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]]){
   const next=byCell.get(`cell-${cell.col+dx}-${cell.row+dy}`);
   if(!next||cellTravelReason(state,next.id))continue;
   const cost=costs.get(id)+cellLegHours(cell.location,next.location,mode);
   if(cost>=(costs.get(next.id)??Infinity))continue;
   costs.set(next.id,cost);parents.set(next.id,id);open.add(next.id);
  }
 }
 return {path:[],hours:0,reason:'No hay una ruta terrestre abierta hasta esa celda.'};
}

 return {WORLD_CELLS,ROAD_CELLS,ROAD_SEGMENTS,ROAD_LINKS,worldCell,locationId,campaignPlace,validWorldLocation,worldOwner,cellTravelReason,cellWinterClosed,adjacentCells,sameCityCells,roadConnects,roadEdgesForCell,cellStepHours,cellLegHours,legacyCellStepHours,previousCellStepHours,cellTravelPlan};
}

// Legacy default exports remain available to isolated map tools.
export const WORLD_CELLS=worldContext().WORLD_CELLS;
export const ROAD_CELLS=worldContext().ROAD_CELLS;
export const ROAD_SEGMENTS=worldContext().ROAD_SEGMENTS;
export const ROAD_LINKS=worldContext().ROAD_LINKS;
export const worldCells=value=>worldContext(value).WORLD_CELLS;
export const roadSegments=value=>worldContext(value).ROAD_SEGMENTS;
export const roadLinks=value=>worldContext(value).ROAD_LINKS;
export const worldCell=(id,context=null)=>worldContext(context).worldCell(id);
export const locationId=(id,context=null)=>worldContext(context).locationId(id);
export const campaignPlace=(id,context=null)=>worldContext(context).campaignPlace(id);
export const validWorldLocation=(id,context=null)=>worldContext(context).validWorldLocation(id);
export const adjacentCells=(a,b,context=null)=>worldContext(context).adjacentCells(a,b);
export const sameCityCells=(a,b,context=null)=>worldContext(context).sameCityCells(a,b);
export const roadConnects=(a,b,context=null)=>worldContext(context).roadConnects(a,b);
export const roadEdgesForCell=(id,context=null)=>worldContext(context).roadEdgesForCell(id);
export const cellStepHours=(id,mode='march',context=null)=>worldContext(context).cellStepHours(id,mode);
export const cellLegHours=(from,to,mode='march',context=null)=>worldContext(context).cellLegHours(from,to,mode);
export const legacyCellStepHours=(id,mode='march',context=null)=>worldContext(context).legacyCellStepHours(id,mode);
export const previousCellStepHours=(id,mode='march',context=null)=>worldContext(context).previousCellStepHours(id,mode);
export const worldOwner=(state,id)=>worldContext(state).worldOwner(state,id);
export const cellTravelReason=(state,id)=>worldContext(state).cellTravelReason(state,id);
export const cellWinterClosed=(state,id)=>worldContext(state).cellWinterClosed(state,id);
export const cellTravelPlan=(state,destination,mode='march')=>worldContext(state).cellTravelPlan(state,destination,mode);
