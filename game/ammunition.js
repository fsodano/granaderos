import {isAmmunitionStack,totalReserveAmmunition,weaponAmmoType} from './ammunition-types.js';
import {addAmmoCounts,totalAmmoCounts,unitAmmunitionByType,stackAmmunitionByType,fieldAmmunitionByType} from './campaign-ammunition.js';
import {handLayout} from './hand-layout.js';
import {WEAPONS} from './data.js';

// Ammunition already on the field is separate from newly issued cartridges.
// Count loose rounds and charges in finite ground weapons and containers.
export function fieldAmmunition(snapshot){return totalAmmoCounts(fieldAmmunitionByType(snapshot));}
export function storedWeaponAmmunition(units){
 return units.reduce((sum,u)=>sum+[u.offHand,u.equipmentCursor?.stack,...Object.values(u.inventory??{}).filter(item=>!isAmmunitionStack(item))].reduce((n,item)=>n+totalAmmoCounts(stackAmmunitionByType(item)),0),0);
}
export function cursorAmmunition(unit){return totalAmmoCounts(stackAmmunitionByType(unit?.equipmentCursor?.stack));}
export function ammunitionSource(unit){return {id:unit.id,side:unit.side,weapon:unit.weapon,ammo:unit.ammo??0,loaded:unit.loaded??0,ammunitionByType:unitAmmunitionByType(unit)};}
const recoveredEquipmentAmmunition=(request,snapshot)=>{
 const ids=new Set((request.squad??[]).map(u=>String(u.id))),carriers=(snapshot?.units??[]).filter(u=>u.side==='player'&&ids.has(String(u.id)));
 // Net field gear, pack charges and cursor rounds together. Moving the same
 // cartridges between these owners cannot produce another allowance.
 return Math.max(0,(request.fieldCartridges??0)+(request.storedCartridges??0)-fieldAmmunition(snapshot)-storedWeaponAmmunition(carriers));
};

export function returnAmmunition(request,reports,snapshot){
 let looted=snapshot?recoveredEquipmentAmmunition(request,snapshot):0;
 if(snapshot){
  for(const source of [...(request.garrison??[]),...(request.garrisonLootSources??[]),...(request.missionAllies??[])]){const current=snapshot.units.find(u=>(u.militia||u.missionAlly)&&String(u.id)===String(source.id));if(current&&(current.hp<=0||current.unconscious||current.routed))looted+=Math.max(0,(source.ammo??0)+(source.loaded??0)-(current.ammo??0)-(current.loaded??0));}
  for(const source of request.ammunitionSources??request.enemies??[]){const current=snapshot.units.find(u=>u.side==='enemy'&&String(u.id)===String(source.id));if(current&&(current.hp<=0||current.unconscious||current.routed))looted+=Math.max(0,(source.ammo??12)-(current.ammo??0));}
 }
 let returned=0;
 for(const report of reports){
  if(report.hp<=0)continue;
  const issued=request.squad.find(o=>o.id===Number(report.id));if(!issued)continue;
  const count=Math.max(0,Math.floor(report.loaded??0))+Math.max(0,Math.floor(report.ammo??0));if(!Number.isFinite(count)||count>100000)throw Error('La munición del parte es inválida.');
  if(snapshot&&report.loaded!==undefined&&report.ammo!==undefined){const actual=snapshot.units.find(u=>u.side==='player'&&Number(u.id)===Number(report.id));if(actual&&(Number(actual.loaded??0)!==Number(report.loaded??0)||Number(actual.ammo??0)!==Number(report.ammo??0)))throw Error('El parte de munición no coincide con el sector.');}
  returned+=Math.min(count,(issued.loaded??0)+(issued.ammo??0)+looted);
 }
 return Math.min((request.issuedCartridges??0)+looted,returned);
}

// Each prepared load has one budget across every destination and field owner.
// Captive ammunition stays with its owner and never also credits shared stock.
export function planReturnAmmunition(request,snapshot,entries){
 const allowance={};
 for(const issued of request.squad??[])addAmmoCounts(allowance,unitAmmunitionByType(issued));
 addAmmoCounts(allowance,request.fieldAmmunition??{});addAmmoCounts(allowance,fieldAmmunitionByType(snapshot),-1);
 const sources=[...(request.garrison??[]),...(request.garrisonLootSources??[]),...(request.missionAllies??[]),...(request.casualtyLootSources??[]),...(request.ammunitionSources??request.enemies??[])],seen=new Set();
 for(const source of sources){
  const side=source.side??((request.enemies??[]).includes(source)||(request.ammunitionSources??[]).includes(source)?'enemy':'player'),key=`${side}:${source.id}`;
  if(seen.has(key))continue;seen.add(key);
  const actual=snapshot.units.find(u=>u.side===side&&String(u.id)===String(source.id));
  if(actual){addAmmoCounts(allowance,source.ammunitionByType??unitAmmunitionByType(source));addAmmoCounts(allowance,unitAmmunitionByType(actual),-1);}
 }
 const custody={},carried={},retained={};
 for(const entry of entries){
  const unit=snapshot.units.find(u=>u.side==='player'&&String(u.id)===entry.unitId);
  if(!unit)throw Error('Falta el combatiente en el parte de munición.');
  // A corpse or dispersed soldier remains a physical custodian. Its rounds
  // cannot also return in another survivor's inventory.
  addAmmoCounts(retained,unitAmmunitionByType(unit));
  const keepsGun=!unit.weaponDropped&&Boolean(weaponAmmoType(unit.weapon));
  if(entry.kind==='captured')custody[entry.unitId]={loaded:unit.loaded,ammo:totalReserveAmmunition(unit),...(keepsGun?{preserveLoading:true,...(unit.reloadProgress?{reloadProgress:unit.reloadProgress}:{})}:{})};
  if(keepsGun&&['resident','departed'].includes(entry.kind))carried[entry.unitId]={loaded:unit.loaded,...(unit.reloadProgress?{reloadProgress:unit.reloadProgress}:{})};
 }
 for(const type of new Set([...Object.keys(retained),...Object.keys(allowance)]))if((retained[type]??0)>(allowance[type]??0))throw Error('El parte devuelve más munición de ese tipo que la disponible en el despliegue.');
 // Loose rounds remain in the same physical inventory. A return report is not
 // a deposit order and cannot also credit those rounds to shared stock.
 return {creditedCartridges:0,creditedAmmunition:{},custody,carried,retainedAmmunition:retained};
}
