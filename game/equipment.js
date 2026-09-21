import {wornOutfit} from './outfits.js';
import {isGrenadeStack,makeGrenadeStack} from './grenades.js';
import {operativeLocation,operativeInTransit} from './squads.js';
import {validateReloadProgress} from './weapon-reload.js';
import {heldSupply} from './held-supplies.js';
import {heldTool} from './environment-interactions.js';
import {WEAPONS} from './data.js';
import {AMMUNITION_TYPES,weaponAmmoType,availableAmmunition,addAmmunition} from './ammunition-types.js';
import {initializeUnitAmmunition,syncUnitAmmunition,consumeWeaponAmmunition} from './tactical-ammunition.js';
import {ammoResourceKey} from './campaign-ammunition.js';
import {inventoryUsage,validateHands,validateEquipmentCursor,carriedObject,handMetadata,handRecord,applyItemQuantity} from './tactical-inventory.js';
import {FITTING_RULES_VERSION,validateFittingPattern,validateWeaponFittings,validateUnitFittings,normalizeUnitFittings,validItemIdentity,fittingItemIds,heldItemIds,fittingLabel} from './weapon-fittings.js';
export const EQUIPMENT_CATALOG=[
 ...Object.values(WEAPONS).filter(w=>w.id>=1800&&w.id<=1813).map(w=>({...w,item:w.id,stockKey:String(w.id),category:w.id<1809?'firearm':'blade',price:({1800:240,1801:230,1802:420,1803:180,1804:100,1805:130,1806:180,1807:160,1808:220,1809:160,1810:110,1811:50,1812:70,1813:40})[w.id]})),
 {...WEAPONS[1811],item:1811,stockKey:'1811:india_socket',fittingPattern:'india_socket',name:fittingLabel('india_socket'),category:'blade',price:50},
 {item:'bronze4',id:1820,name:'Cañón de bronce de 4 libras',category:'artillery',price:700,crew:2},
 {item:'field8',id:1821,name:'Cañón de campaña de 8 libras',category:'artillery',price:1100,crew:3},
 {item:'swivel',id:1822,name:'Pedrero de regala',category:'artillery',price:400,crew:1},
];
export function equipmentCatalogItem(key){return EQUIPMENT_CATALOG.find(w=>String(w.stockKey??w.item)===String(key));}
const exactCatalogItem=record=>equipmentCatalogItem(record?.fittingPattern?`${record.item??record.weapon}:${record.fittingPattern}`:record?.item??record?.weapon);
export function equipmentLabel(record){return exactCatalogItem(record)?.name??'Equipo desconocido';}
export function armoryInventory(s){return EQUIPMENT_CATALOG.map(item=>({...item,stockKey:item.stockKey??String(item.item),quantity:item.category==='artillery'?s.armory?.[item.item]??0:(s.armoryItems??[]).filter(record=>record.item===item.item&&(record.fittingPattern??null)===(item.fittingPattern??null)).length}));}
export function refillCost(record){return Math.ceil(Math.max(0,50-(record.priming??50))*.4+Math.max(0,4-(record.flints??4))*8+Math.max(0,2-(record.rations??2))*10+Math.max(0,2-(record.torches??2))*8);}
export function firearmRepairCost(record){return Math.ceil(Math.max(0,100-(record.condition??100))*1.5);}
export function equipmentInventoryUsage(s,op,changes={}){
 const record=s.operativeState[op.id];
 return inventoryUsage({...op,...record,ammunitionVersion:1,ammo:availableAmmunition({...op,...record}),boleadoras:record.boleadoras??1,...changes});
}
export function allocateEquipmentAmmo(s,op,origin=s.location){
 const record=s.operativeState[op.id],capacity=record.weaponDropped?0:WEAPONS[op.weapon]?.capacity??0;
 const actor={...op,...structuredClone(record),loaded:record.carriedLoaded??0,ammo:0};
 initializeUnitAmmunition(actor,{defaultCount:0});
 // First issue can place charges directly in the gun. A full pack does not
 // require an extra temporary pocket for a load that the chamber can hold.
 if(capacity&&record.carriedLoaded===undefined){
  const owned=Math.min(capacity,availableAmmunition(actor));if(owned)consumeWeaponAmmunition(actor,op.weapon,owned);
  const key=ammoResourceKey(weaponAmmoType(op.weapon)),depot=s.depots?.[origin],local=depot?.[key]??0,issued=Math.min(capacity-owned,local+(s.resources[key]??0)),fromDepot=Math.min(local,issued);
  if(fromDepot)depot[key]-=fromDepot;s.resources[key]-=issued-fromDepot;actor.loaded=owned+issued;
 }
 const types=new Set([capacity?weaponAmmoType(op.weapon):null,weaponAmmoType(record.offHand?.weapon)].filter(Boolean));
 for(const type of types){
  const key=ammoResourceKey(type),depot=s.depots?.[origin],local=depot?.[key]??0;
  const held=(weaponAmmoType(op.weapon)===type?actor.loaded:0)+(weaponAmmoType(actor.offHand?.weapon)===type?actor.offHand?.loaded??0:0);
  let issued=Math.min(Math.max(0,10-held-availableAmmunition(actor,type)),(s.resources[key]??0)+local);
  while(issued>0){const trial=structuredClone(actor);addAmmunition(trial,type,issued);if(!inventoryUsage(trial).overloaded){actor.inventory=trial.inventory;break;}issued--;}
  if(issued){const fromDepot=Math.min(local,issued);if(fromDepot)depot[key]-=fromDepot;s.resources[key]-=issued-fromDepot;}
 }
 syncUnitAmmunition(actor);
 return {ammunitionVersion:1,loaded:actor.loaded,ammo:actor.ammo,inventory:actor.inventory??{},...(actor.pocketOrder?{pocketOrder:actor.pocketOrder}:{}),...(record.carriedReloadProgress?{reloadProgress:record.carriedReloadProgress}:{})};
}
export function clearCarriedLoading(record){delete record.carriedLoaded;delete record.carriedReloadProgress;}
export function setCarriedLoading(record,unit){
 if(WEAPONS[unit.weapon]?.capacity>0&&!unit.weaponDropped){record.carriedLoaded=unit.loaded??0;if(unit.reloadProgress)record.carriedReloadProgress=unit.reloadProgress;else delete record.carriedReloadProgress;}
 else clearCarriedLoading(record);
}
export function deployedArtillery(s){
 let remaining=s.resources.cannons;const available={field8:0,swivel:0,bronze4:0};
 for(const type of ['field8','swivel','bronze4']){available[type]=Math.min(remaining,s.armory?.[type]??0);remaining-=available[type];}
 available.bronze4+=remaining+(s.depots?.[s.location]?.cannons??0);
 // Older saves use an empty list for automatic selection; an explicit empty order keeps guns in reserve.
 const stored=structuredClone(s.sectors?.[s.location]?.owner==='patriot'?(s.artilleryStores?.[s.location]??[]):[]);for(const g of stored)available[g.type]++;
 const types=[],selection=(s.artillerySelectionExplicit||s.artillerySelection?.length)?s.artillerySelection:['field8','swivel','bronze4'].flatMap(type=>Array(Math.min(available[type],3)).fill(type));
 for(const type of selection)if(types.length<3&&available[type]>0){types.push(type);available[type]--;}
 return types.map((type,i)=>{const index=stored.findIndex(g=>g.type===type);return index>=0?{...stored.splice(index,1)[0],recovered:true}:{id:`gun-${i}`,type,side:'player',loaded:true,ammo:6};});
}

export function isImportedEquipment(item){return [1800,1802].includes(Number(item?.item));}
export const WORKSHOP_SECTORS=['retiro','cordoba','mendoza'];
export const MERCHANT_CASH=1200;
export const USED_EQUIPMENT_LIMIT=1000;
export const AMMUNITION_PRICE=3;
export const AMMUNITION_MERCHANT_CAP=60;
export const AMMUNITION_DAILY_RESTOCK=6;
export const ammunitionStock=(s,type,at=s.location)=>s.merchants?.[at]?.ammunition?.[type]??0;
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
const catalogItem=equipmentCatalogItem;
const validInstanceId=validItemIdentity;
const generatedIdentityNumber=id=>typeof id==='string'&&/^equipment-[1-9][0-9]{0,8}$/.test(id)?Number(id.slice(10)):null;
function migratedIdentitySequence(s){let maximum=0;const pending=[s];while(pending.length){const value=pending.pop();if(!value||typeof value!=='object')continue;for(const [key,child]of Object.entries(value)){if(['instanceId','weaponInstanceId','bladeInstanceId'].includes(key)){const number=generatedIdentityNumber(child);if(number!==null)maximum=Math.max(maximum,number);}else if(child&&typeof child==='object')pending.push(child);}}return maximum+1;}
const stockCap=item=>item.category==='artillery'?1:item.category==='blade'?6:3;
const merchantCatalog=sector=>EQUIPMENT_CATALOG.filter(item=>sector==='ensenada'?isImportedEquipment(item):!isImportedEquipment(item));
const initialMerchant=sector=>({ammunition:Object.fromEntries(Object.keys(AMMUNITION_TYPES).map(type=>[type,sector==='ensenada'?0:AMMUNITION_MERCHANT_CAP])),usedItems:[],stock:Object.fromEntries(merchantCatalog(sector).map(item=>[item.stockKey??item.item,stockCap(item)])),supplies:{medkits:sector==='ensenada'?0:MEDICAL_STOCK_CAP},restockHours:0,cash:sector==='ensenada'?0:MERCHANT_CASH});
function containsGrenades(state){
 const pending=[state],seen=new Set();
 while(pending.length){const value=pending.pop();if(!value||typeof value!=='object'||seen.has(value))continue;seen.add(value);if(isGrenadeStack(value))return true;for(const child of Object.values(value))if(child&&typeof child==='object')pending.push(child);}
 return false;
}

export function migrateEquipment(s){
 const legacy=s.fittingRulesVersion===undefined;
 if(legacy){s.nextEquipmentInstanceId??=migratedIdentitySequence(s);s.fittingRulesVersion=FITTING_RULES_VERSION;}
 s.armory??={};
 for(const record of Object.values(s.operativeState??{})){if(record.bladeCondition===undefined)record.bladeCondition=100;normalizeUnitFittings(record);}
 if(s.merchants===undefined)s.merchants=Object.fromEntries([...WORKSHOP_SECTORS,'ensenada'].map(id=>[id,initialMerchant(id)]));
 if(s.grenadeSupplyVersion===undefined){
  need(Object.values(s.merchants).every(merchant=>merchant.grenades===undefined)&&!containsGrenades(s),'La remesa de granadas mezcla versiones.');
  s.grenadeSupplyVersion=1;for(const [at,merchant]of Object.entries(s.merchants))merchant.grenades={arsenal:at==='mendoza'?GRENADE_STOCK_CAP:0};
 }
 need(s.grenadeSupplyVersion===1,'La versión de la remesa de granadas no es válida.');
 for(const [at,merchant]of Object.entries(s.merchants))need(merchant.grenades!==null&&typeof merchant.grenades==='object'&&!Array.isArray(merchant.grenades)&&Object.keys(merchant.grenades).length===1&&Number.isSafeInteger(merchant.grenades.arsenal)&&merchant.grenades.arsenal>=0&&merchant.grenades.arsenal<=(at==='mendoza'?GRENADE_STOCK_CAP:0),'Las existencias de granadas no son válidas.');
 if(legacy)for(const [at,merchant]of Object.entries(s.merchants)){merchant.supplies??={medkits:at==='ensenada'?0:MEDICAL_STOCK_CAP};if(at!=='ensenada')merchant.stock['1811:india_socket']??=6;}
 if(s.armoryItems===undefined){
  need(Object.entries(s.armory).every(([item,count])=>catalogItem(item)&&Number.isInteger(count)&&count>=0&&count<=100000),'La armería antigua es inválida.');
  need(Object.entries(s.armory).filter(([item])=>handheld(item)).reduce((sum,[,count])=>sum+count,0)<=10000,'La armería supera el límite de objetos guardados.');
  s.armoryItems=[];s.nextArmoryItemId=1;
  for(const [item,count] of Object.entries(s.armory))if(handheld(item))for(let i=0;i<count;i++)s.armoryItems.push({id:`armory-${s.nextArmoryItemId++}`,item:Number(item),condition:100,jammed:false});
 }
 for(const units of [...Object.values(s.garrisons??{}),...(s.militiaTraining??[]).map(course=>course.trainees??[]),Object.values(s.missionAllies??{}),...(s.enemyGroups??[]).map(g=>g.units??[]),...[s.pendingBattle?.squad??[],s.pendingBattle?.garrison??[],s.pendingBattle?.missionAllies??[]]])for(const unit of units)normalizeUnitFittings(unit);
 if(s.pendingBattle)s.pendingBattle.fittingRulesVersion??=FITTING_RULES_VERSION;
 if(legacy)for(const snapshot of [...Object.values(s.sectorStates??{}),...Object.values(s.sceneStates??{}),...(s.pendingBattle?.resumeSnapshot?[s.pendingBattle.resumeSnapshot]:[])]){snapshot.fittingRulesVersion??=FITTING_RULES_VERSION;for(const unit of snapshot.units??[])normalizeUnitFittings(unit);}
 if(legacy)for(const records of Object.values(s.sectorRemains??{}))for(const record of records)normalizeUnitFittings(record.unit);
 return s;
}

// Armory IDs identify storage rows, not the physical item's custom data.
// Keep extensions separately so an admitted item with its own `id` survives.
export function storedEquipmentMetadata(instance){
 const {id,item,itemMetadata,...data}=instance;
 need(itemMetadata===undefined||itemMetadata!==null&&typeof itemMetadata==='object'&&!Array.isArray(itemMetadata),'Los metadatos del arma guardada son inválidos.');
 return {...handMetadata({...data,weapon:Number(item)}),...structuredClone(itemMetadata??{})};
}
function validateStoredMetadata(instance){
 const metadata=storedEquipmentMetadata(instance);
 handRecord({weapon:instance.item,weaponMetadata:metadata,loaded:instance.loaded??0,reloadProgress:instance.reloadProgress,condition:instance.condition,jammed:instance.jammed,weaponInstanceId:instance.instanceId,weaponFittingPattern:instance.fittingPattern,weaponFittings:instance.fittings},'primary');
 return metadata;
}
export function storeEquipment(s,item,{condition=100,jammed=false,instanceId,fittingPattern=null,fittings={},loaded,reloadProgress,itemMetadata,...extensions}={}){
 need(loaded===undefined||Number.isSafeInteger(loaded)&&loaded>=0&&loaded<=(WEAPONS[item]?.capacity??0),'La carga del arma guardada es inválida.');
 validateReloadProgress(reloadProgress,WEAPONS[item]?.capacity??0,loaded??0);
 need(handheld(item)&&Number.isFinite(condition)&&condition>=0&&condition<=100&&typeof jammed==='boolean','El arma almacenada es inválida.');
 validateFittingPattern(fittingPattern,Number(item),instanceId);validateWeaponFittings(fittings,Number(item));need(instanceId===undefined||validItemIdentity(instanceId),'La identidad del arma almacenada es inválida.');
 const owned=fittingItemIds({instanceId,fittings});need(new Set(owned).size===owned.length,'La identidad del equipo está duplicada.');
 const extensionMetadata=storedEquipmentMetadata({item:Number(item),itemMetadata});
 const metadata=validateStoredMetadata({item:Number(item),condition,jammed,instanceId,fittingPattern,fittings,loaded,reloadProgress,itemMetadata:{...handMetadata({...extensions,weapon:Number(item)}),...extensionMetadata}});
 need(s.armoryItems.length<10000,'La armería está llena.');
 const instance={...(Object.keys(metadata).length?{itemMetadata:metadata}:{}),id:`armory-${s.nextArmoryItemId++}`,item:Number(item),condition,jammed,...(loaded===undefined?{}:{loaded}),...(reloadProgress?{reloadProgress}:{}),...(instanceId===undefined?{}:{instanceId}),...(fittingPattern===null?{}:{fittingPattern}),...(Object.keys(fittings).length?{fittings:structuredClone(fittings)}:{})};
 s.armoryItems.push(instance);s.armory[item]=(s.armory[item]??0)+1;return instance;
}

export function addEquipment(s,item,quantity){
 const catalog=catalogItem(item);need(catalog,'El equipo solicitado no existe.');
 if(handheld(catalog.item)){need(s.armoryItems.length+quantity<=10000,'La armería está llena.');for(let i=0;i<quantity;i++){const metadata={};if(catalog.fittingPattern){need(Number.isInteger(s.nextEquipmentInstanceId)&&s.nextEquipmentInstanceId>=1&&s.nextEquipmentInstanceId<1e9,'La secuencia del equipo es inválida.');metadata.instanceId=`equipment-${s.nextEquipmentInstanceId++}`;metadata.fittingPattern=catalog.fittingPattern;}storeEquipment(s,catalog.item,metadata);}}
 else s.armory[item]=(s.armory[item]??0)+quantity;
}

export function takeEquipment(s,item,instanceId){
 const index=s.armoryItems.findIndex(i=>i.item===Number(item)&&(instanceId===undefined||i.id===instanceId));
 need(index>=0,'Ese ejemplar ya no está disponible en la armería.');
 const [instance]=s.armoryItems.splice(index,1);s.armory[instance.item]--;return instance;
}

export function merchantStatus(s,item,isSupplied){
 const imported=isImportedEquipment(item),sector=imported?'ensenada':s.location,merchant=s.merchants?.[sector];
 const reason=s.pendingBattle?'Terminá el despliegue antes de negociar.':!WORKSHOP_SECTORS.includes(s.location)||s.sectors[s.location]?.owner!=='patriot'||!isSupplied(s,s.location)?'Debes llegar a una maestranza abastecida.':imported&&(s.sectors.ensenada.owner!=='patriot'||!isSupplied(s,'ensenada')||s.reputation.foreign<0)?'El pedido requiere Ensenada libre y abastecida y comerciantes dispuestos a negociar.':null;
 return {sector,available:!reason,reason,stock:merchant?.stock?.[item?.stockKey??item?.item]??0,restockIn:24-(merchant?.restockHours??0),cash:s.merchants?.[s.location]?.cash??0};
}

export function advanceMerchants(s,isSupplied){
 for(const [sector,merchant] of Object.entries(s.merchants)){
  if(s.sectors[sector]?.owner!=='patriot'||!isSupplied(s,sector)||s.pendingBattle?.sector===sector||sector==='ensenada'&&s.blockade)continue;
  merchant.restockHours++;
  if(merchant.restockHours<24)continue;merchant.restockHours=0;
  for(const item of merchantCatalog(sector)){const key=item.stockKey??item.item;merchant.stock[key]=Math.min(stockCap(item),merchant.stock[key]+1);}
  if(sector!=='ensenada')for(const type of Object.keys(AMMUNITION_TYPES))merchant.ammunition[type]=Math.min(AMMUNITION_MERCHANT_CAP,merchant.ammunition[type]+AMMUNITION_DAILY_RESTOCK);
  if(sector!=='ensenada')merchant.supplies.medkits=Math.min(MEDICAL_STOCK_CAP,merchant.supplies.medkits+MEDICAL_DAILY_RESTOCK);
  if(sector!=='ensenada')merchant.cash+=Math.min(300,Math.max(0,MERCHANT_CASH-merchant.cash));
 }
}

function tradeBreakdown(instance,fraction){const item=exactCatalogItem(instance),items=[];if(item&&handheld(item.item))items.push({name:item.name,condition:instance.condition,price:Math.floor(item.price*fraction*instance.condition/100)});const bayonet=instance?.fittings?.bayonet;if(bayonet){const spec=exactCatalogItem(bayonet);if(spec)items.push({name:spec.name,condition:bayonet.condition,price:Math.floor(spec.price*fraction*bayonet.condition/100)});}return {items,total:items.reduce((sum,item)=>sum+item.price,0)};}
export const resaleBreakdown=instance=>tradeBreakdown(instance,.4);
export const usedEquipmentBreakdown=instance=>tradeBreakdown(instance,.8);
export function usedEquipmentOffers(s,isSupplied){
 const market=merchantStatus(s,null,isSupplied);
 return (s.merchants?.[s.location]?.usedItems??[]).map(instance=>{
  const quote=usedEquipmentBreakdown(instance);
  const reason=market.reason??(quote.total<=0?'El arma no tiene valor de servicio.':s.armoryItems.length>=10000?'La armería está llena.':s.resources.treasury<quote.total?'No hay pesos suficientes.':null);
  return {instance,quote,reason,available:!reason,action:{type:'purchaseUsedEquipment',sector:s.location,instanceId:instance.id}};
 });
}
export function resaleQuote(instance){return resaleBreakdown(instance).total;}

export function returnEquipment(s,id,report){
 if(report.outfit!==undefined||report.poncho!==undefined){s.operativeState[id].outfit=structuredClone(wornOutfit(report));delete s.operativeState[id].poncho;}
 validateHands(report);validateUnitFittings(report);validateEquipmentCursor(report);
 if(report.equipmentCursor)s.operativeState[id].equipmentCursor=structuredClone(report.equipmentCursor);else delete s.operativeState[id].equipmentCursor;
 for(const key of ['weaponMetadata','bladeMetadata'])if(report[key]!==undefined)s.operativeState[id][key]=structuredClone(report[key]);else delete s.operativeState[id][key];
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
 return syncUnitAmmunition({...op,...r,...(deployed?{inventory:deployed.inventory}:{}),ammunitionVersion:1});
}
export function validateEquipment(s,roster=[]){
 migrateEquipment(s);
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v),integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 need(s.fittingRulesVersion===FITTING_RULES_VERSION&&integer(s.nextEquipmentInstanceId,1,1e9),'La versión o secuencia del equipo es inválida.');
 need(object(s.merchants)&&Object.keys(s.merchants).length===4,'Los comerciantes guardados son inválidos.');
 for(const sector of [...WORKSHOP_SECTORS,'ensenada']){const merchant=s.merchants[sector],items=merchantCatalog(sector);
  need(object(merchant)&&object(merchant.ammunition)&&Object.keys(merchant.ammunition).length===Object.keys(AMMUNITION_TYPES).length&&Object.keys(AMMUNITION_TYPES).every(type=>integer(merchant.ammunition[type],0,sector==='ensenada'?0:AMMUNITION_MERCHANT_CAP))&&object(merchant.stock)&&Object.keys(merchant.stock).length===items.length&&items.every(item=>integer(merchant.stock[item.stockKey??item.item],0,stockCap(item)))&&object(merchant.supplies)&&Object.keys(merchant.supplies).length===1&&integer(merchant.supplies.medkits,0,sector==='ensenada'?0:MEDICAL_STOCK_CAP)&&integer(merchant.restockHours,0,23)&&integer(merchant.cash,0,1000000000),'Las existencias del comerciante son inválidas.');
 }
 need(Array.isArray(s.armoryItems)&&s.armoryItems.length<=10000&&integer(s.nextArmoryItemId,1,1000000000),'Los ejemplares de la armería son inválidos.');
 for(const unit of s.pendingBattle?.squad??[])validateReloadProgress(unit.reloadProgress,WEAPONS[unit.weapon]?.capacity??0,unit.loaded??0,unit.weaponDropped);
 const ids=new Set(),counts={};
 for(const merchant of Object.values(s.merchants)){
  need(merchant.usedItems===undefined||Array.isArray(merchant.usedItems)&&merchant.usedItems.length<=USED_EQUIPMENT_LIMIT,'Las armas usadas del comerciante son inválidas.');
  for(const item of merchant.usedItems??[])validateStored(item);
 }
 function validateStored(item){
  need(object(item)&&typeof item.id==='string'&&/^armory-[1-9][0-9]*$/.test(item.id)&&Number(item.id.slice(7))<s.nextArmoryItemId&&!ids.has(item.id)&&typeof item.item==='number'&&handheld(item.item)&&Number.isFinite(item.condition)&&item.condition>=0&&item.condition<=100&&typeof item.jammed==='boolean','El ejemplar de arma guardado es inválido.');
  need(item.loaded===undefined||integer(item.loaded,0,WEAPONS[item.item]?.capacity??0),'La carga del arma guardada es inválida.');validateReloadProgress(item.reloadProgress,WEAPONS[item.item]?.capacity??0,item.loaded??0);
  validateFittingPattern(item.fittingPattern,item.item,item.instanceId);validateWeaponFittings(item.fittings,item.item);validateStoredMetadata(item);ids.add(item.id);
 }
 for(const item of s.armoryItems){validateStored(item);counts[item.item]=(counts[item.item]??0)+1;}
 need(EQUIPMENT_CATALOG.filter(w=>handheld(w.item)).every(item=>(counts[item.item]??0)===(s.armory[item.item]??0)),'Las cantidades de la armería no coinciden con sus ejemplares.');
 for(const [id,r] of Object.entries(s.operativeState)){
  const op=roster.find(op=>op.id===Number(id));
  need(r.carriedAmmo===undefined||integer(r.carriedAmmo,0,100000),'La reserva personal de cartuchos es inválida.');
  need(r.carriedLoaded===undefined||!r.weaponDropped&&(WEAPONS[op?.weapon]?.capacity??0)>0&&integer(r.carriedLoaded,0,Math.min(WEAPONS[op.weapon].capacity,r.carriedAmmo??0)),'La carga personal del arma es inválida.');
  need(r.carriedReloadProgress===undefined||r.carriedLoaded!==undefined,'Falta la carga del arma en recarga.');validateReloadProgress(r.carriedReloadProgress,WEAPONS[op?.weapon]?.capacity??0,r.carriedLoaded??0,r.weaponDropped);
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
 for(const op of roster){const r=s.operativeState[op.id];if(r?.alive&&r.hp>0){livingPlayers.add(String(op.id));if(!activePlayers.has(String(op.id)))unit(personalHandState(s,op,r));}}
 // A strategic death can precede any physical corpse snapshot. Its cursor is
 // still finite property; once a body exists, that body supersedes this record.
 for(const op of roster){const r=s.operativeState[op.id];if(!r?.equipmentCursor||r.alive&&r.hp>0||activePlayers.has(String(op.id)))continue;
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
  for(const container of [...(snapshot.tiles??[]),...(snapshot.props??[])])for(const r of container.contents??[])record(r);
  for(const npc of snapshot.npcs??[])for(const gift of npc.questGifts??[])record(gift);
 };
 for(const snapshot of snapshots)if(!active||snapshot.sectorId!==active.sectorId||(snapshot.sceneId??null)!==(active.sceneId??null))field(snapshot);
 for(const records of Object.values(s.sectorRemains??{}))for(const r of records)if(!activePlayers.has(String(r.unitId)))unit(r.unit);
 if(active)field(active,true);
 return true;
}

export function deliverEquipmentShipments(s){
 const delivered=[];s.equipmentShipments??=[];
 if(s.blockade||s.sectors.ensenada.owner!=='patriot')return delivered;
 for(const shipment of [...s.equipmentShipments])if(shipment.due<=s.hour&&s.armoryItems.length+shipment.quantity<=10000){addEquipment(s,shipment.item,shipment.quantity);delivered.push({kind:'equipment',sector:'ensenada',item:shipment.item,quantity:shipment.quantity});s.equipmentShipments.splice(s.equipmentShipments.indexOf(shipment),1);s.log.unshift({hour:s.hour,text:`Arriban a Ensenada ${shipment.quantity} armas importadas para la sala de armas.`});s.log=s.log.slice(0,80);}
 return delivered;
}
export function validEquipmentShipments(s){return Array.isArray(s.equipmentShipments)&&s.equipmentShipments.length<=1000&&s.equipmentShipments.every(q=>q&&isImportedEquipment({item:q.item})&&Number.isInteger(q.quantity)&&q.quantity>0&&q.quantity<=100&&Number.isInteger(q.due)&&q.due>=0&&q.due<=1e9);}
