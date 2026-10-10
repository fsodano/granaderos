import type {ReactNode} from 'react';
import {canSee} from '../../game/tactical.js';
import {wallEdgeCenter,wallEdgeEndpoints,wallEdgeId,wallEdgeCells} from '../../game/wall-geometry.js';
import {getBuildingRenderProfile} from '../../game/building-profile.js';
import {BUILDING_OPENINGS} from '../../game/building-scale.js';
import {pointInViewport} from '../../game/tactical-viewport.js';

type Args={state:any;players:any[];revealed:Set<string>;cursorLevel:number;mode:string;interactive:boolean;hover:any;viewport:any;project:(x:number,y:number)=>{x:number;y:number};onTile:(point:any)=>void;onHover:(point:any)=>void};
/** Edge controls have their own target. Both adjacent cell centres remain selectable. */
export function wallEdgeControlObjects({state,players,revealed,cursorLevel,mode,interactive,hover,viewport,project,onTile,onHover}:Args):{key:string;depth:number;node:ReactNode}[]{
 if(!interactive||!['move','useItem'].includes(mode))return [];
 return (state.wallEdges??[]).filter((edge:any)=>!edge.destroyed&&(edge.tacticalLevel??0)===cursorLevel&&['wall','door','window'].includes(edge.type)&&players.some(player=>canSee(state,player,edge))).flatMap((edge:any)=>{
  const center=wallEdgeCenter(edge),point=project(center.x,center.y);if(!pointInViewport(viewport,point,150))return [];
  const [start,end]=wallEdgeEndpoints(edge),a=project(start.x,start.y),b=project(end.x,end.y),id=wallEdgeId(edge),target={...edge,wallEdgeId:id};
  const building=(state.buildings??[]).find((record:any)=>record.id===edge.buildingId),adjacent=wallEdgeCells(edge);
  const disclosed=building?.rooms?.some((room:any)=>revealed.has(room.id)&&room.cells.some((cell:any)=>adjacent.some((at:any)=>at.x===cell.x&&at.y===cell.y))),front=building&&(edge.axis==='x'?edge.y===building.y+building.height:edge.x===building.x+building.width);
  const height=disclosed&&(front||!building)?BUILDING_OPENINGS.cutawayHeight:getBuildingRenderProfile(building,revealed).wallHeight;
  const label=`${edge.type==='door'?'Puerta':edge.type==='window'?'Ventana':'Pared'} entre ${adjacent.map((at:any)=>`${at.x},${at.y}`).join(' y ')}${edge.type==='door'?edge.open?', abierta':', cerrada':''}`;
  return [{key:`edge-control-${id}`,depth:center.x+center.y+.02,node:<g data-wall-edge-control={id} role="button" tabIndex={0} aria-label={label} onClick={()=>onTile(target)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onTile(target);}}} onMouseEnter={()=>onHover(target)} onMouseLeave={()=>onHover(null)} onFocus={()=>onHover(target)} onBlur={()=>onHover(null)}>
   <path d={`M${a.x},${a.y}L${b.x},${b.y}L${b.x},${b.y-height}L${a.x},${a.y-height}Z`} fill="transparent" pointerEvents="all"/>
   {hover?.wallEdgeId===id&&<path d={`M${a.x},${a.y}L${b.x},${b.y}`} fill="none" stroke="#eddda3" strokeWidth="3" pointerEvents="none"/>}
  </g>}];
 });
}
