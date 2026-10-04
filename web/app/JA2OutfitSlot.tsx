'use client';
import type {ReactNode} from 'react';
import {BODY_SLOTS,OUTFITS,wornOutfit} from '../../game/outfits.js';
import {characterPortrait} from '../../game/character-portraits.js';
import {spriteAppearance,SPRITE_APPEARANCES} from '../../game/sprite-appearances.js';
import {useEquipmentDrag} from '../lib/equipment-drag';
import './ja2-outfit.css';
type Props={battle:any;unit:any;disabled:boolean;onPick:(item:string,slotId?:string)=>void;onOrder:(action:any)=>void;children?:ReactNode};
export default function JA2OutfitSlot({battle,unit,disabled,onPick,onOrder,children}:Props){
 const drag=useEquipmentDrag(battle,unit,disabled,onOrder);
 const labels:Record<string,string>={headwear:'Cabeza',outfit:'Torso',legwear:'Piernas'};
 const gender=unit.gender??characterPortrait(String(unit.portraitId??unit.id))?.gender??SPRITE_APPEARANCES[spriteAppearance(unit)]?.gender??'man';
 return <section className="ja2-outfit-slot" aria-label="Ranuras de vestimenta">
  <small>Vestimenta</small>
  <div className="ja2-body-layout"><svg className="ja2-body-figure" viewBox="0 0 76 118" role="img" aria-label={gender==='woman'?'Figura femenina: cabeza, torso y piernas':'Figura masculina: cabeza, torso y piernas'} data-gender={gender}>
   <defs><linearGradient id={`body-shade-${unit.id}`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#6f785e"/><stop offset=".5" stopColor="#d7d7b7"/><stop offset="1" stopColor="#838d6b"/></linearGradient></defs>
   <g fill={`url(#body-shade-${unit.id})`} stroke="#293b28" strokeWidth="1.4"><ellipse cx="28" cy="12" rx="8" ry="10"/><path d={gender==='woman'?'M22 23 L16 28 L12 53 L8 66 L12 69 L19 54 L21 43 L23 53 L33 53 L35 43 L37 54 L44 69 L48 66 L44 53 L40 28 L34 23 Z':'M22 23 L15 27 L11 53 L7 66 L12 69 L19 54 L21 40 L21 54 L35 54 L35 40 L37 54 L44 69 L49 66 L45 53 L41 27 L34 23 Z'}/><path d="M21 54 L35 54 L37 79 L35 105 L39 111 L28 111 L29 80 L27 80 L28 111 L17 111 L21 105 L19 79 Z"/></g>
   <g fill="none" stroke="#d1c283" strokeWidth="1.4"><path d="M37 12 H70 M37 39 H70 M36 85 H70"/><path d="M66 9 L70 12 L66 15 M66 36 L70 39 L66 42 M66 82 L70 85 L66 88"/></g>
  </svg><div className="ja2-body-slots">{BODY_SLOTS.map(slot=>{
   const outfit=wornOutfit(unit,slot),label=outfit?`${OUTFITS[outfit.outfit as keyof typeof OUTFITS].name} · ${outfit.condition}%`:'Vacía';
   return <button key={slot} type="button" className={`line-button${drag.target===slot?' drop-target':''}`} disabled={disabled} data-held={Boolean(outfit)} aria-label={`${labels[slot]}: ${label}`} title={`${labels[slot]}: ${label}. Clic: tomar o colocar. Botón derecho: detalles.`} {...drag.handlers(slot,{onInspect:onPick})}><small>{labels[slot]}</small><span>{label}</span>{outfit&&<span className="ja2-item-bar" aria-hidden="true"><i style={{width:`${outfit.condition}%`}}/></span>}</button>;
  })}</div></div>
  {children}
 </section>;
}
