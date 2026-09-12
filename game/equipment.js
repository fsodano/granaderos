import {wornOutfit} from './outfits.js';
import {validateReloadProgress} from './weapon-reload.js';
import {heldSupply} from './held-supplies.js';
import {heldTool} from './environment-interactions.js';
import {WEAPONS} from './data.js';
import {inventoryUsage,validateHands,carriedObject} from './tactical-inventory.js';
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
 const record=s.operativeState[op.id],capacity=WEAPONS[op.weapon]?.capacity??0;
 // Reserve the normal cartridge stack for the next deployment. Ammunition is
 // returned to stock between reports; loaded charges stay with the gun.
 return inventoryUsage({...op,...record,ammo:Math.max((record.carriedAmmo??0)-(record.carriedLoaded??0),capacity&&!record.weaponDropped?10-(record.carriedLoaded??capacity):0),boleadoras:record.boleadoras??1,...changes});
}
export function allocateEquipmentAmmo(s,op,stock){
 const record=s.operativeState[op.id],capacity=record.weaponDropped?0:WEAPONS[op.weapon]?.capacity??0;
 const carried=record.carriedAmmo??0;
 if(!capacity)return {loaded:0,ammo:carried};
 const rounds=carried+Math.min(Math.max(0,10-carried),stock),loaded=record.carriedLoaded??Math.min(capacity,rounds);let ammo=rounds-loaded;
 while(ammo>Math.max(0,carried-loaded)&&equipmentInventoryUsage(s,op,{ammo}).overloaded)ammo--;
 return {loaded,ammo,...(record.carriedReloadProgress?{reloadProgress:record.carriedReloadProgress}:{})};
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
 const types=[],selection=s.artillerySelection?.length?s.artillerySelection:['field8','swivel','bronze4'].flatMap(type=>Array(Math.min(available[type],3)).fill(type));
 for(const type of selection)if(types.length<3&&available[type]>0){types.push(type);available[type]--;}
 return types.map((type,i)=>({id:`gun-${i}`,type,side:'player',loaded:true,ammo:6}));
}

export function isImportedEquipment(item){return [1800,1802].includes(Number(item?.item));}
export const WORKSHOP_SECTORS=['retiro','cordoba','mendoza'];
export const MERCHANT_CASH=1200;
export const USED_EQUIPMENT_LIMIT=1000;
export const MEDICAL_STOCK_CAP=40;
export const MEDICAL_DAILY_RESTOCK=5;
export const medicalSupplyStock=(s,at=s.location)=>s.merchants?.[at]?.supplies?.medkits??0;
const need=(ok,message)=>{if(!ok)throw Error(message);};
const handheld=item=>Number.isInteger(Number(item))&&Number(item)>=1800&&Number(item)<=1813;
const catalogItem=equipmentCatalogItem;
const validInstanceId=validItemIdentity;
const generatedIdentityNumber=id=>typeof id==='string'&&/^equipment-[1-9][0-9]{0,8}$/.test(id)?Number(id.slice(10)):null;
function migratedIdentitySequence(s){let maximum=0;const pending=[s];while(pending.length){const value=pending.pop();if(!value||typeof value!=='object')continue;for(const [key,child]of Object.entries(value)){if(['instanceId','weaponInstanceId','bladeInstanceId'].includes(key)){const number=generatedIdentityNumber(child);if(number!==null)maximum=Math.max(maximum,number);}else if(child&&typeof child==='object')pending.push(child);}}return maximum+1;}
const stockCap=item=>item.category==='artillery'?1:item.category==='blade'?6:3;
const merchantCatalog=sector=>EQUIPMENT_CATALOG.filter(item=>sector==='ensenada'?isImportedEquipment(item):!isImportedEquipment(item));
const initialMerchant=sector=>({usedItems:[],stock:Object.fromEntries(merchantCatalog(sector).map(item=>[item.stockKey??item.item,stockCap(item)])),supplies:{medkits:sector==='ensenada'?0:MEDICAL_STOCK_CAP},restockHours:0,cash:sector==='ensenada'?0:MERCHANT_CASH});

export function migrateEquipment(s){
 const legacy=s.fittingRulesVersion===undefined;
 if(legacy){s.nextEquipmentInstanceId??=migratedIdentitySequence(s);s.fittingRulesVersion=FITTING_RULES_VERSION;}
 s.armory??={};
 for(const record of Object.values(s.operativeState??{})){if(record.bladeCondition===undefined)record.bladeCondition=100;normalizeUnitFittings(record);}
 if(s.merchants===undefined)s.merchants=Object.fromEntries([...WORKSHOP_SECTORS,'ensenada'].map(id=>[id,initialMerchant(id)]));
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

export function storeEquipment(s,item,{condition=100,jammed=false,instanceId,fittingPattern=null,fittings={},loaded,reloadProgress}={}){
 need(loaded===undefined||Number.isSafeInteger(loaded)&&loaded>=0&&loaded<=(WEAPONS[item]?.capacity??0),'La carga del arma guardada es inválida.');
 validateReloadProgress(reloadProgress,WEAPONS[item]?.capacity??0,loaded??0);
 need(handheld(item)&&Number.isFinite(condition)&&condition>=0&&condition<=100&&typeof jammed==='boolean','El arma almacenada es inválida.');
 validateFittingPattern(fittingPattern,Number(item),instanceId);validateWeaponFittings(fittings,Number(item));need(instanceId===undefined||validItemIdentity(instanceId),'La identidad del arma almacenada es inválida.');
 const owned=fittingItemIds({instanceId,fittings});need(new Set(owned).size===owned.length,'La identidad del equipo está duplicada.');
 need(s.armoryItems.length<10000,'La armería está llena.');
 const instance={id:`armory-${s.nextArmoryItemId++}`,item:Number(item),condition,jammed,...(loaded===undefined?{}:{loaded}),...(reloadProgress?{reloadProgress}:{}),...(instanceId===undefined?{}:{instanceId}),...(fittingPattern===null?{}:{fittingPattern}),...(Object.keys(fittings).length?{fittings:structuredClone(fittings)}:{})};
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
 validateHands(report);validateUnitFittings(report);
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

// Strategic records store cartridges separately from the deployed unit shape.
function personalHandState(s,op,r){
 const deployed=s.pendingBattle?.squad?.find(u=>String(u.id)===String(op?.id));
 const ammo=r.captured?r.capturedAmmunition?.ammo??0:deployed?deployed.ammo??0:Math.max(0,(r.carriedAmmo??0)-(r.carriedLoaded??0));
 return {...op,...r,ammo};
}
export function validateEquipment(s,roster=[]){
 migrateEquipment(s);
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v),integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 need(s.fittingRulesVersion===FITTING_RULES_VERSION&&integer(s.nextEquipmentInstanceId,1,1e9),'La versión o secuencia del equipo es inválida.');
 need(object(s.merchants)&&Object.keys(s.merchants).length===4,'Los comerciantes guardados son inválidos.');
 for(const sector of [...WORKSHOP_SECTORS,'ensenada']){const merchant=s.merchants[sector],items=merchantCatalog(sector);
  need(object(merchant)&&object(merchant.stock)&&Object.keys(merchant.stock).length===items.length&&items.every(item=>integer(merchant.stock[item.stockKey??item.item],0,stockCap(item)))&&object(merchant.supplies)&&Object.keys(merchant.supplies).length===1&&integer(merchant.supplies.medkits,0,sector==='ensenada'?0:MEDICAL_STOCK_CAP)&&integer(merchant.restockHours,0,23)&&integer(merchant.cash,0,1000000000),'Las existencias del comerciante son inválidas.');
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
  validateFittingPattern(item.fittingPattern,item.item,item.instanceId);validateWeaponFittings(item.fittings,item.item);ids.add(item.id);
 }
 for(const item of s.armoryItems){validateStored(item);counts[item.item]=(counts[item.item]??0)+1;}
 need(EQUIPMENT_CATALOG.filter(w=>handheld(w.item)).every(item=>(counts[item.item]??0)===(s.armory[item.item]??0)),'Las cantidades de la armería no coinciden con sus ejemplares.');
 for(const [id,r] of Object.entries(s.operativeState)){
  const op=roster.find(op=>op.id===Number(id));
  need(r.carriedAmmo===undefined||integer(r.carriedAmmo,0,100000),'La reserva personal de cartuchos es inválida.');
  need(r.carriedLoaded===undefined||!r.weaponDropped&&(WEAPONS[op?.weapon]?.capacity??0)>0&&integer(r.carriedLoaded,0,Math.min(WEAPONS[op.weapon].capacity,r.carriedAmmo??0)),'La carga personal del arma es inválida.');
  need(r.carriedReloadProgress===undefined||r.carriedLoaded!==undefined,'Falta la carga del arma en recarga.');validateReloadProgress(r.carriedReloadProgress,WEAPONS[op?.weapon]?.capacity??0,r.carriedLoaded??0,r.weaponDropped);
  validateHands(personalHandState(s,op,r));validateUnitFittings({...op,...r});
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
 const unit=u=>{validateHands(u);validateUnitFittings(u);for(const id of heldItemIds(u))claim(id);for(const r of Object.values(u.inventory??{}))record(r);};
 const livingPlayers=new Set();
 for(const op of roster){const r=s.operativeState[op.id];if(r?.alive&&r.hp>0){livingPlayers.add(String(op.id));if(!activePlayers.has(String(op.id)))unit(personalHandState(s,op,r));}}
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
