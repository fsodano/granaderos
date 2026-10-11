import {wallMovementBlocked} from './wall-geometry.js';
import {propBlocksAt} from './props.js';
import {boundaryPassable,inwardFromBoundary,entryFromSector} from './tactical-exits.js';
import {physicalEntryAnchor} from './sector-expansion.js';
import {campaignDefinitions} from './campaign-definition.js';
// City approaches come from the selected world's physical road exits.
export const militiaArrivalEntry=(from,to,context=null)=>{const entry=entryFromSector(from,to,null,context);return entry?{edge:entry.entryEdge,...entry.entryAnchor}:null;};
export function validMilitiaArrival(unit,sector,context=null){
 const a=unit?.militiaArrival;if(a===undefined)return true;
 if(!unit.militia||!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).length!==2||typeof a.from!=='string'||typeof a.to!=='string'||a.to!==sector)return false;
 // Battle snapshots retain admitted exits rather than the complete package.
 // Campaign save admission separately checks these routes against pinned data.
 if(context?.sectorId===sector&&Array.isArray(context.exits)&&!campaignDefinitions(context)?.world)return context.exits.some(exit=>exit.destination===a.from);
 return Boolean(militiaArrivalEntry(a.from,a.to,context));
}
export function militiaArrivalTerrain(state,unit,context=null){
 if(!validMilitiaArrival(unit,state.sectorId,context)||!unit.militiaArrival)throw Error('La llegada de la milicia es inválida.');
 const {from,to}=unit.militiaArrival,{edge,x,y}=militiaArrivalEntry(from,to,context);
 const anchor=physicalEntryAnchor(edge,{x,y},state.width,state.height,to,context);
 const key=p=>`${p.x},${p.y}`,open=state.tiles.filter(t=>!t.blocked&&!t.buildingId&&t.type!=='water'&&!propBlocksAt(state,t.x,t.y)),byKey=new Map(open.map(t=>[key(t),t])),seen=new Set();let largest=new Set();
 for(const start of open){
  if(seen.has(key(start)))continue;const queue=[start],component=new Set([key(start)]);seen.add(key(start));
  for(let i=0;i<queue.length;i++)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const next=byKey.get(`${queue[i].x+dx},${queue[i].y+dy}`);if(next&&!seen.has(key(next))&&!wallMovementBlocked(state,queue[i],next)){seen.add(key(next));component.add(key(next));queue.push(next);}}
  if(component.size>largest.size)largest=component;
 }
 const boundary=open.filter(t=>{
  const inward=inwardFromBoundary(t,edge);
  return largest.has(key(t))&&boundaryPassable(state,t,edge)&&largest.has(key(inward))&&!wallMovementBlocked(state,t,inward);
 });
 // A full cohort can exceed the edge width. Enter at the closest legal edge
 // cell, then occupy its exterior approach in walking order. An obstructed
 // edge still has no interior or water fallback.
 boundary.sort((a,b)=>Math.abs(a.x-anchor.x)+Math.abs(a.y-anchor.y)-Math.abs(b.x-anchor.x)-Math.abs(b.y-anchor.y)||a.y-b.y||a.x-b.x);
 const cells=boundary.length?[boundary[0]]:[],reached=new Set(cells.map(key));
 for(let i=0;i<cells.length;i++)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
  const next=byKey.get(`${cells[i].x+dx},${cells[i].y+dy}`);
  if(next&&largest.has(key(next))&&!reached.has(key(next))&&!wallMovementBlocked(state,cells[i],next)){reached.add(key(next));cells.push(next);}
 }
 return {anchor,cells};
}
