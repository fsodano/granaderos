import {CAMPAIGN_SECTORS,RESOURCE_NAMES} from './data.js';
import {equipmentCatalogItem,isImportedEquipment} from './equipment.js';

const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const sectors=new Set(CAMPAIGN_SECTORS.map(s=>s.id));
const keys={production:['kind','sector','name','goods'],shipment:['kind','sector','goods'],equipment:['kind','sector','item','quantity'],convoy:['kind','sector','goods']};
const need=value=>{if(!value)throw Error('Los avisos de producción y entregas guardados son inválidos.');};

// Receipts are created only for jobs actually removed by their delivery code.
// They report completion; they never deliver, refund or recreate a cargo.
export function recordLogisticsNotice(s,requestedHours,advancedHours,events){
 if(!events.length)return false;
 s.logisticsNotice={hour:s.hour,requestedHours,advancedHours,events:structuredClone(events)};
 return true;
}
export function publicLogisticsNotice(s){
 const n=s.logisticsNotice;if(!n)return null;
 return {hour:n.hour,requestedHours:n.requestedHours,advancedHours:n.advancedHours,events:n.events.map(event=>
   Object.fromEntries((keys[event.kind]??[]).map(key=>[key,structuredClone(event[key])])))};
}
export function validateLogisticsNotice(s){
 if(s.logisticsNotice===undefined)s.logisticsNotice=null;
 const n=s.logisticsNotice;if(n===null)return;
 need(exact(n,['hour','requestedHours','advancedHours','events'])&&integer(n.hour,1,s.hour)&&integer(n.requestedHours,1,240)&&integer(n.advancedHours,1,Math.min(n.requestedHours,n.hour)));
 // Three transport queues of at most 1000 entries, plus nine workshop jobs.
 need(Array.isArray(n.events)&&n.events.length>0&&n.events.length<=3009);
 for(const e of n.events){
  need(object(e)&&Object.hasOwn(keys,e.kind)&&exact(e,keys[e.kind]));
  need(sectors.has(e.sector)||e.kind==='convoy'&&e.sector==='reserve');
  if(e.kind==='shipment'||e.kind==='equipment')need(e.sector==='ensenada');
  if(e.kind==='production')need(['retiro','cordoba','mendoza'].includes(e.sector)&&typeof e.name==='string'&&e.name.length<100);
  if(e.kind==='equipment')need(isImportedEquipment({item:e.item})&&integer(e.quantity,1,100));
  else need(object(e.goods)&&Object.entries(e.goods).every(([key,value])=>Object.hasOwn(RESOURCE_NAMES,key)&&integer(value,0,1e9)));
 }
}
export function logisticsEventText(event){
 const place=event.sector==='reserve'?'la reserva de Retiro':CAMPAIGN_SECTORS.find(s=>s.id===event.sector)?.name??event.sector;
 if(event.kind==='equipment')return `Ensenada: llegaron ${event.quantity} × ${equipmentCatalogItem(event.item)?.name??'arma importada'} a la sala de armas.`;
 const goods=Object.entries(event.goods).filter(([,count])=>count>0).map(([key,count])=>`${count} ${RESOURCE_NAMES[key].toLowerCase()}`).join(', ');
 if(event.kind==='production')return `${place}: se completó ${event.name}. La reserva recibe ${goods}.`;
 if(event.kind==='shipment')return `Ensenada: llegó el cargamento. La reserva recibe ${goods}.`;
 return `${place}: el convoy entregó ${goods}.`;
}
