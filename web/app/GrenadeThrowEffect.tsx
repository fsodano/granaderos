import {projectSurface} from '../lib/tactical-elevation';

export const GRENADE_EFFECT_DURATION=1200;
type Point={x:number;y:number;tacticalLevel?:number};
type FlightPoint=Point&{height:number;fraction?:number};
export type GrenadeVisual={source:FlightPoint;impact:FlightPoint;landing:Point;points:FlightPoint[];radius:number;detonated:boolean;visible:boolean};
// Use only the observed flight supplied by the reducer. Hidden people and the
// full damage result are never needed to draw this short-lived effect.
export default function GrenadeThrowEffect({state,visual,project}:{state:any;visual:GrenadeVisual|null;project:(x:number,y:number)=>{x:number;y:number}}){
 if(!visual?.visible)return null;
 const {source,impact,landing,points,radius}=visual;
 if(!source||!impact||!landing||!Array.isArray(points)||points.length<2||points.length>256||!Number.isFinite(radius)||radius<0||radius>20)return null;
 if(![source,impact,...points].every(point=>[point?.x,point?.y,point?.height].every(Number.isFinite))||![landing.x,landing.y].every(Number.isFinite))return null;
 const path=points.map((point,index)=>{const p=projectSurface(state,project,{...point,renderedHeight:point.height});return `${index?'L':'M'}${p.x},${p.y}`;}).join(' ');
 const from=projectSurface(state,project,source),to=projectSurface(state,project,landing);
 const a=project(landing.x+radius,landing.y),b=project(landing.x,landing.y+radius),center=project(landing.x,landing.y);
 const rx=Math.hypot(a.x-center.x,b.x-center.x),ry=Math.hypot(a.y-center.y,b.y-center.y);
 return <g data-grenade-flight="true" pointerEvents="none" aria-hidden="true">
  <ellipse data-grenade-shadow="true" rx="3.5" ry="1.5" fill="#090d09" opacity=".35">
   <animateMotion path={`M${from.x},${from.y} L${to.x},${to.y}`} dur="0.45s" fill="freeze"/>
   <animate attributeName="opacity" values=".35;.35;0" keyTimes="0;.8;1" dur="0.5s" fill="freeze"/>
  </ellipse>
  <g>
   <animateMotion path={path} dur="0.45s" fill="freeze"/>
   <circle r="3" fill="#30362a" stroke="#c8bd8b" strokeWidth=".7"/>
   <path d="M0-3L1-5" stroke="#d9be75" strokeWidth="1"/>
   <animate attributeName="opacity" values="1;1;0" keyTimes="0;.9;1" dur="0.5s" fill="freeze"/>
  </g>
  {visual.detonated&&<g data-grenade-blast="true" transform={`translate(${to.x} ${to.y})`} opacity="0">
   <animate attributeName="opacity" values="0;1;.8;0" keyTimes="0;.04;.35;1" begin="0.45s" dur="0.7s" fill="freeze"/>
   <ellipse rx={rx} ry={ry} fill="#ce9950" fillOpacity=".18" stroke="#d6b370" strokeWidth="1.4"/>
   <ellipse rx="10" ry="6" fill="#f1dab0">
    <animate attributeName="rx" values="5;17;9" begin="0.45s" dur="0.25s" fill="freeze"/>
    <animate attributeName="opacity" values="1;1;0" begin="0.45s" dur="0.3s" fill="freeze"/>
   </ellipse>
   {[-1,0,1].map(offset=><ellipse key={offset} cx={offset*8} cy={-5-Math.abs(offset)*3} rx="10" ry="9" fill="#535348" fillOpacity=".65">
    <animate attributeName="cy" values={`${-5-Math.abs(offset)*3};${-22-Math.abs(offset)*5}`} begin="0.5s" dur="0.65s" fill="freeze"/>
    <animate attributeName="rx" values="8;18" begin="0.5s" dur="0.65s" fill="freeze"/>
   </ellipse>)}
  </g>}
 </g>;
}
