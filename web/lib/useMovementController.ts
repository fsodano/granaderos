'use client';
import {useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import {unitCanAct} from '../../game/ja2-hud.js';
import {createMovementController} from './movement-controller.js';

export function useMovementController(run:(action:any,kind:any,continuation?:any)=>Promise<any>,commit:(next:any,action:any,source:any)=>any){
 const latest=useRef({run,commit});latest.current={run,commit};
 const controller=useRef<ReturnType<typeof createMovementController>|null>(null);
 if(!controller.current)controller.current=createMovementController({
  execute:(action:any,continuation:any)=>latest.current.run(action,'movement-step',continuation),
  commit:(next:any,action:any,source:any)=>latest.current.commit(next,action,source),
  canMove:(state:any,id:string)=>unitCanAct(state,state.units.find((unit:any)=>unit.id===id)),
 });
 const current=controller.current;
 const intent=useSyncExternalStore(current.subscribe,current.getSnapshot,current.getSnapshot);
 useEffect(()=>{current.setEnabled(true);return()=>current.setEnabled(false);},[current]);
 const continuingIds=useMemo(()=>new Set<string>(intent?[intent.unitId]:[]),[intent?.unitId]);
 return {intent,continuingIds,request:current.request,cancel:current.cancel,observe:current.observe,isActive:(id:string)=>current.getSnapshot()?.unitId===id};
}
