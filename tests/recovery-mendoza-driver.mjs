import {mountainBatteryOrder} from './mountain-battery-driver.mjs';
import {northernReconOrder} from './northern-route.mjs';

// The permanent command crews the actual paid bronze gun, with a close
// infantry screen. Once its finite ammunition is spent and only one capable
// survivor remains, use ordinary reconnaissance and visible shot previews.
// No hidden occupant or remaining enemy position selects a route or target.
export function recoveryMendozaOrder(battle,unit){
 const capable=actor=>actor.side===unit.side&&actor.hp>=15&&!actor.routed&&!actor.unconscious&&!actor.departure&&!actor.surrendered;
 const gunAvailable=battle.artillery.some(gun=>gun.side===unit.side&&(gun.loaded||gun.ammo>0));
 if(!gunAvailable&&battle.units.filter(capable).length<=1)return northernReconOrder(battle,unit);
 return mountainBatteryOrder(battle,unit,{leaderId:'1',helperId:'0',screenDistance:3,clearCrewLane:true,routeAroundObstacles:true,keepCrewTogether:true,sharedArtillerySight:true});
}
