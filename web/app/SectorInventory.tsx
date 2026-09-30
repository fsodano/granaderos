'use client';
import {useState} from 'react';
import CampaignPockets from './CampaignPockets';
import {rosterFor} from '../../game/campaign.js';
import {sectorInventoryModel,sectorInventorySites} from '../../game/sector-inventory.js';
import {tacticalGridLabel} from '../../game/tactical-grid.js';
import './sector-inventory.css';

export default function SectorInventory({state,sectorId,dispatch}:{state:any;sectorId:string;dispatch:(action:any)=>void}){
 const [selected,setSelected]=useState('');
 const [selectedSite,setSelectedSite]=useState(sectorId);
 const sites=sectorInventorySites(state,sectorId),siteId=sites.some(site=>site.id===selectedSite)?selectedSite:sectorId;
 const cursorOwner=Object.entries(state.operativeState??{}).find(([,record]:any)=>record.equipmentCursor)?.[0];
 const model=sectorInventoryModel(state,siteId,rosterFor(state),selected||cursorOwner||'');
 const order=(action:any)=>dispatch({type:'sectorInventory',sector:siteId,operativeId:model.operativeId,...action});
 return <section className="sector-inventory" aria-label="Equipo del sector">
  <header><div><h3>Equipo del sector</h3><p>Elegí un combatiente presente para preparar lo que lleva en las manos y equipar su vestimenta. En un sector reconocido y seguro también puede recoger o dejar objetos. En una maestranza puede guardar armas para venderlas o entregarlas a otro combatiente.</p></div>
   <label>Combatiente<select aria-label="Combatiente para el equipo del sector" disabled={Boolean(model.personal?.equipmentCursor)} value={model.operativeId??''} onChange={event=>setSelected(event.target.value)}>{!model.candidates.length&&<option value="">Sin combatientes presentes</option>}{model.candidates.map((op:any)=><option value={op.id} key={op.id}>{op.name}</option>)}</select></label>
  </header>
  {sites.length>1&&<label>Lugar<select aria-label="Lugar del equipo" disabled={Boolean(model.personal?.equipmentCursor)} value={siteId} onChange={event=>setSelectedSite(event.target.value)}>{sites.map(site=><option key={site.id} value={site.id}>{site.name} · {site.count} objetos</option>)}</select></label>}
  {model.usage&&<p>Mochila: {model.usage.used}/{model.usage.capacity} espacios. Las cargas permanecen en el arma; los cartuchos sueltos se usan en el próximo despliegue.</p>}
  <section aria-label="Vestimenta del depósito"><p>Ponchos disponibles aquí: {model.outfitStock}</p><button className="line-button" disabled={Boolean(model.outfitIssueReason)} title={model.outfitIssueReason || undefined} onClick={()=>order({direction:'issueOutfit'})}>Retirar poncho del depósito</button><small>Se guarda en un bolsillo grande. La reserva general se retira en Retiro.</small></section>
  {model.personal&&<CampaignPockets key={`${siteId}:${model.operativeId}`} unit={model.personal} disabled={Boolean(model.carriedReason)} onOrder={action=>order(action)}/>}
  <div className="sector-inventory-columns"><section aria-label="Equipo descubierto"><h4>En el terreno</h4>{model.reason&&<p role="status">{model.reason}</p>}{model.entries.length?model.entries.map((row:any,index:number)=><ItemRow key={`${siteId}:${row.key}:${row.expected}`} label={row.label} count={row.count} number={index+1} disabled={!row.reachable} verb="Recoger" onConfirm={(count:number)=>order({direction:'take',sourceKey:row.key,expected:row.expected,count})}>
   <p>{tacticalGridLabel(row.x,row.y)} · {row.condition!==undefined&&`Estado ${row.condition}%. `}{row.loaded!==undefined&&`${row.loaded} carga(s). `}{row.jammed&&'Necesita cebado. '}{row.reason}</p>
  </ItemRow>):<p>No hay equipo descubierto en este sector.</p>}</section>
  <section aria-label="Equipo llevado"><h4>Con el combatiente</h4>{model.carriedReason&&model.carriedReason!==model.reason&&<p role="status">{model.carriedReason}</p>}{model.carried.length?model.carried.map((row:any,index:number)=><ItemRow key={`${row.item}:${row.count}`} label={row.label} count={row.count} number={index+1} disabled={Boolean(model.reason)} verb="Dejar" onConfirm={(count:number)=>order({direction:'drop',item:row.item,count})}><EquipCarriedItem row={row} onEquip={(slot:string)=>order({direction:'equip',inventoryKey:row.inventoryKey,expected:row.expected,slot})}/><PrepareCarriedHands row={row} onPrepare={action=>order({direction:'equip',...action})}/>{row.store&&<button className="line-button" disabled={!row.store.valid} title={row.store.reason||undefined} aria-label={`Guardar en armería: ${row.label}`} onClick={()=>order({direction:'store',item:row.item,count:1,expected:row.store.expected})}>Guardar en armería</button>}</ItemRow>):<p>No hay equipo disponible.</p>}</section></div>
 </section>;
}
function ItemRow({label,count,number,disabled,verb,onConfirm,children}:{label:string;count:number;number:number;disabled:boolean;verb:string;onConfirm:(count:number)=>void;children?:React.ReactNode}){
 const [quantity,setQuantity]=useState(1);
 const valid=Number.isSafeInteger(quantity)&&quantity>0&&quantity<=count;
 return <div className="sector-inventory-row"><div><strong>{label} · {count}</strong>{children}</div><label>Cantidad<input type="number" min="1" max={count} step="1" value={quantity} disabled={disabled} aria-label={`${verb} ${number}: cantidad de ${label}`} onChange={event=>setQuantity(Number(event.target.value))}/></label><button className="line-button" disabled={disabled||!valid} aria-label={`${verb} ${number}: ${label}`} onClick={()=>onConfirm(quantity)}>{verb}</button></div>;
}

export function EquipCarriedItem({row,onEquip}:{row:any;onEquip:(slot:string)=>void}){
 const slotLabel=(slot:string)=>slot==='headwear'?'cabeza':slot==='legwear'?'piernas':slot==='outfit'?'torso':slot==='primary'?'principal':slot==='offhand'?'segunda mano':'secundaria';
 return <>{row.loaded===undefined&&row.condition!==undefined&&<p>Estado {row.condition}%{['headwear','outfit','legwear'].includes(row.item)&&' · Vestimenta puesta'}</p>}{row.loaded!==undefined&&<p>{row.loaded} carga(s){row.condition!==undefined&&` · Estado ${row.condition}%`}{row.reloadProgress&&` · Recarga ${Math.round(row.reloadProgress*100)}%`}{row.jammed&&' · Necesita cebado'}</p>}{row.equip&&<div className="sector-equip" role="group" aria-label={`Equipar ${row.label}`}>{row.equip.map((option:any)=><div key={option.slot}><button type="button" className="line-button" disabled={!option.valid} onClick={()=>onEquip(option.slot)} aria-label={option.label?`${option.label}: ${row.label}`:`Equipar ${row.label}: ${slotLabel(option.slot)}`}>{option.label??`Equipar ${slotLabel(option.slot)}`}</button>{option.reason&&<small>{option.reason}</small>}</div>)}</div>}</>;
}

export function PrepareCarriedHands({row,onPrepare}:{row:any;onPrepare:(action:any)=>void}){
 return <>{[row.mainhand,row.offhand].filter(Boolean).map(option=><div key={option.action.slot}><button type="button" className="line-button" disabled={!option.valid} title={option.reason||undefined} aria-label={`${option.label}: ${row.label}`} onClick={()=>onPrepare(option.action)}>{option.label}</button>{option.reason&&<small>{option.reason}</small>}</div>)}</>;
}
