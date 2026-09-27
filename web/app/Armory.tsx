'use client';
import {usesAuthoredEquipment} from '../../game/armory-items.js';
import {weaponSpecification} from '../../game/weapon-definition.js';
import {tradeQuote} from '../../game/politics.js';
import {useState} from 'react';
import {rosterFor} from '../../game/campaign.js';
import {isImportedEquipment,EQUIPMENT_CATALOG,equipmentCatalog,armoryOptions,armoryInventory,refillCost,firearmRepairCost} from '../../game/equipment.js';
import './armory.css';
type Props={state:any;dispatch:(action:any)=>void};
export default function Armory({state:s,dispatch}:Props){
 const [selected,setSelected]=useState(String(s.recruited[0]??3));const roster=rosterFor(s),op=roster.find(o=>String(o.id)===selected&&s.recruited.includes(o.id)&&s.operativeState[o.id].alive)??roster.find(o=>s.recruited.includes(o.id)&&s.operativeState[o.id].alive);
 const [battery,setBattery]=useState<string[]>(s.artillerySelection??[]);const inventory=armoryInventory(s),record=op?s.operativeState[op.id]:null;
 const authored=usesAuthoredEquipment(s),catalog=equipmentCatalog(s);
 const equip=(slot:string,key:string)=>{if(!op||!key)return;const item:any=armoryOptions(s,op,slot).find((w:any)=>w.key===key);if(item)dispatch({type:'equip',operativeId:op.id,slot,itemId:item.item,...(item.instanceId?{instanceId:item.instanceId}:{})});};
 return <section className="armory-section"><div className="section-intro"><p className="eyebrow">SALA DE ARMAS</p><h2>El equipo de cada combatiente</h2><p>Las armas locales se entregan en la armería. Los fusiles británicos llegan a Ensenada en 72 a 120 horas; los bloqueos demoran la entrega. Al cambiar un equipo, el arma anterior vuelve a la armería. La munición se compra al entrar al sector: 1 peso por cartucho; al salir se devuelve el valor de los cartuchos restantes. Las monturas están incluidas en el equipo.</p></div>
  <div className="production-queue">{(s.equipmentShipments??[]).map((q:any,i:number)=><p key={i}>{q.quantity} × {catalog.find(w=>w.item===q.item)?.name} · {Math.max(0,q.due-s.hour)} horas{s.blockade?' · Demorado por bloqueo':''}</p>)}</div><div className="armory-layout"><div className="armory-loadout"><label htmlFor="armory-officer">Hoja de equipo<select id="armory-officer" value={String(op?.id??'')} onChange={e=>setSelected(e.target.value)}>{roster.filter(o=>s.recruited.includes(o.id)&&s.operativeState[o.id].alive).map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
  {op&&<><h3>{op.name}</h3>{(['weapon','blade'] as const).map(slot=><label key={slot} htmlFor={`armory-${slot}`}>{slot==='weapon'?'Arma principal':'Arma blanca'}<select id={`armory-${slot}`} value={authored?'equipped':String(op[slot])} onChange={e=>equip(slot,e.target.value)}>
   {authored&&<option value="equipped">{(slot==='weapon'?weaponSpecification(op):weaponSpecification(op.blade))?.name??'Sin arma'} · Equipada</option>}
   {armoryOptions(s,op,slot).map((w:any)=><option key={w.key} value={w.key}>{w.name}{w.equipped?' · Equipada':authored?` · Estado ${w.condition}% · ${w.key}`:` · ${s.armory[w.item]} disponibles`}</option>)}
  </select></label>)}

  <div className="armory-condition"><span>Estado del arma <b>{record?.condition??100}%</b></span><span>Cargas de cebo <b>{record?.priming??50}/50</b></span><span>Piedras de sílex <b>{record?.flints??4}/4</b></span><span>Raciones <b>{record?.rations??2}/2</b></span></div>
  <button className="line-button" disabled={!record||refillCost(record)===0||s.resources.treasury<refillCost(record)} onClick={()=>dispatch({type:'resupply',operativeId:op.id})}>Reponer provisiones · {refillCost(record??{})} pesos</button>
  <button className="line-button" disabled={!record||firearmRepairCost(record)===0||s.resources.treasury<firearmRepairCost(record)} onClick={()=>dispatch({type:'repairWeapon',operativeId:op.id})}>Reparar arma · {firearmRepairCost(record??{})} pesos</button><small>La reposición y la reparación requieren un taller comunicado en el sector actual.</small></>}
  <h3>Batería de campaña</h3><p>Elegí hasta tres piezas para el próximo despliegue.</p>{[0,1,2].map(i=><label key={i} htmlFor={`battery-${i}`}>Pieza {i+1}<select id={`battery-${i}`} value={battery[i]??''} onChange={e=>{const next=[...battery];next[i]=e.target.value;setBattery(next);}}><option value="">Sin pieza</option>{EQUIPMENT_CATALOG.filter(w=>w.category==='artillery').map(w=><option key={w.item} value={w.item}>{w.name}</option>)}</select></label>)}<button className="gold-button" onClick={()=>dispatch({type:'configureArtillery',types:battery.filter(Boolean)})}>Preparar batería</button>
  </div><div className="armory-catalog">{['firearm','blade','artillery'].map(category=><div key={category}><h3>{category==='firearm'?'Armas de chispa':category==='blade'?'Acero y armas de asta':'Piezas de artillería'}</h3>{inventory.filter(w=>w.category===category).map((w:any)=><article key={w.item}>{w.category!=='artillery'&&<img className="armory-weapon-art" src={w.art??`/art/weapon-${w.id}.png`} alt={w.name}/>}<div><strong>{w.name}</strong><small>{w.quantity} en armería{w.category==='artillery'?` · Dotación: ${w.crew} hombres`:''}</small></div><button className="line-button" disabled={s.resources.treasury<(isImportedEquipment(w)?tradeQuote(s,w.price):w.price)} onClick={()=>dispatch({type:'purchaseEquipment',item:w.item,quantity:1})}>{isImportedEquipment(w)?'Importar':'Comprar'} · {isImportedEquipment(w)?tradeQuote(s,w.price):w.price} pesos</button></article>)}</div>)}</div></div>
 </section>;
}
