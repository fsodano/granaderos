import {EQUIPMENT_CATALOG,equipmentLabel,equipmentCatalogItem,isImportedEquipment,merchantStatus,resaleBreakdown,usedEquipmentBreakdown,takeEquipment,addEquipment,USED_EQUIPMENT_LIMIT,unissuedArtilleryStock} from './equipment.js';
import {artillerySaleOffers,artilleryTradePreview,tradeArtillery,USED_ARTILLERY_LIMIT} from './artillery-trade.js';
import {fieldCapable} from './tactical.js';
const need=(ok,message)=>{if(!ok)throw Error(message);};
const deferred={deferSettlement:true};
const receipt=offer=>JSON.stringify([offer.price,offer.available,offer.instance??offer.catalog??offer.gun]);
export function merchantExchangeOffers(s,isSupplied){
 const at=s.location,merchant=s.merchants?.[at],offers=[];
 for(const instance of s.armoryItems??[]){const quote=resaleBreakdown(instance,at);offers.push({key:`sell:weapon:${instance.id}`,kind:'weapon',sell:true,instance,label:equipmentLabel(instance),price:quote.total,reason:quote.reason,available:1});}
 for(const instance of merchant?.usedItems??[])offers.push({key:`buy:weapon:${instance.id}`,kind:'weapon',sell:false,instance,label:equipmentLabel(instance),price:usedEquipmentBreakdown(instance).total,available:1});
 for(const catalog of EQUIPMENT_CATALOG.filter(item=>!isImportedEquipment(item))){const key=String(catalog.stockKey??catalog.item),available=merchant?.stock?.[key]??0;if(available>0)offers.push({key:`buy:new:${key}`,kind:'new',sell:false,catalog,label:catalog.name,price:catalog.price,available});}
 for(const plan of artillerySaleOffers(s,isSupplied,deferred))offers.push({key:`sell:artillery:${plan.action.sourceKind??'stored'}:${plan.gun.id??plan.gun.type}`,kind:'artillery',sell:true,gun:plan.gun,label:EQUIPMENT_CATALOG.find(item=>item.item===plan.gun.type).name,price:plan.price,available:plan.action.sourceKind==='stock'?plan.count:1,reason:plan.reason,action:plan.action});
 for(const gun of merchant?.usedArtillery??[]){const plan=artilleryTradePreview(s,{sector:at,gunId:gun.id,buy:true},isSupplied,deferred);offers.push({key:`buy:artillery:${gun.id}`,kind:'artillery',sell:false,gun,label:EQUIPMENT_CATALOG.find(item=>item.item===gun.type).name,price:plan.price,available:1,reason:plan.reason,action:plan.action});}
 return offers.map(offer=>({...offer,receipt:receipt(offer),reason:offer.reason??(offer.price<=0?'El objeto no tiene valor de servicio.':null)}));
}
export function merchantExchangePreview(s,action,isSupplied){
 let sales=0,purchases=0,lines=[];
 try{
  need(action.sector===s.location,'Debes estar en la maestranza de este intercambio.');
  need(!s.pendingEncounter,'Resuelve el encuentro antes de negociar.');const market=merchantStatus(s,null,isSupplied);need(market.available,market.reason);
  need(!s.enemyGroups?.some(g=>g.target===s.location&&['waiting','engaged','stationed'].includes(g.status))&&!s.sectorStates?.[s.location]?.units?.some(u=>u.side==='enemy'&&fieldCapable(u)),'Asegurá el sector antes de negociar.');
  need(Array.isArray(action.lines)&&action.lines.length>0&&action.lines.length<=100,'Selecciona entre 1 y 100 líneas para el intercambio.');
  const offers=new Map(merchantExchangeOffers(s,isSupplied).map(offer=>[offer.key,offer])),seen=new Set();
  for(const line of action.lines){
   need(line&&typeof line.key==='string'&&!seen.has(line.key),'El intercambio repite una oferta.');seen.add(line.key);
   const offer=offers.get(line.key);need(offer,'Una oferta ya no está disponible.');need(!offer.reason,offer.reason);
   need(line.receipt===offer.receipt,'Una oferta cambió. Retírala y vuelve a seleccionarla.');
   need(Number.isInteger(line.quantity)&&line.quantity>=1&&line.quantity<=100&&line.quantity<=offer.available,'La cantidad supera las existencias disponibles.');
   lines.push({...offer,quantity:line.quantity});if(offer.sell)sales+=offer.price*line.quantity;else purchases+=offer.price*line.quantity;
  }
  const merchant=s.merchants[s.location],net=purchases-sales;
  need(s.resources.treasury>=net,'No hay pesos suficientes para pagar la diferencia.');need(merchant.cash+net>=0,'El comerciante no puede pagar la diferencia.');
  need(s.resources.treasury-net<=1e9&&merchant.cash+net<=1e9,'La diferencia supera la capacidad de la tesorería.');
  let armory=s.armoryItems.length,shop=merchant.usedItems?.length??0,depot=s.artilleryStores?.[s.location]?.length??0,guns=merchant.usedArtillery?.length??0;
  for(const line of lines){const q=line.quantity;if(line.kind==='weapon'){armory+=line.sell?-q:q;shop+=line.sell?q:-q;}else if(line.kind==='new'&&line.catalog.category!=='artillery')armory+=q;else if(line.kind==='artillery'){guns+=line.sell?q:-q;if(!line.sell||!line.action.sourceKind)depot+=line.sell?-q:q;}}
  need(armory<=10000,'La armería no tiene espacio para completar el intercambio.');need(shop<=USED_EQUIPMENT_LIMIT,'El comerciante no tiene espacio para las armas ofrecidas.');need(depot<=2000,'El depósito no tiene espacio para las piezas recibidas.');need(guns<=USED_ARTILLERY_LIMIT,'El comerciante no tiene espacio para las piezas ofrecidas.');
  const stock=unissuedArtilleryStock(s),newCannons=lines.filter(l=>l.kind==='new'&&l.catalog.category==='artillery').reduce((n,l)=>n+l.quantity,0),soldCannons=lines.filter(l=>l.kind==='artillery'&&l.sell&&l.action.sourceKind==='stock').reduce((n,l)=>n+Math.min(l.quantity,stock.camp[l.action.stockType]),0);
  need(s.resources.cannons+newCannons-soldCannons<=1e9,'El depósito no puede recibir más cañones.');
  return {valid:true,reason:null,sales,purchases,net,lines};
 }catch(error){return {valid:false,reason:error.message,sales,purchases,net:purchases-sales,lines};}
}
export function exchangeMerchantEquipment(s,action,isSupplied){
 const plan=merchantExchangePreview(s,action,isSupplied);need(plan.valid,plan.reason);const merchant=s.merchants[s.location];merchant.usedItems??=[];
 // All offers were checked against the same starting state. Transfer sales first
 // to free player capacity; settlement and final capacities are checked as a net.
 for(const line of [...plan.lines].sort((a,b)=>Number(b.sell)-Number(a.sell))){
  if(line.kind==='weapon'){
   if(line.sell)merchant.usedItems.push(takeEquipment(s,line.instance.item,line.instance.id));
   else {const index=merchant.usedItems.findIndex(item=>item.id===line.instance.id),[item]=merchant.usedItems.splice(index,1);s.armoryItems.push(item);s.armory[item.item]=(s.armory[item.item]??0)+1;}
  }else if(line.kind==='artillery')for(let i=0;i<line.quantity;i++){
   const a={...line.action};if(a.sourceKind==='stock'){const stock=unissuedArtilleryStock(s);a.expectedCount=stock.camp[a.stockType]+stock.depot[a.stockType];}
   tradeArtillery(s,a,isSupplied,deferred);
  }else{
   const item=equipmentCatalogItem(line.catalog.stockKey??line.catalog.item);addEquipment(s,item.stockKey??item.item,line.quantity);merchant.stock[item.stockKey??item.item]-=line.quantity;
   if(item.category==='artillery')s.resources.cannons+=line.quantity;
  }
 }
 s.resources.treasury-=plan.net;merchant.cash+=plan.net;return plan;
}
