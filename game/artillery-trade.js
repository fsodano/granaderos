import {EQUIPMENT_CATALOG,merchantStatus} from './equipment.js';
import {operativeInTransit,operativeLocation} from './squads.js';
import {fieldCapable} from './tactical.js';

export const USED_ARTILLERY_LIMIT=100;
const need=(ok,message)=>{if(!ok)throw Error(message);};
// These fractions match handheld trading. Ammunition stays with the exact gun;
// it is not valued separately or converted into campaign resources.
export function artilleryTradePreview(s,{sector,gunId,buy=false},isSupplied){
 const merchant=s.merchants?.[s.location];
 const source=buy?merchant?.usedArtillery:s.artilleryStores?.[s.location];
 const gun=source?.find(g=>g.id===gunId);
 const catalog=EQUIPMENT_CATALOG.find(item=>item.item===gun?.type);
 const price=Math.floor((catalog?.price??0)*(buy ? .8 : .4));
 const market=merchantStatus(s,null,isSupplied);
 const local=s.squad.some(id=>s.operativeState[id]?.alive&&!s.operativeState[id]?.captured&&!operativeInTransit(s,id)&&operativeLocation(s,id)===s.location);
 const reason=sector!==s.location?'Debes estar en la maestranza que guarda la pieza.':
  s.pendingEncounter?'Resuelve el encuentro antes de negociar.':market.reason??
  (s.enemyGroups?.some(g=>g.target===s.location&&['waiting','engaged','stationed'].includes(g.status))||s.sectorStates?.[s.location]?.units?.some(u=>u.side==='enemy'&&fieldCapable(u))?'Asegurá el sector antes de negociar.':
   !local?'La escuadra debe estar presente.':!gun||!catalog?'La pieza ya no está disponible.':
   buy?(s.resources.treasury<price?'No hay pesos suficientes.':(s.artilleryStores?.[s.location]?.length??0)>=2000?'El depósito de artillería está lleno.':null):
   merchant.cash<price?'El comerciante no tiene fondos suficientes.':(merchant.usedArtillery?.length??0)>=USED_ARTILLERY_LIMIT?'El comerciante no puede guardar más piezas usadas.':null);
 return {valid:!reason,reason,gun,price,action:{type:buy?'purchaseUsedArtillery':'sellArtillery',sector,gunId}};
}
export function tradeArtillery(s,action,isSupplied){
 const buy=action.type==='purchaseUsedArtillery',plan=artilleryTradePreview(s,{...action,buy},isSupplied);
 need(plan.valid,plan.reason);
 const merchant=s.merchants[s.location];
 s.artilleryStores??={};s.artilleryStores[s.location]??=[];merchant.usedArtillery??=[];
 const source=buy?merchant.usedArtillery:s.artilleryStores[s.location],destination=buy?s.artilleryStores[s.location]:merchant.usedArtillery;
 const [gun]=source.splice(source.findIndex(g=>g.id===action.gunId),1);destination.push(gun);
 s.resources.treasury+=buy?-plan.price:plan.price;
 merchant.cash= Math.min(1e9,merchant.cash+(buy?plan.price:-plan.price));
 return plan;
}
