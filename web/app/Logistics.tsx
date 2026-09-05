'use client';
import {useState} from 'react';
import {CAMPAIGN_SECTORS,RESOURCE_NAMES} from '../../game/data.js';
import {TRANSPORT_OPTIONS,transferOptions,inventoryAt,cargoWeight,convoyStatus} from '../../game/logistics.js';
import './logistics.css';
type Props={state:any;dispatch:(action:any)=>void};
const costs:Record<string,string>={posta:'150 pesos · 10 caballos',carts:'180 pesos · 4 caballos',flotilla:'400 pesos · 1 cañón',mules:'120 pesos · 2 animales de carga'};
export default function Logistics({state:s,dispatch}:Props){
 const [source,setSource]=useState('reserve'),[destination,setDestination]=useState(s.location??'retiro'),[mode,setMode]=useState('carts'),[resource,setResource]=useState('cartridges'),[quantity,setQuantity]=useState('50');
 const options=transferOptions(s,source,destination),transport=options.find(o=>o.id===mode),inventory=inventoryAt(s,source),amount=Number(quantity),weight=Number.isFinite(amount)&&amount>0?cargoWeight({[resource]:amount}):0;
 const holdings=inventory[resource]??0;
 const valid=transport?.available&&source!==destination&&Number.isInteger(amount)&&amount>0&&amount<=holdings&&weight<=transport.capacity&&!(resource==='cannons'&&!['carts','flotilla'].includes(mode));
 const places=[{id:'reserve',name:'Reserva de Buenos Aires'},...CAMPAIGN_SECTORS.filter(x=>s.sectors[x.id].owner==='patriot').map(x=>({id:x.id,name:x.name}))];
 const title=(id:string)=>id==='reserve'?'Reserva de Buenos Aires':CAMPAIGN_SECTORS.find(x=>x.id===id)?.name??'Depósito';
 const cargoResources=Object.entries(RESOURCE_NAMES).filter(([id])=>!['horses','infantry'].includes(id));
 return <section className="logistics-section" aria-labelledby="logistics-title"><div className="section-intro"><p className="eyebrow">CONVOYES Y DEPÓSITOS</p><h2 id="logistics-title">Llevar la guerra a buen puerto</h2><p>Los pertrechos salen de un depósito y viajan hasta otro. Las rutas ocupadas y los bloqueos retienen la carga en tránsito.</p></div>
  <div className="logistics-routes">{TRANSPORT_OPTIONS.map(o=><article key={o.id}><h3>{o.name}</h3><p>{o.description}</p><div><span>{o.capacity} kg de capacidad</span><small>{costs[o.id]}</small></div><button type="button" className="line-button" disabled={s.routes[o.id]} onClick={()=>dispatch({type:'transport',mode:o.id})}>{s.routes[o.id]?'✓ Red organizada':'Organizar transporte'}</button></article>)}</div>
  <div className="logistics-layout"><form className="logistics-order" onSubmit={e=>{e.preventDefault();if(valid)dispatch({type:'supplyTransfer',source,destination,mode,goods:{[resource]:amount}});}}>
   <h3>Preparar un convoy</h3><div className="logistics-pair"><label htmlFor="cargo-source">Origen<select id="cargo-source" value={source} onChange={e=>setSource(e.target.value)}>{places.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label htmlFor="cargo-destination">Destino<select id="cargo-destination" value={destination} onChange={e=>setDestination(e.target.value)}>{places.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>
   <label htmlFor="cargo-mode">Medio de transporte<select id="cargo-mode" value={mode} onChange={e=>setMode(e.target.value)}>{options.map(o=><option key={o.id} value={o.id}>{o.name} · {o.capacity} kg</option>)}</select></label>
   <p className={transport?.available?'logistics-route-open':'logistics-route-closed'}>{transport?.reason}{transport?.available&&` Trayecto: ${transport.hours} horas${transport.remounts?` · ${transport.remounts} caballos de remonta`:''}.`}</p>
   <div className="logistics-pair"><label htmlFor="cargo-resource">Pertrechos<select id="cargo-resource" value={resource} onChange={e=>setResource(e.target.value)}>{cargoResources.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label htmlFor="cargo-quantity">Cantidad<input id="cargo-quantity" type="number" min="1" step="1" max={holdings||undefined} value={quantity} onChange={e=>setQuantity(e.target.value)} required/></label></div>
   <div className="logistics-load"><span>Disponible en origen: <b>{holdings}</b></span><span>Carga prevista: <b>{weight.toLocaleString('es-AR',{maximumFractionDigits:1})} / {transport?.capacity??0} kg</b></span></div>
   {resource==='cannons'&&!['carts','flotilla'].includes(mode)&&<p className="logistics-route-closed">Los cañones necesitan carretas o embarcaciones.</p>}
   {source===destination&&<p className="logistics-route-closed">Elegí un depósito de destino diferente.</p>}
   <button className="gold-button" type="submit" disabled={!valid}>Despachar convoy</button>
  </form><aside className="logistics-stock"><h3>{title(source)}</h3><p>Existencias disponibles para el traslado</p><dl>{Object.entries(inventory).filter(([,value])=>Number(value)>0).map(([id,value])=><div key={id}><dt>{(RESOURCE_NAMES as Record<string,string>)[id]}</dt><dd>{Number(value).toLocaleString('es-AR')}</dd></div>)}</dl>{!Object.values(inventory).some(v=>Number(v)>0)&&<p>Este depósito todavía no tiene pertrechos.</p>}</aside></div>
  <div className="logistics-convoys"><h3>Convoyes en camino</h3>{!s.convoys?.length?<p className="muted">No hay convoyes en tránsito.</p>:s.convoys.map((c:any)=>{const status=convoyStatus(s,c);return <article key={c.id}><div><strong>{title(c.source)} → {title(c.destination)}</strong><p>{Object.entries(c.goods).map(([id,n])=>`${n} ${(RESOURCE_NAMES as Record<string,string>)[id].toLowerCase()}`).join(' · ')}</p></div><span className={status.delayed?'logistics-route-closed':''}>{status.delayed?status.reason:`${Math.max(0,c.due-s.hour)} horas restantes`}</span></article>;})}</div>
 </section>;
}
