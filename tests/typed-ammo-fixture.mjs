import {ammoTypeFor} from '../game/ammo-types.js';
// Explicitly replace the entire reserve when arranging a typed tactical fixture.
export function setReserve(unit,count){unit.ammunition={[ammoTypeFor(unit)??'ammoMusket']:count};unit.ammo=count;}
