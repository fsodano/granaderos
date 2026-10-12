import {coastalBatteryController} from './coastal-command-driver.mjs';
import {sectorSearchOrder} from './sector-search-driver.mjs';
import {getReachable,teamCanSee} from '../game/tactical.js';
import {sameSurface,spacePoint} from '../game/tactical-space.js';

// The paid Ensenada force keeps its original deployment and battery policy.
// Once contact is lost, a recurring crew approach must not prevent searching
// the public map. Search before that approach; observed targets still select
// ordinary battery orders and spend the force's real ammunition and AP.
export function recoveryPortSearchController(initial,{reserveIds=[]}={}){
 const battery=coastalBatteryController(initial,{sharedArtillerySight:true});
 const reserves=new Set(reserveIds.map(String));
 const ordinary=(battle,unit)=>{
  const observed=battle.units.some(other=>other.side!==unit.side&&other.hp>=15&&!other.departure&&!other.routed&&!other.unconscious&&!other.surrendered&&teamCanSee(battle,unit.side,other));
  if(battle.turn>=20&&battle.phase==='player'&&!observed){
   const search=sectorSearchOrder(battle,unit);if(search)return search;
  }
  return battery(battle,unit);
 };
 return (battle,unit)=>{
  const action=ordinary(battle,unit);
  if(!reserves.has(unit.id)||!['move','charge'].includes(action?.type))return action;
  // The existing foundry cohort follows behind paid infantry. Fire, reload,
  // adjacent aid and maintenance retain their ordinary orders. Follow the
  // second forward soldier so one exposed scout cannot pull the reserve ahead.
  const screen=battle.units.filter(other=>other.side===unit.side&&!reserves.has(other.id)&&other.medical<90&&other.hp>=15&&!other.departure&&!other.routed&&!other.unconscious&&!other.surrendered).sort((a,b)=>b.x-a.x||b.marksmanship-a.marksmanship);
  if(!screen.length)return action;
  const lead=screen[Math.min(1,screen.length-1)],goal={x:Math.max(0,lead.x-4),y:lead.y,tacticalLevel:0},distance=point=>Math.hypot(point.x-goal.x,point.y-goal.y);
  const view={...battle,units:battle.units.filter(other=>other.side===unit.side||teamCanSee(battle,unit.side,other))};
  const point=getReachable(view,unit).filter(point=>sameSurface(point,goal)&&point.cost>0&&point.cost<=Math.min(20,unit.ap)&&point.x<=goal.x&&distance(point)<distance(unit)).sort((a,b)=>distance(a)-distance(b)||a.cost-b.cost||a.y-b.y||a.x-b.x)[0];
  return point?{type:'move',unitId:unit.id,...spacePoint(point)}:null;
 };
}
