'use client';
import {useEffect,useRef,useState} from 'react';
import {createBattleExecutor} from './battle-executor.js';
import {createLatestPreview} from './latest-preview.js';
import battleWorkerUrl from './battle-worker.ts?worker&url';

export function useBattlePreview(battle:any,request:any,kind:string){
 const queue=useRef<ReturnType<typeof createLatestPreview>|null>(null);
 const [resolved,setResolved]=useState<{battle:any;request:any;kind:string;preview:any;error:boolean}|null>(null);
 useEffect(()=>{
  let executor:ReturnType<typeof createBattleExecutor>|null=null;
  const current=createLatestPreview(async (job:any)=>{
   executor??=createBattleExecutor(new Worker(battleWorkerUrl,{type:'module'}));
   const running=executor;
   try{return await running.run(job);}
   catch(error){
    // A failed worker stays closed. Release it so the next pointer/selection
    // request can recover without reopening the battlefield.
    running.close();if(executor===running)executor=null;
    throw error;
   }
  },(job:any,preview:any,error:unknown)=>setResolved({battle:job.battle,request:job.action,kind:job.kind,preview:error?null:preview,error:Boolean(error)}));
  queue.current=current;
  return()=>{current.close();executor?.close();queue.current=null;};
 },[]);
 useEffect(()=>{
  queue.current?.request(request?{battle,action:request,kind}:null);
 },[battle,request,kind]);
 const current=Boolean(request&&resolved?.battle===battle&&resolved?.request===request&&resolved?.kind===kind);
 return {preview:current?resolved!.preview:null,working:Boolean(request&&!current),failed:current&&resolved!.error};
}
