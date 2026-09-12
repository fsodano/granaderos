'use client';
import {useState} from 'react';
import {Package,Flame,Utensils,Cross,Gem,CircleDot} from 'lucide-react';
const icons:Record<string,any>={ammo:Package,priming:CircleDot,flints:Gem,rations:Utensils,medkits:Cross,boleadoras:CircleDot,torches:Flame};
import {planPocketMove,pocketFingerprint,pocketMergeCount} from '../../game/tactical-inventory.js';
import {useEquipmentDrag} from '../lib/equipment-drag';
import './ja2-pockets.css';
type Props={battle?:any;unit:any;layout:any;disabled:boolean;onPick:(item:string)=>void;onOrder:(action:any)=>void};
export default function JA2Pockets({battle,unit,layout,disabled,onPick,onOrder}:Props){
 const[selected,setSelected]=useState(''),[selectedContents,setSelectedContents]=useState('');
 const drag=useEquipmentDrag(battle,unit,disabled,onOrder);
 const source=drag.dragging?undefined:layout.slots.find((slot:any)=>slot.id===selected&&slot.entry&&pocketFingerprint(slot)===selectedContents);
 const reason=(from:string,to:string)=>{try{planPocketMove(unit,from,to);return null;}catch(error){return (error as Error).message;}};
 const move=(from:string,to:string,expected:string)=>{
  if(disabled||reason(from,to))return;
  onOrder({type:'movePocket',sourceId:from,destinationId:to,expectedSource:expected,expectedDestination:pocketFingerprint(layout.slots.find((slot:any)=>slot.id===to))});
  setSelected('');
 };
 return <section className="ja2-pockets" aria-label="Bolsillos del combatiente">
  <p>Bolsillos · 4 grandes / 8 pequeños</p>
  <small>{drag.hint||(source?'Elegí el destino. Seleccioná el origen para cancelar.':'Arrastrá un objeto o seleccioná origen y destino.')}</small>
  {['large','small'].map(size=><div className={`ja2-pocket-row ${size}`} key={size} role="group" aria-label={size==='large'?'Bolsillos grandes':'Bolsillos pequeños'}>
   {layout.slots.filter((slot:any)=>slot.size===size).map((slot:any)=>{
    const mergeCount=source?pocketMergeCount(unit,source.id,slot.id,layout):0;
    const blocked=source&&source.id!==slot.id?reason(source.id,slot.id):null,Icon=icons[slot.entry?.item]??Package;
    return <button key={slot.id} type="button" className={`ja2-pocket ${slot.entry?'occupied':''}${drag.target===slot.id?' drop-target':''}`} aria-label={`${slot.label}: ${slot.entry?`${slot.entry.label} · ${slot.entry.count}`:'vacío'}`} aria-pressed={source?.id===slot.id} disabled={disabled||Boolean(blocked)} title={blocked??`${mergeCount?`Combinar ${mergeCount} objetos · `:''}${slot.label}${slot.entry?`: ${slot.entry.label} · ${slot.entry.count}${slot.entry.condition!==undefined?` · estado ${slot.entry.condition}%`:''}`:''}`}
     {...drag.handlers(slot.id)}
     onClick={()=>{if(source?.id===slot.id){setSelected('');return;}if(source){move(source.id,slot.id,selectedContents);return;}if(slot.entry){setSelected(slot.id);setSelectedContents(pocketFingerprint(slot));onPick(slot.entry.item);}}}>
     {slot.entry?<>{slot.entry.weapon>=1800&&slot.entry.weapon<=1813?<img src={`/art/weapon-${slot.entry.weapon}.png`} alt=""/>:<Icon size={22} aria-hidden="true"/>}<span>{slot.entry.label}</span><b>{slot.entry.count}</b></>:<span className="empty">{size==='large'?'Grande':'Pequeño'}</span>}
    </button>;
   })}
  </div>)}
  {layout.overflow.length>0&&<div className="ja2-pocket-overflow" role="group" aria-label="Objetos sin espacio"><p>No cabe todo el equipo. Entregá o soltá estos objetos.</p>{layout.overflow.map((entry:any)=><button key={entry.item} disabled={disabled} onClick={()=>onPick(entry.item)}>{entry.label} · {entry.count}</button>)}</div>}
 </section>;
}
