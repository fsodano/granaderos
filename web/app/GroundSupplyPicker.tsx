'use client';
import {supplyCount} from '../../game/ammo-types.js';
import {useEffect,useRef,useState} from 'react';
import {TRANSFER_SUPPLY_LABELS} from '../../game/character-supplies.js';
import {groundSupplyPickupPreview} from '../../game/tactical.js';
import {tacticalGridLabel} from '../../game/tactical-grid.js';
type Props={battle:any;unit:any;tile:{x:number;y:number};onClose:()=>void;onCollect:(groundId:string,count:number)=>void};
export default function GroundSupplyPicker({battle,unit,tile,onClose,onCollect}:Props){
 const bundles=battle.groundItems.filter((g:any)=>g.x===tile.x&&g.y===tile.y&&g.count>0&&!g.heldBy&&!g.containerId&&Object.hasOwn(TRANSFER_SUPPLY_LABELS,g.type));
 const [chosen,setChosen]=useState(bundles[0]?.id??''),[amount,setAmount]=useState(String(bundles[0]?.count??1));
 const source=bundles.find((g:any)=>g.id===chosen),plan=groundSupplyPickupPreview(battle,unit,chosen,Number(amount));
 const dialog=useRef<HTMLElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;(dialog.current?.querySelector('select') as HTMLElement|null)?.focus();return()=>{if(previous?.isConnected)previous.focus();};},[]);
 return <div className="field-supply-overlay"><section ref={dialog} className="field-supply-picker" role="dialog" aria-modal="true" aria-label="Recoger suministros del suelo" onKeyDown={e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}
  if(e.key==='Tab'){const controls=[...dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)')],first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
 }}>
  <h2>Suministros en {tacticalGridLabel(tile.x,tile.y)}</h2><p>{unit.name} recoge lo que elijas. El resto queda en el sector.</p>
  <label>Bulto <select aria-label="Bulto del suelo" value={chosen} onChange={e=>{setChosen(e.target.value);setAmount(String(bundles.find((g:any)=>g.id===e.target.value)?.count??1));}}>{bundles.map((g:any,i:number)=><option key={g.id} value={g.id}>{(TRANSFER_SUPPLY_LABELS as any)[g.type]} · {g.count} · bulto {i+1}</option>)}</select></label>
  <label>Cantidad <input aria-label="Cantidad de suministros para recoger" type="number" min="1" max={source?.count??0} step="1" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
  <p>En el bulto: {source?.count??0}. En el equipo: {source?supplyCount(unit,source.type):0}. Costo: {battle.mode==='exploration'?'1 segundo':'8 PA'}.</p>
  {plan.reason&&<p role="status">{plan.reason}</p>}
  <div><button className="gold-button" disabled={Boolean(plan.reason)} onClick={()=>onCollect(chosen,Number(amount))}>Recoger cantidad</button><button className="line-button" onClick={onClose}>Cancelar</button></div>
 </section></div>;
}
