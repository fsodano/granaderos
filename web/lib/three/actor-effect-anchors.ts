import type {ActorRuntime} from './actor-runtime';
import type {ActorVisual} from './presentation';
import type {CombatEffectEvent,EffectPoint} from './combat-effects';
import {TILE_METRES} from './projection';

type Entry={visual?:ActorVisual;runtime?:ActorRuntime;pending?:boolean;error?:boolean};
/** Resolve only loaded bodies in the current admitted frame. Native event
 * records remain immutable; endpoint corrections are render data only. */
export function withActorEffectAnchors(event:CombatEffectEvent,admitted:readonly ActorVisual[],entry:(key:string)=>Entry|undefined):CombatEffectEvent{
 if(event.kind!=='firearm')return event;
 const actor=(key:string|undefined)=>{
  if(!key)return;const matches=admitted.filter(v=>v.key===key),v=matches.length===1?matches[0]:undefined,e=entry(key),r=e?.runtime;
  if(v&&e?.visual===v&&!e.pending&&!e.error&&r?.root.visible&&r.asset.appearance.id===v.appearance)return r;
 };
 const point=(p:{x:number;y:number;z:number}):EffectPoint=>({x:p.x/TILE_METRES,y:p.z/TILE_METRES,height:p.y});
 const visual=event.visual,sourceActor=actor(visual.discharge===false?visual.sourceBodyKey:event.actorKey),sourceAnchor=sourceActor&&(visual.discharge===false?sourceActor.bodyAnchor(visual.source.height):sourceActor.anchor('muzzle',visual.shotHand==='offhand'?'handLeft':visual.shotHand==='primary'?'handRight':undefined)),targetAnchor=actor(visual.bodyTargetKey)?.bodyAnchor(visual.impact.height);
 if(!sourceAnchor&&!targetAnchor)return event;
 const source=sourceAnchor?point(sourceAnchor):{...visual.source},impact=targetAnchor?point(targetAnchor):{...visual.impact},native=visual.points??[visual.source,visual.impact],distance=[0];
 for(let i=1;i<native.length;i++)distance.push(distance[i-1]+Math.hypot(native[i].x-native[i-1].x,native[i].y-native[i-1].y));
 const total=distance.at(-1)??0,from=source.height-visual.source.height,to=impact.height-visual.impact.height,points=native.map((p,i)=>{const f=total>0?distance[i]/total:i/(native.length-1);return {...p,height:p.height+from*(1-f)+to*f};});
 // Interior XY samples retain the resolved horizontal route. Only displayed
 // body/muzzle endpoints attach to their actual current scene instances.
 points[0]={...points[0],...source};points[points.length-1]={...points.at(-1)!,...impact};
 return {...event,...(sourceAnchor&&visual.discharge!==false?{dischargeAnchor:source}:{}),renderedPath:{source,impact,points}};
}
