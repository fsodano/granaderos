'use client';
import {useState} from 'react';
export function receivedCorrespondence(state:any){
 // Only an actual received message is shown. NPC discovery is not mail.
 return Array.isArray(state.correspondence)?state.correspondence.filter((m:any)=>m&&m.received===true&&typeof m.sender==='string'&&typeof m.text==='string'):[];
}
export default function ReceivedCorrespondence({state}:{state:any}){
 const messages=receivedCorrespondence(state),[selected,setSelected]=useState(0),message=messages[selected];
 return <section aria-label="Correspondencia recibida"><p>Mensajes recibidos durante la campaña.</p>{!messages.length?<p className="empty-inbox">Todavía no recibiste correspondencia.</p>:<div className="received-inbox"><nav aria-label="Mensajes recibidos">{messages.map((m:any,i:number)=><button key={m.id??i} className="line-button" aria-pressed={selected===i} onClick={()=>setSelected(i)}><strong>{m.sender}</strong><span>{m.subject??'Carta recibida'}</span><small>Día {Math.floor((m.hour??0)/24)+1}</small></button>)}</nav>{message&&<article><h3>{message.subject??'Carta recibida'}</h3><p>De {message.sender}</p><p>{message.text}</p></article>}</div>}</section>;
}
