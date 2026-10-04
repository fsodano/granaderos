'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {actorKey,semanticOrder,observedActorTransitions,admittedImpactCue,type ActorCue,type ActorEntry} from './presentation';
/** Cosmetic event IDs are separate from the simulation RNG and save data. */
export function useActorCues(sceneId:string,entries:readonly ActorEntry[],frame?:any){
  const serial=useRef(0),previous=useRef<readonly ActorEntry[]>([]),[cues,setCues]=useState<Record<string,ActorCue>>({});
  const emit=useCallback((key:string,action:string,extra:Partial<ActorCue>={})=>{
    const cue={id:`${sceneId}:event:${++serial.current}`,action,startedAt:performance.now(),...extra};
    setCues(current=>({...current,[key]:cue}));
  },[sceneId]);
  const accepted=useCallback((unitId:string,type:string,request:any={})=>{const action=semanticOrder(type,request,entries.find(entry=>entry.kind==='unit'&&entry.actor.id===unitId)?.actor);if(action)emit(actorKey('unit',unitId),action);},[emit,entries]);
  useEffect(()=>{previous.current=[];setCues({});},[sceneId]);
  useEffect(()=>{
    const changes=observedActorTransitions(previous.current,entries);
    // Retain values, not references into a caller's mutable state objects.
    previous.current=entries.map(entry=>({...entry,actor:{hp:entry.actor.hp,unconscious:entry.actor.unconscious,knockedDown:entry.actor.knockedDown,mounted:entry.actor.mounted,stance:entry.actor.stance,movementMode:entry.actor.movementMode}}));
    for(const {key,action,extra}of changes){
      const entry=entries.find(entry=>entry.key===key);
      // The direct frame renderer and HP observer share one ID. Completing
      // the frame reaction also clears the retained HP cue instead of replaying it.
      const impact=action==='hit'&&entry?admittedImpactCue(entry,frame):undefined;
      emit(key,action,{...extra,...impact});
    }
    const keys=new Set(entries.map(entry=>entry.key));setCues(current=>Object.keys(current).some(key=>!keys.has(key))?Object.fromEntries(Object.entries(current).filter(([key])=>keys.has(key))):current);
  },[entries,emit,frame]);
  const complete=useCallback((key:string,id:string)=>setCues(current=>{if(current[key]?.id!==id)return current;const next={...current};delete next[key];return next;}),[]);
  return {cues,accepted,complete};
}
