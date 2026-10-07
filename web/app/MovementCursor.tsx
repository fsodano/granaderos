import {formatAP} from '../../game/action-points.js';
import {projectSurface} from '../lib/tactical-elevation';
import './playtest-feedback.css';
export default function MovementCursor({state,unit,preview,project,scale=1}:{state:any;unit:any;preview:any;project:(x:number,y:number)=>{x:number;y:number};scale?:number}){
 if(!preview?.movement||!preview.path?.length)return null;
 const mode=unit.movementMode??'walk',destination=projectSurface(state,project,preview.path.at(-1)),insufficient=state.mode!=='exploration'&&preview.pa>unit.ap;
 const status=unit.stealthMode?'stealth':insufficient?'insufficient':'doable';
 const label=({walk:'Caminar',run:'Correr',crouch:'Agachado',prone:'Cuerpo a tierra'} as Record<string,string>)[mode]??'Caminar';
 return <g className={`movement-route ${status}`} data-movement-preview={mode} pointerEvents="none" aria-label={`${label}: ${formatAP(preview.pa)} PA${insufficient?' · PA insuficientes':''}${unit.stealthMode?' · Sigilo':''}`}>
  {preview.path.map((cell:any,index:number)=>{const point=projectSurface(state,project,cell);return <g key={index} transform={`translate(${point.x} ${point.y})`}><ellipse cx="-5" cy="-1" rx="2.7" ry="4.1" transform="rotate(-40)"/><ellipse cx="5" cy="1" rx="2.7" ry="4.1" transform="rotate(-40)"/></g>;})}
  <g transform={`translate(${destination.x} ${destination.y-28*scale}) scale(${scale})`} className="movement-cost">
   {mode==='prone'?<path d="M-25 2h14l8 5m-12-5l5-5m-18 5h-5"/>:mode==='crouch'?<path d="M-23-3l7 5-9 6h10m-7-10l8 2"/>:<path d={mode==='run'?'M-23-6l-5 8-7-2m10-2l9 5 4-7m-13-1l9-5':'M-24-5v9l-6 6m6-6l6 6m-6-13l-6 4m6-4l7 4'}/>}
   <circle cx={mode==='prone'?-32:-24} cy={mode==='prone'?0:mode==='crouch'?-7:-10} r="3"/>
   <text x="9" y="5" textAnchor="middle">{formatAP(preview.pa)} PA</text>
  </g>
 </g>;
}
