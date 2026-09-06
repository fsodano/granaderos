import {buildingAppearance} from '../../game/building-appearance.js';
import {WallSurface,Opening,WALL_COLOURS} from './TacticalArchitectureMaterials';
import {buildingDetails} from './TacticalBuildingDetails';
import type {ReactNode} from 'react';
type Point={x:number;y:number};
type Args={state:any;revealed:Set<string>;project:(x:number,y:number)=>Point;light:(x:number,y:number)=>number};
type SceneObject={key:string;depth:number;node:ReactNode};
// Restrained earth pigments, limewash and hand-fired clay; no modern siding.
const clay=['#925238','#a45e40','#ad6949','#975337','#b47651','#9f6042'];
const noise=(x:number,y:number)=>((Math.imul(x+71,374761393)^Math.imul(y+97,668265263))>>>0);

/** Render architectural segments on authored collision cells, never a facade image. */
export function buildBuildingObjects({state:s,revealed,project,light}:Args):SceneObject[]{
 const objects:SceneObject[]=[];
 const wallTiles=s.tiles.filter((t:any)=>['wall','door','window'].includes(t.type));
 const occupied=new Set(wallTiles.map((t:any)=>`${t.x},${t.y}`));
 for(const t of wallTiles){
  const b=s.buildings?.find((v:any)=>v.id===t.buildingId);
  const corner=b&&(t.x===b.x||t.x===b.x+b.width-1)&&(t.y===b.y||t.y===b.y+b.height-1);
  const roomOpen=b?.rooms.some((r:any)=>revealed.has(r.id)&&r.cells.some((c:any)=>corner?Math.abs(c.x-t.x)<=1&&Math.abs(c.y-t.y)<=1:Math.abs(c.x-t.x)+Math.abs(c.y-t.y)===1));
  const onX=b&&(t.x===b.x||t.x===b.x+b.width-1),onY=b&&(t.y===b.y||t.y===b.y+b.height-1);
  const axes:WallAxis[]=b?[...(onX?['y' as const]:[]),...(onY?['x' as const]:[])]:[occupied.has(`${t.x+1},${t.y}`)||occupied.has(`${t.x-1},${t.y}`)?'x':'y'];
  if(!axes.length){if(occupied.has(`${t.x-1},${t.y}`)||occupied.has(`${t.x+1},${t.y}`))axes.push('x');if(occupied.has(`${t.x},${t.y-1}`)||occupied.has(`${t.x},${t.y+1}`))axes.push('y');if(!axes.length)axes.push('x');}
  axes.forEach((axis,index)=>{
   const isFront=b&&(axis==='x'?t.y===b.y+b.height-1:t.x===b.x+b.width-1),cut=roomOpen&&isFront,height=cut?9:46;
   // Corner cells terminate at the wall intersection; extending both axes
   // by half a tile produced four projecting wings outside every building.
   const start=project(t.x-(axis==='x'&&(!b||t.x>b.x)?.5:0),t.y-(axis==='y'&&(!b||t.y>b.y)?.5:0)),end=project(t.x+(axis==='x'&&(!b||t.x<b.x+b.width-1)?.5:0),t.y+(axis==='y'&&(!b||t.y<b.y+b.height-1)?.5:0));
   const width=40,dx=(end.x-start.x)/width,dy=(end.y-start.y)/width,seed=(t.x*17+t.y*31)%11;
   const isOpening=t.type!=='wall'&&index===0;
   const appearance=buildingAppearance(b);
   const palette=WALL_COLOURS[appearance.wallFinish];
   const plaster=palette.base;
   const top=(p:Point,z:number)=>`${p.x},${p.y-z}`;
   objects.push({key:`architecture-${t.x}-${t.y}-${axis}`,depth:t.x+t.y+.015,node:<g data-wall-tile={`${t.x},${t.y}`} data-cutaway={Boolean(cut)} pointerEvents="none" style={{filter:`brightness(${light(t.x,t.y)})`}}>
    {/* A shallow wall cap makes thickness readable without a full-tile cube. */}
    <polygon points={`${top(start,height)} ${top(end,height)} ${end.x+4},${end.y-height-2} ${start.x+4},${start.y-height-2}`} fill={palette.trim} stroke={palette.shadow} strokeWidth=".55"/>
    {corner&&<path d={`M${end.x},${end.y}v-${height}l4,-2v${height}Z`} fill={palette.shadow}/>}
    <g transform={`matrix(${dx} ${dy} 0 1 ${start.x} ${start.y})`}>
     <WallSurface finish={appearance.wallFinish} height={height} x={t.x} y={t.y}/>
     {isOpening&&(cut?<><path d="M10,0H30" stroke={palette.trim} strokeWidth="3"/>{t.type==='door'&&!t.open&&<path d="M12,-3H28" stroke="#62452c" strokeWidth="4"/>}</>:<Opening type={t.type} style={t.style??(t.type==='door'?appearance.doorStyle:appearance.windowStyle)} open={t.open} trim={palette.trim}/>)}
     {!cut&&<><path d="M0,-44H40" stroke={palette.trim} strokeWidth="2"/><path d="M0,-41H40" stroke={palette.shadow} strokeWidth="1" opacity=".25"/></>}
     <path d={isOpening&&t.type==='door'?'M0,-5H10V0H0ZM30,-5H40V0H30Z':'M0,-5H40V0H0Z'} fill={palette.shadow}/>
     <path d={isOpening?'M5,-5V0M35,-5V0':'M8,-5V0M21,-5V0M34,-5V0'} stroke={palette.base} strokeWidth=".7"/>
     {!isOpening&&<path d={`M0,-${height}H40`} stroke={cut?'#f0dcb0':'#ded0ac'} strokeWidth={cut?2:1}/>}
     {axis==='y'&&<path d={isOpening?`M0,0V-${height}H10V0ZM30,0V-${height}H40V0Z`:`M0,0V-${height}H40V0Z`} fill="#292c22" opacity=".14"/>}
    </g>
   </g>});
  });
 }
 for(const b of s.buildings??[])for(const room of ((b.rooms??[]).length>1&&b.rooms.every((r:any)=>!revealed.has(r.id))?[{...b.rooms[0],cells:b.rooms.flatMap((r:any)=>r.cells)}]:b.rooms??[])){
  const appearance=buildingAppearance(b),palette=WALL_COLOURS[appearance.wallFinish];
  const roofPalette=appearance.roofFinish==='aged'?['#756a56','#80735c','#8a795f','#796d58']:clay;
  const straw=appearance.roofFinish==='thatch';
  const wholeRoof=b.rooms.every((r:any)=>!revealed.has(r.id));
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
  const left=b.x-.18,right=b.x+b.width-.82,top=b.y-.18,bottom=b.y+b.height-.82,middle=(left+right)/2;
  const rise=Math.min(straw?35:30,(right-left)*7),eave=47;
  const roof=(x:number,y:number,z:number)=>{const p=project(x,y);return `${p.x},${p.y-z}`;};
  const heightAt=(x:number)=>eave+rise*(x<=middle?(x-left)/(middle-left):(right-x)/(right-middle));
  const clipId=`roof-${Array.from(String(room.id)).map(c=>c.codePointAt(0)?.toString(16)).join('-')}`;
  const roofCells:ReactNode[]=[];
  if(!wholeRoof){
   const floors=b.rooms.flatMap((r:any)=>r.cells.map((c:any)=>({...c,roomId:r.id})));
   for(let y=b.y;y<b.y+b.height;y++)for(let x=b.x;x<b.x+b.width;x++){
    const owner=floors.reduce((best:any,c:any)=>!best||Math.abs(c.x-x)+Math.abs(c.y-y)<Math.abs(best.x-x)+Math.abs(best.y-y)?c:best,null);
    if(owner?.roomId!==room.id)continue;
    const x0=Math.max(left,x-.5),x1=Math.min(right,x+.5),y0=Math.max(top,y-.5),y1=Math.min(bottom,y+.5);
    for(const [a,c] of [[x0,Math.min(middle,x1)],[Math.max(middle,x0),x1]])if(c>a)roofCells.push(<polygon key={`${x}-${y}-${a}`} points={`${roof(a,y0,heightAt(a))} ${roof(c,y0,heightAt(c))} ${roof(c,y1,heightAt(c))} ${roof(a,y1,heightAt(a))}`}/>);
   }
  }
  const tiles:ReactNode[]=[];
  // Map each barrel tile onto its actual roof plane (never a screen-space pattern).
  for(const side of [0,1]){
   const a=side?middle:left,c=side?right:middle;
   const z=(x:number)=>eave+rise*(side?(right-x)/(right-middle):(x-left)/(middle-left));
   const rows=Math.ceil((c-a)*(straw?6:4)),columns=Math.ceil((bottom-top)*(straw?12:5));
   for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const x=a+(c-a)*row/rows,x2=a+(c-a)*(row+1)/rows,y=top+(bottom-top)*col/columns,y2=top+(bottom-top)*(col+1)/columns;
    const n=noise(row+b.x*31,col+b.y*17+side);
    tiles.push(<g key={`${side}-${row}-${col}`}>
     <polygon points={`${roof(x,y,z(x))} ${roof(x2,y,z(x2))} ${roof(x2,y2,z(x2))} ${roof(x,y2,z(x))}`} fill={straw?['#ac955f','#b09a65','#b49d68','#a9935d'][n%4]:roofPalette[n%roofPalette.length]} stroke={straw?'none':'#644b37'} strokeWidth={straw?'.25':'.22'}/>
     <path d={`M${roof(x,y+(straw?.012+(n%6)*.011:.035),z(x)+.3)}L${roof(x2,y+(straw?.012+(n%6)*.011:.035),z(x2)+.3)}`} stroke={straw?'#d1bd83':appearance.roofFinish==='aged'?'#b2a081':'#cf9164'} strokeWidth={straw?'.35':'.6'} opacity={straw?'.3':'.45'}/>
    </g>);
   }
  }
  objects.push({key:`architecture-roof-${room.id}`,depth:right+bottom+.12,node:<g data-roof-room={room.id} data-roof-finish={appearance.roofFinish} pointerEvents="none" style={{filter:`brightness(${light(b.x,b.y)})`}}>
   {!wholeRoof&&<defs><clipPath id={clipId}>{roofCells}</clipPath></defs>}
   <g clipPath={wholeRoof?undefined:`url(#${clipId})`}>
   {/* A complete gable closes the old triangular gap above the front wall. */}
   <polygon data-building-gable="true" points={`${roof(left,bottom,eave)} ${roof(middle,bottom,eave+rise)} ${roof(right,bottom,eave)}`} fill={palette.base} stroke={palette.shadow} strokeWidth=".7"/>
   <path d={`M${roof(middle,bottom,eave+9)}v-7`} stroke="#4d4533" strokeWidth="3"/>
   {tiles}
   <polygon points={`${roof(middle,top,eave+rise)} ${roof(right,top,eave)} ${roof(right,bottom,eave)} ${roof(middle,bottom,eave+rise)}`} fill="#27221a" opacity=".16"/>
   <path d={`M${roof(left,bottom,eave)}L${roof(middle,bottom,eave+rise)}L${roof(right,bottom,eave)}`} fill="none" stroke="#513926" strokeWidth="3"/>
   <path d={`M${roof(left,top,eave)}L${roof(left,bottom,eave)}M${roof(right,top,eave)}L${roof(right,bottom,eave)}`} stroke={straw?'#b9a371':'#663e29'} strokeWidth={straw?5:3}/>
   <path d={`M${roof(middle,top,eave+rise)}L${roof(middle,bottom,eave+rise)}`} stroke={straw?'#827149':appearance.roofFinish==='aged'?'#a39271':'#b77550'} strokeWidth={straw?7:3}/>
   {!straw&&Array.from({length:Math.ceil((bottom-top)*5)},(_,i)=>{const y=top+i/5;return <path key={i} d={`M${roof(middle-.025,y,eave+rise-.8)}L${roof(middle+.025,y,eave+rise-.8)}`} stroke="#72452e" strokeWidth=".8"/>;})}
   </g>
  </g>});
 }
 for(const b of s.buildings??[])objects.push(...buildingDetails(b,revealed,project).map(o=>({...o,node:<g style={{filter:`brightness(${light(b.x,b.y)})`}}>{o.node}</g>})));
 return objects;
}
type WallAxis='x'|'y';
