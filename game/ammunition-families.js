// Shared gameplay families. Historical caliber keys remain migration identifiers.
/**
 * @param {string} id
 * @param {string} type
 * @param {string} name
 * @param {string} art
 * @param {string} description
 * @param {number[]} weapons
 * @param {string[]} legacyTypes
 */
const family = (id, type, name, art, description, weapons, legacyTypes) => Object.freeze({
  id, type, name, art, description, weapons:Object.freeze(weapons), legacyTypes:Object.freeze(legacyTypes),
});
export const AMMUNITION_FAMILIES = Object.freeze({
  ammoMusket:family('ammoMusket','musket_75','Cartuchos de mosquete','/art/supplies/ammo-v1.webp','Munición para mosquetes y tercerolas.',[1800,1801,1803],['musket_75','musket_69','carbine_65']),
  ammoRifle:family('ammoRifle','rifle_62','Munición de fusil','/art/supplies/ammo-rifle-v1.webp','Bala con parche para fusiles de precisión.',[1802],['rifle_62']),
  ammoPistol:family('ammoPistol','pistol_69','Cartuchos de pistola','/art/supplies/ammo-pistol-v1.webp','Munición para pistolas de uno o dos cañones.',[1805,1806,1808],['pistol_69','pistol_50','pistol_54']),
  ammoShot:family('ammoShot','shot_16','Cargas de perdigones','/art/supplies/ammo-shot-v1.webp','Munición de perdigones para escopetas y trabucos.',[1804,1807],['shot_16','scatter']),
});
export const LEGACY_AMMUNITION = Object.freeze(Object.fromEntries([
  ['musket_75','Cartucho de mosquete .75',1800],['musket_69','Cartucho de mosquete .69',1801],
  ['rifle_62','Cartucho de fusil .62 con parche',1802],['carbine_65','Cartucho de tercerola .65',1803],
  ['shot_16','Carga de perdigones calibre 16',1804],['pistol_69','Cartucho de pistola .69',1805],
  ['pistol_50','Cartucho de pistola .50',1806],['scatter','Carga de metralla para trabuco',1807],
  ['pistol_54','Cartucho de pistola .54',1808],
].map(([id,name,weapon])=>[id,Object.freeze({id,name,weapon})])));
export function canonicalAmmunitionType(type) {
  return Object.values(AMMUNITION_FAMILIES).find(f=>f.legacyTypes.includes(type))?.type??null;
}
export function legacyWeaponAmmoType(weapon) {
  return Object.values(LEGACY_AMMUNITION).find(t=>t.weapon===weapon)?.id??null;
}
