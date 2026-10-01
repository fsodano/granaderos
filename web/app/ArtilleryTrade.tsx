import {artilleryTradePreview,artillerySaleOffers,artilleryMerchant} from '../../game/artillery-trade.js';
import {artilleryProfile} from '../../game/artillery-definitions.js';
import {isSupplied} from '../../game/campaign.js';
export default function ArtilleryTrade({state,dispatch}:{state:any;dispatch:(action:any)=>void}){
 const sales=artillerySaleOffers(state,isSupplied);
 const purchases=artilleryMerchant(state).guns.map((gun:any)=>artilleryTradePreview(state,{sector:state.location,gunId:gun.id,buy:true},isSupplied));
 if(!sales.length&&!purchases.length)return null;
 return <section aria-label="Comercio de artillería"><h3>Comercio de artillería</h3><p>Las piezas se venden con su carga y munición. El comerciante conserva cada pieza para su compra posterior. Las piezas emplazadas requieren una dotación local para entregarlas.</p>{[...sales,...purchases].map(plan=>{
  const gun=plan.gun,buy=plan.action.type==='purchaseUsedArtillery',source=plan.action.sourceKind;
  return <article key={`${buy}:${source??'stored'}:${gun.id??gun.type}`}><strong>{artilleryProfile(state,gun).name}</strong><p>{source==='stock'?`Sin desplegar · ${plan.count} disponibles`:source==='deployed'?'Emplazada en este sector':buy?'En el comercio':'En el depósito'}</p><p>{gun.loaded?'Cargada':gun.reloadProgress?`Recarga ${Math.floor(gun.reloadProgress*100)}%`:'Descargada'} · {gun.ammo} municiones de reserva</p><button className="line-button" disabled={!plan.valid} title={plan.reason??undefined} onClick={()=>dispatch(plan.action)}>{buy?'Comprar pieza usada':'Vender pieza'} · {plan.price} pesos</button>{plan.reason&&<p>{plan.reason}</p>}</article>;
 })}</section>;
}
