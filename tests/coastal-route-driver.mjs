// Acceptance controller: ordinary orders only, with visible targets and remembered
// positions. It cannot grant AP, supplies, health, territory or a battle outcome.
// This is one reproducible strategy, not the game AI or a general balance proof.
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,getReachable,bladeFor,weaponFor,actionCosts,hasFirearm,shotChance,teamCanSee} from '../game/tactical.js';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),live=u=>u.hp>0&&!u.routed&&!u.unconscious;
export function fight(request,previous=null,{scoutCostWeight=.1}={}){let b=enterSector(request,previous),actions=0;const orders=[];let known=[];
for(let round=0;round<80&&b.status==='active';round++){
 for(const id of b.units.filter(u=>u.side==='player').map(u=>u.id)){
  const visited=new Set();
  for(let n=0;n<20&&b.status==='active';n++){
   const u=b.units.find(u=>u.id===id);if(!live(u)||u.ap<6)break;visited.add(`${u.x},${u.y}`);
   const visible=b.units.filter(t=>t.side==='enemy'&&live(t)&&teamCanSee(b,'player',t));if(visible.length)known=visible.map(({x,y})=>({x,y}));const c=actionCosts(b,u),opts=[];
   if(u.medkits&&u.bleeding&&u.hp<30)opts.push({type:'heal'});
   if(u.knockedDown)opts.push({type:'stance',stance:'standing'});
   if(u.jammed)opts.push({type:'reprime'});
   const adjacent=visible.filter(t=>dist(u,t)<=bladeFor(u).reach).sort((a,b)=>a.hp-b.hp);if(adjacent[0])opts.push({type:'melee',targetId:adjacent[0].id});
   if(hasFirearm(u)&&u.loaded&&!u.jammed){
    const shots=visible.map(t=>{let aim=0;while(aim<4&&c.fire+(aim+1)*c.aim<=u.ap&&shotChance(b,u,t,aim)<75)aim++;const chance=shotChance(b,u,t,aim);return {t,aim,chance,score:chance*Math.min(t.hp,weaponFor(u).damage)};}).filter(x=>x.chance>=30).sort((a,b)=>b.score-a.score);
    if(shots[0])opts.push({type:'fire',targetId:shots[0].t.id,aim:shots[0].aim});
   }
   if(hasFirearm(u)&&!u.loaded&&u.ammo&&visible.length)opts.push({type:'reload'});
   const goal=visible.length?visible:known.length?known:[{x:b.width-3,y:Math.round(b.height/2)}];
   const currentDistance=Math.min(...goal.map(t=>dist(u,t)));
   const moves=getReachable(b,u).filter(p=>p.cost>0&&!visited.has(`${p.x},${p.y}`));
   const scored=moves.map(p=>{const actor={...u,x:p.x,y:p.y},distance=Math.min(...goal.map(t=>dist(p,t))),cover=b.tiles.find(t=>t.x===p.x&&t.y===p.y)?.cover??0,chance=visible.length?Math.max(...visible.map(t=>shotChance(b,actor,t,2))):0;return {p,distance,score:visible.length?chance*.7+cover*.7-Math.max(0,5-distance)*12-p.cost*.2:-distance-p.cost*scoutCostWeight};}).filter(x=>visible.length?x.distance>=3||!hasFirearm(u):x.distance<currentDistance).sort((a,b)=>b.score-a.score);
   const currentScore=visible.length?Math.max(...visible.map(t=>shotChance(b,u,t,2)))*.7+(b.tiles.find(t=>t.x===u.x&&t.y===u.y)?.cover??0)*.7-Math.max(0,5-currentDistance)*12:-currentDistance;
   if(scored[0]&&scored[0].score>currentScore+2)opts.push({type:'move',x:scored[0].p.x,y:scored[0].p.y});
   if(hasFirearm(u)&&!u.loaded&&u.ammo)opts.push({type:'reload'});
   let done=false;for(const a of opts){const next=actBattle(b,{...a,unitId:id});if(!next.lastError){b=next;orders.push({...a,unitId:id});actions++;done=true;break;}}if(!done)break;
  }
 }
 if(b.status==='active'){b=endTurn(b);orders.push({type:'endTurn'});}
}
return {battle:b,actions,orders};}
