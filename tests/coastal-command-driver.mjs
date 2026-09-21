// Keep the commander behind the battery and fire from an affordable legal stance.
import {mountainBatteryOrder} from './mountain-battery-driver.mjs';
import {getReachable,teamCanSee,firearmShotOptions,actionCosts} from '../game/tactical.js';
export const coastalCommandOrder=(b,u)=>{
 const normal=mountainBatteryOrder(b,u),gun=b.artillery.find(g=>g.side===u.side);
 if(u.id==='57'&&gun&&b.mode==='exploration'&&normal?.type==='move'){
  const distance=p=>Math.hypot(gun.x-p.x,gun.y-p.y);if(distance(u)<=3)return null;
  const view={...b,units:b.units.filter(v=>v.side===u.side||teamCanSee(b,u.side,v))};
  const p=getReachable(view,u).filter(p=>p.cost>0&&p.cost<=20&&distance(p)<distance(u)&&distance(p)>=2).sort((a,c)=>distance(a)-distance(c)||a.cost-c.cost)[0];
  return p?{type:'move',unitId:u.id,x:p.x,y:p.y}:null;
 }
 if(u.id==='57'&&b.mode==='combat'&&normal?.type==='move')return null;
 if(normal||u.stance!=='crouched'||!u.loaded||u.jammed)return normal;
 const shots=[];
 for(const target of b.units.filter(v=>v.side!==u.side&&v.hp>=15&&!v.routed&&!v.surrendered&&!v.unconscious&&!v.departure&&teamCanSee(b,u.side,v))){const cost=actionCosts(b,u,target);if(u.ap<cost.fire)continue;for(const o of firearmShotOptions(b,u,target,Math.min(4,Math.floor((u.ap-cost.fire)/cost.aim))))if(o.chance>=25&&o.damageFactor>0)shots.push({score:o.chance*o.damageFactor,action:{type:'fire',unitId:u.id,targetId:target.id,aim:o.aim,hitLocation:o.hitLocation}});}
 return shots.sort((a,c)=>c.score-a.score)[0]?.action??null;
};
