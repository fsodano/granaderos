'use client';
import {useState} from 'react';
import Horses from './Horses';
import OwnedArtillery,{hasOwnedArtillery} from './OwnedArtillery';
import {foundryFor} from '../../game/campaign-foundry.js';
import {foundryReason} from '../../game/campaign-roles.js';
import {headquartersFor} from '../../game/campaign-headquarters.js';
export default function SectorPreparation({state:s,sector,dispatch,onOpen}:{state:any;sector:string;dispatch:(a:any)=>void;onOpen?:()=>void}){
 const [service,setService]=useState<'horses'|'artillery'|null>(null);
 const openService=(next:'horses'|'artillery')=>{onOpen?.();setService(next);};
 const foundry=foundryFor(s),blocked=Boolean(s.pendingBattle||s.pendingEncounter||s.defeated)||s.sectors[sector]?.owner!=='patriot';
 const orders:any[]=[];
 if(sector===foundry.sector){
  if(!s.flags.foundry)orders.push({type:'foundry',label:`Organizar ${foundry.name}`,price:foundry.setupCost,reason:foundryReason(s)});
  else if(!s.flags.armyFunded)orders.push({type:'fundArmy',label:`Preparar ${foundry.armyName}`,price:foundry.fundingCost});
  if(!s.flags.parliament)orders.push({type:'diplomacy',kind:'parliament',label:'Acordar el tránsito por los pasos',price:200});
 }
 if(sector==='salta'&&!s.flags.northPact)orders.push({type:'diplomacy',kind:'northPact',label:'Acordar la defensa con Güemes',price:300});
 if(sector==='tucuman'&&!s.flags.partisanSupply)orders.push({type:'diplomacy',kind:'partisanSupply',label:'Abastecer a las partidas del norte',price:250});
 if(sector===headquartersFor(s)){
  if(!s.flags.emancipation)orders.push({type:'diplomacy',kind:'emancipation',label:'Garantizar la libertad de las familias',price:150});
  else if(!s.flags.commission)orders.push({type:'diplomacy',kind:'commission',label:'Comisionar oficiales pardos y morenos',price:100});
 }
 const local=sector===s.location&&s.sectors[sector]?.owner==='patriot';
 if(!orders.length&&!local)return null;
 return <><details className="sector-preparation"><summary>Preparativos del sector</summary>{local&&<><button className="line-button" disabled={blocked} onClick={()=>openService('horses')}>Caballada</button>{hasOwnedArtillery(s)&&<button className="line-button" disabled={blocked} onClick={()=>openService('artillery')}>Artillería</button>}</>}{orders.map(order=><button key={order.kind??order.type} className="line-button" title={order.reason||undefined} disabled={blocked||Boolean(order.reason)||s.resources.treasury<order.price} onClick={()=>dispatch({type:order.type,...(order.kind?{kind:order.kind}:{})})}>{order.label} · {order.price} pesos</button>)}</details>
 {service&&<div className="strategic-menu-backdrop" onClick={()=>setService(null)}><section className="strategic-local-services" role="dialog" aria-modal="true" aria-label={service==='horses'?'Caballada del sector':'Artillería del sector'} onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')setService(null);}}><header><h2>{service==='horses'?'Caballada':'Artillería propia'}</h2><button className="line-button" autoFocus aria-label={service==='horses'?'Cerrar caballada':'Cerrar artillería'} onClick={()=>setService(null)}>×</button></header><div>{service==='horses'?<Horses state={s} dispatch={dispatch}/>:<OwnedArtillery state={s} dispatch={dispatch}/>}</div></section></div>}</>;
}
