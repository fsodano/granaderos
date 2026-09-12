'use client';
import type {ReactNode} from 'react';
import {OUTFITS,wornOutfit} from '../../game/outfits.js';
import {useEquipmentDrag} from '../lib/equipment-drag';
import './ja2-outfit.css';
type Props={battle:any;unit:any;disabled:boolean;onPick:(item:string,slotId?:string)=>void;onOrder:(action:any)=>void;children?:ReactNode};
export default function JA2OutfitSlot({battle,unit,disabled,onPick,onOrder,children}:Props){
 const outfit=wornOutfit(unit),label=outfit?`${OUTFITS[outfit.outfit as keyof typeof OUTFITS].name} · ${outfit.condition}%`:'Vacía';
 const drag=useEquipmentDrag(battle,unit,disabled,onOrder);
 return <section className="ja2-outfit-slot" aria-label="Ranura de vestimenta">
  <small>Vestimenta</small>
  <button type="button" className={`line-button${drag.target==='outfit'?' drop-target':''}`} disabled={disabled} data-held={Boolean(outfit)} aria-label={`Vestimenta: ${label}`} title="Clic: tomar o colocar. Botón derecho: detalles." {...drag.handlers('outfit',{onInspect:onPick})}>{label}</button>
  {children}
 </section>;
}
