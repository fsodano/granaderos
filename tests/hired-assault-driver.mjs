import assert from 'node:assert/strict';
import {combatOrder} from './opening-driver.mjs';
import {actionCosts,canSee,hasLineOfSight,shotChance,firearmShotOptions,weaponFor,getReachable} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {shotLocationEffects} from '../game/targeted-combat.js';
import {sameCell,spacePoint,tacticalLevel} from '../game/tactical-space.js';

function rooftopReconOrder(b,u){
 if(b.mode!=='exploration'||tacticalLevel(u)!==0)return null;
 // Reconnoitre toward a real roof overlooking the known sector center. The
 // former straight-to-center approach funneled the squad around one blind
 // building corner. Only authored geometry and observed occupants choose this route.
 const center={x:Math.floor(b.width*.65),y:Math.floor(b.height*.5)};
 const roofs=(b.upperSurfaces??[]).filter(p=>!p.blocked).sort((a,c)=>Math.hypot(a.x-center.x,a.y-center.y)-Math.hypot(c.x-center.x,c.y-center.y)||a.y-c.y||a.x-c.x);
 const index=b.units.filter(p=>p.side==='player').findIndex(p=>p.id===u.id),goal=roofs[index];
 if(!goal)return null;
 const perceived={...b,units:b.units.filter(v=>v.side===u.side||canSee(b,u,v))};
 const route=getReachable(perceived,u,{stopAt:p=>sameCell(p,goal)})[0],reachable=getReachable(perceived,u);
 const step=[...(route?.path??[])].reverse().map(p=>reachable.find(v=>sameCell(v,p))).find(p=>p.cost>0&&p.cost<=Math.min(40,u.ap-20));
 return step?{type:'move',unitId:u.id,...spacePoint(step)}:null;
}

function aimedShotOrder(b,u){
 const active=v=>v.hp>=15&&!v.departure&&!v.surrendered&&!v.unconscious&&!v.routed;
 const observers=b.units.filter(v=>v.side===u.side&&active(v));
 const targets=b.units.filter(v=>v.side!==u.side&&active(v)&&observers.some(p=>canSee(b,p,v)));
 const shots=[];
 // Use the same affordable body-region previews as the cursor. Their flight
 // checks include observed civilian and friendly bodies; hidden occupants do
 // not select a target or grant the squad knowledge of a blocked firing lane.
 for(const target of targets){
  const cost=actionCosts(b,u,target);if(u.ap<cost.fire)continue;
  const maxAim=Math.min(4,Math.floor((u.ap-cost.fire)/cost.aim));
  for(const option of firearmShotOptions(b,u,target,maxAim)){
   if(option.chance<25)continue;
   const damage=weaponFor(u).damage,effect=shotLocationEffects(option.hitLocation,damage*option.damageFactor,target);
   const value=Math.min(target.hp,effect.damage)+(target.hp-effect.damage<15?0:effect.breathLoss*.15+(effect.knockedDown?10:0));
   const score=option.chance*value/Math.max(1,Math.min(target.hp,damage))-(cost.fire+option.aim*cost.aim)*.2;
   shots.push({score,action:{type:'fire',unitId:u.id,targetId:target.id,aim:option.aim,hitLocation:option.hitLocation}});
  }
 }
 return shots.sort((a,b)=>b.score-a.score)[0]?.action??null;
}

export function hiredAssaultOrder(b,u){
 const reconnaissance=rooftopReconOrder(b,u);if(reconnaissance)return reconnaissance;
 const action=combatOrder(b,u);
 if(action?.type==='fire')return aimedShotOrder(b,u)??action;
 if(action?.type!=='stance'||action.stance!=='prone')return action;
 // Baker rifles take 105 PA to reload prone, against 70 PA kneeling. Keep
 // these muzzle-loaders crouched so the next volley need not wait two turns.
 // The shared controller still supplies reconnaissance, aid and maintenance.
 if(u.stance==='standing')return {...action,stance:'crouched'};
 const active=v=>v.hp>0&&!v.departure&&!v.surrendered&&!v.unconscious&&!v.routed;
 const observers=b.units.filter(v=>v.side===u.side&&active(v)&&v.hp>=15);
 const target=b.units.filter(v=>v.side!==u.side&&active(v)&&hasLineOfSight(b,u,v)&&observers.some(p=>canSee(b,p,v)))
  .sort((a,c)=>shotChance(b,u,c,4)-shotChance(b,u,a,4))[0];
 assert.ok(target,'a proposed firing posture must have an observed target');
 const cost=actionCosts(b,u,target);
 let aim=Math.min(4,Math.floor((u.ap-cost.fire)/cost.aim));
 const chance=shotChance(b,u,target,aim);
 while(aim>0&&shotChance(b,u,target,aim-1)===chance)aim--;
 if(chance>=25)return aimedShotOrder(b,u)??{type:'fire',unitId:u.id,targetId:target.id,aim};
 const automatic=chooseEnemyAction(b,u);
 return automatic?.type==='charge'?null:automatic;
}
