import {RESOURCE_NAMES} from './data.js';
import {campaignSectors,campaignWorld} from './campaign-definition.js';
import {headquartersFor} from './campaign-headquarters.js';
import {scenarioFor} from './campaign-scenario.js';
import {campaignPlace} from './world-cells.js';
import {arrivalFacilityOptions} from './arrival-sites.js';
import {AMMUNITION_RESOURCE_KEYS} from './campaign-ammunition.js';
// Cargo weights are simulation units in kg; an artillery piece cannot ride a courier horse.
export const CARGO_WEIGHTS={timber:1,scrapIron:1,lead:1,leather:1,saltpeter:1,charcoal:1,sulfur:1,treasury:.01,horses:400,powder:1,copper:1,textiles:.5,infantry:80,muskets:4,sabres:1.3,...Object.fromEntries(Object.values(AMMUNITION_RESOURCE_KEYS).map(key=>[key,.04])),uniforms:2,cannons:500,ponchos:2};
export const TRANSPORT_OPTIONS=[
 {id:'posta',name:'Postas',capacity:30,hoursPerLeg:4,description:'Despachos y cargas ligeras; consume un caballo de remonta por tramo.'},
 {id:'carts',name:'Carretas',capacity:1000,hoursPerLeg:18,description:'Carga pesada y artillería por caminos terrestres.'},
 {id:'flotilla',name:'Flotilla',capacity:4000,hoursPerLeg:5,description:'Artillería y pertrechos entre puertos comunicados, sin bloqueo.'},
 {id:'mules',name:'Mulas con albarda',capacity:80,baseCapacity:40,saddleBonus:40,saddleWeight:6,hoursPerLeg:12,description:'La albarda de carga añade 40 kg para el tránsito por las montañas.'},
];
const sector=(id,context)=>campaignSectors(context).find(s=>s.id===id);
export const transportOptionsFor=context=>TRANSPORT_OPTIONS.map(mode=>({...mode,...campaignWorld(context).travel?.transportPresentation?.find(p=>p.id===mode.id)}));
export function flotillaSectorAllowed(context,id){
 const definition=campaignPlace(id,context),theaters=campaignWorld(context).travel?.flotillaTheaters??[];
 return Boolean(definition&&(theaters.includes(definition.theater)||arrivalFacilityOptions(id,context).some(f=>f==='port'||f==='landing')));
}
const place=(id,context)=>id==='reserve'?headquartersFor(context):id;
export const TRANSPORT_ISSUES=Object.freeze({
 network_unavailable:'Primero organiza esta red de transporte.',
 route_cut:'Una ocupación corta el camino entre los depósitos.',
 snow:'Los pasos están cerrados por la nieve.',
 flotilla_route:'La flotilla requiere puertos comunicados y libres de bloqueo.',
 mountain_carts:'Las carretas no atraviesan las sendas altas; transborda la carga a mulas.',
});
export const transportIssuesFor=context=>({...TRANSPORT_ISSUES,...campaignWorld(context).travel?.transportIssues});
export function cargoWeight(goods){return Object.entries(goods).reduce((sum,[key,quantity])=>sum+(CARGO_WEIGHTS[key]??Infinity)*quantity,0);}
export function transportPath(s,source,destination){
 const from=place(source,s),to=place(destination,s);if(!sector(from,s)||!sector(to,s)||s.sectors[from].owner!=='patriot'||s.sectors[to].owner!=='patriot')return null;
 const queue=[[from]],seen=new Set([from]);while(queue.length){const path=queue.shift(),last=path.at(-1);if(last===to)return path;for(const id of sector(last,s).neighbors)if(s.sectors[id].owner==='patriot'&&!seen.has(id)){seen.add(id);queue.push([...path,id]);}}return null;
}
export function transferOptions(s,source='reserve',destination=s.location){
 const path=transportPath(s,source,destination);const month=scenarioFor(s).calendar(s).month,travel=campaignWorld(s).travel,rough=travel?.roughTransportSectors??[];
 return transportOptionsFor(s).map(mode=>{
 let code=null;
 if(!s.routes[mode.id])code='network_unavailable';
 else if(!path)code='route_cut';
 else if(path.some(id=>rough.includes(id))&&travel?.winter?.months.includes(month))code='snow';
 else if(mode.id==='flotilla'&&(s.blockade||path.some(id=>!flotillaSectorAllowed(s,id))))code='flotilla_route';
 else if(mode.id==='carts'&&path.some(id=>rough.includes(id)))code='mountain_carts';
 return {...mode,path,available:code===null,code,reason:code?transportIssuesFor(s)[code]:'Disponible para el convoy.',hours:path?Math.max(1,(path.length-1)*mode.hoursPerLeg):null,remounts:mode.id==='posta'&&path?Math.max(1,path.length-1):0};
 });
}
export function inventoryAt(s,id){if(id==='reserve')return {...s.resources};if(!sector(id,s))throw Error('El depósito indicado no existe.');return {...(s.depots?.[id]??{})};}
export function planTransfer(s,action){
 const {source,destination,mode,goods}=action;if(source===destination)throw Error('Elegí dos depósitos diferentes.');
 const option=transferOptions(s,source,destination).find(o=>o.id===mode);if(!option?.available)throw Error(option?.reason??'El transporte indicado no existe.');
 if(!goods||typeof goods!=='object'||Array.isArray(goods)||Object.keys(goods).length===0)throw Error('Indicá la carga que llevará el convoy.');
 const available=inventoryAt(s,source);
 for(const[key,value]of Object.entries(goods)){
  if(!(key in CARGO_WEIGHTS)||!Number.isInteger(value)||value<=0)throw Error('La carga debe contener cantidades enteras y positivas de recursos conocidos.');
  if(value>(available[key]??0))throw Error(`El depósito no dispone de suficientes ${RESOURCE_NAMES[key].toLowerCase()}.`);
  if(['horses','infantry'].includes(key))throw Error('Los caballos y las tropas marchan por sus propios medios; no son carga de depósito.');
  if(key==='cannons'&&!['carts','flotilla'].includes(mode))throw Error('Los cañones requieren una carreta o una embarcación.');
 }
 const weight=cargoWeight(goods);if(weight>option.capacity)throw Error(`La carga pesa ${weight.toFixed(1)} kg y supera la capacidad de ${option.capacity} kg.`);
 if(option.remounts>s.resources.horses)throw Error('No hay suficientes caballos de remonta para las postas.');
 return {...option,source,destination,goods:{...goods},weight,due:s.hour+option.hours};
}
export function convoyStatus(s,convoy){const mode=transferOptions(s,convoy.source,convoy.destination).find(o=>o.id===convoy.mode);return {ready:s.hour>=convoy.due&&Boolean(mode?.available),delayed:s.hour>=convoy.due&&!mode?.available,code:mode?.code??null,reason:mode?.reason??'Ruta desconocida.'};}
