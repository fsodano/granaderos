'use client';
import {useState} from 'react';
import JA2Pockets from './JA2Pockets';
import {handLayout} from '../../game/hand-layout.js';
import {inventoryUsage,itemDescriptor} from '../../game/tactical-inventory.js';
import {useEquipmentDrag} from '../lib/equipment-drag';
import './ja2-hands.css';

export default function CampaignPockets({unit,disabled,onOrder}:{unit:any;disabled:boolean;onOrder:(action:any)=>void}){
 const [selected,setSelected]=useState('');
 const context={mode:'exploration',phase:'player',status:'active',units:[unit]};
 const arrange=({type,...action}:any)=>onOrder({direction:'arrange',kind:type==='movePocket'?'pocket':'equipment',...action});
 const drag=useEquipmentDrag(context,unit,disabled,arrange),hands=handLayout(unit);
 return <section className="campaign-pockets" aria-label="Organizar equipo llevado">
  <h4>Manos y bolsillos</h4><p>Arrastrá entre las manos y los bolsillos. Ordenar el equipo aquí no consume tiempo.</p>
  <div className="ja2-hands" aria-label="Manos del combatiente">{(['right','left'] as const).map(side=>{
   const item=hands[side],blocked=side==='left'&&hands.twoHanded;
   const details:any=item?itemDescriptor(unit,item):null;
   const label=details?.label??(blocked?'Ocupada por el arma':'Vacía');
   return <button key={side} type="button" disabled={disabled||blocked} className={blocked?'blocked':drag.target===`hand:${side}`?'drop-target':''} aria-label={`${side==='right'?'Mano principal':'Segunda mano'}: ${label}`} {...drag.handlers(`hand:${side}`)} onClick={()=>setSelected(item??'')}>
    <small>{side==='right'?'Mano principal':'Segunda mano'}</small><span>{label}</span>{details?.loaded!==undefined&&<small>{details.loaded} carga(s) · {details.condition}%</small>}
   </button>;
  })}</div>
  <JA2Pockets battle={context} unit={unit} layout={inventoryUsage(unit)} disabled={disabled} onPick={setSelected} onOrder={arrange}/>
  {drag.hint&&<p role="status">{drag.hint}</p>}
  {selected&&<p>Seleccionado: {itemDescriptor(unit,selected).label}. Las opciones para equipar y dejar objetos están en la lista inferior.</p>}
 </section>;
}
