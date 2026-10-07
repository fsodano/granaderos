'use client';
import {useEffect,useRef,useState,useMemo} from 'react';
import {presentedEndTurn} from '../../game/tactical.js';
import {BATTLE_PLAYBACK,battleFrameDuration,battleFrameFocus} from '../../game/battle-playback.js';
import {movementStepDuration} from './three/movement-timing';
import {nativeActionFrameDuration} from './three/action-timing';
import enemyWorkerUrl from './enemy-turn-worker.ts?worker&url';
const stepMs=BATTLE_PLAYBACK.step;
export function presentedFrameDuration(frame:any,previous:any){
 if(frame.type!=='step'||!frame.unitId)return nativeActionFrameDuration(frame,battleFrameDuration(frame));
 const actor=frame.state.units.find((unit:any)=>unit.id===frame.unitId),before=previous.units.find((unit:any)=>unit.id===frame.unitId);
 if(!actor||!before)return stepMs;
 // Each observed step is adjacent. Reappearing actors do not expose the
 // distance they travelled outside sight through a longer playback delay.
 const distance=Math.hypot(actor.x-before.x,actor.y-before.y);
 if(distance>Math.SQRT2+.000001||distance===0)return stepMs;
 const endpoint=actor.lastMovePath?.at(-1)??actor;
 return movementStepDuration(actor,before,endpoint,stepMs);
}
export function useEnemyPlayback(committed:any,onChange:(state:any)=>any,onBusy?:(busy:boolean)=>void,validate?:(state:any)=>boolean,onFrame?:(before:any,after:any)=>void){
 const [frame,setFrame]=useState<any>(null),[busy,setBusy]=useState(false);
 const live=useRef(false),pending=useRef(false),epoch=useRef(0),sequence=useRef(0),presentationSequence=useRef(0),latest=useRef(committed),worker=useRef<Worker|null>(null),request=useRef<any>(null);
 latest.current=committed;
 useEffect(()=>{
  live.current=true;epoch.current++;
  try{
   const w=new Worker(enemyWorkerUrl,{type:'module'});worker.current=w;
   w.onmessage=({data})=>{const r=request.current;if(worker.current!==w||!r||data.id!==r.id)return;request.current=null;data.error?r.reject(Error(data.error)):r.resolve(data.result);};
   const fail=()=>{request.current?.reject(Error('No se pudo completar el turno. Intentá de nuevo.'));request.current=null;w.terminate();worker.current=null;};w.onerror=fail;w.onmessageerror=fail;
  }catch{worker.current=null;}
  return()=>{live.current=false;epoch.current++;pending.current=false;request.current?.reject(Error('cancelled'));request.current=null;worker.current?.terminate();worker.current=null;onBusy?.(false);};
 },[]);
 async function play(execute:()=>Promise<any>|any,commit:(state:any)=>any=onChange){
  if(pending.current||!live.current)return;
  const source=committed,generation=epoch.current,current=()=>live.current&&epoch.current===generation&&latest.current===source;
  pending.current=true;setBusy(true);onBusy?.(true);
  try{
   const result:any=await execute();
   if(!current()||validate?.(result.state)===false)return;
   let cameraFocus:any=null,index=0,previous=source,grenadeEffect:any=null,actionId=0,actionStartedAt=0,actionDurationMs=0;
   const sequenceId=`${generation}:${++presentationSequence.current}`;
   let timingState=source;const durations=result.frames.map((next:any)=>{const duration=presentedFrameDuration(next,timingState);timingState=next.state;return duration;});
   for(const next of result.frames){
    if(!current())return;
    cameraFocus=battleFrameFocus(next)??cameraFocus;
    const startedAt=performance.now();
    if(next.grenadeVisual)grenadeEffect={id:index,startedAt,visual:next.grenadeVisual};
    if(next.type==='prepare'||index===0){actionId++;actionStartedAt=performance.now();actionDurationMs=0;for(let cursor=index;cursor<result.frames.length;cursor++){if(cursor>index&&result.frames[cursor].type==='prepare')break;actionDurationMs+=durations[cursor];}}
    const delay=durations[index];
    setFrame({...next,index:index++,cameraFocus,grenadeEffect,sequenceId,actionId,actionStartedAt,actionDurationMs,startedAt,durationMs:delay});
    onFrame?.(previous,next.state);previous=next.state;
    await new Promise(resolve=>setTimeout(resolve,delay));
    if(next.type==='result')grenadeEffect=null;
   }
   if(current()){onFrame?.(previous,result.state);return commit(result.state);}
  }catch(error:any){if(current())onChange({...source,lastError:error.message});}
  finally{if(live.current&&epoch.current===generation){setFrame(null);setBusy(false);pending.current=false;onBusy?.(false);}}
 }
 function run(){return play(()=>worker.current?new Promise((resolve,reject)=>{const id=++sequence.current;request.current={id,resolve,reject};worker.current!.postMessage({id,state:committed});}):new Promise((resolve,reject)=>setTimeout(()=>{try{resolve(presentedEndTurn(committed));}catch(error){reject(error);}},0)));}
 function present(result:any,commit:(state:any)=>any){return play(()=>result,commit);}
 const state=useMemo(()=>frame?{...frame.state,presentationVisibleIds:frame.visibleIds,presentationStepMs:frame.type==='step'?frame.durationMs:stepMs,presentationMovingUnitId:frame.type==='step'?frame.unitId:null}:committed,[frame,committed]);
 return {state,busy,run,present,frame};
}
