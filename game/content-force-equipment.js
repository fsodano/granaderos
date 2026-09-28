import {weaponMetadata,weaponSpecification,validateWeaponCarrier,contentWeaponOf} from './weapon-definition.js';

export const FORCE_EQUIPMENT = Object.freeze({
 oppositionEquipment: {label:'Enemigos',bladeField:'oppositionBlades',bladeTemplates:{officer:1809,line:1811,veteran:1811},roles:{officer:'Oficiales enemigos',line:'Infantería enemiga',veteran:'Veteranos enemigos'},templates:{officer:1805,line:1800,veteran:1801}},
 militiaEquipment: {label:'Milicias',bladeField:'militiaBlades',bladeTemplates:{green:1813,regular:1812,veteran:1811},roles:{green:'Cívicos',regular:'Montoneros',veteran:'Soldados de línea'},templates:{green:1804,regular:1803,veteran:1801}},
});
export const MILITIA_EQUIPMENT_ROLES=['green','regular','veteran'];
export function defaultForceEquipment(field,weapons){
 return Object.fromEntries(Object.entries(FORCE_EQUIPMENT[field].templates).map(([role,template])=>[role,
  weapons ? (weapons.find(w=>w.id===`firearm-${template}`)??weapons.find(w=>w.template===template))?.id??null : `firearm-${template}`,
 ]));
}
export function defaultForceBlades(field,weapons){
 return Object.fromEntries(Object.entries(FORCE_EQUIPMENT[field].bladeTemplates).map(([role,template])=>[role,weapons?(weapons.find(w=>w.id===`blade-${template}`)??weapons.find(w=>w.template===template))?.id??null:`blade-${template}`]));
}
export function validateForceEquipment(field,value,weaponIds){
 const group=FORCE_EQUIPMENT[field],roles=Object.keys(group.roles);
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==roles.length||!roles.every(role=>Object.hasOwn(value,role)))
  return [`${group.label}: elegí un arma para cada tipo de tropa.`];
 return roles.flatMap(role=>value[role]===null||weaponIds.has(value[role])?[]:[`${group.roles[role]}: el arma no existe.`]);
}
export function forceWeaponUsers(content,id){
 return Object.entries(FORCE_EQUIPMENT).flatMap(([field,group])=>Object.entries(group.roles).flatMap(([role,label])=>[...(content[field]?.[role]===id?[label]:[]),...(content[group.bladeField]?.[role]===id?[`${label} · arma blanca`]:[])]));
}
// Only fresh soldiers pass here. Retained soldiers keep their physical equipment.
export function authoredForceEquipment(state,field,role,unit,cartridges){
 const content=state?.contentCampaign?.package,assignment=content?.[field];
 let result={...unit};
 if(assignment!==undefined){
  delete result.weaponMetadata;delete result.contentWeapon;
  const id=assignment[role],weapon=id===null?null:content.weapons.find(w=>w.id===id);
  if(id!==null&&!weapon)throw Error('El arma asignada a la tropa no existe.');
  const gear=weapon?{weapon:weapon.template,weaponMetadata:weaponMetadata(weapon)}:{weapon:0};
  result={...result,...gear};
 }
 const capacity=weaponSpecification(result)?.capacity??0,loaded=Math.min(capacity,cartridges);
 result={...result,loaded,ammo:capacity?cartridges-loaded:0,...(capacity?{}:{priming:0})};
 const blades=content?.[FORCE_EQUIPMENT[field].bladeField],id=blades?.[role];
 // A null secondary assignment retains the original role's blade.
 if(id!==undefined&&id!==null){
  const blade=content.weapons.find(w=>w.id===id);if(!blade)throw Error('El arma blanca de la tropa no existe.');
  result={...result,blade:blade.template,bladeMetadata:weaponMetadata(blade)};
 }
 return result;
}
export function validateForceWeapon(unit){
 validateWeaponCarrier(unit);
 if(contentWeaponOf(unit)&&(!Number.isSafeInteger(unit.loaded)||!Number.isSafeInteger(unit.ammo)||unit.ammo<0||unit.ammo>100000))
  throw Error('La munición guardada de la tropa no es válida.');
}
