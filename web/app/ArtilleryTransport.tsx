'use client';
import {useState} from 'react';
import {CAMPAIGN_SECTORS} from '../../game/data.js';
import {artilleryProfile} from '../../game/artillery-definitions.js';
import {artilleryTransportQuote,artilleryTransferDelay,localArtilleryDepot} from '../../game/artillery-transport.js';
const place=(id:string)=>CAMPAIGN_SECTORS.find(s=>s.id===id)?.name??id;
const load=(gun:any)=>`${gun.loaded?'Cargada':gun.reloadProgress?`Recarga ${Math.floor(gun.reloadProgress*100)}%`:'Descargada'} · ${gun.ammo} en reserva`;
export function SendArtillery({state:s,sector,gun,dispatch}:{state:any;sector:string;gun:any;dispatch:(a:any)=>void}){
 const destinations=CAMPAIGN_SECTORS.filter(p=>p.id!==s.location&&s.sectors[p.id]?.owner==='patriot');
 const [chosen,setChosen]=useState(''),[mode,setMode]=useState(s.routes.carts?'carts':'flotilla'),to=chosen||destinations[0]?.id||'',quote=artilleryTransportQuote(s,sector,gun.id,to,mode);
 return <fieldset aria-label={`Trasladar ${artilleryProfile(s,gun).name}`}><legend>Trasladar pieza</legend>
  <label>Destino de la pieza<select value={to} onChange={e=>setChosen(e.target.value)}><option value="">Elegir destino</option>{destinations.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
  <label>Transporte de la pieza<select value={mode} onChange={e=>setMode(e.target.value)}><option value="carts">Carretas</option><option value="flotilla">Flotilla</option></select></label>
  <p>{quote.available?`${quote.hours} horas · ${quote.crew} ${quote.crew===1?'combatiente':'combatientes'} para cargar. La pieza conserva su carga y munición.`:quote.reason}</p>
  <button className="line-button" disabled={!quote.available} onClick={()=>dispatch({type:'transportArtillery',sector,artilleryId:gun.id,to,mode})}>Enviar pieza</button>
 </fieldset>;
}
export function ArtilleryStorage({state:s}:{state:any}){
 const depot=localArtilleryDepot(s),transfers=s.artilleryTransfers??[];
 return <>
  {depot.length>0&&<section aria-label="Depósito local de artillería"><h3>Depósito de {place(s.location)}</h3><p>Podés elegir estas piezas en la batería para el próximo ataque. Conservan su munición y el trabajo de recarga.</p>{depot.map((gun:any)=><p key={gun.id} data-stored-artillery-id={gun.id}>{artilleryProfile(s,gun).name} · {load(gun)}</p>)}</section>}
  {transfers.length>0&&<section aria-label="Artillería en tránsito"><h3>Piezas en tránsito</h3>{transfers.map((t:any)=>{const delay=artilleryTransferDelay(s,t);return <div key={t.id} data-artillery-transfer-id={t.id}><p>{artilleryProfile(s,t.gun).name} · {place(t.from)} → {place(t.to)} · {t.mode==='carts'?'Carretas':'Flotilla'}</p><small>{load(t.gun)} · {delay||`Llegada en ${Math.max(0,t.dueAt-s.hour)} horas`}</small></div>;})}</section>}
 </>;
}
