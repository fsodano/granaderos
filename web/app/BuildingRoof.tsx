import type {ReactNode} from 'react';
import {buildingStyle} from '../../game/building-types.js';
type P={x:number;y:number};
type Args={building:any;left:number;right:number;top:number;bottom:number;doors?:any[];project:(x:number,y:number)=>P};
const clay=['#976247','#9d684b','#a66f4f','#8f5c43','#ac7453','#a06a4d'];
const hash=(x:number,y:number)=>((Math.imul(x+71,374761393)^Math.imul(y+97,668265263))>>>0);

/** All surfaces, including tower sides, use the same ground projection as walls. */
export function BuildingRoof({building:b,left:L,right:R,top:T,bottom:B,doors=[],project}:Args){
 const style=buildingStyle(b),kind=b.architecture??'house',H=style.height+1;
 const nodes:ReactNode[]=[];
 const point=(x:number,y:number,z=0)=>{const p=project(x+.4,y+.4);return {x:p.x,y:p.y-z};};
 const at=(x:number,y:number,z=0)=>{const p=point(x,y,z);return `${p.x},${p.y}`;};
 const polygon=(coords:number[][],fill:string,stroke='#68583e',width=.6)=><polygon points={coords.map(([x,y,z])=>at(x,y,z)).join(' ')} fill={fill} stroke={stroke} strokeWidth={width}/>;
 // A plane transform keeps façade ornaments parallel to the building, never facing the screen.
 const face=(x:number,y:number,length:number,axis:'x'|'y',content:ReactNode)=>{
  const p=point(x,y),q=point(x+(axis==='x'?length:0),y+(axis==='y'?length:0));
  return <g transform={`matrix(${(q.x-p.x)/100} ${(q.y-p.y)/100} 0 1 ${p.x} ${p.y})`}>{content}</g>;
 };
 const box=(x:number,y:number,w:number,d:number,base:number,height:number,color=style.wall)=> <>
  {polygon([[x,y+d,base],[x+w,y+d,base],[x+w,y+d,height],[x,y+d,height]],color)}
  {polygon([[x+w,y,base],[x+w,y+d,base],[x+w,y+d,height],[x+w,y,height]],'#a29779')}
  {polygon([[x,y,height],[x+w,y,height],[x+w,y+d,height],[x,y+d,height]],style.trim)}
 </>;
 const roof=(x:number,y:number,w:number,d:number,eave:number,rise:number,form:'hip'|'gable-x'|'gable-y'|'shed'|'flat',material='tile')=>{
  const z=(a:number,c:number)=>eave+rise*(form==='flat'?0:form==='shed'?1-c:form==='gable-x'?1-Math.abs(c*2-1):form==='gable-y'?1-Math.abs(a*2-1):Math.min(1,(1-Math.abs(a*2-1))*w/Math.min(w,d),(1-Math.abs(c*2-1))*d/Math.min(w,d)));
  const mesh:ReactNode[]=[];const nx=Math.ceil(w*3)*2,ny=Math.ceil(d*3)*2;
  // Close gable ends before drawing roof planes.
  if(form==='gable-y')mesh.push(<g key="gable" data-building-gable="true">{polygon([[x,y+d,eave],[x+w/2,y+d,eave+rise],[x+w,y+d,eave]],style.wall)}</g>);
  if(form==='gable-x')mesh.push(<g key="gable" data-building-gable="true">{polygon([[x+w,y,eave],[x+w,y+d/2,eave+rise],[x+w,y+d,eave]],style.wall)}</g>);
  for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){
   const a=i/nx,c=j/ny,a2=(i+1)/nx,c2=(j+1)/ny,n=hash(i+b.x*13,j+b.y*23);
   const color=material==='thatch'?['#8e7b4f','#978354','#a38d59','#ad9761'][n%4]:form==='flat'?['#b8a581','#b09d79','#b3a07d'][n%3]:(kind==='cabildo'?['#a45338','#ae5d3d','#a9573b','#995036','#b06442','#a4583a']:clay)[n%clay.length];
   mesh.push(<g key={`${i}-${j}`}>{polygon([[x+a*w,y+c*d,z(a,c)],[x+a2*w,y+c*d,z(a2,c)],[x+a2*w,y+c2*d,z(a2,c2)],[x+a*w,y+c2*d,z(a,c2)]],color,material==='thatch'?'none':'#78563d',.25)}
    {material==='thatch'?Array.from({length:4},(_,k)=>{const f=c+(c2-c)*k/4;return <path key={k} d={`M${at(x+a*w,y+f*d,z(a,f)+.4)}L${at(x+a2*w,y+f*d,z(a2,f)+.4)}`} stroke={k%2?'#c2ac72':'#685a38'} strokeWidth=".6"/>;}):<path d={`M${at(x+a*w,y+c*d,z(a,c)+.3)}L${at(x+a2*w,y+c*d,z(a2,c)+.3)}`} stroke="#dbad79" opacity=".45" strokeWidth=".5"/>}
   </g>);
  }
  mesh.push(<path key="edge" d={`M${at(x,y+d,z(0,1))}L${at(x+w,y+d,z(1,1))}L${at(x+w,y,z(1,0))}`} fill="none" stroke={material==='thatch'?'#74623e':'#67472f'} strokeWidth={material==='thatch'?4:2}/>);
  return <g data-roof-form={form}>{mesh}</g>;
 };
 const parapet=(x:number,y:number,w:number,d:number,h:number)=> <>
  {polygon([[x,y+d,H],[x+w,y+d,H],[x+w,y+d,h],[x,y+d,h]],style.wall)}
  {polygon([[x+w,y,H],[x+w,y+d,H],[x+w,y+d,h],[x+w,y,h]],'#a99c7c')}
  <path d={`M${at(x,y+d,h)}L${at(x+w,y+d,h)}L${at(x+w,y,h)}`} fill="none" stroke={style.trim} strokeWidth="3"/>
 </>;
 const chimney=(x:number,y:number,z:number)=> <g data-chimney="true">{box(x,y,.38,.4,z,z+20,'#a77d59')}{box(x-.05,y-.05,.48,.5,z+18,z+22,'#c09b71')}<path d={`M${at(x+.05,y+.12,z+23)}L${at(x+.32,y+.12,z+23)}`} stroke="#4b4535" strokeWidth="3"/></g>;
 const gallery=(x:number,y:number,w:number,z:number,depth=.7)=> <g data-building-gallery="true">
  {roof(x,y,w,depth,z,8,'shed')}
  {Array.from({length:Math.ceil(w)+1},(_,i)=>{const a=x+w*i/Math.ceil(w);return <g key={i}><path d={`M${at(a,y+depth,0)}L${at(a,y+depth,z)}`} stroke="#5d4a30" strokeWidth="3"/><path d={`M${at(a,y+depth,z-8)}L${at(Math.min(x+w,a+.2),y+depth,z)}`} stroke="#96774b" strokeWidth="2"/></g>;})}
  <path d={`M${at(x,y+depth,z)}L${at(x+w,y+depth,z)}`} stroke="#775636" strokeWidth="3"/>
 </g>;
 const tower=(x:number,y:number,w:number,d:number,base:number,h:number,clock=false)=> <g data-building-tower={kind}>
  {box(x,y,w,d,base,h)}
  {face(x,y+d,w,'x',<><path d={`M8,-${base}V-${h-2}M92,-${base}V-${h-2}`} stroke={style.trim} strokeWidth="5"/>
   <path d={`M29,-${base+9}V-${h-21}Q50,-${h-10} 71,-${h-21}V-${base+9}Z`} fill="#383c2e" stroke={style.trim} strokeWidth="3"/>
   {clock?<><ellipse cx="50" cy={-h+12} rx="13" ry="7" fill="#f0dfb0" stroke="#665c41"/><path d={`M50,-${h-7}v5h8`} stroke="#494a35" fill="none"/></>:<><path d={`M40,-${base+11}l3,-9q7,-5 14,0l3,9Z`} fill="#b29a5e"/><path d={`M35,-${base+10}H65`} stroke="#dfbe76" strokeWidth="2"/></>}
  </>)}
  {face(x+w,y,d,'y',<path d={`M30,-${base+10}V-${h-22}Q50,-${h-10} 70,-${h-22}V-${base+10}Z`} fill="#464a37" stroke="#c7b990" strokeWidth="2"/>)}
  {box(x-.07,y-.07,w+.14,d+.14,h-3,h+1)}
  {clock?<g data-cabildo-dome="true">{(()=>{const c=point(x+w/2,y+d/2,h+3),rx=Math.abs(point(x+w,y,h).x-point(x,y+d,h).x)/2+1;return <><path d={`M${c.x-rx},${c.y}C${c.x-rx},${c.y-18} ${c.x-12},${c.y-30} ${c.x},${c.y-30}C${c.x+12},${c.y-30} ${c.x+rx},${c.y-18} ${c.x+rx},${c.y}Z`} fill="#62512e" stroke="#483e26"/><path d={`M${c.x},${c.y-29}Q${c.x-9},${c.y-17} ${c.x-8},${c.y}`} fill="none" stroke="#99804a" strokeWidth="2"/><ellipse cx={c.x} cy={c.y} rx={rx} ry="4" fill="#ad9450"/></>;})()}</g>:<>
  {polygon([[x-.1,y+d+.1,h+1],[x+w+.1,y+d+.1,h+1],[x+w/2,y+d/2,h+26]],'#996544')}
  {polygon([[x+w+.1,y-.1,h+1],[x+w+.1,y+d+.1,h+1],[x+w/2,y+d/2,h+26]],'#77503a')}
  </>}
  <path d={`M${at(x+w/2,y+d/2,h+26)}v-13m-5,5h10`} stroke="#4d4935" strokeWidth="1.8"/>
 </g>;
 const w=R-L,d=B-T;
 if(b.roof&&b.roof!==style.roof){
  nodes.push(roof(L,T,w,d,H,b.roof==='terrace'?0:22,b.roof==='terrace'?'flat':'hip',b.roof));
 }else if(kind==='cabildo'){
  nodes.push(roof(L,T,w,d,H,22,'gable-x'));
  // The long double arcade faces the plaza; the side remains a plain service wall.
  nodes.push(face(L,B+.015,w,'x',<g data-cabildo-arcade="true">
   <rect y={-H+2} width="100" height={H-2} fill={style.wall}/>
   {Array.from({length:11},(_,i)=>{const x=2+i*8.8;return <g key={i}>
    {[5,43].map(z=><g key={z}><path d={`M${x},-${z}V-${z+21}Q${x+3.1},-${z+33} ${x+6.2},-${z+21}V-${z}Z`} fill="#676a53"/><path d={`M${x+.6},-${z}V-${z+19}Q${x+3.5},-${z+29} ${x+5.6},-${z+19}`} stroke="#b9ac88" strokeWidth=".65" fill="none"/></g>)}
    <path d={`M${x-.7},-2V-35M${x-.7},-41V-75`} stroke={style.trim} strokeWidth="1.2"/>
   </g>;})}
   <path d="M0,-39H100M0,-78H100M0,-3H100" stroke={style.trim} strokeWidth="3"/>
   <path d="M0,-40H100M0,-47H100" stroke="#454b3c" strokeWidth=".9"/>
   {Array.from({length:45},(_,i)=><path key={`rail-${i}`} d={`M${i*100/44},-47v7`} stroke="#454b3c" strokeWidth=".65"/>)}
   <path d={`M42,0V-${H+8}H58V0ZM39,-${H+8}H61`} fill={style.wall} stroke={style.trim} strokeWidth="2"/>
   <path d="M45,-45V-64Q50,-76 55,-64V-45Z" fill="#4a503c" stroke={style.trim} strokeWidth="1.5"/>
   <path d={`M43,-2V-${H+4}M57,-2V-${H+4}`} stroke={style.trim} strokeWidth="1.8"/>
   <path d="M40,-39H60M41,-8H59" stroke={style.trim} strokeWidth="3"/>
  </g>));
  nodes.push(tower(L+w*.43,B-.9,w*.14,.85,H+7,H+66,true));
  for(const door of doors.filter(t=>t.y===b.y+b.height-1))nodes.push(face(door.x-.4,B+.03,.48,'x',<g data-landmark-door={door.doorId}>
   <rect y="-29" width="100" height="29" fill="#30372a"/>
   <rect y="-28" width={door.open?12:100} height="28" fill="#70583b" stroke="#c4af72" strokeWidth="1"/>
   {!door.open&&<path d="M25,-27V0M50,-27V0M75,-27V0M0,-23H100M0,-6H100" stroke="#4d412a"/>}
  </g>));
 }else if(kind==='church'){
  nodes.push(roof(L,T,w,d,H,31,'gable-y'));
  // The church front has a curved pediment, central oculus and two pilasters.
  nodes.push(face(L,B+.025,w,'x',<g data-church-front="true">
   <path d={`M0,-${H-3}V-${H+5}H15Q24,-${H+5} 29,-${H+17}Q38,-${H+36} 50,-${H+36}Q62,-${H+36} 71,-${H+17}Q76,-${H+5} 85,-${H+5}H100V-${H-3}Z`} fill={style.wall} stroke={style.trim} strokeWidth="2"/>
   <path d={`M18,-2V-${H+1}M82,-2V-${H+1}`} stroke={style.trim} strokeWidth="5"/>
   <path d={`M15,-${H+2}H85M12,-8H26M74,-8H88`} stroke="#c1ad83" strokeWidth="3"/>
   <ellipse cx="50" cy={-H+8} rx="9" ry="8" fill="#69664b" stroke={style.trim} strokeWidth="3"/>
   <path d={`M50,-${H+33}v-16m-5,5h10`} stroke="#4a4732" strokeWidth="1.6"/>
  </g>));
  nodes.push(tower(L+.05,B-.87,.88,.88,H-2,H+59));
 }else if(kind==='mansion'){
  nodes.push(roof(L,T,w,d,H,0,'flat'),parapet(L,T,w,d,H+10));
  // An offset mirador and its small hip roof break up the roof terrace.
  nodes.push(box(L+.15,T+.2,w*.38,d*.42,H,H+25),roof(L+.08,T+.13,w*.38+.14,d*.42+.14,H+26,14,'hip'));
  nodes.push(face(L+.15,T+.2+d*.42,w*.38,'x',<><rect x="28" y={-H-21} width="40" height="16" fill="#56634e"/><path d={`M48,-${H+21}v16`} stroke={style.trim} strokeWidth="2"/></>));
  nodes.push(chimney(R-.65,T+.5,H));
 }else if(kind==='estancia'){
  nodes.push(roof(L,T,w,d,H,24,'hip'),gallery(L,B,w,H-11,.8));
  nodes.push(chimney(L+.45,T+.6,H+9));
 }else if(kind==='farmhouse'){
  nodes.push(roof(L-.08,T-.08,w+.16,d+.16,H,24,'hip','thatch'));
  nodes.push(chimney(R-.7,T+.5,H+6));
 }else if(kind==='warehouse'){
  nodes.push(roof(L,T,w*.5,d,H,23,'gable-y'),roof(L+w*.5,T,w*.5,d,H,23,'gable-y'));
  nodes.push(face(L,B+.01,w,'x',<><path d={`M0,-${H}H100`} stroke="#645239" strokeWidth="3"/>{[25,75].map(x=><g key={x}><path d={`M${x-6},-${H+3}V-${H+11}H${x+6}V-${H+3}Z`} fill="#574e38"/><path d={`M${x-7},-${H+7}H${x+7}`} stroke="#b49360"/></g>)}<path d={`M50,-${H-2}V-${H+22}h14m-6,0v24`} stroke="#57442c" strokeWidth="2"/></>));
 }else if(kind==='pulperia'){
  nodes.push(roof(L,T,w,d,H,16,'shed'),gallery(L,B,w,H-12,.75));
  nodes.push(face(L+w*.1,B+.76,w*.28,'x',<><path d={`M0,-${H-12}v11M100,-${H-12}v11`} stroke="#453b27"/><rect y={-H+20} width="100" height="10" fill="#644d30" stroke="#a8915a"/><text x="50" y={-H+27} textAnchor="middle" fill="#e1cea0" fontSize="6" letterSpacing="1">PULPERÍA</text></>));
 }else if(kind==='barracks'){
  nodes.push(roof(L,T,w,d,H,12,'gable-x'),chimney(L+.6,T+.7,H+5),chimney(R-.8,T+.7,H+5));
 }else{
  nodes.push(roof(L,T,w,d,H,0,'flat'),parapet(L,T,w,d,H+7),chimney(L+.5,T+.5,H));
  nodes.push(face(L,B+.015,w,'x',<path d={`M35,-${H+6}V-${H+11}H65V-${H+6}`} fill={style.wall} stroke={style.trim} strokeWidth="2"/>));
 }
 return <g data-building-silhouette={kind}>{nodes.map((node,i)=><g key={i}>{node}</g>)}</g>;
}
