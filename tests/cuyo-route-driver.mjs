// Acceptance controller: ordinary orders only, with visible targets and remembered
// positions. It cannot grant AP, supplies, health, territory or a battle outcome.
// This is one reproducible strategy, not the game AI or a general balance proof.
// Prefer cover to unfinished loading; complete an affordable charge first and
// spend otherwise unused AP on the remaining partial work.
// Reserve AP for fire, use prone fire, treat bleeding and search past cleared
// remembered positions. avoidCivilians filters shots through visible residents;
// holdPosition keeps selected actors at their actual entry cells. They can still
// fire, reload and bandage, and retain the same risks and costs.
import {automaticOrder} from '../game/autonomous-orders.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,reloadPlan,getReachable,bladeFor,weaponFor,actionCosts,hasFirearm,shotChance,teamCanSee} from '../game/tactical.js';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),live=u=>u.hp>0&&!u.routed&&!u.unconscious;
const clearOfCivilians=(b,u,t)=>{const dx=t.x-u.x,dy=t.y-u.y,length=dx*dx+dy*dy;return !b.npcs.some(n=>{if(n.hp<=0||!teamCanSee(b,'player',n))return false;const f=((n.x-u.x)*dx+(n.y-u.y)*dy)/length;return f>0&&f<1&&Math.hypot(n.x-u.x-f*dx,n.y-u.y-f*dy)<.8;});};
export function fight(request,previous=null,{scoutCostWeight=.1,avoidCivilians=false,holdPosition=[]}={}){let b=enterSector(request,previous),actions=0;const orders=[];let known=[];
for(let round=0;round<80&&b.status==='active';round++){
 for(const id of b.units.filter(u=>u.side==='player').map(u=>u.id)){
  const visited=new Set();
  for(let n=0;n<20&&b.status==='active';n++){
   const u=b.units.find(u=>u.id===id);if(!live(u)||u.ap<6)break;visited.add(`${u.x},${u.y}`);
   const visible=b.units.filter(t=>t.side==='enemy'&&live(t)&&teamCanSee(b,'player',t));if(visible.length)known=visible.map(({x,y})=>({x,y}));if(!visible.length&&known.every(p=>teamCanSee(b,'player',p)))known=[];const opts=[];
   if(u.medkits&&u.bleeding&&u.hp<u.maxHp-10)opts.push(u.activeSlot==='medical'?{type:'heal'}:{type:'weapon',slot:'medical'});
   else if(u.activeSlot==='medical')opts.push({type:'weapon',slot:'primary'});
   if(!visible.length&&u.stance==='prone')opts.push({type:'stance',stance:'standing'});
   if(u.knockedDown)opts.push({type:'stance',stance:'standing'});
   if(visible.length&&u.loaded&&u.stance!=='prone'&&visible.every(t=>dist(u,t)>2))opts.push({type:'stance',stance:'prone'});
   if(!u.loaded&&u.stance==='prone')opts.push({type:'stance',stance:'standing'});
   if(u.jammed)opts.push({type:'reprime'});
   const adjacent=visible.filter(t=>dist(u,t)<=bladeFor(u).reach).sort((a,b)=>a.hp-b.hp);if(adjacent[0])opts.push({type:'melee',targetId:adjacent[0].id});
   if(hasFirearm(u)&&u.loaded&&!u.jammed){
    const shots=visible.filter(t=>!avoidCivilians||clearOfCivilians(b,u,t)).map(t=>{const shotCosts=actionCosts(b,u,t);let aim=0;while(aim<4&&shotCosts.fire+(aim+1)*shotCosts.aim<=u.ap&&shotChance(b,u,t,aim)<75)aim++;const chance=shotChance(b,u,t,aim);return {t,aim,chance,affordable:shotCosts.fire+aim*shotCosts.aim<=u.ap,score:chance*(t.hp<=weaponFor(u).damage?2:1)};}).filter(x=>x.chance>=30&&x.affordable).sort((a,b)=>b.score-a.score);
    if(shots[0])opts.push({type:'fire',targetId:shots[0].t.id,aim:shots[0].aim});
   }
   if(hasFirearm(u)&&!u.loaded&&u.ammo&&visible.length&&!reloadPlan(u,b).partial)opts.push({type:'reload'});
   const goal=visible.length?visible:known.length?known:[{x:b.width-3,y:Math.round(b.height/2)}];
   const currentDistance=Math.min(...goal.map(t=>dist(u,t)));
   const moves=(holdPosition.includes(u.id)?[]:getReachable(b,u)).filter(p=>p.cost>0&&p.cost<=Math.max(0,u.ap-30)&&!visited.has(`${p.x},${p.y}`));
   const scored=moves.map(p=>{const actor={...u,x:p.x,y:p.y},distance=Math.min(...goal.map(t=>dist(p,t))),cover=b.tiles.find(t=>t.x===p.x&&t.y===p.y)?.cover??0,chance=visible.length?Math.max(...visible.map(t=>shotChance(b,actor,t,2))):0;return {p,distance,score:visible.length?chance*.7+cover*.7-Math.max(0,5-distance)*12-p.cost*.2:-distance-p.cost*scoutCostWeight};}).filter(x=>visible.length?x.distance>=3||!hasFirearm(u):x.distance<currentDistance).sort((a,b)=>b.score-a.score);
   const currentScore=visible.length?Math.max(...visible.map(t=>shotChance(b,u,t,2)))*.7+(b.tiles.find(t=>t.x===u.x&&t.y===u.y)?.cover??0)*.7-Math.max(0,5-currentDistance)*12:-currentDistance;
   if(scored[0]&&scored[0].score>currentScore+2)opts.push({type:'move',x:scored[0].p.x,y:scored[0].p.y});
   if(hasFirearm(u)&&!u.loaded&&u.ammo)opts.push({type:'reload'});
   let done=false;for(const a of opts){const next=actBattle(b,{...a,unitId:id});if(!next.lastError){b=next;orders.push({...a,unitId:id});actions++;done=true;break;}}if(!done){const fallback=automaticOrder(b,u),target=fallback?.targetId&&b.units.find(t=>t.id===fallback.targetId);if(fallback&&!(holdPosition.includes(u.id)&&['move','charge','climb','exit'].includes(fallback.type))&&!(avoidCivilians&&fallback.type==='fire'&&target&&!clearOfCivilians(b,u,target))){const next=actBattle(b,{...fallback,unitId:id});if(!next.lastError){b=next;orders.push({...fallback,unitId:id});actions++;done=true;}}}if(!done)break;
  }
 }
 if(b.status==='active'){b=endTurn(b);orders.push({type:'endTurn'});}
}
return {battle:b,actions,orders};}
