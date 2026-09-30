import {CAMPAIGN_SECTORS,RESOURCE_NAMES} from './data.js';
import {equipmentCatalogItem,isImportedEquipment} from './equipment.js';
import {convoyStatus,TRANSPORT_ISSUES} from './logistics.js';

const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const sectors=new Set(CAMPAIGN_SECTORS.map(s=>s.id));
const keys={production:['kind','sector','name','goods'],shipment:['kind','sector','goods'],equipment:['kind','sector','item','quantity'],convoy:['kind','sector','goods']};
const need=value=>{if(!value)throw Error('Los avisos de producción y entregas guardados son inválidos.');};
const LIMIT=3009;
const issueText={occupied:'El destino está bajo control realista.',unsupplied:'La maestranza no tiene una ruta de abastecimiento desde Retiro.',blockade:'El bloqueo impide la entrada al puerto.',armory_full:'La sala de armas no tiene espacio. Retirá o vendé armas para recibir el pedido.',...TRANSPORT_ISSUES};
const compatibleCode=(kind,code)=>kind==='convoy'?Object.hasOwn(TRANSPORT_ISSUES,code):kind==='production'?['occupied','unsupplied'].includes(code):['occupied','blockade',...(kind==='equipment'?['armory_full']:[])].includes(code);
const eventKeys=event=>[...(keys[event.kind]??[]),...(event.state==='blocked'?['state','code']:[])];

export function migrateLogisticsAttention(s){
 if(s.logisticsNotice===undefined)s.logisticsNotice=null;
 if(s.logisticsAttention===undefined)s.logisticsAttention={version:1,reported:{}};
 return s;
}

// Observe only overdue work under the existing delivery rules. Inputs have
// already been paid/reserved; an interruption never creates a new resource cost.
function blockedStates(s,{isSupplied}){
 const states=[],duplicates=new Map();
 const add=(job,event,code,identity=null)=>{
  if(job.due>s.hour||!code)return;
  const base=JSON.stringify([job.due,event,identity]),index=duplicates.get(base)??0;
  duplicates.set(base,index+1);
  states.push({binding:JSON.stringify([job.due,index,event,identity]),event:{...event,state:'blocked',code}});
 };
 for(const job of s.production??[])add(job,{kind:'production',sector:job.sector,name:job.name,goods:job.yield},s.sectors[job.sector].owner!=='patriot'?'occupied':!isSupplied(s,job.sector)?'unsupplied':null,job.id);
 const portIssue=s.sectors.ensenada.owner!=='patriot'?'occupied':s.blockade?'blockade':null;
 for(const job of s.shipments??[])add(job,{kind:'shipment',sector:'ensenada',goods:job.goods},portIssue);
 for(const job of s.equipmentShipments??[])add(job,{kind:'equipment',sector:'ensenada',item:job.item,quantity:job.quantity},portIssue??((s.armoryItems?.length??0)+job.quantity>10000?'armory_full':null));
 for(const job of s.convoys??[]){
  if(job.due>s.hour)continue;
  const status=convoyStatus(s,job);
  add(job,{kind:'convoy',sector:job.destination,goods:job.goods},status.delayed?status.code:null,JSON.stringify([job.id,job.source,job.mode]));
 }
 return states;
}
function reconcile(s,states){
 const current=new Map(states.map(({binding,event})=>[binding,event.code]));
 for(const [binding,code]of Object.entries(s.logisticsAttention.reported))if(current.get(binding)!==code)delete s.logisticsAttention.reported[binding];
}
export function reconcileLogisticsAttention(s,context){
 migrateLogisticsAttention(s);
 if(Object.keys(s.logisticsAttention.reported).length)reconcile(s,blockedStates(s,context));
 return s;
}
export function collectLogisticsAttention(s,context){
 migrateLogisticsAttention(s);
 const states=blockedStates(s,context),events=[];
 reconcile(s,states);
 for(const {binding,event}of states){
  if(s.logisticsAttention.reported[binding]===event.code)continue;
  s.logisticsAttention.reported[binding]=event.code;
  events.push(event);
 }
 return events;
}

// Completion receipts come only from jobs removed by delivery code. Blocked
// events describe pending jobs. Neither delivers, refunds or recreates cargo.
export function recordLogisticsNotice(s,requestedHours,advancedHours,events){
 if(!events.length)return false;
 s.logisticsNotice={hour:s.hour,requestedHours,advancedHours,events:structuredClone(events)};
 return true;
}
export function publicLogisticsNotice(s){
 const n=s.logisticsNotice;if(!n)return null;
 return {hour:n.hour,requestedHours:n.requestedHours,advancedHours:n.advancedHours,events:n.events.map(event=>
   Object.fromEntries(eventKeys(event).map(key=>[key,structuredClone(event[key])])))};
}
function validateEvent(e){
 need(object(e)&&Object.hasOwn(keys,e.kind)&&exact(e,eventKeys(e)));
 need(sectors.has(e.sector)||e.kind==='convoy'&&e.sector==='reserve');
 if(e.state==='blocked')need(compatibleCode(e.kind,e.code));
 if(e.kind==='shipment'||e.kind==='equipment')need(e.sector==='ensenada');
 if(e.kind==='production')need(['retiro','cordoba','mendoza'].includes(e.sector)&&typeof e.name==='string'&&e.name.length<100);
 if(e.kind==='equipment')need(isImportedEquipment({item:e.item})&&integer(e.quantity,1,100));
 else need(object(e.goods)&&Object.entries(e.goods).every(([key,value])=>Object.hasOwn(RESOURCE_NAMES,key)&&integer(value,0,1e9)));
}
export function validateLogisticsNotice(s){
 migrateLogisticsAttention(s);
 const a=s.logisticsAttention;
 need(exact(a,['version','reported'])&&a.version===1&&object(a.reported)&&Object.keys(a.reported).length<=LIMIT);
 for(const [binding,code]of Object.entries(a.reported)){
  need(binding.length<=4096);
  let values;try{values=JSON.parse(binding);}catch{need(false);}
  need(Array.isArray(values)&&values.length===4&&JSON.stringify(values)===binding);
  const [due,index,event,identity]=values;
  need(integer(due,0,s.hour)&&integer(index,0,999)&&(identity===null||typeof identity==='string'&&identity.length<=1000));
  validateEvent(event);need(event.state===undefined&&compatibleCode(event.kind,code));
 }
 const n=s.logisticsNotice;if(n===null)return;
 need(exact(n,['hour','requestedHours','advancedHours','events'])&&integer(n.hour,0,s.hour)&&integer(n.requestedHours,1,240)&&integer(n.advancedHours,0,Math.min(n.requestedHours,n.hour)));
 // Three transport queues of at most 1000 entries, plus nine workshop jobs.
 need(Array.isArray(n.events)&&n.events.length>0&&n.events.length<=LIMIT);
 for(const e of n.events){validateEvent(e);if(n.advancedHours===0)need(e.state==='blocked');}
}
export function logisticsEventText(event){
 const place=event.sector==='reserve'?'la reserva de Retiro':CAMPAIGN_SECTORS.find(s=>s.id===event.sector)?.name??event.sector;
 if(event.state==='blocked'){
  const label=event.kind==='production'?event.name:event.kind==='equipment'?`${event.quantity} × ${equipmentCatalogItem(event.item)?.name??'arma importada'}`:event.kind==='convoy'?'El convoy':'El cargamento';
  return `${place}: ${label}, entrega pendiente. ${issueText[event.code]??'La entrega necesita atención.'}`;
 }
 if(event.kind==='equipment')return `Ensenada: llegaron ${event.quantity} × ${equipmentCatalogItem(event.item)?.name??'arma importada'} a la sala de armas.`;
 const goods=Object.entries(event.goods).filter(([,count])=>count>0).map(([key,count])=>`${count} ${RESOURCE_NAMES[key].toLowerCase()}`).join(', ');
 if(event.kind==='production')return `${place}: se completó ${event.name}. La reserva recibe ${goods}.`;
 if(event.kind==='shipment')return `Ensenada: llegó el cargamento. La reserva recibe ${goods}.`;
 return `${place}: el convoy entregó ${goods}.`;
}
