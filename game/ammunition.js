import {cartridgePrice} from './campaign-rules.js';
import {weaponSpecification} from './weapon-definition.js';
import {retainedMilitaryBodies} from './military-remains.js';
import {AMMO_TYPES,migrateAmmoGround} from './ammo-types.js';
export function returnAmmunition(request,reports,snapshot,previous=null){
 let looted=0;
 if(snapshot){
  const enemies=request.exploration?[]:previous&&!previous.sectorCleared?previous.units.filter(u=>u.side==='enemy'):request.enemies??[];
  const bodies=retainedMilitaryBodies(previous,[...(request.squad??[]),...(request.garrison??[]),...(request.missionAllies??[]),...enemies],request.sector),counted=new Set();
  const count=(current,ammo,loaded)=>{if(!current||counted.has(current.id))return;counted.add(current.id);if(current.hp<=0||current.unconscious||current.routed)looted+=Math.max(0,ammo+loaded-(current.ammo??0)-(current.loaded??0));};
  for(const body of bodies)count(snapshot.units.find(u=>u.id===body.id&&(u.hp===0||u.unconscious)),body.ammo??0,body.loaded??0);
  for(const source of [...(request.garrison??[]),...(request.garrisonLootSources??[]),...(request.missionAllies??[])])count(snapshot.units.find(u=>(u.militia||u.missionAlly)&&String(u.id)===String(source.id)),source.ammo??0,source.loaded??0);
  for(const source of request.ammunitionSources??request.enemies??[])count(snapshot.units.find(u=>u.side==='enemy'&&String(u.id)===String(source.id)),source.ammo??12,source.loaded??weaponSpecification(source)?.capacity??0);
  // Retained bundles were not refunded when left behind. Credit only rounds
  // removed from an earlier finite source, once per identity and family.
  const groundIds=new Set(),ground=migrateAmmoGround(snapshot.groundItems);
  for(const source of migrateAmmoGround(previous?.groundItems)){
   if(!Object.hasOwn(AMMO_TYPES,source.type)||groundIds.has(source.id)||!Number.isSafeInteger(source.count)||source.count<0)continue;
   groundIds.add(source.id);
   const current=ground.find(g=>g.id===source.id);
   if(current&&current.type!==source.type)continue;
   const remaining=current?.count??0;
   if(!Number.isSafeInteger(remaining)||remaining<0)throw Error('La munición del suelo no es válida.');
   looted+=Math.max(0,source.count-remaining);
  }
 }
 let returned=0;
 for(const report of reports){
  if(report.hp<=0)continue;
  const issued=request.squad.find(o=>o.id===Number(report.id));if(!issued)continue;
  const count=Math.max(0,Math.floor(report.loaded??0))+Math.max(0,Math.floor(report.ammo??0));if(!Number.isFinite(count)||count>100000)throw Error('La munición del parte es inválida.');
  let matched=false;
  if(snapshot&&report.loaded!==undefined&&report.ammo!==undefined){const actual=snapshot.units.find(u=>u.side==='player'&&Number(u.id)===Number(report.id));if(actual&&(Number(actual.loaded??0)!==Number(report.loaded??0)||Number(actual.ammo??0)!==Number(report.ammo??0)))throw Error('El parte de munición no coincide con el sector.');matched=Boolean(actual);}
  // A witnessed handover can leave one survivor carrying another soldier's issue.
  // The total refund still cannot exceed the force's issued and actually looted rounds.
  returned+=Math.min(count,(matched?(request.issuedCartridges??0):(issued.loaded??0)+(issued.ammo??0))+looted);
 }
 return Math.min((request.issuedCartridges??0)+looted,returned);
}

// Keep quantity accounting independent from the campaign's pinned unit price.
export function ammunitionRefund(state,request,reports,snapshot,previous=null){
 const amount=returnAmmunition(request,reports,snapshot,previous)*cartridgePrice(state);
 if(!Number.isSafeInteger(amount)||amount<0||state.resources.treasury+amount>1000000000)throw Error('La tesorería no admite el valor de los cartuchos devueltos.');
 return amount;
}
