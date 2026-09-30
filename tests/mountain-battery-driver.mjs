// Advance one gun with Barcala and Paroissien; infantry screens the crew.
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {chooseArtilleryAction} from '../game/tactical-ai-artillery.js';
import {actBattle,teamCanSee,getReachable,stanceCost} from '../game/tactical.js';
export const mountainBatteryOrder=(b,u,{screenDistance=Infinity,leaderId='7',helperId='8'}={})=>{
 const normal=tucumanCombatOrder(b,u);
 if(u.knockedDown||u.entangled)return normal;
 if(normal?.type==='useItem'||normal?.slot==='medical')return normal;
 // Keep the infantry screen within supporting distance while approaching.
 // A scout must not spend several exploration moves outrunning the cannon.
 if(b.mode==='exploration'&&normal?.type==='move'&&![leaderId,helperId].includes(u.id)){
  const gun=b.artillery.find(g=>g.side===u.side&&(g.loaded||g.ammo>0));
  if(gun&&Math.hypot(normal.x-gun.x,normal.y-gun.y)>screenDistance){
   const view={...b,units:b.units.filter(v=>v.side===u.side||teamCanSee(b,u.side,v))};
   const route=getReachable(view,u).find(p=>p.x===normal.x&&p.y===normal.y&&(p.tacticalLevel??0)===(normal.tacticalLevel??0));
   const step=route&&[...route.path].reverse().find(p=>Math.hypot(p.x-gun.x,p.y-gun.y)<=screenDistance&&(p.x!==u.x||p.y!==u.y));
   return step?{...normal,x:step.x,y:step.y,tacticalLevel:step.tacticalLevel??0}:null;
  }
 }
 const near=b.artillery.some(g=>g.side===u.side&&(g.loaded||g.ammo>0)&&Math.hypot(g.x-u.x,g.y-u.y)<=1.5);
 if(!near)return normal;
 if(b.mode==='exploration'&&[leaderId,helperId].includes(u.id)){
  if(u.id===helperId)return null;
  const gun=b.artillery.find(g=>g.side===u.side&&(g.loaded||g.ammo>0)&&Math.hypot(g.x-u.x,g.y-u.y)<=1.5),dest={x:Math.floor(b.width*.65),y:Math.floor(b.height*.5)},dist=p=>Math.hypot(dest.x-p.x,dest.y-p.y);
  for(const p of [[-1,0],[0,-1],[0,1],[1,0]].map(([dx,dy])=>({x:gun.x+dx,y:gun.y+dy})).filter(p=>dist(p)<dist(gun)).sort((a,c)=>dist(a)-dist(c))){const a={type:'artilleryMove',unitId:u.id,artilleryId:gun.id,...p};if(!actBattle(b,a).lastError)return a;}
  return null;
 }
 if(u.stance==='prone'&&u.ap>=stanceCost(u,'crouched'))return {type:'stance',unitId:u.id,stance:'crouched'};
 const view={...b,units:b.units.filter(v=>v.side===u.side||teamCanSee(b,u.side,v))};
 const targets=b.units.filter(v=>v.side!==u.side&&v.hp>=15&&!v.routed&&!v.surrendered&&!v.unconscious&&!v.departure&&teamCanSee(b,u.side,v));
 const artillery=chooseArtilleryAction(b,u,targets,()=>getReachable(view,u));
 if(artillery)return artillery;
 // A screened gun cannot shoot through friendly infantry. Bring it forward
 // along the known approach instead of leaving both crew idle behind the line.
 if(u.id===leaderId&&b.phase!=='interrupt'&&targets.length){
  const gun=b.artillery.find(g=>g.side===u.side&&Math.hypot(g.x-u.x,g.y-u.y)<=1.5);
  if(gun?.loaded){
   const destination={x:Math.floor(b.width*.65),y:Math.floor(b.height*.5)},distance=p=>Math.hypot(destination.x-p.x,destination.y-p.y);
   for(const point of [[-1,0],[0,-1],[0,1],[1,0]].map(([dx,dy])=>({x:gun.x+dx,y:gun.y+dy})).filter(p=>distance(p)<distance(gun)).sort((a,c)=>distance(a)-distance(c))){const action={type:'artilleryMove',unitId:u.id,artilleryId:gun.id,...point};if(!actBattle(b,action).lastError)return action;}
  }
 }
 return normal?.type==='stance'&&normal.stance==='prone'?(u.stance==='standing'?{...normal,stance:'crouched'}:null):normal;
};

// The Los Patos approach uses a close screen to keep the gun in support.
export const closeMountainBatteryOrder=(battle,unit)=>mountainBatteryOrder(battle,unit,{screenDistance:3});
