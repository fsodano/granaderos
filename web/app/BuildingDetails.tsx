import {buildingStyle} from '../../game/building-types.js';

/** Details share the wall plane, so doors and cutaway walls remain aligned. */
export function WallDetails({building:b,front,cut,opening}:{building:any;front:boolean;cut:boolean;opening:boolean}){
 const style=buildingStyle(b),kind=b?.architecture;
 if(cut)return null;
 return <g data-architecture-detail={kind??'house'}>
  {style.upper&&<><rect y={-style.height} width="40" height={style.height-46} fill={style.wall}/><path d="M0,-47H40M0,-50H40" stroke={style.trim} strokeWidth="2"/>
   <path d={`M10,-55V-${style.height-12}Q20,-${style.height+1} 30,-${style.height-12}V-55Z`} fill="#383a2d" stroke={style.trim} strokeWidth="2"/>
   <path d={`M16,-56V-${style.height-11}M24,-56V-${style.height-11}`} stroke="#776448"/>
   {kind==='mansion'&&<><path d="M6,-53H34M7,-62H33M9,-62V-53M14,-62V-53M20,-62V-53M26,-62V-53M31,-62V-53" stroke="#353a30" strokeWidth="1.2"/><path d="M4,-51H36" stroke={style.trim} strokeWidth="3"/></>}
  </>}
  {front&&style.arcade&&<>{!opening&&<path d="M6,-6V-28Q20,-44 34,-28V-6Z" fill="#8d866c"/>}<path d="M2,0V-29Q20,-52 38,-29V0M2,-47V-70Q20,-91 38,-70V-48" fill="none" stroke={style.trim} strokeWidth="4"/><path d="M0,-3H7M33,-3H40M0,-46H40" stroke={style.trim} strokeWidth="3"/></>}
  {front&&style.gallery&&<><path d="M1,0V-40M39,0V-40" stroke="#574730" strokeWidth="3"/><path d="M0,-38H40M1,-31L9,-38M31,-38L39,-31" stroke="#7d6441" strokeWidth="2"/></>}
  {kind==='barracks'&&<path d="M0,-9H40" stroke="#915d43" strokeWidth="5" opacity=".8"/>}
  {kind==='warehouse'&&!opening&&<><path d="M3,-8V-49H37V-8ZM5,-10L35,-47M5,-47L35,-10" fill="#776348" stroke="#4b4130" strokeWidth="2"/><path d="M13,-10V-47M26,-10V-47" stroke="#9d8359"/></>}
  {front&&style.awning&&<><path d="M1,-35L-3,-27H43L39,-35Z" fill="#54624b" stroke="#343d2e"/><path d="M5,-34L2,-28M15,-34L14,-28M25,-34L26,-28M35,-34L38,-28" stroke="#c6b782" strokeWidth="3"/></>}
  {kind==='church'&&!opening&&<><path d="M1,0V-60H7V0M33,0V-60H39V0" fill={style.trim}/><path d="M15,-35V-45Q20,-55 25,-45V-35Z" fill="#514b35" stroke={style.trim} strokeWidth="2"/></>}
 </g>;
}

export function RoofLandmark({building:b,project,eave}:{building:any;project:(x:number,y:number)=>{x:number;y:number};eave:number}){
 const style=buildingStyle(b);if(!style.tower)return null;
 const p=project(b.x+b.width/2,b.y+b.height-.6),cabildo=b.architecture==='cabildo';
 const base=eave+8,h=cabildo?64:58,w=cabildo?24:20;
 return <g data-building-tower={b.architecture} transform={`translate(${p.x} ${p.y-base})`}>
  <path d={`M${-w},0V-${h}H${w}V0Z`} fill={style.wall} stroke="#80765a"/>
  <path d={`M${w},0l12,-7V-${h+7}l-12,7Z`} fill="#998e6e"/>
  <path d={`M${-w-3},-${h}H${w+3}l12,-7H${-w+9}Z`} fill={style.trim} stroke="#847959"/>
  <path d={`M-9,-15V-${h-19}Q0,-${h-7} 9,-${h-19}V-15Z`} fill="#333b2e" stroke={style.trim} strokeWidth="3"/>
  {cabildo?<><circle cy={-h+10} r="7" fill="#e5d4a1" stroke="#5b523b"/><path d={`M0,-${h-5}v5h4`} fill="none" stroke="#454332" strokeWidth="1.2"/></>:<><path d="M-6,-18L-4,-30Q0,-36 4,-30L6,-18Z" fill="#a58c51"/><path d="M-7,-17H7" stroke="#d1b772" strokeWidth="2"/></>}
  <path d={`M${-w-1},-${h+7}Q${-w},-${h+23} 0,-${h+30}Q${w},-${h+23} ${w+1},-${h+7}Z`} fill={cabildo?'#8d8061':'#9d6547'} stroke="#544b36"/>
  <path d={`M0,-${h+29}v-16m-6,6h12`} stroke="#4e4934" strokeWidth="2"/>
  <path d={`M${-w},-7H${w}M${-w},-${h-3}H${w}`} stroke={style.trim} strokeWidth="3"/>
 </g>;
}
