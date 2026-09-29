// Gameplay tuning for alternative smoothbore loads. These are not historical
// ballistic measurements. Campaign content can replace or remove each list.
const shot=(damage,range)=>Object.freeze([{family:'ammoShot',damage,range,pattern:'cone'}]);
const ball=(damage,range)=>Object.freeze([{family:'ammoMusket',damage,range,pattern:'single'}]);
export const DEFAULT_ALTERNATIVE_LOADS=Object.freeze({1800:shot(28,6),1801:shot(26,6),1803:shot(22,5),1804:ball(35,10),1805:shot(14,3),1806:shot(12,3),1807:ball(32,8),1808:shot(14,3)});
export const firearmId=value=>{const raw=typeof value==='object'&&value!==null?value.weapon??value.primary??value.template??value.id:value;return typeof raw==='object'?raw.id:raw;};
export const loadDefinition=value=>value?.contentWeapon??value?.weaponMetadata?.contentWeapon??value;
export function alternativeLoadsFor(value){
 const definition=loadDefinition(value);
 // An authored primary-family override never inherits an incompatible default.
 return definition?.alternativeLoads??(definition?.ammunitionFamily===undefined?(DEFAULT_ALTERNATIVE_LOADS[firearmId(value)]??[]):[]);
}
