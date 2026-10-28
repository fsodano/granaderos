// Shared lookup for deployment and transport; the depot is the sole owner.
export function localArtilleryDepot(s){return s.sectors?.[s.location]?.owner==='patriot'?s.artilleryDepots?.[s.location]??[]:[];}
export const depotSelection=gun=>`depot:${gun.id}`;
