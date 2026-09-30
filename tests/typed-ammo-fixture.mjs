import {setTestAmmunition} from './typed-ammunition-fixture.mjs';
import {ammoTypeFor} from '../game/ammo-types.js';
import {AMMUNITION_FAMILIES} from '../game/ammunition-families.js';
// Explicit test setup replaces physical reserves; HUD counts are derived.
export function setReserve(unit,count){delete unit.ammunition;return setTestAmmunition(unit,count,AMMUNITION_FAMILIES[ammoTypeFor(unit)??'ammoMusket'].type);}
