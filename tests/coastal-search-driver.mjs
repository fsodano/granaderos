import {coastalBatteryController} from './coastal-command-driver.mjs';
import {getReachable,teamCanSee,stanceCost} from '../game/tactical.js';

// A quiet battlefield can still contain an unseen enemy. Search known map
// quadrants when the battery has no order, without reading hidden positions.
export function coastalSearchController(initial){
 const battery=coastalBatteryController(initial,{sharedArtillerySight:true});
 return (battle,unit)=>{
  const action=battery(battle,unit);
  if(action||battle.turn<20||battle.phase!=='player'||battle.units.some(other=>other.side!==unit.side&&other.hp>=15&&!other.routed&&!other.unconscious&&!other.surrendered&&!other.departure&&teamCanSee(battle,unit.side,other)))return action;
  const corners=[[.25,.25],[.75,.25],[.75,.75],[.25,.75]],corner=corners[Math.floor((battle.turn-20)/4)%corners.length];
  const goal={x:Math.floor(battle.width*corner[0]),y:Math.floor(battle.height*corner[1])},distance=point=>Math.hypot(point.x-goal.x,point.y-goal.y);
  if(distance(unit)<=3)return null;
  if(unit.stance!=='standing'&&unit.ap>=stanceCost(unit,'standing'))return {type:'stance',unitId:unit.id,stance:'standing'};
  const view={...battle,units:battle.units.filter(other=>other.side===unit.side||teamCanSee(battle,unit.side,other))};
  const point=getReachable(view,unit).filter(point=>point.cost>0&&point.cost<=Math.min(30,unit.ap-20)&&distance(point)<distance(unit)).sort((a,b)=>distance(a)-distance(b)||a.cost-b.cost)[0];
  return point?{type:'move',unitId:unit.id,x:point.x,y:point.y,tacticalLevel:point.tacticalLevel??0}:null;
 };
}
