import {absoluteBodyHeight} from '../../game/sight-geometry.js';
import {tacticalLevel} from '../../game/tactical-space.js';
import {projectSurface} from '../lib/tactical-elevation';

export const KNIFE_EFFECT_DURATION=600;
type Point={x:number;y:number;tacticalLevel?:number};
export type KnifeVisual={source:Point&{height?:number};impact:Point&{height:number};landing:Point;weapon:number;visible:boolean};
// The reducer supplies only the observed flight. This component must never
// resolve victims or extend that segment using the complete battle roster.
export default function KnifeThrowEffect({state,visual,project}:{state:any;visual:KnifeVisual|null;project:(x:number,y:number)=>{x:number;y:number}}){
 if(!visual?.visible)return null;
 const height=visual.source.height??absoluteBodyHeight(state,{...visual.source,stance:'standing'},'muzzle');
 if(![visual.source.x,visual.source.y,visual.impact.x,visual.impact.y,visual.impact.height,height].every(Number.isFinite))return null;
 const from=projectSurface(state,project,{...visual.source,renderedHeight:height!});
 const to=projectSurface(state,project,{...visual.impact,tacticalLevel:visual.impact.tacticalLevel??tacticalLevel(visual.landing),renderedHeight:visual.impact.height});
 return <g data-knife-flight="true" pointerEvents="none" aria-hidden="true">
  <g>
   <animateMotion path={`M${from.x},${from.y} L${to.x},${to.y}`} dur="0.35s" rotate="auto" fill="freeze"/>
   <path d="M-6 0H0L7-1L3 1H0" fill="#d9dfd0" stroke="#303b36" strokeWidth=".8"/>
   <path d="M-6 0H-1" stroke="#765536" strokeWidth="2"/>
   <animate attributeName="opacity" values="1;1;0" keyTimes="0;.65;1" dur="0.55s" fill="freeze"/>
  </g>
 </g>;
}
