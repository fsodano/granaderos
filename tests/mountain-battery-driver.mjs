// Advance one gun with Barcala and Paroissien; infantry screens the crew.
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {chooseArtilleryAction} from '../game/tactical-ai-artillery.js';
import {teamArtilleryOrder} from './team-artillery-driver.mjs';
import {actBattle,teamCanSee,getReachable,stanceCost,artilleryContact,artilleryCrewPlan,artilleryCosts} from '../game/tactical.js';
import {propCells} from '../game/props.js';
import {wallMovementBlocked} from '../game/wall-geometry.js';

// Plan a rigid crew route across known ground, then execute only its first
// step through the engine. A sideways detour must not become a back-and-forth
// loop when the next direct step is still blocked by the same cart or wall.
function routedBatteryAdvance(b,u,gun,destination){
 const plan=artilleryCrewPlan(b,u,gun,artilleryCosts(b,u,gun).move);
 if(plan.reason)return null;
 const key=p=>`${p.x},${p.y}`,crew=new Set(plan.crew),offsets=[{x:0,y:0},...b.units.filter(v=>crew.has(v.id)).map(v=>({x:v.x-gun.x,y:v.y-gun.y}))];
 const ground=new Set(b.tiles.filter(t=>!t.blocked&&!['water','cliff'].includes(t.type)).map(key));
 const blocked=new Set((b.props??[]).filter(p=>p.blocksMovement!==false&&(p.tacticalLevel??0)===0).flatMap(propCells).map(key));
 const onGround=v=>(v.tacticalLevel??0)===0&&(v.hp??100)>0&&!v.departure&&!v.fled;
 for(const v of b.units)if(onGround(v)&&!crew.has(v.id)&&(v.side===u.side||teamCanSee(b,u.side,v)))blocked.add(key(v));
 for(const v of b.npcs??[])if(onGround(v))blocked.add(key(v));
 for(const g of b.artillery)if(g.id!==gun.id)blocked.add(key(g));
 const open=p=>ground.has(key(p))&&!blocked.has(key(p));
 const fits=p=>offsets.every(o=>open({x:p.x+o.x,y:p.y+o.y})&&(!o.x||!o.y||(open({x:p.x+o.x,y:p.y})&&open({x:p.x,y:p.y+o.y}))));
 const distance=p=>Math.hypot(p.x-destination.x,p.y-destination.y),queue=[{x:gun.x,y:gun.y,first:null}],seen=new Set([key(gun)]);
 let best=queue[0];
 for(let i=0;i<queue.length;i++){
  const at=queue[i];if(distance(at)<distance(best))best=at;
  if(distance(at)===0)break;
  for(const [dx,dy]of [[1,0],[0,-1],[0,1],[-1,0]]){
   const p={x:at.x+dx,y:at.y+dy};
   if(seen.has(key(p))||!fits(p)||offsets.some(o=>wallMovementBlocked(b,{x:at.x+o.x,y:at.y+o.y},{x:p.x+o.x,y:p.y+o.y})))continue;
   seen.add(key(p));queue.push({...p,first:at.first??p});
  }
 }
 if(!best.first)return null;
 const action={type:'artilleryMove',unitId:u.id,artilleryId:gun.id,...best.first};
 return actBattle(b,action).lastError?null:action;
}

export const mountainBatteryOrder=(b,u,{screenDistance=Infinity,leaderId='7',helperId='8',clearCrewLane=false,artilleryId=null,routeAroundObstacles=false,flankScreen=false,keepCrewTogether=false,sharedArtillerySight=false}={})=>{
 const assignedGun=g=>g.side===u.side&&(!artilleryId||g.id===artilleryId);
 const normal=tucumanCombatOrder(b,u);
 if(u.knockedDown||u.entangled)return normal;
 if(normal?.type==='useItem'||normal?.slot==='medical')return normal;
 // A bound helper may start outside contact with the gun. Rejoin the crew
 // through a real reachable cell before taking another exploration order.
 if(keepCrewTogether&&artilleryId&&b.mode==='exploration'&&[leaderId,helperId].includes(u.id)){
  const gun=b.artillery.find(g=>assignedGun(g)&&(g.loaded||g.ammo>0));
  if(gun&&!artilleryContact(b,u,gun)){
   const view={...b,units:b.units.filter(v=>v.side===u.side||teamCanSee(b,u.side,v))};
   const routes=getReachable(view,u).filter(p=>p.cost>0&&(p.tacticalLevel??0)===0&&artilleryContact(view,{...u,...p},gun));
   routes.sort((a,c)=>a.cost-c.cost||a.y-c.y||a.x-c.x);
   return routes[0]?{type:'move',unitId:u.id,x:routes[0].x,y:routes[0].y,tacticalLevel:0}:null;
  }
  if(gun&&u.id===helperId){
   const leader=b.units.find(v=>v.id===leaderId&&v.hp>=15&&!v.routed&&!v.unconscious&&!v.departure);
   if(leader){
    const goal={x:Math.floor(b.width*.65),y:Math.floor(b.height*.5)},distance=p=>Math.hypot(goal.x-p.x,goal.y-p.y);
    const advances=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({type:'artilleryMove',unitId:leaderId,artilleryId:gun.id,x:gun.x+dx,y:gun.y+dy})).filter(p=>distance(p)<distance(gun));
    // A cart or corner may block the translated helper, while the cannon's
    // road is open. Pay to change crew position before dragging the piece.
    if(advances.length&&!advances.some(a=>!actBattle(b,a).lastError)){
     const view={...b,units:b.units.filter(v=>v.side===u.side||teamCanSee(b,u.side,v))};
     const routes=getReachable(view,u).filter(p=>p.cost>0&&(p.tacticalLevel??0)===0&&artilleryContact(view,{...u,...p},gun)).sort((a,c)=>a.cost-c.cost||a.y-c.y||a.x-c.x);
     for(const p of routes){
      const move={type:'move',unitId:u.id,x:p.x,y:p.y,tacticalLevel:0},preview=actBattle(b,move);
      if(!preview.lastError&&advances.some(a=>!actBattle(preview,a).lastError))return move;
     }
    }
   }
  }
 }
 // Keep the infantry screen within supporting distance while approaching.
 // A scout must not spend several exploration moves outrunning the cannon.
 if(clearCrewLane&&b.mode==='exploration'&&Number.isFinite(screenDistance)&&(!normal||normal.type==='move')&&![leaderId,helperId].includes(u.id)){
  const gun=b.artillery.find(g=>assignedGun(g)&&(g.loaded||g.ammo>0));
  if(gun){
   const center={x:Math.floor(b.width*.65),y:Math.floor(b.height*.5)};
   const allowed=p=>{
    const x=p.x-gun.x,y=p.y-gun.y,dx=center.x-gun.x,dy=center.y-gun.y,distance=Math.hypot(x,y),forward=x*dx+y*dy;
    return distance>=2.5&&distance<=screenDistance&&(flankScreen?forward>=0&&Math.abs(x*dy-y*dx)>=2.5*Math.hypot(dx,dy):forward<0);
   };
   if(!normal||!allowed(normal)){
    const view={...b,units:b.units.filter(v=>v.side===u.side||teamCanSee(b,u.side,v))};
    const moves=getReachable(view,u).filter(p=>allowed(p)&&p.cost>0);
    if(allowed(u))return null;
    moves.sort((a,c)=>a.cost-c.cost);
    return moves[0]?{type:'move',unitId:u.id,x:moves[0].x,y:moves[0].y,tacticalLevel:moves[0].tacticalLevel??0}:null;
   }
  }
 }
 if(b.mode==='exploration'&&normal?.type==='move'&&![leaderId,helperId].includes(u.id)){
  const gun=b.artillery.find(g=>assignedGun(g)&&(g.loaded||g.ammo>0));
  if(gun&&Math.hypot(normal.x-gun.x,normal.y-gun.y)>screenDistance){
   const view={...b,units:b.units.filter(v=>v.side===u.side||teamCanSee(b,u.side,v))};
   const route=getReachable(view,u).find(p=>p.x===normal.x&&p.y===normal.y&&(p.tacticalLevel??0)===(normal.tacticalLevel??0));
   const step=route&&[...route.path].reverse().find(p=>Math.hypot(p.x-gun.x,p.y-gun.y)<=screenDistance&&(p.x!==u.x||p.y!==u.y));
   return step?{...normal,x:step.x,y:step.y,tacticalLevel:step.tacticalLevel??0}:null;
  }
 }
 const near=b.artillery.some(g=>assignedGun(g)&&(g.loaded||g.ammo>0)&&Math.hypot(g.x-u.x,g.y-u.y)<=1.5);
 if(!near)return normal;
 if(b.mode==='exploration'&&[leaderId,helperId].includes(u.id)){
  if(u.id===helperId)return null;
  const gun=b.artillery.find(g=>assignedGun(g)&&(g.loaded||g.ammo>0)&&Math.hypot(g.x-u.x,g.y-u.y)<=1.5),dest={x:Math.floor(b.width*.65),y:Math.floor(b.height*.5)},dist=p=>Math.hypot(dest.x-p.x,dest.y-p.y);
  if(routeAroundObstacles)return routedBatteryAdvance(b,u,gun,dest);
  for(const p of [[-1,0],[0,-1],[0,1],[1,0]].map(([dx,dy])=>({x:gun.x+dx,y:gun.y+dy})).filter(p=>dist(p)<dist(gun)).sort((a,c)=>dist(a)-dist(c))){const a={type:'artilleryMove',unitId:u.id,artilleryId:gun.id,...p};if(!actBattle(b,a).lastError)return a;}
  return null;
 }
 if(u.stance==='prone'&&u.ap>=stanceCost(u,'crouched'))return {type:'stance',unitId:u.id,stance:'crouched'};
 const view={...b,units:b.units.filter(v=>v.side===u.side||teamCanSee(b,u.side,v))};
 const targets=b.units.filter(v=>v.side!==u.side&&v.hp>=15&&!v.routed&&!v.surrendered&&!v.unconscious&&!v.departure&&teamCanSee(b,u.side,v));
 const artilleryOrder=sharedArtillerySight?teamArtilleryOrder:chooseArtilleryAction;
 const artillery=artilleryOrder(artilleryId?{...b,artillery:b.artillery.filter(assignedGun)}:b,u,targets,()=>getReachable(view,u));
 if(artillery)return artillery;
 // A screened gun cannot shoot through friendly infantry. Bring it forward
 // along the known approach instead of leaving both crew idle behind the line.
 if(u.id===leaderId&&b.phase!=='interrupt'&&targets.length){
  const gun=b.artillery.find(g=>assignedGun(g)&&Math.hypot(g.x-u.x,g.y-u.y)<=1.5);
  if(gun?.loaded){
   const destination={x:Math.floor(b.width*.65),y:Math.floor(b.height*.5)},distance=p=>Math.hypot(destination.x-p.x,destination.y-p.y);
   for(const point of [[-1,0],[0,-1],[0,1],[1,0]].map(([dx,dy])=>({x:gun.x+dx,y:gun.y+dy})).filter(p=>distance(p)<distance(gun)).sort((a,c)=>distance(a)-distance(c))){const action={type:'artilleryMove',unitId:u.id,artilleryId:gun.id,...point};if(!actBattle(b,action).lastError)return action;}
  }
 }
 return normal?.type==='stance'&&normal.stance==='prone'?(u.stance==='standing'?{...normal,stance:'crouched'}:null):normal;
};

// The Los Patos approach uses a close screen to keep the gun in support.
export const closeMountainBatteryOrder=(battle,unit)=>mountainBatteryOrder(battle,unit,{screenDistance:3});

// Keep the infantry outside the heavy gun's next crew positions. Once contact
// starts, hold the firing position instead of pushing the crew into the enemy.
export const mendozaBatteryOrder=(battle,unit)=>{
 const action=mountainBatteryOrder(battle,unit,{leaderId:'101',helperId:'102',screenDistance:3,clearCrewLane:true});
 if(battle.mode==='combat'&&action?.type==='artilleryMove')return unit.stance==='standing'&&unit.ap>=stanceCost(unit,'crouched')?{type:'stance',unitId:unit.id,stance:'crouched'}:null;
 return action;
};

// Assign each nearby pair from the actual deployed friendly positions. The
// cannon identity stays fixed when two guns move into one crew's reach.
export function assignedMountainBatteryController(initial){
 const assigned=new Set();
 const crews=initial.artillery.filter(g=>g.side==='player').map(g=>{
  const ids=initial.units.filter(u=>u.side==='player'&&u.hp>0&&!assigned.has(u.id))
   .sort((a,b)=>Math.hypot(a.x-g.x,a.y-g.y)-Math.hypot(b.x-g.x,b.y-g.y)||String(a.id).localeCompare(String(b.id)))
   .slice(0,2).map(u=>u.id);
  for(const id of ids)assigned.add(id);
  return {ids,artilleryId:g.id};
 });
 return (battle,unit)=>{
  const crew=crews.find(p=>p.ids.includes(unit.id))??crews[0];
  return crew?mountainBatteryOrder(battle,unit,{leaderId:crew.ids[0],helperId:crew.ids[1],artilleryId:crew.artilleryId,screenDistance:3}):tucumanCombatOrder(battle,unit);
 };
}
