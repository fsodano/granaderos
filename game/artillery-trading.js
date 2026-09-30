import {merchantCash,changeMerchantCash} from './equipment-merchants.js';
import {storedArtilleryRecord} from './artillery-transport.js';
import {artilleryTradingRules,artilleryBuyingPercent} from './artillery-trading-rules.js';
import {CAMPAIGN_SECTORS} from './data.js';
import {artilleryProfile,ARTILLERY} from './artillery-definitions.js';
import {stationedArtillery,validateArtilleryInventory} from './campaign-artillery.js';
import {localArtilleryDepot} from './artillery-depots.js';
import {hasWorkshop} from './campaign-headquarters.js';
import {operativeInTransit,operativeLocation} from './squads.js';
import {careAssignmentBusy} from './medical-care.js';
const need=(ok,message)=>{if(!ok)throw Error(message);};
const parent=id=>id==='san_lorenzo'?'san_nicolas':id;
const capable=u=>u.hp>=15&&(u.energy??100)>0&&!u.routed&&!u.surrendered&&!u.departure&&!u.fled&&!u.asleep&&!u.unconscious;
const actors=s=>(s.squad??[]).filter(id=>{const r=s.operativeState[id];return r?.alive&&capable(r)&&!r.captured&&!operativeInTransit(s,id)&&!careAssignmentBusy(r.assignment)&&!s.militiaTraining?.some(c=>c.trainerId===id)&&operativeLocation(s,id)===s.location;});
export const artilleryMerchant=s=>({cash:merchantCash(s),guns:s.artilleryMerchants?.[s.location]?.guns??[]});
export const artilleryBuyingRate=s=>artilleryBuyingPercent(s)/100;
function access(s,supplied){
 if(s.defeated)return 'La campaña ha terminado.';
 if(s.pendingBattle||s.pendingEncounter)return 'Salí de la escena táctica antes de comerciar.';
 if(!artilleryTradingRules(s).enabled)return 'Esta campaña no permite comerciar piezas de artillería.';
 if(!hasWorkshop(s,s.location)||s.sectors[s.location]?.owner!=='patriot'||!supplied)return 'El comercio de piezas necesita un taller controlado y comunicado con el cuartel general.';
 if(s.enemyGroups?.some(g=>g.target===s.location&&['waiting','engaged','stationed'].includes(g.status))||Object.entries(s.sectorStates??{}).some(([id,b])=>parent(id)===s.location&&b.units?.some(u=>u.side==='enemy'&&capable(u))))return 'Aún quedan enemigos capaces de combatir junto al taller.';
 if(!actors(s).length)return 'Se necesita un combatiente disponible de la escuadra en el taller.';
 return '';
}
export function artillerySaleQuote(s,offer,supplied,{deferSettlement=false}={}){
 const shop=artilleryMerchant(s),kind=offer.kind,gun=kind==='depot'?localArtilleryDepot(s).find(g=>g.id===offer.artilleryId):kind==='field'?stationedArtillery(s).find(v=>v.sector===offer.sector&&v.gun.id===offer.artilleryId)?.gun:kind==='stock'&&Object.hasOwn(ARTILLERY,offer.model)?{type:offer.model}:null;
 const spec=gun&&artilleryProfile(s,gun),price=spec?Math.floor(spec.price*artilleryBuyingPercent(s)/100):0;
 const reason=access(s,supplied)||(!gun?'La pieza ofrecida ya no está disponible.':kind==='stock'&&(!Number.isInteger(offer.stockCount)||offer.stockCount<=0||offer.stockCount!==(s.armory[offer.model]??0))?'La cantidad ofrecida cambió. Revisá la armería.':kind==='stock'&&s.nextArtilleryId>=1000000000?'El registro de piezas no admite más entradas.':kind!=='stock'&&gun.side!=='player'?'La pieza debe estar bajo tu control.':kind==='field'&&actors(s).length<spec.crew?`Se necesitan ${spec.crew} combatientes disponibles para entregar esta pieza.`:!deferSettlement&&shop.guns.length>=100?'El taller no tiene espacio para más piezas.':!deferSettlement&&shop.cash<price?'El taller no tiene suficientes pesos para comprar esta pieza.':!deferSettlement&&s.resources.treasury+price>1000000000?'La tesorería no admite ese pago.':'');
 return {available:!reason,reason,price,gun};
}
export function artilleryRepurchaseQuote(s,id,supplied,{deferSettlement=false}={}){
 const shop=artilleryMerchant(s),gun=shop.guns.find(g=>g.id===id),price=gun?Math.ceil(artilleryProfile(s,gun).price*artilleryTradingRules(s).resalePercent/100):0;
 const reason=access(s,supplied)||(!gun?'Esta pieza ya no está en venta.':!deferSettlement&&(s.artilleryDepots?.[s.location]?.length??0)>=2000?'El depósito local está lleno.':!deferSettlement&&s.resources.treasury<price?'No hay suficientes pesos para comprar esta pieza.':!deferSettlement&&shop.cash+price>1000000000?'El taller no admite ese pago.':'');return {available:!reason,reason,price,gun};
}
export function artillerySaleOffers(s){
 return [...Object.keys(ARTILLERY).filter(model=>(s.armory[model]??0)>0).map(model=>({kind:'stock',model,stockCount:s.armory[model]})),...localArtilleryDepot(s).map(g=>({kind:'depot',artilleryId:g.id})),...stationedArtillery(s).filter(v=>v.gun.side==='player').map(v=>({kind:'field',sector:v.sector,artilleryId:v.gun.id}))];
}
const stored=storedArtilleryRecord;
export function sellArtillery(s,offer,supplied,options={}){
 const q=artillerySaleQuote(s,offer,supplied,options);need(q.available,q.reason);let gun;
 if(offer.kind==='stock'){const spec=artilleryProfile(s,offer.model);s.armory[offer.model]--;gun={id:`piece-${s.nextArtilleryId++}`,type:offer.model,side:'player',loaded:spec.initialLoaded,ammo:spec.initialAmmo};}
 else{const stock=offer.kind==='depot'?s.artilleryDepots[s.location]:s.sectorStates[offer.sector].artillery;const index=stock.findIndex(g=>g.id===offer.artilleryId);gun=stored(stock[index]);stock.splice(index,1);}
 s.artilleryMerchants??={};s.artilleryMerchants[s.location]??={guns:[]};const shop=s.artilleryMerchants[s.location];shop.guns.push(gun);if(!options.deferSettlement){changeMerchantCash(s,s.location,-q.price);s.resources.treasury+=q.price;}return {...q,gun};
}
export function repurchaseArtillery(s,id,supplied,options={}){
 const q=artilleryRepurchaseQuote(s,id,supplied,options);need(q.available,q.reason);const shop=s.artilleryMerchants[s.location],index=shop.guns.findIndex(g=>g.id===id),gun=shop.guns.splice(index,1)[0];if(!options.deferSettlement){changeMerchantCash(s,s.location,q.price);s.resources.treasury-=q.price;}s.artilleryDepots??={};s.artilleryDepots[s.location]??=[];s.artilleryDepots[s.location].push(gun);return q;
}
export function validateArtilleryMerchants(s){
 if(s.artilleryMerchants===undefined)return;
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v),shops=s.artilleryMerchants;need(object(shops)&&Object.keys(shops).every(id=>CAMPAIGN_SECTORS.some(p=>p.id===id)),'Los talleres de artillería son inválidos.');
 for(const shop of Object.values(shops)){need(object(shop)&&Object.keys(shop).length===1&&Array.isArray(shop.guns)&&shop.guns.length<=100,'La caja o las existencias del taller son inválidas.');validateArtilleryInventory(shop.guns);need(shop.guns.every(g=>g.side==='player'&&g.x===undefined&&g.y===undefined&&g.stationed===undefined&&g.fromDepot===undefined&&g.tacticalLevel===undefined&&g.recovered===undefined),'El taller contiene una pieza inválida.');}
}
