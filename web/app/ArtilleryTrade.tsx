import {artilleryTradePreview} from '../../game/artillery-trade.js';
import {ARTILLERY} from '../../game/tactical.js';
import {isSupplied} from '../../game/campaign.js';
export default function ArtilleryTrade({state,dispatch}:{state:any;dispatch:(action:any)=>void}){
 const stored=state.sectors[state.location]?.owner==='patriot'?(state.artilleryStores?.[state.location]??[]):[];
 const offers=state.merchants?.[state.location]?.usedArtillery??[];
 if(!stored.length&&!offers.length)return null;
 return <section aria-label="Comercio de artillería"><h3>Comercio de artillería</h3><p>Las piezas del depósito se venden con su carga y munición. El comerciante conserva cada pieza para su compra posterior.</p>{[{guns:stored,buy:false},{guns:offers,buy:true}].flatMap(({guns,buy})=>guns.map((gun:any)=>{
  const plan=artilleryTradePreview(state,{sector:state.location,gunId:gun.id,buy},isSupplied);
  return <article key={`${buy}:${gun.id}`}><strong>{(ARTILLERY as any)[gun.type].name}</strong><p>{gun.loaded?'Cargada':gun.reloadProgress?`Recarga ${Math.floor(gun.reloadProgress*100)}%`:'Descargada'} · {gun.ammo} municiones de reserva</p><button className="line-button" disabled={!plan.valid} title={plan.reason??undefined} onClick={()=>dispatch(plan.action)}>{buy?'Comprar pieza usada':'Vender pieza'} · {plan.price} pesos</button>{plan.reason&&<p>{plan.reason}</p>}</article>;
 }))}</section>;
}
