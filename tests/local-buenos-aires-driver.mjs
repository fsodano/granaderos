import {fight as recordedFight} from './opening-driver.mjs';
import {cautiousCombatOrder} from './cautious-driver.mjs';
import {getReachable,teamCanSee,climbPreview} from '../game/tactical.js';
import {sameCell,spacePoint} from '../game/tactical-space.js';

// A declared strategy for the free officer and Cabral in the native capital.
// Flank to an existing west roof. After a visible kill and the actual end of
// contact, go around the south block to a second existing roof. Hold each
// firing position with ordinary cover, aim, aid and finite reload orders.
// This is one repeatable route, not a general combat or balance guarantee.
export function fight(request,previous=null){
 let secondRoof=false;const southReached=new Set();
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const controller=(battle,unit)=>{
  const visible=battle.units.filter(other=>other.side==='enemy'&&teamCanSee(battle,'player',other)&&other.hp>=15&&!other.routed&&!other.unconscious);
  if(battle.mode==='exploration'&&battle.units.some(other=>other.side==='enemy'&&teamCanSee(battle,'player',other)&&other.hp===0))secondRoof=true;
  const link=battle.climbLinks.find(link=>link.id===`buenos_aires:${secondRoof?'house-2:climb:west':'neighbourhood-12:climb:north'}`);
  const roof=secondRoof?{x:unit.id==='1000'?36:35,y:29,tacticalLevel:1}:{x:unit.id==='1000'?18:17,y:26,tacticalLevel:1};
  const atRoof=unit.tacticalLevel===1&&(secondRoof?unit.x>=34:unit.x<20);
  if(atRoof){
   const spot=getReachable(battle,unit).find(point=>sameCell(point,roof));
   if(!sameCell(unit,roof)&&spot?.cost>0)return {type:'move',unitId:unit.id,...spacePoint(spot)};
   const action=cautiousCombatOrder(battle,unit);
   return ['move','charge','climb'].includes(action?.type)?null:action;
  }
  if(sameCell(unit,link.from))return climbPreview(battle,unit,{linkId:link.id}).valid?{type:'climb',unitId:unit.id,linkId:link.id}:null;
  if(visible.some(other=>distance(unit,other)<=3))return cautiousCombatOrder(battle,unit);
  const view={...battle,units:battle.units.filter(other=>other.side===unit.side||teamCanSee(battle,'player',other))};
  if(unit.stance!=='standing')return {type:'stance',unitId:unit.id,stance:'standing'};
  if(secondRoof&&unit.tacticalLevel===0&&unit.y>=34)southReached.add(unit.id);
  const goal=secondRoof&&!southReached.has(unit.id)?{x:21,y:34,tacticalLevel:0}:link.from;
  const route=getReachable({...view,mode:'exploration'},unit).find(point=>sameCell(point,goal));
  const reachable=getReachable(view,unit),budget=battle.mode==='exploration'?32:Math.max(0,unit.ap-32);
  // Reachable routes include real level changes. Submit those as a climb,
  // and never fold one into an ordinary ground movement order.
  if(route?.path[0]?.kind==='climb')return climbPreview(battle,unit,{linkId:route.path[0].linkId}).valid?{type:'climb',unitId:unit.id,linkId:route.path[0].linkId}:null;
  const next=route?.path.slice().reverse().map(point=>reachable.find(spot=>sameCell(spot,point)&&spot.cost>0&&spot.cost<=budget&&!spot.path.some(step=>step.kind==='climb'))).find(Boolean);
  return next?{type:'move',unitId:unit.id,...spacePoint(next)}:cautiousCombatOrder(battle,unit);
 };
 return recordedFight(request,previous,{controller});
}
