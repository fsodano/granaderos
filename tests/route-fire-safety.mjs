import {firearmFlightPreview} from '../game/tactical.js';
import {pairedPistol,secondaryPistolView} from '../game/paired-fire.js';

// Public geometry only. Actual misses can still hit an unknown or off-ray body.
export function knownCivilianFireRisk(battle,unit,target,hitLocation='torso'){
 const second=pairedPistol(unit),views=[unit,...(second?[secondaryPistolView(unit,second)]:[])];
 return views.some(view=>{
  const flight=firearmFlightPreview(battle,view,target,hitLocation);
  return flight.victimKind==='npc'||Boolean(flight.bodyImpacts?.some(impact=>impact.victimKind==='npc'));
 });
}

// One fresh predicate per immutable actor/target state. Aim increments share
// the same body geometry; movement, posture and later orders need a new read.
export function knownRouteShotSafety(battle,unit,target){
 const civilians=new Map();
 return option=>{
  if(!option||option.interveningFriendly||option.shots?.some(shot=>shot.interveningFriendly))return false;
  const location=option.hitLocation??'torso';
  if(!civilians.has(location))civilians.set(location,knownCivilianFireRisk(battle,unit,target,location));
  return !civilians.get(location);
 };
}
