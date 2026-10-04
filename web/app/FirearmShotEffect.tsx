import {firearmFlightDuration} from '../../game/battle-playback.js';
import {projectSurface} from '../lib/tactical-elevation';
import {useEffect,useState} from 'react';

type Point={x:number;y:number;height:number;tacticalLevel?:number};
export type ShotVisual={source:Point;impact:Point;visible:boolean;outcome:'hit'|'cover'|'miss'|'pellets'|null;material?:string;spread?:boolean};
// Draw only the admitted, resolved ray. This component neither looks up a
// victim nor reads the complete roster to reconstruct a hidden shot.
export default function FirearmShotEffect({state,visual,stage,project}:{state:any;visual:ShotVisual;stage:'projectile'|'impact';project:(x:number,y:number)=>{x:number;y:number}}){
 const [reduced,setReduced]=useState(()=>typeof window!=='undefined'&&Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));
 useEffect(()=>{const query=window.matchMedia?.('(prefers-reduced-motion: reduce)');if(!query)return;const change=()=>setReduced(query.matches);change();query.addEventListener?.('change',change);return()=>query.removeEventListener?.('change',change);},[]);
 if(!visual?.visible||![visual.source,visual.impact].every(point=>point&&[point.x,point.y,point.height].every(Number.isFinite)))return null;
 const from=projectSurface(state,project,{...visual.source,renderedHeight:visual.source.height}),to=projectSurface(state,project,{...visual.impact,renderedHeight:visual.impact.height});
 const duration=`${firearmFlightDuration(visual)/1000}s`,angle=Math.atan2(to.y-from.y,to.x-from.x)*180/Math.PI;
 if(reduced)return <g data-firearm-reduced-motion={stage} pointerEvents="none" aria-hidden="true">
  {stage==='projectile'?<><circle cx={from.x} cy={from.y} r="2" fill="#c8ac75"/><ellipse cx={to.x} cy={to.y} rx="1.8" ry=".8" fill="#b8b6a6"/></>:visual.outcome&&visual.outcome!=='pellets'?<circle cx={to.x} cy={to.y} r="2.5" fill={visual.outcome==='hit'?'#794d40':'#a89576'}/>:null}
 </g>;
 if(stage==='projectile')return <g data-firearm-flight={visual.spread?undefined:'true'} data-firearm-discharge={visual.spread?'true':undefined} pointerEvents="none" aria-hidden="true">
  <g data-muzzle-flash="true" transform={`translate(${from.x} ${from.y}) rotate(${angle})`}>
   <path d="M0-2L8-4L5-1L12 0L5 1L8 4L0 2Z" fill="#c8ac75" opacity=".7"/>
   <animate attributeName="opacity" values="1;0" dur="0.09s" fill="freeze"/>
  </g>
  {!visual.spread&&<g opacity=".85">
   <animateMotion path={`M${from.x},${from.y} L${to.x},${to.y}`} dur={duration} rotate="auto" fill="freeze"/>
   <ellipse rx="1.8" ry=".8" fill="#b8b6a6" stroke="#3a3c32" strokeWidth=".6"/>
   <animate attributeName="opacity" values=".85;.85;0" keyTimes="0;.9;1" dur={duration} fill="freeze"/>
  </g>}
 </g>;
 if(!visual.outcome||visual.outcome==='pellets')return null;
 if(visual.outcome==='miss')return <g data-firearm-impact="miss" pointerEvents="none" aria-hidden="true" transform={`translate(${to.x} ${to.y})`}>
  <ellipse rx="1.8" ry=".8" fill="#b8b6a6" opacity=".7"><animate attributeName="opacity" values=".7;0" dur="0.6s" fill="freeze"/></ellipse>
 </g>;
 const body=visual.outcome==='hit',wood=visual.material==='wood',stone=['stone','brick'].includes(visual.material??''),color=body?'#794d40':wood?'#9b8060':stone?'#aaa79b':'#a89576';
 return <g data-firearm-impact={visual.outcome} data-impact-material={visual.material} pointerEvents="none" aria-hidden="true" transform={`translate(${to.x} ${to.y})`}>
  {!body&&<ellipse rx="3" ry="2" fill={color} opacity=".5">
   <animate attributeName="rx" values="3;11" dur="0.55s" fill="freeze"/>
   <animate attributeName="ry" values="2;6" dur="0.55s" fill="freeze"/>
   <animate attributeName="opacity" values=".5;.3;0" dur="0.6s" fill="freeze"/>
  </ellipse>}
  {[-1,0,1].map(offset=><path key={offset} d={wood?'M-1 0L2-2':'M0 0L1-1'} stroke={color} strokeWidth={body?2:1.4} opacity=".8">
   <animateTransform attributeName="transform" type="translate" values={`0 0;${offset*9} ${-5-Math.abs(offset)*4}`} dur="0.4s" fill="freeze"/>
   <animate attributeName="opacity" values=".8;.6;0" dur="0.5s" fill="freeze"/>
  </path>)}
 </g>;
}
