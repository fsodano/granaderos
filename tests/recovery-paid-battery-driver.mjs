import assert from 'node:assert/strict';
import {stableCrewController} from './stable-crew-driver.mjs';
import {stagedBatteryController} from './staged-battery-driver.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {cautiousCombatOrder} from './cautious-driver.mjs';
import {teamArtilleryOrder} from './team-artillery-driver.mjs';
import {mountainBatteryOrder} from './mountain-battery-driver.mjs';
import {sectorDeploymentModel,sectorDeploymentAction} from '../game/sector-deployment.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {actBattle,getReachable,exitPreview,teamCanSee,artilleryContact,artilleryCrewPlan,artilleryCosts,stanceCost} from '../game/tactical.js';


const knownGroundRoutes=(b,u)=>{
 const known=playerKnownBattle(b),cells=new Set(known.tiles.filter(p=>!p.blocked&&(p.tacticalLevel??0)===0).map(p=>`${p.x},${p.y}`));
 const view={...b,tiles:known.tiles,props:known.props,npcs:known.npcs,upperSurfaces:known.upperSurfaces??[],climbLinks:known.climbLinks??[],units:b.units.filter(v=>v.side==='player'||known.units.some(w=>w.id===v.id))};
 return getReachable(view,u).filter(p=>(p.tacticalLevel??0)===0&&p.path.every(v=>(v.tacticalLevel??0)===0&&cells.has(`${v.x},${v.y}`)));
};

// Route-only planners. Every candidate is issued against the complete battle.
// Shared controllers and all artillery/actor rules keep their existing defaults.
export const recoveryBronzeContactController=(()=>{
// A nearby gun uses the engine's current crew. Keep that crew crouched and
// together while firing; do not spend its turn alternating prone and crouched.
function stableCrewController(){
 const approach=stagedBatteryController();
 return (b,u)=>{
  if(b.mode==='exploration')return approach(b,u);
  const normal=tucumanCombatOrder(b,u);
  if(u.knockedDown||u.entangled||normal?.type==='useItem'||normal?.slot==='medical')return normal;
  const targets=b.units.filter(v=>v.side!==u.side&&v.hp>=15&&!v.routed&&!v.surrendered&&!v.unconscious&&!v.departure&&teamCanSee(b,u.side,v));
  const guns=b.artillery.filter(g=>g.side===u.side&&(g.loaded||g.ammo>0)&&artilleryContact(b,u,g)&&!artilleryCrewPlan(b,u,g,0).reason);
  for(const gun of guns){
   const a=teamArtilleryOrder({...b,artillery:[gun]},u,targets);if(a)return a;
  }
  if(guns.length&&!targets.some(v=>Math.hypot(v.x-u.x,v.y-u.y)<=2.5)){
   if(normal?.type==='move'||normal?.type==='stance'&&normal.stance!=='crouched')return u.stance==='standing'&&u.ap>=stanceCost(u,'crouched')?{type:'stance',unitId:u.id,stance:'crouched'}:null;
  }
  return normal;
 };
}

// A three-person heavy crew can be invalid solely because one member is
// prone. Pay for each contact member to rise before testing the whole crew;
// the default route controller above retains its existing decisions.
function heavyContactCrewController({holdCommand=true,reserveId='57'}={}){
 const base=stableCrewController();
 return (battle,unit)=>{
  const gun=!unit.knockedDown&&!unit.entangled&&battle.artillery.find(g=>g.side===unit.side&&['bronze4','field8'].includes(g.type)&&(g.loaded||g.ammo>0)&&artilleryContact(battle,unit,g));
  if(gun&&unit.stance==='prone')return unit.ap>=stanceCost(unit,'crouched')?{type:'stance',unitId:unit.id,stance:'crouched'}:null;
  if(gun){
   const targets=battle.units.filter(v=>v.side!==unit.side&&v.hp>=15&&!v.routed&&!v.surrendered&&!v.unconscious&&!v.departure&&teamCanSee(battle,unit.side,v));
   const artillery=teamArtilleryOrder({...battle,artillery:[gun]},unit,targets);if(artillery)return artillery;
  }
  const action=base(battle,unit);
  if(gun&&action?.type==='stance'&&action.stance==='prone')return null;
  return holdCommand&&unit.id===String(reserveId)&&['move','climb','charge','artilleryMove','exit'].includes(action?.type)?null:action;
 };
}

return heavyContactCrewController;
})();
export const threePairController=(()=>{
const heavyContactCrewController=recoveryBronzeContactController;
function threePairController(initial){
 const guns=initial.artillery.filter(g=>g.side==='player'&&!g.stationed&&g.type==='bronze4');assert.equal(guns.length,3);
 const pairs=[['0','5'],['123','128'],['138','142']],assigned=new Map();
 for(let n=0;n<3;n++)for(const id of pairs[n]){assert.equal(initial.units.find(u=>u.id===id)?.side,'player');const p=artilleryCrewPlan(initial,initial.units.find(u=>u.id===id),guns[n],0);assert.equal(p.reason,null);assert.deepEqual([...p.crew].sort(),[...pairs[n]].sort());assigned.set(id,{gunId:guns[n].id,ids:pairs[n]});}
 const contact=heavyContactCrewController({holdCommand:false}),approach=stagedBatteryController();
 return(b,u)=>{
  const assignment=assigned.get(u.id);assert.ok(assignment);const gun=b.artillery.find(g=>g.id===assignment.gunId);assert.ok(gun);
  const normal=tucumanCombatOrder(b,u);if(u.knockedDown||u.entangled||normal?.type==='useItem'||normal?.slot==='medical')return normal;
  const touching=artilleryContact(b,u,gun),view={...b,artillery:[gun]};let action;
  if(b.mode==='exploration'){action=approach(view,u);if(action?.type!=='artilleryMove')return null;}
  else{
   if(touching&&u.stance!=='crouched')return u.ap>=stanceCost(u,'crouched')?{type:'stance',unitId:u.id,stance:'crouched'}:null;
   action=contact(view,u);
   if(touching&&(['move','climb','charge','artilleryMove','exit'].includes(action?.type)||action?.type==='stance'&&action.stance==='prone'))return null;
  }
  if(action?.type?.startsWith('artillery')){
   const costs=artilleryCosts(b,u,gun),cost=action.type==='artilleryMove'?costs.move:action.type==='artilleryPivot'?costs.pivot:action.type==='artillery'?costs.fire:1;
   const p=artilleryCrewPlan(b,u,gun,cost,action.type==='artilleryReload');if(p.reason||[...p.crew].sort().join(',')!==[...assignment.ids].sort().join(','))return null;
   if(action.type==='artilleryMove'&&b.artillery.some(g=>g.side==='player'&&g.id!==gun.id&&(g.loaded||g.ammo>0)&&Math.hypot(g.x-action.x,g.y-action.y)<3))return null;
   if(actBattle(b,action).lastError)return null;
  }
  return action;
 };
}

return threePairController;
})();
export const assignedLightController=(()=>{

// The paid recovery route keeps fixed, physically admitted crew roles. Each actual swivel has one fixed operator
// and one nearby infantry/medical support. The full engine checks every order.
function assignedLightController(initial){
 const guns=initial.artillery.filter(g=>g.side==='player'&&!g.stationed&&g.type==='swivel');
 assert.equal(guns.length,3);
 const roles=[['0','5'],['128','123'],['138','142']],assigned=new Map();
 for(let i=0;i<guns.length;i++){
  const [operatorId,supportId]=roles[i],operator=initial.units.find(u=>u.id===operatorId);
  assert.ok(operator?.hp>=15);assert.ok(initial.units.find(u=>u.id===supportId)?.hp>=15);
  assert.deepEqual(artilleryCrewPlan(initial,operator,guns[i],artilleryCosts(initial,operator,guns[i]).move),{crew:[operatorId],reason:null});
  assigned.set(operatorId,{gunId:guns[i].id,operatorId,supportId,operator:true});
  assigned.set(supportId,{gunId:guns[i].id,operatorId,supportId,operator:false});
 }
 const approachStep=(b,u,g)=>{const options={leaderId:u.id,helperId:'none',artilleryId:g.id,sharedArtillerySight:true},direct=mountainBatteryOrder(b,u,options);return direct?.type==='artilleryMove'?direct:mountainBatteryOrder(b,u,{...options,routeAroundObstacles:true});};
 const stable=stableCrewController(),goal={x:Math.floor(initial.width*.65),y:Math.floor(initial.height*.5)};
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),capable=u=>u&&u.hp>=15&&!u.unconscious&&!u.routed&&!u.departure;
 const valid=(b,a)=>a&&!actBattle(b,a).lastError?a:null;
 return (b,u)=>{
  const role=assigned.get(u.id);assert.ok(role);const gun=b.artillery.find(g=>g.id===role.gunId);assert.ok(gun);
  const known=playerKnownBattle(b),cells=new Set(known.tiles.filter(p=>!p.blocked&&(p.tacticalLevel??0)===0).map(p=>`${p.x},${p.y}`));
  const view={...b,tiles:known.tiles,props:known.props,npcs:known.npcs,upperSurfaces:known.upperSurfaces??[],climbLinks:known.climbLinks??[],units:b.units.filter(v=>v.side==='player'||known.units.some(w=>w.id===v.id))};
  const ground=p=>(p.tacticalLevel??0)===0&&p.path.every(v=>(v.tacticalLevel??0)===0&&cells.has(`${v.x},${v.y}`));
  const normal=tucumanCombatOrder(b,u);
  if(u.knockedDown||u.entangled||normal?.type==='useItem'||normal?.slot==='medical')return valid(b,normal);
  const operator=b.units.find(v=>v.id===role.operatorId),minimum=operator?distance(operator,gun)+(String(role.operatorId).localeCompare(String(role.supportId))<0?0:.01):1.01;
  const towardGun=(destination=gun)=>{
   if(b.phase==='interrupt')return null;
   const current=distance(u,destination),dx=goal.x-destination.x,dy=goal.y-destination.y;
   const laneCells=[];
   for(const g of guns.map(v=>b.artillery.find(a=>a.id===v.id))){
    const operatorId=roles[guns.findIndex(v=>v.id===g.id)][0],operator=b.units.find(v=>v.id===operatorId);if(!capable(operator))continue;
    for(const [sx,sy]of [[1,0],[-1,0],[0,1],[0,-1]]){const a={type:'artilleryMove',unitId:operator.id,artilleryId:g.id,x:g.x+sx,y:g.y+sy};if(distance(a,goal)<distance(g,goal)&&!actBattle(b,a).lastError)laneCells.push({x:operator.x+sx,y:operator.y+sy});}
   }
   const allowed=p=>((p.x-destination.x)*dx+(p.y-destination.y)*dy<=0||Math.abs((p.x-destination.x)*dy-(p.y-destination.y)*dx)>=1.5*Math.hypot(dx,dy))&&!laneCells.some(v=>v.x===p.x&&v.y===p.y);
   const all=getReachable(view,u).filter(p=>p.cost>0&&p.cost<=Math.min(30,u.ap-20)&&ground(p)&&allowed(p));
   let routes=all.filter(p=>distance(p,destination)>=minimum&&distance(p,destination)<=3&&distance(p,gun)<=3);
   if(!routes.length&&current>3)routes=all.filter(p=>distance(p,destination)>=minimum&&distance(p,destination)<current);
   routes.sort((a,c)=>a.cost-c.cost||distance(a,destination)-distance(c,destination)||a.y-c.y||a.x-c.x);
   return routes[0]?valid(b,{type:'move',unitId:u.id,x:routes[0].x,y:routes[0].y,tacticalLevel:0}):null;
  };
  if(!role.operator){
   let destination=gun;
   if(b.mode==='exploration'&&capable(operator)&&artilleryContact(b,operator,gun)){
    const step=approachStep(b,operator,gun);
    if(step?.type==='artilleryMove'&&(distance(u,step)<minimum||distance(u,step)>3))destination=step;
   }
   if(destination!==gun||distance(u,gun)<minimum||distance(u,gun)>3){const move=towardGun(destination);if(move)return move;}
   if(b.mode==='exploration')return null;
   if(['move','climb','charge','artilleryMove','exit'].includes(normal?.type))return u.stance==='standing'&&u.ap>=stanceCost(u,'crouched')?valid(b,{type:'stance',unitId:u.id,stance:'crouched'}):null;
   if(normal?.type?.startsWith('artillery'))return null;
   return valid(b,normal);
  }
  if(!artilleryContact(b,u,gun)){
   if(b.phase==='interrupt')return null;
   const routes=getReachable(view,u).filter(p=>p.cost>0&&p.cost<=Math.min(24,u.ap-20)&&ground(p)&&artilleryContact(b,{...u,...p},gun));
   routes.sort((a,c)=>a.cost-c.cost||a.y-c.y||a.x-c.x);
   return routes[0]?valid(b,{type:'move',unitId:u.id,x:routes[0].x,y:routes[0].y,tacticalLevel:0}):null;
  }
  const assignedView={...b,artillery:[gun]};let action;
  if(b.mode==='exploration'){
   const support=b.units.find(v=>v.id===role.supportId);
   action=approachStep(b,u,gun);
   if(action?.type!=='artilleryMove')return null;
   // Support stays behind the actual assigned operator in nearest-gun
   // candidacy. Check the proposed barrel position and pay for prior support
   // movement, rather than deadlocking on the crowded pre-move geometry.
   if(capable(support)&&(distance(support,action)<minimum||distance(support,action)>3))return null;
   const others=guns.map(g=>b.artillery.find(v=>v.id===g.id)).filter(g=>g.id!==gun.id);
   // Three one-person guns need at least four cells along the narrow entry
   // corridor. Keep the actual battery within five cells; the failed global
   // dispatcher marched one swivel fifteen cells ahead.
   if(others.some(g=>distance(action,g)>5)||distance(action,goal)<Math.max(...others.map(g=>distance(g,goal)))-5)return null;
  }else{
   if(u.stance!=='crouched')return u.ap>=stanceCost(u,'crouched')?valid(b,{type:'stance',unitId:u.id,stance:'crouched'}):null;
   action=stable(assignedView,u);
   if(['move','climb','charge','artilleryMove','exit'].includes(action?.type)||action?.type==='stance'&&action.stance==='prone')return null;
  }
  if(action?.type?.startsWith('artillery')){
   assert.equal(action.artilleryId,role.gunId);
   const costs=artilleryCosts(b,u,gun),cost=action.type==='artilleryMove'?costs.move:action.type==='artilleryPivot'?costs.pivot:action.type==='artillery'?costs.fire:1;
   const crew=artilleryCrewPlan(b,u,gun,cost,action.type==='artilleryReload');
   if(crew.reason||crew.crew.length!==1||crew.crew[0]!==u.id)return null;
  }
  return valid(b,action);
 };
}

return assignedLightController;
})();
export const quietExitController=(()=>{
function quietExitController(initial,{report=()=>{}}={}){
 const corridorRow=initial.artillery.filter(g=>g.side==='player'&&!g.stationed&&g.type==='swivel')[2]?.y;assert.ok(Number.isInteger(corridorRow));const base=assignedLightController(initial);let evacuating=false,lastElapsed=-1,lastTurn=-1;
 const available=u=>u&&u.hp>=15&&!u.departure&&!u.routed&&!u.unconscious;
 return(b,u)=>{
  if(b.elapsedSeconds<lastElapsed||b.turn<lastTurn)evacuating=false;lastElapsed=b.elapsedSeconds;lastTurn=b.turn;
  const wounded=b.units.find(v=>v.id==='142'),targets=b.units.filter(v=>v.side==='enemy'&&v.hp>=15&&!v.departure&&!v.routed&&!v.unconscious&&!v.surrendered&&teamCanSee(b,'player',v));
  if(!evacuating&&available(wounded)&&wounded.hp<=50&&wounded.bleeding===0&&b.mode==='exploration'&&b.phase==='player'&&!targets.length){evacuating=true;report({event:'actualQuietEvacuationStart',turn:b.turn,elapsed:b.elapsedSeconds,hp:wounded.hp});}
  const valid=a=>a&&!actBattle(b,a).lastError?a:null;
  if(evacuating&&!wounded.departure&&['142','123','128'].includes(u.id)){
   const normal=tucumanCombatOrder(b,u);if(normal?.type==='useItem'||normal?.slot==='medical'||u.knockedDown||u.entangled)return valid(normal);
   if(b.phase!=='player')return base(b,u);
   const exit=b.exits.find(e=>e.destination==='salta');assert.ok(exit&&exit.edge==='E');
   if(u.id==='142'){
    const action={type:'exit',unitIds:[u.id],exitId:exit.id};const preview=exitPreview(b,action);
    if(preview.available){report({event:'actualEvacuationExit',action,preview,hp:u.hp});return action;}
   }
   // The actual forward row is blocked by the two healthy rear soldiers.
   // They move toward the known entry boundary, then vacate it on a legal
   // adjacent entry cell. The wounded soldier never takes the fatal south
   // detour from the recorded public route.
   const known=playerKnownBattle(b),cells=new Set(known.tiles.filter(p=>!p.blocked&&(p.tacticalLevel??0)===0).map(p=>`${p.x},${p.y}`));
   const view={...b,tiles:known.tiles,props:known.props,npcs:known.npcs,upperSurfaces:known.upperSurfaces??[],climbLinks:known.climbLinks??[],units:b.units.filter(v=>v.side==='player'||known.units.some(w=>w.id===v.id))};
   if(u.stance==='prone'&&u.ap>=stanceCost(u,'crouched'))return{type:'stance',unitId:u.id,stance:'crouched'};
   const routes=getReachable(view,u).filter(p=>p.cost>0&&p.cost<=Math.min(30,u.ap-20)&&(p.tacticalLevel??0)===0&&p.x>u.x&&p.y===corridorRow&&p.path.every(v=>(v.tacticalLevel??0)===0&&v.y===corridorRow&&cells.has(`${v.x},${v.y}`))).sort((a,c)=>c.x-a.x||a.cost-c.cost);
   let point=routes[0];
   if(u.id!=='142'&&u.x===b.width-1&&u.y===corridorRow){
    point=getReachable(view,u).filter(p=>p.x===b.width-1&&p.y!==corridorRow&&Math.abs(p.y-corridorRow)===1&&(p.tacticalLevel??0)===0&&p.cost>0&&p.cost<=Math.min(30,u.ap-20)&&p.path.every(v=>(v.tacticalLevel??0)===0&&cells.has(`${v.x},${v.y}`))).sort((a,c)=>a.cost-c.cost||a.y-c.y)[0];
   }
   if(point){const action={type:'move',unitId:u.id,x:point.x,y:point.y,tacticalLevel:0};report({event:'actualRearCorridorMove',action,path:point,turn:b.turn,elapsed:b.elapsedSeconds});return valid(action);}
   return u.id==='142'?null:base(b,u);
  }
  if(evacuating&&wounded.departure){
   const normal=tucumanCombatOrder(b,u);if(normal)return valid(normal);
   if(b.turn<20||b.phase!=='player'||targets.length)return null;
   const corners=[[.25,.25],[.75,.25],[.75,.75],[.25,.75]],corner=corners[Math.floor((b.turn-20)/4)%corners.length],goal={x:Math.floor(b.width*corner[0]),y:Math.floor(b.height*corner[1])},distance=p=>Math.hypot(p.x-goal.x,p.y-goal.y);
   if(distance(u)>3){
    if(u.stance!=='standing'&&u.ap>=stanceCost(u,'standing'))return{type:'stance',unitId:u.id,stance:'standing'};
    const known=playerKnownBattle(b),cells=new Set(known.tiles.filter(p=>!p.blocked&&(p.tacticalLevel??0)===0).map(p=>`${p.x},${p.y}`)),view={...b,tiles:known.tiles,props:known.props,npcs:known.npcs,upperSurfaces:known.upperSurfaces??[],climbLinks:known.climbLinks??[],units:b.units.filter(v=>v.side==='player'||known.units.some(w=>w.id===v.id))},point=getReachable(view,u).filter(p=>p.cost>0&&p.cost<=Math.min(30,u.ap-20)&&(p.tacticalLevel??0)===0&&p.path.every(v=>(v.tacticalLevel??0)===0&&cells.has(`${v.x},${v.y}`))&&distance(p)<distance(u)).sort((a,c)=>distance(a)-distance(c)||a.cost-c.cost)[0];
    if(point)return valid({type:'move',unitId:u.id,x:point.x,y:point.y,tacticalLevel:point.tacticalLevel??0});
   }
   return null;
  }
  return base(b,u);
 };
}

return quietExitController;
})();
export const quietExitCautiousCohesionController=(()=>{

// Recovery correction for the recorded sixteen-cell aid gap after the
// real rear exit. Every current actor, obstacle and gun stays in the engine.
function quietExitCautiousCohesionController(initial,{report=()=>{}}={}){
 const evacuation=quietExitController(initial,{report}),pairs=new Map([['0','123'],['123','0'],['5','128'],['128','5']]);
 let regrouped=false,lastElapsed=-1,lastTurn=-1;
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),present=u=>u&&u.hp>=15&&!u.departure&&!u.routed&&!u.unconscious;
 return(b,u)=>{
  if(b.elapsedSeconds<lastElapsed||b.turn<lastTurn)regrouped=false;lastElapsed=b.elapsedSeconds;lastTurn=b.turn;
  if(!b.units.find(v=>v.id==='142')?.departure)return evacuation(b,u);
  const valid=a=>a&&!actBattle(b,a).lastError?a:null,normal=regrouped?cautiousCombatOrder(b,u):tucumanCombatOrder(b,u);
  if(u.knockedDown||u.entangled||normal?.type==='useItem'||normal?.slot==='medical')return valid(normal);
  const field=[...pairs.keys()].map(id=>b.units.find(v=>v.id===id)).filter(present),buddy=b.units.find(v=>v.id===pairs.get(u.id));
  const known=playerKnownBattle(b),cells=new Set(known.tiles.filter(p=>!p.blocked&&(p.tacticalLevel??0)===0).map(p=>`${p.x},${p.y}`));
   const view={...b,tiles:known.tiles,props:known.props,npcs:known.npcs,upperSurfaces:known.upperSurfaces??[],climbLinks:known.climbLinks??[],units:b.units.filter(v=>v.side==='player'||known.units.some(w=>w.id===v.id))};
  if(!regrouped){
   regrouped=[['0','123'],['5','128']].every(([a,c])=>present(b.units.find(v=>v.id===a))&&present(b.units.find(v=>v.id===c))&&distance(b.units.find(v=>v.id===a),b.units.find(v=>v.id===c))<=1.5);
   if(!regrouped){
    if(!['123','128'].includes(u.id))return normal&&!['move','climb','charge','artilleryMove','exit'].includes(normal.type)&&!(normal.type==='stance'&&normal.stance==='standing')?valid(normal):null;
    if(normal&&!['move','climb','charge','artilleryMove','exit','stance'].includes(normal.type))return valid(normal);
    if(b.phase!=='player')return valid(normal&&!['move','climb','charge','artilleryMove','exit'].includes(normal.type)?normal:null);
    if(u.stance==='prone'&&u.ap>=stanceCost(u,'crouched'))return{type:'stance',unitId:u.id,stance:'crouched'};
    const points=getReachable(view,u).filter(p=>p.cost>0&&p.cost<=Math.min(30,u.ap-20)&&(p.tacticalLevel??0)===0&&p.path.every(v=>(v.tacticalLevel??0)===0&&cells.has(`${v.x},${v.y}`))&&distance(p,buddy)<distance(u,buddy)).sort((a,c)=>distance(a,buddy)-distance(c,buddy)||a.cost-c.cost);
    if(points[0]){const action={type:'move',unitId:u.id,x:points[0].x,y:points[0].y,tacticalLevel:0};report({event:'actualMedicalRegroup',action,path:points[0],buddyId:buddy.id,turn:b.turn,elapsed:b.elapsedSeconds});return valid(action);}
    return null;
   }
  }
  let action=normal;
  const targets=b.units.filter(v=>v.side==='enemy'&&v.hp>=15&&!v.routed&&!v.unconscious&&!v.surrendered&&!v.departure&&teamCanSee(b,'player',v));
  if(!action&&b.turn>=20&&b.phase==='player'&&!targets.length){
   const corners=[[.25,.25],[.75,.25],[.75,.75],[.25,.75]],corner=corners[Math.floor((b.turn-20)/4)%corners.length],goal={x:Math.floor(b.width*corner[0]),y:Math.floor(b.height*corner[1])},toward=p=>distance(p,goal);
   if(toward(u)>3){
    if(u.stance!=='standing'&&u.ap>=stanceCost(u,'standing'))return{type:'stance',unitId:u.id,stance:'standing'};
    action={type:'move',unitId:u.id,...goal,tacticalLevel:0};
   }
  }
  if(action?.type==='move'){
   if(b.phase!=='player'||!present(buddy))return null;
   const points=getReachable(view,u).filter(p=>p.cost>0&&p.cost<=Math.min(30,u.ap-20)&&(p.tacticalLevel??0)===0&&p.path.every(v=>(v.tacticalLevel??0)===0&&cells.has(`${v.x},${v.y}`))&&distance(p,action)<distance(u,action)&&distance(p,buddy)<=1.5&&field.every(v=>v.id===u.id||distance(p,v)<=4.5)).sort((a,c)=>distance(a,action)-distance(c,action)||a.cost-c.cost);
   return points[0]?valid({type:'move',unitId:u.id,x:points[0].x,y:points[0].y,tacticalLevel:0}):null;
  }
  if(action?.type==='artilleryMove'){
   const next=actBattle(b,action);if(next.lastError)return null;const moved=next.units.find(v=>v.id===u.id);if(present(buddy)&&distance(moved,buddy)>1.5||field.some(v=>v.id!==u.id&&distance(moved,v)>4.5))return null;
  }
  if(['climb','charge','exit'].includes(action?.type))return null;
  return valid(action);
 };
}

return quietExitCautiousCohesionController;
})();

export function recoveryBronzeControls({report=()=>{}}={}){
let base;
const deploy=start=>{
 let b=start;const model=sectorDeploymentModel(b),guns=b.artillery.filter(g=>g.side==='player'&&!g.stationed&&g.type==='bronze4'),ids=['0','5','123','128','138','142'];assert.deepEqual(b.units.filter(u=>u.side==='player'&&u.hp>0&&!u.departure).map(u=>u.id),ids);for(const old of b.units.filter(u=>u.side==='player'&&!ids.includes(u.id))){assert.equal(old.hp,0,'previous dead body remains on field');}assert.equal(guns.length,3);
 const x=guns[0].x,y=guns[0].y;assert.equal(guns[1].x,x);assert.equal(guns[1].y,y-1);assert.equal(guns[2].x,x-1);assert.equal(guns[2].y,y);
 const positions=[['0',x+1],['5',x],['123',x+3],['128',x+4],['138',x-2],['142',x-1]];
 for(const[id,px]of positions){const u=model.units.find(u=>u.id===id);assert.ok(model.entryCells[u.edge].some(q=>q.x===px&&q.y===b.height-1));b=sectorDeploymentAction(b,{type:'placeDeployment',unitIds:[id],x:px,y:b.height-1});assert.equal(b.lastError,null,b.lastError);}
 b=sectorDeploymentAction(b,{type:'confirmDeployment'});assert.equal(b.lastError,null,b.lastError);
 const before={guns:structuredClone(b.artillery),units:structuredClone(b.units.filter(u=>u.side==='player')),elapsed:b.elapsedSeconds},moves=[];
 const drag=(id,gunId,dx,dy)=>{const gun=b.artillery.find(g=>g.id===gunId),u=b.units.find(u=>u.id===id),cost=artilleryCosts(b,u,gun).move,plan=artilleryCrewPlan(b,u,gun,cost);assert.equal(plan.reason,null);assert.deepEqual([...plan.crew].sort(),[...(gunId===guns[0].id?['0','5']:gunId===guns[1].id?['123','128']:['138','142'])].sort(),'exact drag pair '+gunId);const mode=b.mode,elapsed=b.elapsedSeconds,old=plan.crew.map(id=>({id,ap:b.units.find(u=>u.id===id).ap,energy:b.units.find(u=>u.id===id).energy})),action={type:'artilleryMove',unitId:id,artilleryId:gunId,x:gun.x+dx,y:gun.y+dy},preview=actBattle(b,action);assert.equal(preview.lastError,null,JSON.stringify(action)+preview.lastError);b=actBattle(b,action);assert.equal(b.lastError,null);for(const record of old){const now=b.units.find(u=>u.id===record.id);assert.equal(now.ap,mode==='exploration'?record.ap:record.ap-cost);assert.ok(now.energy<=record.energy);}if(mode==='exploration')assert.equal(b.elapsedSeconds-elapsed,Math.max(1,Math.ceil(cost*.06)));moves.push({action,mode,cost,crew:plan.crew,before:old,after:plan.crew.map(id=>({id,ap:b.units.find(u=>u.id===id).ap,energy:b.units.find(u=>u.id===id).energy})),elapsed:b.elapsedSeconds});};
 const approach=(id,px,py)=>{const u=b.units.find(u=>u.id===id),path=knownGroundRoutes(b,u).find(q=>q.x===px&&q.y===py);assert.ok(path,'actual public crew approach '+id);const old={ap:u.ap,energy:u.energy,elapsed:b.elapsedSeconds},action={type:'move',unitId:id,x:px,y:py};b=actBattle(b,action);assert.equal(b.lastError,null,JSON.stringify(action)+b.lastError);const v=b.units.find(u=>u.id===id);assert.equal(v.x,px);assert.equal(v.y,py);moves.push({action,path,before:old,after:{ap:v.ap,energy:v.energy,elapsed:b.elapsedSeconds}});};
 drag('0',guns[0].id,1,0);
 for(let n=0;n<4;n++)drag('138',guns[2].id,-1,0);
 approach('123',x,y);approach('128',x-1,y);
 for(let n=0;n<2;n++)drag('123',guns[1].id,-1,0);
 assert.ok(moves.length<=16);assert.equal(moves.length,9);
 for(const old of before.guns){const now=b.artillery.find(g=>g.id===old.id),expected=old.id===guns[0].id?{...old,x:old.x+1}:old.id===guns[2].id?{...old,x:old.x-4}:old.id===guns[1].id?{...old,x:old.x-2}:old;assert.deepEqual(now,expected,'paid gun movement retains all physical records');}
 for(const old of before.units){const now=b.units.find(u=>u.id===old.id);for(const key of ['hp','maxHp','bleeding','weapon','loaded','ammo','condition','blade','outfit','headwear','legwear','medkits','inventory'])assert.deepEqual(now[key],old[key],old.id+' '+key+' custody');}
 const pairs=[['0','5'],['123','128'],['138','142']],plans=[];
 for(let n=0;n<guns.length;n++)for(const id of pairs[n]){const u=b.units.find(u=>u.id===id),actualGun=b.artillery.find(g=>g.id===guns[n].id),plan=artilleryCrewPlan(b,u,actualGun,0);assert.equal(plan.reason,null);assert.deepEqual([...plan.crew].sort(),[...pairs[n]].sort(),'distinct actual pair '+id);plans.push({gun:actualGun.id,operator:id,plan,fireCost:artilleryCosts(b,u,actualGun).fire});}
 const targets=b.units.filter(v=>v.side==='enemy'&&v.hp>=15&&!v.routed&&!v.surrendered&&!v.unconscious&&!v.departure&&teamCanSee(b,'player',v)),lanes=guns.map((old,n)=>{const gun=b.artillery.find(g=>g.id===old.id),orders=pairs[n].map(id=>({id,action:teamArtilleryOrder({...b,artillery:[gun]},b.units.find(u=>u.id===id),targets)}));return{gun:gun.id,orders};});
 if(targets.length)for(const lane of lanes)assert.ok(lane.orders.some(o=>['artillery','artilleryPivot'].includes(o.action?.type)),'actual safe visible-target fire lane '+lane.gun);
 const receipt={before,moves,plans,lanes,visibleTargetCount:targets.length,after:{elapsed:b.elapsedSeconds,units:b.units.filter(u=>u.side==='player').map(u=>({id:u.id,x:u.x,y:u.y,hp:u.hp,energy:u.energy,ap:u.ap}))}};base=threePairController(b);report({event:'paidDistinctCrewLanePrep',moves,plans,lanes,visibleTargetCount:targets.length,elapsed:b.elapsedSeconds,receipt});return b;
};
return {deploy,controller:(b,u)=>{assert.ok(base);return base(b,u);}};
}

export function recoveryJujuyControls({report=()=>{}}={}){
let base;const preparations=[];
const deploy=initial=>{let b=initial;const model=sectorDeploymentModel(b);for(const row of model.units){const actual=initial.units.find(u=>u.id===row.id);assert.ok(model.entryCells[row.edge].some(p=>p.x===actual.x&&p.y===actual.y),'actual issued entry cell');b=sectorDeploymentAction(b,{type:'placeDeployment',unitIds:[row.id],x:actual.x,y:actual.y});assert.equal(b.lastError,null);}b=sectorDeploymentAction(b,{type:'confirmDeployment'});assert.equal(b.lastError,null);const before={units:structuredClone(b.units.filter(u=>u.side==='player')),guns:structuredClone(b.artillery),elapsed:b.elapsedSeconds},u=b.units.find(u=>u.id==='138'),gun=b.artillery.find(g=>g.side==='player'&&!g.stationed&&g.id==='piece-26');assert.equal(u.x,63);assert.equal(u.y,25);assert.ok(gun);const path=knownGroundRoutes(b,u).find(p=>p.x===62&&p.y===24&&(p.tacticalLevel??0)===0);assert.ok(path);assert.equal(path.cost,12);const action={type:'move',unitId:'138',x:62,y:24,tacticalLevel:0};b=actBattle(b,action);assert.equal(b.lastError,null);assert.deepEqual(b.artillery,before.guns);for(const old of before.units){const now=b.units.find(u=>u.id===old.id);for(const key of Object.keys(old))if(!['x','y','ap','energy','facing','tacticalLevel','lastDirection','momentum','lastMovePath','weaponReady','weaponFacing'].includes(key))assert.deepEqual(now[key],old[key],old.id+' '+key+' unchanged');}const operator=b.units.find(u=>u.id==='138');assert.ok(artilleryContact(b,operator,gun));assert.deepEqual(artilleryCrewPlan(b,operator,gun,artilleryCosts(b,operator,gun).fire),{crew:['138'],reason:null});preparations.push({action,path,elapsed:b.elapsedSeconds-before.elapsed,operator:{x:operator.x,y:operator.y,hp:operator.hp,energy:operator.energy,ap:operator.ap},gun});report({event:'actualThirdSwivelContact',preparation:preparations.at(-1)});const laneBefore=structuredClone(b),lane=[];
for(const a of [{type:'move',unitId:'123',x:62,y:20,tacticalLevel:0},{type:'move',unitId:'142',x:62,y:22,tacticalLevel:0},{type:'move',unitId:'5',x:63,y:25,tacticalLevel:0},{type:'artilleryMove',unitId:'138',artilleryId:'piece-26',x:60,y:23},{type:'artilleryMove',unitId:'0',artilleryId:'piece-24',x:61,y:23},{type:'move',unitId:'142',x:62,y:24,tacticalLevel:0},{type:'move',unitId:'128',x:63,y:22,tacticalLevel:0},{type:'move',unitId:'138',x:61,y:23,tacticalLevel:0}]){const old=b,path=a.type==='move'?knownGroundRoutes(b,b.units.find(u=>u.id===a.unitId)).find(p=>p.x===a.x&&p.y===a.y&&(p.tacticalLevel??0)===0):null;if(a.type==='move')assert.ok(path);b=actBattle(b,a);assert.equal(b.lastError,null,JSON.stringify(a));lane.push({action:a,path,elapsed:b.elapsedSeconds-old.elapsedSeconds});}
assert.equal(b.mode,'exploration');assert.equal(b.elapsedSeconds,42);assert.equal(b.units.filter(u=>u.side==='enemy'&&u.hp>=15).length,28);
for(const g of laneBefore.artillery){const now=b.artillery.find(v=>v.id===g.id);for(const k of Object.keys(g))if(!['x','y'].includes(k))assert.deepEqual(now[k],g[k]);}
for(const u of laneBefore.units.filter(u=>u.side==='player')){const now=b.units.find(v=>v.id===u.id);for(const k of Object.keys(u))if(!['x','y','ap','energy','facing','tacticalLevel','lastDirection','momentum','lastMovePath','weaponReady','weaponFacing'].includes(k))assert.deepEqual(now[k],u[k],u.id+' '+k);}
for(const[id,gid]of[['0','piece-24'],['128','piece-25'],['138','piece-26']]){const u=b.units.find(v=>v.id===id),g=b.artillery.find(v=>v.id===gid);assert.deepEqual(artilleryCrewPlan(b,u,g,artilleryCosts(b,u,g).fire),{crew:[id],reason:null});}
preparations.at(-1).lane=lane;report({event:'paidCoordinatedLightLane',orders:lane.length+1,elapsed:b.elapsedSeconds});base=quietExitCautiousCohesionController(b,{report});return b;};
return {deploy,controller:(b,u)=>{assert.ok(base);return base(b,u);}};
}
