import assert from 'node:assert/strict';
import {sectorDeploymentModel,sectorDeploymentAction} from '../game/sector-deployment.js';
import {artilleryProfile} from '../game/artillery-definitions.js';
import {propBlocksAt} from '../game/props.js';
import {wallMovementBlocked} from '../game/wall-geometry.js';
import {sameCell,sameSurface,spacePoint,surfaceAt} from '../game/tactical-space.js';
import {boundaryPassable} from '../game/tactical-exits.js';
import {getReachable,teamCanSee,hasLineOfSight,hasFirearm,artilleryContact,artilleryCrewPlan,artilleryCosts,artilleryReloadPreview,stanceCost,actionCosts,exitPreview,meleePreview,medicalUsePreview,movementEnergy} from '../game/tactical.js';
import {availableAmmunition} from '../game/ammunition-types.js';
import {firearmServiceable} from '../game/firearm-serviceability.js';
import {criticalFirstAidNeeded} from '../game/first-aid.js';
import {medicalPatientAvailable} from '../game/medical-patient.js';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {teamArtilleryOrder} from './team-artillery-driver.mjs';
import {publicRouteView,usefulRouteRifleShot,usefulRouteFiringPosture} from './route-infantry-progress.mjs';
import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),idCompare=(a,b)=>String(a.id).localeCompare(String(b.id));
const capable=u=>u?.hp>=15&&!u.departure&&!u.fled&&!u.routed&&!u.unconscious&&!u.surrendered&&!u.asleep&&!u.captured&&!u.detained&&!u.bound;
const onField=u=>(u.hp??100)>0&&!u.departure&&!u.fled;

// This opt-in formation keeps the actual eight arrivals and two finite pieces.
// The deployment model contains only public terrain and our arrival identities.
// Every subsequent move, departure, shot, reload and dressing is a native order.
export function createdUspallataBattery(initial,{reserveIds=[],reserveDestination,report=()=>{}}={}){
 const own=initial.units.filter(u=>u.side==='player'&&capable(u)),reserves=new Set(reserveIds.map(String));
 assert.ok([...reserves].every(id=>own.some(u=>u.id===id)),'Each required reserve must be an actual capable arrival.');
 assert.ok(!reserves.size||typeof reserveDestination==='string','Required reserves need the actual return destination.');
 const guns=initial.artillery.filter(g=>g.side==='player'&&!g.stationed);
 assert.equal(guns.length,2);assert.deepEqual(guns.map(g=>g.type).sort(),['field8','swivel']);
 const physician=own.filter(u=>!reserves.has(u.id)&&u.medical>=60&&u.medkits>0).sort((a,b)=>b.medical-a.medical||b.medkits-a.medkits||idCompare(a,b))[0];
 assert.ok(physician,'The actual mountain physician needs skill and finite carried dressings.');
 const operators=own.filter(u=>!reserves.has(u.id)&&u.id!==physician.id).sort((a,b)=>a.marksmanship-b.marksmanship||idCompare(a,b));
 const crews=guns.slice().sort((a,b)=>artilleryProfile(initial,b).crew-artilleryProfile(initial,a).crew).map(gun=>{
  const ids=operators.splice(0,artilleryProfile(initial,gun).crew).map(u=>u.id);assert.equal(ids.length,artilleryProfile(initial,gun).crew);return {gunId:gun.id,ids};
 });
 const screens=new Set(operators.map(u=>u.id)),crewIds=new Set(crews.flatMap(crew=>crew.ids));
 const arrivalDirection={N:{x:0,y:1},E:{x:-1,y:0},S:{x:0,y:-1},W:{x:1,y:0}}[physician.entryEdge];
 assert.ok(screens.size,'The real battery needs an actual remaining infantry screen.');
 const piece=(b,id)=>b.artillery.find(g=>g.id===id),protectedIds=new Set([...reserves,physician.id]);
 const emit=(event,action,battle)=>report({event,action:structuredClone(action),hour:battle.enteredHour,turn:battle.turn,elapsedSeconds:battle.elapsedSeconds});

 function deploy(start){
  recordRouteStrategicEvidence({helper:'createdUspallataDeployment',stage:'preparation-input',campaign:null,context:{initial:start,roles:{reserves:[...reserves],physicianId:physician.id,crews,screens:[...screens]},scope:'Actual original executor construction before any deployment order; tactical boundary, campaign null. No extra entry, order or synchronization.'}});
  let battle=start;const model=sectorDeploymentModel(battle);assert.ok(model);
  assert.deepEqual(model.units.map(u=>u.id).sort(),own.map(u=>u.id).sort());
  const occupied=new Set(guns.map(g=>`${g.x},${g.y}`)),placements=[];
  const place=(id,accept,score,fallback=null)=>{
   const row=model.units.find(u=>u.id===id),available=model.entryCells[row.edge].filter(p=>!occupied.has(`${p.x},${p.y}`));
   let points=available.filter(accept);if(!points.length&&fallback)points=available.filter(fallback);
   points.sort((a,b)=>score(a)-score(b)||a.y-b.y||a.x-b.x);const point=points[0];assert.ok(point,`A real arrival cell must supply ${id}'s battery role.`);
   const action={type:'placeDeployment',unitIds:[id],x:point.x,y:point.y};battle=sectorDeploymentAction(battle,action);assert.equal(battle.lastError,null,battle.lastError);occupied.add(`${point.x},${point.y}`);placements.push({id,...point});emit('uspallataDeploymentOrder',action,battle);
  };
  for(const id of reserves){
   const row=model.units.find(u=>u.id===id),exit=start.exits.find(e=>e.destination===reserveDestination&&e.edge===row.edge);assert.ok(exit,'A required reserve needs its real return edge.');
   place(id,p=>boundaryPassable(start,p,exit.edge)&&guns.every(g=>distance(p,g)>2.5),p=>-Math.min(...guns.map(g=>distance(p,g))));
  }
  // Place the small crew first, keeping the three heavy crew slots distinct.
  for(const crew of crews.slice().sort((a,b)=>a.ids.length-b.ids.length))for(const id of crew.ids){
   const gun=piece(start,crew.gunId);place(id,p=>distance(p,gun)<=1.5&&artilleryContact(start,{...own.find(u=>u.id===id),...p},gun)&&
    (crew.ids.length>1||guns.filter(other=>other.id!==gun.id).every(other=>distance(p,other)>1.5)),p=>distance(p,gun));
  }
  // Leave the small piece's two-step separation lane free of our other roles.
  const small=guns.find(g=>g.type==='swivel'),heavy=guns.find(g=>g.type==='field8'),smallRole=crews.find(c=>c.gunId===small.id),smallPosition=placements.find(p=>p.id===smallRole.ids[0]);
  const delta=Math.abs(small.y-heavy.y)>=Math.abs(small.x-heavy.x)?{x:0,y:Math.sign(small.y-heavy.y)}:{x:Math.sign(small.x-heavy.x),y:0};
  const clearance=new Set([1,2].flatMap(step=>[small,smallPosition].map(p=>`${p.x+step*delta.x},${p.y+step*delta.y}`)));
  const outsideCrews=p=>!clearance.has(`${p.x},${p.y}`)&&guns.every(g=>distance(p,g)>(g.type==='swivel'?2.5:1.5));
  place(physician.id,outsideCrews,p=>Math.min(...placements.filter(p=>crewIds.has(p.id)).map(q=>distance(p,q))));
  for(const id of screens){
   const actor=own.find(u=>u.id===id),view=publicRouteView(start,actor);
   // A narrow real entry can need the preferred separation lane. Keep this
   // screen outside actual cannon contact; paid separation still checks every
   // translated gun/crew cell and can choose a different open direction.
   place(id,p=>outsideCrews(p)&&guns.some(g=>distance(p,g)<=5),p=>Math.min(...guns.map(g=>distance(p,g)))-(surfaceAt(start,p)?.cover??0)*.1,
    p=>guns.some(g=>distance(p,g)<=5)&&guns.every(g=>!artilleryContact(view,{...actor,...p},g)));
  }
  const action={type:'confirmDeployment'};battle=sectorDeploymentAction(battle,action);assert.equal(battle.lastError,null,battle.lastError);emit('uspallataDeploymentOrder',action,battle);
  assert.deepEqual(battle.artillery,start.artillery);assert.equal(new Set(battle.units.filter(u=>u.side==='player').map(u=>`${u.tacticalLevel??0}:${u.x},${u.y}`)).size,own.length);
  report({event:'uspallataBatteryRoles',reserves:[...reserves],physicianId:physician.id,crews:structuredClone(crews),screens:[...screens],placements,campaignBattleId:battle.battleId});return battle;
 }

 function route(b,u,predicate,score,budget=20){
  if(!capable(u)||u.knockedDown||u.entangled)return null;
  const view=publicRouteView(b,u),points=getReachable(view,u).filter(p=>p.cost>0&&p.cost<=Math.min(budget,u.ap)&&sameSurface(p,u)&&p.path.every(step=>sameSurface(step,u))&&predicate(p,view));
  points.sort((a,c)=>score(a)-score(c)||a.cost-c.cost||a.y-c.y||a.x-c.x);return points[0]?{type:'move',unitId:u.id,...spacePoint(points[0])}:null;
 }
 function separation(b,u){
  const gun=b.artillery.find(g=>g.side==='player'&&g.type==='swivel'),others=b.artillery.filter(g=>g.side==='player'&&g.id!==gun?.id);
  if(!gun||others.every(g=>distance(gun,g)>=3))return null;
  const role=crews.find(c=>c.gunId===gun.id);if(!role.ids.includes(u.id))return null;
  const plan=artilleryCrewPlan(b,u,gun,artilleryCosts(b,u,gun).move);if(plan.reason||plan.crew.some(id=>!role.ids.includes(id)))return null;
  const view=publicRouteView(b,u),members=b.units.filter(actor=>plan.crew.includes(actor.id)),gain=p=>Math.min(...others.map(g=>distance(p,g))),current=gain(gun);
  const candidates=[[0,-1],[0,1],[-1,0],[1,0]].map(([dx,dy])=>({dx,dy,x:gun.x+dx,y:gun.y+dy})).filter(p=>gain(p)>current&&gain(p)<=5).filter(p=>{
   const translated=[{from:gun,to:p},...members.map(actor=>({from:actor,to:{x:actor.x+p.dx,y:actor.y+p.dy}}))];
   return new Set(translated.map(({to})=>`${to.x},${to.y}`)).size===translated.length&&translated.every(({from,to})=>{
    const tile=surfaceAt(view,to);return tile&&!tile.blocked&&!['water','cliff'].includes(tile.type)&&!propBlocksAt(view,to.x,to.y)&&!wallMovementBlocked(view,from,to)&&
     !view.units.some(actor=>onField(actor)&&!plan.crew.includes(actor.id)&&sameCell(actor,to))&&!(view.npcs??[]).some(actor=>onField(actor)&&sameCell(actor,to))&&!view.artillery.some(g=>g.id!==gun.id&&sameCell(g,to));
   });
  }).sort((a,c)=>gain(c)-gain(a)||a.y-c.y||a.x-c.x);
  return candidates[0]?{type:'artilleryMove',unitId:u.id,artilleryId:gun.id,x:candidates[0].x,y:candidates[0].y}:null;
 }
 function uprightMedicalApproach(b,u,patient,budget){
  if(u.stance!=='prone'||u.mounted||!u.medkits||!sameSurface(u,patient))return null;
  const hand=actionCosts(b,u).weapon;
  const quote=(stance,movementMode)=>{
   const paid=stanceCost(u,stance),actor={...u,stance,movementMode,ap:u.ap-paid},view=publicRouteView(b,actor);
   const points=getReachable(view,actor).filter(p=>sameSurface(p,u)&&p.path.every(step=>sameSurface(step,u)));
   const goals=points.filter(p=>p.cost>0&&medicalUsePreview(view,{...actor,...spacePoint(p),activeSlot:'medical',ap:actor.ap-p.cost-hand},patient).allowed).sort((a,c)=>a.cost-c.cost||a.y-c.y||a.x-c.x);
   return {paid,points,goal:goals[0]};
  };
  // These are public quotes, not a simulated posture or completed approach.
  // Pay the posture inside one Native move and re-read the returned battle.
  const crawling=quote(u.stance,u.movementMode),walking=quote('standing','walk');
  if(!walking.goal||crawling.goal&&walking.paid+walking.goal.cost>=crawling.goal.cost)return null;
  const point=walking.goal.path.map(step=>walking.points.find(p=>sameCell(p,step))).filter(p=>p&&p.cost>0&&walking.paid+p.cost<=budget).at(-1);
  return point?{type:'move',unitId:u.id,...spacePoint(point),movement:'walk'}:null;
 }
 // Follow the current second screen, using only quoted public geometry.
 // A projected gait is a cost/safety quote, never an executed posture.
 function physicianScreenFollow(b,u){
  if(!arrivalDirection||!u.medkits||u.energy<=10||u.mounted||u.knockedDown||u.entangled||b.phase!=='player'||b.reactionStack?.length)return null;
  const direction=arrivalDirection,progress=p=>p.x*direction.x+p.y*direction.y;
  const current=b.units.filter(actor=>screens.has(actor.id)&&actor.side===u.side&&capable(actor)&&sameSurface(actor,u)).sort((a,c)=>progress(c)-progress(a)||c.marksmanship-a.marksmanship||idCompare(a,c));
  if(!current.length)return null;
  const lead=current[Math.min(1,current.length-1)],goal={x:lead.x-2*direction.x,y:lead.y-2*direction.y};
  if(distance(u,goal)<=2&&progress(u)<=progress(lead))return null;
  const view=publicRouteView(b,u),contacts=view.units.filter(actor=>actor.side!==u.side&&capable(actor)),cover=p=>surfaceAt(view,p)?.cover??0,costs=actionCosts(b,u),budget=Math.min(16,u.ap-costs.weapon-costs.heal);
  if(budget<=0)return null;
  const safe=(actor,p)=>sameSurface(p,u)&&progress(p)<=progress(lead)&&cover(p)>=cover(u)&&
   view.artillery.filter(gun=>gun.side===u.side).every(gun=>!artilleryContact(view,{...actor,...spacePoint(p)},gun))&&
   contacts.every(contact=>distance(p,contact)>2.5&&(!hasLineOfSight(view,contact,{...actor,...spacePoint(p)})||hasLineOfSight(view,contact,u)));
  const candidates=[];
  for(const walking of [false,true]){
   if(walking&&u.stance==='standing'&&u.movementMode==='walk')continue;
   const paid=walking?stanceCost(u,'standing'):0,actor=walking?{...u,stance:'standing',movementMode:'walk',ap:u.ap-paid}:u;
   if(paid>=budget||!safe(actor,u))continue;
   for(const point of getReachable(view,actor)){
    if(point.cost<=0||point.cost+paid>budget||distance(point,goal)>=distance(u,goal)||!point.path.every(p=>safe(actor,p)))continue;
    let from=u,energy=0;for(const step of point.path){const factor=from.x!==step.x&&from.y!==step.y?1.4:1,used=movementEnergy(actor,surfaceAt(view,step),b.mode==='exploration')*factor;energy+=b.mode==='exploration'?used:Math.ceil(used);from=step;}
    if(energy>=u.energy-10)continue;
    candidates.push({point,paid,walking});
   }
  }
  candidates.sort((a,c)=>distance(a.point,goal)-distance(c.point,goal)||cover(c.point)-cover(a.point)||a.paid+a.point.cost-c.paid-c.point.cost||Number(a.walking)-Number(c.walking)||a.point.y-c.point.y||a.point.x-c.point.x);
  const next=candidates[0];return next?{type:'move',unitId:u.id,...spacePoint(next.point),...(next.walking?{movement:'walk'}:{})}:null;
 }
 const controller=(b,u)=>{
  if(!capable(u))return null;
  const normal=tucumanCombatOrder(b,u);
  if(normal?.type==='useItem'||normal?.slot==='medical'||u.knockedDown||u.entangled)return normal;
  const pendingReserve=b.units.some(actor=>reserves.has(actor.id)&&capable(actor)&&!actor.departure);
  if(reserves.has(u.id)){
   const exit=b.exits.find(e=>e.destination===reserveDestination),action=exit&&{type:'exit',unitIds:[u.id],exitId:exit.id};return action&&exitPreview(b,action).available?action:null;
  }
  if(pendingReserve)return null;
  const small=b.artillery.find(g=>g.side==='player'&&g.type==='swivel'),apart=small&&b.artillery.filter(g=>g.side==='player'&&g.id!==small.id).every(g=>distance(small,g)>=3);
  if(!apart)return separation(b,u);
  if(u.id===physician.id){
   const patients=b.units.filter(p=>p.side===u.side&&p.id!==u.id&&medicalPatientAvailable(p)&&(p.bleeding>0||criticalFirstAidNeeded(p))).sort((a,c)=>a.hp-c.hp||idCompare(a,c));
   for(const patient of patients){const budget=Math.min(16,u.ap-actionCosts(b,u).weapon-actionCosts(b,u).heal),upright=uprightMedicalApproach(b,u,patient,budget);if(upright)return upright;const action=route(b,u,p=>distance(p,patient)<distance(u,patient),p=>distance(p,patient),budget);if(action)return action;}
   const shot=usefulRouteRifleShot(publicRouteView(b,u),u);if(shot)return shot;
   if(!patients.length){const follow=physicianScreenFollow(b,u);if(follow)return follow;}
   return u.stance!=='prone'&&u.ap>=stanceCost(u,'prone')?{type:'stance',unitId:u.id,stance:'prone'}:null;
  }
  const crew=crews.find(c=>c.ids.includes(u.id));
  if(crew){
   const gun=piece(b,crew.gunId);if(!gun)return null;
   if(artilleryContact(b,u,gun)){
    if(u.stance==='prone')return u.ap>=stanceCost(u,'crouched')?{type:'stance',unitId:u.id,stance:'crouched'}:null;
    const targets=b.units.filter(v=>v.side!==u.side&&capable(v)&&teamCanSee(b,u.side,v)),action=teamArtilleryOrder({...b,artillery:[gun]},u,targets);
    if(action?.type?.startsWith('artillery')){
     const kind={artillery:'fire',artilleryPivot:'pivot',artilleryMove:'move'}[action.type],plan=action.type==='artilleryReload'?artilleryReloadPreview(b,u,gun):artilleryCrewPlan(b,u,gun,artilleryCosts(b,u,gun)[kind]);
     if(!plan.reason&&plan.crew.every(id=>crew.ids.includes(id)&&!protectedIds.has(id)))return action;
    }
    // Finish an admitted close blade defence before restoring the rifle.
    // The current Native quote permits no approach away from this gun post.
    if(u.activeSlot==='blade'){
     const view=publicRouteView(b,u),target=view.units.filter(v=>v.side!==u.side&&meleePreview(view,u,v).valid).sort((a,c)=>a.hp-c.hp||distance(u,a)-distance(u,c)||idCompare(a,c))[0];
     if(target)return {type:'melee',unitId:u.id,targetId:target.id};
    }
    // A carried primary needs its real activation and maintenance when the
    // finite cannon has no payable work. Keeping the crew does not remove it.
    if(u.activeSlot!=='primary'&&hasFirearm({...u,activeSlot:'primary'})&&firearmServiceable(u)&&(u.loaded>0||availableAmmunition(u)>0)&&u.ap>=actionCosts(b,u).weapon)return {type:'weapon',unitId:u.id,slot:'primary'};
    if(['fire','reload','reprime','weapon'].includes(normal?.type))return normal;
    const shot=usefulRouteRifleShot(publicRouteView(b,u),u);if(shot)return shot;
    return u.stance==='standing'&&u.ap>=stanceCost(u,'crouched')?{type:'stance',unitId:u.id,stance:'crouched'}:null;
   }
   return route(b,u,p=>distance(p,gun)<distance(u,gun),p=>Number(!artilleryContact(publicRouteView(b,u),{...u,...p},gun))*100+distance(p,gun));
  }
  if(['fire','reload','reprime','weapon','useItem'].includes(normal?.type))return normal;
  if(normal?.type==='stance'&&usefulRouteFiringPosture(b,u,normal))return normal;
  const view=publicRouteView(b,u),shot=usefulRouteRifleShot(view,u);if(shot)return shot;
  const goal={x:Math.floor(b.width*.65),y:Math.floor(b.height*.5)},cover=p=>surfaceAt(b,p)?.cover??0;
  const advance=route(b,u,p=>b.artillery.some(g=>g.side==='player'&&distance(p,g)<=6)&&distance(p,goal)<distance(u,goal)&&
   !view.units.some(v=>v.side!==u.side&&capable(v)&&distance(p,v)<=2.5),p=>distance(p,goal)-cover(p)*.2);
  if(advance)return advance;
  return u.stance!=='prone'&&u.ap>=stanceCost(u,'prone')?{type:'stance',unitId:u.id,stance:'prone'}:null;
 };
 return {deploy,controller,roles:{reserves:[...reserves],physicianId:physician.id,crews,screens:[...screens]}};
}
