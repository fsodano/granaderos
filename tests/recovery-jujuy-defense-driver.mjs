import {stableCrewController} from './stable-crew-driver.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {playerKnownBattle} from '../game/player-known-state.js';
import {actBattle,getReachable,actionCosts,hasLineOfSight,artilleryContact,stanceCost,teamCanSee} from '../game/tactical.js';

// The actual raid keeps its accepted shared-sight battery policy. Only the
// critical medic approach and normal-null public quiet search add orders.
export const preparedDefenseHoldController=(()=>{
// Defense correction: do not abandon the real supplied battery
// before the actual attacking column reaches current sight.
function preparedDefenseHoldController(){
 const stable=stableCrewController();
 return(b,u)=>{
  const visible=b.units.some(v=>v.side==='enemy'&&v.hp>=15&&!v.routed&&!v.departure&&!v.unconscious&&!v.surrendered&&teamCanSee(b,u.side,v));
  if(b.mode!=='exploration'||visible)return stable(b,u);
  const normal=tucumanCombatOrder(b,u),valid=a=>a&&!actBattle(b,a).lastError?a:null;
  if(u.knockedDown||u.entangled||normal?.type==='useItem'||normal?.slot==='medical')return valid(normal);
  if(normal&&!['move','climb','charge','artilleryMove','exit','stance'].includes(normal.type))return valid(normal);
  const gun=b.artillery.find(g=>g.side===u.side&&(g.loaded||g.ammo>0)&&artilleryContact(b,u,g));
  if(gun&&u.stance==='standing'&&u.ap>=stanceCost(u,'crouched'))return valid({type:'stance',unitId:u.id,stance:'crouched'});
  return normal?.type==='stance'&&normal.stance!=='standing'&&(!gun||normal.stance==='crouched')?valid(normal):null;
 };
}

return preparedDefenseHoldController;
})();
export const preparedDefenseZeroCriticalAid=(()=>{
// Keep the original successful battery orders and attack. Its medic lacked
// only the paid approach needed to treat the actual critical wound to 0.
function preparedDefenseZeroCriticalAid({report=()=>{}}={}){
 const base=preparedDefenseHoldController();
 return(b,u)=>{
  const action=base(b,u),patient=b.units.find(v=>v.id==='0');
  if(u.id!=='123'||b.phase!=='player'||!patient||patient.hp<=0||patient.hp>=15||patient.departure||u.medkits<=0||u.medical<=0)return action;
  if(Math.hypot(u.x-patient.x,u.y-patient.y)<=1.5&&hasLineOfSight(b,u,patient))return action;
  const cost=actionCosts(b,u),reserve=cost.heal+(u.activeSlot==='medical'?0:cost.weapon),known=playerKnownBattle(b),cells=new Set(known.tiles.filter(p=>!p.blocked&&(p.tacticalLevel??0)===0).map(p=>`${p.x},${p.y}`));
  const view={...b,tiles:known.tiles,props:known.props,npcs:known.npcs,upperSurfaces:known.upperSurfaces??[],climbLinks:known.climbLinks??[],units:b.units.filter(v=>v.side==='player'||known.units.some(w=>w.id===v.id))};
  const points=getReachable(view,u).filter(p=>p.cost>0&&p.cost<=Math.min(30,u.ap-reserve)&&(p.tacticalLevel??0)===0&&p.path.every(v=>(v.tacticalLevel??0)===0&&cells.has(`${v.x},${v.y}`))&&Math.hypot(p.x-patient.x,p.y-patient.y)<=1.5).sort((a,c)=>a.cost-c.cost||a.y-c.y||a.x-c.x);
  for(const p of points){const move={type:'move',unitId:u.id,x:p.x,y:p.y,tacticalLevel:0},next=actBattle(b,move),doctor=next.units.find(v=>v.id===u.id),wounded=next.units.find(v=>v.id===patient.id);if(next.lastError||!hasLineOfSight(next,doctor,wounded))continue;report({event:'actualZeroCriticalAidApproach',action:move,path:p,turn:b.turn,elapsed:b.elapsedSeconds,patientHP:patient.hp});return move;}
  return action;
 };
}

return preparedDefenseZeroCriticalAid;
})();
export const preparedDefenseZeroAidQuietSearch=(()=>{
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),present=u=>u&&u.hp>=15&&!u.unconscious&&!u.departure&&!u.routed&&!u.surrendered;
// Preserve original combat and the proved critical aid. Only a normal-null,
// quiet decision may regroup or search through currently known ground.
function preparedDefenseZeroAidQuietSearch({report=()=>{}}={}){
 const base=preparedDefenseZeroCriticalAid({report}),buddyIds=new Map([['0','123'],['123','0'],['142','128'],['128','142'],['5','123']]);
 let lastVisible=-Infinity,lastElapsed=-1,lastTurn=-1;
 return(b,u)=>{
  if(b.elapsedSeconds<lastElapsed||b.turn<lastTurn)lastVisible=-Infinity;
  lastElapsed=b.elapsedSeconds;lastTurn=b.turn;
  const targets=b.units.filter(v=>v.side==='enemy'&&v.hp>=15&&!v.routed&&!v.unconscious&&!v.surrendered&&!v.departure&&teamCanSee(b,'player',v));if(targets.length)lastVisible=b.turn;
  const normal=base(b,u);if(normal)return normal;
  if(b.phase!=='player'||b.mode!=='exploration'||targets.length||!Number.isFinite(lastVisible)||b.turn-lastVisible<3||b.artillery.some(g=>g.side==='player'&&(g.loaded||g.ammo>0)))return null;
  const field=[...buddyIds.keys()].map(id=>b.units.find(v=>v.id===id));if(field.some(v=>!present(v)||v.bleeding>0))return null;
  const buddy=b.units.find(v=>v.id===buddyIds.get(u.id));if(!present(buddy))return null;
  const valid=a=>a&&!actBattle(b,a).lastError?a:null,known=playerKnownBattle(b),cells=new Set(known.tiles.filter(p=>!p.blocked&&(p.tacticalLevel??0)===0).map(p=>`${p.x},${p.y}`));
  const view={...b,tiles:known.tiles,props:known.props,npcs:known.npcs,upperSurfaces:known.upperSurfaces??[],climbLinks:known.climbLinks??[],units:b.units.filter(v=>v.side==='player'||known.units.some(w=>w.id===v.id))};
  const ground=p=>(p.tacticalLevel??0)===0&&p.path.every(v=>(v.tacticalLevel??0)===0&&cells.has(`${v.x},${v.y}`)),band=p=>Math.max(...field.filter(v=>v.id!==u.id).map(v=>distance(p,v))),currentBand=band(u);
  const coherent=field.every(v=>distance(v,b.units.find(w=>w.id===buddyIds.get(v.id)))<=1.5)&&field.every(v=>field.every(w=>distance(v,w)<=4.5));
  if(!coherent){
   if(distance(u,buddy)<=1.5||u.hp<u.maxHp)return null;
   const points=getReachable(view,u).filter(p=>ground(p)&&p.cost>0&&p.cost<=Math.min(30,u.ap-20)&&distance(p,buddy)<distance(u,buddy)&&(band(p)<=4.5||band(p)<currentBand)).sort((a,c)=>distance(a,buddy)-distance(c,buddy)||a.cost-c.cost);
   if(points[0]){const action={type:'move',unitId:u.id,x:points[0].x,y:points[0].y,tacticalLevel:0};report({event:'actualRaidQuietAidRegroup',action,path:points[0],buddy:buddy.id,turn:b.turn,elapsed:b.elapsedSeconds});return valid(action);}return null;
  }
  const corners=[[.25,.25],[.75,.25],[.75,.75],[.25,.75]],corner=corners[Math.floor((b.turn-lastVisible-3)/8)%corners.length],goal={x:Math.floor(b.width*corner[0]),y:Math.floor(b.height*corner[1])};
  if(distance(u,goal)<=3)return null;
  if(u.stance!=='standing'&&u.ap>=stanceCost(u,'standing'))return valid({type:'stance',unitId:u.id,stance:'standing'});
  const points=getReachable(view,u).filter(p=>ground(p)&&p.cost>0&&p.cost<=Math.min(30,u.ap-20)&&distance(p,goal)<distance(u,goal)&&distance(p,buddy)<=1.5&&field.every(v=>v.id===u.id||distance(p,v)<=4.5)).sort((a,c)=>distance(a,goal)-distance(c,goal)||a.cost-c.cost);
  if(points[0]){const action={type:'move',unitId:u.id,x:points[0].x,y:points[0].y,tacticalLevel:0};report({event:'actualRaidKnownQuietSearch',action,path:points[0],turn:b.turn,elapsed:b.elapsedSeconds,lastVisible});return valid(action);}return null;
 };
}

return preparedDefenseZeroAidQuietSearch;
})();
