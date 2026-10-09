import {TRAVEL_BALANCE} from './travel-balance.js';
import geography from './strategic-geography.json' with {type:'json'};
import {CAMPAIGN_SECTORS} from './data.js';
import {CONTENT_CELLS,CONTENT_MAP} from './content-map.js';
import {mapTilesForSector,project} from './strategic-map.js';
import {cityForSector} from './cities.js';

const localities=new Map(CAMPAIGN_SECTORS.map(d=>[d.id,d]));
const districts=new Map(CAMPAIGN_SECTORS.flatMap(d=>mapTilesForSector(d.id).map((t,i)=>[`${t.col},${t.row}`,{locality:d.id,anchor:i===0}])));
const polygons=geography.land.flatMap(g=>g.type==='MultiPolygon'?g.coordinates:[g.coordinates]).map(p=>p.map(r=>r.map(([lon,lat])=>project(lon,lat))));
const rivers=geography.rivers.flatMap(g=>g.type==='MultiLineString'?g.coordinates:[g.coordinates]).map(r=>r.map(([lon,lat])=>project(lon,lat)));
function inside(p,ring){
 let result=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];
  if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)result=!result;
 }
 return result;
}
function riverDistance(p){
 let best=Infinity;
 for(const line of rivers)for(let i=1;i<line.length;i++){
  const a=line[i-1],b=line[i],dx=b.x-a.x,dy=b.y-a.y;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  best=Math.min(best,Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy));
 }
 return best;
}
// Physical cells never inherit a nearby town's identity. Only the exact first
// district keeps its historical key, so existing campaigns retain their maps.
export const WORLD_CELLS=Object.freeze(CONTENT_CELLS.map(cell=>{
 const district=districts.get(`${cell.col},${cell.row}`),locality=localities.get(district?.locality);
 const center={x:cell.x+CONTENT_MAP.size/2,y:cell.y+CONTENT_MAP.size/2};
 const land=Boolean(district)||polygons.some(p=>inside(center,p[0])&&!p.slice(1).some(h=>inside(center,h)));
 // The relief follows the schematic Andes band already drawn on the atlas.
 const latitude=-22-(center.y-36)/42,longitude=-72+(center.x-36)/36.37;
 const mountain=longitude<-67.4-(-22-latitude)*.24;
 const biome=!land?'water':locality?.biome??(riverDistance(center)<9?'wetland':mountain?'mountain':'plains');
 return Object.freeze({...cell,location:district?.anchor?district.locality:cell.id,locality:district?.locality??null,anchor:Boolean(district?.anchor),land,biome,theater:locality?.theater??(cell.row<16?'north':biome==='mountain'?'cuyo':'interior')});
}));
const byCell=new Map(WORLD_CELLS.map(c=>[c.id,c]));
const byLocation=new Map(WORLD_CELLS.map(c=>[c.location,c]));
export const worldCell=id=>byCell.get(id)??byLocation.get(id)??null;
export const locationId=id=>worldCell(id)?.location??null;
export const campaignPlace=id=>localities.get(id)??byLocation.get(id)??null;
export const validWorldLocation=id=>Boolean(byLocation.get(id)?.land);
export function worldOwner(state,id){
 const cell=worldCell(id);
 return cell?.locality?state.sectors[cell.locality]?.owner:cell?.land?'neutral':null;
}
export function cellTravelReason(state,id){
 const cell=worldCell(id);
 if(!cell)return 'La celda no existe.';
 if(!cell.land)return 'Esta celda es agua abierta. La escuadra necesita una ruta de transporte por agua.';
 if(worldOwner(state,id)==='royalist')return 'La localidad está ocupada. Liberá su sector principal antes de recorrer sus barrios.';
 if(cellWinterClosed(state,id))return 'La nieve invernal ha cerrado los pasos.';
 return null;
}
export function cellWinterClosed(state,id){
 const cell=worldCell(id),month=(2+Math.floor(state.hour/720))%12+1;
 return Boolean(cell?.biome==='mountain'&&cell.theater==='cuyo'&&!cityForSector(cell.locality)&&month>=6&&month<=8);
}
export function adjacentCells(a,b){
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
export const ROAD_CELLS=new Set();
export const ROAD_SEGMENTS=[];
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
export const ROAD_LINKS=Object.freeze(CAMPAIGN_SECTORS.flatMap(town=>town.neighbors.filter(id=>town.id<id).map(target=>{
 const path=roadPath(worldCell(town.id),worldCell(target));
 for(let i=1;i<path.length;i++)connectRoad(path[i-1],path[i]);
 return Object.freeze({from:town.id,to:target,path:Object.freeze(path.map(c=>c.location))});
})));
export const sameCityCells=(a,b)=>{
 const first=worldCell(a),second=worldCell(b),city=cityForSector(first?.locality)?.id;
 return Boolean(city&&city===cityForSector(second?.locality)?.id);
};
// District streets connect adjacent sectors of the same city, including Retiro.
for(const cell of WORLD_CELLS)if(cell.locality&&cityForSector(cell.locality))for(const next of neighbors(cell))if(sameCityCells(cell.id,next.id))connectRoad(cell,next);
Object.freeze(ROAD_SEGMENTS);
export const roadConnects=(a,b)=>{const first=worldCell(a),second=worldCell(b);return Boolean(first&&second&&roadEdges.has(roadKey(first.id,second.id)));};
export function roadEdgesForCell(id){
 const cell=worldCell(id);if(!cell)return [];
 return neighbors(cell).filter(next=>roadConnects(cell.id,next.id)).map(next=>next.col<cell.col?'W':next.col>cell.col?'E':next.row<cell.row?'N':'S');
}
export const cellStepHours=(id,mode='march')=>{
 const cell=worldCell(id),road=ROAD_CELLS.has(cell?.id),base=cell?.biome==='mountain'?(road?TRAVEL_BALANCE.mountainRoadCellHours:TRAVEL_BALANCE.mountainCellHours):road?TRAVEL_BALANCE.roadCellHours:TRAVEL_BALANCE.plainCellHours;
 return mode==='horse'?Math.max(1,Math.floor(base*TRAVEL_BALANCE.horseHours/TRAVEL_BALANCE.roadWalkHours)):base;
};
export function cellLegHours(from,to,mode='march'){
 if(adjacentCells(from,to)&&sameCityCells(from,to))return TRAVEL_BALANCE.cityCellHours;
 const cell=worldCell(to),road=roadConnects(from,to),base=cell?.biome==='mountain'?(road?TRAVEL_BALANCE.mountainRoadCellHours:TRAVEL_BALANCE.mountainCellHours):road?TRAVEL_BALANCE.roadCellHours:TRAVEL_BALANCE.plainCellHours;
 return mode==='horse'?Math.max(1,Math.floor(base*TRAVEL_BALANCE.horseHours/TRAVEL_BALANCE.roadWalkHours)):base;
}
// Version-1 journeys store the duration chosen when that leg was queued.
// Preserve only durations produced by the two earlier cost rules.
export const legacyCellStepHours=(id,mode='march')=>{
 const cell=worldCell(id),base=cell?.biome==='mountain'?4:legacyRoadCells.has(cell?.id)?1:2;
 return mode==='horse'?Math.max(1,Math.floor(base/2)):base;
};
export const previousCellStepHours=(id,mode='march')=>{
 const cell=worldCell(id),base=cell?.biome==='mountain'?8:legacyRoadCells.has(cell?.id)?2:4;
 return mode==='horse'?Math.max(1,Math.floor(base/2)):base;
};
export function cellTravelPlan(state,destination,mode='march'){
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
