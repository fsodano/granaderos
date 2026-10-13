import {mountainBatteryOrder} from './mountain-battery-driver.mjs';
import {northernReconOrder} from './northern-route.mjs';
import {tacticalLevel} from '../game/tactical-space.js';
import {artilleryCrewPlan,stanceCost,teamCanSee,transferPreview} from '../game/tactical.js';

// Give only carried linen to a qualified local physician before contact.
// An adjacent relay is deterministic; a throw or hidden source is not a
// supply plan. The native transfer pays for every actual participating actor.
export function recoveryMendozaDressingOrder(battle,unit){
 if(battle.mode!=='exploration'||!(unit.medkits>0)||unit.medical>=60||
  battle.units.some(actor=>actor.side!==unit.side&&actor.hp>=15&&!actor.departure&&!actor.routed&&!actor.unconscious&&!actor.surrendered&&teamCanSee(battle,unit.side,actor)))return null;
 const physicians=battle.units.filter(actor=>actor.side===unit.side&&actor.medical>=60&&actor.hp>=15&&!actor.unconscious&&!actor.routed&&!actor.departure&&!actor.surrendered&&!actor.asleep)
  .sort((a,b)=>b.medical-a.medical||String(a.id).localeCompare(String(b.id)));
 const physician=physicians[0],count=physician?Math.min(unit.medkits,Math.max(0,2-(physician.medkits??0))):0;
 if(!count)return null;
 const preview=transferPreview(battle,unit,physician,'medkits',count);
 if(!preview.valid||preview.kind==='throw')return null;
 return {type:'transfer',unitId:unit.id,targetId:physician.id,item:'medkits',count,transferKind:preview.kind,transferRoute:preview.route.map(actor=>actor.id)};
}

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
 const dressing=recoveryMendozaDressingOrder(battle,unit);if(dressing)return dressing;
 const capable=actor=>actor.side===unit.side&&actor.hp>=15&&!actor.routed&&!actor.unconscious&&!actor.departure&&!actor.surrendered;
 const gun=battle.artillery.find(gun=>gun.side===unit.side&&(gun.loaded||gun.ammo>0));
 if(!gun&&battle.units.filter(capable).length<=1)return northernReconOrder(battle,unit);
 const crew=recoveryMendozaCrew(battle,unit,gun);
 const action=mountainBatteryOrder(battle,unit,{...crew,artilleryId:gun?.id??null,screenDistance:3,clearCrewLane:true,flankScreen:true,routeAroundObstacles:true,keepCrewTogether:true,sharedArtillerySight:true});
 // Contact is not permission to push an idle gun beyond its infantry. Keep
 // the paid firing position and let an armed noncrew soldier use the shared
 // observed-state cover policy when ordinary work has no current proposal.
 if(battle.mode==='combat'&&action?.type==='artilleryMove')return unit.stance==='standing'&&unit.ap>=stanceCost(unit,'crouched')?{type:'stance',unitId:unit.id,stance:'crouched'}:null;
 if(!action&&unit.loaded&&!unit.jammed&&!unit.weaponDropped&&![crew.leaderId,crew.helperId].includes(unit.id))return northernReconOrder(battle,unit);
 return action;
}
