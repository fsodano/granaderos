import assert from 'node:assert/strict';
import {actBattle,getReachable,hasFirearm,hasLineOfSight,teamCanSee,firearmShotOptions,actionCosts,stanceCost,climbPreview,reloadPlan,reprimePlan,lookPreview,medicalUsePreview} from '../game/tactical.js';
import {sectorDeploymentModel,sectorDeploymentAction} from '../game/sector-deployment.js';
import {sameCell,sameSurface,spacePoint,spaceKey} from '../game/tactical-space.js';
import {availableAmmunition} from '../game/ammunition-types.js';
import {firearmServiceable} from '../game/firearm-serviceability.js';
import {criticalFirstAidNeeded} from '../game/first-aid.js';
import {medicalPatientAvailable} from '../game/medical-patient.js';
import {cautiousCombatOrder} from './cautious-driver.mjs';
import {knownRouteShotSafety} from './route-fire-safety.mjs';
import {sectorSearchGoal} from './sector-search-driver.mjs';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const capable=u=>u.side==='player'&&u.hp>=15&&!u.unconscious&&!u.routed&&!u.departure&&!u.surrendered&&!u.fled;
const contact=u=>u.hp>=15&&!u.unconscious&&!u.routed&&!u.departure&&!u.surrendered&&!u.fled;
const primary=u=>({...u,activeSlot:'primary'});
const usefulPrimary=u=>!u.weaponDropped&&hasFirearm(primary(u))&&firearmServiceable(u)&&(u.loaded>0||availableAmmunition(primary(u))>0);
const field=(b,ids)=>ids.map(id=>{const u=b.units.find(v=>v.id===id);assert.ok(u&&u.side==='player');return u;});
const publicView=(b,u)=>({...b,units:b.units.filter(v=>v.side===u.side||teamCanSee(b,u.side,v)),npcs:(b.npcs??[]).filter(v=>teamCanSee(b,u.side,v))});
const reacting=b=>b.phase==='interrupt'||Boolean(b.reactionStack?.length);

function geometry(b,ids){
 const house=b.buildings.find(v=>v.id==='tucuman:building');assert.ok(house);
 const west=b.climbLinks.find(v=>v.id===house.id+':climb:west');assert.ok(west);
 const roof=b.upperSurfaces.filter(v=>v.buildingId===house.id&&!v.blocked);
 assert.ok(roof.length>=field(b,ids).length);
 return {house,west,roof};
}

// This policy reads the real admitted field and public building geometry. It
// does not edit actor IDs, native positions, ammunition, health or results.
function positions(b,ids){
 const {house,roof}=geometry(b,ids),members=field(b,ids);
 const landings=new Set(b.climbLinks.filter(v=>v.id.startsWith(house.id+':climb:')).map(v=>spaceKey(v.to)));
 const places=roof.filter(v=>!landings.has(spaceKey(v)));assert.ok(places.length>=members.length);
 const doctor=members.slice().sort((a,c)=>c.medical-a.medical||c.marksmanship-a.marksmanship||a.id.localeCompare(c.id))[0];
 const rear=places.slice().sort((a,c)=>distance(a,{x:house.x+2,y:house.y+1})-distance(c,{x:house.x+2,y:house.y+1})||a.y-c.y||a.x-c.x)[0];
 const front=places.filter(v=>!sameCell(v,rear)).sort((a,c)=>c.y-a.y||a.x-c.x);
 const shooters=members.filter(v=>v.id!==doctor.id).sort((a,c)=>c.marksmanship-a.marksmanship||a.id.localeCompare(c.id));
 return new Map([[doctor.id,spacePoint(rear)],...shooters.map((v,i)=>[v.id,spacePoint(front[i])])]);
}

function deployWesternRoof(start,ids){
 let b=start;const model=sectorDeploymentModel(b);assert.ok(model);
 assert.equal(model.units.length,7);assert.ok(model.units.every(v=>v.edge==='S'));
 assert.deepEqual(model.units.map(v=>v.id).sort(),ids);
 const {west}=geometry(b,ids),members=model.units.slice().sort((a,c)=>a.id.localeCompare(c.id));
 for(const [i,row]of members.entries()){
  const point={x:west.from.x-8+i,y:b.height-1};
  assert.ok(model.entryCells.S.some(v=>v.x===point.x&&v.y===point.y));
  b=sectorDeploymentAction(b,{type:'placeDeployment',unitIds:[row.id],...point});assert.equal(b.lastError,null);
 }
 b=sectorDeploymentAction(b,{type:'confirmDeployment'});assert.equal(b.lastError,null);
 for(const row of members){const u=b.units.find(v=>v.id===row.id);if(u.activeSlot!=='primary'&&usefulPrimary(u)){b=actBattle(b,{type:'weapon',unitId:u.id,slot:'primary'});assert.equal(b.lastError,null);}}
 return b;
}

// First aid keeps its actual medical-slot -> useItem sequence. An actor who
// cannot yet pay for adjacent care waits for native AP instead of switching
// back to his rifle and interrupting that sequence.
function adjacentCare(b,u){
 const patients=b.units.filter(v=>v.side===u.side&&medicalPatientAvailable(v)&&(v.bleeding>0||criticalFirstAidNeeded(v))&&sameSurface(u,v)&&distance(u,v)<=1.5&&hasLineOfSight(b,u,v)).sort((a,c)=>a.hp-c.hp||a.id.localeCompare(c.id));
 if(!patients.length||!(u.medkits>0)||!(u.medical>0))return null;
 const cost=actionCosts(b,u);
 for(const patient of patients){
  if(u.activeSlot==='medical'){
   if(medicalUsePreview(b,u,patient).allowed)return {pending:true,order:{type:'useItem',unitId:u.id,targetId:patient.id}};
   if(u.ap<cost.heal)return {pending:true,order:null};
  }else{
   if(u.ap<cost.weapon+cost.heal)return {pending:true,order:null};
   const posed={...u,activeSlot:'medical',ap:u.ap-cost.weapon};
   if(medicalUsePreview(b,posed,patient).allowed)return {pending:true,order:{type:'weapon',unitId:u.id,slot:'medical'}};
  }
 }
 return null;
}

function bestShot(b,u,threshold=25){
 if(u.activeSlot!=='primary'||u.weaponMode==='melee'||!u.loaded||u.jammed||!hasFirearm(u)||!firearmServiceable(u))return null;
 const shots=[];
 for(const t of b.units.filter(v=>v.side!==u.side&&contact(v)&&teamCanSee(b,u.side,v)&&hasLineOfSight(b,u,v))){
  const cost=actionCosts(b,u,t);if(u.ap<cost.fire)continue;
  const aim=Math.min(4,cost.aim>0?Math.floor((u.ap-cost.fire)/cost.aim):4),safe=knownRouteShotSafety(b,u,t);
  for(const option of firearmShotOptions(b,u,t,aim))if(option.chance>=threshold&&option.damageFactor>0&&safe(option))shots.push({score:option.chance*option.damageFactor-(cost.fire+option.aim*cost.aim)*.1,action:{type:'fire',unitId:u.id,targetId:t.id,aim:option.aim,hitLocation:option.hitLocation}});
 }
 return shots.sort((a,c)=>c.score-a.score||a.action.targetId.localeCompare(c.action.targetId))[0]??null;
}

function paidPosture(b,u){
 if(reacting(b))return null;
 const current=bestShot(b,u)?.score??0;
 for(const stance of ['crouched','prone','standing'].filter(v=>v!==u.stance).sort((a,c)=>stanceCost(u,a)-stanceCost(u,c))){
  const cost=stanceCost(u,stance);if(!(cost>0)||cost>=u.ap)continue;
  const posed={...u,stance,movementMode:stance==='prone'?'prone':stance==='crouched'?'crouch':'walk',weaponReady:false,momentum:0,ap:u.ap-cost},view=publicView(b,u),next={...view,units:view.units.map(v=>v.id===u.id?posed:v)};
  const shot=bestShot(next,posed);if(shot&&shot.score>current+5)return {type:'stance',unitId:u.id,stance};
 }
 return null;
}

// Unlimited route search is a read-only public map preview. The order admits
// only a <=3-cell prefix affordable from the real stance/AP, or one checked
// native climb. No exploration budget is passed to actBattle.
function boundTo(b,u,goal,{near=0}={}){
 if(reacting(b)||sameSurface(u,goal)&&distance(u,goal)<=near)return null;
 const view=publicView(b,u),upright={...u,stance:'standing',movementMode:'walk'};
 const preview={...view,mode:'exploration',units:view.units.map(v=>v.id===u.id?upright:v)};
 const route=getReachable(preview,upright,{stopAt:p=>sameSurface(p,goal)&&distance(p,goal)<=near})[0];
 if(!route?.path.length)return null;
 const reserve=u.loaded>0&&!u.jammed?actionCosts(b,u).fire:20,budget=Math.min(24,u.ap-reserve);if(!(budget>0))return null;
 if(route.path[0].kind==='climb'){
  if(u.stance!=='standing')return u.ap>=stanceCost(u,'standing')+20?{type:'stance',unitId:u.id,stance:'standing'}:null;
  const plan=climbPreview(b,u,{linkId:route.path[0].linkId});return plan.valid&&plan.pa<=budget?{type:'climb',unitId:u.id,linkId:route.path[0].linkId}:null;
 }
 const ground=[];for(const p of route.path){if(p.kind==='climb'||ground.length===3)break;ground.push(p);}
 for(const goalStep of ground.reverse()){
  const step=getReachable(view,u,{stopAt:p=>sameCell(p,goalStep)})[0];
  if(step?.cost>0&&step.cost<=budget&&step.path.length<=3&&step.path.every(p=>p.kind!=='climb'))return {type:'move',unitId:u.id,...spacePoint(step)};
 }
 // Prone travel can be too expensive for the paid prefix. Change only to
 // crouch, then preview again on the next actual callback.
 return u.stance==='prone'&&u.ap>=stanceCost(u,'crouched')+20?{type:'stance',unitId:u.id,stance:'crouched'}:null;
}

function knownRoofLane(b,u,ids){
 if(reacting(b)||(u.tacticalLevel??0)!==1)return null;
 const view=publicView(b,u),{roof}=geometry(b,ids),allowed=new Set(roof.map(spaceKey)),current=bestShot(b,u)?.score??0;
 const candidates=getReachable(view,u).filter(p=>p.cost>0&&p.cost<=Math.min(24,u.ap-20)&&p.path.length<=3&&p.path.every(v=>allowed.has(spaceKey(v))));
 const choices=[];
 for(const p of candidates){
  const posed={...u,...spacePoint(p),ap:u.ap-p.cost,weaponReady:false,momentum:0},next={...view,units:view.units.map(v=>v.id===u.id?posed:v)},shot=bestShot(next,posed);
  if(shot&&shot.score>current+5)choices.push({point:p,score:shot.score-p.cost*.2});
 }
 const choice=choices.sort((a,c)=>c.score-a.score||a.point.cost-c.point.cost||a.point.y-c.point.y||a.point.x-c.point.x)[0];
 return choice?{type:'move',unitId:u.id,...spacePoint(choice.point)}:null;
}

function fitScout(b,ids){
 return field(b,ids).filter(u=>capable(u)&&!u.bleeding&&!u.asleep&&u.hp>=u.maxHp*.75&&(u.energy??100)>30&&usefulPrimary(u)).sort((a,c)=>c.marksmanship-a.marksmanship||c.agility-a.agility||a.id.localeCompare(c.id))[0];
}

function westernRoofOrder(b,u,ids){
 if(!ids.includes(u.id))return null;
 if(!capable(u))return null;
 const ordinary=cautiousCombatOrder(b,u);
 if(u.knockedDown||u.entangled)return ordinary;
 const care=adjacentCare(b,u);if(care)return care.order;
 if(ordinary?.type==='useItem'||ordinary?.type==='free'||ordinary?.type==='weapon'&&ordinary.slot==='medical')return ordinary;
 const useful=usefulPrimary(u),cost=actionCosts(b,u);
 if(useful){
  if(u.activeSlot!=='primary')return u.ap>=cost.weapon?{type:'weapon',unitId:u.id,slot:'primary'}:null;
  if(u.weaponMode==='melee')return {type:'weaponMode',unitId:u.id,mode:'fire'};
  if(u.jammed){const plan=reprimePlan(u,b);return !plan.reason&&plan.pa<=u.ap?{type:'reprime',unitId:u.id}:null;}
  if(!u.loaded){
   const plan=reloadPlan(u,b);
   const crouched={...u,stance:'crouched'},lower=reloadPlan({...crouched,ap:u.ap-stanceCost(u,'crouched')},b);
   if(u.stance==='prone'&&plan.partial&&lower.totalPA>0&&!lower.partial&&u.ap>=stanceCost(u,'crouched')+lower.totalPA)return {type:'stance',unitId:u.id,stance:'crouched'};
   return plan.pa>0&&plan.available>0?{type:'reload',unitId:u.id}:null;
  }
 }
 // A genuine ordinary approach to a public friendly casualty precedes the
 // roof goal; its entire paid prefix must still be reachable to the squad.
 if(ordinary?.type==='move'){
  const patients=b.units.filter(v=>v.side===u.side&&medicalPatientAvailable(v)&&(v.bleeding>0||criticalFirstAidNeeded(v)));
  if(u.medkits>0&&u.medical>0&&patients.some(v=>sameSurface(ordinary,v)&&distance(ordinary,v)<distance(u,v))){
   const step=getReachable(publicView(b,u),u,{stopAt:p=>sameCell(p,ordinary)})[0];if(step?.cost>0&&step.cost<=u.ap&&step.path.length<=3)return ordinary;
  }
 }
 const goal=positions(b,ids).get(u.id),{west}=geometry(b,ids),scout=fitScout(b,ids);
 const scouting=b.turn>=20&&scout?.id===u.id&&field(b,ids).some(v=>v.id!==u.id&&capable(v)&&(v.tacticalLevel??0)>0);
 // Clear the real access/landing before holding a firing lane so one actor
 // cannot block the other six from an actual climb. Aid and reload still lead.
 if(!scouting&&goal&&!sameCell(u,goal)&&(sameCell(u,west.from)||sameCell(u,west.to))){const step=boundTo(b,u,goal);if(step)return step;}
 const shot=bestShot(b,u);if(shot){const posture=paidPosture(b,u);return posture??shot.action;}
 const posture=paidPosture(b,u);if(posture)return posture;
 if(reacting(b))return null;
 if(!scouting&&goal&&!sameCell(u,goal)&&(u.tacticalLevel??0)===0){const step=boundTo(b,u,goal);if(step)return step;}
 const lane=knownRoofLane(b,u,ids);if(lane)return lane;
 const low=bestShot(b,u,5);if(low)return low.action;
 if(!scouting&&goal&&!sameCell(u,goal)){const step=boundTo(b,u,goal);if(step)return step;}
 // Watch/look cannot indefinitely suppress reconnaissance. Only one fit
 // rifleman leaves formation, after turn20, using public map goals or current
 // team-visible contacts. Wounded actors keep ordinary care and cover work.
 if(scouting){
  const contacts=b.units.filter(v=>v.side!==u.side&&contact(v)&&teamCanSee(b,u.side,v)).sort((a,c)=>distance(u,a)-distance(u,c)||a.id.localeCompare(c.id));
  const target=contacts[0]??sectorSearchGoal(b),step=boundTo(b,u,target,{near:contacts.length?2:3});if(step)return step;
  if(lookPreview(b,u,target).valid)return {type:'look',unitId:u.id,...spacePoint(target)};
 }
 // Real exhaustion can still authorize ordinary finite equipment or blade
 // work. Useful carried rifles never yield to those automatic preferences.
 return useful?null:ordinary?.type==='move'?null:ordinary;
}

// Capture membership from the actual initial deployment admission once.
// Native replay must admit the exact same IDs. Later casualties retain their
// original membership; old resident bodies never acquire a formation role.
export function createLivingTucumanRoofPolicy(){
 let admitted=null;
 return {
  get admittedIds(){return admitted;},
  deploy(start){
   const model=sectorDeploymentModel(start);assert.ok(model);
   const ids=model.units.map(v=>v.id).sort();assert.equal(ids.length,7);assert.equal(new Set(ids).size,ids.length);
   if(admitted===null)admitted=Object.freeze(ids);else assert.deepEqual(ids,admitted);
   return deployWesternRoof(start,admitted);
  },
  controller(b,u){assert.ok(admitted,'actual deployment must initialize the field before native control');return westernRoofOrder(b,u,admitted);}
 };
}
