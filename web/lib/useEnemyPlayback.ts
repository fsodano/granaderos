'use client';
import {useEffect,useRef,useState,useMemo} from 'react';
import {presentedEndTurn} from '../../game/tactical.js';
const stepMs=120;
export function useEnemyPlayback(committed:any,onChange:(state:any)=>any,onBusy?:(busy:boolean)=>void,validate?:(state:any)=>boolean,onFrame?:(before:any,after:any)=>void){
 const [frame,setFrame]=useState<any>(null),[busy,setBusy]=useState(false);
 const live=useRef(false),pending=useRef(false),epoch=useRef(0),sequence=useRef(0),latest=useRef(committed),worker=useRef<Worker|null>(null),request=useRef<any>(null);
 latest.current=committed;
 useEffect(()=>{
  live.current=true;epoch.current++;
  try{
   const w=new Worker(new URL('./enemy-turn-worker.ts',import.meta.url),{type:'module'});worker.current=w;
   w.onmessage=({data})=>{const r=request.current;if(worker.current!==w||!r||data.id!==r.id)return;request.current=null;data.error?r.reject(Error(data.error)):r.resolve(data.result);};
   const fail=()=>{request.current?.reject(Error('No se pudo completar el turno. Intentá de nuevo.'));request.current=null;w.terminate();worker.current=null;};w.onerror=fail;w.onmessageerror=fail;
  }catch{worker.current=null;}
  return()=>{live.current=false;epoch.current++;pending.current=false;request.current?.reject(Error('cancelled'));request.current=null;worker.current?.terminate();worker.current=null;onBusy?.(false);};
 },[]);
 async function run(){
  if(pending.current||!live.current)return;
  const source=committed,generation=epoch.current,current=()=>live.current&&epoch.current===generation&&latest.current===source;
  pending.current=true;setBusy(true);onBusy?.(true);
  try{
   const result:any=worker.current?await new Promise((resolve,reject)=>{const id=++sequence.current;request.current={id,resolve,reject};worker.current!.postMessage({id,state:source});}):await new Promise((resolve,reject)=>setTimeout(()=>{try{resolve(presentedEndTurn(source));}catch(error){reject(error);}},0));
   if(!current()||validate?.(result.state)===false)return;
   let cameraFocus:any=null,index=0,previous=source,grenadeEffect:any=null;
   for(const next of result.frames){
    if(!current())return;
    if(next.unitId&&cameraFocus?.id!==next.unitId){const actor=next.state.units.find((u:any)=>u.id===next.unitId);cameraFocus={id:actor.id,x:actor.x,y:actor.y,tacticalLevel:actor.tacticalLevel};}
    if(next.grenadeVisual)grenadeEffect={id:index,visual:next.grenadeVisual};
    setFrame({...next,index:index++,cameraFocus,grenadeEffect});
    onFrame?.(previous,next.state);previous=next.state;
    const delay=next.type==='effect'?450:next.type==='result'&&grenadeEffect?750:next.type==='step'?stepMs:next.type==='prepare'?(['fire','firePoint','melee','charge','artillery'].includes(next.action)?220:100):next.action==='move'||next.action==='climb'?0:120;
    await new Promise(resolve=>setTimeout(resolve,delay));
    if(next.type==='result')grenadeEffect=null;
   }
   if(current()){onFrame?.(previous,result.state);onChange(result.state);}
  }catch(error:any){if(current())onChange({...source,lastError:error.message});}
  finally{if(live.current&&epoch.current===generation){setFrame(null);setBusy(false);pending.current=false;onBusy?.(false);}}
 }
 const state=useMemo(()=>frame?{...frame.state,presentationVisibleIds:frame.visibleIds,presentationStepMs:stepMs,presentationMovingUnitId:frame.type==='step'?frame.unitId:null}:committed,[frame,committed]);
 return {state,busy,run,frame};
}
