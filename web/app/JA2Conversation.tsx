'use client';
import {sitePath} from '../lib/site-path.js';
import {useEffect,useRef,useState} from 'react';
import {portraitFor} from '../lib/portraits';
import {dialogueOptions} from '../../game/npc-dialogue.js';
import {beneficiaryDeliveryNotice} from '../../game/ja2-hud.js';
import './ja2-dialogue.css';
export type ConversationChoice={node?:string;id?:string;questResolution?:'cash'|'civic';questWithdrawal?:{questId:string;beneficiaryId?:string;deliveredCount:number}};
type Props={dialogue?:any;hireTerms?:any[];npc:any;conversation:any;quest:any;reason:string|null;canApproach:boolean;availability?:{code:string|null;reason:string|null;canApproach:boolean};responseOnly?:boolean;onApproach:()=>void;onTalk:(approach:string,term?:string,choice?:ConversationChoice)=>void;onClose:()=>void};
export default function JA2Conversation({dialogue,hireTerms=[],npc,conversation,quest,reason,canApproach,availability,responseOnly=false,onApproach,onTalk,onClose}:Props){
 const close=useRef<HTMLButtonElement>(null);
 const [selectedTerm,setTerm]=useState('day');
 const quote=hireTerms.find(q=>q.term===selectedTerm)??hireTerms[0];
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus();return()=>{if(previous?.isConnected)previous.focus();};},[npc.id]);
 const portrait=portraitFor(npc.portraitId??npc.operativeId??(npc.id==='yatasto-san-martin'?57:npc.id==='local-san_nicolas'?'avatar-woman-civilian':'avatar-man-soldier'));
 const current=conversation?.npcId===npc.id?conversation:null;
 const refusal=availability?.code==='refused'?availability.reason:null;
 const pendingResolution=!responseOnly&&quest?.status==='offered'&&Boolean(quest.rewardChoice);
 const beneficiaryNotice=quest?.beneficiaries&&!['completed','failed','withdrawn'].includes(quest.status)?beneficiaryDeliveryNotice({beneficiaries:quest.beneficiaries,beneficiaryId:quest.beneficiary?.id,selectedBeneficiaryId:quest.beneficiaryId}):null;
 const choices=responseOnly?[]:[...(dialogue?[['dialogue','Conversar']]:[]),...dialogueOptions(npc,quest)].filter(([approach])=>approach!=='questWithdraw'&&(approach!=='recruit'||npc.recruitable!==false)&&(!pendingResolution||approach!=='quest'));
 return <section className="ja2-conversation" role="dialog" aria-label={`Conversación con ${npc.name}`} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}}}>
  <div className="ja2-conversation-head"><figure>{portrait&&<img src={sitePath(portrait)} alt={npc.name}/>}<figcaption>{npc.name}</figcaption></figure>
   <div className="ja2-conversation-choices">{choices.map(([approach,label])=><button key={approach} disabled={Boolean(reason)||approach==='recruit'&&Boolean(quote&&!quote.available)} onClick={()=>onTalk(approach,approach==='recruit'?quote?.term:undefined)}>{approach==='recruit'&&quote?`Contratar · ${quote.price} pesos`:label}</button>)}
    {pendingResolution&&<><button disabled={Boolean(reason)||!quest.resolutionReady} onClick={()=>onTalk('quest',undefined,{questResolution:'cash'})}>Cobrar reintegro · {quest.rewardChoice.reimbursement} pesos</button><button disabled={Boolean(reason)||!quest.resolutionReady} onClick={()=>onTalk('quest',undefined,{questResolution:'civic'})}>Renunciar al reintegro · apoyo local +8</button></>}
    {!responseOnly&&quest?.withdrawalChoice&&<button disabled={Boolean(reason)} onClick={()=>onTalk('questWithdraw',undefined,{questWithdrawal:quest.withdrawalChoice})}>Retirar el compromiso · apoyo local −{quest.withdrawal.supportCost}</button>}
    <button ref={close} onClick={onClose}>Listo</button></div>
  </div>
  <p className="ja2-conversation-text" aria-live="polite">«{refusal??current?.text??npc.greeting??'Te escucho.'}»</p>
  {!responseOnly&&quote&&<div className="ja2-conversation-text"><label>Duración del contrato<select value={quote.term} onChange={event=>setTerm(event.target.value)}>{hireTerms.map(q=><option key={q.term} value={q.term}>{q.name} · {q.price} pesos</option>)}</select></label><p>Se paga al incorporarse. El servicio comienza aquí y dura {quote.hours/24} {quote.hours===24?'día':'días'}.</p>{quote.reason&&<p>{quote.reason}</p>}</div>}
  {!responseOnly&&current?.outcome==='dialogue'&&dialogue&&<div className="ja2-conversation-choices">{dialogue.choices.map((choice:any)=><button key={choice.id} disabled={Boolean(reason)||choice.available===false} onClick={()=>onTalk('dialogue',undefined,{node:dialogue.node,id:choice.id})}>{choice.label}{choice.effectLabel&&<small>{choice.effectLabel}{choice.reason?` · ${choice.reason}`:''}</small>}</button>)}</div>}
  {current?.dialogueEffect&&<div className="ja2-conversation-text">{current.dialogueEffect.applied?<>{Boolean(current.dialogueEffect.amount)&&<p>{current.dialogueEffect.amount>0?'Recibiste':'Pagaste'} {Math.abs(current.dialogueEffect.amount)} pesos.</p>}{current.dialogueEffect.movement&&<p>{current.dialogueEffect.movement.name} {current.dialogueEffect.movement.destination==='routine'?'queda libre para retomar su rutina.':'recibió la llamada para venir a este lugar.'}</p>}{current.dialogueEffect.quest&&<p>{current.dialogueEffect.quest.title}: {current.dialogueEffect.quest.status==='active'?'en curso':current.dialogueEffect.quest.status==='completed'?'completado':'fallido'}.</p>}</>:<p>Esta operación ya se realizó; no se repite.</p>}</div>}
  {quest?.carried&&<p className="ja2-conversation-text">{quest.carried.label} recibidos: {npc.questGifts?.length??0}/{quest.carried.count}.</p>}
  {!responseOnly&&beneficiaryNotice&&<p className="ja2-conversation-text">{beneficiaryNotice}{quest.status==='offered'&&quest.beneficiaryId&&<>{quest.resolutionReady?' Entrega completa. Confirmá el encargo al conversar con el destinatario.':' Completá la entrega y las condiciones. Después, conversá con el destinatario para confirmar.'}</>}</p>}
  {!responseOnly&&quest?.withdrawalChoice&&<p className="ja2-conversation-text">Retirar el compromiso reduce el apoyo de la localidad en hasta {quest.withdrawal.supportCost} puntos, sin bajar de cero. Los objetos entregados quedan con el destinatario; conservás los restantes. El encargo termina sin recompensa ni reintegro.</p>}
  {pendingResolution&&!quest.resolutionReady&&<p className="ja2-conversation-reason">Completá la entrega y las condiciones del encargo antes de elegir la recompensa.</p>}
  {reason&&!refusal&&!responseOnly&&<div className="ja2-conversation-reason"><p>{reason}</p>{canApproach&&(!availability||availability.canApproach)&&<button onClick={onApproach}>Acercarse para conversar</button>}</div>}
 </section>;
}
export function JA2Speech({name,text,position,onClose}:{name:string;text:string;position:{left:number;top:number};onClose:()=>void}){
 return <aside className="ja2-speech" style={{left:`clamp(min(50%, 150px), ${position.left}%, max(50%, calc(100% - 150px)))`,top:`${position.top}%`}} role="status" aria-label={`Respuesta de ${name}`}><p>«{text}»</p><button onClick={onClose} aria-label="Cerrar respuesta">×</button></aside>;
}
