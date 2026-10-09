// Acceptance controller: ordinary orders only, with visible targets and remembered
// positions. It cannot grant AP, supplies, health, territory or a battle outcome.
// This is one reproducible strategy, not the game AI or a general balance proof.
// Prefer cover to unfinished loading; complete an affordable charge first and
// spend otherwise unused AP on the remaining partial work.
// Reserve AP for fire, use affordable aimed fire, treat bleeding and search past cleared
// remembered positions. avoidCivilians filters shots through visible residents;
// holdPosition keeps selected actors at their actual entry cells. They can still
// fire, reload and bandage, and retain the same risks and costs. When only
// reserves remain, they must advance; they cannot keep each other waiting.
import {automaticOrder} from '../game/autonomous-orders.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,reloadPlan,getReachable,bladeFor,weaponFor,actionCosts,hasFirearm,shotChance,teamCanSee,interruptAvailable,firearmShotOptions,stanceCost} from '../game/tactical.js';
import {spacePoint,spaceKey,sameSurface} from '../game/tactical-space.js';
import {shotLocationEffects} from '../game/targeted-combat.js';
import {sectorSearchOrder} from './sector-search-driver.mjs';
import {fight as recordedFight} from './opening-driver.mjs';
import {cautiousCombatOrder} from './cautious-driver.mjs';
import {firstAidPlan} from '../game/first-aid.js';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),live=u=>u.hp>0&&!u.routed&&!u.unconscious;
const clearOfCivilians=(b,u,t)=>{const dx=t.x-u.x,dy=t.y-u.y,length=dx*dx+dy*dy;return !b.npcs.some(n=>{if(n.hp<=0||!teamCanSee(b,'player',n))return false;const f=((n.x-u.x)*dx+(n.y-u.y)*dy)/length;return f>0&&f<1&&Math.hypot(n.x-u.x-f*dx,n.y-u.y-f*dy)<.8;});};
export function fight(request,previous=null,{scoutCostWeight=.1,avoidCivilians=false,holdPosition=[],fallbackOrders=false}={}){
 if(request.sector==='buenos_aires')return recordedFight(request,previous,{controller:(battle,unit)=>{
  // Capital contact uses the current known-state cover/aid/fire decisions,
  // including useful paid prone fire, instead of the old crouched rush.
  const action=cautiousCombatOrder(battle,unit);
  const hold=holdPosition.includes(unit.id)&&battle.units.some(other=>other.id!==unit.id&&!holdPosition.includes(other.id)&&other.side==='player'&&live(other)&&!other.departure&&!other.surrendered);
  if(hold&&['move','charge','climb','exit'].includes(action?.type))return null;
  const target=action?.targetId&&battle.units.find(other=>other.id===action.targetId);
  if(avoidCivilians&&action?.type==='fire'&&target&&!clearOfCivilians(battle,unit,target))return null;
  return action;
 }});
 let b=enterSector(request,previous),actions=0;const orders=[];let known=[];
for(let window=0;window<600&&b.turn<=80&&b.status==='active';window++){
 const ids=b.units.filter(u=>u.side==='player'&&!u.militia).map(u=>u.id),visitedByActor=new Map(ids.map(id=>[id,new Set()]));
 // Give each soldier one order before returning to the first. Short scouting
 // bounds keep the squad together while contact can interrupt any move.
 for(let attempt=0;attempt<20&&b.status==='active';attempt++){
  let acted=false;
  for(const id of ids){
   const u=b.units.find(u=>u.id===id);if(b.status!=='active'||!live(u)||!interruptAvailable(b,u)||u.ap<6)continue;const visited=visitedByActor.get(id);visited.add(spaceKey(u));
   const hold=holdPosition.includes(u.id)&&b.units.some(other=>other.id!==u.id&&!holdPosition.includes(other.id)&&other.side==='player'&&live(other)&&!other.departure&&!other.surrendered);
   const visible=b.units.filter(t=>t.side==='enemy'&&live(t)&&teamCanSee(b,'player',t));if(visible.length)known=visible.map(spacePoint);if(!visible.length&&known.every(p=>teamCanSee(b,'player',p)))known=[];
   // Evaluate each candidate only after earlier ordinary orders refuse it.
   // A successful order ends the generator before unused path/shot previews.
   function* candidates(){
    if(u.bleeding&&firstAidPlan(u,u).valid)yield (u.activeSlot==='medical'?{type:'heal'}:{type:'weapon',slot:'medical'});
    else if(u.activeSlot==='medical')yield ({type:'weapon',slot:'primary'});
    if(!visible.length&&u.stance==='prone')yield ({type:'stance',stance:'standing'});
    if(u.knockedDown)yield ({type:'stance',stance:'standing'});
    if(visible.length&&u.loaded&&u.stance==='standing'&&!u.mounted&&visible.every(t=>dist(u,t)>2)&&u.ap>=stanceCost(u,'crouched')+actionCosts(b,{...u,stance:'crouched',weaponReady:false},visible[0]).fire+12)yield ({type:'stance',stance:'crouched'});
    if(!u.loaded&&u.stance==='prone')yield ({type:'stance',stance:'crouched'});
    if(u.jammed)yield ({type:'reprime'});
    const adjacent=visible.filter(t=>sameSurface(u,t)&&dist(u,t)<=bladeFor(u).reach).sort((a,b)=>a.hp-b.hp);if(adjacent[0])yield ({type:'melee',targetId:adjacent[0].id});
    if(hasFirearm(u)&&u.loaded&&!u.jammed){
     const shots=[];
     // Use the game's current, visible body-region previews. A wall can block
     // a torso shot while the head is exposed. Previewed bodies also protect
     // known civilians and teammates without reading hidden occupants.
     for(const t of visible){
      const cost=actionCosts(b,u,t);if(u.ap<cost.fire)continue;
      for(const shot of firearmShotOptions(b,u,t,Math.min(4,Math.floor((u.ap-cost.fire)/cost.aim)))){
       if(shot.chance<25)continue;
       const effect=shotLocationEffects(shot.hitLocation,weaponFor(u).damage*shot.damageFactor,t);
       const score=shot.chance*(Math.min(t.hp,effect.damage)+(t.hp-effect.damage<15?15:0))-(cost.fire+shot.aim*cost.aim)*.2;
       shots.push({t,...shot,score});
      }
     }
     shots.sort((a,b)=>b.score-a.score);
     if(shots[0])yield ({type:'fire',targetId:shots[0].t.id,aim:shots[0].aim,hitLocation:shots[0].hitLocation});
    }
    if(hasFirearm(u)&&!u.loaded&&u.ammo&&visible.length&&!reloadPlan(u,b).partial)yield ({type:'reload'});
    if(!hold&&!visible.length&&!known.length&&b.turn>=20){const search=sectorSearchOrder(b,u);if(search)yield search;}
    const goal=visible.length?visible:known.length?known:[{x:b.width-3,y:Math.round(b.height/2)}];
    const currentDistance=Math.min(...goal.map(t=>dist(u,t)));
    const moves=(hold?[]:getReachable(b,u)).filter(p=>p.cost>0&&p.cost<=Math.min(32,Math.max(0,u.ap-30))&&!visited.has(spaceKey(p)));
    const scored=moves.map(p=>{const actor={...u,...spacePoint(p)},distance=Math.min(...goal.map(t=>dist(p,t))),cover=b.tiles.find(t=>t.x===p.x&&t.y===p.y)?.cover??0,chance=visible.length?Math.max(...visible.map(t=>Math.max(shotChance(b,actor,t,2),shotChance(b,actor,t,2,'head')))):0;return {p,distance,score:visible.length?chance*.7+cover*.7-Math.max(0,5-distance)*12-p.cost*.2:-distance-p.cost*scoutCostWeight};}).filter(x=>visible.length?x.distance>=3||!hasFirearm(u):x.distance<currentDistance).sort((a,b)=>b.score-a.score);
    const currentScore=visible.length?Math.max(...visible.map(t=>Math.max(shotChance(b,u,t,2),shotChance(b,u,t,2,'head'))))*.7+(b.tiles.find(t=>t.x===u.x&&t.y===u.y)?.cover??0)*.7-Math.max(0,5-currentDistance)*12:-currentDistance;
    if(scored[0]&&scored[0].score>currentScore+2)yield ({type:'move',...spacePoint(scored[0].p)});
    if(hasFirearm(u)&&!u.loaded&&u.ammo)yield ({type:'reload'});
   }
   let done=false;for(const a of candidates()){const next=actBattle(b,{...a,unitId:id});if(!next.lastError){b=next;orders.push({...a,unitId:id});actions++;done=true;break;}}if(!done&&fallbackOrders){const fallback=automaticOrder(b,u),target=fallback?.targetId&&b.units.find(t=>t.id===fallback.targetId);if(fallback&&!(hold&&['move','charge','climb','exit'].includes(fallback.type))&&!(avoidCivilians&&fallback.type==='fire'&&target&&!clearOfCivilians(b,u,target))){const next=actBattle(b,{...fallback,unitId:id});if(!next.lastError){b=next;orders.push({...fallback,unitId:id});actions++;done=true;}}}if(done)acted=true;
  }
  if(!acted)break;
 }
 if(b.status==='active'){b=endTurn(b);orders.push({type:'endTurn'});}
}
return {battle:b,actions,orders};}
