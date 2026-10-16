import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,getReachable,actionCosts,stanceCost,medicalUsePreview,teamCanSee,hasLineOfSight,artilleryContact} from '../game/tactical.js';
import {sameCell,sameSurface,spacePoint,surfaceAt} from '../game/tactical-space.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {medicalPatientAvailable} from '../game/medical-patient.js';
import {criticalFirstAidNeeded} from '../game/first-aid.js';
import {createdUspallataBattery} from './created-uspallata-battery.mjs';
import {publicRouteView,usefulRouteRifleShot} from './route-infantry-progress.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';

const unit=(b,id)=>b.units.find(actor=>actor.id===id),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

// A portable medical policy boundary: eight actual declared people, two finite
// guns, one already wounded gunner and a current team-known hostile. Every
// position, wound, kit, obstacle and cover value precedes the Native factory.
// These controls make no claim about an earned campaign or a battle outcome.
function arena({kind='protected',stance='standing',near=false,hiddenX=26,hiddenWeapon=1800}={}){
 const width=28,height=21,players=[
  {id:'doctor',x:3,y:7,medical:95,medkits:3,activeSlot:'medical',stance,movementMode:stance==='prone'?'prone':stance==='crouched'?'crouch':'walk',marksmanship:99},
  {id:'patient',x:near?4:kind==='path'?6:7,y:7,hp:20,maxHp:100,bleeding:1,marksmanship:0},
  {id:'heavy-two',x:6,y:8,marksmanship:1},{id:'heavy-three',x:8,y:8,marksmanship:2},
  {id:'small-one',x:13,y:7,marksmanship:3},
  {id:'observer',x:kind==='protected'?19:kind==='close'?9:11,y:kind==='protected'?4:kind==='close'?6:8,marksmanship:90},
  {id:'screen-two',x:10,y:12,marksmanship:91},{id:'screen-three',x:3,y:10,marksmanship:92},
 ].map(raw=>({name:raw.id,hp:100,maxHp:100,weapon:1800,blade:1813,loaded:1,ammo:11,medical:0,medkits:0,energy:100,fatigue:0,morale:90,stance:'crouched',movementMode:'crouch',strength:100,dexterity:90,experienceLevel:4,facing:2,overwatch:false,...raw}));
 const tiles=Array.from({length:width*height},(_,i)=>{
  const x=i%width,y=Math.floor(i/width),stone=kind==='protected'&&x===17||y===18&&x>=18;
  const covered=kind==='protected'||kind==='cover'?x===3&&y===7:kind==='path'?y===7&&[3,5].includes(x):false;
  return {x,y,type:stone?'stone':'grass',...(stone?{material:'stone'}:{}),blocked:stone,blocksSight:stone,cover:kind==='protected'?20:covered?40:0};
 });
 const contact={id:'contact',name:'Contacto actual',x:kind==='protected'?20:kind==='close'?8:12,y:kind==='protected'?4:7,hp:100,maxHp:100,weapon:1800,loaded:1,ammo:5,stance:'standing',facing:6,patrol:false,overwatch:false};
 const options={id:'declared-uspallata-medical-safety',width,height,hour:12,seed:45,tiles,
  props:kind==='rise'?[{id:'low-screen',type:'table',x:4,y:7,obstacleHeight:.8,blocksSight:true}]:[],
  enemies:[contact,{id:'unseen',name:'Reserva no vista',x:hiddenX,y:20,hp:100,maxHp:100,weapon:hiddenWeapon,loaded:1,ammo:5,stance:'standing',patrol:false,overwatch:false}],
  artillery:[{id:'heavy',type:'field8',side:'player',x:7,y:8,loaded:true,ammo:2},{id:'small',type:'swivel',side:'player',x:13,y:8,loaded:true,ammo:2}],
 };
 const declared=structuredClone({players,options}),battle=createBattle(players,options);
 assert.deepEqual({players,options},declared);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);
 assert.equal(battle.mode,'combat');assert.equal(teamCanSee(battle,'player',unit(battle,'contact')),true);assert.equal(teamCanSee(battle,'player',unit(battle,'unseen')),false);
 return battle;
}

function replay(start,orders){
 let direct=structuredClone(start),shown=structuredClone(start),validated=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  direct=actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action)+': '+direct.lastError);
  shown=presentedActBattle(shown,JSON.parse(JSON.stringify(action))).state;
  validated=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(validated,JSON.parse(JSON.stringify(action))))));
  assert.deepEqual(shown,direct);assert.deepEqual(validated,direct);
 }
 return direct;
}

// Exact former 095d physician approach rules. The ordinary adjacent Native
// chooser and the public route/medical quotes remain part of the comparison.
function formerMedicalOrder(b,u){
 const normal=tucumanCombatOrder(b,u);if(normal?.type==='useItem'||normal?.slot==='medical'||u.knockedDown||u.entangled)return normal;
 const patients=b.units.filter(p=>p.side===u.side&&p.id!==u.id&&medicalPatientAvailable(p)&&(p.bleeding>0||criticalFirstAidNeeded(p))).sort((a,c)=>a.hp-c.hp||String(a.id).localeCompare(String(c.id)));
 for(const patient of patients){
  const budget=Math.min(16,u.ap-actionCosts(b,u).weapon-actionCosts(b,u).heal);
  if(u.stance==='prone'&&!u.mounted&&u.medkits&&sameSurface(u,patient)){
   const hand=actionCosts(b,u).weapon,quote=(stance,movementMode)=>{
    const paid=stanceCost(u,stance),actor={...u,stance,movementMode,ap:u.ap-paid},view=publicRouteView(b,actor),points=getReachable(view,actor).filter(p=>sameSurface(p,u)&&p.path.every(step=>sameSurface(step,u)));
    const goals=points.filter(p=>p.cost>0&&medicalUsePreview(view,{...actor,...spacePoint(p),activeSlot:'medical',ap:actor.ap-p.cost-hand},patient).allowed).sort((a,c)=>a.cost-c.cost||a.y-c.y||a.x-c.x);return {paid,points,goal:goals[0]};
   };
   const crawling=quote(u.stance,u.movementMode),walking=quote('standing','walk');
   if(walking.goal&&(!crawling.goal||walking.paid+walking.goal.cost<crawling.goal.cost)){
    const point=walking.goal.path.map(step=>walking.points.find(p=>sameCell(p,step))).filter(p=>p&&p.cost>0&&walking.paid+p.cost<=budget).at(-1);if(point)return {type:'move',unitId:u.id,...spacePoint(point),movement:'walk'};
   }
  }
  const view=publicRouteView(b,u),points=getReachable(view,u).filter(p=>p.cost>0&&p.cost<=Math.min(budget,u.ap)&&sameSurface(p,u)&&p.path.every(step=>sameSurface(step,u))&&distance(p,patient)<distance(u,patient));
  points.sort((a,c)=>distance(a,patient)-distance(c,patient)||a.cost-c.cost||a.y-c.y||a.x-c.x);if(points[0])return {type:'move',unitId:u.id,...spacePoint(points[0])};
 }
 const shot=usefulRouteRifleShot(publicRouteView(b,u),u);if(shot)return shot;
 return u.stance!=='prone'&&u.ap>=stanceCost(u,'prone')?{type:'stance',unitId:u.id,stance:'prone'}:null;
}

const moveQuote=(b,u,action)=>{
 const paid=action.movement?stanceCost(u,'standing'):0,actor=action.movement?{...u,stance:'standing',movementMode:action.movement,ap:u.ap-paid}:u;
 const point=getReachable(publicRouteView(b,u),actor,{stopAt:p=>sameCell(p,action)})[0];assert.ok(point?.cost>0);return {paid,actor,point};
};

test('a quoted medical rise cannot open a new current hostile sightline at the original doctor post',()=>{
 const start=arena({kind:'rise',stance:'prone'}),before=structuredClone(start),doctor=unit(start,'doctor'),contact=unit(start,'contact'),helper=createdUspallataBattery(start);
 assert.equal(helper.roles.physicianId,doctor.id);assert.equal(hasLineOfSight(start,contact,doctor),false);assert.equal(hasLineOfSight(start,contact,{...doctor,stance:'standing'}),true);
 const old=formerMedicalOrder(start,doctor);assert.equal(old.type,'move');assert.equal(old.movement,'walk');const quote=moveQuote(start,doctor,old);assert.ok(quote.paid+quote.point.cost<=16);
 const exposed=replay(start,[old]);assert.equal(unit(exposed,'doctor').stance,'standing');assert.ok(unit(exposed,'doctor').ap<doctor.ap);assert.equal(hasLineOfSight(exposed,unit(exposed,'contact'),unit(exposed,'doctor')),true);assert.equal(unit(exposed,'doctor').medkits,doctor.medkits);
 assert.equal(helper.controller(start,doctor),null);assert.deepEqual(start,before);
});

test('a generic patient approach cannot spend the physician current terrain cover',()=>{
 const start=arena({kind:'cover'}),before=structuredClone(start),doctor=unit(start,'doctor'),old=formerMedicalOrder(start,doctor);assert.equal(old.type,'move');const quote=moveQuote(start,doctor,old);
 assert.ok((surfaceAt(start,quote.point)?.cover??0)<surfaceAt(start,doctor).cover);const exposed=replay(start,[old]);assert.ok((surfaceAt(exposed,unit(exposed,'doctor'))?.cover??0)<surfaceAt(start,doctor).cover);
 const action=createdUspallataBattery(start).controller(start,doctor);assert.deepEqual(action,{type:'stance',unitId:doctor.id,stance:'prone'});const held=replay(start,[action]);assert.deepEqual(spacePoint(unit(held,'doctor')),spacePoint(doctor));assert.equal(unit(held,'doctor').medkits,doctor.medkits);assert.deepEqual(start,before);
});

test('an equally covered treatment endpoint cannot hide an exposed intermediate medical path cell',()=>{
 const start=arena({kind:'path'}),before=structuredClone(start),doctor=unit(start,'doctor'),old=formerMedicalOrder(start,doctor);assert.equal(old.type,'move');const {point}=moveQuote(start,doctor,old);
 assert.equal(surfaceAt(start,point).cover,surfaceAt(start,doctor).cover);assert.ok(point.path.some(step=>surfaceAt(start,step).cover<surfaceAt(start,doctor).cover));assert.equal(medicalUsePreview(publicRouteView(start,doctor),{...doctor,...spacePoint(point),ap:doctor.ap-point.cost-actionCosts(start,doctor).weapon},unit(start,'patient')).allowed,true);replay(start,[old]);
 const action=createdUspallataBattery(start).controller(start,doctor);assert.deepEqual(action,{type:'stance',unitId:doctor.id,stance:'prone'});replay(start,[action]);assert.deepEqual(start,before);
});

test('a protected actual medical route still pays the current gait, hand and finite aid at its fixed cannon crew',()=>{
 for(const stance of ['standing','crouched','prone']){
  const start=arena({kind:'protected',stance}),before=structuredClone(start),helper=createdUspallataBattery(start),contact=unit(start,'contact');assert.ok(helper.roles.crews.some(crew=>crew.ids.includes('patient')));assert.equal(hasLineOfSight(start,contact,unit(start,'doctor')),false);
  let battle=start;const orders=[];let treated=false;
  for(let n=0;n<8;n++){
   const doctor=unit(battle,'doctor'),patient=unit(battle,'patient'),action=helper.controller(battle,doctor);assert.ok(action);assert.ok(['move','weapon','useItem'].includes(action.type));
   if(action.type==='move'){
    const quote=moveQuote(battle,doctor,action);assert.ok(quote.paid+quote.point.cost<=16);assert.ok(quote.point.path.every(step=>(surfaceAt(battle,step)?.cover??0)>=(surfaceAt(battle,doctor)?.cover??0)&&!hasLineOfSight(battle,unit(battle,'contact'),{...quote.actor,...spacePoint(step)})));
    const after=replay(battle,[action]);assert.equal(unit(after,'doctor').ap,doctor.ap-quote.paid-quote.point.cost);assert.ok(unit(after,'doctor').energy<doctor.energy);battle=after;
   }else if(action.type==='weapon'){
    assert.equal(action.slot,'medical');const after=replay(battle,[action]);assert.equal(unit(after,'doctor').ap,doctor.ap-actionCosts(battle,doctor).weapon);battle=after;
   }else{
    const quote=medicalUsePreview(battle,doctor,patient);assert.equal(quote.allowed,true);assert.equal(action.targetId,patient.id);assert.equal(artilleryContact(battle,doctor,battle.artillery.find(gun=>gun.id==='heavy')),true,'Genuine care of the fixed cannon crew cannot be rejected as healthy formation following.');
    const after=replay(battle,[action]);assert.equal(unit(after,'doctor').ap,doctor.ap-quote.cost);assert.equal(unit(after,'doctor').medkits,doctor.medkits-quote.treatment.dressingsUsed);assert.equal(unit(after,'patient').bleeding,0);assert.ok(unit(after,'patient').bandaged>patient.bandaged);battle=after;treated=true;
   }
   orders.push(action);if(treated)break;
  }
  assert.equal(treated,true);assert.ok(orders.some(action=>action.type==='move'));assert.deepEqual(battle.artillery,start.artillery);assert.deepEqual(replay(start,orders),battle);assert.deepEqual(start,before);
 }
});

test('already adjacent finite aid remains first even when the doctor is exposed to a current hostile',()=>{
 const start=arena({kind:'open',stance:'prone',near:true}),before=structuredClone(start),doctor=unit(start,'doctor'),patient=unit(start,'patient'),helper=createdUspallataBattery(start),quote=medicalUsePreview(start,doctor,patient);assert.equal(quote.allowed,true);assert.equal(hasLineOfSight(start,unit(start,'contact'),doctor),true);
 const action=helper.controller(start,doctor);assert.deepEqual(action,{type:'useItem',unitId:doctor.id,targetId:patient.id});const after=replay(start,[action]);assert.equal(unit(after,'doctor').medkits,doctor.medkits-quote.treatment.dressingsUsed);assert.equal(unit(after,'doctor').ap,doctor.ap-quote.cost);assert.equal(unit(after,'doctor').stance,'prone');assert.deepEqual(spacePoint(unit(after,'doctor')),spacePoint(doctor));assert.equal(unit(after,'patient').bleeding,0);assert.deepEqual(start,before);
});

test('a current nearby hostile refuses a distant aid approach without changing adjacent treatment rules',()=>{
 const start=arena({kind:'close'}),before=structuredClone(start),doctor=unit(start,'doctor'),patient=unit(start,'patient'),view=publicRouteView(start,doctor),contact=unit(start,'contact'),old=formerMedicalOrder(start,doctor);assert.equal(old.type,'move');
 const goals=getReachable(view,doctor).filter(p=>medicalUsePreview(view,{...doctor,...spacePoint(p),ap:doctor.ap-p.cost-actionCosts(start,doctor).weapon},patient).allowed);assert.ok(goals.length);assert.ok(goals.every(p=>distance(p,contact)<=2.5));
 const action=createdUspallataBattery(start).controller(start,doctor);assert.deepEqual(action,{type:'stance',unitId:doctor.id,stance:'prone'});replay(start,[action]);assert.deepEqual(start,before);
});

test('unseen enemy position and equipment cannot choose or price a protected medical route',()=>{
 const start=arena({kind:'protected',stance:'prone'}),other=arena({kind:'protected',stance:'prone',hiddenX:24,hiddenWeapon:1802}),before=structuredClone(start),otherBefore=structuredClone(other),action=createdUspallataBattery(start).controller(start,unit(start,'doctor'));
 assert.equal(action.type,'move');assert.deepEqual(createdUspallataBattery(other).controller(other,unit(other,'doctor')),action);replay(start,[action]);replay(other,[action]);assert.deepEqual(start,before);assert.deepEqual(other,otherBefore);
});

test('actual paid hand work cannot borrow the remaining medical AP reserve for a safe approach',()=>{
 const declared=arena({kind:'protected',stance:'prone'}),initial=unit(declared,'doctor'),handCost=actionCosts(declared,initial).weapon;assert.ok(handCost>0);const count=2*Math.floor(initial.ap/(2*handCost));assert.ok(count>=2&&count%2===0);
 const prelude=Array.from({length:count},(_,i)=>({type:'weapon',unitId:'doctor',slot:i%2?'medical':'primary'})),start=replay(declared,prelude),before=structuredClone(start),doctor=unit(start,'doctor');assert.equal(doctor.ap,initial.ap-count*handCost);assert.equal(doctor.activeSlot,'medical');assert.ok(doctor.ap<actionCosts(start,doctor).weapon+actionCosts(start,doctor).heal);
 assert.equal(createdUspallataBattery(start).controller(start,doctor),null);assert.equal(doctor.medkits,3);assert.deepEqual(replay(declared,prelude),start);assert.deepEqual(start,before);
});
