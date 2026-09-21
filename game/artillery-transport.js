import {CAMPAIGN_SECTORS} from './data.js';
import {ARTILLERY,fieldCapable} from './tactical.js';
import {transferOptions} from './logistics.js';
import {operativeInTransit,operativeLocation} from './squads.js';
import {validateReloadProgress} from './weapon-reload.js';

const need=(ok,message)=>{if(!ok)throw Error(message);};
const parent=id=>id==='san_lorenzo'?'san_nicolas':id;
const known=id=>CAMPAIGN_SECTORS.some(s=>s.id===id);
export const storedArtilleryRecord=gun=>({id:gun.id,type:gun.type,side:'player',loaded:gun.loaded,ammo:gun.ammo,...(gun.reloadProgress?{reloadProgress:gun.reloadProgress}:{})});
export function artilleryTransportPreview(s,{sector,gunId,destination,mode='carts'}){
 const gun=s.sectorStates?.[sector]?.artillery?.find(g=>g.id===gunId),source=parent(sector);
 const option=transferOptions(s,source,destination).find(o=>o.id===mode);
 // Use the existing 500 kg artillery cargo allowance, plus finite shot supplies.
 const weight=500+(gun?gun.ammo+Number(gun.loaded):0)*(gun?.type==='field8'?4:2);
 const crew=s.squad.filter(id=>{const u=s.operativeState[id];return u?.alive&&!u.captured&&u.hp>=15&&!operativeInTransit(s,id)&&operativeLocation(s,id)===source;});
 const reason=s.pendingBattle||s.pendingEncounter?'Terminá el despliegue o encuentro antes de cargar la pieza.':
  !gun||s.location!==source?'La pieza y la escuadra deben estar en el mismo sector.':
  gun.side!=='player'||s.sectors[source]?.owner!=='patriot'?'La pieza está en poder de los realistas.':
  s.sectorStates[sector].units?.some(u=>u.side==='enemy'&&fieldCapable(u))?'Asegurá el campo antes de cargar la pieza.':
  source===destination||!known(destination)?'Elegí otro sector para recibir la pieza.':
  !['carts','flotilla'].includes(mode)?'Los cañones requieren una carreta o una embarcación.':
  !option?.available?option?.reason??'El transporte indicado no existe.':
  crew.length<ARTILLERY[gun.type].crew?'No hay suficientes artilleros disponibles para cargar la pieza.':
  weight>option.capacity?'La pieza y sus municiones superan la capacidad del transporte.':
  (s.convoys?.length??0)>=1000?'Hay demasiados convoyes pendientes.':null;
 return {valid:!reason,reason,gun,source,destination,mode,weight,hours:option?.hours,due:s.hour+(option?.hours??0),action:{type:'transportArtillery',sector,gunId,destination,mode}};
}
export function queueArtilleryTransport(s,action){
 const plan=artilleryTransportPreview(s,action);need(plan.valid,plan.reason);
 const guns=s.sectorStates[action.sector].artillery;
 guns.splice(guns.findIndex(g=>g.id===action.gunId),1);
 s.convoys??=[];
 s.convoys.push({id:`artillery-${s.hour}-${plan.gun.id}`,source:plan.source,destination:plan.destination,mode:plan.mode,goods:{cannons:1},due:plan.due,artillery:[storedArtilleryRecord(plan.gun)]});
 return plan;
}
export function deliverTransportedArtillery(s,convoy){
 if(!convoy.artillery)return false;
 s.artilleryStores??={};s.artilleryStores[convoy.destination]??=[];
 s.artilleryStores[convoy.destination].push(...structuredClone(convoy.artillery));
 return true;
}
export function validateArtilleryTransport(s){
 const stores=s.artilleryStores??{};
 need(stores&&typeof stores==='object'&&!Array.isArray(stores),'Los depósitos de artillería son inválidos.');
 const seen=new Set([...Object.values(s.sectorStates??{}),...Object.values(s.sceneStates??{}),s.pendingBattle].filter(Boolean).flatMap(b=>(b.artillery??[]).map(g=>g.id)));
 const validate=gun=>{
  need(gun&&typeof gun.id==='string'&&gun.id.length>0&&gun.id.length<=160&&!seen.has(gun.id)&&ARTILLERY[gun.type]&&gun.side==='player'&&typeof gun.loaded==='boolean'&&Number.isInteger(gun.ammo)&&gun.ammo>=0&&gun.ammo<=1000000,'La pieza transportada es inválida o está duplicada.');
  need(Object.keys(gun).every(k=>['id','type','side','loaded','ammo','reloadProgress'].includes(k)),'La pieza transportada conserva datos de un emplazamiento inválido.');
  validateReloadProgress(gun.reloadProgress,1,Number(gun.loaded));seen.add(gun.id);
 };
 for(const [at,guns] of Object.entries(stores)){need(known(at)&&Array.isArray(guns)&&guns.length<=2000,'El depósito de artillería es inválido.');guns.forEach(validate);}
 for(const merchant of Object.values(s.merchants??{}))if(merchant.usedArtillery!==undefined){
  need(Array.isArray(merchant.usedArtillery)&&merchant.usedArtillery.length<=100,'Las piezas usadas del comerciante son inválidas.');
  merchant.usedArtillery.forEach(validate);
 }
 for(const c of s.convoys??[])if(c.artillery!==undefined){
  need(Array.isArray(c.artillery)&&c.artillery.length===1&&known(c.source)&&known(c.destination)&&c.source!==c.destination&&['carts','flotilla'].includes(c.mode)&&Object.keys(c.goods).length===1&&c.goods.cannons===1,'El convoy de artillería es inválido.');
  c.artillery.forEach(validate);
  const gun=c.artillery[0],capacity=c.mode==='carts'?1000:4000;
  need(500+(gun.ammo+Number(gun.loaded))*(gun.type==='field8'?4:2)<=capacity,'El convoy de artillería supera su capacidad.');
 }
}
