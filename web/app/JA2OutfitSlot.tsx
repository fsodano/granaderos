'use client';
import type {ReactNode} from 'react';
import {BODY_SLOTS,OUTFITS,wornOutfit} from '../../game/outfits.js';
import {useEquipmentDrag} from '../lib/equipment-drag';
import './ja2-outfit.css';
type Props={battle:any;unit:any;disabled:boolean;onPick:(item:string,slotId?:string)=>void;onOrder:(action:any)=>void;children?:ReactNode};
export default function JA2OutfitSlot({battle,unit,disabled,onPick,onOrder,children}:Props){
 const drag=useEquipmentDrag(battle,unit,disabled,onOrder);
 const labels:Record<string,string>={headwear:'Cabeza',outfit:'Torso',legwear:'Piernas'};
 return <section className="ja2-outfit-slot" aria-label="Ranuras de vestimenta">
  <small>Vestimenta</small>
  <div className="ja2-body-slots">{BODY_SLOTS.map(slot=>{
   const outfit=wornOutfit(unit,slot),label=outfit?`${OUTFITS[outfit.outfit as keyof typeof OUTFITS].name} · ${outfit.condition}%`:'Vacía';
   return <button key={slot} type="button" className={`line-button${drag.target===slot?' drop-target':''}`} disabled={disabled} data-held={Boolean(outfit)} aria-label={`${labels[slot]}: ${label}`} title="Clic: tomar o colocar. Botón derecho: detalles." {...drag.handlers(slot,{onInspect:onPick})}><small>{labels[slot]}</small><span>{label}</span></button>;
  })}</div>
  {children}
 </section>;
}
