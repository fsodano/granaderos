'use client';
import {useEffect,useRef,useState} from 'react';
import {strategicClockInterrupt} from '../../game/strategic-clock.js';
export function useStrategicClock(state:any,dispatch:(action:any)=>void){
 const [running,setRunning]=useState(false),[speed,setSpeed]=useState(300),[cause,setCause]=useState('');
 const current=useRef(state),send=useRef(dispatch),pending=useRef<any>(null);
 current.current=state;send.current=dispatch;
 useEffect(()=>{
  if(pending.current&&pending.current!==state){
   const reason=strategicClockInterrupt(pending.current,state);pending.current=null;
   if(reason){setRunning(false);setCause(reason);}
  }
  if(state.pendingBattle||state.pendingEncounter||state.defeated)setRunning(false);
 },[state]);
 useEffect(()=>{
  if(!running)return;
  const timer=setInterval(()=>{
   if(pending.current||document.hidden)return;
   const before=current.current;
   if(before.pendingBattle||before.pendingEncounter||before.defeated){setRunning(false);return;}
   pending.current=before;send.current({type:'advanceStrategicTime',seconds:Math.max(1,Math.round(speed/4))});
  },250);
  return()=>clearInterval(timer);
 },[running,speed]);
 const blocked=state.pendingBattle||state.pendingEncounter||state.defeated;
 return {running,speed,cause:blocked?strategicClockInterrupt(state,state):cause,setSpeed,toggle:()=>{setCause('');setRunning(value=>!value);},pause:()=>setRunning(false)};
}
