import {sitePath} from '../lib/site-path.js';
import {getBuildingRenderProfile} from '../../game/building-profile.js';
import {buildingAppearance} from '../../game/building-appearance.js';
import {ArchitectureDefs,WallSurface,Opening,WALL_COLOURS} from './TacticalArchitectureMaterials';
import {buildingRoof} from './TacticalRoof';
import {buildingDetails} from './TacticalBuildingDetails';
import {BUILDING_OPENINGS} from '../../game/building-scale.js';
import {BuildingOpening} from './BuildingOpening';
import {pointInViewport,buildingInViewport} from '../../game/tactical-viewport.js';
import {BuildingMaterials} from './BuildingMaterials';
import {buildingStyle} from '../../game/building-types.js';
import {WallDetails} from './BuildingDetails';
import {BuildingRoof} from './BuildingRoof';
import {tacticalLevel} from '../../game/tactical-space.js';
import type {ReactNode} from 'react';
type Point={x:number;y:number};
type Args={viewport?:any;cursorLevel?:number;state:any;revealed:Set<string>;project:(x:number,y:number)=>Point;light:(x:number,y:number,level?:number)=>number};
type SceneObject={key:string;depth:number;node:ReactNode};
// Restrained earth pigments, limewash and hand-fired clay; no modern siding.
// Explicit terraces retain their flat, playable roof geometry. Catalog kinds
// take precedence over legacy style metadata on every other authored shell.
const legacyArchitecture=(b:any)=>Boolean(b?.architecture&&(!b.kind||b.roof==='terrace'));
const wallInset=.4; // Tile edges are half a cell from the center.
const noise=(x:number,y:number)=>((Math.imul(x+71,374761393)^Math.imul(y+97,668265263))>>>0);

/** Render architectural segments on authored collision cells, never a facade image. */
export function buildBuildingObjects(args:Args):SceneObject[]{
 return createBuildingRenderer(args)(args.viewport);
}

// Each renderer belongs to one immutable simulation/visibility/light snapshot.
// Camera changes reuse retained nodes; discarded viewport objects are evicted.
export function createBuildingRenderer({state:s,revealed:knownRooms,project,light,cursorLevel=0}:Omit<Args,'viewport'>){
 const buildings=(s.buildings??[]).map((b:any)=>b.kind==='estancia'?{...b,kind:'farmhouse'}:b.kind==='mansion'?{...b,kind:'palace'}:b),byId=new Map<any,any>(),doorsByBuilding=new Map<any,any[]>();
 const roofSurfaces=new Map<string,any[]>();
 for(const surface of s.upperSurfaces??[])if(surface.kind==='roof'&&surface.buildingId){
  const surfaces=roofSurfaces.get(surface.buildingId)??[];surfaces.push(surface);roofSurfaces.set(surface.buildingId,surfaces);
 }
 const terraceBuildings=new Set((s.upperSurfaces??[]).filter((surface:any)=>surface.kind==='roof'&&tacticalLevel(surface)===cursorLevel).map((surface:any)=>surface.buildingId));
 // Looking at a playable terrace restores its detailed roof. Discovery of the
 // room below remains stored and its cutaway returns with the ground cursor.
 const coveredRooms=new Set(buildings.filter((b:any)=>terraceBuildings.has(b.id)).flatMap((b:any)=>(b.rooms??[]).filter((room:any)=>!tacticalLevel(room)).map((room:any)=>room.id)));
 const revealed=cursorLevel?new Set([...knownRooms].filter(id=>!coveredRooms.has(id))):knownRooms;
 for(const b of buildings)if(!byId.has(b.id))byId.set(b.id,b);
 for(const t of s.tiles)if(t.type==='door'){const doors=doorsByBuilding.get(t.buildingId)??[];doors.push(t);doorsByBuilding.set(t.buildingId,doors);}
 const wallTiles=s.tiles.filter((t:any)=>['wall','door','window'].includes(t.type));
 const occupied=new Set(wallTiles.map((t:any)=>`${t.x},${t.y}`));
 const walls=wallTiles.map((t:any)=>{
  const b=byId.get(t.buildingId),style=buildingStyle(b);
  const corner=b&&(t.x===b.x||t.x===b.x+b.width-1)&&(t.y===b.y||t.y===b.y+b.height-1);
  const junction=(occupied.has(`${t.x-1},${t.y}`)||occupied.has(`${t.x+1},${t.y}`))&&(occupied.has(`${t.x},${t.y-1}`)||occupied.has(`${t.x},${t.y+1}`));
  const roomOpen=(b?.rooms?.length>0&&b.rooms.every((r:any)=>revealed.has(r.id)))||b?.rooms?.some((r:any)=>revealed.has(r.id)&&r.cells.some((c:any)=>corner||junction?Math.abs(c.x-t.x)<=1&&Math.abs(c.y-t.y)<=1:Math.abs(c.x-t.x)+Math.abs(c.y-t.y)===1));
  const onX=b&&(t.x===b.x||t.x===b.x+b.width-1),onY=b&&(t.y===b.y||t.y===b.y+b.height-1);
  const axes:WallAxis[]=b?[...(onX?['y' as const]:[]),...(onY?['x' as const]:[])]:[occupied.has(`${t.x+1},${t.y}`)||occupied.has(`${t.x-1},${t.y}`)?'x':'y'];
  if(!axes.length){if(occupied.has(`${t.x-1},${t.y}`)||occupied.has(`${t.x+1},${t.y}`))axes.push('x');if(occupied.has(`${t.x},${t.y-1}`)||occupied.has(`${t.x},${t.y+1}`))axes.push('y');if(!axes.length)axes.push('x');}
  return {t,b,style,roomOpen,axes,onX,onY};
 });
 const rooms=buildings.flatMap((b:any)=>(b.rooms??[]).map((room:any)=>({b,room,cells:new Set((room.cells??[]).map((c:any)=>`${c.x},${c.y}`))})));
 let retained=new Map<string,SceneObject>();
 return (viewport?:Args['viewport']):SceneObject[]=>{
 const objects:SceneObject[]=[],next=new Map<string,SceneObject>();
 const add=(key:string,create:()=>Omit<SceneObject,'key'>)=>{
  const object=retained.get(key)??{key,...create()};next.set(key,object);objects.push(object);
 };
 add('architecture-materials',()=>({depth:-10001,node:<><BuildingMaterials/><ArchitectureDefs/></>}));
 for(const b of buildings){
  if(!buildingInViewport(viewport,b,project))continue;
  const open=b.rooms?.some((r:any)=>revealed.has(r.id));if(open)continue;
  add(`architecture-shadow-${b.id}`,()=>{
  const corners=[[b.x,b.y],[b.x+b.width-.5,b.y],[b.x+b.width-.5,b.y+b.height-.5],[b.x,b.y+b.height-.5]].map(([x,y])=>project(x,y));
  const offset=(legacyArchitecture(b)?buildingStyle(b).height:getBuildingRenderProfile(b,revealed).wallHeight)*.22,points=[corners[0],corners[1],{x:corners[1].x+offset,y:corners[1].y+offset*.45},{x:corners[2].x+offset,y:corners[2].y+offset*.45},{x:corners[3].x+offset,y:corners[3].y+offset*.45},corners[3]];
  return {depth:-1002,node:<polygon data-building-shadow={b.id} points={points.map(p=>`${p.x},${p.y}`).join(' ')} fill="#131b10" opacity=".23" pointerEvents="none"/>};
  });
 }
 for(const {t,b,style,roomOpen,axes,onX,onY} of walls){
  const profile=getBuildingRenderProfile(b,revealed);
  if(!pointInViewport(viewport,project(t.x,t.y),Math.max(100,legacyArchitecture(b)?style.height:profile.wallHeight)))continue;
  axes.forEach((axis:WallAxis,index:number)=>{
   add(`architecture-${t.x}-${t.y}-${axis}`,()=>{
   const isFront=b&&(axis==='x'?t.y===b.y+b.height-1:t.x===b.x+b.width-1),cut=roomOpen&&(isFront||(!onX&&!onY)),height=cut?BUILDING_OPENINGS.cutawayHeight:legacyArchitecture(b)?style.height:onX||onY?profile.wallHeight:profile.groundFloorHeight;
   // Place each face near its southern tile edge. Clamp corners to the
   // shifted intersection so both wall axes remain joined.
   const along=axis==='x'?t.x:t.y;
   const lower=b?(axis==='x'?b.x:b.y)+wallInset:-Infinity;
   const upper=b?(axis==='x'?b.x+b.width-1:b.y+b.height-1)+wallInset:Infinity;
   const first=Math.max(along-.5,lower),last=Math.min(along+.5,upper);
   const start=axis==='x'?project(first,t.y+wallInset):project(t.x+wallInset,first);
   const end=axis==='x'?project(last,t.y+wallInset):project(t.x+wallInset,last);
   const width=40,dx=(end.x-start.x)/width,dy=(end.y-start.y)/width,seed=(t.x*17+t.y*31)%11;
   const isOpening=t.type!=='wall'&&index===0;
   const textureId=`building-wall-${t.x}-${t.y}-${axis}`,plaster=`url(#${textureId})`;
   const materialName=b?.architecture==='warehouse'?'brick':b?.architecture==='barracks'?'timber':`plaster-${b?.architecture??'house'}`;
   const appearance=buildingAppearance(b),authoredWall=!legacyArchitecture(b)||b.wallFinish!==undefined;
   const openingStyle=t.style??(t.type==='door'?b?.doorStyle:b?.windowStyle)??(authoredWall?(t.type==='door'?appearance.doorStyle:appearance.windowStyle):undefined);
   const palette=WALL_COLOURS[appearance.wallFinish];
   const top=(p:Point,z:number)=>`${p.x},${p.y-z}`;
   return {depth:t.x+t.y+wallInset+.015,node:<g data-wall-tile={`${t.x},${t.y}`} data-cutaway={Boolean(cut)} data-wall-height={height} data-visible-storeys={!cut&&(onX||onY)?legacyArchitecture(b)?(style.upper?2:1):profile.floors:1} pointerEvents="none" style={{filter:`brightness(${light(t.x,t.y)})`}}>
    {legacyArchitecture(b)&&<defs><pattern id={textureId} patternUnits="userSpaceOnUse" width="128" height="128" x={-(t.x*37+t.y*23)%128} y={-(t.y*41+t.x*17)%128}><image href={sitePath(`/art/buildings/${materialName}-v1.webp`)} width="128" height="128" style={{imageRendering:'pixelated'}}/></pattern></defs>}
    {/* A shallow wall cap makes thickness readable without a full-tile cube. */}
    <polygon points={`${top(start,height)} ${top(end,height)} ${end.x+4},${end.y-height-2} ${start.x+4},${start.y-height-2}`} fill={authoredWall?palette.trim:cut?'#bda980':'#d2c49e'} stroke={authoredWall?palette.shadow:'#807459'} strokeWidth=".55"/>
    <path d={`M${end.x},${end.y}v-${height}l4,-2v${height}Z`} fill="#8b8163"/>
    <g transform={`matrix(${dx} ${dy} 0 1 ${start.x} ${start.y})`}>
     {authoredWall?<WallSurface finish={appearance.wallFinish} height={height} x={t.x} y={t.y}/>:isOpening&&!openingStyle?<BuildingOpening tile={t} wallHeight={height} cut={Boolean(cut)} plaster={plaster}/>:<rect x="0" y={-height} width={width} height={height} fill={plaster}/>}
     {isOpening&&openingStyle&&(cut?<g data-opening-height={BUILDING_OPENINGS.cutawayHeight}><path d="M8,0H32" stroke={palette.trim} strokeWidth="3"/>{t.type==='door'&&!t.open&&<path d="M9,-3H31" stroke="#62452c" strokeWidth="4"/>}</g>:<g data-opening-height={legacyArchitecture(b)?BUILDING_OPENINGS.doorHeight:33*Math.min(1.35,profile.groundFloorHeight/46)} transform={`scale(1 ${legacyArchitecture(b)?BUILDING_OPENINGS.doorHeight/33:Math.min(1.35,profile.groundFloorHeight/46)})`}><Opening type={t.type} style={openingStyle} open={t.open} trim={palette.trim}/></g>)}
     {legacyArchitecture(b)&&<WallDetails building={b} front={Boolean(isFront&&axis==='x')} cut={Boolean(cut)} opening={isOpening}/> }
     <rect y={-height} width="40" height={height} fill="url(#building-wall-age)"/>
     {/* Limewash wear is irregular but stable across renders. */}
     {[false,true].map(highlight=><path key={String(highlight)} d={Array.from({length:cut?4:Math.round(height*.42)},(_,i)=>{if((i%3===0)!==highlight)return '';const n=noise(t.x*43+i,t.y*29+index),x=n%38+1,y=-(n%Math.max(1,height-3)+2);return `M${x},${y}h${1+n%3}`;}).join('')} stroke={highlight?'#fff1ce':'#796d50'} opacity={highlight?'.23':'.16'} strokeWidth=".6"/>)}
     {!cut&&<><path d={`M0,-${height-2}H40`} stroke={authoredWall?palette.trim:style.trim} strokeWidth="2"/><path d={`M0,-${height-5}H40`} stroke="#66553e" strokeWidth="2" opacity=".4"/></>}
     {/* Broken plaster and jointed stone footing, deterministic per tile. */}
     {!isOpening&&<><path d={`M${3+seed},-${Math.min(height-2,12)}l3,2 2,-1 2,4 -2,3 -6,-1Z`} fill="#a69570" opacity=".6"/>{height>15&&legacyArchitecture(b)&&b?.architecture==='farmhouse'&&<path d={`M${27-seed},-34l-2,5 3,3 -1,5`} fill="none" stroke="#867d61" strokeWidth=".55" opacity=".75"/>}</>}
     <path d={isOpening&&t.type==='door'?'M0,-5H8V0H0ZM32,-5H40V0H32Z':'M0,-5H40V0H0Z'} fill="#827b62"/>
     <path d={isOpening?'M5,-5V0M35,-5V0':'M8,-5V0M21,-5V0M34,-5V0'} stroke="#595d4d" strokeWidth=".7"/>
     {!isOpening&&<path d={`M0,-${height}H40`} stroke={cut?'#f0dcb0':'#ded0ac'} strokeWidth={cut?2:1}/>}
     {axis==='y'&&<path d={isOpening?`M0,0V-${height}H8V0ZM32,0V-${height}H40V0Z`:`M0,0V-${height}H40V0Z`} fill="#292c22" opacity=".14"/>}
    </g>
   </g>};
   });
  });
 }
 for(const {b,room,cells} of rooms){
  if(!room.cells?.length||!buildingInViewport(viewport,b,project))continue;
  if(revealed.has(room.id)){
   // Floor joints follow world coordinates, with perimeter wear and wall shadows.
   // Draw below actors and walls; all decoration remains click-through.
   for(const c of room.cells){
    if(!pointInViewport(viewport,project(c.x,c.y),40))continue;
    add(`architecture-floor-${room.id}-${c.x}-${c.y}`,()=>{
    const point=(x:number,y:number)=>{const p=project(x,y);return `${p.x},${p.y}`;};
    // Perimeter walls are drawn inside their structural cells. Extend only
    // adjacent floor edges to that wall plane, covering the underlying grass.
    const x0=c.x===b.x+1?b.x+wallInset:c.x-.5,x1=c.x===b.x+b.width-2?b.x+b.width-1+wallInset:c.x+.5;
    const y0=c.y===b.y+1?b.y+wallInset:c.y-.5,y1=c.y===b.y+b.height-2?b.y+b.height-1+wallInset:c.y+.5;
    const joints:string[]=[];
    for(let row=0;row<4;row++){
     const y=c.y-.5+row/4;
     joints.push(`M${point(c.x-.5,y)}L${point(c.x+.5,y)}`);
     for(let col=0;col<2;col++){
      const x=c.x-.5+(col+(row%2?.5:0))/2;
      joints.push(`M${point(x,y)}L${point(x,y+.25)}`);
     }
    }
    return {depth:-1000,node:<g data-building-floor={room.id} pointerEvents="none" style={{filter:`brightness(${light(c.x,c.y)})`}}>
     <polygon data-floor-surface="true" points={[point(x0,y0),point(x1,y0),point(x1,y1),point(x0,y1)].join(' ')} fill="url(#terrain-floor)"/>
     <path d={joints.join('')} fill="none" stroke="#514332" strokeWidth=".65" opacity=".36"/>
     {!cells.has(`${c.x-1},${c.y}`)&&<polygon points={[point(x0,y0),point(x0+.22,y0),point(x0+.22,y1),point(x0,y1)].join(' ')} fill="#332d20" opacity=".2"/>}
     {!cells.has(`${c.x},${c.y-1}`)&&<polygon points={[point(x0,y0),point(x1,y0),point(x1,y0+.2),point(x0,y0+.2)].join(' ')} fill="#332d20" opacity=".2"/>}
    </g>};
    });
   }
   continue;
  }
  if(!legacyArchitecture(b))continue;
  add(`architecture-roof-${room.id}`,()=>{
  const xs=room.cells.map((p:any)=>p.x),ys=room.cells.map((p:any)=>p.y);
  const left=Math.max(b.x-.18,Math.min(...xs)-1.18),right=Math.min(b.x+b.width-.82,Math.max(...xs)+1.18),top=Math.max(b.y-.18,Math.min(...ys)-1.18),bottom=Math.min(b.y+b.height-.82,Math.max(...ys)+1.18);
  // The detailed roof is one mesh. Sample its supported upper cells rather
  // than borrowing downstairs light, which must stop at the floor slab.
  const surfaces=roofSurfaces.get(b.id),brightness=surfaces?.length?surfaces.reduce((sum,p)=>sum+light(p.x,p.y,tacticalLevel(p)),0)/surfaces.length:light(b.x,b.y);
  return {depth:right+bottom+.12,node:<g data-roof-room={room.id} data-roof-material={b.roof} data-building-type={b.architecture??'house'} data-roof-finish={b.roofFinish} pointerEvents="none" style={{filter:`brightness(${brightness})`}}>
   <BuildingRoof building={b} left={left} right={right} top={top} bottom={bottom} doors={doorsByBuilding.get(b.id)??[]} project={project}/>
  </g>};
  });
 }
 // Campaign shells and editor templates use the same catalog massing,
 // rotated entrance details and roof clipping on the authored wall planes.
 const insetProject=(x:number,y:number)=>project(x+wallInset,y+wallInset);
 for(const b of buildings){
  if(legacyArchitecture(b)||!buildingInViewport(viewport,b,project))continue;
  const hidden=b.rooms?.find((r:any)=>r.cells?.length&&!revealed.has(r.id));
  if(hidden)add(`architecture-roof-${hidden.id}`,()=>{
   const roof=buildingRoof(b,revealed,insetProject,light(b.x,b.y))[0];
   return {depth:roof.depth,node:roof.node};
  });
  if(b.kind&&!b.rooms?.some((r:any)=>revealed.has(r.id))){
   // A group can contain front and back volumes with distinct painter depths.
   // Keep both objects rather than collapsing them onto the foreground.
   const oldFront=retained.get(`architecture-detail-${b.id}`),oldBack=retained.get(`architecture-detail-back-${b.id}`);
   if(oldFront){
    if(oldBack)add(oldBack.key,()=>oldBack);
    add(oldFront.key,()=>oldFront);
    continue;
   }
   const details=buildingDetails(b,revealed,insetProject);
   for(const detail of details)add(detail.key,()=>({depth:detail.depth,node:<g style={{filter:`brightness(${light(b.x,b.y)})`}}>{detail.node}</g>}));
  }
 }
 retained=next;
 return objects;
 };
}
type WallAxis='x'|'y';
