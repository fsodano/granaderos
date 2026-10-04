'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {actorKey,actorPosture,semanticOrder,type ActorCue,type ActorEntry} from './presentation';
/** Cosmetic event IDs are separate from the simulation RNG and save data. */
export function useActorCues(sceneId:string,entries:readonly ActorEntry[]){
  const serial=useRef(0),previous=useRef<readonly ActorEntry[]>([]),[cues,setCues]=useState<Record<string,ActorCue>>({});
  const emit=useCallback((key:string,action:string,extra:Partial<ActorCue>={})=>{
    const cue={id:`${sceneId}:event:${++serial.current}`,action,startedAt:performance.now(),...extra};
    setCues(current=>({...current,[key]:cue}));
  },[sceneId]);
  const accepted=useCallback((unitId:string,type:string,request:any={})=>{const action=semanticOrder(type,request);if(action)emit(actorKey('unit',unitId),action);},[emit]);
  useEffect(()=>{previous.current=[];setCues({});},[sceneId]);
  useEffect(()=>{
    const before=new Map(previous.current.map(entry=>[entry.key,entry.actor]));previous.current=entries;
    for(const {key,actor}of entries){const old=before.get(key);if(!old)continue;
      if(actor.hp<=0&&old.hp>0)emit(key,'die',{fromPosture:old.mounted?'mounted':actorPosture(old)});
      else if(actor.unconscious&&!old.unconscious)emit(key,'collapse',{fromPosture:old.mounted?'mounted':actorPosture(old)});
      else if(!actor.unconscious&&old.unconscious&&actor.hp>0)emit(key,'recover');
      else if(actor.mounted!==old.mounted)emit(key,actor.mounted?'mount':'dismount',{fromPosture:old.mounted?'mounted':actorPosture(old)});
      else if(actorPosture(actor)!==actorPosture(old))emit(key,`stance:${actorPosture(old)}:${actorPosture(actor)}`,{fromPosture:actorPosture(old),toPosture:actorPosture(actor)});
    }
    const keys=new Set(entries.map(entry=>entry.key));setCues(current=>Object.keys(current).some(key=>!keys.has(key))?Object.fromEntries(Object.entries(current).filter(([key])=>keys.has(key))):current);
  },[entries,emit]);
  const complete=useCallback((key:string,id:string)=>setCues(current=>{if(current[key]?.id!==id)return current;const next={...current};delete next[key];return next;}),[]);
  return {cues,accepted,complete};
}
