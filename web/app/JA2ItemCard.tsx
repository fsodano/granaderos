'use client';
import {equipmentFingerprint} from '../../game/tactical-inventory.js';
import {equipmentUnloadPreview} from '../../game/tactical.js';
import {Package} from 'lucide-react';
import {inspectEquipmentItem} from '../../game/item-inspection.js';
import JA2AttachmentSlot from './JA2AttachmentSlot';
import './ja2-item-card.css';
type Props={battle:any;unit:any;reference:string;slotId?:string;disabled:boolean;onOrder:(action:any)=>any};
export default function JA2ItemCard({battle,unit,reference,slotId='',disabled,onOrder}:Props){
 const item:any=inspectEquipmentItem(unit,reference,slotId);
 if(!item)return <p>Esta ranura está vacía.</p>;
 const unload=slotId&&item.loaded!==undefined?{type:'unloadEquipment',unitId:String(unit.id),hostId:slotId,expectedHost:equipmentFingerprint(unit,slotId)}:null;
 const preview=unload?equipmentUnloadPreview(battle,unit,unload):null;
 return <section className="ja2-item-card" aria-label={`Detalles de ${item.label}`}>
  <div className="ja2-item-picture">{item.art||item.weapon>=1800&&item.weapon<=1813?<img src={item.art??`/art/weapon-${item.weapon}.png`} alt={item.label}/>:<Package size={54} aria-hidden="true"/>}
   {item.loaded!==undefined&&<button type="button" className="ja2-item-charge" aria-label="Descargar munición" title={preview?.reason??`Descargar · ${preview?.pa??0} PA`} disabled={disabled||!preview?.valid} onClick={()=>unload&&onOrder(unload)}>{item.loaded} / {item.capacity??1}</button>}
  </div>
  <dl>
   {item.condition!==undefined&&<><dt>Estado</dt><dd>{item.condition}%</dd></>}
   <dt>Cantidad</dt><dd>{item.count}{item.stackLimit>1?` / ${item.stackLimit}`:''}</dd>
   <dt>Peso</dt><dd>{item.totalWeight.toFixed(2)} kg</dd>
   {item.damage!==undefined&&<><dt>Daño</dt><dd>{item.damage}</dd></>}
   {item.range!==undefined&&<><dt>Alcance</dt><dd>{item.range} casillas</dd></>}
  </dl>
  <h4>{item.label}</h4><p>{item.help}</p>
  {item.weapon&&slotId&&<JA2AttachmentSlot battle={battle} unit={unit} hostId={slotId} disabled={disabled} onOrder={onOrder}/>}
 </section>;
}
