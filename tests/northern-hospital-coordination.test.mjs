import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,artilleryContact,artilleryCosts,artilleryCrewPlan,artilleryReloadPreview,artilleryShotTrace,stanceCost,actionCosts,canSee,teamCanSee,getReachable,hasLineOfSight} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {sameCell,sameSurface,spacePoint} from '../game/tactical-space.js';
import {coordinatedHospitalBattery,paidHospitalRoofWalkPreview} from './coordinated-hospital-battery.mjs';
import {publicRouteView,usefulRouteRifleShot} from './route-infantry-progress.mjs';
import {initialCampaign,dispatchCampaign,rosterFor,civicStatus,contractQuote} from '../game/campaign.js';
import {movementStep} from '../game/movement-step.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {hiringTravelHours} from '../game/hiring-arrivals.js';
import {northernHospitalRearPhysicians} from './northern-hospital-rear-readiness.mjs';
import {COMBAT_ROUND_SECONDS} from '../game/time.js';

const tiles=()=>Array.from({length:40*20},(_,i)=>({x:i%40,y:Math.floor(i/40),type:'grass',blocked:false,cover:0}));
const roofs=()=>Array.from({length:9},(_,i)=>({id:`clinic-roof:${i}`,x:12+i%3,y:8+Math.floor(i/3),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}));
// These are declared portable rear-defense arenas. They do not copy or
// continue the failed funded campaign, assign a victory, or grant supplies.
function arena({target=false,missingHelper=false,medicalContact=false,crewProne=false}={}){
 return createBattle([
  {id:'crew1',x:5,y:5,weapon:1800,loaded:1,ammo:5,medkits:0,medical:20,marksmanship:50,stance:crewProne?'prone':'crouched',facing:2,energy:100,morale:90},
  {id:'crew2',x:6,y:4,weapon:1800,loaded:1,ammo:5,medkits:0,medical:20,marksmanship:55,stance:crewProne?'prone':'crouched',facing:2,energy:100,morale:90,...(missingHelper?{hp:0,maxHp:100}:{})},
  {id:'doctor',x:medicalContact?7:6,y:medicalContact?4:7,weapon:0,loaded:0,ammo:0,medical:90,medkits:3,stance:medicalContact?'crouched':'prone',facing:2,energy:100,morale:90},
  {id:'roof',x:13,y:9,tacticalLevel:1,weapon:1800,loaded:1,ammo:5,medical:20,medkits:0,marksmanship:90,stance:'prone',facing:2,energy:100,morale:90},
 ],{id:'declared-hospital',width:40,height:20,tiles:tiles(),upperSurfaces:roofs(),
  climbLinks:[{id:'clinic-west-access',kind:'climb',from:{x:12,y:11,tacticalLevel:0},to:{x:12,y:10,tacticalLevel:1}}],
  hour:12,seed:45,enemies:[{id:'target',x:target?14:37,y:target?5:17,weapon:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false}],
  artillery:[{id:'clinic-gun',side:'player',type:'bronze4',x:6,y:5,facing:0,loaded:true,ammo:2}],
 });
}
const actor=(b,id)=>b.units.find(u=>u.id===id),gun=b=>b.artillery[0];
const carried=u=>Object.fromEntries(['hp','maxHp','bleeding','weapon','blade','activeSlot','loaded','medkits','condition','inventory'].map(key=>[key,u[key]]));
function replay(start,orders){
 let direct=structuredClone(start),presented=structuredClone(start),restored=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  assert.ok(action,'a declared paid step must have a native proposal');
  direct=actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));
  presented=presentedActBattle(presented,action).state;assert.deepEqual(presented,direct);
  restored=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(restored,action))));assert.deepEqual(restored,direct);
 }
 return direct;
}

test('a charged rear gun keeps the actual clinic roof guard on its authored upper surface',()=>{
 const start=arena(),before=structuredClone(start),helper=coordinatedHospitalBattery(start),roof=actor(start,'roof');
 assert.deepEqual(helper.roles,{physicianId:'doctor',crews:[{gunId:'clinic-gun',ids:['crew1','crew2']}]});
 assert.equal(roof.tacticalLevel,1);assert.ok(start.upperSurfaces.some(p=>sameCell(p,roof)));
 assert.equal(artilleryContact(start,roof,gun(start)),false);assert.equal(teamCanSee(start,'player',actor(start,'target')),false);
 for(let decision=0;decision<4;decision++)assert.equal(helper.controller(start,roof),null,'a charged ground gun is not a reason to leave the paid roof post');
 assert.deepEqual(start,before);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(start))),before);
});

test('the actual two-person contact crew pays finite cannon fire and reload without borrowing its physician',()=>{
 const start=arena({target:true}),before=structuredClone(start),helper=coordinatedHospitalBattery(start),orders=[];
 const leader=actor(start,'crew1'),physician=actor(start,'doctor'),fire=helper.controller(start,leader);
 assert.equal(fire?.type,'artillery');assert.equal(fire.artilleryId,'clinic-gun');
 const cost=artilleryCosts(start,leader,gun(start)).fire,plan=artilleryCrewPlan(start,leader,gun(start),cost);
 assert.equal(plan.reason,null);assert.deepEqual(plan.crew,['crew1','crew2']);assert.ok(!plan.crew.includes(physician.id));
 orders.push(fire);let after=replay(start,orders);
 assert.equal(Number(gun(after).loaded)+gun(after).ammo,Number(gun(start).loaded)+gun(start).ammo-1);
 for(const id of plan.crew)assert.equal(actor(after,id).ap,actor(start,id).ap-cost);
 assert.deepEqual(carried(actor(after,'doctor')),carried(physician));assert.equal(actor(after,'doctor').ap,physician.ap);
 const reload=helper.controller(after,actor(after,'crew1'));assert.equal(reload?.type,'artilleryReload');
 const preview=artilleryReloadPreview(after,actor(after,'crew1'),gun(after)),preReload=structuredClone(after);
 assert.equal(preview.valid,true);assert.deepEqual(preview.crew,['crew1','crew2']);orders.push(reload);after=replay(start,orders);
 for(const id of preview.crew)assert.equal(actor(after,id).ap,actor(preReload,id).ap-preview.pa);
 assert.equal(Number(gun(after).loaded)+gun(after).ammo,Number(gun(preReload).loaded)+gun(preReload).ammo,'partial or complete loading only transfers one real charge');
 assert.deepEqual(carried(actor(after,'doctor')),carried(physician));assert.equal(actor(after,'doctor').ap,physician.ap);
 assert.deepEqual(replay(start,orders),after);assert.deepEqual(start,before);
});

test('adjacent real bleeding care pays medical activation and a finite dressing before charged battery work',()=>{
 const start=createBattle([
  {id:'doctor',x:7,y:4,medical:90,medkits:3,weapon:1800,loaded:1,ammo:5,stance:'crouched',facing:2,energy:100,morale:90},
  {id:'patient',x:6,y:4,hp:30,maxHp:100,bleeding:3,medical:20,medkits:0,weapon:1800,loaded:1,ammo:5,stance:'crouched',energy:100,morale:90},
  {id:'crew1',x:5,y:5,medical:20,medkits:0,weapon:1800,loaded:1,ammo:5,stance:'crouched',energy:100,morale:90},
 ],{width:40,height:20,tiles:tiles(),seed:45,enemies:[{id:'target',x:37,y:17,weapon:0,hp:500,maxHp:500,patrol:false,overwatch:false}],
  artillery:[{id:'clinic-gun',side:'player',type:'bronze4',x:6,y:5,facing:0,loaded:true,ammo:2}]});
 const before=structuredClone(start),helper=coordinatedHospitalBattery(start),doctor=actor(start,'doctor'),switchAction=helper.controller(start,doctor);
 assert.deepEqual(switchAction,{type:'weapon',unitId:'doctor',slot:'medical'});
 let after=replay(start,[switchAction]);assert.equal(actor(after,'doctor').ap,doctor.ap-actionCosts(start,doctor).weapon);
 const patient=structuredClone(actor(after,'patient')),aid=helper.controller(after,actor(after,'doctor')),preAid=structuredClone(after);
 assert.equal(aid?.type,'useItem');assert.equal(aid.targetId,'patient');after=replay(start,[switchAction,aid]);
 assert.equal(actor(after,'doctor').medkits,doctor.medkits-1);assert.equal(actor(after,'doctor').ap,actor(preAid,'doctor').ap-actionCosts(preAid,actor(preAid,'doctor')).heal);
 assert.equal(actor(after,'patient').hp,patient.hp);assert.ok(actor(after,'patient').bleeding<patient.bleeding);assert.ok(actor(after,'patient').bandaged>patient.bandaged);
 assert.deepEqual(after.artillery,start.artillery);assert.deepEqual(unitAmmunitionByType(actor(after,'doctor')),unitAmmunitionByType(doctor));assert.deepEqual(start,before);
});

test('a roof edge keeps the real standing shot instead of starting a blind firing-posture cycle',()=>{
 const upperSurfaces=Array.from({length:12},(_,i)=>({id:`roof:${i}`,x:4+i%4,y:4+Math.floor(i/4),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0}));
 const start=createBattle([{id:'guard',x:5,y:4,tacticalLevel:1,weapon:1800,loaded:1,ammo:5,marksmanship:90,medkits:0,stance:'standing',facing:0}],
  {width:40,height:20,tiles:tiles(),upperSurfaces,seed:45,enemies:[{id:'target',x:5,y:2,weapon:0,hp:200,maxHp:200,patrol:false,overwatch:false}],
   artillery:[{id:'clinic-gun',type:'bronze4',side:'player',x:20,y:10,loaded:true,ammo:2}]});
 const before=structuredClone(start),guard=actor(start,'guard'),target=actor(start,'target'),helper=coordinatedHospitalBattery(start);
 assert.equal(canSee(start,guard,target),true);assert.equal(canSee(start,{...guard,stance:'prone'},target),false);
 const action=helper.controller(start,guard);assert.equal(action?.type,'fire');const after=replay(start,[action]);
 assert.equal(actor(after,'guard').stance,'standing');assert.equal(actor(after,'guard').loaded,guard.loaded-1);assert.ok(actor(after,'guard').ap<guard.ap);assert.deepEqual(after.artillery,start.artillery);
 const maintenance=helper.controller(after,actor(after,'guard'));assert.equal(maintenance?.type,'reload');const loaded=replay(start,[action,maintenance]);
 assert.deepEqual(unitAmmunitionByType(actor(loaded,'guard')),Object.fromEntries(Object.entries(unitAmmunitionByType(guard)).map(([type,count])=>[type,count-(type==='musket_75'?1:0)])));
 assert.equal(actor(loaded,'guard').stance,'standing');assert.deepEqual(start,before);
});

test('an absent contact helper does not turn the supplied physician into an automatic replacement gunner',()=>{
 const start=arena({target:true,missingHelper:true,medicalContact:true}),before=structuredClone(start),helper=coordinatedHospitalBattery(start);
 assert.equal(helper.roles.physicianId,'doctor');assert.deepEqual(helper.roles.crews,[{gunId:'clinic-gun',ids:['crew1']}]);
 assert.equal(artilleryContact(start,actor(start,'doctor'),gun(start)),true,'the real doctor is physically close enough for this negative control');
 const possibleLoan=artilleryCrewPlan(start,actor(start,'crew1'),gun(start),artilleryCosts(start,actor(start,'crew1'),gun(start)).fire);
 assert.equal(possibleLoan.reason,null);assert.deepEqual(possibleLoan.crew,['crew1','doctor'],'the reducer would admit this real helper if the controller borrowed its physician');
 const action=helper.controller(start,actor(start,'crew1'));assert.ok(!['artillery','artilleryReload','artilleryPivot','artilleryMove'].includes(action?.type));
 const physician=helper.controller(start,actor(start,'doctor'));assert.ok(!['move','artillery','artilleryReload','artilleryPivot','artilleryMove'].includes(physician?.type),'without a real patient the doctor does not blindly follow battery work');
 assert.deepEqual(start,before);assert.equal(gun(start).loaded,true);assert.equal(gun(start).ammo,2);assert.equal(actor(start,'doctor').medkits,3);
});

test('a finite physician approach uses the public route view and ignores unknown bodies and guns',()=>{
 const start=createBattle([
  {id:'doctor',x:2,y:2,medical:90,medkits:3,weapon:0,loaded:0,ammo:0,activeSlot:'medical',stance:'crouched',facing:6,energy:100,morale:90},
  {id:'patient',x:8,y:3,hp:8,maxHp:100,bleeding:3,bandaged:89,medical:0,medkits:0,weapon:0,loaded:0,ammo:0,stance:'prone',facing:2},
 ],{width:40,height:20,tiles:tiles(),seed:45,enemies:[{id:'target',x:37,y:17,weapon:0,hp:500,maxHp:500,patrol:false,overwatch:false}],artillery:[]});
 const before=structuredClone(start),doctor=actor(start,'doctor'),helper=coordinatedHospitalBattery(start),action=helper.controller(start,doctor);
 assert.equal(action?.type,'move');const route=getReachable(start,doctor).find(point=>sameCell(point,action));assert.ok(route&&route.cost>0&&route.cost<=20);
 const hidden=structuredClone(start);hidden.npcs.push({id:'unseen-resident',name:'Unseen resident',x:4,y:3,hp:100});hidden.artillery.push({id:'unseen-piece',type:'swivel',side:'enemy',x:3,y:4,loaded:true,ammo:9});
 assert.equal(teamCanSee(hidden,'player',hidden.npcs[0]),false);assert.equal(teamCanSee(hidden,'player',hidden.artillery[0]),false);
 const hiddenBefore=structuredClone(hidden);assert.deepEqual(coordinatedHospitalBattery(hidden).controller(hidden,actor(hidden,'doctor')),action,'unobserved physical occupancy is not a route-preview input');
 const after=replay(start,[action]);assert.equal(actor(after,'doctor').ap,doctor.ap-route.cost);assert.ok(actor(after,'doctor').energy<doctor.energy);
 assert.equal(actor(after,'doctor').medkits,doctor.medkits);assert.equal(actor(after,'patient').hp,actor(start,'patient').hp);assert.equal(actor(after,'patient').bleeding,actor(start,'patient').bleeding);
 assert.deepEqual(start,before);assert.deepEqual(hidden,hiddenBefore);
});


test('two actual prone contact crew pay both native rises before one finite gun action with exact full replay',()=>{
 const start=arena({target:true,crewProne:true}),before=structuredClone(start),helper=coordinatedHospitalBattery(start),orders=[];
 const physician=structuredClone(actor(start,'doctor')),gunBefore=structuredClone(gun(start));
 assert.deepEqual(helper.roles.crews,[{gunId:'clinic-gun',ids:['crew1','crew2']}]);
 assert.equal(actor(start,'crew1').stance,'prone');assert.equal(actor(start,'crew2').stance,'prone');
 const originalPlan=artilleryCrewPlan(start,actor(start,'crew1'),gun(start),artilleryCosts(start,actor(start,'crew1'),gun(start)).fire);
 assert.ok(originalPlan.reason,'both prone helpers currently cannot work the native gun');
 let after=start;
 for(const id of ['crew1','crew2']){
  const previous=structuredClone(after),member=actor(after,id),action=helper.controller(after,member),paid=stanceCost(member,'crouched');
  assert.deepEqual(action,{type:'stance',unitId:id,stance:'crouched'});assert.ok(paid>0);orders.push(action);after=replay(start,orders);
  assert.equal(actor(after,id).ap,member.ap-paid);assert.equal(actor(after,id).stance,'crouched');
  for(const other of previous.units.filter(v=>v.side==='player'&&v.id!==id))for(const key of ['x','y','tacticalLevel','ap','stance','energy','hp','bleeding','activeSlot','loaded','medkits','inventory'])assert.deepEqual(actor(after,other.id)[key],other[key],'one preview never pays or changes another real helper or physician');
  assert.deepEqual(after.artillery,previous.artillery);assert.deepEqual(unitAmmunitionByType(actor(after,id)),unitAmmunitionByType(member));
 }
 const preFire=structuredClone(after),leader=actor(after,'crew1'),action=helper.controller(after,leader),cost=artilleryCosts(after,leader,gun(after)).fire,plan=artilleryCrewPlan(after,leader,gun(after),cost);
 assert.equal(action?.type,'artillery');assert.equal(action.artilleryId,'clinic-gun');assert.equal(plan.reason,null);assert.deepEqual(plan.crew,['crew1','crew2']);
 orders.push(action);after=replay(start,orders);
 for(const id of plan.crew)assert.equal(actor(after,id).ap,actor(preFire,id).ap-cost);
 assert.equal(Number(gun(after).loaded)+gun(after).ammo,Number(gunBefore.loaded)+gunBefore.ammo-1);
 assert.equal(gun(after).x,gunBefore.x);assert.equal(gun(after).y,gunBefore.y);assert.equal(gun(after).type,gunBefore.type);
 assert.deepEqual(carried(actor(after,'doctor')),carried(physician));for(const key of ['x','y','ap','stance','energy'])assert.deepEqual(actor(after,'doctor')[key],physician[key]);assert.equal(orders.length,3);assert.deepEqual(replay(start,orders),after);assert.deepEqual(start,before);
});


// A new declared roof has a real obstructed interior lane, one friendly edge
// occupant, and two payable same-roof edge posts. No failed campaign input is
// used; its terrain, finite carried rounds and bodies are fresh declarations.
function lateralRoofArena({hidden=null}={}){
 const upperSurfaces=Array.from({length:20},(_,i)=>({id:`lateral-roof:${i}`,x:4+i%4,y:4+Math.floor(i/4),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0}));
 return createBattle([
  {id:'guard',x:5,y:6,tacticalLevel:1,weapon:1800,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:90,stance:'standing',facing:0,energy:100,morale:90},
  {id:'front',x:5,y:4,tacticalLevel:1,weapon:0,loaded:0,ammo:0,medical:0,medkits:0,stance:'standing',facing:0,energy:100,morale:90},
 ],{id:'declared-lateral-clinic',width:40,height:20,tiles:tiles(),upperSurfaces,hour:12,seed:45,
  enemies:[{id:'target',x:5,y:2,weapon:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false}],
  npcs:hidden?[{id:'unknown-resident',name:'Unobserved rear resident',...hidden.npc,hp:100}]:[],
  artillery:[{id:'clinic-gun',type:'bronze4',side:'player',x:20,y:10,loaded:true,ammo:2},...(hidden?[{id:'unknown-gun',type:'swivel',side:'enemy',...hidden.gun,loaded:true,ammo:9}]:[])],
 });
}
function payableRoofLanes(b,guard){
 const view=publicRouteView(b,guard);
 return getReachable(view,guard).filter(p=>p.cost>0&&p.cost<=20&&sameSurface(p,guard)&&Math.hypot(p.x-guard.x,p.y-guard.y)<=3)
  .map(point=>{
   // Elevated route cells include their authored surface ID. Preserve the
   // actor identity when asking the native paid shot preview about a cell.
   const posed={...guard,...spacePoint(point),ap:guard.ap-point.cost},next={...view,units:view.units.map(u=>u.id===guard.id?posed:u)};
   return {point,shot:usefulRouteRifleShot(next,posed)};
  }).filter(row=>row.shot);
}

test('a blocked clinic roof lane pays one local same-roof move then one finite safe rifle shot with exact replay',()=>{
 const start=lateralRoofArena(),before=structuredClone(start),guard=actor(start,'guard'),target=actor(start,'target'),front=structuredClone(actor(start,'front'));
 const helper=coordinatedHospitalBattery(start),view=publicRouteView(start,guard);
 assert.equal(start.mode,'combat');assert.equal(start.roundTimeCharged,false);
 assert.equal(hasLineOfSight(start,guard,target),false);assert.equal(teamCanSee(start,'player',target),true);assert.equal(usefulRouteRifleShot(view,guard),null);
 const lanes=payableRoofLanes(start,guard);assert.ok(lanes.length>0);assert.ok(lanes.every(row=>row.point.path.every(p=>p.kind==='move'&&sameSurface(p,guard))));
 const move=helper.controller(start,guard);assert.equal(move?.type,'move');assert.equal(move.unitId,guard.id);
 const lane=lanes.find(row=>sameCell(row.point,move));assert.ok(lane,'the actual chosen cell must admit a safe shot after its real movement cost');
 assert.ok(!sameCell(move,front));assert.ok(lane.point.cost>0&&lane.point.cost<=20);assert.equal(move.tacticalLevel,guard.tacticalLevel);
 const moved=replay(start,[move]),current=actor(moved,'guard');assert.ok(sameCell(current,move));assert.equal(current.ap,guard.ap-lane.point.cost);assert.ok(current.energy<guard.energy);
 assert.deepEqual(unitAmmunitionByType(current),unitAmmunitionByType(guard));assert.equal(current.medkits,guard.medkits);assert.deepEqual(moved.artillery,start.artillery);
 assert.equal(moved.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);
 for(const key of ['x','y','tacticalLevel','ap','hp','energy','loaded','ammo','medkits','inventory'])assert.deepEqual(actor(moved,'front')[key],front[key]);
 const fire=helper.controller(moved,current),safe=usefulRouteRifleShot(publicRouteView(moved,current),current);
 assert.equal(fire?.type,'fire');assert.equal(fire.unitId,guard.id);assert.equal(fire.targetId,target.id);assert.deepEqual(fire,safe);
 const costs=actionCosts(moved,current,actor(moved,'target')),after=replay(start,[move,fire]);
 assert.equal(actor(after,'guard').ap,current.ap-costs.fire-(fire.aim??0)*costs.aim);assert.equal(actor(after,'guard').loaded,current.loaded-1);
 assert.deepEqual(unitAmmunitionByType(actor(after,'guard')),Object.fromEntries(Object.entries(unitAmmunitionByType(guard)).map(([type,count])=>[type,count-(type==='musket_75'?1:0)])));
 assert.equal(actor(after,'guard').tacticalLevel,guard.tacticalLevel);assert.ok(sameCell(actor(after,'guard'),move));assert.equal(actor(after,'guard').hp,guard.hp);assert.deepEqual(after.artillery,start.artillery);
 assert.equal(actor(after,'front').hp,front.hp);assert.deepEqual(carried(actor(after,'front')),carried(front));assert.equal(after.elapsedSeconds,moved.elapsedSeconds);
 assert.deepEqual(replay(start,[move,fire]),after);assert.deepEqual(start,before);
});

test('native paid preparation with too little remaining AP cannot begin a useless roof-lane move or posture cycle',()=>{
 const start=lateralRoofArena(),before=structuredClone(start),preparation=[];let ready=start;
 // Spend AP only through real declared native orders. Every pair restores the
 // actual standing posture; this setup does not assign AP, energy or time.
 for(let attempt=0;attempt<20;attempt++){
  const guard=actor(ready,'guard'),down=stanceCost(guard,'prone'),up=stanceCost({...guard,stance:'prone'},'standing');
  assert.ok(down>0&&up>0);if(guard.ap<down+up)break;
  preparation.push({type:'stance',unitId:guard.id,stance:'prone'},{type:'stance',unitId:guard.id,stance:'standing'});ready=replay(start,preparation);
 }
 const guard=actor(ready,'guard'),snapshot=structuredClone(ready),helper=coordinatedHospitalBattery(ready);
 assert.ok(preparation.length>0);assert.equal(guard.stance,'standing');assert.ok(guard.ap<actor(start,'guard').ap);assert.deepEqual(payableRoofLanes(ready,guard),[]);
 assert.deepEqual(unitAmmunitionByType(guard),unitAmmunitionByType(actor(start,'guard')));assert.deepEqual(ready.artillery,start.artillery);
 for(let decision=0;decision<4;decision++)assert.equal(helper.controller(ready,guard),null,'a useful endpoint without its payable subsequent shot is not admitted');
 assert.deepEqual(ready,snapshot);assert.deepEqual(replay(start,preparation),ready);assert.deepEqual(start,before);
});

test('unobserved rear people and guns do not change the public local roof-lane proposal',()=>{
 const first=lateralRoofArena({hidden:{npc:{x:4,y:8,tacticalLevel:1},gun:{x:4,y:9}}}),second=lateralRoofArena({hidden:{npc:{x:7,y:8,tacticalLevel:1},gun:{x:7,y:9}}});
 const firstBefore=structuredClone(first),secondBefore=structuredClone(second);
 for(const b of [first,second]){
  assert.equal(teamCanSee(b,'player',b.npcs[0]),false);assert.equal(teamCanSee(b,'player',b.artillery.find(g=>g.id==='unknown-gun')),false);
  assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(b))),b);
 }
 const guard=actor(first,'guard'),other=actor(second,'guard'),known=publicRouteView(first,guard),otherKnown=publicRouteView(second,other);
 assert.deepEqual(known,otherKnown,'the planning copies contain the same currently observed physical owners and geometry');
 const action=coordinatedHospitalBattery(first).controller(first,guard),otherAction=coordinatedHospitalBattery(second).controller(second,other);
 assert.equal(action?.type,'move');assert.equal(action.unitId,guard.id);assert.deepEqual(otherAction,action);
 assert.ok(payableRoofLanes(first,guard).some(row=>sameCell(row.point,action)));assert.ok(payableRoofLanes(second,other).some(row=>sameCell(row.point,action)));
 // This is a planning invariance check. Actual execution still owns physical
 // collision admission; no hidden occupant is ignored or removed from play.
 assert.deepEqual(first,firstBefore);assert.deepEqual(second,secondBefore);
});


// A fresh declared roof wall isolates the final-step-facing cost. The native
// factory derives the marginal AP from the declared body and breath; no AP,
// energy, clock, campaign outcome or failed input is assigned afterwards.
function movementBodyRoofArena({marginal=false}={}){
 const upperSurfaces=Array.from({length:30},(_,i)=>({id:`movement-body-roof:${i}`,x:3+i%5,y:1+Math.floor(i/5),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0}));
 return createBattle([
  {id:'guard',x:5,y:4,tacticalLevel:1,weapon:1805,loaded:1,ammo:5,hp:marginal?20:100,maxHp:marginal?20:100,agility:marginal?1:75,dexterity:marginal?1:75,experienceLevel:marginal?1:4,medical:0,medkits:0,marksmanship:100,stance:'standing',facing:0,energy:marginal?8:100,morale:90},
  {id:'front',x:4,y:2,tacticalLevel:1,weapon:0,loaded:0,ammo:0,medical:0,medkits:0,stance:'standing',facing:0,energy:100,morale:90},
 ],{id:'declared-movement-body-clinic',width:40,height:20,tiles:tiles(),upperSurfaces,
  wallEdges:[{id:'roof-screen',x:5,y:4,axis:'x',tacticalLevel:1,type:'wall',material:'adobe',cover:40,blocksSight:true}],
  hour:12,seed:45,enemies:[{id:'target',x:5,y:2,tacticalLevel:1,weapon:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false}],
  artillery:[{id:'clinic-gun',type:'bronze4',side:'player',x:20,y:10,loaded:true,ammo:2}],
 });
}

test('native final-step facing prevents a marginal AP roof move that cannot pay its next rifle shot',()=>{
 const start=movementBodyRoofArena({marginal:true}),before=structuredClone(start),guard=actor(start,'guard'),target=actor(start,'target'),view=publicRouteView(start,guard);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(start))),start);assert.equal(guard.hp,20);assert.equal(guard.energy,8);assert.equal(guard.ap,17);
 assert.equal(hasLineOfSight(start,guard,target),false);assert.equal(teamCanSee(start,'player',target),true);assert.equal(usefulRouteRifleShot(view,guard),null);
 const point=getReachable(view,guard).find(p=>p.x===4&&p.y===4&&sameSurface(p,guard));assert.ok(point);assert.equal(point.cost,8);
 const stale={...guard,...spacePoint(point),ap:guard.ap-point.cost,weaponReady:false,momentum:1},staleView={...view,units:view.units.map(v=>v.id===guard.id?stale:v)};
 assert.equal(actionCosts(staleView,stale,target).fire,7);assert.equal(usefulRouteRifleShot(staleView,stale)?.type,'fire','the old unchanged-facing quote incorrectly admits a shot');
 const paid=paidHospitalRoofWalkPreview(view,guard,point);assert.ok(paid);assert.equal(paid.actor.ap,9);assert.equal(paid.actor.facing,6);assert.equal(paid.actor.energy,7);
 assert.equal(actionCosts(paid.view,paid.actor,target).fire,11);assert.equal(usefulRouteRifleShot(paid.view,paid.actor),null);
 const helper=coordinatedHospitalBattery(start);for(let i=0;i<4;i++)assert.equal(helper.controller(start,guard),null,'no paid lane is useful when its actual subsequent turn/fire cost is unaffordable');
 // Execute the legal lateral move only as an independent native oracle. Its
 // actual field has the quoted body costs; the subsequent shot is rejected.
 const move={type:'move',unitId:guard.id,...spacePoint(point)},moved=replay(start,[move]),current=actor(moved,'guard');
 for(const key of ['x','y','tacticalLevel','ap','energy','facing','momentum','lastDirection','weaponReady'])assert.deepEqual(current[key],paid.actor[key]);
 assert.equal(moved.elapsedSeconds,paid.view.elapsedSeconds);assert.equal(moved.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);
 const refused={type:'fire',unitId:guard.id,targetId:target.id,aim:0,hitLocation:'torso'},direct=actBattle(moved,refused),presented=presentedActBattle(moved,refused).state,restored=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(moved))),refused))));
 assert.ok(direct.lastError);assert.deepEqual(presented,direct);assert.deepEqual(restored,direct);assert.deepEqual(actor(direct,'guard'),current);assert.deepEqual(direct.artillery,start.artillery);assert.equal(direct.elapsedSeconds,moved.elapsedSeconds);
 assert.deepEqual(unitAmmunitionByType(current),unitAmmunitionByType(guard));assert.deepEqual(start,before);
});

test('a payable roof lane forecasts native movement body fields before exact finite fire and full replay',()=>{
 const start=movementBodyRoofArena(),before=structuredClone(start),guard=actor(start,'guard'),target=actor(start,'target'),view=publicRouteView(start,guard),helper=coordinatedHospitalBattery(start);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(start))),start);assert.equal(hasLineOfSight(start,guard,target),false);assert.equal(usefulRouteRifleShot(view,guard),null);
 const move=helper.controller(start,guard);assert.equal(move?.type,'move');const point=getReachable(view,guard).find(p=>sameCell(p,move));assert.ok(point);assert.ok(point.path.every(p=>p.kind==='move'&&sameSurface(p,guard)));
 const paid=paidHospitalRoofWalkPreview(view,guard,point);assert.ok(paid);const quoted=usefulRouteRifleShot(paid.view,paid.actor);assert.equal(quoted?.type,'fire');
 const moved=replay(start,[move]),current=actor(moved,'guard');for(const key of ['x','y','tacticalLevel','ap','energy','facing','momentum','lastDirection','weaponReady','fatigue'])assert.deepEqual(current[key],paid.actor[key]);
 for(const key of ['elapsedSeconds','roundTimeCharged','night','weather','lights'])assert.deepEqual(moved[key],paid.view[key]);assert.equal(current.ap,guard.ap-point.cost);assert.ok(current.energy<guard.energy);assert.notEqual(current.facing,guard.facing);
 const fire=helper.controller(moved,current),safe=usefulRouteRifleShot(publicRouteView(moved,current),current);assert.deepEqual(fire,safe);assert.deepEqual(fire,quoted);
 const costs=actionCosts(moved,current,actor(moved,'target')),after=replay(start,[move,fire]);assert.equal(actor(after,'guard').ap,current.ap-costs.fire-(fire.aim??0)*costs.aim);
 assert.equal(actor(after,'guard').loaded,current.loaded-1);assert.deepEqual(unitAmmunitionByType(actor(after,'guard')),Object.fromEntries(Object.entries(unitAmmunitionByType(guard)).map(([type,count])=>[type,count-(type==='pistol_69'?1:0)])));
 assert.equal(actor(after,'guard').hp,guard.hp);assert.equal(actor(after,'guard').medkits,guard.medkits);assert.deepEqual(after.artillery,start.artillery);for(const key of ['x','y','tacticalLevel','ap','energy','hp','loaded','inventory'])assert.deepEqual(actor(after,'front')[key],actor(start,'front')[key]);
 assert.equal(after.elapsedSeconds,moved.elapsedSeconds);assert.deepEqual(replay(start,[move,fire]),after);assert.deepEqual(start,before);
});


// Fresh subsystem declarations only. No failed Tucumán state is used here.
function blockingCrewArena({wall=false,patient=false,marginal=false,blocker=false,hidden=null}={}){
 return createBattle([
  {id:'crew1',x:5,y:5,weapon:0,loaded:0,ammo:0,medical:0,medkits:0,stance:'standing',facing:2,morale:90,energy:marginal?8:100,...(marginal?{hp:20,maxHp:20,agility:1,dexterity:1,experienceLevel:1}:{})},
  {id:'crew2',x:7,y:6,weapon:0,loaded:0,ammo:0,medical:0,medkits:0,stance:'standing',facing:2,morale:90,energy:100,...(patient?{hp:8,maxHp:100,bleeding:3,bandaged:89}:{})},
  {id:'doctor',x:8,y:6,weapon:0,loaded:0,ammo:0,medical:90,medkits:3,stance:'crouched',facing:0,morale:90,energy:100},
  ...(wall?[{id:'observer',x:14,y:7,weapon:0,loaded:0,ammo:0,medkits:0,medical:0,stance:'standing',facing:4}]:[]),
  ...(blocker?[{id:'blocker',x:12,y:8,weapon:0,loaded:0,ammo:0,medkits:0,medical:0,stance:'standing',facing:0}]:[]),
 ],{id:'declared-blocking-hospital-crew',width:40,height:20,tiles:tiles(),hour:12,seed:45,
  enemies:[{id:'target',x:14,y:13,weapon:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false}],
  wallEdges:wall?[9,10].flatMap(x=>Array.from({length:20},(_,y)=>({id:`stone-screen:${x}:${y}`,x,y,axis:'y',type:'wall',material:'stone',cover:40,blocksSight:true}))):[],
  npcs:hidden?[{id:'unseen-resident',name:'Unseen resident',...hidden.npc,hp:100}]:[],
  artillery:[{id:'clinic-gun',side:'player',type:'bronze4',x:6,y:5,facing:0,loaded:true,ammo:2},...(hidden?[{id:'unseen-piece',side:'enemy',type:'swivel',...hidden.gun,loaded:true,ammo:9}]:[])],
 });
}

test('a healthy blocking crew member pays a contact-lane move before one finite cannon shot and reload with full replay',()=>{
 const start=blockingCrewArena(),before=structuredClone(start),helper=coordinatedHospitalBattery(start),member=actor(start,'crew2'),shooter=actor(start,'crew1'),target=actor(start,'target');
 assert.deepEqual(helper.roles,{physicianId:'doctor',crews:[{gunId:'clinic-gun',ids:['crew1','crew2']}]});assert.equal(teamCanSee(start,'player',target),true);
 assert.ok(artilleryShotTrace(publicRouteView(start,shooter),shooter,gun(start),target,'solid').events.some(e=>e.type==='impact'&&e.unitId===member.id));
 assert.equal(artilleryShotTrace(publicRouteView(start,shooter),shooter,gun(start),target,'canister').events.some(e=>e.type==='impact'&&e.unitId===target.id),false,'the declared diagonal target is beyond the bronze canister eight-cell reach');assert.ok(Math.hypot(target.x-gun(start).x,target.y-gun(start).y)>8);assert.equal(artilleryContact(start,actor(start,'doctor'),gun(start)),false,'the physician is an adjacent medical owner, not a spare native cannon crew');
 const move=helper.controller(start,member);assert.equal(move?.type,'move');assert.equal(move.unitId,member.id);assert.ok(!sameCell(move,gun(start)));
 const point=getReachable(publicRouteView(start,member),member).find(p=>sameCell(p,move));assert.ok(point&&point.cost>0&&point.cost<=20);assert.ok(point.path.every(p=>artilleryContact(start,{...member,...spacePoint(p)},gun(start))));
 assert.ok(point.path.some(step=>step.kind===undefined),'the native flat route has untagged ground cells');const forecast=paidHospitalRoofWalkPreview(publicRouteView(start,member),member,point);assert.ok(forecast);
 const moved=replay(start,[move]),ready=actor(moved,member.id);for(const key of ['ap','energy','facing','momentum','lastDirection','weaponReady'])assert.deepEqual(ready[key],forecast.actor[key]);assert.equal(moved.elapsedSeconds,forecast.view.elapsedSeconds);assert.equal(ready.ap,member.ap-point.cost);assert.ok(ready.energy<member.energy);assert.ok(artilleryContact(moved,ready,gun(moved)));assert.deepEqual(moved.artillery,start.artillery);assert.deepEqual(unitAmmunitionByType(ready),unitAmmunitionByType(member));
 const fire=helper.controller(moved,actor(moved,shooter.id));assert.equal(fire?.type,'artillery');const cost=artilleryCosts(moved,actor(moved,shooter.id),gun(moved)).fire,plan=artilleryCrewPlan(moved,actor(moved,shooter.id),gun(moved),cost);assert.equal(plan.reason,null);assert.ok(plan.crew.every(id=>helper.roles.crews[0].ids.includes(id)));
 const fired=replay(start,[move,fire]);for(const id of plan.crew)assert.equal(actor(fired,id).ap,actor(moved,id).ap-cost);assert.equal(Number(gun(fired).loaded)+gun(fired).ammo,Number(gun(start).loaded)+gun(start).ammo-1);
 const load=helper.controller(fired,actor(fired,member.id));assert.equal(load?.type,'artilleryReload');const quote=artilleryReloadPreview(fired,actor(fired,member.id),gun(fired)),after=replay(start,[move,fire,load]);assert.equal(quote.valid,true);for(const id of quote.crew)assert.equal(actor(after,id).ap,actor(fired,id).ap-quote.pa);
 assert.equal(Number(gun(after).loaded)+gun(after).ammo,Number(gun(fired).loaded)+gun(fired).ammo);assert.deepEqual(carried(actor(after,'doctor')),carried(actor(start,'doctor')));for(const key of ['x','y','tacticalLevel','ap','energy','stance'])assert.deepEqual(actor(after,'doctor')[key],actor(start,'doctor')[key]);assert.deepEqual(replay(start,[move,fire,load]),after);assert.deepEqual(start,before);
});

test('an unavailable critical crew member holds cannon work while adjacent finite physician care keeps priority',()=>{
 const start=blockingCrewArena({patient:true}),before=structuredClone(start),helper=coordinatedHospitalBattery(start);assert.deepEqual(helper.roles.crews,[{gunId:'clinic-gun',ids:['crew1']}]);
 const gunner=helper.controller(start,actor(start,'crew1'));assert.ok(!['move','artillery','artilleryPivot','artilleryReload'].includes(gunner?.type));
 const activate=helper.controller(start,actor(start,'doctor'));assert.deepEqual(activate,{type:'weapon',unitId:'doctor',slot:'medical'});const prepared=replay(start,[activate]),aid=helper.controller(prepared,actor(prepared,'doctor'));assert.equal(aid?.type,'useItem');assert.equal(aid.targetId,'crew2');
 const after=replay(start,[activate,aid]);assert.equal(actor(after,'doctor').medkits,actor(start,'doctor').medkits-1);assert.ok(actor(after,'crew2').bleeding<actor(start,'crew2').bleeding);assert.deepEqual(after.artillery,start.artillery);assert.deepEqual(start,before);
});

test('a known target behind opaque cannon walls cannot justify crew clearance without a safe payable gun action',()=>{
 const start=blockingCrewArena({wall:true}),before=structuredClone(start),helper=coordinatedHospitalBattery(start),target=actor(start,'target');assert.equal(teamCanSee(start,'player',target),true);
 for(const id of ['crew1','crew2'])for(let i=0;i<4;i++)assert.ok(!['move','artillery','artilleryPivot'].includes(helper.controller(start,actor(start,id))?.type));
 const view=publicRouteView(start,actor(start,'crew1'));assert.ok(artilleryShotTrace(view,actor(start,'crew1'),gun(start),target,'solid').events.some(e=>e.type==='stop'));assert.deepEqual(start,before);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(start))),start);
});

test('unknown distant people and guns do not change the public paid contact-lane choice',()=>{
 const a=blockingCrewArena({hidden:{npc:{x:35,y:18},gun:{x:35,y:17}}}),b=blockingCrewArena({hidden:{npc:{x:38,y:18},gun:{x:38,y:17}}}),beforeA=structuredClone(a),beforeB=structuredClone(b);
 for(const s of [a,b]){assert.equal(teamCanSee(s,'player',s.npcs[0]),false);assert.equal(teamCanSee(s,'player',s.artillery[1]),false);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(s))),s);}
 for(const s of [a,b]){const view=publicRouteView(s,actor(s,'crew1')),target=actor(s,'target');assert.ok(artilleryShotTrace(view,actor(s,'crew1'),gun(s),target,'solid').events.some(e=>e.type==='impact'&&e.unitId==='crew2'));assert.equal(artilleryShotTrace(view,actor(s,'crew1'),gun(s),target,'canister').events.some(e=>e.type==='impact'&&e.unitId===target.id),false);assert.equal(artilleryContact(s,actor(s,'doctor'),gun(s)),false);}
 const first=coordinatedHospitalBattery(a).controller(a,actor(a,'crew2')),second=coordinatedHospitalBattery(b).controller(b,actor(b,'crew2'));assert.equal(first?.type,'move');assert.deepEqual(first,second);assert.deepEqual(publicRouteView(a,actor(a,'crew2')),publicRouteView(b,actor(b,'crew2')));assert.deepEqual(a,beforeA);assert.deepEqual(b,beforeB);
});

test('a cached contact clearance pays only its reached native cell and stops when a real friendly move occupies the remainder',()=>{
 const start=blockingCrewArena({blocker:true}),before=structuredClone(start),member=actor(start,'crew2'),view=publicRouteView(start,member),point=getReachable(view,member).find(p=>p.path.length===2&&p.cost>0&&p.cost<=20&&!sameCell(p,gun(start))&&p.path.every(step=>artilleryContact(view,{...member,...spacePoint(step)},gun(start))));assert.ok(point);
 const order={type:'move',unitId:member.id,...spacePoint(point)},first=movementStep(start,order,point.path);assert.equal(first.status,'moving');assert.equal(first.continuation.length,1);assert.ok(!sameCell(actor(first.state,member.id),point));
 const savedFirst=movementStep(validateBattleSnapshot(JSON.parse(JSON.stringify(start))),order,point.path);assert.deepEqual(savedFirst,first);assert.equal(first.state.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);
 const occupy={type:'move',unitId:'blocker',...spacePoint(point)},occupied=replay(first.state,[occupy]);assert.ok(sameCell(actor(occupied,'blocker'),point));const snapshot=structuredClone(occupied),stopped=movementStep(occupied,order,first.continuation);assert.equal(stopped.status,'stopped');assert.equal(stopped.continuation,null);assert.ok(stopped.state.lastError);
 assert.deepEqual(actor(stopped.state,member.id),actor(occupied,member.id));assert.deepEqual(stopped.state.artillery,occupied.artillery);assert.equal(stopped.state.elapsedSeconds,occupied.elapsedSeconds);assert.deepEqual(movementStep(validateBattleSnapshot(JSON.parse(JSON.stringify(occupied))),order,first.continuation),stopped);assert.deepEqual(occupied,snapshot);assert.deepEqual(start,before);
});

test('insufficient actual crew AP refuses both a speculative clearance and the native finite gun shot atomically',()=>{
 const start=blockingCrewArena({marginal:true}),before=structuredClone(start),helper=coordinatedHospitalBattery(start),shooter=actor(start,'crew1');assert.equal(shooter.ap,17);
 assert.equal(artilleryCosts(start,actor(start,'crew2'),gun(start)).fire,30);assert.ok(shooter.ap<30);assert.equal(artilleryContact(start,actor(start,'doctor'),gun(start)),false,'no eligible supplied physician can mask the real seventeen-versus-thirty AP crew shortage');
 assert.ok(artilleryCrewPlan(start,actor(start,'crew2'),gun(start),artilleryCosts(start,actor(start,'crew2'),gun(start)).fire).reason);assert.ok(!['move','artillery','artilleryPivot'].includes(helper.controller(start,actor(start,'crew2'))?.type));
 const action={type:'artillery',unitId:'crew2',artilleryId:gun(start).id,x:14,y:13,mode:'solid'},direct=actBattle(start,action),presented=presentedActBattle(start,action).state,restored=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(start))),action))));assert.ok(direct.lastError);assert.deepEqual(presented,direct);assert.deepEqual(restored,direct);assert.deepEqual(direct.units,start.units);assert.deepEqual(direct.artillery,start.artillery);assert.equal(direct.elapsedSeconds,start.elapsedSeconds);assert.deepEqual(start,before);
});

// Paid personnel and geography are created by the normal initial campaign and
// real civic hires. No strategic field, HP, term, money or clock is patched.
function freshPaidRear(){
 let c=initialCampaign(42);const setup=[];const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null);setup.push(a);};
 const available=()=>rosterFor(c).filter(op=>op.id>=100&&op.id<1000&&civicStatus(c,op.id).available&&hiringTravelHours(c,op.id)===0).map(op=>({op,quote:contractQuote(c,op,'day')})).filter(row=>row.quote.available&&row.quote.total<=200);
 const doctor=available().filter(row=>row.op.medical>=60).sort((a,b)=>b.op.medical-a.op.medical||a.quote.total-b.quote.total||a.op.id-b.op.id)[0];assert.ok(doctor);order({type:'recruitCivic',id:doctor.op.id,term:'day',destination:c.location});
 const guard=available().filter(row=>row.op.id!==doctor.op.id&&row.op.medical<60).sort((a,b)=>a.quote.total-b.quote.total||b.op.marksmanship-a.op.marksmanship||a.op.id-b.op.id)[0];assert.ok(guard);order({type:'recruitCivic',id:guard.op.id,term:'day',destination:c.location});
 assert.ok(c.recruited.includes(doctor.op.id)&&c.recruited.includes(guard.op.id));return {campaign:c,doctorId:doctor.op.id,guardId:guard.op.id,setup};
}

test('physician selection keeps cardinality one and does not suspend actual patient or clinician obligations',()=>{
 const {campaign:start,guardId,doctorId}=freshPaidRear(),before=structuredClone(start),guards=[guardId];assert.deepEqual(northernHospitalRearPhysicians(start,guards,start.location),[doctorId]);assert.deepEqual(northernHospitalRearPhysicians(start,[guardId,doctorId],start.location),[],'a physician already in the prepared guard cohort needs no second support role');
 const primary=rosterFor(start).find(op=>op.id===doctorId),lower=rosterFor(start).filter(op=>op.id!==doctorId&&op.medical>=60&&op.medical<primary.medical&&civicStatus(start,op.id).available&&hiringTravelHours(start,op.id)===0&&contractQuote(start,op,'day').available&&contractQuote(start,op,'day').total<=200).sort((a,b)=>b.medical-a.medical)[0];assert.ok(lower);const spare=dispatchCampaign(start,{type:'recruitCivic',id:lower.id,term:'day',destination:start.location});assert.equal(spare.lastError,null);const spareBefore=structuredClone(spare);assert.deepEqual(northernHospitalRearPhysicians(spare,[guardId,doctorId],spare.location),[],'an already prepared highest supplied role does not create a lower-skilled extra role');assert.deepEqual(spare,spareBefore);const occupiedRole=dispatchCampaign(spare,{type:'assignCare',operativeId:doctorId,assignment:'doctor'});assert.equal(occupiedRole.lastError,null);assert.deepEqual(northernHospitalRearPhysicians(occupiedRole,[guardId],occupiedRole.location),[],'a spare does not replace the actual physician with a current clinician obligation');
 for(const assignment of ['patient','doctor']){const duty=dispatchCampaign(start,{type:'assignCare',operativeId:doctorId,assignment});assert.equal(duty.lastError,null);const snapshot=structuredClone(duty);assert.deepEqual(northernHospitalRearPhysicians(duty,guards,duty.location),[]);assert.deepEqual(duty,snapshot);assert.deepEqual(decodeSave(encodeSave(duty)).campaign,duty);}
 const otherDuty=dispatchCampaign(start,{type:'assignCare',operativeId:guardId,assignment:'patient'});assert.equal(otherDuty.lastError,null);const otherBefore=structuredClone(otherDuty);assert.deepEqual(northernHospitalRearPhysicians(otherDuty,[],otherDuty.location),[],'staging does not temporarily activate a shared squad with an existing patient duty');assert.deepEqual(otherDuty,otherBefore);assert.deepEqual(start,before);
});
