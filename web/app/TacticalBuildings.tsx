import type {ReactNode} from 'react';
type Point={x:number;y:number};
type Args={state:any;revealed:Set<string>;project:(x:number,y:number)=>Point;light:(x:number,y:number)=>number};
type SceneObject={key:string;depth:number;node:ReactNode};
/** Render architectural segments on authored collision cells, never a facade image. */
export function buildBuildingObjects({state:s,revealed,project,light}:Args):SceneObject[]{
 const objects:SceneObject[]=[];
 const wallTiles=s.tiles.filter((t:any)=>['wall','door','window'].includes(t.type));
 const occupied=new Set(wallTiles.map((t:any)=>`${t.x},${t.y}`));
 for(const t of wallTiles){
  const b=s.buildings?.find((v:any)=>v.id===t.buildingId),roomOpen=b?.rooms.some((r:any)=>revealed.has(r.id)&&r.cells.some((c:any)=>Math.abs(c.x-t.x)+Math.abs(c.y-t.y)===1));
  const onX=b&&(t.x===b.x||t.x===b.x+b.width-1),onY=b&&(t.y===b.y||t.y===b.y+b.height-1);
  const axes:WallAxis[]=b?[...(onX?['y' as const]:[]),...(onY?['x' as const]:[])]:[occupied.has(`${t.x+1},${t.y}`)||occupied.has(`${t.x-1},${t.y}`)?'x':'y'];
  if(!axes.length)axes.push('x');
  axes.forEach((axis,index)=>{
   const isFront=b&&(axis==='x'?t.y===b.y+b.height-1:t.x===b.x+b.width-1),cut=roomOpen&&isFront&&t.type==='wall',height=cut?11:39;
   const start=project(t.x-(axis==='x'?.5:0),t.y-(axis==='y'?.5:0)),end=project(t.x+(axis==='x'?.5:0),t.y+(axis==='y'?.5:0));
   const width=40,dx=(end.x-start.x)/width,dy=(end.y-start.y)/width,seed=(t.x*17+t.y*31)%11;
   const isOpening=t.type!=='wall'&&index===0;
   const top=(p:Point,z:number)=>`${p.x},${p.y-z}`;
   objects.push({key:`architecture-${t.x}-${t.y}-${axis}`,depth:t.x+t.y+.015,node:<g data-wall-tile={`${t.x},${t.y}`} data-cutaway={Boolean(cut)} pointerEvents="none" style={{filter:`brightness(${light(t.x,t.y)})`}}>
    {/* A shallow wall cap makes thickness readable without a full-tile cube. */}
    <polygon points={`${top(start,height)} ${top(end,height)} ${end.x+4},${end.y-height-2} ${start.x+4},${start.y-height-2}`} fill={cut?'#bda980':'#d2c49e'} stroke="#807459" strokeWidth=".55"/>
    <path d={`M${end.x},${end.y}v-${height}l4,-2v${height}Z`} fill="#8b8163"/>
    <g transform={`matrix(${dx} ${dy} 0 1 ${start.x} ${start.y})`}>
     {!isOpening?<rect x="0" y={-height} width={width} height={height} fill="url(#terrain-plaster)"/>:<>
      <path d={`M0,0V-${height}H40V0H29V-${t.type==='door'?30:29}H11V0Z`} fill="url(#terrain-plaster)"/>
      {t.type==='window'&&<rect x="10" y="-12" width="20" height="12" fill="url(#terrain-plaster)"/>}
      <rect x="11" y={t.type==='door'?-30:-29} width="18" height={t.type==='door'?30:17} fill="#20251b"/>
      <path d={`M10,0V-31H30V0M10,-31Q20,-36 30,-31`} fill="none" stroke="#d6c8a4" strokeWidth="2"/>
      {t.type==='door'?<g transform={t.open?'translate(11 0) skewY(-25) scale(.22 1) translate(-11 0)':undefined}><rect x="12" y="-30" width="16" height="30" fill="url(#terrain-wood)" stroke="#5c4931" strokeWidth=".8"/><path d="M15,-29V-1M20,-29V-1M25,-29V-1M12,-24H28M12,-7H28" stroke="#413725" strokeWidth=".7"/><circle cx="25" cy="-14" r="1" fill="#c1a16a"/></g>:<><path d="M16,-28V-13M23,-28V-13M12,-21H28" stroke="#897c5b" strokeWidth="1.2"/><path d="M9,-12H31" stroke="#e3d2a5" strokeWidth="3"/></>}
     </>}
     {/* Broken plaster and jointed stone footing, deterministic per tile. */}
     {!isOpening&&<><path d={`M${3+seed},-${Math.min(height-2,12)}l3,2 2,-1 2,4 -2,3 -6,-1Z`} fill="#a69570" opacity=".6"/>{height>15&&<path d={`M${27-seed},-34l-2,5 3,3 -1,5`} fill="none" stroke="#867d61" strokeWidth=".55" opacity=".75"/>}</>}
     <path d={isOpening&&t.type==='door'?'M0,-5H10V0H0ZM30,-5H40V0H30Z':'M0,-5H40V0H0Z'} fill="#827b62"/>
     <path d={isOpening?'M5,-5V0M35,-5V0':'M8,-5V0M21,-5V0M34,-5V0'} stroke="#595d4d" strokeWidth=".7"/>
     {!isOpening&&<path d={`M0,-${height}H40`} stroke={cut?'#f0dcb0':'#ded0ac'} strokeWidth={cut?2:1}/>}
     {axis==='y'&&<path d={isOpening?'M0,0V-39H10V0ZM30,0V-39H40V0Z':`M0,0V-${height}H40V0Z`} fill="#292c22" opacity=".14"/>}
    </g>
   </g>});
  });
 }
 for(const b of s.buildings??[])for(const room of b.rooms??[]){
  if(revealed.has(room.id)||!room.cells?.length)continue;
  const xs=room.cells.map((p:any)=>p.x),ys=room.cells.map((p:any)=>p.y),left=Math.max(b.x-.5,Math.min(...xs)-1),right=Math.min(b.x+b.width-.5,Math.max(...xs)+1),top=Math.max(b.y-.5,Math.min(...ys)-1),bottom=Math.min(b.y+b.height-.5,Math.max(...ys)+1),middle=(left+right)/2;
  const roof=(x:number,y:number,ridge=false)=>{const p=project(x,y);return `${p.x},${p.y-40-(ridge?17:0)}`;};
  const half=(a:number,z:boolean,c:number,z2:boolean)=>[roof(a,top,z),roof(c,top,z2),roof(c,bottom,z2),roof(a,bottom,z)].join(' ');
  objects.push({key:`architecture-roof-${room.id}`,depth:right+bottom+.12,node:<g data-roof-room={room.id} pointerEvents="none" style={{filter:`brightness(${light(b.x,b.y)})`}}>
   <polygon points={half(left,false,middle,true)} fill="url(#terrain-roof)" stroke="#685037" strokeWidth=".8"/>
   <polygon points={half(middle,true,right,false)} fill="url(#terrain-roof)" stroke="#685037" strokeWidth=".8"/>
   <polygon points={half(middle,true,right,false)} fill="#26271b" opacity=".22"/>
   {Array.from({length:Math.ceil((bottom-top)*4)},(_,i)=>top+(i+1)/4).filter(y=>y<bottom).map(y=><polyline key={y} points={`${roof(left,y)} ${roof(middle,y,true)} ${roof(right,y)}`} fill="none" stroke="#bd9266" strokeWidth=".55" opacity=".55"/>)}
   <path d={`M${roof(left,bottom)}L${roof(middle,bottom,true)}L${roof(right,bottom)}`} fill="none" stroke="#543f29" strokeWidth="4"/>
   <path d={`M${roof(left,top)}L${roof(left,bottom)}M${roof(right,top)}L${roof(right,bottom)}`} stroke="#a58054" strokeWidth="3"/>
   <path d={`M${roof(middle,top,true)}L${roof(middle,bottom,true)}`} stroke="#d2aa77" strokeWidth="3"/>
  </g>});
 }
 return objects;
}
type WallAxis='x'|'y';
