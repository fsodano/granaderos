// Shared campaign stock and the cartridges carried by recruited living troops.
// Ground, backpack weapons, militia and captive ammunition remain separate owners.
import {AMMUNITION_RESOURCE_KEYS} from '../game/campaign-ammunition.js';
import {totalReserveAmmunition} from '../game/ammunition-types.js';
export const stockAmmo=campaign=>Object.values(AMMUNITION_RESOURCE_KEYS).reduce((sum,key)=>sum+(campaign.resources[key]??0),0);
export function stockAndCarriedAmmo(campaign){
 return stockAmmo(campaign)+campaign.recruited.reduce((sum,id)=>{const r=campaign.operativeState[id];return sum+(r.alive&&!r.captured?totalReserveAmmunition(r)+(r.carriedLoaded??0):0);},0);
}
