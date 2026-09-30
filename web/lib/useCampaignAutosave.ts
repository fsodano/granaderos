'use client';
import {useEffect,useRef} from 'react';
import {encodeSave} from '../../game/save.js';
import {createCampaignAutosave} from './campaign-autosave.js';
import saveWorkerUrl from './campaign-save-worker.ts?worker&url';

export function useCampaignAutosave(campaign:any,battle:any,key:(campaign:any)=>string,onSaved:()=>void,onError:()=>void){
 const queue=useRef<ReturnType<typeof createCampaignAutosave>|null>(null);
 const callbacks=useRef({key,onSaved,onError});callbacks.current={key,onSaved,onError};
 useEffect(()=>{
  let worker:Worker|null=null;try{worker=new Worker(saveWorkerUrl,{type:'module'});}catch{}
  const saver=createCampaignAutosave({worker,encode:encodeSave,write:(text:string,key:string)=>localStorage.setItem(key,text),onSaved:()=>callbacks.current.onSaved(),onError:()=>callbacks.current.onError()});
  queue.current=saver;
  const flush=()=>saver.flush(),hide=()=>{if(document.hidden)flush();};
  window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',hide);
  return()=>{window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',hide);saver.flush();saver.close();if(queue.current===saver)queue.current=null;};
 },[]);
 useEffect(()=>{queue.current?.submit(campaign,battle,callbacks.current.key(campaign));},[campaign,battle]);
 return ()=>queue.current?.flush();
}
