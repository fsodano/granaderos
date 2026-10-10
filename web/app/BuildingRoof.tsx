import {WALL_COLOURS} from './TacticalArchitectureMaterials';
import {BUILDING_VERTICAL_SCALE as S} from '../../game/building-scale.js';
import {wallMaterial} from './BuildingMaterials';
import type {ReactNode} from 'react';
import {buildingStyle} from '../../game/building-types.js';
type P={x:number;y:number};
type Args={building:any;left:number;right:number;top:number;bottom:number;doors?:any[];project:(x:number,y:number)=>P};

/** All surfaces, including tower sides, use the same ground projection as walls. */
export function BuildingRoof({building:b,left:L,right:R,top:T,bottom:B,doors=[],project}:Args){
 const baseStyle=buildingStyle(b),palette=WALL_COLOURS[b?.wallFinish],style=palette?{...baseStyle,wall:palette.base,trim:palette.trim}:baseStyle,kind=b.architecture??'house',H=style.height/S+1;
 const nodes:ReactNode[]=[];
 const edgeMode=b.walls?.some((wall:any)=>wall.axis);
 const point=(x:number,y:number,z=0)=>{const p=project(x+(edgeMode?0:.4),y+(edgeMode?0:.4));return {x:p.x,y:p.y-z*S};};
 const at=(x:number,y:number,z=0)=>{const p=point(x,y,z);return `${p.x},${p.y}`;};
 const polygon=(coords:number[][],fill:string,stroke='#68583e',width=.35)=>{
  const material=fill===style.wall?wallMaterial(b):fill===style.trim?'url(#building-plaster)':fill==='#a77d59'||fill==='#c09b71'?'url(#building-brick)':fill;
  return <polygon points={coords.map(([x,y,z])=>at(x,y,z)).join(' ')} fill={material} stroke={stroke} strokeWidth={width}/>;
 };
 // UV triangles project one continuous texture across the roof, with no tile-grid outlines.
 const surface=(coords:number[][],uv:number[][],material:string,shade:number)=>{
  const p=coords.map(([x,y,z])=>point(x,y,z));
  const du1=uv[1][0]-uv[0][0],dv1=uv[1][1]-uv[0][1],du2=uv[2][0]-uv[0][0],dv2=uv[2][1]-uv[0][1],det=du1*dv2-du2*dv1;
  const a=((p[1].x-p[0].x)*dv2-(p[2].x-p[0].x)*dv1)/det,c=(du1*(p[2].x-p[0].x)-du2*(p[1].x-p[0].x))/det;
  const bb=((p[1].y-p[0].y)*dv2-(p[2].y-p[0].y)*dv1)/det,d=(du1*(p[2].y-p[0].y)-du2*(p[1].y-p[0].y))/det;
  return <g transform={`matrix(${a} ${bb} ${c} ${d} ${p[0].x-a*uv[0][0]-c*uv[0][1]} ${p[0].y-bb*uv[0][0]-d*uv[0][1]})`}>
   <polygon points={uv.map(p=>p.join(',')).join(' ')} fill={`url(#building-${material})`}/>
   <polygon points={uv.map(p=>p.join(',')).join(' ')} fill="#10180f" opacity={shade}/>
  </g>;
 };
 // Z coordinates and façade heights use the same architectural unit. Ground
 // coordinates and texture density remain in tactical cells.
 // A plane transform keeps façade ornaments parallel to the building, never facing the screen.
 let faceIndex=0;
 const face=(x:number,y:number,length:number,axis:'x'|'y',content:(wall:string,trim:string)=>ReactNode)=>{
  const p=point(x,y),q=point(x+(axis==='x'?length:0),y+(axis==='y'?length:0));
  const id=`${b.id}-roof-${L}-${T}-${R}-${B}-facade-${faceIndex++}`,textureScale=`scale(${100/(length*40)} ${1/S})`;
  // The facade spans 100 drawing units regardless of its width. Keep its
  // material marks at the same density as the 40-unit wall-cell renderer.
  return <g transform={`matrix(${(q.x-p.x)/100} ${(q.y-p.y)/100} 0 ${S} ${p.x} ${p.y})`}>
   <defs><pattern id={`${id}-wall`} href={wallMaterial(b).slice(4,-1)} patternTransform={textureScale}/><pattern id={`${id}-trim`} href="#building-plaster" patternTransform={textureScale}/></defs>
   {content(`url(#${id}-wall)`,`url(#${id}-trim)`)}
  </g>;
 };
 const box=(x:number,y:number,w:number,d:number,base:number,height:number,color=style.wall)=> <>
  {polygon([[x,y+d,base],[x+w,y+d,base],[x+w,y+d,height],[x,y+d,height]],color)}
  {polygon([[x+w,y,base],[x+w,y+d,base],[x+w,y+d,height],[x+w,y,height]],color)}
  {polygon([[x+w,y,base],[x+w,y+d,base],[x+w,y+d,height],[x+w,y,height]],'#171d1390')}
  {polygon([[x,y,height],[x+w,y,height],[x+w,y+d,height],[x,y+d,height]],style.trim)}
 </>;
 const roof=(x:number,y:number,w:number,d:number,eave:number,rise:number,form:'hip'|'gable-x'|'gable-y'|'shed'|'flat',material='tile')=>{
  const z=(a:number,c:number)=>eave+rise*(form==='flat'?0:form==='shed'?1-c:form==='gable-x'?1-Math.abs(c*2-1):form==='gable-y'?1-Math.abs(a*2-1):Math.min(1,(1-Math.abs(a*2-1))*w/Math.min(w,d),(1-Math.abs(c*2-1))*d/Math.min(w,d)));
  const mesh:ReactNode[]=[];
  const nw=[x,y,eave],ne=[x+w,y,eave],se=[x+w,y+d,eave],sw=[x,y+d,eave];
  let faces:number[][][]=[];
  if(form==='gable-y'){
   const back=[x+w/2,y,eave+rise],front=[x+w/2,y+d,eave+rise];
   faces=[[nw,back,front,sw],[back,ne,se,front]];
   mesh.push(<g key="gable" data-building-gable="true">{polygon([sw,front,se],style.wall)}</g>);
  }else if(form==='gable-x'){
   const left=[x,y+d/2,eave+rise],right=[x+w,y+d/2,eave+rise];
   faces=[[nw,ne,right,left],[left,right,se,sw]];
   mesh.push(<g key="gable" data-building-gable="true">{polygon([ne,right,se],style.wall)}</g>);
  }else if(form==='hip'){
   const longX=w>=d,half=Math.min(w,d)/2;
   const a=[x+half,y+half,eave+rise];
   const c=longX?[x+w-half,y+half,eave+rise]:[x+half,y+d-half,eave+rise];
   faces=longX?[[nw,ne,c,a],[ne,se,c],[sw,a,c,se],[nw,a,sw]]:[[nw,ne,a],[ne,se,c,a],[sw,c,se],[nw,a,c,sw]];
  }else{
   faces=[[[x,y,z(0,0)],[x+w,y,z(1,0)],[x+w,y+d,z(1,1)],[x,y+d,z(0,1)]]];
   if(form==='shed'){
    // Close the raised end of the sloping roof. A higher eave must not leave
    // a gap over the wall; veranda ends use a shallow timber fascia instead.
    const fill=d<1?'url(#building-timber)':style.wall;
    mesh.push(<g key="shed-gable" data-building-gable="true">{polygon([[x+w,y,eave],[x+w,y+d,eave],[x+w,y,z(1,0)]],fill)}{polygon([[x,y,eave],[x+w,y,eave],[x+w,y,z(1,0)],[x,y,z(0,0)]],fill)}</g>);
   }
  }
  const finish=b.roofFinish??material,texture=form==='flat'?'terrace':finish==='thatch'?'thatch':'clay';
  faces.forEach((vertices,i)=>{
   // Choose any non-collinear triangle, including the square-hip ridge case.
   const triangles=vertices.length===3?[vertices]:[[vertices[0],vertices[1],vertices[2]],[vertices[0],vertices[2],vertices[3]]];
   triangles.forEach((coords,j)=>{
    const [p,q,r]=coords,dx1=q[0]-p[0],dy1=q[1]-p[1],dx2=r[0]-p[0],dy2=r[1]-p[1],det=dx1*dy2-dx2*dy1;
    if(Math.abs(det)<.00001)return;
    const sx=((q[2]-p[2])*dy2-(r[2]-p[2])*dy1)/det,sy=(dx1*(r[2]-p[2])-dx2*(q[2]-p[2]))/det;
    const uv=coords.map(([xx,yy])=>Math.abs(sx)>Math.abs(sy)?[yy*32,xx*32]:[xx*32,yy*32]);
    const shade=Math.min(.4,.05+Math.max(0,-sx)*.012+Math.max(0,-sy)*.006);
    mesh.push(<g key={`${i}-${j}`}><g style={finish==='aged'&&form!=='flat'?{filter:'saturate(.55) brightness(.84)'}:undefined}>{surface(coords,uv,texture,shade)}</g></g>);
   });
  });
  mesh.push(<path key="edge" d={`M${at(x,y+d,z(0,1))}L${at(x+w,y+d,z(1,1))}L${at(x+w,y,z(1,0))}`} fill="none" stroke={material==='thatch'?'#74623e':'#67472f'} strokeWidth={material==='thatch'?4:2}/>);
  return <g data-roof-form={form}>{mesh}</g>;
 };
 const parapet=(x:number,y:number,w:number,d:number,h:number)=> <>
  {polygon([[x,y+d,H],[x+w,y+d,H],[x+w,y+d,h],[x,y+d,h]],style.wall)}
  {polygon([[x+w,y,H],[x+w,y+d,H],[x+w,y+d,h],[x+w,y,h]],'#a99c7c')}
  <path d={`M${at(x,y+d,h)}L${at(x+w,y+d,h)}L${at(x+w,y,h)}`} fill="none" stroke="url(#building-plaster)" strokeWidth="3"/>
 </>;
 const chimney=(x:number,y:number,z:number)=> <g data-chimney="true">{box(x,y,.38,.4,z,z+20,'#a77d59')}{box(x-.05,y-.05,.48,.5,z+18,z+22,'#c09b71')}<path d={`M${at(x+.05,y+.12,z+23)}L${at(x+.32,y+.12,z+23)}`} stroke="#4b4535" strokeWidth="3"/></g>;
 const gallery=(x:number,y:number,w:number,z:number,depth=.7)=> <g data-building-gallery="true">
  {roof(x,y,w,depth,z,8,'shed')}
  {Array.from({length:Math.ceil(w)+1},(_,i)=>{const a=x+w*i/Math.ceil(w);return <g key={i}><path d={`M${at(a,y+depth,0)}L${at(a,y+depth,z)}`} stroke="url(#building-timber)" strokeWidth="3"/><path d={`M${at(a,y+depth,z-8)}L${at(Math.min(x+w,a+.2),y+depth,z)}`} stroke="#96774b" strokeWidth="2"/></g>;})}
  <path d={`M${at(x,y+depth,z)}L${at(x+w,y+depth,z)}`} stroke="url(#building-timber)" strokeWidth="3"/>
 </g>;
 const tower=(x:number,y:number,w:number,d:number,base:number,h:number,clock=false)=> <g data-building-tower={kind}>
  {box(x,y,w,d,base,h)}
  {face(x,y+d,w,'x',(wall,trim)=><><path d={`M8,-${base}V-${h-2}M92,-${base}V-${h-2}`} stroke={trim} strokeWidth="5"/>
   <path d={`M29,-${base+9}V-${h-21}Q50,-${h-10} 71,-${h-21}V-${base+9}Z`} fill="url(#building-recess)" stroke={trim} strokeWidth="3"/>
   {clock?<><ellipse cx="50" cy={-h+12} rx="13" ry="7" fill="#f0dfb0" stroke="#665c41"/><path d={`M50,-${h-7}v5h8`} stroke="#494a35" fill="none"/></>:<><path d={`M40,-${base+11}l3,-9q7,-5 14,0l3,9Z`} fill="#b29a5e"/><path d={`M35,-${base+10}H65`} stroke="#dfbe76" strokeWidth="2"/></>}
  </>)}
  {face(x+w,y,d,'y',(wall,trim)=><path d={`M30,-${base+10}V-${h-22}Q50,-${h-10} 70,-${h-22}V-${base+10}Z`} fill="#464a37" stroke="#c7b990" strokeWidth="2"/>)}
  {box(x-.07,y-.07,w+.14,d+.14,h-3,h+1)}
  {clock?<g data-cabildo-dome="true">{(()=>{const c=point(x+w/2,y+d/2,h+3),rx=Math.abs(point(x+w,y,h).x-point(x,y+d,h).x)/2+1;return <><path d={`M${c.x-rx},${c.y}C${c.x-rx},${c.y-18*S} ${c.x-12},${c.y-30*S} ${c.x},${c.y-30*S}C${c.x+12},${c.y-30*S} ${c.x+rx},${c.y-18*S} ${c.x+rx},${c.y}Z`} fill="url(#building-terrace)" stroke="#483e26"/><path d={`M${c.x},${c.y-29*S}Q${c.x-9},${c.y-17*S} ${c.x-8},${c.y}`} fill="none" stroke="#99804a" strokeWidth="2"/><ellipse cx={c.x} cy={c.y} rx={rx} ry={4*S} fill="#ad9450"/></>;})()}</g>:<>
  {polygon([[x-.1,y+d+.1,h+1],[x+w+.1,y+d+.1,h+1],[x+w/2,y+d/2,h+26]],'#996544')}
  {polygon([[x+w+.1,y-.1,h+1],[x+w+.1,y+d+.1,h+1],[x+w/2,y+d/2,h+26]],'#77503a')}
  </>}
  <path d={`M${at(x+w/2,y+d/2,h+26)}v-${13*S}m-5,${5*S}h10`} stroke="#4d4935" strokeWidth="1.8"/>
 </g>;
 const w=R-L,d=B-T;
 if(b.roof&&b.roof!==style.roof){
  nodes.push(roof(L,T,w,d,H,b.roof==='terrace'?0:22,b.roof==='terrace'?'flat':'hip',b.roof));
 }else if(kind==='cabildo'){
  nodes.push(roof(L,T,w,d,H,22,'gable-x'));
  // The long double arcade faces the plaza; the side remains a plain service wall.
  nodes.push(face(L,B+.015,w,'x',(wall,trim)=><g data-cabildo-arcade="true">
   <rect y={-H+2} width="100" height={H-2} fill={wall}/>
   {Array.from({length:11},(_,i)=>{const x=2+i*8.8;return <g key={i}>
    {[5,43].map(z=><g key={z}><path d={`M${x},-${z}V-${z+21}Q${x+3.1},-${z+33} ${x+6.2},-${z+21}V-${z}Z`} fill="url(#building-recess)"/><path d={`M${x+.6},-${z}V-${z+19}Q${x+3.5},-${z+29} ${x+5.6},-${z+19}`} stroke="#b9ac88" strokeWidth=".65" fill="none"/></g>)}
    <path d={`M${x-.7},-2V-35M${x-.7},-41V-75`} stroke={trim} strokeWidth="1.2"/>
   </g>;})}
   <path d="M0,-39H100M0,-78H100M0,-3H100" stroke={trim} strokeWidth="3"/>
   <path d="M0,-40H100M0,-47H100" stroke="#454b3c" strokeWidth=".9"/>
   {Array.from({length:45},(_,i)=><path key={`rail-${i}`} d={`M${i*100/44},-47v7`} stroke="#454b3c" strokeWidth=".65"/>)}
   <path d={`M42,0V-${H+8}H58V0ZM39,-${H+8}H61`} fill={wall} stroke={trim} strokeWidth="2"/>
   <path d="M45,-45V-64Q50,-76 55,-64V-45Z" fill="url(#building-recess)" stroke={trim} strokeWidth="1.5"/>
   <path d={`M43,-2V-${H+4}M57,-2V-${H+4}`} stroke={trim} strokeWidth="1.8"/>
   <path d="M40,-39H60M41,-8H59" stroke={trim} strokeWidth="3"/>
  </g>));
  nodes.push(tower(L+w*.43,B-.9,w*.14,.85,H+7,H+66,true));
  for(const door of doors.filter(t=>edgeMode?t.axis==='x'&&t.y===b.y+b.height:t.y===b.y+b.height-1))nodes.push(face(door.x-(edgeMode?.3:.7),B+.03,.6,'x',(wall,trim)=><g data-landmark-door={door.doorId}>
   <rect y="-30" width="100" height="30" fill="#30372a"/>
   <rect y="-29" width={door.open?12:100} height="29" fill="#70583b" stroke="#c4af72" strokeWidth="1"/>
   {!door.open&&<path d="M25,-27V0M50,-27V0M75,-27V0M0,-23H100M0,-6H100" stroke="#4d412a"/>}
  </g>));
 }else if(kind==='church'){
  nodes.push(roof(L,T,w,d,H,31,'gable-y'));
  // The church front has a curved pediment, central oculus and two pilasters.
  nodes.push(face(L,B+.025,w,'x',(wall,trim)=><g data-church-front="true">
   <path d={`M0,-${H-3}V-${H+5}H15Q24,-${H+5} 29,-${H+17}Q38,-${H+36} 50,-${H+36}Q62,-${H+36} 71,-${H+17}Q76,-${H+5} 85,-${H+5}H100V-${H-3}Z`} fill={wall} stroke={trim} strokeWidth="2"/>
   <path d={`M18,-2V-${H+1}M82,-2V-${H+1}`} stroke={trim} strokeWidth="5"/>
   <path d={`M15,-${H+2}H85M12,-8H26M74,-8H88`} stroke="#c1ad83" strokeWidth="3"/>
   <ellipse cx="50" cy={-H+8} rx="9" ry="8" fill="#69664b" stroke={trim} strokeWidth="3"/>
   <path d={`M50,-${H+33}v-16m-5,5h10`} stroke="#4a4732" strokeWidth="1.6"/>
  </g>));
  nodes.push(tower(L+.05,B-.87,.88,.88,H-2,H+59));
 }else if(kind==='mansion'){
  nodes.push(roof(L,T,w,d,H,0,'flat'),parapet(L,T,w,d,H+10));
  // An offset mirador and its small hip roof break up the roof terrace.
  nodes.push(box(L+.15,T+.2,w*.38,d*.42,H,H+25),roof(L+.08,T+.13,w*.38+.14,d*.42+.14,H+26,14,'hip'));
  nodes.push(face(L+.15,T+.2+d*.42,w*.38,'x',(wall,trim)=><><rect x="28" y={-H-21} width="40" height="16" fill="#56634e"/><path d={`M48,-${H+21}v16`} stroke={trim} strokeWidth="2"/></>));
  nodes.push(chimney(R-.65,T+.5,H));
 }else if(kind==='estancia'){
  nodes.push(roof(L,T,w,d,H,24,'hip'),gallery(L,B,w,H-11,.8));
  nodes.push(chimney(L+.45,T+.6,H+9));
 }else if(kind==='farmhouse'){
  nodes.push(roof(L-.08,T-.08,w+.16,d+.16,H,24,'hip','thatch'));
  nodes.push(chimney(R-.7,T+.5,H+6));
 }else if(kind==='warehouse'){
  nodes.push(roof(L,T,w*.5,d,H,23,'gable-y'),roof(L+w*.5,T,w*.5,d,H,23,'gable-y'));
  nodes.push(face(L,B+.01,w,'x',(wall,trim)=><><path d={`M0,-${H}H100`} stroke="#645239" strokeWidth="3"/>{[25,75].map(x=><g key={x}><path d={`M${x-6},-${H+3}V-${H+11}H${x+6}V-${H+3}Z`} fill="#574e38"/><path d={`M${x-7},-${H+7}H${x+7}`} stroke="#b49360"/></g>)}<path d={`M50,-${H-2}V-${H+22}h14m-6,0v24`} stroke="#57442c" strokeWidth="2"/></>));
 }else if(kind==='pulperia'){
  nodes.push(roof(L,T,w,d,H,16,'shed'),gallery(L,B,w,H-12,.75));
  nodes.push(face(L+w*.1,B+.76,w*.28,'x',(wall,trim)=><><path d={`M0,-${H-12}v11M100,-${H-12}v11`} stroke="#453b27"/><rect y={-H+20} width="100" height="10" fill="#644d30" stroke="#a8915a"/><text x="50" y={-H+27} textAnchor="middle" fill="#e1cea0" fontSize="6" letterSpacing="1">PULPERÍA</text></>));
 }else if(kind==='barracks'){
  nodes.push(roof(L,T,w,d,H,12,'gable-x'),chimney(L+.6,T+.7,H+5),chimney(R-.8,T+.7,H+5));
 }else{
  nodes.push(roof(L,T,w,d,H,0,'flat'),parapet(L,T,w,d,H+7),chimney(L+.5,T+.5,H));
  nodes.push(face(L,B+.015,w,'x',(wall,trim)=><path d={`M35,-${H+6}V-${H+11}H65V-${H+6}`} fill={wall} stroke={trim} strokeWidth="2"/>));
 }
 return <g data-building-silhouette={kind}>{nodes.map((node,i)=><g key={i}>{node}</g>)}</g>;
}
