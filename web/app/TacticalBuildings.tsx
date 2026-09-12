import {buildingStyle} from '../../game/building-types.js';
import {WallDetails,RoofLandmark} from './BuildingDetails';
import type {ReactNode} from 'react';
type Point={x:number;y:number};
type Args={state:any;revealed:Set<string>;project:(x:number,y:number)=>Point;light:(x:number,y:number)=>number};
type SceneObject={key:string;depth:number;node:ReactNode};
// Restrained earth pigments, limewash and hand-fired clay; no modern siding.
const wallInset=.4; // Tile edges are half a cell from the center.
const clay=['#925238','#a45e40','#ad6949','#975337','#b47651','#9f6042'];
const noise=(x:number,y:number)=>((Math.imul(x+71,374761393)^Math.imul(y+97,668265263))>>>0);

/** Render architectural segments on authored collision cells, never a facade image. */
export function buildBuildingObjects({state:s,revealed,project,light}:Args):SceneObject[]{
 const objects:SceneObject[]=[];
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
   const isFront=b&&(axis==='x'?t.y===b.y+b.height-1:t.x===b.x+b.width-1),cut=roomOpen&&isFront,height=cut?9:style.height;
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
   const plaster=b?.material==='stone'?'#b3ac96':style.wall;
   const top=(p:Point,z:number)=>`${p.x},${p.y-z}`;
   objects.push({key:`architecture-${t.x}-${t.y}-${axis}`,depth:t.x+t.y+wallInset+.015,node:<g data-wall-tile={`${t.x},${t.y}`} data-cutaway={Boolean(cut)} pointerEvents="none" style={{filter:`brightness(${light(t.x,t.y)})`}}>
    {/* A shallow wall cap makes thickness readable without a full-tile cube. */}
    <polygon points={`${top(start,height)} ${top(end,height)} ${end.x+4},${end.y-height-2} ${start.x+4},${start.y-height-2}`} fill={cut?'#bda980':'#d2c49e'} stroke="#807459" strokeWidth=".55"/>
    <path d={`M${end.x},${end.y}v-${height}l4,-2v${height}Z`} fill="#8b8163"/>
    <g transform={`matrix(${dx} ${dy} 0 1 ${start.x} ${start.y})`}>
     {!isOpening?<><rect x="0" y={-height} width={width} height={height} fill="url(#terrain-plaster)"/><rect y={-height} width="40" height={height} fill={plaster} opacity=".66"/></>:cut?<>
      {/* Openings stay legible as thresholds and low jambs in the cutaway. */}
      <path d="M0,0V-9H10V0ZM30,0V-9H40V0Z" fill={plaster}/>
      <path d="M10,0H30" stroke="#b9a580" strokeWidth="3"/>
      {t.type==='door'&&!t.open&&<path d="M12,-3H28" stroke="#62452c" strokeWidth="4"/>}
      {t.type==='window'&&<path d="M10,-7H30V0H10Z" fill={plaster}/>}
     </>:<>
      <path d={`M0,0V-${height}H40V0H29V-${t.type==='door'?30:29}H11V0Z`} fill="url(#terrain-plaster)"/>
      {t.type==='window'&&<rect x="10" y="-12" width="20" height="12" fill="url(#terrain-plaster)"/>}
      <rect x="11" y={t.type==='door'?-30:-29} width="18" height={t.type==='door'?30:17} fill="#20251b"/>
      <path d={`M10,0V-32H30V0M8,-33H32`} fill="none" stroke="#e3d5b5" strokeWidth="2.5"/>
      {t.type==='door'?<g transform={t.open?'translate(11 0) skewY(-25) scale(.22 1) translate(-11 0)':undefined}><rect x="12" y="-30" width="16" height="30" fill="url(#terrain-wood)" stroke="#5c4931" strokeWidth=".8"/><path d="M15,-29V-1M20,-29V-1M25,-29V-1M12,-24H28M12,-7H28" stroke="#413725" strokeWidth=".7"/><circle cx="25" cy="-14" r="1" fill="#c1a16a"/></g>:<><path d="M14,-28V-13M18,-28V-13M22,-28V-13M26,-28V-13M12,-24H28M12,-17H28" stroke="#383b30" strokeWidth="1"/><path d="M9,-12H31" stroke="#e3d2a5" strokeWidth="3"/></>}
     </>}
     <WallDetails building={b} front={Boolean(isFront)} cut={Boolean(cut)} opening={isOpening}/>
     {/* Limewash wear is irregular but stable across renders. */}
     {Array.from({length:cut?4:19},(_,i)=>{const n=noise(t.x*43+i,t.y*29+index),x=n%38+1,y=-(n%Math.max(1,height-3)+2);return <path key={i} d={`M${x},${y}h${1+n%3}`} stroke={i%3?'#796d50':'#fff1ce'} opacity={i%3?'.16':'.23'} strokeWidth=".6"/>;})}
     {!cut&&<><path d="M0,-44H40" stroke="#eee0bd" strokeWidth="2"/><path d="M0,-41H40" stroke="#66553e" strokeWidth="2" opacity=".4"/></>}
     {/* Broken plaster and jointed stone footing, deterministic per tile. */}
     {!isOpening&&<><path d={`M${3+seed},-${Math.min(height-2,12)}l3,2 2,-1 2,4 -2,3 -6,-1Z`} fill="#a69570" opacity=".6"/>{height>15&&<path d={`M${27-seed},-34l-2,5 3,3 -1,5`} fill="none" stroke="#867d61" strokeWidth=".55" opacity=".75"/>}</>}
     <path d={isOpening&&t.type==='door'?'M0,-5H10V0H0ZM30,-5H40V0H30Z':'M0,-5H40V0H0Z'} fill="#827b62"/>
     <path d={isOpening?'M5,-5V0M35,-5V0':'M8,-5V0M21,-5V0M34,-5V0'} stroke="#595d4d" strokeWidth=".7"/>
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
  const xs=room.cells.map((p:any)=>p.x),ys=room.cells.map((p:any)=>p.y);
  const left=Math.max(b.x-.18,Math.min(...xs)-1.18),right=Math.min(b.x+b.width-.82,Math.max(...xs)+1.18),top=Math.max(b.y-.18,Math.min(...ys)-1.18),bottom=Math.min(b.y+b.height-.82,Math.max(...ys)+1.18),middle=(left+right)/2;
  const style=buildingStyle(b),flat=b.roof==='terrace',thatch=b.roof==='thatch';
  const rise=flat?0:Math.min(thatch?35:30,(right-left)*7),eave=style.height+1;
  const palette=thatch?['#968053','#a38d5f','#b49b68','#8b784d','#bcaa78','#9d8858']:clay;
  const roof=(x:number,y:number,z:number)=>{const p=project(x+wallInset,y+wallInset);return `${p.x},${p.y-z}`;};
  const tiles:ReactNode[]=[];
  // Map each barrel tile onto its actual roof plane (never a screen-space pattern).
  for(const side of [0,1]){
   const a=side?middle:left,c=side?right:middle;
   const z=(x:number)=>eave+rise*(side?(right-x)/(right-middle):(x-left)/(middle-left));
   const rows=Math.ceil((c-a)*5),columns=Math.ceil((bottom-top)*5);
   for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const x=a+(c-a)*row/rows,x2=a+(c-a)*(row+1)/rows,y=top+(bottom-top)*col/columns,y2=top+(bottom-top)*(col+1)/columns;
    const n=noise(row+b.x*31,col+b.y*17+side);
    tiles.push(<g key={`${side}-${row}-${col}`}>
     <polygon points={`${roof(x,y,z(x))} ${roof(x2,y,z(x2))} ${roof(x2,y2,z(x2))} ${roof(x,y2,z(x))}`} fill={flat?'#aa9671':palette[n%palette.length]} stroke={thatch?'none':'#603e2d'} strokeWidth=".35"/>
     {thatch&&Array.from({length:5},(_,fiber)=>{const fy=y+(y2-y)*fiber/5;return <path key={fiber} d={`M${roof(x,fy,z(x)+.4)}L${roof(x2+.025,fy,z(x2)+.4)}`} stroke={fiber%2?'#d0bb80':'#76643e'} strokeWidth=".55" opacity=".7"/>;})}
     <path d={`M${roof(x,y+.035,z(x)+.3)}L${roof(x2,y+.035,z(x2)+.3)}`} stroke={thatch?'#d0bc84':'#d59a69'} strokeWidth={thatch?1.2:.85} opacity=".6"/>
    </g>);
   }
  }
  objects.push({key:`architecture-roof-${room.id}`,depth:right+bottom+.12,node:<g data-roof-room={room.id} data-roof-material={b.roof} data-building-type={b.architecture??'house'} pointerEvents="none" style={{filter:`brightness(${light(b.x,b.y)})`}}>
   {/* A complete gable closes the old triangular gap above the front wall. */}
   <polygon data-building-gable="true" points={`${roof(left,bottom,eave)} ${roof(middle,bottom,eave+rise)} ${roof(right,bottom,eave)}`} fill="url(#terrain-plaster)" stroke="#8b7856" strokeWidth=".7"/>
   <path d={`M${roof(middle,bottom,eave+9)}v-7`} stroke="#4d4533" strokeWidth="3"/>
   {tiles}
   <polygon points={`${roof(middle,top,eave+rise)} ${roof(right,top,eave)} ${roof(right,bottom,eave)} ${roof(middle,bottom,eave+rise)}`} fill="#27221a" opacity=".16"/>
   <path d={`M${roof(left,bottom,eave)}L${roof(middle,bottom,eave+rise)}L${roof(right,bottom,eave)}`} fill="none" stroke="#513926" strokeWidth="3"/>
   <path d={`M${roof(left,top,eave)}L${roof(left,bottom,eave)}M${roof(right,top,eave)}L${roof(right,bottom,eave)}`} stroke="#663e29" strokeWidth="3"/>
   {!flat&&<path d={`M${roof(middle,top,eave+rise)}L${roof(middle,bottom,eave+rise)}`} stroke={thatch?'#786842':'#cd8a59'} strokeWidth={thatch?6:4}/>}
   {flat&&<path d={`M${roof(left,top,eave+7)}L${roof(right,top,eave+7)}L${roof(right,bottom,eave+7)}L${roof(left,bottom,eave+7)}Z`} fill="none" stroke={style.trim} strokeWidth="7"/>}
   {style.gallery&&<g data-building-gallery="true">
    <polygon points={`${roof(left,bottom,eave-5)} ${roof(right,bottom,eave-5)} ${roof(right,bottom+.55,eave-17)} ${roof(left,bottom+.55,eave-17)}`} fill="#a96f49" stroke="#62482f" strokeWidth="2"/>
    {Array.from({length:b.width},(_,i)=>{const x=left+(right-left)*i/(b.width-1);return <g key={i}><path d={`M${roof(x,bottom+.55,0)}L${roof(x,bottom+.55,eave-17)}`} stroke="#735638" strokeWidth="3"/><path d={`M${roof(x,bottom,eave-5)}L${roof(x,bottom+.55,eave-17)}`} stroke="#d39964" strokeWidth="1.5"/></g>;})}
   </g>}
   <RoofLandmark building={b} project={project} eave={eave}/>
   {Array.from({length:Math.ceil((bottom-top)*5)},(_,i)=>{const y=top+i/5;return <path key={i} d={`M${roof(middle-.06,y,eave+rise-1)}L${roof(middle+.06,y,eave+rise-1)}`} stroke="#72452e" strokeWidth=".8"/>;})}
  </g>});
 }
 return objects;
}
type WallAxis='x'|'y';
