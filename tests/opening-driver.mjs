import assert from 'node:assert/strict';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,getReachable,hasLineOfSight,canSee,shotChance,actionCosts,interruptAvailable,stanceCost} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';

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
 const patient=b.units.filter(v=>v.side===u.side&&v.hp>0&&!v.departure&&!v.surrendered&&!v.routed&&v.bleeding>0&&distance(u,v)<=1.5&&hasLineOfSight(b,u,v)).sort((a,b)=>a.hp-b.hp)[0];
 if(patient&&u.medkits>0&&u.medical>0){
  if(u.activeSlot==='medical'&&u.ap>=cost.heal)return {type:'useItem',unitId:u.id,targetId:patient.id};
  if(u.activeSlot!=='medical'&&u.ap>=cost.heal+cost.weapon)return {type:'weapon',unitId:u.id,slot:'medical'};
 }
 if(['medical','tool','supply'].includes(u.activeSlot)&&u.ap>=cost.weapon)return {type:'weapon',unitId:u.id,slot:'primary'};
 if(u.jammed&&u.priming&&u.ap>=cost.reprime)return {type:'reprime',unitId:u.id};
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
 if(!u.loaded&&!u.jammed&&u.ammo&&u.stance==='prone'&&cost.reload>u.ap&&u.ap>=stanceCost(u,'crouched')+actionCosts(b,{...u,stance:'crouched'}).reload)return {type:'stance',unitId:u.id,stance:'crouched'};
 if(!u.loaded&&!u.jammed&&u.ammo&&cost.reload>0&&u.ap>=cost.reload)return {type:'reload',unitId:u.id};
 const automatic=chooseEnemyAction(b,u);
 if(u.missionAlly&&players.length>1&&automatic?.type==='move')return null;
 if(automatic&&automatic.type!=='charge')return automatic;
 if(u.missionAlly&&players.length>1)return null; // Infantry scouts first; a lone commander must still act.
 if(visible.length)return null;
 // Reconnaissance advances toward the known sector center in short bounds.
 const destination={x:Math.floor(b.width*.65),y:Math.floor(b.height*.5)};
 if(distance(u,destination)<=4)return null;
 if(u.stance!=='standing'&&u.ap>=6)return {type:'stance',unitId:u.id,stance:'standing'};
 const moves=getReachable(b,u).filter(p=>p.cost>0&&p.cost<=Math.min(40,u.ap-20)&&distance(p,destination)<distance(u,destination));
 moves.sort((a,c)=>distance(a,destination)-distance(c,destination)||a.cost-c.cost);
 return moves[0]?{type:'move',unitId:u.id,x:moves[0].x,y:moves[0].y}:null;
}
export function fight(request,sectorState,{controller=combatOrder}={}){let b=enterSector(request,sectorState),actions=0;
 // Enemy movement can yield several control windows within the same round.
 for(let window=0;window<600&&b.turn<=80&&b.status==='active';window++){
  const ids=b.units.filter(u=>u.side==='player').sort((a,c)=>c.marksmanship-a.marksmanship).map(u=>u.id);
  // Coordinate the squad one order at a time. Spending one scout's whole
  // turn before the others advance separates him from fire and medical aid.
  for(let attempt=0;attempt<16&&b.status==='active';attempt++){
   let acted=false;
   for(const id of ids){
    if(b.status!=='active')break;
    const u=b.units.find(u=>u.id===id);if(!interruptAvailable(b,u)||u.ap<3)continue;
    const action=controller(b,u);if(!action)continue;
    const next=actBattle(b,action);assert.equal(next.lastError,null,JSON.stringify(action));b=next;actions++;acted=true;
   }
   if(!acted)break;
  }
  if(b.status==='active')b=endTurn(b);
 }
 return {battle:b,actions};
}
