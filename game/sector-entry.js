import {spaceKey} from './tactical-space.js';
import {propBlocksAt} from './props.js';
import {movementStepCost} from './tactical.js';
import {boundaryPassable,inwardFromBoundary} from './tactical-exits.js';
const key=spaceKey;

// Buildings cannot become an arrival fallback. The largest exterior component
// is the authored road network on these schematic maps, including saved breaches.
export function exteriorComponent(state,unit){
 const open=state.tiles.filter(t=>!t.blocked&&!t.buildingId&&!propBlocksAt(state,t.x,t.y)),available=new Map(open.map(t=>[key(t),t])),seen=new Set();let largest=new Set();
 for(const start of open){
  if(seen.has(key(start)))continue;
  const component=new Set([key(start)]),queue=[start];seen.add(key(start));
  for(let i=0;i<queue.length;i++)for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const next=available.get(key({x:queue[i].x+dx,y:queue[i].y+dy}));
   if(next&&!seen.has(key(next))&&Number.isFinite(movementStepCost(state,unit,queue[i],next))){seen.add(key(next));component.add(key(next));queue.push(next);}
  }
  if(component.size>largest.size)largest=component;
 }
 return largest;
}

export function entryTerrainCells(state,unit,edge,component=exteriorComponent(state,unit)){
 return state.tiles.filter(t=>boundaryPassable(state,t,edge)&&component.has(key(t))&&Number.isFinite(movementStepCost(state,unit,t,inwardFromBoundary(t,edge))));
}
