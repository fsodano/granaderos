import {AMMO_KEYS,AMMO_TYPES,ammoTypeFor,ammoStock,ammoCount,totalAmmo,changeAmmo,validateAmmo,validateAmmunitionChoice,ammunitionChoiceReason} from './ammo-types.js';
import {AMMUNITION_MARKET_LOCATIONS,ammunitionMarketRules,ammunitionUnitPrice} from './ammunition-market-rules.js';
import {campaignRules} from './campaign-rules.js';
import {arrivalFacilityOptions} from './arrival-sites.js';
import {operativeLocation} from './squads.js';
import {worldOwner,validWorldLocation} from './world-cells.js';
import {weaponSpecification} from './weapon-definition.js';
import {supplyRoom,pocketChangeReason} from './personal-pockets.js';
import {retainedMilitaryBodies} from './military-remains.js';

const need=(ok,message)=>{if(!ok)throw Error(message);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const count=value=>Number.isSafeInteger(value)&&value>=0&&value<=1000000;
export const AMMUNITION_ORDER_LIMIT=60;
export const hasAmmunitionMarket=(s,at)=>arrivalFacilityOptions(at).length>0&&ammunitionMarketRules(s,at).enabled;
export const ammunitionShopCapacity=(key,s,at)=>ammunitionMarketRules(s,at).families[key].capacity;
const freshShop=(s,at)=>({stock:Object.fromEntries(AMMO_KEYS.map(key=>[key,ammunitionMarketRules(s,at).families[key].initial])),restockHours:0});
const shop=(s,at=s.location)=>s.ammunitionShops?.[at]??freshShop(s,at);
const loaded=record=>record?.carriedLoaded??0;
export function carriedAmmunition(op,record){return {...op,...record,loaded:loaded(record),ammunition:{...(record?.ammunition??{})},ammo:totalAmmo({ammunition:record?.ammunition??{}}),...(record?.carriedReloadProgress?{reloadProgress:record.carriedReloadProgress}:{})};}
function keep(record,unit){if(unit.ammunitionChoice!==undefined)record.ammunitionChoice=unit.ammunitionChoice;else delete record.ammunitionChoice;record.ammunition={...unit.ammunition};record.ammo=totalAmmo(unit);record.carriedLoaded=unit.loaded??0;if(unit.reloadProgress)record.carriedReloadProgress=unit.reloadProgress;else delete record.carriedReloadProgress;}
function validateCounts(value){need(object(value)&&Object.entries(value).every(([key,n])=>Object.hasOwn(AMMO_TYPES,key)&&count(n)),'La reserva de munición no es válida.');}

// Previously settled cartridges were refunded. They do not become free stock.
// A pending scene already owns its paid issue and is settled physically once.
export function migrateAmmunitionCustody(s){
 if(s.ammunitionCustodyVersion===undefined){
  need(s.ammunitionStores===undefined&&s.ammunitionShops===undefined,'Falta la versión de las reservas de munición.');
  s.ammunitionCustodyVersion=1;s.ammunitionStores={};s.ammunitionShops={};
  if(s.contentCampaign?.package.ammunitionMarket)for(const {id}of AMMUNITION_MARKET_LOCATIONS)s.ammunitionShops[id]=freshShop(s,id);
 }
 need(s.ammunitionCustodyVersion===1,'La versión de las reservas de munición no es válida.');
 return s;
}
export function validateAmmunitionCustody(s,roster){
 migrateAmmunitionCustody(s);
 need(object(s.ammunitionStores)&&object(s.ammunitionShops),'Las reservas de munición no son válidas.');
 if(s.contentCampaign?.package.ammunitionMarket)need(AMMUNITION_MARKET_LOCATIONS.every(({id})=>Object.hasOwn(s.ammunitionShops,id)),'Faltan existencias de un proveedor configurado.');
 for(const [at,counts]of Object.entries(s.ammunitionStores)){need(validWorldLocation(at),'El depósito de munición no existe.');validateCounts(counts);}
 for(const [at,merchant]of Object.entries(s.ammunitionShops)){
  need(arrivalFacilityOptions(at).length>0&&object(merchant)&&object(merchant.stock)&&Object.keys(merchant.stock).length===AMMO_KEYS.length&&AMMO_KEYS.every(key=>count(merchant.stock[key])&&merchant.stock[key]<=ammunitionShopCapacity(key,s,at))&&Number.isInteger(merchant.restockHours)&&merchant.restockHours>=0&&merchant.restockHours<ammunitionMarketRules(s,at).restockHours,'Las existencias de munición del proveedor no son válidas.');
 }
 for(const op of roster){
  const record=s.operativeState[op.id];if(!record)continue;validateAmmunitionChoice(carriedAmmunition(op,record));
  if(record.ammunition!==undefined){validateCounts(record.ammunition);need(record.ammo===totalAmmo(record),'El total de munición personal no coincide.');}
  need(count(loaded(record))&&loaded(record)<=(weaponSpecification(op)?.capacity??0),'La carga personal del arma no es válida.');
  if(record.carriedReloadProgress!==undefined)need(Number.isFinite(record.carriedReloadProgress)&&record.carriedReloadProgress>0&&record.carriedReloadProgress<1&&loaded(record)<(weaponSpecification(op)?.capacity??0),'La recarga personal no es válida.');
 }
}
export function restockAmmunitionShops(s,isSupplied){
 for(const [at,merchant]of Object.entries(s.ammunitionShops??{})){
  if(!hasAmmunitionMarket(s,at)||worldOwner(s,at)!=='patriot'||!isSupplied(s,at))continue;
  const rules=ammunitionMarketRules(s,at);
  if(++merchant.restockHours<ammunitionMarketRules(s,at).restockHours)continue;merchant.restockHours=0;
  for(const key of AMMO_KEYS)merchant.stock[key]=Math.min(rules.families[key].capacity,merchant.stock[key]+rules.families[key].replenish);
 }
}
function accessReason(s,op){
 return s.pendingBattle?'Terminá la escena táctica antes de mover munición.':s.defeated?'La campaña ha terminado.':!op||!s.recruited.includes(op.id)||!s.operativeState[op.id]?.alive||s.operativeState[op.id].captured?'El combatiente no está disponible.':operativeLocation(s,op.id)!==s.location?'El combatiente debe estar en este sector.':worldOwner(s,s.location)!=='patriot'?'El sector debe estar bajo tu control.':null;
}
export function ammunitionOrderQuote(s,op,key,quantity,direction,supplied){
 const record=s.operativeState[op?.id],unit=carriedAmmunition(op,record),validKey=Object.hasOwn(AMMO_TYPES,key),store=s.ammunitionStores?.[s.location]?.[key]??0,merchant=validKey?shop(s).stock[key]:0,carried=validKey?ammoCount(unit,key):0;
 let reason=accessReason(s,op);
 if(!reason&&(!validKey||!Number.isSafeInteger(quantity)||quantity<1||quantity>AMMUNITION_ORDER_LIMIT||!['buy','store','take'].includes(direction)))reason='Elegí una familia y entre 1 y 60 cartuchos.';
 const unitPrice=ammunitionUnitPrice(s,s.location,key),cost=direction==='buy'?quantity*unitPrice:0;
 if(!reason&&direction==='buy'&&(!hasAmmunitionMarket(s,s.location)||!supplied))reason='La compra requiere un proveedor habilitado en una localidad propia y comunicada.';
 if(!reason&&direction==='buy'&&merchant<quantity)reason='El proveedor no tiene suficientes cartuchos.';
 if(!reason&&direction==='buy'&&s.resources.treasury<cost)reason='No hay suficientes pesos.';
 if(!reason&&direction==='store'&&(carried<quantity||store+quantity>1000000))reason='No hay suficientes cartuchos sueltos o el depósito está lleno.';
 if(!reason&&direction==='take'&&store<quantity)reason='El depósito no tiene suficientes cartuchos.';
 if(!reason&&direction!=='store'&&supplyRoom(unit,key,quantity)<quantity)reason='No queda espacio en los bolsillos para esos cartuchos.';
 return {available:!reason,reason,cost,unitPrice,carried,stored:store,stock:merchant,loaded:loaded(record),key,quantity,direction};
}
export function unloadOwnedCampaignAmmunition(s,op){const reason=accessReason(s,op);need(!reason,reason);need(loaded(s.operativeState[op.id])>0,'El arma está vacía.');unloadCampaignWeapon(s,op);s.operativeState[op.id].jammed=false;}
export function selectCampaignAmmunitionLoad(s,op,family){
 const reason=accessReason(s,op);need(!reason,reason);
 const unit={...carriedAmmunition(op,s.operativeState[op.id]),activeSlot:'primary'},choice=ammunitionChoiceReason(unit,family);need(!choice,choice);
 s.operativeState[op.id].ammunitionChoice=family;
}
export function moveCampaignAmmunition(s,op,key,quantity,direction,supplied){
 const quote=ammunitionOrderQuote(s,op,key,quantity,direction,supplied);need(quote.available,quote.reason);
 const record=s.operativeState[op.id],unit=carriedAmmunition(op,record);
 if(direction==='buy'){
  s.ammunitionShops[s.location]??=freshShop(s,s.location);s.ammunitionShops[s.location].stock[key]-=quantity;s.resources.treasury-=quote.cost;
 }else{
  s.ammunitionStores[s.location]??={};s.ammunitionStores[s.location][key]=quote.stored+(direction==='store'?quantity:-quantity);
 }
 changeAmmo(unit,key,direction==='store'?-quantity:quantity);keep(record,unit);return quote;
}

// A supplied town may complete the configured marching load. Outside a supplied town,
// deployment carries existing ammunition; it never buys supplies at a distance.
export function prepareCampaignAmmunition(s,roster,ids,{at=s.location,supplied=false,commit=false}={}){
 const state=commit?s:structuredClone(s);migrateAmmunitionCustody(state);
 const allocation={};let cost=0,issued=0;
 for(const id of ids){
  const op=roster.find(o=>o.id===id),record=state.operativeState[id],unit=carriedAmmunition(op,record),key=ammoTypeFor(unit),capacity=weaponSpecification(op)?.capacity??0;
  if(key&&arrivalFacilityOptions(at).length>0&&worldOwner(state,at)==='patriot'&&supplied){
   if(!record.carriedReloadProgress){const charges=Math.min(capacity-unit.loaded,ammoCount(unit,key));unit.loaded+=charges;changeAmmo(unit,key,-charges);}
   const wanted=Math.max(0,campaignRules(state).deploymentCartridges-unit.loaded-ammoCount(unit,key)),roomInGun=record.carriedReloadProgress?0:Math.min(wanted,capacity-unit.loaded),quantity=!hasAmmunitionMarket(state,at)||!ammunitionMarketRules(state,at).automaticPurchase?0:Math.min(shop(state,at).stock[key],roomInGun+supplyRoom(unit,key,wanted-roomInGun));
   if(quantity){state.ammunitionShops[at]??=freshShop(state,at);state.ammunitionShops[at].stock[key]-=quantity;const charges=Math.min(roomInGun,quantity);unit.loaded+=charges;changeAmmo(unit,key,quantity-charges);cost+=quantity*ammunitionUnitPrice(state,at,key);}
  }
  allocation[id]={...(unit.ammunitionChoice!==undefined?{ammunitionChoice:unit.ammunitionChoice}:{}),loaded:unit.loaded,ammo:totalAmmo(unit),ammunition:{...unit.ammunition},...(record.carriedReloadProgress?{reloadProgress:record.carriedReloadProgress}:{})};
  issued+=unit.loaded+totalAmmo(unit);keep(record,unit);
 }
 need(Number.isSafeInteger(cost)&&(!commit||state.resources.treasury>=cost),'No hay suficientes pesos para completar la munición de la escuadra.');
 state.resources.treasury-=cost;
 return {allocation,issued,cost};
}

// Changing a firearm does not convert or sell its charges. Unload its actual
// family into the owner's pockets before the weapon moves to the armory.
export function unloadCampaignWeapon(s,op){
 const record=s.operativeState[op.id],before=carriedAmmunition(op,record),after=structuredClone(before),key=ammoTypeFor(before);
 need(!record.carriedReloadProgress,'Terminá la recarga antes de guardar el arma en la armería.');
 if(before.loaded){need(key,'La carga del arma no tiene familia.');changeAmmo(after,key,before.loaded);after.loaded=0;const reason=pocketChangeReason(before,after);need(!reason,reason);}
 delete after.reloadProgress;keep(record,after);
}
function fieldCounts(units,scene={}){
 const result=Object.fromEntries(AMMO_KEYS.map(key=>[key,0]));
 const add=(key,n)=>{if(key){need(Object.hasOwn(AMMO_TYPES,key)&&count(n),'La cantidad física de munición no es válida.');result[key]+=n;}};
 const gun=item=>{if(item&&!item.taken)add(ammoTypeFor(item),(item.loaded??0)*(item.count??1));};
 for(const unit of units){for(const [key,n]of Object.entries(ammoStock(unit)))add(key,n);if(!unit.weaponDropped)gun(unit);for(const item of Object.values(unit.inventory??{}))if(object(item))gun(item);}
 for(const item of scene.droppedWeapons??[])gun(item);
 for(const item of scene.groundItems??[]){const key=item.type==='ammo'?'ammoMusket':item.type;if(Object.hasOwn(AMMO_TYPES,key))add(key,item.count);}
 return result;
}
export function assertAmmunitionConservation(request,snapshot,previous){
 if(!snapshot)return;
 need((request.squad??[]).every(issued=>snapshot.units.some(u=>u.side==='player'&&Number(u.id)===Number(issued.id))),'Falta un combatiente en el parte de munición.');
 const enemies=request.exploration?[]:previous&&!previous.sectorCleared?previous.units.filter(u=>u.side==='enemy'):request.enemies??[];
 const deployed=[...(request.squad??[]),...(request.garrison??[]),...(request.missionAllies??[]),...enemies.map(u=>({...u,weapon:u.weapon??u.primary??1800,ammo:u.ammo??12,loaded:u.loaded??weaponSpecification({...u,weapon:u.weapon??u.primary??1800})?.capacity??0}))];
 const bodies=retainedMilitaryBodies(previous,deployed,request.sector);
 const initial=fieldCounts([...deployed,...bodies],previous??{}),current=fieldCounts(snapshot.units,snapshot);
 for(const receipt of request.civilianWeaponRecoveries??[]){const key=ammoTypeFor(receipt.gun);if(key)initial[key]+=receipt.gun.loaded??0;}
 for(const key of AMMO_KEYS)need(current[key]<=initial[key],`El parte añade ${AMMO_TYPES[key].name.toLowerCase()} sin una fuente física.`);
}
export function retainReturnedAmmunition(s,request,reports,snapshot,previous=null){
 assertAmmunitionConservation(request,snapshot,previous);
 if(snapshot)for(const issued of request.squad){const actual=snapshot.units.find(u=>u.side==='player'&&Number(u.id)===Number(issued.id));if(actual.hp<=0)keep(s.operativeState[issued.id],{ammunition:{},loaded:0});else need(reports.some(r=>Number(r.id)===Number(issued.id)),'Falta el parte de un combatiente vivo.');}
 const seen=new Set();
 for(const report of reports){
  const id=Number(report.id),issued=request.squad.find(u=>u.id===id);need(issued&&!seen.has(id),'El parte de munición tiene un combatiente inválido.');seen.add(id);
  const actual=snapshot?.units.find(u=>u.side==='player'&&Number(u.id)===id),unit=structuredClone(actual??{...issued,...report});
  if(actual){for(const key of ['ammo','loaded'])if(report[key]!==undefined)need(report[key]===actual[key],'El parte de munición no coincide con el sector.');if(report.ammunition!==undefined){validateCounts(report.ammunition);need(AMMO_KEYS.every(key=>(report.ammunition[key]??0)===(actual.ammunition?.[key]??0)),'Las familias del parte no coinciden con el sector.');}}
  validateAmmo(unit);need(count(unit.loaded??0)&&(unit.loaded??0)<=(unit.weaponDropped?0:weaponSpecification(unit)?.capacity??0),'La carga del parte no es válida.');
  if(!actual){
   const before=ammoStock(issued),after=ammoStock(unit),oldKey=ammoTypeFor(issued),newKey=ammoTypeFor(unit);
   for(const key of AMMO_KEYS)need((after[key]??0)+(key===newKey?(unit.loaded??0):0)<=(before[key]??0)+(key===oldKey?(issued.loaded??0):0),'Un parte sin escena no puede añadir munición.');
  }
  const record=s.operativeState[id];
  if((report.hp??unit.hp)<=0)keep(record,{ammunition:{},loaded:0});
  else {keep(record,unit);if(unit.weaponDropped)record.carriedLoaded=0;}
 }
}
