import {EQUIPMENT_CATALOG,merchantStatus,unissuedArtilleryStock,newArtilleryPayload} from './equipment.js';
import {operativeInTransit,operativeLocation} from './squads.js';
import {ARTILLERY,fieldCapable} from './tactical.js';
import {storedArtilleryRecord} from './artillery-transport.js';

export const USED_ARTILLERY_LIMIT=100;
const need=(ok,message)=>{if(!ok)throw Error(message);};
// These fractions match handheld trading. Ammunition stays with the exact gun;
// it is not valued separately or converted into campaign resources.
export function artilleryTradePreview(s,{sector,gunId=null,buy=false,sourceKind='stored',stockType=null,expectedCount=null},isSupplied,{deferSettlement=false}={}){
 const merchant=s.merchants?.[s.location];
 const stock=unissuedArtilleryStock(s),count=(stock.camp[stockType]??0)+(stock.depot[stockType]??0);
 const source=buy?merchant?.usedArtillery:sourceKind==='deployed'?s.sectorStates?.[sector]?.artillery:s.artilleryStores?.[s.location];
 const gun=!buy&&sourceKind==='stock'?(count>0?newArtilleryPayload(stockType,null):undefined):source?.find(g=>g.id===gunId);
 const catalog=EQUIPMENT_CATALOG.find(item=>item.item===gun?.type);
 const price=Math.floor((catalog?.price??0)*(buy ? .8 : .4));
 const market=merchantStatus(s,null,isSupplied);
 const local=s.squad.some(id=>s.operativeState[id]?.alive&&!s.operativeState[id]?.captured&&!operativeInTransit(s,id)&&operativeLocation(s,id)===s.location);
 const crew=s.squad.filter(id=>{const u=s.operativeState[id];return u?.alive&&!u.captured&&u.hp>=15&&!operativeInTransit(s,id)&&operativeLocation(s,id)===s.location;});
 const reason=sector!==s.location?'Debes estar en la maestranza que guarda la pieza.':
  !['stored','deployed','stock'].includes(sourceKind)||buy&&sourceKind!=='stored'?'El origen de la pieza es inválido.':
  s.pendingEncounter?'Resuelve el encuentro antes de negociar.':market.reason??
  (s.enemyGroups?.some(g=>g.target===s.location&&['waiting','engaged','stationed'].includes(g.status))||s.sectorStates?.[s.location]?.units?.some(u=>u.side==='enemy'&&fieldCapable(u))?'Asegurá el sector antes de negociar.':
   !local?'La escuadra debe estar presente.':!gun||!catalog||gun.side!=='player'?'La pieza ya no está disponible.':
   !buy&&sourceKind==='stock'&&(!Number.isInteger(expectedCount)||count!==expectedCount)?'Las existencias cambiaron. Revisa la pieza antes de vender.':
   !buy&&sourceKind==='deployed'&&crew.length<ARTILLERY[gun.type].crew?'No hay suficientes artilleros disponibles para entregar la pieza.':
   deferSettlement?null:buy?(s.resources.treasury<price?'No hay pesos suficientes.':(s.artilleryStores?.[s.location]?.length??0)>=2000?'El depósito de artillería está lleno.':null):
   merchant.cash<price?'El comerciante no tiene fondos suficientes.':(merchant.usedArtillery?.length??0)>=USED_ARTILLERY_LIMIT?'El comerciante no puede guardar más piezas usadas.':null);
 const action={type:buy?'purchaseUsedArtillery':'sellArtillery',sector,...(sourceKind==='stock'?{sourceKind,stockType,expectedCount:count}:{gunId,...(sourceKind==='deployed'?{sourceKind}:{})})};
 return {valid:!reason,reason,gun,price,action,count};
}
export function artillerySaleOffers(s,isSupplied,options={}){
 const stock=unissuedArtilleryStock(s),at=s.location;
 if(s.sectors[at]?.owner!=='patriot')return [];
 const rows=[...(s.artilleryStores?.[at]??[]).map(g=>({sector:at,gunId:g.id})),
  ...(s.sectorStates?.[at]?.artillery??[]).filter(g=>g.side==='player').map(g=>({sector:at,gunId:g.id,sourceKind:'deployed'})),
  ...Object.keys(stock.camp).filter(type=>stock.camp[type]+stock.depot[type]>0).map(stockType=>({sector:at,sourceKind:'stock',stockType,expectedCount:stock.camp[stockType]+stock.depot[stockType]}))];
 return rows.map(row=>artilleryTradePreview(s,row,isSupplied,options));
}
function stockIdentity(s){
 const records=[...Object.values(s.sectorStates??{}),...Object.values(s.sceneStates??{}),s.pendingBattle,...(s.convoys??[])].filter(Boolean).flatMap(b=>b.artillery??[]);
 records.push(...Object.values(s.artilleryStores??{}).flat(),...Object.values(s.merchants??{}).flatMap(m=>m.usedArtillery??[]));
 const ids=new Set(records.map(g=>g.id));let id;
 do{need(Number.isInteger(s.nextArmoryItemId)&&s.nextArmoryItemId<1e9,'La secuencia de la armería está agotada.');id=`merchant-artillery-${s.nextArmoryItemId++}`;}while(ids.has(id));
 return id;
}
export function tradeArtillery(s,action,isSupplied,{deferSettlement=false}={}){
 const buy=action.type==='purchaseUsedArtillery',plan=artilleryTradePreview(s,{...action,buy},isSupplied,{deferSettlement});
 need(plan.valid,plan.reason);
 const merchant=s.merchants[s.location];
 s.artilleryStores??={};s.artilleryStores[s.location]??=[];merchant.usedArtillery??=[];
 const destination=buy?s.artilleryStores[s.location]:merchant.usedArtillery;
 if(!buy&&action.sourceKind==='stock'){
  const stock=unissuedArtilleryStock(s);
  if(stock.camp[action.stockType]>0){s.resources.cannons--;if((s.armory[action.stockType]??0)>0)s.armory[action.stockType]--;}
  else s.depots[s.location].cannons--;
  destination.push(newArtilleryPayload(action.stockType,stockIdentity(s)));
 }else{
  const source=buy?merchant.usedArtillery:action.sourceKind==='deployed'?s.sectorStates[action.sector].artillery:s.artilleryStores[s.location];
  const [gun]=source.splice(source.findIndex(g=>g.id===action.gunId),1);destination.push(storedArtilleryRecord(gun));
 }
 if(!deferSettlement){s.resources.treasury+=buy?-plan.price:plan.price;merchant.cash= Math.min(1e9,merchant.cash+(buy?plan.price:-plan.price));}
 return plan;
}
