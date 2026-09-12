'use client';
import {Package,Flame,Utensils,Cross,Gem,CircleDot} from 'lucide-react';
const icons:Record<string,any>={ammo:Package,priming:CircleDot,flints:Gem,rations:Utensils,medkits:Cross,boleadoras:CircleDot,torches:Flame};
import {useEquipmentDrag} from '../lib/equipment-drag';
import './ja2-pockets.css';
type QuantityProps={scope:string;quantity:{count:number;maxCount:number};setCount:(count:number)=>boolean;disabled?:boolean};
export function EquipmentQuantityControls({scope,quantity,setCount,disabled=false}:QuantityProps){
 return <div className="equipment-quantity" data-equipment-scope={scope} role="group" aria-label="Cantidad a mover" onClick={event=>event.stopPropagation()}>
  <label>Cantidad <input type="number" aria-label="Cantidad a mover" min={1} max={quantity.maxCount} step={1} value={quantity.count} disabled={disabled} onChange={event=>{if(!setCount(event.currentTarget.valueAsNumber))event.currentTarget.value=String(quantity.count);}}/></label>
  <span>de {quantity.maxCount}</span><button type="button" disabled={disabled} onClick={()=>setCount(quantity.maxCount)}>Todo</button>
 </div>;
}
type Props={battle?:any;unit:any;layout:any;disabled:boolean;onPick:(item:string,slotId?:string)=>void;onOrder:(action:any)=>void};
export default function JA2Pockets({battle,unit,layout,disabled,onPick,onOrder}:Props){
 const drag=useEquipmentDrag(battle,unit,disabled,onOrder);
 return <section className="ja2-pockets" aria-label="Bolsillos del combatiente">
  <p>Bolsillos · 4 grandes / 8 pequeños</p>
  <small className="equipment-drag-hint" role="status">{drag.hint||(drag.active?'Elegí el destino. Esc: devolver objeto.':'Clic: uno. Mayús + clic: todos. Botón derecho: detalles.')}</small>
  {drag.quantity&&drag.quantity.maxCount>1&&<EquipmentQuantityControls scope={drag.scope} quantity={drag.quantity} setCount={drag.setCount} disabled={disabled||drag.dragging}/> }
  {['large','small'].map(size=><div className={`ja2-pocket-row ${size}`} key={size} role="group" aria-label={size==='large'?'Bolsillos grandes':'Bolsillos pequeños'}>
   {layout.slots.filter((slot:any)=>slot.size===size).map((slot:any)=>{
    const Icon=icons[slot.entry?.item]??Package;
    return <button key={slot.id} type="button" className={`ja2-pocket ${slot.entry?'occupied':''}${drag.target===slot.id?' drop-target':''}`} aria-label={`${slot.label}: ${slot.entry?`${slot.entry.label} · ${slot.entry.count}`:'vacío'}`} disabled={disabled} title={`${slot.label}${slot.entry?`: ${slot.entry.label} · ${slot.entry.count}${slot.entry.condition!==undefined?` · estado ${slot.entry.condition}%`:''}`:''}`}
     {...drag.handlers(slot.id,{onInspect:onPick})}>
     {slot.entry?<>{slot.entry.weapon>=1800&&slot.entry.weapon<=1813?<img src={`/art/weapon-${slot.entry.weapon}.png`} alt=""/>:<Icon size={22} aria-hidden="true"/>}<span>{slot.entry.label}</span><b>{slot.entry.count}</b></>:<span className="empty">{size==='large'?'Grande':'Pequeño'}</span>}
    </button>;
   })}
  </div>)}
  {layout.overflow.length>0&&<div className="ja2-pocket-overflow" role="group" aria-label="Objetos sin espacio"><p>No cabe todo el equipo. Entregá o soltá estos objetos.</p>{layout.overflow.map((entry:any)=><button key={entry.item} disabled={disabled} onClick={()=>onPick(entry.item)}>{entry.label} · {entry.count}</button>)}</div>}
 </section>;
}
