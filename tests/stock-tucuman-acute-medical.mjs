import {artilleryProfile} from '../game/artillery-definitions.js';
import {criticalFirstAidNeeded} from '../game/first-aid.js';
import {medicalPatientAvailable} from '../game/medical-patient.js';
import {actionCosts,artilleryContact,getReachable,hasLineOfSight,interruptAvailable,medicalUsePreview,stanceCost} from '../game/tactical.js';
import {sameCell,sameSurface,spacePoint,surfaceAt} from '../game/tactical-space.js';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {publicRouteView,usefulRouteFiringPosture} from './route-infantry-progress.mjs';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const fit=u=>u?.hp>=15&&!u.unconscious&&!u.routed&&!u.departure&&!u.fled&&!u.surrendered&&!u.captured&&!u.captive&&!(u.detention&&!u.detention.freed)&&!u.asleep&&u.energy>0;
const clinical=u=>['doctor','patient','militia_doctor','militia_patient'].includes(u.assignment);

// This is the existing coastal preference rule, used only to protect its
// actual current crew. It does not assign a new operator or move a gun.
function crewProtection(initial){
 const approach={x:Math.floor(initial.width*.65),y:Math.floor(initial.height*.5)},assigned=new Set();
 const preferences=initial.artillery.filter(g=>g.side==='player').sort((a,b)=>distance(a,approach)-distance(b,approach)||String(a.id).localeCompare(String(b.id))).map(g=>{
  const ids=initial.units.filter(u=>u.side==='player'&&u.id!=='57'&&u.hp>0&&sameSurface(u,g)&&!assigned.has(u.id))
   .sort((a,b)=>distance(a,g)-distance(b,g)||String(a.id).localeCompare(String(b.id))).slice(0,artilleryProfile(initial,g).crew).map(u=>u.id);
  for(const id of ids)assigned.add(id);return {ids,artilleryId:g.id};
 });
 return battle=>{
  const taken=new Set(),working=preferences.filter(p=>{const g=battle.artillery.find(g=>g.id===p.artilleryId);return g&&(g.loaded||g.ammo>0);}),reserved=new Set(working.flatMap(p=>p.ids));
  for(const preference of working){
   const gun=battle.artillery.find(g=>g.id===preference.artilleryId),required=artilleryProfile(battle,gun).crew,priority=u=>preference.ids.includes(u.id)?preference.ids.indexOf(u.id):reserved.has(u.id)?required+1:required;
   const ids=battle.units.filter(u=>u.side==='player'&&u.id!=='57'&&u.hp>=15&&!u.unconscious&&!u.routed&&!u.departure&&!u.fled&&!u.surrendered&&sameSurface(u,gun)&&!taken.has(u.id))
    .sort((a,b)=>priority(a)-priority(b)||distance(a,gun)-distance(b,gun)||String(a.id).localeCompare(String(b.id))).slice(0,required).map(u=>u.id);
   if(ids.length===required)for(const id of ids)taken.add(id);
  }
  return taken;
 };
}

// Quote the complete paid endpoint first. A short emitted prefix cannot
// borrow future AP, a dressing, another floor, a gun contact or hidden sight.
function approach(battle,unit,patient){
 const view=publicRouteView(battle,unit),origin=surfaceAt(view,unit);if(!origin||!sameSurface(unit,patient))return null;
 const guns=view.artillery.filter(g=>g.side===unit.side&&(g.loaded||g.ammo>0));
 const contacts=view.units.filter(u=>u.side!==unit.side&&fit(u)).map(u=>({unit:u,seesCurrent:hasLineOfSight(view,u,unit)}));
 const safe=(actor,point)=>{
  const surface=surfaceAt(view,point);
  return sameSurface(unit,point)&&Boolean(surface)&&!surface.blocked&&!['water','cliff'].includes(surface.type)&&(surface.cover??0)>=(origin.cover??0)&&
   guns.every(g=>!artilleryContact(view,{...actor,...spacePoint(point)},g))&&contacts.every(contact=>distance(point,contact.unit)>2.5&&
    (!hasLineOfSight(view,contact.unit,{...actor,...spacePoint(point)})||contact.seesCurrent));
 };
 const postures=[{stance:unit.stance,movementMode:unit.movementMode,paid:0},...(unit.stance==='standing'?[]:[{stance:'standing',movementMode:'walk',paid:stanceCost(unit,'standing')}])];
 const quotes=[];
 for(const posture of postures){
  const actor={...unit,stance:posture.stance,movementMode:posture.movementMode,ap:unit.ap-posture.paid,...(posture.paid?{weaponReady:false,momentum:0}:{})};
  if(actor.ap<=0||!safe(actor,unit))continue;
  const quoted={...view,units:view.units.map(u=>u.id===actor.id?actor:u)},hand=actor.activeSlot==='medical'?0:actionCosts(quoted,actor).weapon;
  const points=getReachable(quoted,actor),goals=points.filter(point=>point.cost>0&&sameSurface(point,patient)&&point.path.every(step=>
   (step.kind===undefined||step.kind==='move')&&safe(actor,step))&&medicalUsePreview(quoted,{...actor,...spacePoint(point),activeSlot:'medical',ap:actor.ap-point.cost-hand},patient).allowed)
   .sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x);
  const goal=goals[0];if(goal)quotes.push({actor,paid:posture.paid,points,goal,total:posture.paid+goal.cost+hand});
 }
 quotes.sort((a,b)=>a.total-b.total||a.paid-b.paid);const quote=quotes[0];if(!quote)return null;
 if(quote.paid)return {type:'stance',unitId:unit.id,stance:'standing'};
 const point=quote.goal.path.map(step=>quote.points.find(p=>sameCell(p,step))).filter(p=>p&&p.cost>0&&p.cost<=20&&p.path.length<=3&&p.path.every(step=>
  (step.kind===undefined||step.kind==='move')&&safe(quote.actor,step))).at(-1);
 return point?{type:'move',unitId:unit.id,...spacePoint(point)}:null;
}

// Only the two physicians named by the actual paid readiness receipt opt in.
// Preserve adjacent aid, finite battery work and useful shots. A new distant
// medical approach precedes optional rifle restoration, loading, movement or
// lowering that cannot pay for a useful shot from the resulting posture.
export function stockTucumanAcuteController(initial,{physicianIds=[]}={}){
 const physicians=new Set(physicianIds.map(String)),battery=coastalBatteryController(initial,{sharedArtillerySight:true}),protectedCrew=crewProtection(initial);
 return (battle,unit)=>{
  const ordinary=battery(battle,unit);
  if(ordinary?.type==='useItem'||ordinary?.type==='weapon'&&ordinary.slot==='medical')return ordinary;
  if(!physicians.has(unit.id)||battle.status!=='active'||battle.mode!=='combat'||battle.phase!=='player'||battle.reactionStack?.length||battle.enemyTurn||battle.alliedTurn||
   !fit(unit)||unit.bleeding||!(unit.medical>0&&unit.medkits>0)||clinical(unit)||unit.knockedDown||unit.entangled||unit.mounted||!interruptAvailable(battle,unit))return ordinary;
  const optionalLowering=ordinary?.type==='stance'&&(ordinary.stance==='prone'&&unit.stance!=='prone'||ordinary.stance==='crouched'&&unit.stance==='standing')&&!usefulRouteFiringPosture(battle,unit,ordinary);
  if(ordinary&&!['reload','move'].includes(ordinary.type)&&!(ordinary.type==='weapon'&&ordinary.slot==='primary')&&!optionalLowering)return ordinary;
  const view=publicRouteView(battle,unit);
  if(protectedCrew(battle).has(unit.id)||view.artillery.some(g=>g.side===unit.side&&(g.loaded||g.ammo>0)&&artilleryContact(view,unit,g)))return ordinary;
  const patients=view.units.filter(patient=>patient.side===unit.side&&patient.id!==unit.id&&medicalPatientAvailable(patient)&&(patient.bleeding>0||criticalFirstAidNeeded(patient)))
   .sort((a,b)=>Number(criticalFirstAidNeeded(b))-Number(criticalFirstAidNeeded(a))||a.hp/Math.max(1,a.bleeding)-b.hp/Math.max(1,b.bleeding)||String(a.id).localeCompare(String(b.id)));
  for(const patient of patients){const action=approach(battle,unit,patient);if(action)return action;}
  return ordinary;
 };
}
