import assert from 'node:assert/strict';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,getReachable,hasLineOfSight,canSee,shotChance,actionCosts,interruptAvailable,stanceCost,hasFirearm} from '../game/tactical.js';
import {chooseEnemyAction,choosePlayerSharedSightingInvestigation} from '../game/tactical-ai.js';
import {holdsArtilleryPost} from '../game/tactical-ai-artillery.js';
import {firearmServiceable} from '../game/firearm-serviceability.js';
import {sameSurface,spacePoint} from '../game/tactical-space.js';
import {availableAmmunition} from '../game/ammunition-types.js';
import {criticalFirstAidNeeded} from '../game/first-aid.js';
import {sectorSearchOrder} from './sector-search-driver.mjs';
import {recordRouteControllerDecisionEvidence} from './route-controller-decision-evidence.mjs';

const alive=u=>u.hp>0&&!u.departure&&!u.surrendered&&!u.unconscious&&!u.routed;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function combatOrder(b,u){
 let cost=actionCosts(b,u);const players=b.units.filter(v=>v.side===u.side&&alive(v)&&v.hp>=15);
 if(u.knockedDown||u.entangled)return chooseEnemyAction(b,u);
 // Keep the mission commander in the firing line with the infantry.
 if(u.missionAlly&&u.mounted&&u.ap>=cost.mount)return {type:'mount',unitId:u.id};
 const visible=b.units.filter(v=>v.side!==u.side&&alive(v)&&players.some(p=>canSee(b,p,v)));
 // The commander takes a firing posture at contact, but must be able to
 // stand and search when only incapacitated allies remain.
 if(visible.length&&u.missionAlly&&u.stance!=='prone'&&u.ap>=stanceCost(u,'prone'))return {type:'stance',unitId:u.id,stance:'prone'};
 const patient=b.units.filter(v=>v.side===u.side&&v.hp>0&&!v.departure&&!v.surrendered&&!v.routed&&(v.bleeding>0||criticalFirstAidNeeded(v))&&sameSurface(u,v)&&distance(u,v)<=1.5&&hasLineOfSight(b,u,v)).sort((a,b)=>a.hp-b.hp)[0];
 if(patient&&u.medkits>0&&u.medical>0){
  if(u.activeSlot==='medical'&&u.ap>=cost.heal)return {type:'useItem',unitId:u.id,targetId:patient.id};
  if(u.activeSlot!=='medical'&&u.ap>=cost.heal+cost.weapon)return {type:'weapon',unitId:u.id,slot:'medical'};
 }
 if(['medical','tool','supply'].includes(u.activeSlot)&&u.weapon&&!u.weaponDropped&&u.ap>=cost.weapon)return {type:'weapon',unitId:u.id,slot:'primary'};
 if(u.jammed&&hasFirearm(u)&&u.ap>=cost.reprime)return {type:'reprime',unitId:u.id};
 const target=visible.filter(t=>hasLineOfSight(b,u,t)).sort((a,c)=>shotChance(b,u,c,4)-shotChance(b,u,a,4))[0];
 if(target)cost=actionCosts(b,u,target);
 if(target&&u.loaded&&!u.jammed&&u.ap>=cost.fire){
   if(u.stance!=='prone'&&!u.mounted&&u.ap>=cost.fire+cost.aim*2+6)return {type:'stance',unitId:u.id,stance:'prone'};
   let aim=Math.min(4,Math.floor((u.ap-cost.fire)/cost.aim));
   // Extra aim is paid work. Stop once the previewed hit chance plateaus,
   // preserving AP for a turn, a reload, or an interruption response.
   const chance=shotChance(b,u,target,aim);
   while(aim>0&&shotChance(b,u,target,aim-1)===chance)aim--;
   if(shotChance(b,u,target,aim)>=25)return {type:'fire',unitId:u.id,targetId:target.id,aim};
 }
 // Kneel when prone muzzle-loading is unaffordable but a complete
 // crouched reload fits. Do not leave an empty Baker waiting indefinitely.
 if(!u.loaded&&!u.jammed&&availableAmmunition(u)&&u.stance==='prone'&&cost.reload>u.ap&&u.ap>=stanceCost(u,'crouched')+actionCosts(b,{...u,stance:'crouched'}).reload)return {type:'stance',unitId:u.id,stance:'crouched'};
 if(!u.loaded&&!u.jammed&&availableAmmunition(u)&&cost.reload>0&&u.ap>=cost.reload)return {type:'reload',unitId:u.id};
 const known=u.lastKnownEnemy??u.lastHeardNoise,age=b.turn-(known?.turn??-Infinity);
 if(!visible.length&&age>3&&b.turn>=20)return sectorSearchOrder(b,u);
 const automatic=chooseEnemyAction(b,u);
 if(u.missionAlly&&players.length>1&&automatic?.type==='move')return null;
 if(automatic&&automatic.type!=='charge')return automatic;
 if(u.missionAlly&&players.length>1)return null; // Infantry scouts first; a lone commander must still act.
 if(visible.length){
  recordRouteControllerDecisionEvidence({battle:b,unit:u,sharedContacts:visible,automatic});
  return null;
 }
 // Reconnaissance advances toward the known sector center in short bounds.
 const destination={x:Math.floor(b.width*.65),y:Math.floor(b.height*.5),tacticalLevel:0};
 if(sameSurface(u,destination)&&distance(u,destination)<=4)return null;
 if(u.stance!=='standing'&&u.ap>=6)return {type:'stance',unitId:u.id,stance:'standing'};
 const moves=getReachable(b,u).filter(p=>sameSurface(p,destination)&&p.cost>0&&p.cost<=Math.min(40,u.ap-20)&&distance(p,destination)<distance(u,destination));
 moves.sort((a,c)=>distance(a,destination)-distance(c,destination)||a.cost-c.cost);
 return moves[0]?{type:'move',unitId:u.id,...spacePoint(moves[0])}:null;
}
// Optional policy for a current public squad sighting. The caller first gives
// ordinary fire, care and reload orders their turn; a custom hold stays a hold.
export function sharedSightingInvestigationOrder(b,u){
 if(!interruptAvailable(b,u)||u.ap<3||u.knockedDown||u.entangled||u.side!=='player'||u.missionAlly||u.mounted||u.stance!=='prone'||u.hp<15||u.bleeding>0||
   (u.activeSlot??'primary')!=='primary'||u.weaponDropped||!hasFirearm(u)||!firearmServiceable(u)||!(u.loaded>0)||u.jammed||
   u.lastKnownEnemy||u.lastHeardNoise||u.patrolOrigin||u.patrol===false||holdsArtilleryPost(b,u))return null;
 const players=b.units.filter(v=>v.side===u.side&&alive(v)&&v.hp>=15);
 const visible=b.units.filter(v=>v.side!==u.side&&alive(v)&&players.some(p=>canSee(b,p,v)));
 if(visible.some(contact=>canSee(b,u,contact)))return null;
 const target=visible.filter(t=>hasLineOfSight(b,u,t)).sort((a,c)=>shotChance(b,u,c,4)-shotChance(b,u,a,4))[0];
 if(!target||!sameSurface(u,target)||chooseEnemyAction(b,u)!==null)return null;
 return choosePlayerSharedSightingInvestigation(b,u,target);
}

export function openingControlWindow(start,{controller,sharedFallback}={}){
 let b=start;const orders=[];let sharedInvestigation=null;
 const ordinary=controller===undefined?combatOrder:controller;
 // Custom controllers opt in with their own fallback callback, including
 // their reserve and hold rules. A custom null alone never authorizes movement.
 const fallback=sharedFallback===undefined?(controller===undefined?sharedSightingInvestigationOrder:null):sharedFallback;
 const ids=b.units.filter(u=>u.side==='player'&&!u.militia).sort((a,c)=>c.marksmanship-a.marksmanship).map(u=>u.id);
 // Coordinate the squad one order at a time. Spending one scout's whole
 // turn before the others advance separates him from fire and medical aid.
 for(let attempt=0;attempt<16&&b.status==='active';attempt++){
  let acted=false;
  for(const id of ids){
   if(b.status!=='active')break;
   const u=b.units.find(u=>u.id===id);if(!interruptAvailable(b,u)||u.ap<3)continue;
   const action=ordinary(b,u);if(!action)continue;
   const next=actBattle(b,action);assert.equal(next.lastError,null,JSON.stringify(action));b=next;orders.push(action);acted=true;
  }
  if(!acted){
   // A complete squad pass admitted no ordinary work. Spend at most one
   // shared bound, then return for native round or interrupt processing.
   if(fallback&&b.status==='active')for(const id of ids){
    const u=b.units.find(u=>u.id===id);if(!interruptAvailable(b,u)||u.ap<3)continue;
    const action=fallback(b,u);if(!action)continue;
    const next=actBattle(b,action);assert.equal(next.lastError,null,JSON.stringify(action));b=next;orders.push(action);sharedInvestigation=action;break;
   }
   break;
  }
 }
 return {battle:b,actions:orders.length,orders,sharedInvestigation};
}

export function fight(request,sectorState,{controller,sharedFallback,deploy}={}){let b=enterSector(request,sectorState,{placement:Boolean(deploy)}),actions=0;
 if(deploy)b=deploy(b);
 const orders=[];
 // Enemy movement can yield several control windows within the same round.
 for(let window=0;window<600&&b.turn<=80&&b.status==='active';window++){
  const result=openingControlWindow(b,{controller,sharedFallback});b=result.battle;orders.push(...result.orders);actions+=result.actions;
  if(b.status==='active'){b=endTurn(b);orders.push({type:'endTurn'});}
 }
 return {battle:b,actions,orders};
}
