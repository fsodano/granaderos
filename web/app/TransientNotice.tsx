'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import './transient-notice.css';

type Notice={message:string;id:number};
type Props={message?:string|null;eventKey?:unknown;onDismiss?:()=>void;durationMs?:number};

export function noticeText(message:string){
  return message==='Destino inaccesible o puntos de acción insuficientes.'?'Sin ruta o sin PA.':message;
}

export function useTransientNotice(){
  const [notice,set]=useState<Notice|null>(null);
  const sequence=useRef(0);
  const setNotice=useCallback((message:string)=>{
    set(message?{message,id:++sequence.current}:null);
  },[]);
  return [notice,setNotice] as const;
}

export default function TransientNotice({message,eventKey,onDismiss,durationMs=4000}:Props){
  const [display,setDisplay]=useState({visible:Boolean(message),sequence:0});
  const dismiss=useRef(onDismiss);dismiss.current=onDismiss;
  const activeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{
    if(!message){setDisplay(previous=>({...previous,visible:false}));return;}
    setDisplay(previous=>({visible:true,sequence:previous.sequence+1}));
    const timer=setTimeout(()=>{
      activeTimer.current=null;
      setDisplay(previous=>({...previous,visible:false}));
      dismiss.current?.();
    },durationMs);
    activeTimer.current=timer;
    return ()=>{clearTimeout(timer);if(activeTimer.current===timer)activeTimer.current=null;};
  },[message,eventKey,durationMs]);
  if(!message||!display.visible)return null;
  const text=noticeText(message);
  return <div className="transient-notice" role="status" aria-live="polite" aria-atomic="true">
    <span key={display.sequence} title={text!==message?message:undefined}>{text}</span>
    <button type="button" aria-label="Cerrar aviso" onClick={()=>{
      if(activeTimer.current!==null){clearTimeout(activeTimer.current);activeTimer.current=null;}
      setDisplay(previous=>({...previous,visible:false}));dismiss.current?.();
    }}><span aria-hidden="true">×</span></button>
  </div>;
}
