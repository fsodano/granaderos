import {wallMovementBlocked} from './wall-geometry.js';
import {propBlocksAt} from './props.js';
import {boundaryPassable,inwardFromBoundary} from './tactical-exits.js';
// Existing schematic city road approaches, expressed on the compact 20x16 map.
const entries={
 'retiro:buenos_aires':{edge:'N',x:9,y:0},
 'buenos_aires:retiro':{edge:'S',x:14,y:15},
 'buenos_aires:ensenada':{edge:'W',x:0,y:7},
 'ensenada:buenos_aires':{edge:'E',x:19,y:7},
};
export const militiaArrivalEntry=(from,to)=>entries[`${from}:${to}`]??null;
export function validMilitiaArrival(unit,sector){
 const a=unit?.militiaArrival;if(a===undefined)return true;
 return Boolean(unit.militia&&a&&typeof a==='object'&&!Array.isArray(a)&&Object.keys(a).length===2&&typeof a.from==='string'&&typeof a.to==='string'&&a.to===sector&&militiaArrivalEntry(a.from,a.to));
}
export function militiaArrivalTerrain(state,unit){
 if(!validMilitiaArrival(unit,state.sectorId)||!unit.militiaArrival)throw Error('La llegada de la milicia es inválida.');
 const {from,to}=unit.militiaArrival,{edge,x,y}=militiaArrivalEntry(from,to),compact=state.width===20&&state.height===16;
 const anchor=compact?{x,y}:{x:edge==='W'?0:edge==='E'?state.width-1:x+Math.floor((state.width-20)/2)+(to==='ensenada'?10:0),y:edge==='N'?0:edge==='S'?state.height-1:y+Math.floor((state.height-16)/2)};
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
