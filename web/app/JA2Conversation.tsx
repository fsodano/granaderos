'use client';
import {useEffect,useRef} from 'react';
import {portraitFor} from '../lib/portraits';
import {dialogueOptions} from '../../game/npc-dialogue.js';
import './ja2-dialogue.css';
type Props={npc:any;conversation:any;quest:any;reason:string|null;canApproach:boolean;onApproach:()=>void;onTalk:(approach:string)=>void;onClose:()=>void};
export default function JA2Conversation({npc,conversation,quest,reason,canApproach,onApproach,onTalk,onClose}:Props){
 const close=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus();return()=>{if(previous?.isConnected)previous.focus();};},[npc.id]);
 const portrait=portraitFor(npc.portraitId??npc.operativeId??(npc.id==='yatasto-san-martin'?57:npc.id==='local-san_nicolas'?'avatar-woman-civilian':'avatar-man-soldier'));
 const current=conversation?.npcId===npc.id?conversation:null;
 const choices=dialogueOptions(npc,quest).filter(([approach])=>!current?.options||current.options.includes(approach));
 return <section className="ja2-conversation" role="dialog" aria-label={`Conversación con ${npc.name}`} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}}}>
  <div className="ja2-conversation-head"><figure>{portrait&&<img src={portrait} alt={npc.name}/>}<figcaption>{npc.name}</figcaption></figure>
   <div className="ja2-conversation-choices">{choices.map(([approach,label])=><button key={approach} disabled={Boolean(reason)} onClick={()=>onTalk(approach)}>{label}</button>)}<button ref={close} onClick={onClose}>Listo</button></div>
  </div>
  <p className="ja2-conversation-text" aria-live="polite">«{current?.text??npc.greeting??'Te escucho.'}»</p>
  {reason&&<div className="ja2-conversation-reason"><p>{reason}</p>{canApproach&&<button onClick={onApproach}>Acercarse para conversar</button>}</div>}
 </section>;
}
export function JA2Speech({name,text,position,onClose}:{name:string;text:string;position:{left:number;top:number};onClose:()=>void}){
 return <aside className="ja2-speech" style={{left:`clamp(min(50%, 150px), ${position.left}%, max(50%, calc(100% - 150px)))`,top:`${position.top}%`}} role="status" aria-label={`Respuesta de ${name}`}><p>«{text}»</p><button onClick={onClose} aria-label="Cerrar respuesta">×</button></aside>;
}
