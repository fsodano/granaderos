import {stationedArtillery,artillerySupplyPreview} from '../../game/campaign-artillery.js';
import {ARTILLERY} from '../../game/tactical.js';
import {isSupplied} from '../../game/campaign.js';
export default function StationedArtillery({state,dispatch}:{state:any;dispatch:(action:any)=>void}){
 const rows=stationedArtillery(state).filter(row=>row.gun.side==='player');
 if(!rows.length)return null;
 return <section aria-label="Artillería del sector"><h3>Piezas emplazadas en este sector</h3><p>Estas piezas conservan su posición, carga y munición entre visitas. Permanecen aquí al marchar la escuadra.</p>{rows.map(({sector,gun})=>{
  const supply=artillerySupplyPreview(state,sector,gun.id,1,isSupplied);
  return <article key={`${sector}:${gun.id}`}><strong>{(ARTILLERY as any)[gun.type].name}</strong><p>{gun.loaded?'Cargada':gun.reloadProgress?`Recarga ${Math.floor(gun.reloadProgress*100)}%`:'Descargada'} · {gun.ammo} municiones de reserva{sector==='san_lorenzo'?' · Campo de San Lorenzo':''}</p><button className="line-button" disabled={!supply.valid} title={supply.reason??undefined} onClick={()=>dispatch(supply.action)}>Preparar 1 munición · {supply.goods.powder} pólvora + {supply.goods.scrapIron} hierro</button>{supply.reason&&<p>{supply.reason}</p>}</article>;
 })}</section>;
}
