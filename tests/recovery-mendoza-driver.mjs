import {mountainBatteryOrder} from './mountain-battery-driver.mjs';
import {northernReconOrder} from './northern-route.mjs';
import {tacticalLevel} from '../game/tactical-space.js';
import {artilleryCrewPlan} from '../game/tactical.js';

// Assign only living friendly ground crew. Earlier Salta losses must not
// leave the exploration advance bound to an absent commander. Preserve the
// original pair while both are available; replacements use local distance
// and identity, without a mutable job that could change a saved replay.
export function recoveryMendozaCrew(battle,unit,gun){
 const available=actor=>actor.side===unit.side&&Boolean(actor.militia)===Boolean(unit.militia)&&actor.hp>=15&&(actor.energy??100)>0&&!actor.routed&&!actor.unconscious&&!actor.asleep&&!actor.departure&&!actor.fled&&!actor.surrendered&&!actor.knockedDown&&!actor.entangled&&!actor.mounted&&actor.stance!=='prone'&&tacticalLevel(actor)===0;
 const candidates=battle.units.filter(available).sort((a,b)=>(gun?Math.hypot(a.x-gun.x,a.y-gun.y)-Math.hypot(b.x-gun.x,b.y-gun.y):0)||String(a.id).localeCompare(String(b.id)));
 const preferred=['1','0'].map(id=>candidates.find(actor=>actor.id===id));
 const assigned=gun&&candidates[0]?artilleryCrewPlan(battle,candidates[0],gun,0):null;
 const local=assigned&&!assigned.reason?assigned.crew.map(id=>candidates.find(actor=>actor.id===id)):candidates.slice(0,2);
 const crew=preferred.every(Boolean)?preferred:local;
 return {leaderId:crew[0]?.id??'none',helperId:crew[1]?.id??'none'};
}

// The permanent command crews the actual paid bronze gun, with a close
// infantry screen on its forward flanks, clear of the firing lane. A screen
// behind the gun exposes both crew before the infantry can cover contact.
// Once its finite ammunition is spent and only one capable
// survivor remains, use ordinary reconnaissance and visible shot previews.
// No hidden occupant or remaining enemy position selects a route or target.
export function recoveryMendozaOrder(battle,unit){
 const capable=actor=>actor.side===unit.side&&actor.hp>=15&&!actor.routed&&!actor.unconscious&&!actor.departure&&!actor.surrendered;
 const gun=battle.artillery.find(gun=>gun.side===unit.side&&(gun.loaded||gun.ammo>0));
 if(!gun&&battle.units.filter(capable).length<=1)return northernReconOrder(battle,unit);
 const crew=recoveryMendozaCrew(battle,unit,gun);
 return mountainBatteryOrder(battle,unit,{...crew,artilleryId:gun?.id??null,screenDistance:3,clearCrewLane:true,flankScreen:true,routeAroundObstacles:true,keepCrewTogether:true,sharedArtillerySight:true});
}
