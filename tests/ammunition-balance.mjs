// Shared campaign stock and the cartridges carried by recruited living troops.
// Ground, backpack weapons, militia and captive ammunition remain separate owners.
export function stockAndCarriedAmmo(campaign){
 return campaign.resources.cartridges+campaign.recruited.reduce((sum,id)=>{const r=campaign.operativeState[id];return sum+(r.alive&&!r.captured?(r.carriedAmmo??0):0);},0);
}
