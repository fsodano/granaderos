import {artilleryTransportRules} from './artillery-transport-rules.js';
import {CAMPAIGN_SECTORS} from './data.js';
import {artilleryProfile} from './artillery-definitions.js';
import {operativeInTransit,operativeLocation} from './squads.js';
import {careAssignmentBusy} from './medical-care.js';
import {validateArtilleryInventory} from './campaign-artillery.js';
const parent=id=>id==='san_lorenzo'?'san_nicolas':id;
const place=id=>CAMPAIGN_SECTORS.find(s=>s.id===id);
const need=(ok,message)=>{if(!ok)throw Error(message);};
const capable=u=>u.hp>=15&&(u.energy??100)>0&&!u.routed&&!u.surrendered&&!u.departure&&!u.fled&&!u.asleep&&!u.unconscious;
const availableCrew=(s,at)=>(s.squad??[]).filter(id=>{const r=s.operativeState[id];return r?.alive&&capable(r)&&!r.captured&&!operativeInTransit(s,id)&&!careAssignmentBusy(r.assignment)&&!s.militiaTraining?.some(c=>c.trainerId===id)&&operativeLocation(s,id)===at;});
const hostile=(s,at)=>s.enemyGroups?.some(g=>g.target===at&&['waiting','engaged','stationed'].includes(g.status))||Object.entries(s.sectorStates??{}).some(([key,b])=>parent(key)===at&&b.units?.some(u=>u.side==='enemy'&&capable(u)));
const accepts=(id,mode)=>mode==='flotilla'?place(id)?.theater==='coast':place(id)?.biome!=='mountain';
const hours=(s,path,mode)=>(path.length-1)*(artilleryTransportRules(s)[`${mode}Hours`]??0);
export function artilleryTransportPath(s,from,to,mode,{ignoreControl=false}={}){
 if(!place(from)||!place(to)||!accepts(from,mode)||!accepts(to,mode))return null;
 const queue=[[from]],seen=new Set([from]);while(queue.length){const path=queue.shift(),last=path.at(-1);if(last===to)return path;for(const id of place(last).neighbors)if(!seen.has(id)&&(ignoreControl||s.sectors[id]?.owner==='patriot')&&accepts(id,mode)){seen.add(id);queue.push([...path,id]);}}return null;
}
export const ARTILLERY_DELIVERY_ISSUES=Object.freeze({route_cut:'Una ocupación corta la ruta de la pieza.',blockade:'La flotilla espera el fin del bloqueo.',hostile:'La entrega espera que el destino quede despejado.',depot_full:'El depósito de destino está lleno.'});
export function artilleryTransferDelayCode(s,transfer){
 if(transfer.path.some(id=>s.sectors[id]?.owner!=='patriot'))return 'route_cut';
 if(transfer.mode==='flotilla'&&s.blockade)return 'blockade';
 if(hostile(s,transfer.to))return 'hostile';
 if((s.artilleryDepots?.[transfer.to]?.length??0)>=2000)return 'depot_full';
 return null;
}
export function artilleryTransferDelay(s,transfer){return ARTILLERY_DELIVERY_ISSUES[artilleryTransferDelayCode(s,transfer)]??'';}
export function artilleryTransportQuote(s,sector,gunId,to,mode,source='field'){
 const rules=artilleryTransportRules(s),cost=rules[`${mode}Fee`]??0,from=parent(sector),gun=(source==='depot'?s.artilleryDepots?.[sector]:s.sectorStates?.[sector]?.artillery)?.find(g=>g.id===gunId),spec=gun&&artilleryProfile(s,gun),path=artilleryTransportPath(s,from,to,mode);
 const crew=availableCrew(s,from);
 const reason=s.defeated?'La campaña ha terminado.':s.pendingBattle||s.pendingEncounter?'Salí de la escena táctica antes de enviar la pieza.':!rules.enabled?'Esta campaña no permite trasladar piezas de artillería.':!['field','depot'].includes(source)?'El origen de la pieza no es válido.':!gun||from!==s.location||!place(from)||source==='depot'&&sector!==s.location?'La pieza debe estar emplazada o guardada en esta localidad.':
  gun.side!=='player'||s.sectors[from]?.owner!=='patriot'?'La pieza y su localidad deben estar bajo tu control.':hostile(s,from)?'Aún quedan enemigos capaces de combatir junto a la pieza.':
  crew.length<spec.crew?`Se necesitan ${spec.crew} combatientes disponibles de la escuadra para cargar esta pieza.`:!place(to)||to===from?'Elegí otra localidad como destino.':s.sectors[to]?.owner!=='patriot'?'El destino debe estar bajo tu control.':
  !['carts','flotilla'].includes(mode)?'Los cañones completos viajan en carretas o flotilla.':!s.routes[mode]?'Primero organizá ese transporte.':!path?'No hay una ruta controlada apta para ese transporte. Las carretas no llevan cañones completos por los pasos de montaña.':
  mode==='flotilla'&&s.blockade?'La flotilla está bloqueada.':hostile(s,to)?'El destino aún tiene enemigos capaces de combatir.':
  artilleryCargoWeight(gun)>ARTILLERY_TRANSPORT_CAPACITY[mode]?'La pieza y sus municiones superan la capacidad del transporte.':
  (s.artilleryTransfers?.length??0)>=1000?'Ya hay demasiadas piezas en tránsito.':(s.artilleryDepots?.[to]?.length??0)+(s.artilleryTransfers??[]).filter(t=>t.to===to).length>=2000?'El depósito de destino no tiene lugar.':s.resources.treasury<cost?'No hay suficientes pesos para enviar la pieza.':'';
 return {available:!reason,reason,from,to,mode,path,cost,hours:path?hours(s,path,mode):0,crew:spec?.crew??0,weight:gun?artilleryCargoWeight(gun):0,capacity:ARTILLERY_TRANSPORT_CAPACITY[mode]??0};
}
export const ARTILLERY_TRANSPORT_CAPACITY=Object.freeze({carts:1000,flotilla:4000});
export const artilleryCargoWeight=gun=>500+(gun.ammo+Number(gun.loaded))*(gun.type==='field8'?4:2);
export function storedArtilleryRecord(gun){return Object.fromEntries(['id','type','side','loaded','ammo','reloadProgress','facing'].filter(key=>gun[key]!==undefined).map(key=>[key,structuredClone(gun[key])]));}
const stored=storedArtilleryRecord;
export function artilleryStorageQuote(s,sector,gunId){
 const from=parent(sector),gun=s.sectorStates?.[sector]?.artillery?.find(g=>g.id===gunId),spec=gun&&artilleryProfile(s,gun);
 const reason=s.defeated?'La campaña ha terminado.':s.pendingBattle||s.pendingEncounter?'Salí de la escena táctica antes de guardar la pieza.':!gun||from!==s.location||!place(from)?'La pieza debe estar emplazada en esta localidad.':gun.side!=='player'||s.sectors[from]?.owner!=='patriot'?'La pieza y su localidad deben estar bajo tu control.':hostile(s,from)?'Aún quedan enemigos capaces de combatir junto a la pieza.':availableCrew(s,from).length<spec.crew?`Se necesitan ${spec.crew} combatientes disponibles de la escuadra para guardar esta pieza.`:(s.artilleryDepots?.[from]?.length??0)>=2000?'El depósito local no tiene lugar.':'';
 return {available:!reason,reason,sector,from,gun,crew:spec?.crew??0};
}
export function storeStationedArtillery(s,action){
 const quote=artilleryStorageQuote(s,action.sector,action.artilleryId);need(quote.available,quote.reason);
 const source=s.sectorStates[action.sector].artillery,index=source.findIndex(g=>g.id===action.artilleryId),gun=stored(source[index]);
 s.artilleryDepots??={};s.artilleryDepots[quote.from]??=[];s.artilleryDepots[quote.from].push(gun);source.splice(index,1);return quote;
}
export function dispatchArtilleryTransport(s,action){
 const q=artilleryTransportQuote(s,action.sector,action.artilleryId,action.to,action.mode,action.source);need(q.available,q.reason);s.resources.treasury-=q.cost;
 const guns=action.source==='depot'?s.artilleryDepots[action.sector]:s.sectorStates[action.sector].artillery,index=guns.findIndex(g=>g.id===action.artilleryId),gun=stored(guns[index]);guns.splice(index,1);
 s.artilleryTransfers??=[];s.artilleryTransfers.push({id:gun.id,from:q.from,to:q.to,mode:q.mode,path:q.path,departedAt:s.hour,dueAt:s.hour+q.hours,gun});return q;
}
export function deliverArtilleryTransfers(s){
 const delivered=[];
 for(const t of [...(s.artilleryTransfers??[])])if(t.dueAt<=s.hour&&!artilleryTransferDelay(s,t)){
  s.artilleryDepots??={};s.artilleryDepots[t.to]??=[];s.artilleryDepots[t.to].push(structuredClone(t.gun));s.artilleryTransfers=s.artilleryTransfers.filter(v=>v.id!==t.id);
  delivered.push({kind:'artillery',sector:t.to,id:t.id,quantity:1});
  s.log.unshift({hour:s.hour,text:`La pieza ${artilleryProfile(s,t.gun).name} llega al depósito de ${place(t.to).name} con su munición restante.`});s.log=s.log.slice(0,80);
 }
 return delivered;
}
export {localArtilleryDepot,depotSelection} from './artillery-depots.js';
export function validateArtilleryTransport(s){
 const depots=s.artilleryDepots===undefined?{}:s.artilleryDepots,transfers=s.artilleryTransfers===undefined?[]:s.artilleryTransfers,object=v=>v&&typeof v==='object'&&!Array.isArray(v),integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
 need(object(depots)&&Object.keys(depots).every(id=>place(id)),'Los depósitos de artillería son inválidos.');
 for(const guns of Object.values(depots)){validateArtilleryInventory(guns);need(guns.every(g=>g.side==='player'&&g.x===undefined&&g.y===undefined&&g.stationed===undefined&&g.fromDepot===undefined&&g.tacticalLevel===undefined&&g.recovered===undefined),'El depósito contiene una pieza inválida.');}
 need(Array.isArray(transfers)&&transfers.length<=1000&&new Set(transfers.map(t=>t?.id)).size===transfers.length,'Los traslados de artillería son inválidos.');
 for(const t of transfers){
  need(object(t)&&Object.keys(t).length===8&&t.id===t.gun?.id&&place(t.from)&&place(t.to)&&t.from!==t.to&&['carts','flotilla'].includes(t.mode)&&s.routes[t.mode]&&Array.isArray(t.path)&&t.path.length>=2&&t.path.length<=13&&new Set(t.path).size===t.path.length&&t.path[0]===t.from&&t.path.at(-1)===t.to&&t.path.every((id,i)=>place(id)&&accepts(id,t.mode)&&(!i||place(t.path[i-1]).neighbors.includes(id)))&&integer(t.departedAt,0,s.hour)&&integer(t.dueAt,t.departedAt+1,1e9)&&t.dueAt===t.departedAt+hours(s,t.path,t.mode),'La ruta guardada de artillería es inválida.');
  validateArtilleryInventory([t.gun]);need(t.gun.side==='player'&&t.gun.x===undefined&&t.gun.y===undefined&&t.gun.stationed===undefined&&t.gun.fromDepot===undefined&&t.gun.tacticalLevel===undefined&&t.gun.recovered===undefined&&artilleryCargoWeight(t.gun)<=ARTILLERY_TRANSPORT_CAPACITY[t.mode],'La pieza en tránsito es inválida.');
 }
}

// Both interface generations dispatch the same transfer record.
export function artilleryTransportPreview(s,{sector,gunId,artilleryId=gunId,destination,to=destination,mode='carts',source='field'}){
 const q=artilleryTransportQuote(s,sector,artilleryId,to,mode,source),gun=(source==='depot'?s.artilleryDepots?.[sector]:s.sectorStates?.[sector]?.artillery)?.find(g=>g.id===artilleryId);
 return {...q,valid:q.available,gun,source:q.from,destination:q.to,due:s.hour+q.hours,action:{type:'transportArtillery',sector,artilleryId,to,mode,source}};
}
export function queueArtilleryTransport(s,action){
 return dispatchArtilleryTransport(s,{...action,artilleryId:action.artilleryId??action.gunId,to:action.to??action.destination});
}
// Old convoy delivery must first convert the queue; no second deposit is made.
export function deliverTransportedArtillery(){throw Error('El convoy antiguo debe convertirse a un traslado de artillería antes de entregarse.');}
