import {stagedBatteryController} from './staged-battery-driver.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {teamArtilleryOrder} from './team-artillery-driver.mjs';
import {artilleryContact,artilleryCrewPlan,teamCanSee,stanceCost} from '../game/tactical.js';
// A nearby gun uses the engine's current crew. Keep that crew crouched and
// together while firing; do not spend its turn alternating prone and crouched.
export function stableCrewController(){
 const approach=stagedBatteryController();
 return (b,u)=>{
  if(b.mode==='exploration')return approach(b,u);
  const normal=tucumanCombatOrder(b,u);
  if(u.knockedDown||u.entangled||normal?.type==='useItem'||normal?.slot==='medical')return normal;
  const targets=b.units.filter(v=>v.side!==u.side&&v.hp>=15&&!v.routed&&!v.surrendered&&!v.unconscious&&!v.departure&&teamCanSee(b,u.side,v));
  const guns=b.artillery.filter(g=>g.side===u.side&&(g.loaded||g.ammo>0)&&artilleryContact(b,u,g)&&!artilleryCrewPlan(b,u,g,0).reason);
  for(const gun of guns){
   const a=teamArtilleryOrder({...b,artillery:[gun]},u,targets);if(a)return a;
  }
  if(guns.length&&!targets.some(v=>Math.hypot(v.x-u.x,v.y-u.y)<=2.5)){
   if(normal?.type==='move'||normal?.type==='stance'&&normal.stance!=='crouched')return u.stance==='standing'&&u.ap>=stanceCost(u,'crouched')?{type:'stance',unitId:u.id,stance:'crouched'}:null;
  }
  return normal;
 };
}

// A three-person heavy crew can be invalid solely because one member is
// prone. Pay for each contact member to rise before testing the whole crew;
// the default route controller above retains its existing decisions.
export function heavyContactCrewController({holdCommand=true,reserveId='57'}={}){
 const base=stableCrewController();
 return (battle,unit)=>{
  const gun=!unit.knockedDown&&!unit.entangled&&battle.artillery.find(g=>g.side===unit.side&&g.type==='field8'&&(g.loaded||g.ammo>0)&&artilleryContact(battle,unit,g));
  if(gun&&unit.stance==='prone')return unit.ap>=stanceCost(unit,'crouched')?{type:'stance',unitId:unit.id,stance:'crouched'}:null;
  if(gun){
   const targets=battle.units.filter(v=>v.side!==unit.side&&v.hp>=15&&!v.routed&&!v.surrendered&&!v.unconscious&&!v.departure&&teamCanSee(battle,unit.side,v));
   const artillery=teamArtilleryOrder({...battle,artillery:[gun]},unit,targets);if(artillery)return artillery;
  }
  const action=base(battle,unit);
  if(gun&&action?.type==='stance'&&action.stance==='prone')return null;
  return holdCommand&&unit.id===String(reserveId)&&['move','climb','charge','artilleryMove','exit'].includes(action?.type)?null:action;
 };
}
