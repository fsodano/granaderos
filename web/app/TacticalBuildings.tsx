import {BUILDING_OPENINGS} from '../../game/building-scale.js';
import {BuildingOpening} from './BuildingOpening';
import {BuildingMaterials} from './BuildingMaterials';
import {buildingStyle} from '../../game/building-types.js';
import {WallDetails} from './BuildingDetails';
import {BuildingRoof} from './BuildingRoof';
import type {ReactNode} from 'react';
type Point={x:number;y:number};
type Args={state:any;revealed:Set<string>;project:(x:number,y:number)=>Point;light:(x:number,y:number)=>number};
type SceneObject={key:string;depth:number;node:ReactNode};
// Restrained earth pigments, limewash and hand-fired clay; no modern siding.
const wallInset=.4; // Tile edges are half a cell from the center.
const noise=(x:number,y:number)=>((Math.imul(x+71,374761393)^Math.imul(y+97,668265263))>>>0);

/** Render architectural segments on authored collision cells, never a facade image. */
export function buildBuildingObjects({state:s,revealed,project,light}:Args):SceneObject[]{
 const objects:SceneObject[]=[{key:'architecture-materials',depth:-10001,node:<BuildingMaterials/>}];
 for(const b of s.buildings??[]){
  const open=b.rooms?.some((r:any)=>revealed.has(r.id));if(open)continue;
  const corners=[[b.x,b.y],[b.x+b.width-.5,b.y],[b.x+b.width-.5,b.y+b.height-.5],[b.x,b.y+b.height-.5]].map(([x,y])=>project(x,y));
  const offset=buildingStyle(b).height*.22,points=[corners[0],corners[1],{x:corners[1].x+offset,y:corners[1].y+offset*.45},{x:corners[2].x+offset,y:corners[2].y+offset*.45},{x:corners[3].x+offset,y:corners[3].y+offset*.45},corners[3]];
  objects.push({key:`architecture-shadow-${b.id}`,depth:-1002,node:<polygon data-building-shadow={b.id} points={points.map(p=>`${p.x},${p.y}`).join(' ')} fill="#131b10" opacity=".23" pointerEvents="none"/>});
 }
 const wallTiles=s.tiles.filter((t:any)=>['wall','door','window'].includes(t.type));
 const occupied=new Set(wallTiles.map((t:any)=>`${t.x},${t.y}`));
 for(const t of wallTiles){
  const b=s.buildings?.find((v:any)=>v.id===t.buildingId),style=buildingStyle(b);
  const corner=b&&(t.x===b.x||t.x===b.x+b.width-1)&&(t.y===b.y||t.y===b.y+b.height-1);
  const roomOpen=b?.rooms.some((r:any)=>revealed.has(r.id)&&r.cells.some((c:any)=>corner?Math.abs(c.x-t.x)<=1&&Math.abs(c.y-t.y)<=1:Math.abs(c.x-t.x)+Math.abs(c.y-t.y)===1));
  const onX=b&&(t.x===b.x||t.x===b.x+b.width-1),onY=b&&(t.y===b.y||t.y===b.y+b.height-1);
  const axes:WallAxis[]=b?[...(onX?['y' as const]:[]),...(onY?['x' as const]:[])]:[occupied.has(`${t.x+1},${t.y}`)||occupied.has(`${t.x-1},${t.y}`)?'x':'y'];
  if(!axes.length)axes.push('x');
  axes.forEach((axis,index)=>{
   const isFront=b&&(axis==='x'?t.y===b.y+b.height-1:t.x===b.x+b.width-1),cut=roomOpen&&isFront,height=cut?BUILDING_OPENINGS.cutawayHeight:style.height;
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
   const top=(p:Point,z:number)=>`${p.x},${p.y-z}`;
   objects.push({key:`architecture-${t.x}-${t.y}-${axis}`,depth:t.x+t.y+wallInset+.015,node:<g data-wall-tile={`${t.x},${t.y}`} data-cutaway={Boolean(cut)} pointerEvents="none" style={{filter:`brightness(${light(t.x,t.y)})`}}>
    <defs><pattern id={textureId} patternUnits="userSpaceOnUse" width="128" height="128" x={-(t.x*37+t.y*23)%128} y={-(t.y*41+t.x*17)%128}><image href={`/art/buildings/${materialName}-v1.webp`} width="128" height="128" style={{imageRendering:'pixelated'}}/></pattern></defs>
    {/* A shallow wall cap makes thickness readable without a full-tile cube. */}
    <polygon points={`${top(start,height)} ${top(end,height)} ${end.x+4},${end.y-height-2} ${start.x+4},${start.y-height-2}`} fill={cut?'#bda980':'#d2c49e'} stroke="#807459" strokeWidth=".55"/>
    <path d={`M${end.x},${end.y}v-${height}l4,-2v${height}Z`} fill="#8b8163"/>
    <g transform={`matrix(${dx} ${dy} 0 1 ${start.x} ${start.y})`}>
     {isOpening?<BuildingOpening tile={t} wallHeight={height} cut={Boolean(cut)} plaster={plaster}/>:<rect x="0" y={-height} width={width} height={height} fill={plaster}/>}
     <WallDetails building={b} front={Boolean(isFront&&axis==='x')} cut={Boolean(cut)} opening={isOpening}/>
     <rect y={-height} width="40" height={height} fill="url(#building-wall-age)"/>
     {/* Limewash wear is irregular but stable across renders. */}
     {Array.from({length:cut?4:Math.round(height*.42)},(_,i)=>{const n=noise(t.x*43+i,t.y*29+index),x=n%38+1,y=-(n%Math.max(1,height-3)+2);return <path key={i} d={`M${x},${y}h${1+n%3}`} stroke={i%3?'#796d50':'#fff1ce'} opacity={i%3?'.16':'.23'} strokeWidth=".6"/>;})}
     {!cut&&<><path d={`M0,-${height-2}H40`} stroke={style.trim} strokeWidth="2"/><path d={`M0,-${height-5}H40`} stroke="#66553e" strokeWidth="2" opacity=".4"/></>}
     {/* Broken plaster and jointed stone footing, deterministic per tile. */}
     {!isOpening&&<><path d={`M${3+seed},-${Math.min(height-2,12)}l3,2 2,-1 2,4 -2,3 -6,-1Z`} fill="#a69570" opacity=".6"/>{height>15&&b?.architecture==='farmhouse'&&<path d={`M${27-seed},-34l-2,5 3,3 -1,5`} fill="none" stroke="#867d61" strokeWidth=".55" opacity=".75"/>}</>}
     <path d={isOpening&&t.type==='door'?'M0,-5H8V0H0ZM32,-5H40V0H32Z':'M0,-5H40V0H0Z'} fill="#827b62"/>
     <path d={isOpening?'M5,-5V0M35,-5V0':'M8,-5V0M21,-5V0M34,-5V0'} stroke="#595d4d" strokeWidth=".7"/>
     {!isOpening&&<path d={`M0,-${height}H40`} stroke={cut?'#f0dcb0':'#ded0ac'} strokeWidth={cut?2:1}/>}
     {axis==='y'&&<path d={isOpening?`M0,0V-${height}H8V0ZM32,0V-${height}H40V0Z`:`M0,0V-${height}H40V0Z`} fill="#292c22" opacity=".14"/>}
    </g>
   </g>});
  });
 }
 for(const b of s.buildings??[])for(const room of b.rooms??[]){
  if(!room.cells?.length)continue;
  if(revealed.has(room.id)){
   // Floor joints follow world coordinates, with perimeter wear and wall shadows.
   // Draw below actors and walls; all decoration remains click-through.
   const cells=new Set(room.cells.map((c:any)=>`${c.x},${c.y}`));
   for(const c of room.cells){
    const point=(x:number,y:number)=>{const p=project(x,y);return `${p.x},${p.y}`;};
    // Perimeter walls are drawn inside their structural cells. Extend only
    // adjacent floor edges to that wall plane, covering the underlying grass.
    const x0=c.x===b.x+1?b.x+wallInset:c.x-.5,x1=c.x===b.x+b.width-2?b.x+b.width-1+wallInset:c.x+.5;
    const y0=c.y===b.y+1?b.y+wallInset:c.y-.5,y1=c.y===b.y+b.height-2?b.y+b.height-1+wallInset:c.y+.5;
    const joints:ReactNode[]=[];
    for(let row=0;row<4;row++){
     const y=c.y-.5+row/4;
     joints.push(<path key={`row-${row}`} d={`M${point(c.x-.5,y)}L${point(c.x+.5,y)}`} />);
     for(let col=0;col<2;col++){
      const x=c.x-.5+(col+(row%2?.5:0))/2;
      joints.push(<path key={`${row}-${col}`} d={`M${point(x,y)}L${point(x,y+.25)}`} />);
     }
    }
    objects.push({key:`architecture-floor-${room.id}-${c.x}-${c.y}`,depth:-1000,node:<g data-building-floor={room.id} pointerEvents="none" style={{filter:`brightness(${light(c.x,c.y)})`}}>
     <polygon data-floor-surface="true" points={[point(x0,y0),point(x1,y0),point(x1,y1),point(x0,y1)].join(' ')} fill="url(#terrain-floor)"/>
     <g stroke="#514332" strokeWidth=".65" opacity=".36">{joints}</g>
     {!cells.has(`${c.x-1},${c.y}`)&&<polygon points={[point(x0,y0),point(x0+.22,y0),point(x0+.22,y1),point(x0,y1)].join(' ')} fill="#332d20" opacity=".2"/>}
     {!cells.has(`${c.x},${c.y-1}`)&&<polygon points={[point(x0,y0),point(x1,y0),point(x1,y0+.2),point(x0,y0+.2)].join(' ')} fill="#332d20" opacity=".2"/>}
    </g>});
   }
   continue;
  }
  const xs=room.cells.map((p:any)=>p.x),ys=room.cells.map((p:any)=>p.y);
  const left=Math.max(b.x-.18,Math.min(...xs)-1.18),right=Math.min(b.x+b.width-.82,Math.max(...xs)+1.18),top=Math.max(b.y-.18,Math.min(...ys)-1.18),bottom=Math.min(b.y+b.height-.82,Math.max(...ys)+1.18);
  objects.push({key:`architecture-roof-${room.id}`,depth:right+bottom+.12,node:<g data-roof-room={room.id} data-roof-material={b.roof} data-building-type={b.architecture??'house'} pointerEvents="none" style={{filter:`brightness(${light(b.x,b.y)})`}}>
   <BuildingRoof building={b} left={left} right={right} top={top} bottom={bottom} doors={s.tiles.filter((t:any)=>t.buildingId===b.id&&t.type==='door')} project={project}/>
  </g>});
 }
 return objects;
}
type WallAxis='x'|'y';
