import {wallMovementBlocked} from './wall-geometry.js';
import {worldCell,roadEdgesForCell} from './world-cells.js';
import {physicalEntryAnchor} from './sector-expansion.js';
import {propCells} from './props.js';

const key=p=>`${p.x},${p.y}`;
const directions=[[0,-1,'N'],[1,0,'E'],[0,1,'S'],[-1,0,'W']];

// Fresh landmarks must admit every adjacent land route on the strategic grid.
// Keep the authored core intact; connect approaches through the outer landscape.
export function connectWorldCellApproaches(map){
 const cell=worldCell(map.sector);if(!cell?.anchor||map.sceneId)return map;
 const offset=physicalEntryAnchor('N',{x:0,y:0},map.width,map.height,map.sector);
 const dy=(map.height-16)/2,inside=t=>t.x>=offset.x&&t.x<offset.x+20&&t.y>=dy&&t.y<dy+16;
 const props=new Set((map.props??[]).filter(p=>p.blocksMovement!==false).flatMap(propCells).map(key));
 const tiles=new Map(map.tiles.map(t=>[key(t),t]));
 const passable=t=>t&&!t.blocked&&!t.buildingId&&!props.has(key(t));
 const neighbors=t=>directions.map(([dx,dy])=>tiles.get(key({x:t.x+dx,y:t.y+dy}))).filter(Boolean);
 const seen=new Set();let exterior=new Set();
 for(const start of map.tiles.filter(passable)){
  if(seen.has(key(start)))continue;
  const component=new Set([key(start)]),queue=[start];seen.add(key(start));
  for(let i=0;i<queue.length;i++)for(const next of neighbors(queue[i]))if(passable(next)&&!seen.has(key(next))&&!wallMovementBlocked(map,queue[i],next)){seen.add(key(next));component.add(key(next));queue.push(next);}
  if(component.size>exterior.size)exterior=component;
 }
 const roads=new Set(map.tiles.filter(t=>t.type==='road'&&exterior.has(key(t))).map(key)),roadEdges=roadEdgesForCell(cell.location);
 for(const [dx,dy,edge]of directions){
  if(!worldCell(`cell-${cell.col+dx}-${cell.row+dy}`)?.land)continue;
  const anchor=physicalEntryAnchor(edge,{x:edge==='E'?19:edge==='W'?0:2,y:edge==='S'?15:edge==='N'?0:8},map.width,map.height,map.sector);
  const boundary=t=>edge==='N'?t.y===0:edge==='S'?t.y===map.height-1:edge==='W'?t.x===0:t.x===map.width-1;
  const narrow=map.tiles.filter(t=>boundary(t)&&exterior.has(key(t))).length<6;
  const road=roadEdges.includes(edge),target=road&&roads.size?roads:exterior;
  if(!road&&!narrow&&exterior.has(key(anchor)))continue;
  const parents=new Map(),visited=new Set([key(anchor)]),queue=[tiles.get(key(anchor))];let end=null;
  for(let i=0;i<queue.length;i++){
   const current=queue[i];if(target.has(key(current))){end=current;break;}
   for(const next of neighbors(current)){
    if(wallMovementBlocked(map,current,next)||visited.has(key(next))||next.buildingId||props.has(key(next))||next.blocked&&inside(next))continue;
    visited.add(key(next));parents.set(key(next),current);queue.push(next);
   }
  }
  if(!end)throw Error(`La celda ${cell.location} no tiene un acceso terrestre por ${edge}.`);
  const path=[end];while(parents.has(key(path.at(-1))))path.push(parents.get(key(path.at(-1))));
  for(const point of path)for(let spread=narrow?-3:0;spread<=(narrow?3:0);spread++){
   const tile=tiles.get(key({x:point.x+(edge==='N'||edge==='S'?spread:0),y:point.y+(edge==='E'||edge==='W'?spread:0)}));
   if(!tile||inside(tile)||tile.buildingId||props.has(key(tile)))continue;
   if(tile.blocked){Object.assign(tile,{type:road?'road':'grass',blocked:false,blocksSight:false,cover:0});delete tile.material;}
   else if(road)Object.assign(tile,{type:'road',cover:0});
   exterior.add(key(tile));if(tile.type==='road')roads.add(key(tile));
  }
 }
 return map;
}
