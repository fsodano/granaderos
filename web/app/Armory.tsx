'use client';
import {sitePath} from '../lib/site-path.js';
import CampaignAmmunition from './CampaignAmmunition';
import {ammunitionForWeapon} from '../../game/ammo-types.js';
import {SendArtillery,ArtilleryStorage} from './ArtilleryTransport';
import ArtilleryTrading from './ArtilleryTrading';
import {localArtilleryDepot,depotSelection} from '../../game/artillery-transport.js';
import {artilleryProfile} from '../../game/artillery-definitions.js';
import {artillerySupplyQuote} from '../../game/artillery-supply.js';
import {stationedArtillery} from '../../game/campaign-artillery.js';
import {cartridgePrice} from '../../game/campaign-rules.js';
import {importRulesFor,importPortName,importOrderReason,importDelayReason} from '../../game/campaign-imports.js';
import {weaponSpecification} from '../../game/weapon-definition.js';
import {tradeQuote} from '../../game/politics.js';
import {useState} from 'react';
import {rosterFor,isSupplied,operativeLocation} from '../../game/campaign.js';
import {workshopServiceQuote} from '../../game/workshop-service.js';
import {campaignPlace} from '../../game/world-cells.js';
import {artilleryDeploymentChoices,artillerySelectionReason,isImportedEquipment,equipmentCatalog,armoryOptions,armoryInventory,merchantStatus,equipmentInventoryUsage,equipmentLabel,resaleBreakdown,USED_EQUIPMENT_LIMIT} from '../../game/equipment.js';
import UsedEquipment from './UsedEquipment';
import MerchantExchange from './MerchantExchange';
import GrenadeSupplies from './GrenadeSupplies';
import {merchantProfile} from '../../game/merchant-preferences.js';
import {FittingReadout} from './JA2Bayonet';
import {operativeInTransit} from '../../game/squads.js';
import './armory.css';
type Props={state:any;dispatch:(action:any)=>void};
export default function Armory({state:s,dispatch}:Props){
 const [selected,setSelected]=useState(String(s.recruited[0]??3));const roster=rosterFor(s),op=roster.find(o=>String(o.id)===selected&&s.recruited.includes(o.id)&&s.operativeState[o.id].alive&&!s.operativeState[o.id].captured)??roster.find(o=>s.recruited.includes(o.id)&&s.operativeState[o.id].alive&&!s.operativeState[o.id].captured);
 const [battery,setBattery]=useState<string[]|null>(null),batteryTypes=battery??artilleryDeploymentChoices(s),batteryReason=artillerySelectionReason(s,batteryTypes.filter(Boolean));const emplacements=stationedArtillery(s),inventory=armoryInventory(s),record=op?s.operativeState[op.id]:null;
 const resupply=workshopServiceQuote(s,op,'resupply',isSupplied(s,s.location)),repair=workshopServiceQuote(s,op,'repairWeapon',isSupplied(s,s.location));
 const catalog=equipmentCatalog(s),imports=importRulesFor(s),importBlocked=importOrderReason(s),delayReason=importDelayReason(s);
 const market=merchantStatus(s,null,isSupplied),profile=merchantProfile(s.location),stored=s.armoryItems??[];
 const local=Boolean(op&&operativeLocation(s,op.id)===s.location&&!operativeInTransit(s,op.id)&&!s.pendingBattle&&!s.pendingEncounter&&!s.defeated);
 const refillFits=Boolean(op&&!equipmentInventoryUsage(s,op).overloaded&&!equipmentInventoryUsage(s,op,{rations:Math.max(2,record.rations??2),torches:Math.max(2,record.torches??2),medkits:Math.max(2,record.medkits??2)}).overloaded);
 const equip=(slot:string,key:string)=>{if(!op||!key)return;const item:any=armoryOptions(s,op,slot).find((w:any)=>w.key===key);if(item)dispatch({type:'equip',operativeId:op.id,slot,itemId:item.item,...(item.instanceId?{instanceId:item.instanceId}:{})});};
 return <section className="armory-section"><div className="section-intro"><p className="eyebrow">SALA DE ARMAS</p><h2>El equipo de cada combatiente</h2><p>Las armas locales se entregan en la armería. {imports.port===null?'Esta campaña no admite pedidos de armas importadas.':`Las armas importadas llegan a ${importPortName(s)} en ${imports.minHours===imports.maxHours?imports.minHours:`${imports.minHours} a ${imports.maxHours}`} horas; los bloqueos y la ocupación del puerto demoran la entrega.`} Al cambiar un equipo, el arma anterior vuelve a la armería. La munición comprada queda con cada combatiente o en el depósito del sector. Precio general: {cartridgePrice(s)} {cartridgePrice(s)===1?'peso':'pesos'} por cartucho; cada proveedor puede tener otro precio. Cada comerciante tiene existencias y fondos limitados. Los caballos se administran en la caballada.</p></div>
  <p className="merchant-status" role="status">{market.available?`Caja del comerciante: ${market.cash} pesos · Próxima reposición en ${market.restockIn} horas de abastecimiento.`:market.reason}</p>
  {profile&&<aside className="merchant-status" aria-label="Preferencias del comerciante"><strong>{profile.name}</strong><p>{profile.description} Las piezas usadas se compran al 80% del valor nuevo, ajustado por su estado.</p></aside>}
  <div className="production-queue">{importBlocked&&imports.port!==null&&<p>{importBlocked}</p>}{(s.equipmentShipments??[]).map((q:any,i:number)=><p key={i}>{q.quantity} × {catalog.find(w=>String(w.stockKey??w.item)===String(q.stockKey??q.item))?.name} · {Math.max(0,q.due-s.hour)} horas{delayReason?` · ${delayReason}`:''}</p>)}</div><div className="armory-layout"><div className="armory-loadout"><label htmlFor="armory-officer">Hoja de equipo<select id="armory-officer" value={String(op?.id??'')} onChange={e=>setSelected(e.target.value)}>{roster.filter(o=>s.recruited.includes(o.id)&&s.operativeState[o.id].alive&&!s.operativeState[o.id].captured).map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
  {op&&<><h3>{op.name}</h3><p>Ubicación: {campaignPlace(operativeLocation(s,op.id))?.name}</p>{(['weapon','blade'] as const).map(slot=><label key={slot} htmlFor={`armory-${slot}`}>{slot==='weapon'?'Arma principal':'Arma blanca'}<select id={`armory-${slot}`} value="equipped" disabled={!local} onChange={e=>equip(slot,e.target.value)}>
   <option value="equipped">{slot==='weapon'&&record.weaponDropped?'Arma abandonada':weaponSpecification(op,slot==='weapon'?'primary':'blade')?.name??'Sin arma'} · Equipada</option>
   {armoryOptions(s,op,slot).map((w:any)=><option key={w.key} value={w.key}>{w.name} · Estado {w.condition}%{w.fittings?.bayonet?` · Bayoneta fijada ${w.fittings.bayonet.condition}%`:''}{w.jammed?' · Fallo de chispa':''} · {w.key}</option>)}
  </select>{slot==='weapon'&&!record.weaponDropped&&<FittingReadout fitting={record.weaponFittings?.bayonet}/>}</label>)}

  {ammunitionForWeapon(op)&&<p>Munición compatible: {ammunitionForWeapon(op).name}</p>}
  <CampaignAmmunition key={op.id} state={s} operative={op} dispatch={dispatch}/>
  <div className="armory-condition"><span>Estado del arma <b>{record?.condition??100}%</b></span><span>Raciones <b>{record?.rations??2}/2</b></span></div>
  <button className="line-button" disabled={!resupply.available||!refillFits} title={!refillFits?'Retirá objetos de los bolsillos antes de reponer.':resupply.reason||undefined} onClick={()=>dispatch({type:'resupply',operativeId:op.id})}>Reponer provisiones · {resupply.cost} pesos</button>
  <button className="line-button" disabled={!repair.available} title={repair.reason||undefined} onClick={()=>dispatch({type:'repairWeapon',operativeId:op.id})}>Reparar arma · {repair.cost} pesos</button><small>{resupply.reason===repair.reason?resupply.reason||'La reposición y la reparación se realizan para esta persona en el taller actual.':[resupply.reason&&`Provisiones: ${resupply.reason}`,repair.reason&&`Reparación: ${repair.reason}`].filter(Boolean).join(' ')}</small></>}
  {emplacements.length>0&&<section aria-label="Artillería emplazada"><h3>Piezas emplazadas en este sector</h3><p>Conservan su posición y munición al volver. Permanecen aquí cuando la escuadra sale. Para moverlas, organizá un traslado. Al retirarte de un combate pueden quedar en manos realistas.</p>{emplacements.map(({sector,gun}:any)=>{const quote=artillerySupplyQuote(s,sector,gun.id,isSupplied(s,s.location));return <div key={`${sector}:${gun.id}`} data-artillery-id={gun.id}><p>{equipmentCatalog(s).find(item=>item.item===gun.type)?.name} · {gun.loaded?'Cargada':gun.reloadProgress?`Recarga ${Math.floor(gun.reloadProgress*100)}%`:'Descargada'} · {gun.ammo} en reserva · {gun.side==='player'?'Propia':'Realista'}</p><button className="line-button" disabled={!quote.available} title={quote.reason||undefined} onClick={()=>dispatch({type:'resupplyArtillery',sector,artilleryId:gun.id})}>Comprar 1 munición · {quote.cost} pesos</button><small>{quote.reason||`Se entrega en reserva, sin cargar la pieza. Límite de reposición: ${quote.limit}.`}</small><SendArtillery state={s} sector={sector} gun={gun} dispatch={dispatch}/></div>;})}</section>}
  <ArtilleryStorage state={s} dispatch={dispatch}/><ArtilleryTrading state={s} dispatch={dispatch} supplied={isSupplied(s,s.location)}/><h3>Batería de campaña</h3><p>Elegí hasta tres piezas de la armería o del depósito local para el próximo ataque. Preparar todos los espacios sin pieza deja los cañones guardados.</p>{[0,1,2].map(i=><label key={i} htmlFor={`battery-${i}`}>Pieza {i+1}<select id={`battery-${i}`} value={batteryTypes[i]??''} onChange={e=>{const next=[...batteryTypes];next[i]=e.target.value;setBattery(next);}}><option value="">Sin pieza</option>{equipmentCatalog(s).filter(w=>w.category==='artillery').map(w=><option key={w.item} value={w.item}>{w.name}</option>)}{localArtilleryDepot(s).map((gun:any)=><option key={gun.id} value={depotSelection(gun)}>Depósito: {artilleryProfile(s,gun).name} · {gun.loaded?'cargada':gun.reloadProgress?`recarga ${Math.floor(gun.reloadProgress*100)}%`:'descargada'} · {gun.ammo} en reserva</option>)}</select></label>)}<button className="gold-button" disabled={Boolean(batteryReason)||Boolean(s.pendingBattle)} onClick={()=>{dispatch({type:'configureArtillery',types:batteryTypes.filter(Boolean)});setBattery(null);}}>Preparar batería</button>{batteryReason&&<p role="status">{batteryReason}</p>}
  </div><div className="armory-catalog">
   <MerchantExchange key={s.location} state={s} dispatch={dispatch}/><GrenadeSupplies state={s} operative={op} dispatch={dispatch}/><UsedEquipment state={s} dispatch={dispatch}/>
   {['firearm','blade','artillery'].map(category=><div key={category}><h3>{category==='firearm'?'Armas de chispa':category==='blade'?'Acero y armas de asta':'Piezas de artillería'}</h3>{inventory.filter(w=>w.category===category).map((w:any)=>{
    const offer=merchantStatus(s,w,isSupplied),price=isImportedEquipment(w)?tradeQuote(s,w.price):w.price;
    return <article key={w.stockKey??w.item}><img className="armory-weapon-art" src={sitePath(w.art??`/art/weapon-${w.id}.png`)} alt={w.name}/><div><strong>{w.name}</strong><small>{w.quantity} en armería · {offer.stock} disponibles para {isImportedEquipment(w)?'pedir':'comprar'}{w.category==='artillery'?` · Dotación: ${w.crew} hombres`:''}</small>{offer.stock===0&&<small>Reposición en {offer.restockIn} horas de abastecimiento.</small>}</div><button className="line-button" disabled={!offer.available||offer.stock<1||s.resources.treasury<price} aria-label={`${isImportedEquipment(w)?'Importar':'Comprar'} ${w.name} · ${price} pesos`} title={offer.reason??undefined} onClick={()=>dispatch({type:'purchaseEquipment',item:w.stockKey??w.item,quantity:1})}>{isImportedEquipment(w)?'Importar':'Comprar'} · {price} pesos</button></article>;
   })}</div>)}
   <details className="armory-resale"><summary>Armas guardadas · {stored.length} ejemplares</summary><p>Elegí el ejemplar que querés vender. La oferta depende de las preferencias de esta maestranza y del estado de cada pieza. El comerciante conserva el ejemplar vendido entre sus armas usadas. También podés ofrecer artillería en el intercambio.</p>
    {stored.length===0&&<p>No hay armas guardadas. Al cambiar un arma, la anterior vuelve a la armería con su estado actual.</p>}
    {stored.map((item:any)=>{const quote=resaleBreakdown(item,s.location),price=quote.total;return <article key={item.id}><div><strong>{equipmentLabel(item)}</strong><small>Estado {item.condition}%{item.jammed?' · Fallo de chispa':''}</small><FittingReadout fitting={item.fittings?.bayonet}/>{quote.reason&&<small>{quote.reason}</small>}{quote.items.length>1&&<ul aria-label="Desglose de venta">{quote.items.map((part:any,index:number)=><li key={index}>{part.name} · estado {part.condition}% · {part.price} pesos</li>)}</ul>}</div><button className="line-button" disabled={!market.available||Boolean(quote.reason)||price<=0||market.cash<price||(s.merchants?.[s.location]?.usedItems?.length??0)>=USED_EQUIPMENT_LIMIT} onClick={()=>dispatch({type:'sellEquipment',instanceId:item.id})}>{quote.reason?'No acepta esta arma':price>0?`Vender · ${price} pesos`:'Sin valor de servicio'}</button></article>;})}
   </details>
  </div></div>
 </section>;
}
