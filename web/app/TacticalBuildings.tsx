import {getBuildingProfile,getBuildingRenderProfile} from '../../game/building-profile.js';
import {buildingRoof} from './TacticalRoof';
import {buildingAppearance} from '../../game/building-appearance.js';
import {WallSurface,Opening,WALL_COLOURS} from './TacticalArchitectureMaterials';
import {buildingDetails} from './TacticalBuildingDetails';
import type {ReactNode} from 'react';
type Point={x:number;y:number};
type Args={state:any;revealed:Set<string>;project:(x:number,y:number)=>Point;light:(x:number,y:number)=>number};
type SceneObject={key:string;depth:number;node:ReactNode};

/** Render architectural segments on authored collision cells, never a facade image. */
export function buildBuildingObjects({state:s,revealed,project,light}:Args):SceneObject[]{
 const objects:SceneObject[]=[];
 for(const b of s.buildings??[]){
  const h=getBuildingProfile(b).wallHeight,points=[[b.x,b.y],[b.x+b.width-1,b.y],[b.x+b.width-1,b.y+b.height-1],[b.x,b.y+b.height-1]].map(([x,y])=>project(x,y));
  objects.push({key:`architecture-shadow-${b.id}`,depth:-1100,node:<g pointerEvents="none"><polygon points={points.map(p=>`${p.x+h*.35},${p.y+h*.19}`).join(' ')} fill="#231f12" opacity=".24"/><polygon points={points.map(p=>`${p.x+6},${p.y+4}`).join(' ')} fill="#211e13" opacity=".24"/></g>});
 }
 const wallTiles=s.tiles.filter((t:any)=>['wall','door','window'].includes(t.type));
 const occupied=new Set(wallTiles.map((t:any)=>`${t.x},${t.y}`));
 for(const t of wallTiles){
  const b=s.buildings?.find((v:any)=>v.id===t.buildingId);
  const corner=b&&(t.x===b.x||t.x===b.x+b.width-1)&&(t.y===b.y||t.y===b.y+b.height-1);
  // At a wall junction, the joining segments can occupy both cardinal neighbours.
  // Its room then touches the junction diagonally and must still lower the cap.
  const junction=(occupied.has(`${t.x-1},${t.y}`)||occupied.has(`${t.x+1},${t.y}`))&&(occupied.has(`${t.x},${t.y-1}`)||occupied.has(`${t.x},${t.y+1}`));
  // Complete revelation also lowers solid reserved corners without a floor neighbour.
  const roomOpen=(b?.rooms.length>0&&b.rooms.every((r:any)=>revealed.has(r.id)))||b?.rooms.some((r:any)=>revealed.has(r.id)&&r.cells.some((c:any)=>corner||junction?Math.abs(c.x-t.x)<=1&&Math.abs(c.y-t.y)<=1:Math.abs(c.x-t.x)+Math.abs(c.y-t.y)===1));
  const onX=b&&(t.x===b.x||t.x===b.x+b.width-1),onY=b&&(t.y===b.y||t.y===b.y+b.height-1);
  const axes:WallAxis[]=b?[...(onX?['y' as const]:[]),...(onY?['x' as const]:[])]:[occupied.has(`${t.x+1},${t.y}`)||occupied.has(`${t.x-1},${t.y}`)?'x':'y'];
  if(!axes.length){if(occupied.has(`${t.x-1},${t.y}`)||occupied.has(`${t.x+1},${t.y}`))axes.push('x');if(occupied.has(`${t.x},${t.y-1}`)||occupied.has(`${t.x},${t.y+1}`))axes.push('y');if(!axes.length)axes.push('x');}
  axes.forEach((axis,index)=>{
   // Revealed partitions lower from either room; the back exterior walls stay full height.
   const canCutAway=b&&((!onX&&!onY)||(axis==='x'?t.y===b.y+b.height-1:t.x===b.x+b.width-1)),cut=roomOpen&&canCutAway,profile=getBuildingRenderProfile(b,revealed),height=cut?9:onX||onY?profile.wallHeight:profile.groundFloorHeight;
   // Corner cells terminate at the wall intersection; extending both axes
   // by half a tile produced four projecting wings outside every building.
   const start=project(t.x-(axis==='x'&&(!b||t.x>b.x)?.5:0),t.y-(axis==='y'&&(!b||t.y>b.y)?.5:0)),end=project(t.x+(axis==='x'&&(!b||t.x<b.x+b.width-1)?.5:0),t.y+(axis==='y'&&(!b||t.y<b.y+b.height-1)?.5:0));
   const width=40,dx=(end.x-start.x)/width,dy=(end.y-start.y)/width;
   const isOpening=t.type!=='wall'&&index===0;
   const appearance=buildingAppearance(b);
   const palette=WALL_COLOURS[appearance.wallFinish];
   const top=(p:Point,z:number)=>`${p.x},${p.y-z}`;
   objects.push({key:`architecture-${t.x}-${t.y}-${axis}`,depth:t.x+t.y+.015,node:<g data-wall-tile={`${t.x},${t.y}`} data-cutaway={Boolean(cut)} data-wall-height={height} data-visible-storeys={!cut&&(onX||onY)?profile.floors:1} pointerEvents="none" style={{filter:`brightness(${light(t.x,t.y)})`}}>
    {/* A shallow wall cap makes thickness readable without a full-tile cube. */}
    <polygon points={`${top(start,height)} ${top(end,height)} ${end.x+4},${end.y-height-2} ${start.x+4},${start.y-height-2}`} fill={palette.trim} stroke={palette.shadow} strokeWidth=".55"/>
    {corner&&<path d={`M${end.x},${end.y}v-${height}l4,-2v${height}Z`} fill={palette.shadow}/>}
    <g transform={`matrix(${dx} ${dy} 0 1 ${start.x} ${start.y})`}>
     <WallSurface finish={appearance.wallFinish} height={height} x={t.x} y={t.y}/>
     <g><path d={`M0,-${Math.min(height,profile.plinthHeight)}H40V0H0Z`} fill="url(#architecture-stone)"/><path d={`M0,-${Math.min(height,profile.plinthHeight)}H40`} stroke={palette.trim} strokeWidth="1" opacity=".6"/></g>
     {isOpening&&(cut?<><path d="M10,0H30" stroke={palette.trim} strokeWidth="3"/>{t.type==='door'&&!t.open&&<path d="M12,-3H28" stroke="#62452c" strokeWidth="4"/>}</>:<g transform={`scale(1 ${Math.min(1.35,profile.groundFloorHeight/46)})`}><Opening type={t.type} style={t.style??(t.type==='door'?appearance.doorStyle:appearance.windowStyle)} open={t.open} trim={palette.trim}/></g>)}
     {!cut&&<><path d={`M0,-${height-2}H40`} stroke={palette.trim} strokeWidth="2"/><path d={`M0,-${height-5}H40`} stroke={palette.shadow} strokeWidth="1" opacity=".25"/></>}
     {!isOpening&&<path d={`M0,-${height}H40`} stroke={cut?'#f0dcb0':'#ded0ac'} strokeWidth={cut?2:1}/>}
     {axis==='y'&&<path d={isOpening?`M0,0V-${height}H10V0ZM30,0V-${height}H40V0Z`:`M0,0V-${height}H40V0Z`} fill="#292c22" opacity=".14"/>}
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
     <g stroke="#514332" strokeWidth=".65" opacity=".36">{joints}</g>
     {!cells.has(`${c.x-1},${c.y}`)&&<polygon points={[point(c.x-.5,c.y-.5),point(c.x-.28,c.y-.5),point(c.x-.28,c.y+.5),point(c.x-.5,c.y+.5)].join(' ')} fill="#332d20" opacity=".2"/>}
     {!cells.has(`${c.x},${c.y-1}`)&&<polygon points={[point(c.x-.5,c.y-.5),point(c.x+.5,c.y-.5),point(c.x+.5,c.y-.3),point(c.x-.5,c.y-.3)].join(' ')} fill="#332d20" opacity=".2"/>}
    </g>});
   }
   continue;
  }
 }
 for(const b of s.buildings??[])objects.push(...buildingRoof(b,revealed,project,light(b.x,b.y)));
 for(const b of s.buildings??[])objects.push(...buildingDetails(b,revealed,project).map(o=>({...o,node:<g style={{filter:`brightness(${light(b.x,b.y)})`}}>{o.node}</g>})));
 return objects;
}
type WallAxis='x'|'y';
