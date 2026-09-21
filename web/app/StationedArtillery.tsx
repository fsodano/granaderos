import {stationedArtillery,artillerySupplyPreview} from '../../game/campaign-artillery.js';
import {ARTILLERY} from '../../game/tactical.js';
import {isSupplied} from '../../game/campaign.js';
import {useState} from 'react';
import {CAMPAIGN_SECTORS} from '../../game/data.js';
import {artilleryTransportPreview} from '../../game/artillery-transport.js';
import ArtilleryTrade from './ArtilleryTrade';
function Transport({state,sector,gun,dispatch}:{state:any;sector:string;gun:any;dispatch:(action:any)=>void}){
 const [destination,setDestination]=useState(''),[mode,setMode]=useState('carts');
 const plan=artilleryTransportPreview(state,{sector,gunId:gun.id,destination,mode});
 return <div><label>Destino de la pieza<select value={destination} onChange={e=>setDestination(e.target.value)}><option value="">Elegí un sector</option>{CAMPAIGN_SECTORS.filter(s=>s.id!==state.location&&state.sectors[s.id]?.owner==='patriot').map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Transporte de la pieza<select value={mode} onChange={e=>setMode(e.target.value)}><option value="carts">Carretas</option><option value="flotilla">Flotilla</option></select></label><p>{plan.weight} kg{plan.hours?` · ${plan.hours} horas`:''}. Conserva su carga y munición. Esperará si se corta la ruta.</p><button className="line-button" disabled={!plan.valid} title={plan.reason??undefined} onClick={()=>dispatch(plan.action)}>Enviar pieza</button>{plan.reason&&<p>{plan.reason}</p>}</div>;
}
export default function StationedArtillery({state,dispatch}:{state:any;dispatch:(action:any)=>void}){
 const rows=stationedArtillery(state).filter(row=>row.gun.side==='player');
 const stored=state.sectors[state.location]?.owner==='patriot'?(state.artilleryStores?.[state.location]??[]):[];
 if(!rows.length&&!stored.length)return <ArtilleryTrade state={state} dispatch={dispatch}/>;
 return <section aria-label="Artillería del sector">{rows.length>0&&<><h3>Piezas emplazadas en este sector</h3><p>Estas piezas conservan su posición, carga y munición entre visitas. Permanecen aquí al marchar la escuadra.</p></>}{rows.map(({sector,gun})=>{
  const supply=artillerySupplyPreview(state,sector,gun.id,1,isSupplied);
  return <article key={`${sector}:${gun.id}`}><strong>{(ARTILLERY as any)[gun.type].name}</strong><p>{gun.loaded?'Cargada':gun.reloadProgress?`Recarga ${Math.floor(gun.reloadProgress*100)}%`:'Descargada'} · {gun.ammo} municiones de reserva{sector==='san_lorenzo'?' · Campo de San Lorenzo':''}</p><button className="line-button" disabled={!supply.valid} title={supply.reason??undefined} onClick={()=>dispatch(supply.action)}>Preparar 1 munición · {supply.goods.powder} pólvora + {supply.goods.scrapIron} hierro</button>{supply.reason&&<p>{supply.reason}</p>}<Transport state={state} sector={sector} gun={gun} dispatch={dispatch}/></article>;
 })}{stored.length>0&&<><h3>Piezas transportadas al depósito</h3><p>Podés seleccionarlas en la batería de campaña. Saldrán con la munición que conservan.</p>{stored.map((gun:any)=><p key={gun.id}>{(ARTILLERY as any)[gun.type].name} · {gun.loaded?'Cargada':gun.reloadProgress?`Recarga ${Math.floor(gun.reloadProgress*100)}%`:'Descargada'} · {gun.ammo} municiones de reserva</p>)}</>}<ArtilleryTrade state={state} dispatch={dispatch}/></section>;
}
