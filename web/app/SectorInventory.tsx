'use client';
import {useState} from 'react';
import {rosterFor} from '../../game/campaign.js';
import {sectorInventoryModel,sectorInventorySites} from '../../game/sector-inventory.js';
import {tacticalGridLabel} from '../../game/tactical-grid.js';
import './sector-inventory.css';

export default function SectorInventory({state,sectorId,dispatch}:{state:any;sectorId:string;dispatch:(action:any)=>void}){
 const [selected,setSelected]=useState('');
 const [selectedSite,setSelectedSite]=useState(sectorId);
 const sites=sectorInventorySites(state,sectorId),siteId=sites.some(site=>site.id===selectedSite)?selectedSite:sectorId;
 const model=sectorInventoryModel(state,siteId,rosterFor(state),selected);
 const order=(action:any)=>dispatch({type:'sectorInventory',sector:siteId,operativeId:model.operativeId,...action});
 return <section className="sector-inventory" aria-label="Equipo del sector">
  <header><div><h3>Equipo del sector</h3><p>Objetos descubiertos en el terreno. Un combatiente presente puede recogerlos o dejar equipo cuando el sector está seguro.</p></div>
   <label>Combatiente<select aria-label="Combatiente para el equipo del sector" value={model.operativeId??''} onChange={event=>setSelected(event.target.value)}>{!model.candidates.length&&<option value="">Sin combatientes presentes</option>}{model.candidates.map((op:any)=><option value={op.id} key={op.id}>{op.name}</option>)}</select></label>
  </header>
  {sites.length>1&&<label>Lugar<select aria-label="Lugar del equipo" value={siteId} onChange={event=>setSelectedSite(event.target.value)}>{sites.map(site=><option key={site.id} value={site.id}>{site.name} · {site.count} objetos</option>)}</select></label>}
  {model.reason&&<p role="status">{model.reason}</p>}
  {model.usage&&<p>Mochila: {model.usage.used}/{model.usage.capacity} espacios. Los cartuchos recogidos quedan con este combatiente hasta el próximo despliegue.</p>}
  <div className="sector-inventory-columns"><section aria-label="Equipo descubierto"><h4>En el terreno</h4>{model.entries.length?model.entries.map((row:any,index:number)=><ItemRow key={`${siteId}:${row.key}:${row.expected}`} label={row.label} count={row.count} number={index+1} disabled={!row.reachable} verb="Recoger" onConfirm={(count:number)=>order({direction:'take',sourceKey:row.key,expected:row.expected,count})}>
   <p>{tacticalGridLabel(row.x,row.y)} · {row.condition!==undefined&&`Estado ${row.condition}%. `}{row.loaded!==undefined&&`${row.loaded} carga(s). `}{row.jammed&&'Necesita cebado. '}{row.reason}</p>
  </ItemRow>):<p>No hay equipo descubierto en este sector.</p>}</section>
  <section aria-label="Equipo llevado"><h4>Con el combatiente</h4>{model.carried.length?model.carried.map((row:any,index:number)=><ItemRow key={`${row.item}:${row.count}`} label={row.label} count={row.count} number={index+1} disabled={Boolean(model.reason)} verb="Dejar" onConfirm={(count:number)=>order({direction:'drop',item:row.item,count})}/>):<p>No hay equipo disponible.</p>}</section></div>
 </section>;
}
function ItemRow({label,count,number,disabled,verb,onConfirm,children}:{label:string;count:number;number:number;disabled:boolean;verb:string;onConfirm:(count:number)=>void;children?:React.ReactNode}){
 const [quantity,setQuantity]=useState(1);
 const valid=Number.isSafeInteger(quantity)&&quantity>0&&quantity<=count;
 return <div className="sector-inventory-row"><div><strong>{label} · {count}</strong>{children}</div><label>Cantidad<input type="number" min="1" max={count} step="1" value={quantity} disabled={disabled} aria-label={`${verb} ${number}: cantidad de ${label}`} onChange={event=>setQuantity(Number(event.target.value))}/></label><button className="line-button" disabled={disabled||!valid} aria-label={`${verb} ${number}: ${label}`} onClick={()=>onConfirm(quantity)}>{verb}</button></div>;
}
