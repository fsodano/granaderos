'use client';
import {useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import {unitCanAct,groupSelectionMode} from '../../game/ja2-hud.js';
import {createMovementController} from './movement-controller.js';

export function useMovementController(run:(action:any,kind:any,continuation?:any)=>Promise<any>,commit:(next:any,action:any,source:any,result?:any)=>any){
 const latest=useRef({run,commit});latest.current={run,commit};
 const controller=useRef<ReturnType<typeof createMovementController>|null>(null);
 if(!controller.current)controller.current=createMovementController({
  execute:(action:any,continuation:any)=>latest.current.run(action,action.type==='groupMove'?'group-step':'movement-step',continuation),
  commit:(next:any,action:any,source:any,result:any)=>latest.current.commit(next,action,source,result),
  canMove:(state:any,id:string,action:any)=>action.type==='groupMove'?groupSelectionMode(state)&&action.unitIds.some((id:string)=>unitCanAct(state,state.units.find((unit:any)=>unit.id===id))):unitCanAct(state,state.units.find((unit:any)=>unit.id===id)),
 });
 const current=controller.current;
 const intent=useSyncExternalStore(current.subscribe,current.getSnapshot,current.getSnapshot);
 useEffect(()=>{current.setEnabled(true);return()=>current.setEnabled(false);},[current]);
 const continuingIds=useMemo(()=>new Set<string>(intent?[intent.movingUnitId]:[]),[intent?.movingUnitId]);
 return {intent,continuingIds,request:current.request,cancel:current.cancel,observe:current.observe,isActive:(id:string)=>{const currentIntent=current.getSnapshot();return currentIntent?.unitId===id||currentIntent?.action.unitIds?.includes(id);}};
}
