import {addAmmunition,isAmmunitionStack,weaponAmmoType} from '../game/ammunition-types.js';
import {syncUnitAmmunition} from '../game/tactical-ammunition.js';

// Explicit test setup only. Replace physical loose stock, then derive the HUD
// total; changing unit.ammo after creation cannot provision a weapon.
export function setTestAmmunition(unit,count,type=weaponAmmoType(unit.weapon)??'musket_75'){
 unit.inventory=Object.fromEntries(Object.entries(unit.inventory??{}).filter(([,stack])=>!isAmmunitionStack(stack)));
 if(count)addAmmunition(unit,type,count);
 return syncUnitAmmunition(unit);
}
