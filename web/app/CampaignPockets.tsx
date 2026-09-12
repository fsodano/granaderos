'use client';
import {useMemo,useState} from 'react';
import JA2Pockets from './JA2Pockets';
import JA2AttachmentSlot from './JA2AttachmentSlot';
import JA2OutfitSlot from './JA2OutfitSlot';
import {handLayout} from '../../game/hand-layout.js';
import {inventoryUsage,itemDescriptor,equipmentEndpoint} from '../../game/tactical-inventory.js';
import {EquipmentInteractionProvider,useEquipmentDrag} from '../lib/equipment-drag';
import './ja2-hands.css';
type Props={unit:any;disabled:boolean;onOrder:(action:any)=>any};
export default function CampaignPockets(props:Props){
 return <EquipmentInteractionProvider key={props.unit.id}><CampaignPocketsBody {...props}/></EquipmentInteractionProvider>;
}
function CampaignPocketsBody({unit,disabled,onOrder}:Props){
 const [inspectedReference,setInspected]=useState(''),[inspectedSlot,setInspectedSlot]=useState('');
 const inspect=(item:string,slotId='')=>{setInspected(item);setInspectedSlot(slotId);};
 const inspected=inspectedSlot?equipmentEndpoint(unit,inspectedSlot).item??inspectedReference:inspectedReference;
 const context=useMemo(()=>({mode:'exploration',phase:'player',status:'active',units:[unit],equipmentContext:'campaign'}),[unit]);
 const arrange=({type,...action}:any)=>{if(type==='attachment')return onOrder({direction:'attachment',...action});return onOrder({direction:'arrange',kind:['pickupEquipment','placeEquipment','returnEquipmentCursor','dragEquipment'].includes(type)?'cursor':type==='movePocket'?'pocket':'equipment',cursorAction:type,...action});};
 const inspectedItem=inspected&&(!inspected.startsWith('inventory:')||Object.hasOwn(unit.inventory??{},inspected.slice(10)))?itemDescriptor(unit,inspected):null;
 const drag=useEquipmentDrag(context,unit,disabled,arrange),hands=handLayout(unit);
 return <section className="campaign-pockets" aria-label="Organizar equipo llevado">
  <h4>Equipo llevado</h4><p>Podés mover objetos entre manos, vestimenta y bolsillos. No consume tiempo.</p>
  <JA2OutfitSlot battle={context} unit={unit} disabled={disabled} onPick={inspect} onOrder={arrange}/>
  <div className="ja2-hands" aria-label="Manos del combatiente">{(['right','left'] as const).map(side=>{
   const item=hands[side],blocked=side==='left'&&hands.twoHanded;
   const details:any=item?itemDescriptor(unit,item):null;
   const label=details?.label??(blocked?'Ocupada por el arma':'Vacía');
   return <button key={side} type="button" disabled={disabled||blocked} className={blocked?'blocked':drag.target===`hand:${side}`?'drop-target':''} data-held={Boolean(item)} aria-label={`${side==='right'?'Mano principal':'Segunda mano'}: ${label}`} title="Clic: tomar o colocar. Botón derecho: detalles." {...drag.handlers(`hand:${side}`,{onInspect:inspect})}>
    <small>{side==='right'?'Mano principal':'Segunda mano'}</small><span>{label}</span>{details?.loaded!==undefined&&<small>{details.loaded} carga(s) · {details.condition}%</small>}
   </button>;
  })}</div>
  <JA2Pockets battle={context} unit={unit} layout={inventoryUsage(unit)} disabled={disabled} onPick={inspect} onOrder={arrange}/>
  {inspectedSlot&&<JA2AttachmentSlot battle={context} unit={unit} hostId={inspectedSlot} disabled={disabled} onOrder={arrange}/>}
  {inspectedItem&&<p>Detalles: {inspectedItem.label}. Las opciones para equipar y dejar objetos están en la lista inferior.</p>}
 </section>;
}
