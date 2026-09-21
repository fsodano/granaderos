'use client';
import {tradeQuote} from '../../game/politics.js';
import {useState} from 'react';
import {rosterFor,isSupplied,operativeLocation} from '../../game/campaign.js';
import {isImportedEquipment,EQUIPMENT_CATALOG,armoryInventory,refillCost,firearmRepairCost,merchantStatus,equipmentInventoryUsage,equipmentCatalogItem,equipmentLabel,resaleBreakdown,USED_EQUIPMENT_LIMIT} from '../../game/equipment.js';
import UsedEquipment from './UsedEquipment';
import {merchantProfile} from '../../game/merchant-preferences.js';
import MerchantExchange from './MerchantExchange';
import AmmunitionSupplies from './AmmunitionSupplies';
import GrenadeSupplies from './GrenadeSupplies';
import StationedArtillery from './StationedArtillery';
import {FittingReadout} from './JA2Bayonet';
import './armory.css';
type Props={state:any;dispatch:(action:any)=>void};
export default function Armory({state:s,dispatch}:Props){
 const [selected,setSelected]=useState(String(s.recruited[0]??3));
 const roster=rosterFor(s),available=roster.filter(o=>s.recruited.includes(o.id)&&s.operativeState[o.id].alive);
 const op=available.find(o=>String(o.id)===selected)??available[0];
 const [battery,setBattery]=useState<string[]>(s.artillerySelection??[]);
 const inventory=armoryInventory(s),record=op?s.operativeState[op.id]:null,market=merchantStatus(s,null,isSupplied);
 const profile=merchantProfile(s.location);
 const stored=s.armoryItems??[],local=Boolean(op&&operativeLocation(s,op.id)===s.location&&!s.pendingBattle);
 const refillFits=Boolean(op&&!equipmentInventoryUsage(s,op).overloaded&&!equipmentInventoryUsage(s,op,{priming:Math.max(50,record.priming??50),flints:Math.max(4,record.flints??4),rations:Math.max(2,record.rations??2),torches:Math.max(2,record.torches??2)}).overloaded);
 const equip=(slot:string,instanceId:string)=>{const item=stored.find((item:any)=>item.id===instanceId);if(op&&item)dispatch({type:'equip',operativeId:op.id,slot,itemId:item.item,instanceId});};
 return <section className="armory-section">
  <div className="section-intro"><p className="eyebrow">SALA DE ARMAS</p><h2>El equipo de cada combatiente</h2><p>Los comerciantes tienen existencias y fondos limitados. Cada 24 horas de abastecimiento reciben una unidad por modelo. Los fusiles británicos llegan a Ensenada en 72 a 120 horas; un bloqueo demora su entrega. Cada arma guardada conserva su estado.</p></div>
  <p className="merchant-status" role="status">{market.available?`Caja del comerciante: ${market.cash} pesos · Próxima reposición en ${market.restockIn} horas de abastecimiento.`:market.reason}</p>
  {profile&&<aside className="merchant-status" aria-label="Preferencias del comerciante"><strong>{profile.name}</strong><p>{profile.description} Las piezas usadas se compran al 80% del valor nuevo, ajustado por su estado.</p></aside>}
  <div className="production-queue">{(s.equipmentShipments??[]).map((q:any,i:number)=><p key={i}>{q.quantity} × {equipmentCatalogItem(q.stockKey??q.item)?.name} · {Math.max(0,q.due-s.hour)} horas{s.blockade?' · Demorado por bloqueo':''}</p>)}</div>
  <div className="armory-layout"><div className="armory-loadout">
   <label htmlFor="armory-officer">Hoja de equipo<select id="armory-officer" value={String(op?.id??'')} onChange={e=>setSelected(e.target.value)}>{available.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
   {op&&<><h3>{op.name}</h3>{(['weapon','blade'] as const).map(slot=>{
    const current=equipmentLabel({item:op[slot],fittingPattern:slot==='weapon'?record.weaponFittingPattern:record.bladeFittingPattern}),missing=slot==='weapon'&&record.weaponDropped;
    return <label key={slot} htmlFor={`armory-${slot}`}>{slot==='weapon'?'Arma principal':'Arma blanca'}<select id={`armory-${slot}`} value="" disabled={!local} onChange={e=>equip(slot,e.target.value)}>
     <option value="">{missing?'Arma abandonada':current??'Sin arma'} · {slot==='weapon'?record.condition:record.bladeCondition??100}%</option>
     {stored.filter((item:any)=>slot==='weapon'||item.item>=1809).map((item:any)=><option key={item.id} value={item.id}>{equipmentLabel(item)} · {item.condition}%{item.fittings?.bayonet?` · Bayoneta fijada ${item.fittings.bayonet.condition}%`:''}{item.jammed?' · Fallo de chispa':''}</option>)}
    </select>{slot==='weapon'&&!missing&&<FittingReadout fitting={record.weaponFittings?.bayonet}/>}</label>;
   })}
   {!local&&<small>El combatiente debe estar presente y fuera del despliegue para cambiar su equipo.</small>}
   <div className="armory-condition"><span>Estado del arma <b>{record?.condition??100}%</b></span><span>Cargas de cebo <b>{record?.priming??50}/50</b></span><span>Piedras de sílex <b>{record?.flints??4}/4</b></span><span>Raciones <b>{record?.rations??2}/2</b></span></div>
   <button className="line-button" disabled={!market.available||!local||!record||!refillFits||refillCost(record)===0||s.resources.treasury<refillCost(record)} title={!refillFits?'Retirá objetos de la mochila antes de reponer.':undefined} onClick={()=>dispatch({type:'resupply',operativeId:op.id})}>Reponer provisiones · {refillCost(record??{})} pesos</button>
   <button className="line-button" disabled={!market.available||!local||!record||record.weaponDropped||firearmRepairCost(record)===0||s.resources.treasury<firearmRepairCost(record)} onClick={()=>dispatch({type:'repairWeapon',operativeId:op.id})}>Reparar arma · {firearmRepairCost(record??{})} pesos</button><small>La reposición y la reparación requieren una maestranza abastecida en el sector actual.</small></>}
   <StationedArtillery state={s} dispatch={dispatch}/><h3>Batería de campaña</h3><p>Elegí hasta tres piezas de depósito para el próximo despliegue. Salen del depósito y permanecen en el sector al terminar la operación.</p>{[0,1,2].map(i=><label key={i} htmlFor={`battery-${i}`}>Pieza {i+1}<select id={`battery-${i}`} value={battery[i]??''} onChange={e=>{const next=[...battery];next[i]=e.target.value;setBattery(next);}}><option value="">Sin pieza</option>{EQUIPMENT_CATALOG.filter(w=>w.category==='artillery').map(w=><option key={w.item} value={w.item}>{w.name}</option>)}</select></label>)}<button className="gold-button" onClick={()=>dispatch({type:'configureArtillery',types:battery.filter(Boolean)})}>Preparar batería</button>
  </div><div className="armory-catalog">
   <MerchantExchange key={s.location} state={s} dispatch={dispatch}/><AmmunitionSupplies state={s} dispatch={dispatch}/><GrenadeSupplies state={s} operative={op} dispatch={dispatch}/><UsedEquipment state={s} dispatch={dispatch}/>
   {['firearm','blade','artillery'].map(category=><div key={category}><h3>{category==='firearm'?'Armas de chispa':category==='blade'?'Acero y armas de asta':'Piezas de artillería'}</h3>{inventory.filter(w=>w.category===category).map((w:any)=>{
    const offer=merchantStatus(s,w,isSupplied),price=isImportedEquipment(w)?tradeQuote(s,w.price):w.price;
    return <article key={w.stockKey??w.item}><div><strong>{w.name}</strong><small>{w.quantity} en armería · {offer.stock} disponibles para {isImportedEquipment(w)?'pedir':'comprar'}{w.category==='artillery'?` · Dotación: ${w.crew} hombres`:''}</small>{offer.stock===0&&<small>Reposición en {offer.restockIn} horas de abastecimiento{isImportedEquipment(w)&&s.blockade?' · En pausa por bloqueo':''}.</small>}</div><button className="line-button" disabled={!offer.available||offer.stock<1||s.resources.treasury<price} aria-label={`${isImportedEquipment(w)?'Importar':'Comprar'} ${w.name} · ${price} pesos`} title={offer.reason??undefined} onClick={()=>dispatch({type:'purchaseEquipment',item:w.stockKey??w.item,quantity:1})}>{isImportedEquipment(w)?'Importar':'Comprar'} · {price} pesos</button></article>;
   })}</div>)}
   <details className="armory-resale"><summary>Armas guardadas · {stored.length} ejemplares</summary><p>Elegí el ejemplar que querés vender. La oferta depende de las preferencias de esta maestranza y del estado de cada pieza. El comerciante conserva el ejemplar vendido entre sus armas usadas. También podés ofrecer artillería en el intercambio.</p>
    {stored.length===0&&<p>No hay armas guardadas. Al cambiar un arma, la anterior vuelve a la armería con su estado actual.</p>}
    {stored.map((item:any)=>{const quote=resaleBreakdown(item,s.location),price=quote.total;return <article key={item.id}><div><strong>{equipmentLabel(item)}</strong><small>Estado {item.condition}%{item.jammed?' · Fallo de chispa':''}</small><FittingReadout fitting={item.fittings?.bayonet}/>{quote.reason&&<small>{quote.reason}</small>}{quote.items.length>1&&<ul aria-label="Desglose de venta">{quote.items.map((part:any,index:number)=><li key={index}>{part.name} · estado {part.condition}% · {part.price} pesos</li>)}</ul>}</div><button className="line-button" disabled={!market.available||Boolean(quote.reason)||price<=0||market.cash<price||(s.merchants?.[s.location]?.usedItems?.length??0)>=USED_EQUIPMENT_LIMIT} onClick={()=>dispatch({type:'sellEquipment',instanceId:item.id})}>{quote.reason?'No acepta esta arma':price>0?`Vender · ${price} pesos`:'Sin valor de servicio'}</button></article>;})}
   </details>
  </div></div>
 </section>;
}
