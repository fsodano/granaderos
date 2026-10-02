import {expandCellScene} from './cell-scene-storage.js';
import {equipmentWorkshopSectors,equipmentMerchantSectors,equipmentStockCap,merchantEquipmentCatalog,initialEquipmentMerchant,migrateMerchantWallets} from './equipment-merchants.js';
import {hasWorkshop} from './campaign-headquarters.js';
import {artilleryTradingRules} from './artillery-trading-rules.js';
import {CAMPAIGN_SECTORS} from './data.js';
import {localArtilleryDepot,depotSelection} from './artillery-depots.js';
import {artilleryProfile} from './artillery-definitions.js';
import {importRulesFor,importPortName,importDelayReason,importOrderReason} from './campaign-imports.js';
import {contentWeaponOf,weaponSpecification} from './weapon-definition.js';
import {ammunitionMarketRules} from './ammunition-market-rules.js';
import {migrateAmmunitionCustody,carriedAmmunition} from './campaign-ammunition.js';
import {equipmentCatalog,equipmentCatalogItem,equipmentKey,equipmentLabel,isImportedEquipment} from './equipment-catalog.js';
import {addEquipment,migrateEquipmentStorage,validateEquipmentStorage} from './stored-equipment.js';
import {AMMUNITION_FAMILIES} from './ammunition-families.js';
import {BODY_SLOTS,wornOutfit,PONCHO_STOCK_CAP,PONCHO_DAILY_RESTOCK} from './outfits.js';
import {merchantBuyingTerms,merchantWeaponRefusal} from './merchant-preferences.js';
import {isGrenadeStack,makeGrenadeStack} from './grenades.js';
import {operativeLocation,operativeInTransit} from './squads.js';
import {validateReloadProgress} from './weapon-reload.js';
import {heldSupply} from './held-supplies.js';
import {heldTool} from './environment-interactions.js';
import {availableAmmunition} from './ammunition-types.js';
import {syncUnitAmmunition} from './tactical-ammunition.js';
import {inventoryUsage,validateHands,validateEquipmentCursor,carriedObject,applyItemQuantity} from './tactical-inventory.js';
import {FITTING_RULES_VERSION,validateUnitFittings,normalizeUnitFittings,validItemIdentity,fittingItemIds,heldItemIds} from './weapon-fittings.js';
export {EQUIPMENT_CATALOG,equipmentCatalog,equipmentCatalogItem,equipmentLabel,armoryInventory,isImportedEquipment} from './equipment-catalog.js';
export {storeEquipment,takeEquipment,addEquipment,storedEquipmentMetadata} from './stored-equipment.js';
export function armoryOptions(s,op,slot){
 return s.armoryItems.filter(i=>slot==='weapon'||i.item>=1809).map(i=>({key:i.id,item:equipmentKey(i),instanceId:i.id,name:equipmentLabel(i),condition:i.condition,fittings:i.fittings,jammed:i.jammed}));
}
export function needsResupply(record){return [['rations',2],['torches',2],['medkits',2]].some(([key,target])=>(record[key]??target)<target);}
export function refillCost(record,dressingPrice=10){return Math.ceil(Math.max(0,2-(record.rations??2))*10+Math.max(0,2-(record.torches??2))*8+Math.max(0,2-(record.medkits??2))*dressingPrice);}
export function firearmRepairCost(record){return Math.ceil(Math.max(0,100-(record.condition??100))*1.5);}
export function equipmentInventoryUsage(s,op,changes={}){
 const record=s.operativeState[op.id];
 return inventoryUsage({...op,...record,ammunitionVersion:2,ammo:availableAmmunition({...op,...record}),boleadoras:record.boleadoras??1,...changes});
}
// Deployment preparation buys one finite batch elsewhere. This adapter only
// returns the operative's existing physical inventory and chamber contents.
export function allocateEquipmentAmmo(s,op){
 const actor=carriedAmmunition(op,s.operativeState[op.id]);
 return {ammunitionVersion:2,loaded:actor.loaded,ammo:actor.ammo,inventory:actor.inventory??{},...(actor.ammunitionChoice!==undefined?{ammunitionChoice:actor.ammunitionChoice}:{}),...(actor.pocketOrder?{pocketOrder:actor.pocketOrder}:{}),...(actor.reloadProgress?{reloadProgress:actor.reloadProgress}:{})};
}
export function clearCarriedLoading(record){delete record.carriedLoaded;delete record.carriedReloadProgress;}
export function setCarriedLoading(record,unit){
 if(weaponSpecification(unit)?.capacity>0&&!unit.weaponDropped){record.carriedLoaded=unit.loaded??0;if(unit.reloadProgress)record.carriedReloadProgress=unit.reloadProgress;else delete record.carriedReloadProgress;}
 else clearCarriedLoading(record);
}
export function unissuedArtilleryStock(s){
 return {camp:Object.fromEntries(['field8','swivel','bronze4'].map(type=>[type,s.armory?.[type]??0])),depot:{field8:0,swivel:0,bronze4:0}};
}
export function newArtilleryPayload(type,id,s={}){const profile=artilleryProfile(s,type);return {id,type,side:'player',loaded:profile.initialLoaded,ammo:profile.initialAmmo};}
export function artillerySelectionReason(s,types){
 const depot=localArtilleryDepot(s);
 if(!Array.isArray(types)||types.length>3||!types.every(type=>['bronze4','field8','swivel'].includes(type)||depot.some(g=>depotSelection(g)===type)))return 'Seleccioná hasta tres piezas de artillería.';
 for(const type of ['bronze4','field8','swivel'])if(types.filter(t=>t===type).length>(s.armory?.[type]??0))return 'No disponés de tantas piezas de ese modelo.';
 if(types.filter(type=>type.startsWith('depot:')).some((type,i,all)=>all.indexOf(type)!==i))return 'Una pieza del depósito solo puede ocupar un lugar en la batería.';
 return null;
}
export function artilleryDeploymentChoices(s){
 return s.artillerySelectionExplicit||s.artillerySelection?.length?s.artillerySelection??[]:[...['field8','swivel','bronze4'].flatMap(type=>Array.from({length:Math.min(3,s.armory?.[type]??0)},()=>type)),...localArtilleryDepot(s).map(depotSelection)].slice(0,3);
}
export function deployedArtillery(s){
 const available={...s.armory},depot=localArtilleryDepot(s),used=new Set(),guns=[];
 for(const choice of artilleryDeploymentChoices(s)){
  if(guns.length>=3)break;
  const stored=depot.find(g=>depotSelection(g)===choice);
  if(stored&&!used.has(stored.id)){guns.push({...structuredClone(stored),fromDepot:s.location});used.add(stored.id);}
  else if(['bronze4','field8','swivel'].includes(choice)&&(available[choice]??0)>0){available[choice]--;guns.push({id:`gun-${guns.length}`,type:choice,side:'player',loaded:artilleryProfile(s,choice).initialLoaded,ammo:artilleryProfile(s,choice).initialAmmo});}
 }
 return guns;
}

export const WORKSHOP_SECTORS=['retiro','cordoba','mendoza'];
export const MERCHANT_CASH=1200;
export const USED_EQUIPMENT_LIMIT=1000;
export const AMMUNITION_PRICE=3;
export const AMMUNITION_MERCHANT_CAP=60;
export const AMMUNITION_DAILY_RESTOCK=6;
const ammoFamilySize=type=>Object.values(AMMUNITION_FAMILIES).find(f=>f.type===type)?.legacyTypes.length??0;
export const ammunitionMerchantCapacity=type=>AMMUNITION_MERCHANT_CAP*ammoFamilySize(type);
export const ammunitionStock=(s,type,at=s.location)=>{const family=Object.values(AMMUNITION_FAMILIES).find(f=>f.type===type);return family?s.ammunitionShops?.[at]?.stock?.[family.id]??ammunitionMarketRules(s,at).families[family.id].initial:0;};
export const MEDICAL_STOCK_CAP=40;
export const MEDICAL_DAILY_RESTOCK=5;
export const medicalSupplyStock=(s,at=s.location)=>s.merchants?.[at]?.supplies?.medkits??0;
export const GRENADE_PRICE=80;
export const GRENADE_STOCK_CAP=6;
export const grenadeStock=(s,at=s.location)=>s.merchants?.[at]?.grenades?.arsenal??0;
// Authored campaign supply: one arsenal lot in Mendoza during the Cuyo phase.
// This is not an attested shipment from Montevideo or a daily merchant refill.
export function grenadeOffer(s,op,isSupplied,quantity=1){
 const stock=grenadeStock(s),record=op&&s.operativeState[op.id];
 let reason=s.defeated?'La campaña terminó.':s.pendingBattle||s.pendingEncounter?'Resolvé el encuentro antes de comprar granadas.':s.phase<3?'La remesa de arsenal se habilita durante la campaña de Cuyo.':s.location!=='mendoza'||s.sectors.mendoza?.owner!=='patriot'||!isSupplied(s,'mendoza')?'La remesa requiere la maestranza de Mendoza propia y abastecida.':!op||!s.recruited.includes(op.id)||!record?.alive||record.captured||record.hp<15||record.asleep||record.unconscious||record.routed||record.surrendered||record.energy<=0||operativeInTransit(s,op.id)||operativeLocation(s,op.id)!==s.location?'Elegí un combatiente disponible y presente en Mendoza.':!Number.isSafeInteger(quantity)||quantity<1||quantity>GRENADE_STOCK_CAP?'Elegí entre 1 y 6 granadas.':stock<quantity?'La remesa de arsenal no tiene suficientes granadas.':s.resources.treasury<GRENADE_PRICE*quantity?'No hay pesos suficientes.':null;
 if(!reason)try{applyItemQuantity({...op,...record,id:String(op.id),loaded:record.carriedLoaded??0},{item:'inventory:grenade:arsenal',...makeGrenadeStack('arsenal',quantity)});}catch(error){reason=error.message;}
 return {grenadeType:'arsenal',name:'Granada de arsenal',price:GRENADE_PRICE,stock,available:!reason,reason,note:'Remesa de arsenal. Existencias limitadas; no se reponen.',action:{type:'purchaseGrenades',operativeId:op?.id,grenadeType:'arsenal',quantity}};
}
export function purchaseGrenades(s,op,isSupplied,quantity=1){
 const offer=grenadeOffer(s,op,isSupplied,quantity);need(offer.available,offer.reason);
 const record=s.operativeState[op.id],next=applyItemQuantity({...op,...record,id:String(op.id),loaded:record.carriedLoaded??0},{item:'inventory:grenade:arsenal',...makeGrenadeStack('arsenal',quantity)});
 record.inventory=next.inventory;if(next.pocketOrder)record.pocketOrder=next.pocketOrder;
 s.resources.treasury-=GRENADE_PRICE*quantity;s.merchants.mendoza.grenades.arsenal-=quantity;
 s.merchants.mendoza.cash=Math.min(1e9,s.merchants.mendoza.cash+GRENADE_PRICE*quantity);
 return `${op.nickname??op.name} recibe ${quantity} granada${quantity===1?'':'s'} de la remesa de arsenal por ${GRENADE_PRICE*quantity} pesos.`;
}
const need=(ok,message)=>{if(!ok)throw Error(message);};
const handheld=item=>Number.isInteger(Number(item))&&Number(item)>=1800&&Number(item)<=1813;
const validInstanceId=validItemIdentity;
const generatedIdentityNumber=id=>typeof id==='string'&&/^equipment-[1-9][0-9]{0,8}$/.test(id)?Number(id.slice(10)):null;
function migratedIdentitySequence(s){let maximum=0;const pending=[s];while(pending.length){const value=pending.pop();if(!value||typeof value!=='object')continue;for(const [key,child]of Object.entries(value)){if(['instanceId','weaponInstanceId','bladeInstanceId'].includes(key)){const number=generatedIdentityNumber(child);if(number!==null)maximum=Math.max(maximum,number);}else if(child&&typeof child==='object')pending.push(child);}}return maximum+1;}
const stockCap=equipmentStockCap;
const merchantSectors=equipmentMerchantSectors;
const merchantCatalog=merchantEquipmentCatalog;
const initialMerchant=initialEquipmentMerchant;
function containsGrenades(state){
 const pending=[state],seen=new Set();
 while(pending.length){const value=pending.pop();if(!value||typeof value!=='object'||seen.has(value))continue;seen.add(value);if(isGrenadeStack(value))return true;for(const child of Object.values(value))if(child&&typeof child==='object')pending.push(child);}
 return false;
}

// Check operative records before runtime initialization can fill missing
// fields. Undeployed militia can still use their compact equipment format.
export function validateStoredFittingFields(s){
 if(s.fittingRulesVersion===undefined)return;
 need(s.fittingRulesVersion===FITTING_RULES_VERSION,'La versión de encastres no es válida.');
 const units=Object.values(s.operativeState??{});
 for(const unit of units)need(unit&&['weaponFittings','weaponFittingPattern','bladeFittingPattern'].every(key=>Object.hasOwn(unit,key))&&unit.weaponFittings!==null&&typeof unit.weaponFittings==='object'&&!Array.isArray(unit.weaponFittings),'Faltan los encastres del equipo guardado.');
}

export function migrateEquipment(s){
 const legacy=s.fittingRulesVersion===undefined;
 if(legacy){s.nextEquipmentInstanceId??=migratedIdentitySequence(s);s.fittingRulesVersion=FITTING_RULES_VERSION;}
 s.armory??={};
 for(const record of Object.values(s.operativeState??{})){if(record.bladeCondition===undefined)record.bladeCondition=100;normalizeUnitFittings(record);}
 migrateAmmunitionCustody(s);migrateMerchantWallets(s);
 if(s.equipmentMerchantsVersion===undefined){s.merchants??={};for(const at of merchantSectors(s))s.merchants[at]??=initialMerchant(s,at);s.equipmentMerchantsVersion=1;}
 else need(s.equipmentMerchantsVersion===1&&s.merchants&&merchantSectors(s).every(at=>Object.hasOwn(s.merchants,at)),'Faltan comerciantes de la campaña.');
 if(s.grenadeSupplyVersion===undefined){
  need(Object.values(s.merchants).every(merchant=>merchant.grenades===undefined)&&!containsGrenades(s),'La remesa de granadas mezcla versiones.');
  s.grenadeSupplyVersion=1;for(const [at,merchant]of Object.entries(s.merchants))merchant.grenades={arsenal:at==='mendoza'?GRENADE_STOCK_CAP:0};
 }
 need(s.grenadeSupplyVersion===1,'La versión de la remesa de granadas no es válida.');
 for(const [at,merchant]of Object.entries(s.merchants))need(merchant.grenades!==null&&typeof merchant.grenades==='object'&&!Array.isArray(merchant.grenades)&&Object.keys(merchant.grenades).length===1&&Number.isSafeInteger(merchant.grenades.arsenal)&&merchant.grenades.arsenal>=0&&merchant.grenades.arsenal<=(at==='mendoza'?GRENADE_STOCK_CAP:0),'Las existencias de granadas no son válidas.');
 if(legacy)for(const [at,merchant]of Object.entries(s.merchants)){merchant.supplies??={medkits:equipmentWorkshopSectors(s).includes(at)?MEDICAL_STOCK_CAP:0};if(equipmentWorkshopSectors(s).includes(at))merchant.stock['1811:india_socket']??=6;}
 if(s.clothingSupplyVersion===undefined){
  need(Object.values(s.merchants).every(merchant=>merchant.supplies&&merchant.supplies.ponchos===undefined),'Las existencias de vestimenta mezclan versiones.');
  s.clothingSupplyVersion=1;for(const [at,merchant]of Object.entries(s.merchants))merchant.supplies.ponchos=equipmentWorkshopSectors(s).includes(at)?PONCHO_STOCK_CAP:0;
 }
 need(s.clothingSupplyVersion===1,'La versión de vestimenta no es válida.');
 migrateEquipmentStorage(s);
 for(const units of [...Object.values(s.garrisons??{}),...(s.militiaTraining??[]).map(course=>course.trainees??[]),Object.values(s.missionAllies??{}),...(s.enemyGroups??[]).map(g=>g.units??[]),...[s.pendingBattle?.squad??[],s.pendingBattle?.garrison??[],s.pendingBattle?.missionAllies??[]]])for(const unit of units)normalizeUnitFittings(unit);
 if(s.pendingBattle)s.pendingBattle.fittingRulesVersion??=FITTING_RULES_VERSION;
 if(legacy)for(const snapshot of [...Object.values(s.sectorStates??{}),...Object.values(s.sceneStates??{}),...(s.pendingBattle?.resumeSnapshot?[s.pendingBattle.resumeSnapshot]:[])]){snapshot.fittingRulesVersion??=FITTING_RULES_VERSION;for(const unit of snapshot.units??[])normalizeUnitFittings(unit);}
 if(legacy)for(const records of Object.values(s.sectorRemains??{}))for(const record of records)normalizeUnitFittings(record.unit);
 return s;
}

export function merchantStatus(s,item,isSupplied){
 const imported=isImportedEquipment(item),sector=imported?importRulesFor(s).port:s.location,merchant=s.merchants?.[sector];
 const reason=s.pendingBattle||s.pendingEncounter?'Terminá el encuentro antes de negociar.':!hasWorkshop({...s,flags:s.flags??{}},s.location)||s.sectors[s.location]?.owner!=='patriot'||!isSupplied(s,s.location)?'Debes llegar a una maestranza abastecida.':imported?importOrderReason(s)??(!isSupplied(s,sector)?'El puerto de importación necesita una ruta de abastecimiento.':null):null;
 return {sector,available:!reason,reason,stock:merchant?.stock?.[item?.stockKey??item?.item]??0,restockIn:24-(merchant?.restockHours??0),cash:s.merchants?.[s.location]?.cash??0};
}

export function advanceMerchants(s,isSupplied){
 for(const [sector,merchant] of Object.entries(s.merchants)){
  if(s.sectors[sector]?.owner!=='patriot'||!isSupplied(s,sector)||s.pendingBattle?.sector===sector||sector===importRulesFor(s).port&&s.blockade)continue;
  merchant.restockHours++;
  if(merchant.restockHours<24)continue;merchant.restockHours=0;
  for(const item of merchantCatalog(s,sector)){const key=item.stockKey??item.item;merchant.stock[key]=Math.min(stockCap(item),merchant.stock[key]+1);}
  if(equipmentWorkshopSectors(s).includes(sector))merchant.supplies.medkits=Math.min(MEDICAL_STOCK_CAP,merchant.supplies.medkits+MEDICAL_DAILY_RESTOCK);
  if(equipmentWorkshopSectors(s).includes(sector))merchant.supplies.ponchos=Math.min(PONCHO_STOCK_CAP,merchant.supplies.ponchos+PONCHO_DAILY_RESTOCK);
  if(equipmentWorkshopSectors(s).includes(sector))merchant.cash+=Math.min(300,Math.max(0,artilleryTradingRules(s).initialCash-merchant.cash));
 }
}

// The stored definition supplies the name and price. Its historical template
// still controls each merchant's buying preference.
const exactCatalogItem=record=>{const definition=contentWeaponOf(record)??record?.itemMetadata?.contentWeapon;return definition?{...definition,item:definition.template}:equipmentCatalogItem(equipmentKey(record));};
function tradeBreakdown(instance,fraction){const item=exactCatalogItem(instance),items=[];const append=(spec,condition)=>{const rate=typeof fraction==='function'?fraction(spec.item):fraction;items.push({name:spec.name,condition,price:Math.floor(spec.price*rate*condition/100)});};if(item&&handheld(item.item))append(item,instance.condition);const bayonet=instance?.fittings?.bayonet;if(bayonet){const spec=exactCatalogItem(bayonet);if(spec)append(spec,bayonet.condition);}return {items,total:items.reduce((sum,item)=>sum+item.price,0)};}
export const resaleBreakdown=(instance,sector='retiro')=>({...tradeBreakdown(instance,item=>merchantBuyingTerms(sector,item).fraction),reason:merchantWeaponRefusal(sector,instance)});
export const usedEquipmentBreakdown=instance=>tradeBreakdown(instance,.8);
export function usedEquipmentOffers(s,isSupplied){
 const market=merchantStatus(s,null,isSupplied);
 return (s.merchants?.[s.location]?.usedItems??[]).map(instance=>{
  const quote=usedEquipmentBreakdown(instance);
  const reason=market.reason??(quote.total<=0?'El arma no tiene valor de servicio.':s.armoryItems.length>=10000?'La armería está llena.':s.resources.treasury<quote.total?'No hay pesos suficientes.':null);
  return {instance,quote,reason,available:!reason,action:{type:'purchaseUsedEquipment',sector:s.location,instanceId:instance.id}};
 });
}
export function resaleQuote(instance,sector='retiro'){return resaleBreakdown(instance,sector).total;}

export function returnEquipment(s,id,report){
 for(const slot of BODY_SLOTS)if(report[slot]!==undefined||slot==='outfit'&&report.poncho!==undefined)s.operativeState[id][slot]=structuredClone(wornOutfit(report,slot));
 if(report.outfit!==undefined||report.poncho!==undefined)delete s.operativeState[id].poncho;
 validateHands(report);validateUnitFittings(report);validateEquipmentCursor(report);
 if(report.equipmentCursor)s.operativeState[id].equipmentCursor=structuredClone(report.equipmentCursor);else delete s.operativeState[id].equipmentCursor;
 for(const key of ['weaponMetadata','bladeMetadata','ammunitionChoice'])if(report[key]!==undefined)s.operativeState[id][key]=structuredClone(report[key]);else delete s.operativeState[id][key];
 if(report.leftHandItem!==undefined)s.operativeState[id].leftHandItem=report.leftHandItem;else delete s.operativeState[id].leftHandItem;
 if(report.offHand)s.operativeState[id].offHand=structuredClone(report.offHand);else if(report.weapon!==undefined)delete s.operativeState[id].offHand;
 s.loadouts[id]??={};
 if(report.weapon!==undefined){need(report.weapon===0||handheld(report.weapon)&&typeof report.weapon==='number','El arma del parte es inválida.');s.loadouts[id].weapon=report.weapon;}
 if(report.blade!==undefined){need(report.blade===0||Number.isInteger(report.blade)&&report.blade>=1809&&report.blade<=1813,'El arma blanca del parte es inválida.');s.loadouts[id].blade=report.blade;}
 else if(report.weapon!==undefined)s.loadouts[id].blade=0;
 for(const key of ['jammed','weaponDropped'])if(report[key]!==undefined){need(typeof report[key]==='boolean','El estado del arma es inválido.');s.operativeState[id][key]=report[key];}
 if(report.weaponMode!==undefined){need(['fire','melee'].includes(report.weaponMode),'El modo del arma es inválido.');s.operativeState[id].weaponMode=report.weaponMode;}
 if(report.activeSlot!==undefined){need(['primary','blade','medical','unarmed','tool','supply','item'].includes(report.activeSlot),'El equipo activo es inválido.');s.operativeState[id].activeSlot=report.activeSlot;if(report.activeSlot==='tool'){need(Boolean(heldTool(report)),'La herramienta del parte es inválida.');s.operativeState[id].activeTool=report.activeTool;}else delete s.operativeState[id].activeTool;if(report.activeSlot==='supply'){need(Boolean(heldSupply(report)),'El pertrecho del parte es inválido.');s.operativeState[id].activeSupply=report.activeSupply;}else delete s.operativeState[id].activeSupply;if(report.activeSlot==='item'){need(Boolean(carriedObject(report)),'El objeto del parte es inválido.');s.operativeState[id].activeItem=report.activeItem;}else delete s.operativeState[id].activeItem;}
 if(report.bladeCondition!==undefined){need(Number.isFinite(report.bladeCondition)&&report.bladeCondition>=0&&report.bladeCondition<=100,'El estado del arma blanca del parte es inválido.');s.operativeState[id].bladeCondition=report.bladeCondition;}
 for(const [slot,key] of [['weapon','weaponInstanceId'],['blade','bladeInstanceId']]){
  if(report[key]!==undefined){need(validInstanceId(report[key])&&report[slot]>0&&(slot!=='weapon'||!report.weaponDropped),'La identidad del arma del parte es inválida.');s.operativeState[id][key]=report[key];}
  else if(report.weapon!==undefined)delete s.operativeState[id][key];
 }
 if(report.weapon!==undefined)for(const key of ['weaponFittings','weaponFittingPattern','bladeFittingPattern'])s.operativeState[id][key]=structuredClone(report[key]??(key==='weaponFittings'?{}:null));
 need(!report.weaponDropped||!(report.loaded>0),'Un arma abandonada no puede conservar cartuchos cargados.');
}

// Strategic records keep the same loose inventory and separate primary loading.
function personalHandState(s,op,r){
 const deployed=s.pendingBattle?.squad?.find(u=>String(u.id)===String(op?.id));
 return syncUnitAmmunition({...op,...r,loaded:r.carriedLoaded??0,reloadProgress:r.carriedReloadProgress,...(deployed?{inventory:deployed.inventory}:{}),ammunitionVersion:2});
}
export function validateEquipment(s,roster=[]){
 migrateEquipment(s);
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v),integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 need(s.fittingRulesVersion===FITTING_RULES_VERSION&&integer(s.nextEquipmentInstanceId,1,1e9),'La versión o secuencia del equipo es inválida.');
 const sectors=merchantSectors(s);
 need(object(s.merchants)&&Object.keys(s.merchants).length===sectors.length&&sectors.every(at=>CAMPAIGN_SECTORS.some(p=>p.id===at)),'Los comerciantes guardados son inválidos.');
 for(const sector of sectors){const merchant=s.merchants[sector],items=merchantCatalog(s,sector);
  need(object(merchant)&&merchant.ammunition===undefined&&object(merchant.stock)&&Object.keys(merchant.stock).length===items.length&&items.every(item=>integer(merchant.stock[item.stockKey??item.item],0,stockCap(item)))&&object(merchant.supplies)&&Object.keys(merchant.supplies).length===2&&integer(merchant.supplies.medkits,0,equipmentWorkshopSectors(s).includes(sector)?MEDICAL_STOCK_CAP:0)&&integer(merchant.supplies.ponchos,0,equipmentWorkshopSectors(s).includes(sector)?PONCHO_STOCK_CAP:0)&&integer(merchant.restockHours,0,23)&&integer(merchant.cash,0,1000000000),'Las existencias del comerciante son inválidas.');
 }
 validateEquipmentStorage(s);
 for(const unit of s.pendingBattle?.squad??[])validateReloadProgress(unit.reloadProgress,weaponSpecification(unit)?.capacity??0,unit.loaded??0,unit.weaponDropped);
 for(const [id,r] of Object.entries(s.operativeState)){
  const op=roster.find(op=>op.id===Number(id)),capacity=weaponSpecification({...op,...r})?.capacity??0;
  need(r.carriedAmmo===undefined||integer(r.carriedAmmo,0,100000),'La reserva personal de cartuchos es inválida.');
  need(r.carriedLoaded===undefined||integer(r.carriedLoaded,0,r.weaponDropped?0:capacity),'La carga personal del arma es inválida.');
  need(r.carriedReloadProgress===undefined||r.carriedLoaded!==undefined,'Falta la carga del arma en recarga.');validateReloadProgress(r.carriedReloadProgress,capacity,r.carriedLoaded??0,r.weaponDropped);
  const personal=personalHandState(s,op,r);validateHands(personal);validateEquipmentCursor(personal);if(r.pocketOrder?.some(slot=>slot.count!==undefined))inventoryUsage(personal);validateUnitFittings({...op,...r});
  for(const [slot,key] of [['weapon','weaponInstanceId'],['blade','bladeInstanceId']])if(r[key]!==undefined)need(validInstanceId(r[key])&&op?.[slot]>0&&(slot!=='weapon'||!r.weaponDropped),'La identidad del arma guardada es inválida.');
  for(const key of ['jammed','weaponDropped'])need(r[key]===undefined||typeof r[key]==='boolean','El estado del arma guardada es inválido.');
  need(r.weaponMode===undefined||['fire','melee'].includes(r.weaponMode),'El modo del arma guardado es inválido.');
  need(r.activeSlot===undefined||['primary','blade','medical','unarmed','tool','supply','item'].includes(r.activeSlot),'El equipo activo guardado es inválido.');
  need(r.activeSlot==='tool'?Boolean(heldTool(r)):r.activeTool===undefined,'La herramienta equipada es inválida.');
  need(r.activeSlot==='supply'?Boolean(heldSupply(r)):r.activeSupply===undefined,'El pertrecho equipado es inválido.');
  need(r.bladeCondition===undefined||Number.isFinite(r.bladeCondition)&&r.bladeCondition>=0&&r.bladeCondition<=100,'El estado del arma blanca es inválido.');
 }
 validateEquipmentOwnership(s,roster);
}

// Saved requests and returned unit records are historical mirrors. Claim an
// item's current custodian once, including inaccessible captives and field gear.
export function validateEquipmentOwnership(s,roster=[],battle=null){
 const active=battle??s.pendingBattle?.resumeSnapshot??null,identities=new Set(),activePlayers=new Set((active?.units??[]).filter(u=>u.side==='player').map(u=>String(u.id))),activeEnemies=new Set((active?.units??[]).filter(u=>u.side==='enemy').map(u=>String(u.id)));
 const snapshots=[...Object.values(s.sectorStates??{}),...Object.values(s.sceneStates??{})],allies=new Set();
 const retainedOnField=(snapshot,u)=>{const disposition=snapshot.returnLedger?.entries?.find(e=>e.unitId===u.id),owner=snapshot.sectorId==='san_lorenzo'?'san_nicolas':snapshot.sectorId;return !u.departure&&(!disposition||['resident','dead'].includes(disposition.kind)&&disposition.sector===owner);};
 const claim=id=>{need(validItemIdentity(id)&&!identities.has(id),'La identidad del equipo está duplicada o es inválida.');const number=generatedIdentityNumber(id);if(number!==null)need(number<s.nextEquipmentInstanceId,'La secuencia del equipo reutiliza una identidad existente.');identities.add(id);};
 const record=r=>{if(r&&typeof r==='object'&&(r.count??1)>0)for(const id of fittingItemIds(r))claim(id);};
 const unit=u=>{validateHands(u);validateEquipmentCursor(u);if(u.pocketOrder?.some(slot=>slot.count!==undefined))inventoryUsage(u);validateUnitFittings(u);for(const id of heldItemIds(u))claim(id);for(const r of Object.values(u.inventory??{}))record(r);if(u.equipmentCursor)record(u.equipmentCursor.stack);};
 const livingPlayers=new Set();
 for(const op of roster){const r=s.operativeState[op.id];if(r?.alive&&r.hp>0){livingPlayers.add(String(op.id));if(!r.serviceEquipmentReturn&&!activePlayers.has(String(op.id)))unit(personalHandState(s,op,r));}}
 // A retired local return keeps its property even if its former carrier dies
 // or the civilian identity later moves to another sector.
 for(const op of roster){const r=s.operativeState[op.id];if(r?.serviceEquipmentReturn)unit(personalHandState(s,op,r));}
 // A strategic death can precede any physical corpse snapshot. Its cursor is
 // still finite property; once a body exists, that body supersedes this record.
 for(const op of roster){const r=s.operativeState[op.id];if(!r?.equipmentCursor||r.serviceEquipmentReturn||r.alive&&r.hp>0||activePlayers.has(String(op.id)))continue;
  const body=snapshots.some(snapshot=>(snapshot.units??[]).some(u=>String(u.id)===String(op.id)&&u.side==='player'&&u.hp<=0&&retainedOnField(snapshot,u)))||Object.values(s.sectorRemains??{}).some(records=>records.some(record=>String(record.unitId)===String(op.id)));
  if(!body){validateEquipmentCursor(personalHandState(s,op,r));record(r.equipmentCursor.stack);}
 }
 for(const group of [...Object.values(s.garrisons??{}),...(s.militiaTraining??[]).map(course=>course.trainees??[])])for(const u of group){livingPlayers.add(String(u.id));if(!activePlayers.has(String(u.id)))unit(u);}
 const groupedEnemies=new Set();
 for(const group of s.enemyGroups??[])if(group.status!=='defeated')for(const u of group.units??[])if(u.hp>0&&!u.departure&&!u.surrendered&&!u.routed){groupedEnemies.add(String(u.id));if(!activeEnemies.has(String(u.id)))unit(u);}
 for(const ally of Object.values(s.missionAllies??{})){
  validateUnitFittings(ally);const id=String(ally.id);allies.add(id);
  // The retained ally is the next mission's source. Once dead, its physical
  // body (including a looted body) owns the gear; the cache is only history.
  const body=snapshots.some(snapshot=>(snapshot.units??[]).some(u=>String(u.id)===id&&u.missionAlly&&u.hp<=0&&retainedOnField(snapshot,u)))||Object.values(s.sectorRemains??{}).some(records=>records.some(r=>String(r.unitId)===id&&r.unit.missionAlly&&r.unit.hp<=0));
  if(!activePlayers.has(id)&&!body)unit(ally);
 }
 for(const r of s.armoryItems??[])record(r);
 for(const merchant of Object.values(s.merchants??{}))for(const r of merchant.usedItems??[])record(r);
 for(const owner of s.serviceEquipmentReturns?.entries??[])for(const item of owner.items)record(item.stack);
 const field=(snapshot,current=false)=>{
  for(const u of snapshot.units??[]){
   if(current){unit(u);continue;}
   if(!retainedOnField(snapshot,u))continue;
   if(u.side==='player'&&u.hp>0&&(u.missionAlly?allies.has(String(u.id)):livingPlayers.has(String(u.id))||s.operativeState[u.id]))continue;
   if(u.side==='enemy'&&groupedEnemies.has(String(u.id)))continue;
   unit(u);
  }
  for(const r of snapshot.groundItems??[])if(r.type==='item')record(r);
  for(const r of snapshot.droppedWeapons??[])if(!r.taken)record(r);
  for(const container of [...(expandCellScene(snapshot).tiles??[]),...(snapshot.props??[])])for(const r of container.contents??[])record(r);
  for(const npc of snapshot.npcs??[])for(const gift of npc.questGifts??[])record(gift);
 };
 for(const snapshot of snapshots)if(!active||snapshot.sectorId!==active.sectorId||(snapshot.sceneId??null)!==(active.sceneId??null))field(snapshot);
 for(const records of Object.values(s.sectorRemains??{}))for(const r of records)if(!activePlayers.has(String(r.unitId)))unit(r.unit);
 if(active)field(active,true);
 return true;
}

export function deliverEquipmentShipments(s){
 const delivered=[];s.equipmentShipments??=[];
 if(importDelayReason(s))return delivered;
 for(const shipment of [...s.equipmentShipments])if(shipment.due<=s.hour&&s.armoryItems.length+shipment.quantity<=10000){
  const item=equipmentCatalogItem(shipment.item,s);need(item&&isImportedEquipment(item),'El pedido de armas ya no corresponde al catálogo.');
  addEquipment(s,shipment.item,shipment.quantity);delivered.push({kind:'equipment',sector:importRulesFor(s).port,item:shipment.item,quantity:shipment.quantity});
  s.equipmentShipments.splice(s.equipmentShipments.indexOf(shipment),1);s.log.unshift({hour:s.hour,text:`Arriban a ${importPortName(s)} ${shipment.quantity} armas importadas para la sala de armas.`});s.log=s.log.slice(0,80);
 }
 return delivered;
}
export function validEquipmentShipments(s){return Array.isArray(s.equipmentShipments)&&s.equipmentShipments.length<=1000&&(importRulesFor(s).port!==null||s.equipmentShipments.length===0)&&s.equipmentShipments.every(q=>q&&isImportedEquipment(equipmentCatalogItem(q.item,s))&&Number.isInteger(q.quantity)&&q.quantity>0&&q.quantity<=100&&Number.isInteger(q.due)&&q.due>=0&&q.due<=1e9);}
