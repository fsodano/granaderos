import {ARTILLERY} from './tactical.js';
import {artilleryCount} from './economy.js';
import {expandCellScene} from './cell-scene-storage.js';
import {validateReloadProgress} from './weapon-reload.js';
const need=(ok,message)=>{if(!ok)throw Error(message);};
const site=r=>r.sceneId??r.sector;
const parent=id=>id==='san_lorenzo'?'san_nicolas':id;
const previous=(s,r)=>expandCellScene(r.sceneId?s.sceneStates?.[r.sceneId]:s.sectorStates?.[r.sector]);
const validGun=g=>g&&typeof g.id==='string'&&g.id.length>0&&g.id.length<=160&&Object.hasOwn(ARTILLERY,g.type)&&['player','enemy'].includes(g.side)&&typeof g.loaded==='boolean'&&Number.isInteger(g.ammo)&&g.ammo>=0&&g.ammo<=1000000;
const list=values=>{need(Array.isArray(values)&&values.length<=2000&&new Set(values.map(g=>g?.id)).size===values.length&&values.every(validGun),'Las piezas de artillería son inválidas.');for(const g of values)validateReloadProgress(g.reloadProgress,1,Number(g.loaded));return values;};
const nextId=s=>`piece-${s.nextArtilleryId++}`;

// Older artillery was a reusable stock projection. Reconcile repeated snapshots
// against paid stock once, taking an active battery first and then the most
// recent observed pieces. Never turn historical copies into extra owned guns.
export function migrateArtilleryState(s){
 if(s.artilleryVersion!==undefined)return;
 s.nextArtilleryId=1;const available={...s.armory};
 const take=gun=>{if((available[gun.type]??0)<=0)return false;available[gun.type]--;return true;};
 const r=s.pendingBattle;
 if(r){const guns=list(r.artillery??[]);for(const gun of guns)need(take(gun),'La batería anterior no coincide con las piezas compradas.');r.artillery=structuredClone(guns);r.cannons=guns.length;r.artilleryDeployment={version:1,site:site(r),issued:guns.map(g=>g.id)};}
 const scenes=[...Object.entries(s.sectorStates??{}),...Object.entries(s.sceneStates??{})].sort((a,b)=>(b[1].savedHour??b[1].enteredHour??0)-(a[1].savedHour??a[1].enteredHour??0)||(b[1].savedSecond??0)-(a[1].savedSecond??0)||a[0].localeCompare(b[0]));
 for(const [id,b]of scenes){const guns=list(b.artillery??[]);b.artillery=id===site(r??{})?[]:guns.filter(g=>g.side==='enemy'||take(g)).map(g=>({...g,id:nextId(s)}));}
 for(const type of Object.keys(ARTILLERY))if(Object.hasOwn(s.armory??{},type))s.armory[type]=available[type];
 s.artilleryVersion=1;
}
export function prepareSectorArtillery(s,request){
 migrateArtilleryState(s);
 if(request.artilleryDeployment?.site===site(request))return request;
 const fresh=structuredClone(list(request.artillery??[])),old=structuredClone(list(previous(s,request)?.artillery??[]));
 for(const gun of fresh){need((s.armory?.[gun.type]??0)>0,'No quedan esas piezas en la armería.');s.armory[gun.type]--;gun.id=nextId(s);delete gun.stationed;}
 const occupied=s.sectors[parent(request.sector)]?.owner==='royalist';
 const stationed=old.map(g=>({...g,stationed:true,...(occupied?{side:'enemy'}:{})}));
 request.artillery=[...stationed,...fresh];request.cannons=request.artillery.length;request.artilleryDeployment={version:1,site:site(request),issued:fresh.map(g=>g.id)};
 validateArtilleryDeployment(request);return request;
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
 if(!request.artillery.length&&!battle)return;
 need(battle&&Array.isArray(battle.artillery)&&battle.artillery.length===request.artillery.length,'El parte debe conservar todas las piezas de artillería.');list(battle.artillery);
 for(const source of request.artillery){const actual=battle.artillery.find(g=>g.id===source.id);need(actual&&actual.type===source.type&&actual.side===source.side,'El parte cambia la identidad o el bando de una pieza.');need(actual.ammo+Number(actual.loaded)<=source.ammo+Number(source.loaded),'El parte crea munición de artillería.');}
}
export function settleSectorArtillery(snapshot,outcome){
 if(!snapshot)return;
 if(outcome==='victory')for(const gun of snapshot.artillery)gun.side='player';
 else if(['defeat','retreat'].includes(outcome)&&snapshot.units.some(u=>u.side==='enemy'&&u.hp>0&&!u.departure&&!u.routed&&!u.surrendered))for(const gun of snapshot.artillery)gun.side='enemy';
 for(const gun of snapshot.artillery)delete gun.stationed;
}
export function ownedArtilleryCount(s){
 const owned=new Map();for(const [id,b]of Object.entries(s.sectorStates??{}))if(s.sectors[parent(id)]?.owner==='patriot')for(const g of b.artillery??[])if(g.side==='player')owned.set(g.id,g);
 if(s.pendingBattle)for(const g of s.pendingBattle.artillery??[])if(g.side==='player')owned.set(g.id,g);else owned.delete(g.id);
 return artilleryCount(s)+owned.size;
}
export function validateCampaignArtillery(s){
 need(s.artilleryVersion===1&&Number.isSafeInteger(s.nextArtilleryId)&&s.nextArtilleryId>=1&&s.nextArtilleryId<=1e9,'El registro de piezas es inválido.');const ids=new Set();
 for(const b of [...Object.values(s.sectorStates??{}),...Object.values(s.sceneStates??{})])for(const g of list(b.artillery??[])){if(/^piece-[1-9][0-9]*$/.test(g.id))need(Number(g.id.slice(6))<s.nextArtilleryId,'La secuencia de piezas es inválida.');need(!ids.has(g.id),'Una pieza no puede estar en dos sectores.');ids.add(g.id);}
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
