import {artillerySaleQuote,artilleryRepurchaseQuote,artillerySaleOffers as canonicalSaleOffers,sellArtillery,repurchaseArtillery,artilleryMerchant} from './artillery-trading.js';
import {artilleryProfile} from './artillery-definitions.js';

export const USED_ARTILLERY_LIMIT=100;
const parent=id=>id==='san_lorenzo'?'san_nicolas':id;
const need=(ok,message)=>{if(!ok)throw Error(message);};
const offerFor=action=>action.sourceKind==='stock'?{kind:'stock',model:action.stockType,stockCount:action.expectedCount}:action.sourceKind==='deployed'?{kind:'field',sector:action.sector,artilleryId:action.gunId}:{kind:'depot',artilleryId:action.gunId};
// The combined basket and direct artillery controls share prices, custody and
// one cash drawer. Deferred settlement is checked by the basket as a whole.
export function artilleryTradePreview(s,{sector,gunId=null,buy=false,sourceKind='stored',stockType=null,expectedCount=null},isSupplied,options={}){
 const offer=offerFor({sector,gunId,sourceKind,stockType,expectedCount}),q=buy?artilleryRepurchaseQuote(s,gunId,isSupplied(s,s.location),options):artillerySaleQuote(s,offer,isSupplied(s,s.location),options);
 const reason=parent(sector)!==s.location?'Debes estar en la maestranza de la pieza.':!['stored','deployed','stock'].includes(sourceKind)||buy&&sourceKind!=='stored'?'El origen de la pieza es inválido.':q.reason;
 const count=sourceKind==='stock'?s.armory?.[stockType]??0:1;
 const profile=q.gun&&artilleryProfile(s,q.gun),gun=!buy&&sourceKind==='stock'&&q.gun?{id:null,type:stockType,side:'player',loaded:profile.initialLoaded,ammo:profile.initialAmmo}:q.gun;
 return {...q,valid:!reason,available:!reason,reason,gun,count,action:{type:buy?'purchaseUsedArtillery':'sellArtillery',sector,...(sourceKind==='stock'?{sourceKind,stockType,expectedCount:count}:{gunId,...(sourceKind==='deployed'?{sourceKind}:{})})}};
}
export function artillerySaleOffers(s,isSupplied,options={}){
 return canonicalSaleOffers(s).map(offer=>artilleryTradePreview(s,{sector:offer.sector??s.location,gunId:offer.artilleryId,sourceKind:{field:'deployed',depot:'stored',stock:'stock'}[offer.kind],stockType:offer.model,expectedCount:offer.stockCount},isSupplied,options));
}
export function tradeArtillery(s,action,isSupplied,options={}){
 if(action.kind!==undefined)action={...action,sector:action.sector??s.location,gunId:action.artilleryId,sourceKind:{field:'deployed',depot:'stored',stock:'stock'}[action.kind],stockType:action.model,expectedCount:action.stockCount};
 const buy=action.type==='purchaseUsedArtillery',plan=artilleryTradePreview(s,{...action,buy},isSupplied,options);need(plan.valid,plan.reason);
 const result=buy?repurchaseArtillery(s,action.gunId,isSupplied(s,s.location),options):sellArtillery(s,offerFor(action),isSupplied(s,s.location),options);
 return {...plan,...result};
}
export {artilleryMerchant};
