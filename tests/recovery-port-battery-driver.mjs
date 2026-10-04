import {coastalBatteryController} from './coastal-command-driver.mjs';
import {sectorSearchOrder} from './sector-search-driver.mjs';
import {teamCanSee} from '../game/tactical.js';

// The paid Ensenada force keeps its original deployment and battery policy.
// Once contact is lost, a recurring crew approach must not prevent searching
// the public map. Search before that approach; observed targets still select
// ordinary battery orders and spend the force's real ammunition and AP.
export function recoveryPortSearchController(initial){
 const battery=coastalBatteryController(initial,{sharedArtillerySight:true});
 return (battle,unit)=>{
  const observed=battle.units.some(other=>other.side!==unit.side&&other.hp>=15&&!other.departure&&!other.routed&&!other.unconscious&&!other.surrendered&&teamCanSee(battle,unit.side,other));
  if(battle.turn>=20&&battle.phase==='player'&&!observed){
   const search=sectorSearchOrder(battle,unit);if(search)return search;
  }
  return battery(battle,unit);
 };
}
