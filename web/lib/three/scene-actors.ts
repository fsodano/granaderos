import type {ActorRuntime} from './actor-runtime';
import type {ActorVisual} from './presentation';

type SceneActorRuntime=Pick<ActorRuntime,'root'|'update'|'tick'>;
export type SceneActorEntry={runtime?:SceneActorRuntime;visual?:ActorVisual;pending?:boolean;error?:boolean};
type SceneActorFrame={visuals:readonly ActorVisual[];entry:(key:string)=>SceneActorEntry|undefined;active:(visual:ActorVisual)=>boolean;delta:number;now:number;ambientPaused?:boolean;reducedMotion?:boolean;report:(error:unknown)=>void};

/** Rebind every current admitted identity and visibility before a fitter reads
 * another actor. Advance its visible target's native skin before its own fit. */
export function advanceSceneActors({visuals,entry,active,delta,now,ambientPaused=false,reducedMotion=false,report}:SceneActorFrame){
 const ready:{visual:ActorVisual;actor:SceneActorEntry;runtime:SceneActorRuntime}[]=[];
 for(const visual of visuals){
  const actor=entry(visual.key),runtime=actor?.runtime;if(!actor||!runtime||actor.error)continue;
  try{
   if(actor.visual!==visual){runtime.update(visual,now);actor.visual=visual;}
   runtime.root.visible=active(visual);if(runtime.root.visible)ready.push({visual,actor,runtime});
  }catch(error){actor.error=true;report(error);}
 }
 // A normal recorded contact has one fitting actor. Its target can be later
 // in the scene list; it must not retain an old pose or visibility at contact.
 // Both groups tick exactly once. Pending/error/model admission stays with
 // the strict resolver; an old runtime can remain displayed while replacing.
 for(const contact of [false,true])for(const {visual,actor,runtime}of ready){
  if(Boolean(visual.cue?.contactTarget)!==contact||actor.error)continue;
  try{runtime.tick(ambientPaused&&visual.action==='idle'?0:delta,now,reducedMotion);}catch(error){actor.error=true;report(error);}
 }
 return ready.length;
}
