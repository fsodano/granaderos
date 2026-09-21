// Advance one gun with Barcala and Paroissien; infantry screens the crew.
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {chooseArtilleryAction} from '../game/tactical-ai-artillery.js';
import {actBattle,teamCanSee,getReachable,stanceCost} from '../game/tactical.js';
export const mountainBatteryOrder=(b,u)=>{
 const normal=tucumanCombatOrder(b,u);
 if(normal?.type==='useItem'||normal?.slot==='medical')return normal;
 const near=b.artillery.some(g=>g.side===u.side&&(g.loaded||g.ammo>0)&&Math.hypot(g.x-u.x,g.y-u.y)<=1.5);
 if(!near)return normal;
 if(b.mode==='exploration'&&['7','8'].includes(u.id)){
  if(u.id==='8')return null;
  const gun=b.artillery[0],dest={x:Math.floor(b.width*.65),y:Math.floor(b.height*.5)},dist=p=>Math.hypot(dest.x-p.x,dest.y-p.y);
  for(const p of [[-1,0],[0,-1],[0,1],[1,0]].map(([dx,dy])=>({x:gun.x+dx,y:gun.y+dy})).filter(p=>dist(p)<dist(gun)).sort((a,c)=>dist(a)-dist(c))){const a={type:'artilleryMove',unitId:u.id,artilleryId:gun.id,...p};if(!actBattle(b,a).lastError)return a;}
  return null;
 }
 if(u.stance==='prone'&&u.ap>=stanceCost(u,'crouched'))return {type:'stance',unitId:u.id,stance:'crouched'};
 const view={...b,units:b.units.filter(v=>v.side===u.side||teamCanSee(b,u.side,v))};
 const targets=b.units.filter(v=>v.side!==u.side&&v.hp>=15&&!v.routed&&!v.surrendered&&!v.unconscious&&!v.departure&&teamCanSee(b,u.side,v));
 return chooseArtilleryAction(b,u,targets,()=>getReachable(view,u))??(normal?.type==='stance'&&normal.stance==='prone'?(u.stance==='standing'?{...normal,stance:'crouched'}:null):normal);
};
