// Prepared artillery custody tests coordinate the actual crew and infantry.
// A working owned gun uses the existing battery policy and ordinary paid
// movement, pivot, fire and reload orders. No outcome or equipment is assigned.
import {automaticOrder} from '../game/autonomous-orders.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,reloadPlan,getReachable,bladeFor,weaponFor,actionCosts,hasFirearm,shotChance,teamCanSee,interruptAvailable} from '../game/tactical.js';
import {spacePoint,spaceKey,sameSurface} from '../game/tactical-space.js';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {fight as coordinatedFight} from './opening-driver.mjs';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),live=u=>u.hp>0&&!u.routed&&!u.unconscious;
const clearOfCivilians=(b,u,t)=>{const dx=t.x-u.x,dy=t.y-u.y,length=dx*dx+dy*dy;return !b.npcs.some(n=>{if(n.hp<=0||!teamCanSee(b,'player',n))return false;const f=((n.x-u.x)*dx+(n.y-u.y)*dy)/length;return f>0&&f<1&&Math.hypot(n.x-u.x-f*dx,n.y-u.y-f*dy)<.8;});};
export function fight(request,previous=null,{scoutCostWeight=.1,avoidCivilians=false,holdPosition=[],fallbackOrders=false,reserveCharges=0}={}){let b=enterSector(request,previous),actions=0;const orders=[];let known=[];
if(b.artillery.some(g=>g.side==='player'&&(g.loaded||g.ammo>0))){
 const batteryOrder=coastalBatteryController(b,{sharedArtillerySight:true});
 return coordinatedFight(request,previous,{controller:(state,unit)=>{
  // The crew can reserve its last owned charge and continue as infantry.
  // Keep the emplacement's real geometry in the planning view, but decline
  // its reserved ammunition. The reducer always receives the original state.
  const planning=reserveCharges>0?{...state,artillery:state.artillery.map(gun=>gun.side===unit.side&&gun.ammo+Number(gun.loaded)<=reserveCharges?{...gun,ammo:0,loaded:false}:gun)}:state;
  const action=batteryOrder(planning,unit);if(!action)return null;
  if(holdPosition.includes(unit.id)&&['move','charge','climb','exit'].includes(action.type))return null;
  const target=action.targetId&&state.units.find(row=>row.id===action.targetId);
  if(avoidCivilians&&action.type==='fire'&&target&&!clearOfCivilians(state,unit,target))return null;
  return action;
 }});
}
for(let window=0;window<600&&b.turn<=80&&b.status==='active';window++){
 for(const id of b.units.filter(u=>u.side==='player'&&!u.militia).map(u=>u.id)){
  const visited=new Set();
  for(let n=0;n<20&&b.status==='active';n++){
   const u=b.units.find(u=>u.id===id);if(!live(u)||!interruptAvailable(b,u)||u.ap<6)break;visited.add(spaceKey(u));
   const visible=b.units.filter(t=>t.side==='enemy'&&live(t)&&teamCanSee(b,'player',t));if(visible.length)known=visible.map(spacePoint);if(!visible.length&&known.every(p=>teamCanSee(b,'player',p)))known=[];
   // Evaluate each candidate only after earlier ordinary orders refuse it.
   // A successful order ends the generator before unused path/shot previews.
   function* candidates(){
    if(u.medkits&&u.bleeding&&u.hp<u.maxHp-10)yield (u.activeSlot==='medical'?{type:'heal'}:{type:'weapon',slot:'medical'});
    else if(u.activeSlot==='medical')yield ({type:'weapon',slot:'primary'});
    if(!visible.length&&u.stance==='prone')yield ({type:'stance',stance:'standing'});
    if(u.knockedDown)yield ({type:'stance',stance:'standing'});
    if(visible.length&&u.loaded&&u.stance!=='prone'&&visible.every(t=>dist(u,t)>2))yield ({type:'stance',stance:'prone'});
    if(!u.loaded&&u.stance==='prone')yield ({type:'stance',stance:'standing'});
    if(u.jammed)yield ({type:'reprime'});
    const adjacent=visible.filter(t=>sameSurface(u,t)&&dist(u,t)<=bladeFor(u).reach).sort((a,b)=>a.hp-b.hp);if(adjacent[0])yield ({type:'melee',targetId:adjacent[0].id});
    if(hasFirearm(u)&&u.loaded&&!u.jammed){
     const shots=visible.filter(t=>!avoidCivilians||clearOfCivilians(b,u,t)).map(t=>{const shotCosts=actionCosts(b,u,t);let aim=0;while(aim<4&&shotCosts.fire+(aim+1)*shotCosts.aim<=u.ap&&shotChance(b,u,t,aim)<75)aim++;const chance=shotChance(b,u,t,aim);return {t,aim,chance,affordable:shotCosts.fire+aim*shotCosts.aim<=u.ap,score:chance*(t.hp<=weaponFor(u).damage?2:1)};}).filter(x=>x.chance>=30&&x.affordable).sort((a,b)=>b.score-a.score);
     if(shots[0])yield ({type:'fire',targetId:shots[0].t.id,aim:shots[0].aim});
    }
    if(hasFirearm(u)&&!u.loaded&&u.ammo&&visible.length&&!reloadPlan(u,b).partial)yield ({type:'reload'});
    const goal=visible.length?visible:known.length?known:[{x:b.width-3,y:Math.round(b.height/2)}];
    const currentDistance=Math.min(...goal.map(t=>dist(u,t)));
    const moves=(holdPosition.includes(u.id)?[]:getReachable(b,u)).filter(p=>p.cost>0&&p.cost<=Math.max(0,u.ap-30)&&!visited.has(spaceKey(p)));
    const scored=moves.map(p=>{const actor={...u,...spacePoint(p)},distance=Math.min(...goal.map(t=>dist(p,t))),cover=b.tiles.find(t=>t.x===p.x&&t.y===p.y)?.cover??0,chance=visible.length?Math.max(...visible.map(t=>shotChance(b,actor,t,2))):0;return {p,distance,score:visible.length?chance*.7+cover*.7-Math.max(0,5-distance)*12-p.cost*.2:-distance-p.cost*scoutCostWeight};}).filter(x=>visible.length?x.distance>=3||!hasFirearm(u):x.distance<currentDistance).sort((a,b)=>b.score-a.score);
    const currentScore=visible.length?Math.max(...visible.map(t=>shotChance(b,u,t,2)))*.7+(b.tiles.find(t=>t.x===u.x&&t.y===u.y)?.cover??0)*.7-Math.max(0,5-currentDistance)*12:-currentDistance;
    if(scored[0]&&scored[0].score>currentScore+2)yield ({type:'move',...spacePoint(scored[0].p)});
    if(hasFirearm(u)&&!u.loaded&&u.ammo)yield ({type:'reload'});
   }
   let done=false;for(const a of candidates()){const next=actBattle(b,{...a,unitId:id});if(!next.lastError){b=next;orders.push({...a,unitId:id});actions++;done=true;break;}}if(!done&&fallbackOrders){const fallback=automaticOrder(b,u),target=fallback?.targetId&&b.units.find(t=>t.id===fallback.targetId);if(fallback&&!(holdPosition.includes(u.id)&&['move','charge','climb','exit'].includes(fallback.type))&&!(avoidCivilians&&fallback.type==='fire'&&target&&!clearOfCivilians(b,u,target))){const next=actBattle(b,{...fallback,unitId:id});if(!next.lastError){b=next;orders.push({...fallback,unitId:id});actions++;done=true;}}}if(!done)break;
  }
 }
 if(b.status==='active'){b=endTurn(b);orders.push({type:'endTurn'});}
}
return {battle:b,actions,orders};}
