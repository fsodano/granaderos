import {CAMPAIGN_SECTORS} from './data.js';
import {artilleryProfile} from './artillery-definitions.js';
import {operativeLocation} from './squads.js';
import {careAssignmentBusy} from './medical-care.js';
import {validateArtilleryInventory} from './campaign-artillery.js';
const parent=id=>id==='san_lorenzo'?'san_nicolas':id;
const place=id=>CAMPAIGN_SECTORS.find(s=>s.id===id);
const need=(ok,message)=>{if(!ok)throw Error(message);};
const capable=u=>u.hp>=15&&(u.energy??100)>0&&!u.routed&&!u.surrendered&&!u.departure&&!u.fled;
const hostile=(s,at)=>Object.entries(s.sectorStates??{}).some(([key,b])=>parent(key)===at&&b.units?.some(u=>u.side==='enemy'&&capable(u)));
const accepts=(id,mode)=>mode==='flotilla'?place(id)?.theater==='coast':place(id)?.biome!=='mountain';
const hours=(path,mode)=>(path.length-1)*(mode==='flotilla'?5:18);
function road(s,from,to,mode){
 if(!place(from)||!place(to)||!accepts(from,mode)||!accepts(to,mode))return null;
 const queue=[[from]],seen=new Set([from]);while(queue.length){const path=queue.shift(),last=path.at(-1);if(last===to)return path;for(const id of place(last).neighbors)if(!seen.has(id)&&s.sectors[id]?.owner==='patriot'&&accepts(id,mode)){seen.add(id);queue.push([...path,id]);}}return null;
}
export function artilleryTransferDelay(s,transfer){
 if(transfer.path.some(id=>s.sectors[id]?.owner!=='patriot'))return 'Una ocupación corta la ruta de la pieza.';
 if(transfer.mode==='flotilla'&&s.blockade)return 'La flotilla espera el fin del bloqueo.';
 if(hostile(s,transfer.to))return 'La entrega espera que el destino quede despejado.';
 if((s.artilleryDepots?.[transfer.to]?.length??0)>=2000)return 'El depósito de destino está lleno.';
 return '';
}
export function artilleryTransportQuote(s,sector,gunId,to,mode){
 const from=parent(sector),gun=s.sectorStates?.[sector]?.artillery?.find(g=>g.id===gunId),spec=gun&&artilleryProfile(s,gun),path=road(s,from,to,mode);
 const crew=(s.squad??[]).filter(id=>{const r=s.operativeState[id];return r?.alive&&capable(r)&&!r.captured&&!careAssignmentBusy(r.assignment)&&!s.militiaTraining?.some(c=>c.trainerId===id)&&operativeLocation(s,id)===from;});
 const reason=s.defeated?'La campaña ha terminado.':s.pendingBattle?'Salí de la escena táctica antes de enviar la pieza.':!gun||from!==s.location||!place(from)?'La pieza debe estar emplazada en esta localidad.':
  gun.side!=='player'||s.sectors[from]?.owner!=='patriot'?'La pieza y su localidad deben estar bajo tu control.':hostile(s,from)?'Aún quedan enemigos capaces de combatir junto a la pieza.':
  crew.length<spec.crew?`Se necesitan ${spec.crew} combatientes disponibles de la escuadra para cargar esta pieza.`:!place(to)||to===from?'Elegí otra localidad como destino.':s.sectors[to]?.owner!=='patriot'?'El destino debe estar bajo tu control.':
  !['carts','flotilla'].includes(mode)?'Los cañones completos viajan en carretas o flotilla.':!s.routes[mode]?'Primero organizá ese transporte.':!path?'No hay una ruta controlada apta para ese transporte. Las carretas no llevan cañones completos por los pasos de montaña.':
  mode==='flotilla'&&s.blockade?'La flotilla está bloqueada.':hostile(s,to)?'El destino aún tiene enemigos capaces de combatir.':
  (s.artilleryTransfers?.length??0)>=1000?'Ya hay demasiadas piezas en tránsito.':(s.artilleryDepots?.[to]?.length??0)+(s.artilleryTransfers??[]).filter(t=>t.to===to).length>=2000?'El depósito de destino no tiene lugar.':'';
 return {available:!reason,reason,from,to,mode,path,hours:path?hours(path,mode):0,crew:spec?.crew??0};
}
const stored=gun=>{const copy=structuredClone(gun);delete copy.x;delete copy.y;delete copy.stationed;delete copy.fromDepot;return copy;};
export function dispatchArtilleryTransport(s,action){
 const q=artilleryTransportQuote(s,action.sector,action.artilleryId,action.to,action.mode);need(q.available,q.reason);
 const guns=s.sectorStates[action.sector].artillery,index=guns.findIndex(g=>g.id===action.artilleryId),gun=stored(guns[index]);guns.splice(index,1);
 s.artilleryTransfers??=[];s.artilleryTransfers.push({id:gun.id,from:q.from,to:q.to,mode:q.mode,path:q.path,departedAt:s.hour,dueAt:s.hour+q.hours,gun});return q;
}
export function deliverArtilleryTransfers(s){
 for(const t of [...(s.artilleryTransfers??[])])if(t.dueAt<=s.hour&&!artilleryTransferDelay(s,t)){
  s.artilleryDepots??={};s.artilleryDepots[t.to]??=[];s.artilleryDepots[t.to].push(structuredClone(t.gun));s.artilleryTransfers=s.artilleryTransfers.filter(v=>v.id!==t.id);
  s.log.unshift({hour:s.hour,text:`La pieza ${artilleryProfile(s,t.gun).name} llega al depósito de ${place(t.to).name} con su munición restante.`});s.log=s.log.slice(0,80);
 }
}
export function localArtilleryDepot(s){return s.sectors?.[s.location]?.owner==='patriot'?s.artilleryDepots?.[s.location]??[]:[];}
export const depotSelection=gun=>`depot:${gun.id}`;
export function validateArtilleryTransport(s){
 const depots=s.artilleryDepots===undefined?{}:s.artilleryDepots,transfers=s.artilleryTransfers===undefined?[]:s.artilleryTransfers,object=v=>v&&typeof v==='object'&&!Array.isArray(v),integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
 need(object(depots)&&Object.keys(depots).every(id=>place(id)),'Los depósitos de artillería son inválidos.');
 for(const guns of Object.values(depots)){validateArtilleryInventory(guns);need(guns.every(g=>g.side==='player'&&g.x===undefined&&g.y===undefined&&g.stationed===undefined&&g.fromDepot===undefined),'El depósito contiene una pieza inválida.');}
 need(Array.isArray(transfers)&&transfers.length<=1000&&new Set(transfers.map(t=>t?.id)).size===transfers.length,'Los traslados de artillería son inválidos.');
 for(const t of transfers){
  need(object(t)&&Object.keys(t).length===8&&t.id===t.gun?.id&&place(t.from)&&place(t.to)&&t.from!==t.to&&['carts','flotilla'].includes(t.mode)&&s.routes[t.mode]&&Array.isArray(t.path)&&t.path.length>=2&&t.path.length<=13&&new Set(t.path).size===t.path.length&&t.path[0]===t.from&&t.path.at(-1)===t.to&&t.path.every((id,i)=>place(id)&&accepts(id,t.mode)&&(!i||place(t.path[i-1]).neighbors.includes(id)))&&integer(t.departedAt,0,s.hour)&&integer(t.dueAt,t.departedAt+1,1e9)&&t.dueAt===t.departedAt+hours(t.path,t.mode),'La ruta guardada de artillería es inválida.');
  validateArtilleryInventory([t.gun]);need(t.gun.side==='player'&&t.gun.x===undefined&&t.gun.y===undefined&&t.gun.stationed===undefined&&t.gun.fromDepot===undefined,'La pieza en tránsito es inválida.');
 }
}
