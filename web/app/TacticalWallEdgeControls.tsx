import type {ReactNode} from 'react';
import {canSee} from '../../game/tactical.js';
import {wallEdgeCenter,wallEdgeEndpoints,wallEdgeId,wallEdgeCells} from '../../game/wall-geometry.js';
import {getBuildingProfile,getBuildingRenderProfile} from '../../game/building-profile.js';
import {buildingStyle} from '../../game/building-types.js';
import {BUILDING_OPENINGS} from '../../game/building-scale.js';
import {pointInViewport} from '../../game/tactical-viewport.js';
import {ELEVATION_PIXELS_PER_METRE,projectSurface,surfaceDrawDepth} from '../lib/tactical-elevation';

type Args={state:any;players:any[];revealed:Set<string>;cursorLevel:number;mode:string;interactive:boolean;hover:any;viewport:any;project:(x:number,y:number)=>{x:number;y:number};onTile:(point:any)=>void;onHover:(point:any)=>void;renderer?:'svg'|'three'};
/** Match each renderer's visible wall height, including room cutaways. */
function controlHeight(state:any,edge:any,building:any,base:number,adjacent:any[],known:Set<string>,renderer:'svg'|'three'){
 if(!building)return renderer==='three'?(edge.obstacleHeight??2.5)*ELEVATION_PIXELS_PER_METRE:getBuildingRenderProfile(undefined,known).wallHeight;
 const kind=building.kind??(renderer==='three'?building.architecture:undefined),b={...building,kind:kind==='estancia'?'farmhouse':kind==='mansion'?'palace':kind},legacy=Boolean(building.architecture&&(!building.kind||building.roof==='terrace'));
 const rooms=(b.rooms??[]).filter((room:any)=>renderer==='svg'||!(room.tacticalLevel??room.cells[0]?.tacticalLevel??0)),allOpen=rooms.length>0&&rooms.every((room:any)=>known.has(room.id)),someOpen=rooms.some((room:any)=>known.has(room.id));
 const perimeter=edge.axis==='x'?edge.y===b.y||edge.y===b.y+b.height:edge.x===b.x||edge.x===b.x+b.width,front=edge.axis==='x'?edge.y===b.y+b.height:edge.x===b.x+b.width;
 const roomOpen=allOpen||rooms.some((room:any)=>known.has(room.id)&&room.cells.some((cell:any)=>adjacent.some((at:any)=>at.x===cell.x&&at.y===cell.y)));
 if(roomOpen&&(front||!perimeter))return BUILDING_OPENINGS.cutawayHeight;
 if(renderer==='svg'){const shown=getBuildingRenderProfile(b,known);return legacy?buildingStyle(b).height:perimeter?shown.wallHeight:shown.groundFloorHeight;}
 const profile=getBuildingProfile(b),roofs=(state.upperSurfaces??[]).filter((surface:any)=>surface.kind==='roof'&&surface.buildingId===b.id);
 const fullHeight=roofs.length?Math.min(...roofs.map((surface:any)=>(surface.elevation??3)-base)):Math.max(2.5,(legacy?buildingStyle(b).height:profile.wallHeight)/ELEVATION_PIXELS_PER_METRE),floorHeight=roofs.length?fullHeight:Math.min(fullHeight,Math.max(2.5,profile.groundFloorHeight/ELEVATION_PIXELS_PER_METRE));
 return (perimeter&&!(profile.floors>1&&someOpen)?fullHeight:floorHeight)*ELEVATION_PIXELS_PER_METRE;
}
/** Edge controls have their own target. Both adjacent cell centres remain selectable. */
export function wallEdgeControlObjects({state,players,revealed,cursorLevel,mode,interactive,hover,viewport,project,onTile,onHover,renderer='svg'}:Args):{key:string;depth:number;node:ReactNode}[]{
 if(!interactive||!['move','useItem'].includes(mode))return [];
 const known=new Set(revealed);
 if(cursorLevel){const terraces=new Set((state.upperSurfaces??[]).filter((surface:any)=>surface.kind==='roof'&&(surface.tacticalLevel??0)===cursorLevel).map((surface:any)=>surface.buildingId));for(const building of state.buildings??[])if(terraces.has(building.id))for(const room of building.rooms??[])if(!(room.tacticalLevel??0))known.delete(room.id);}
 return (state.wallEdges??[]).filter((edge:any)=>!edge.destroyed&&(edge.tacticalLevel??0)===cursorLevel&&['wall','door','window'].includes(edge.type)&&players.some(player=>canSee(state,player,edge))).flatMap((edge:any)=>{
  const center=wallEdgeCenter(edge),building=(state.buildings??[]).find((record:any)=>record.id===edge.buildingId);
  // Three uses the authored wall base; SVG artwork uses raw ground projection.
  const base=building?(state.tiles??[]).find((tile:any)=>tile.x===building.x&&tile.y===building.y)?.elevation??0:0,elevation=edge.elevation??base;
  const wallPoint=(point:any)=>renderer==='three'?projectSurface(state,project,{...point,renderedHeight:elevation,renderedOffset:{x:0,y:0,height:0}}):project(point.x,point.y);
  if(!pointInViewport(viewport,wallPoint(center),150))return [];
  const [start,end]=wallEdgeEndpoints(edge),a=wallPoint(start),b=wallPoint(end),id=wallEdgeId(edge),target={...edge,wallEdgeId:id},adjacent=wallEdgeCells(edge);
  const height=controlHeight(state,edge,building,base,adjacent,known,renderer);
  const label=`${edge.type==='door'?'Puerta':edge.type==='window'?'Ventana':'Pared'} entre ${adjacent.map((at:any)=>`${at.x},${at.y}`).join(' y ')}${edge.type==='door'?edge.open?', abierta':', cerrada':''}`;
  return [{key:`edge-control-${id}`,depth:renderer==='three'?surfaceDrawDepth(state,center,.02):center.x+center.y+.02,node:<g data-wall-edge-control={id} role="button" tabIndex={0} aria-label={label} onClick={()=>onTile(target)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onTile(target);}}} onMouseEnter={()=>onHover(target)} onMouseLeave={()=>onHover(null)} onFocus={()=>onHover(target)} onBlur={()=>onHover(null)}>
   <path d={`M${a.x},${a.y}L${b.x},${b.y}L${b.x},${b.y-height}L${a.x},${a.y-height}Z`} fill="transparent" pointerEvents="all"/>
   {hover?.wallEdgeId===id&&<path d={`M${a.x},${a.y}L${b.x},${b.y}`} fill="none" stroke="#eddda3" strokeWidth="3" pointerEvents="none"/>}
  </g>}];
 });
}
