import {ARTILLERY} from './tactical.js';
import {validateReloadProgress} from './weapon-reload.js';
import {operativeInTransit,operativeLocation} from './squads.js';
const clone=structuredClone;
const need=(ok,message)=>{if(!ok)throw Error(message);};
const parent=id=>id==='san_lorenzo'?'san_nicolas':id;
const site=request=>request.sceneId??request.sector;
const previousBattle=(s,r)=>r.sceneId?s.sceneStates?.[r.sceneId]:s.sectorStates?.[r.sector];

// Stock is issued once. Thereafter a cannon is a physical sector asset, not a
// reusable stock count that can produce a fresh gun on the next visit.
export function prepareSectorArtillery(s,request){
 if(request.artilleryDeployment?.site===site(request))return request;
 const fresh=clone(request.artillery??[]),old=previousBattle(s,request)?.artillery??[];
 const at=request.origin??s.location,depot=s.depots?.[at];
 need(fresh.length<=s.resources.cannons+(depot?.cannons??0),'No quedan esas piezas en los depósitos.');
 for(const gun of [...fresh].sort((a,b)=>(a.type==='bronze4')-(b.type==='bronze4'))){
  if(s.resources.cannons>0){s.resources.cannons--;if((s.armory?.[gun.type]??0)>0)s.armory[gun.type]--;}
  else {need(gun.type==='bronze4','El depósito local no contiene ese modelo de artillería.');depot.cannons--;}
 }
 fresh.forEach((gun,i)=>{gun.id=`${request.id}:piece-${i}`;delete gun.stationed;});
 const occupied=s.sectors[parent(request.sector)]?.owner==='royalist';
 const stationed=old.map(gun=>({...clone(gun),stationed:true,...(occupied?{side:'enemy'}:{})}));
 request.artillery=[...stationed,...fresh];request.cannons=0;
 request.artilleryDeployment={version:1,site:site(request),issued:fresh.map(g=>g.id)};
 validateArtilleryDeployment(request);
 return request;
}
export function validateArtilleryDeployment(request){
 const marker=request?.artilleryDeployment;if(marker===undefined)return;
 need(marker&&marker.version===1&&marker.site===site(request)&&Array.isArray(marker.issued)&&new Set(marker.issued).size===marker.issued.length,'El registro de artillería desplegada es inválido.');
 need(Array.isArray(request.artillery)&&request.artillery.length<=2000&&new Set(request.artillery.map(g=>g.id)).size===request.artillery.length,'Las piezas desplegadas están duplicadas.');
 for(const g of request.artillery){
  need(g&&typeof g.id==='string'&&g.id.length>0&&g.id.length<=160&&ARTILLERY[g.type]&&['player','enemy'].includes(g.side)&&typeof g.loaded==='boolean'&&Number.isInteger(g.ammo)&&g.ammo>=0&&g.ammo<=1000000,'La pieza desplegada es inválida.');
  validateReloadProgress(g.reloadProgress,1,Number(g.loaded));
  need(g.stationed===true?Number.isInteger(g.x)&&Number.isInteger(g.y)&&g.x>=0&&g.y>=0:marker.issued.includes(g.id),'Falta el origen de la pieza desplegada.');
 }
 need(marker.issued.every(id=>request.artillery.some(g=>g.id===id&&!g.stationed)),'La entrega de artillería no coincide con las piezas.');
}
export function validateArtilleryReport(request,battle){
 if(!request.artilleryDeployment)return;
 validateArtilleryDeployment(request);
 need(battle.artillery.length===request.artillery.length,'El parte debe conservar todas las piezas de artillería.');
 for(const source of request.artillery){
  const actual=battle.artillery.find(g=>g.id===source.id);
  need(actual&&actual.type===source.type&&actual.side===source.side,'El parte cambia la identidad o el bando de una pieza.');
  need(actual.ammo+Number(actual.loaded)<=source.ammo+Number(source.loaded),'El parte crea munición de artillería.');
 }
}
export function settleSectorArtillery(snapshot,outcome){
 if(outcome==='victory')for(const gun of snapshot.artillery)gun.side='player';
 else if(['defeat','retreat'].includes(outcome)&&snapshot.units.some(u=>u.side==='enemy'&&u.hp>0&&!u.departure&&!u.routed&&!u.surrendered))for(const gun of snapshot.artillery)gun.side='enemy';
 for(const gun of snapshot.artillery)delete gun.stationed;
}
export function ownedArtilleryCount(s){
 return (s.resources.cannons??0)+Object.values(s.depots??{}).reduce((n,d)=>n+(d.cannons??0),0)+
 Object.entries(s.sectorStates??{}).filter(([id])=>s.sectors[parent(id)]?.owner==='patriot').reduce((n,[,b])=>n+(b.artillery??[]).filter(g=>g.side==='player').length,0);
}
const supplyCost=type=>({powder:type==='field8'?2:1,scrapIron:type==='field8'?2:1});
export function stationedArtillery(s){
 return Object.entries(s.sectorStates??{}).filter(([id])=>parent(id)===s.location).flatMap(([sector,battle])=>(battle.artillery??[]).map(gun=>({sector,gun})));
}
export function artillerySupplyPreview(s,sector,gunId,count=1,isSupplied=()=>false){
 const row=stationedArtillery(s).find(row=>row.sector===sector&&row.gun.id===gunId),cost=supplyCost(row?.gun.type),goods=Object.fromEntries(Object.entries(cost).map(([key,n])=>[key,n*count]));
 let reason=!row?'La pieza no está en este sector.':s.pendingBattle?'Termina el despliegue antes de entregar munición.':s.sectors[parent(sector)]?.owner!=='patriot'||row.gun.side!=='player'?'La pieza está en poder de los realistas.':
  !s.squad.some(id=>s.operativeState[id]?.alive&&!s.operativeState[id]?.captured&&!operativeInTransit(s,id)&&operativeLocation(s,id)===s.location)?'La escuadra debe estar presente.':
  !isSupplied(s,s.location)?'La entrega requiere una ruta de abastecimiento.':!Number.isInteger(count)||count<1||count>1000?'Indica una cantidad de 1 a 1000 municiones.':
  row.gun.ammo+count>1000000?'La pieza no puede recibir más municiones.':Object.entries(goods).some(([key,n])=>(s.resources[key]??0)<n)?'Faltan pólvora o hierro para preparar las municiones.':null;
 return {valid:!reason,reason,goods,count,gun:row?.gun,action:{type:'supplyArtillery',sector,gunId,count}};
}
export function supplyStationedArtillery(s,action,isSupplied){
 const plan=artillerySupplyPreview(s,action.sector,action.gunId,action.count??1,isSupplied);need(plan.valid,plan.reason);
 for(const [key,n]of Object.entries(plan.goods))s.resources[key]-=n;
 plan.gun.ammo+=plan.count;
 return plan;
}
