// Player-owned sector stores and cartridges carried by recruited living troops.
// Ground, backpack weapons, militia and captive ammunition remain separate owners.
// Merchant stock is not player-owned and treasury cannot also own cartridges.
import {AMMO_KEYS} from '../game/ammo-types.js';
import {totalReserveAmmunition} from '../game/ammunition-types.js';
export const stockAmmo=campaign=>Object.values(campaign.ammunitionStores??{}).reduce((sum,stock)=>sum+AMMO_KEYS.reduce((n,key)=>n+(stock[key]??0),0),0);
export function stockAndCarriedAmmo(campaign){
 return stockAmmo(campaign)+campaign.recruited.reduce((sum,id)=>{const r=campaign.operativeState[id];return sum+(r.alive&&!r.captured?totalReserveAmmunition(r)+(r.carriedLoaded??0):0);},0);
}
