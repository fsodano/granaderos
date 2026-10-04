'use client';
import {useEffect,useRef,type ReactNode} from 'react';

export default function StrategicPanel({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 const dialog=useRef<HTMLElement>(null);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  dialog.current?.querySelector<HTMLElement>('button')?.focus();
  return ()=>{if(previous?.isConnected)previous.focus();};
 },[]);
 return <div className="strategic-panel-backdrop" onClick={onClose}><section ref={dialog} className="strategic-panel-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={event=>event.stopPropagation()} onKeyDown={event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}
  if(event.key==='Tab'){
   const controls=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"],a[href],summary')??[]).filter(control=>{
    if(control.closest('[hidden],[inert]'))return false;
    for(let parent=control.parentElement;parent&&parent!==dialog.current;parent=parent.parentElement){
     if(parent.tagName==='DETAILS'&&!parent.hasAttribute('open')&&!parent.querySelector(':scope > summary')?.contains(control))return false;
    }
    return true;
   });
   const first=controls[0],last=controls.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
 }}><header><h2>{title}</h2><button className="line-button" aria-label="Cerrar panel de campaña" onClick={onClose}>Cerrar ×</button></header><div className="strategic-panel-body">{children}</div></section></div>;
}
