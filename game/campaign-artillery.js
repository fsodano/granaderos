import {migrateMerchantWallets} from './equipment-merchants.js';
import {initializeFiniteArtilleryArsenals,prepareFiniteArsenalRequest,finiteArsenalReportPieces,validateFiniteArtilleryArsenals} from './finite-artillery-arsenals.js';
import {ARTILLERY} from './artillery-definitions.js';
import {artilleryTransportPath,storedArtilleryRecord,artilleryCargoWeight,ARTILLERY_TRANSPORT_CAPACITY,validateArtilleryTransport} from './artillery-transport.js';
import {artilleryTransportRules} from './artillery-transport-rules.js';
import {artillerySupplyQuote} from './artillery-supply.js';
import {artilleryCount} from './economy.js';
import {expandCellScene} from './cell-scene-storage.js';
import {validateReloadProgress} from './weapon-reload.js';
const need=(ok,message)=>{if(!ok)throw Error(message);};
const site=r=>r.sceneId??r.sector;
const parent=id=>id==='san_lorenzo'?'san_nicolas':id;
const previous=(s,r)=>expandCellScene(r.sceneId?s.sceneStates?.[r.sceneId]:s.sectorStates?.[r.sector]);
const validGun=g=>g&&typeof g.id==='string'&&g.id.length>0&&g.id.length<=160&&Object.hasOwn(ARTILLERY,g.type)&&['player','enemy'].includes(g.side)&&typeof g.loaded==='boolean'&&Number.isInteger(g.ammo)&&g.ammo>=0&&g.ammo<=1000000&&(g.facing===undefined||Number.isFinite(g.facing)&&Math.abs(g.facing)<=Math.PI*2);
const list=values=>{need(Array.isArray(values)&&values.length<=2000&&new Set(values.map(g=>g?.id)).size===values.length&&values.every(validGun),'Las piezas de artillería son inválidas.');for(const g of values)validateReloadProgress(g.reloadProgress,1,Number(g.loaded));return values;};
export {list as validateArtilleryInventory};
const nextId=s=>{need(Number.isSafeInteger(s.nextArtilleryId)&&s.nextArtilleryId>=1&&s.nextArtilleryId<1e9,'La secuencia de piezas está agotada.');return `piece-${s.nextArtilleryId++}`;};

// Older artillery was a reusable stock projection. Reconcile repeated snapshots
// against paid stock once, taking an active battery first and then the most
// recent observed pieces. Never turn historical copies into extra owned guns.
export function migrateArtilleryState(s){
 initializeFiniteArtilleryArsenals(s);
 if(s.artilleryVersion===1&&s.artilleryCustodyVersion===1){migrateArtilleryCustody(s);return s;}
 const next=structuredClone(s);if(s.contentCampaign)next.contentCampaign=s.contentCampaign;migrateArtilleryStateValue(next);
 for(const key of Object.keys(s))if(!Object.hasOwn(next,key))delete s[key];Object.assign(s,next);return s;
}
function migrateArtilleryStateValue(s){
 if(s.artilleryVersion!==undefined){need(s.artilleryVersion===1,'El registro de piezas es inválido.');migrateArtilleryCustody(s);return;}
 // The advanced campaign already depleted stock when it placed physical guns.
 // Its fitting marker and former cannon reserve distinguish it from the older
 // published projection. Never pay for those deployed pieces a second time.
 if(s.fittingRulesVersion===1&&Object.hasOwn(s.resources??{},'cannons')){
  const total=s.resources.cannons,field8=s.armory?.field8??0,swivel=s.armory?.swivel??0;
  need(Number.isSafeInteger(total)&&total>=0&&total<=100000&&[field8,swivel].every(n=>Number.isSafeInteger(n)&&n>=0)&&field8+swivel<=total,'Las existencias antiguas de artillería son inválidas.');
  const ids=[...Object.values(s.sectorStates??{}),...Object.values(s.sceneStates??{}),s.pendingBattle,...(s.convoys??[])].filter(Boolean).flatMap(b=>b.artillery??[]);
  ids.push(...Object.values(s.artilleryStores??{}).flat(),...Object.values(s.merchants??{}).flatMap(m=>m.usedArtillery??[]));
  s.nextArtilleryId=1+Math.max(0,...ids.map(g=>/^piece-[1-9][0-9]*$/.test(g.id)?Number(g.id.slice(6)):0));
  s.armory={...s.armory,bronze4:total-field8-swivel,field8,swivel};delete s.resources.cannons;
  for(const [at,depot]of Object.entries(s.depots??{}))if(Object.hasOwn(depot,'cannons')){
   const count=depot.cannons;need(Number.isSafeInteger(count)&&count>=0&&count<=2000,'El depósito antiguo de cañones es inválido.');
   s.artilleryStores??={};s.artilleryStores[at]??=[];
   for(let i=0;i<count;i++)s.artilleryStores[at].push({id:nextId(s),type:'bronze4',side:'player',loaded:true,ammo:6});delete depot.cannons;
  }
  if(s.pendingBattle){need(s.pendingBattle.artilleryDeployment||!(s.pendingBattle.artillery??[]).length,'Falta el origen de la batería antigua.');s.pendingBattle.artilleryDeployment??={version:1,site:site(s.pendingBattle),issued:[]};s.pendingBattle.cannons=(s.pendingBattle.artillery??[]).length;}
  s.artilleryVersion=1;migrateArtilleryCustody(s);return;
 }
 s.nextArtilleryId=1;const available={...s.armory};
 const take=gun=>{if((available[gun.type]??0)<=0)return false;available[gun.type]--;return true;};
 const r=s.pendingBattle;
 if(r){const guns=list(r.artillery??[]);for(const gun of guns)need(take(gun),'La batería anterior no coincide con las piezas compradas.');r.artillery=structuredClone(guns);r.cannons=guns.length;r.artilleryDeployment={version:1,site:site(r),issued:guns.map(g=>g.id)};}
 const scenes=[...Object.entries(s.sectorStates??{}),...Object.entries(s.sceneStates??{})].sort((a,b)=>(b[1].savedHour??b[1].enteredHour??0)-(a[1].savedHour??a[1].enteredHour??0)||(b[1].savedSecond??0)-(a[1].savedSecond??0)||a[0].localeCompare(b[0]));
 for(const [id,b]of scenes){const guns=list(b.artillery??[]);b.artillery=id===site(r??{})?[]:guns.filter(g=>g.side==='enemy'||take(g)).map(g=>({...g,id:nextId(s)}));}
 for(const type of Object.keys(ARTILLERY))if(Object.hasOwn(s.armory??{},type))s.armory[type]=available[type];
 s.artilleryVersion=1;migrateArtilleryCustody(s);
}
export function prepareSectorArtillery(s,request){
 const current=request===s.pendingBattle;migrateArtilleryState(s);if(current)request=s.pendingBattle;
 if(request.artilleryDeployment?.site===site(request))return request;
 prepareFiniteArsenalRequest(s,request);
 const fresh=structuredClone(list(request.artillery??[])),old=structuredClone(list(previous(s,request)?.artillery??[]));
 const stockState={...s,armory:{...s.armory},artilleryDepots:structuredClone(s.artilleryDepots??{})};
 for(const gun of fresh){
  if(gun.fromDepot){
   const at=request.origin??s.location,stock=stockState.artilleryDepots?.[at]??[],index=stock.findIndex(g=>g.id===gun.id),original=stock[index];
   need(gun.fromDepot===at&&s.sectors[at]?.owner==='patriot'&&original&&['type','side','loaded','ammo','reloadProgress','facing'].every(key=>gun[key]===original[key]),'La pieza seleccionada no coincide con el depósito local.');stock.splice(index,1);delete gun.fromDepot;
  }else{need((stockState.armory?.[gun.type]??0)>0,'No quedan esas piezas en la armería.');stockState.armory[gun.type]--;gun.id=nextId(stockState);}
  delete gun.stationed;
 }
 const occupied=s.sectors[parent(request.sector)]?.owner==='royalist';
 const stationed=old.map(g=>({...g,stationed:true,...(occupied?{side:'enemy'}:{})}));
 const planned={...request,artillery:[...stationed,...fresh],cannons:stationed.length+fresh.length,artilleryDeployment:{version:1,site:site(request),issued:fresh.map(g=>g.id)}};
 validateArtilleryDeployment(planned);s.armory=stockState.armory;s.artilleryDepots=stockState.artilleryDepots;s.nextArtilleryId=stockState.nextArtilleryId;Object.assign(request,planned);return request;
}
export function validateArtilleryDeployment(request){
 const marker=request?.artilleryDeployment;
 need(marker&&marker.version===1&&marker.site===site(request)&&Array.isArray(marker.issued)&&marker.issued.every(id=>typeof id==='string')&&new Set(marker.issued).size===marker.issued.length,'El registro de artillería desplegada es inválido.');
 const guns=list(request.artillery);
 for(const gun of guns)need(gun.stationed===true?Number.isInteger(gun.x)&&Number.isInteger(gun.y)&&gun.x>=0&&gun.y>=0:marker.issued.includes(gun.id),'Falta el origen de la pieza desplegada.');
 need(marker.issued.every(id=>guns.some(g=>g.id===id&&!g.stationed)),'La entrega de artillería no coincide con las piezas.');
}
export function validateArtilleryReport(request,battle){
 if(!request?.artilleryDeployment)return;
 validateArtilleryDeployment(request);
 if(!request.artillery.length&&!battle&&!request.finiteArtilleryArsenal)return;
 const recovered=finiteArsenalReportPieces(request,battle);
 need(battle&&Array.isArray(battle.artillery)&&battle.artillery.length===request.artillery.length+recovered.length,'El parte debe conservar todas las piezas de artillería.');list(battle.artillery);
 for(const source of request.artillery){const actual=battle.artillery.find(g=>g.id===source.id);need(actual&&actual.type===source.type&&actual.side===source.side,'El parte cambia la identidad o el bando de una pieza.');need(actual.ammo+Number(actual.loaded)<=source.ammo+Number(source.loaded),'El parte crea munición de artillería.');}
}
export function settleSectorArtillery(snapshot,outcome){
 if(!snapshot)return;
 if(outcome==='victory')for(const gun of snapshot.artillery)gun.side='player';
 else if(['defeat','retreat'].includes(outcome)&&snapshot.units.some(u=>u.side==='enemy'&&u.hp>0&&!u.departure&&!u.routed&&!u.surrendered))for(const gun of snapshot.artillery)gun.side='enemy';
 for(const gun of snapshot.artillery)delete gun.stationed;
}
export function ownedArtilleryCount(s){
 const owned=new Map();for(const [id,b]of [...Object.entries(s.sectorStates??{}),...Object.entries(s.sceneStates??{})])if(s.sectors[parent(b.sectorId??id)]?.owner==='patriot')for(const g of b.artillery??[])if(g.side==='player')owned.set(g.id,g);
 if(s.pendingBattle)for(const g of s.pendingBattle.artillery??[])if(g.side==='player')owned.set(g.id,g);else owned.delete(g.id);
 for(const [at,guns]of Object.entries(s.artilleryDepots??{}))if(s.sectors[at]?.owner==='patriot')for(const g of guns)owned.set(g.id,g);
 for(const t of s.artilleryTransfers??[])owned.set(t.gun.id,t.gun);
 return artilleryCount(s)+owned.size;
}
export function validateCampaignArtillery(s){
 validateFiniteArtilleryArsenals(s);
 if(s.artilleryCustodyVersion!==undefined)need(s.artilleryCustodyVersion===1&&s.artilleryStores===undefined&&!(s.convoys??[]).some(c=>c.artillery!==undefined)&&!Object.values(s.merchants??{}).some(m=>m.usedArtillery!==undefined),'La artillería mezcla propietarios de dos versiones.');
 need(s.artilleryVersion===1&&Number.isSafeInteger(s.nextArtilleryId)&&s.nextArtilleryId>=1&&s.nextArtilleryId<=1e9,'El registro de piezas es inválido.');const ids=new Set();
 for(const b of [...Object.values(s.sectorStates??{}),...Object.values(s.sceneStates??{}),...Object.values(s.artilleryDepots??{}).map(artillery=>({artillery})),...(s.artilleryTransfers??[]).map(t=>({artillery:[t.gun]})),...Object.values(s.artilleryMerchants??{}).map(shop=>({artillery:shop.guns}))])for(const g of list(b.artillery??[])){if(/^piece-[1-9][0-9]*$/.test(g.id))need(Number(g.id.slice(6))<s.nextArtilleryId,'La secuencia de piezas es inválida.');need(!ids.has(g.id),'Una pieza no puede estar en dos sectores.');ids.add(g.id);}
 if(s.pendingBattle){
  const r=s.pendingBattle;validateArtilleryDeployment(r);
  for(const id of r.artilleryDeployment.issued){need(!ids.has(id),'Una pieza desplegada ya existe en otro sector.');if(/^piece-[1-9][0-9]*$/.test(id))need(Number(id.slice(6))<s.nextArtilleryId,'La secuencia de piezas es inválida.');}
  const old=list(previous(s,r)?.artillery??[]),occupied=s.sectors[parent(r.sector)]?.owner==='royalist';
  for(const g of r.artillery.filter(g=>g.stationed)){const source=old.find(v=>v.id===g.id);need(source&&g.type===source.type&&g.side===(occupied?'enemy':source.side)&&g.ammo===source.ammo&&g.loaded===source.loaded&&g.x===source.x&&g.y===source.y&&g.facing===source.facing&&g.reloadProgress===source.reloadProgress,'La pieza emplazada no coincide con su sector.');}
  need(old.every(g=>r.artillery.some(v=>v.id===g.id&&v.stationed)),'Faltan piezas emplazadas en el despliegue.');
 }
}
export function stationedArtillery(s){return Object.entries(s.sectorStates??{}).filter(([id])=>parent(id)===s.location).flatMap(([sector,b])=>(b.artillery??[]).map(gun=>({sector,gun})));
}


function migrateArtilleryCustody(s){
 const oldConvoys=(s.convoys??[]).filter(c=>c.artillery!==undefined),oldMerchants=Object.entries(s.merchants??{}).filter(([,m])=>m.usedArtillery!==undefined);
 if(s.artilleryCustodyVersion!==undefined){need(s.artilleryCustodyVersion===1&&s.artilleryStores===undefined&&!oldConvoys.length&&!oldMerchants.length,'La artillería mezcla propietarios de dos versiones.');return;}
 const depots=structuredClone(s.artilleryDepots??{}),transfers=structuredClone(s.artilleryTransfers??[]),shops=structuredClone(s.artilleryMerchants??{});
 for(const [at,guns]of Object.entries(s.artilleryStores??{})){list(guns);need(guns.every(g=>g.side==='player'),'El depósito antiguo contiene una pieza enemiga.');depots[at]=[...(depots[at]??[]),...structuredClone(guns)];}
 for(const [at,merchant]of oldMerchants){list(merchant.usedArtillery);need(merchant.usedArtillery.every(g=>g.side==='player'),'El comerciante conserva una pieza enemiga.');shops[at]??={guns:[]};shops[at].guns.push(...structuredClone(merchant.usedArtillery));}
 for(const convoy of oldConvoys){
  need(Array.isArray(convoy.artillery)&&convoy.artillery.length===1&&convoy.goods&&Object.keys(convoy.goods).length===1&&convoy.goods.cannons===1,'El convoy antiguo de artillería es inválido.');
  list(convoy.artillery);const gun=storedArtilleryRecord(convoy.artillery[0]),path=artilleryTransportPath(s,convoy.source,convoy.destination,convoy.mode,{ignoreControl:true});
  need(['carts','flotilla'].includes(convoy.mode)&&path&&path.length>1&&gun.side==='player'&&artilleryCargoWeight(gun)<=ARTILLERY_TRANSPORT_CAPACITY[convoy.mode],'La ruta antigua de artillería es inválida.');
  const duration=(path.length-1)*artilleryTransportRules(s)[`${convoy.mode}Hours`],departedAt=convoy.due-duration;
  need(Number.isSafeInteger(convoy.due)&&convoy.due<=1e9&&departedAt>=0&&departedAt<=s.hour,'El plazo antiguo de artillería es inválido.');
  transfers.push({id:gun.id,from:convoy.source,to:convoy.destination,mode:convoy.mode,path,departedAt,dueAt:convoy.due,gun});
 }
 // Check duplicate custody before removing any of the old lists.
 const trial={...s,artilleryDepots:depots,artilleryTransfers:transfers,artilleryMerchants:shops};migrateMerchantWallets(trial);validateArtilleryTransport(trial);validateCampaignArtillery(trial);
 s.artilleryDepots=depots;s.artilleryTransfers=transfers;s.artilleryMerchants=trial.artilleryMerchants;s.merchants=trial.merchants;s.merchantWalletVersion=trial.merchantWalletVersion;s.artilleryCustodyVersion=1;delete s.artilleryStores;
 if(oldConvoys.length)s.convoys=s.convoys.filter(c=>c.artillery===undefined);
 for(const [at]of oldMerchants)delete s.merchants[at].usedArtillery;
}

// The older interface requests a batch. Each round uses the same configured
// price and reserve limit as the editor-backed single-round control.
export function artillerySupplyPreview(s,sector,gunId,count=1,isSupplied=()=>false){
 const q=artillerySupplyQuote(s,sector,gunId,isSupplied(s,s.location)),gun=s.sectorStates?.[sector]?.artillery?.find(g=>g.id===gunId),cost=q.cost*count;
 const reason=q.reason||(!Number.isSafeInteger(count)||count<1||count>1000?'Indicá entre 1 y 1000 municiones.':gun.ammo+count>q.limit?'La reserva de la pieza supera el límite de reposición.':s.resources.treasury<cost?'No hay suficientes pesos.':null);
 return {...q,valid:!reason,available:!reason,reason,count,gun,cost,goods:{treasury:cost},action:{type:'supplyArtillery',sector,gunId,count}};
}
export function supplyStationedArtillery(s,action,isSupplied){
 const plan=artillerySupplyPreview(s,action.sector,action.gunId??action.artilleryId,action.count??1,isSupplied);need(plan.valid,plan.reason);s.resources.treasury-=plan.cost;plan.gun.ammo+=plan.count;return plan;
}
