import {weaponMetadata,weaponSpecification,validateWeaponCarrier,contentWeaponOf} from './weapon-definition.js';

export const FORCE_EQUIPMENT = Object.freeze({
 oppositionEquipment: {label:'Enemigos',roles:{officer:'Oficiales enemigos',line:'Infantería enemiga',veteran:'Veteranos enemigos'},templates:{officer:1805,line:1800,veteran:1801}},
 militiaEquipment: {label:'Milicias',roles:{green:'Cívicos',regular:'Montoneros',veteran:'Soldados de línea'},templates:{green:1804,regular:1803,veteran:1801}},
});
export const MILITIA_EQUIPMENT_ROLES=['green','regular','veteran'];
export function defaultForceEquipment(field,weapons){
 return Object.fromEntries(Object.entries(FORCE_EQUIPMENT[field].templates).map(([role,template])=>[role,
  weapons ? (weapons.find(w=>w.id===`firearm-${template}`)??weapons.find(w=>w.template===template))?.id??null : `firearm-${template}`,
 ]));
}
export function validateForceEquipment(field,value,weaponIds){
 const group=FORCE_EQUIPMENT[field],roles=Object.keys(group.roles);
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==roles.length||!roles.every(role=>Object.hasOwn(value,role)))
  return [`${group.label}: elegí un arma para cada tipo de tropa.`];
 return roles.flatMap(role=>value[role]===null||weaponIds.has(value[role])?[]:[`${group.roles[role]}: el arma no existe.`]);
}
export function forceWeaponUsers(content,id){
 return Object.entries(FORCE_EQUIPMENT).flatMap(([field,group])=>Object.entries(group.roles).filter(([role])=>content[field]?.[role]===id).map(([,label])=>label));
}
// Only fresh soldiers pass here. Retained soldiers keep their physical equipment.
export function authoredForceEquipment(state,field,role,unit,cartridges){
 const content=state?.contentCampaign?.package,assignment=content?.[field];
 if(assignment===undefined)return unit;
 const result={...unit};delete result.weaponMetadata;delete result.contentWeapon;
 const id=assignment[role];
 if(id===null)return {...result,weapon:0,loaded:0,ammo:0,priming:0};
 const weapon=content.weapons.find(w=>w.id===id);
 if(!weapon)throw Error('El arma asignada a la tropa no existe.');
 const gear={weapon:weapon.template,weaponMetadata:weaponMetadata(weapon)};
 const loaded=Math.min(weaponSpecification(gear).capacity,cartridges);
 return {...result,...gear,loaded,ammo:cartridges-loaded};
}
export function validateForceWeapon(unit){
 validateWeaponCarrier(unit);
 if(contentWeaponOf(unit)&&(!Number.isSafeInteger(unit.loaded)||!Number.isSafeInteger(unit.ammo)||unit.ammo<0||unit.ammo>100000))
  throw Error('La munición guardada de la tropa no es válida.');
}
