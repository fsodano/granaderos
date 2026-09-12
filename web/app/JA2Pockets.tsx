'use client';
import {useState} from 'react';
import {Package,Flame,Utensils,Cross,Gem,CircleDot} from 'lucide-react';
const icons:Record<string,any>={ammo:Package,priming:CircleDot,flints:Gem,rations:Utensils,medkits:Cross,boleadoras:CircleDot,torches:Flame};
import {planPocketMove,pocketFingerprint} from '../../game/tactical-inventory.js';
import './ja2-pockets.css';
type Props={unit:any;layout:any;disabled:boolean;onPick:(item:string)=>void;onOrder:(action:any)=>void};
export default function JA2Pockets({unit,layout,disabled,onPick,onOrder}:Props){
 const[selected,setSelected]=useState(''),[selectedContents,setSelectedContents]=useState(''),[dragged,setDragged]=useState(''),[draggedContents,setDraggedContents]=useState('');
 const source=layout.slots.find((slot:any)=>slot.id===selected&&slot.entry&&pocketFingerprint(slot)===selectedContents);
 const reason=(from:string,to:string)=>{try{planPocketMove(unit,from,to);return null;}catch(error){return (error as Error).message;}};
 const move=(from:string,to:string,expected:string)=>{
  if(disabled||reason(from,to))return;
  onOrder({type:'movePocket',sourceId:from,destinationId:to,expectedSource:expected,expectedDestination:pocketFingerprint(layout.slots.find((slot:any)=>slot.id===to))});
  setSelected('');setDragged('');
 };
 return <section className="ja2-pockets" aria-label="Bolsillos del combatiente">
  <p>Bolsillos · 4 grandes / 8 pequeños</p>
  <small>{source?'Elegí el destino. Seleccioná el origen para cancelar.':'Arrastrá un objeto o seleccioná origen y destino.'}</small>
  {['large','small'].map(size=><div className={`ja2-pocket-row ${size}`} key={size} role="group" aria-label={size==='large'?'Bolsillos grandes':'Bolsillos pequeños'}>
   {layout.slots.filter((slot:any)=>slot.size===size).map((slot:any)=>{
    const blocked=source&&source.id!==slot.id?reason(source.id,slot.id):null,Icon=icons[slot.entry?.item]??Package;
    return <button key={slot.id} type="button" className={`ja2-pocket ${slot.entry?'occupied':''}`} aria-label={`${slot.label}: ${slot.entry?`${slot.entry.label} · ${slot.entry.count}`:'vacío'}`} aria-pressed={source?.id===slot.id} disabled={disabled||Boolean(blocked)} title={blocked??`${slot.label}${slot.entry?`: ${slot.entry.label} · ${slot.entry.count}${slot.entry.condition!==undefined?` · estado ${slot.entry.condition}%`:''}`:''}`} draggable={!disabled&&Boolean(slot.entry)}
     onDragStart={event=>{setSelected('');setDragged(slot.id);setDraggedContents(pocketFingerprint(slot));event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',slot.id);}}
     onDragEnd={()=>setDragged('')} onDragOver={event=>{if(dragged&&!reason(dragged,slot.id)){event.preventDefault();event.dataTransfer.dropEffect='move';}}}
     onDrop={event=>{event.preventDefault();if(dragged)move(dragged,slot.id,draggedContents);}}
     onClick={()=>{if(source?.id===slot.id){setSelected('');return;}if(source){move(source.id,slot.id,selectedContents);return;}if(slot.entry){setSelected(slot.id);setSelectedContents(pocketFingerprint(slot));onPick(slot.entry.item);}}}>
     {slot.entry?<>{slot.entry.weapon>=1800&&slot.entry.weapon<=1813?<img src={`/art/weapon-${slot.entry.weapon}.png`} alt=""/>:<Icon size={22} aria-hidden="true"/>}<span>{slot.entry.label}</span><b>{slot.entry.count}</b></>:<span className="empty">{size==='large'?'Grande':'Pequeño'}</span>}
    </button>;
   })}
  </div>)}
  {layout.overflow.length>0&&<div className="ja2-pocket-overflow" role="group" aria-label="Objetos sin espacio"><p>No cabe todo el equipo. Entregá o soltá estos objetos.</p>{layout.overflow.map((entry:any)=><button key={entry.item} disabled={disabled} onClick={()=>onPick(entry.item)}>{entry.label} · {entry.count}</button>)}</div>}
 </section>;
}
