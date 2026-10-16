import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,endTurn,presentedEndTurn,stanceCost,actionCosts,lookPreview,medicalUsePreview,climbPreview,artilleryCosts,artilleryCrewPlan,artilleryContact,teamCanSee} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {sameCell,sameSurface,spacePoint,surfaceAt} from '../game/tactical-space.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {COMBAT_ROUND_SECONDS} from '../game/time.js';
import {coordinatedHospitalBattery} from './coordinated-hospital-battery.mjs';
import {publicRouteView} from './route-infantry-progress.mjs';

// All bodies, supplies and geometry are fresh portable declarations admitted
// by createBattle. No failed campaign, returned Native result or saved prefix
// is an input. No returned AP, phase, position, health or clock is assigned.
const tiles=(width=40,height=20,cover=0)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover}));
function arena({patient=null,ground=false,noKits=false,stance='standing',contact=false,missingCrew=false,hidden=0,terminal=false}={}){
 const doctor={id:'doctor',x:contact?9:8,y:contact?8:ground?6:7,tacticalLevel:ground?0:1,weapon:1800,loaded:1,ammo:5,medical:90,medkits:noKits?0:3,marksmanship:0,stance,facing:2,energy:100,morale:90,patrol:false};
 const roof=Array.from({length:9},(_,i)=>({id:`clinic-roof:${i}`,x:8+i%3,y:7+Math.floor(i/3),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}));
 return createBattle([doctor,
  {id:'crew1',x:contact?8:5,y:contact?9:5,...(contact?{tacticalLevel:1}:{}),weapon:0,loaded:0,ammo:0,medical:0,medkits:0,stance:'crouched',energy:100,morale:90,patrol:false},
  {id:'crew2',x:contact?8:6,y:contact?8:4,...(contact?{tacticalLevel:1}:{}),weapon:0,loaded:0,ammo:0,medical:0,medkits:0,stance:'crouched',energy:100,morale:90,patrol:false,...(missingCrew?{hp:0,maxHp:100}:{})},
  ...(patient?[{id:'patient',x:patient==='ground'?7:9,y:patient==='ground'?6:7,tacticalLevel:patient==='ground'?0:1,weapon:0,loaded:0,ammo:0,medical:0,medkits:0,hp:8,maxHp:100,bleeding:3,bandaged:89,stance:'crouched',energy:100,morale:90,patrol:false}]:[]),
 ],{id:'declared-hospital-physician-hold',width:40,height:20,tiles:tiles(40,20,patient==='ground'?20:0),upperSurfaces:roof,
  climbLinks:[{id:'clinic-west-access',kind:'climb',from:{x:8,y:6,tacticalLevel:0},to:{x:8,y:7,tacticalLevel:1}}],hour:12,seed:45,
  enemies:terminal?[{id:'target',x:14,y:5,weapon:0,loaded:0,ammo:0,hp:30,maxHp:30,medical:0,medkits:0,patrol:false,overwatch:false}]:[
   {id:'target',x:35,y:17,weapon:0,loaded:0,ammo:0,hp:500,maxHp:500,medical:0,medkits:0,patrol:false,overwatch:false},
   ...(hidden?[{id:'unknown',x:hidden===2?38:35,y:18,weapon:0,loaded:0,ammo:0,hp:100,maxHp:100,patrol:false,overwatch:false}]:[]),
  ],
  artillery:[{id:'clinic-gun',side:'player',type:'bronze4',x:contact?9:6,y:contact?9:5,...(contact?{tacticalLevel:1}:{}),facing:0,loaded:true,ammo:2},...(hidden?[{id:'unknown-piece',side:'enemy',type:'swivel',x:hidden===2?38:35,y:19,loaded:true,ammo:9}]:[])],
  npcs:hidden?[{id:'unknown-resident',name:'Declared unknown resident',x:hidden===2?38:35,y:16,hp:100}]:[],
 });
}
const actor=(b,id)=>b.units.find(u=>u.id===id),piece=b=>b.artillery.find(g=>g.id==='clinic-gun');
const opted=b=>coordinatedHospitalBattery(b,{coordinatePhysicianHold:true});
function replay(start,orders){
 let direct=structuredClone(start),presented=structuredClone(start),saved=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  assert.ok(action);direct=action.type==='endTurn'?endTurn(direct):actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));
  presented=(action.type==='endTurn'?presentedEndTurn(presented):presentedActBattle(presented,action)).state;assert.deepEqual(presented,direct);
  saved=validateBattleSnapshot(JSON.parse(JSON.stringify(action.type==='endTurn'?endTurn(saved):actBattle(saved,JSON.parse(JSON.stringify(action))))));assert.deepEqual(saved,direct);
 }
 return direct;
}
function stableGoods(before,after,{kitDebit=0,patientId=null}={}){
 assert.deepEqual(after.artillery,before.artillery);assert.deepEqual(after.tiles,before.tiles);assert.deepEqual(after.upperSurfaces,before.upperSurfaces);assert.deepEqual(after.climbLinks,before.climbLinks);
 for(const old of before.units){
  const next=actor(after,old.id);assert.deepEqual(unitAmmunitionByType(next),unitAmmunitionByType(old));
  for(const key of ['weapon','blade','inventory','condition','weaponInstanceId','weaponMetadata','outfit','headwear','legwear'])assert.deepEqual(next[key],old[key],`${old.id}:${key}`);
  if(old.id!==patientId)for(const key of ['hp','maxHp','bleeding','bandaged'])assert.equal(next[key],old[key],`${old.id}:${key}`);
  assert.equal(next.medkits,old.medkits-(old.id==='doctor'?kitDebit:0));
 }
}

test('an otherwise held supplied roof physician pays one protective prone order and then holds without cycling',()=>{
 const start=arena(),before=structuredClone(start),doctor=actor(start,'doctor'),policy=opted(start),defaultPolicy=coordinatedHospitalBattery(start);
 assert.equal(policy.roles.physicianId,'doctor');assert.deepEqual(policy.roles,defaultPolicy.roles);assert.equal(doctor.tacticalLevel,1);assert.equal(artilleryContact(start,doctor,piece(start)),false);
 assert.equal(defaultPolicy.controller(start,doctor),null,'the declared premise must actually have no ordinary physician work');
 const action=policy.controller(start,doctor),cost=stanceCost(doctor,'prone');assert.deepEqual(action,{type:'stance',unitId:'doctor',stance:'prone'});assert.ok(cost>0);
 const after=replay(start,[action]),held=actor(after,'doctor');assert.equal(held.stance,'prone');assert.equal(held.ap,doctor.ap-cost);assert.deepEqual(spacePoint(held),spacePoint(doctor));
 assert.equal(after.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);assert.ok(held.ap>=actionCosts(after,held).weapon+actionCosts(after,held).heal+stanceCost(held,'standing'));
 for(let decision=0;decision<4;decision++)assert.equal(policy.controller(after,held),null,'already paid prone must remain a hold');
 assert.equal(after.units.length,start.units.length);stableGoods(start,after);assert.deepEqual(start,before);
});

test('actual adjacent medical activation and one finite dressing remain ahead of protective posture',()=>{
 const start=arena({patient:'roof'}),before=structuredClone(start),policy=opted(start),doctor=actor(start,'doctor'),patient=actor(start,'patient');assert.ok(sameSurface(doctor,patient));
 const equip=policy.controller(start,doctor);assert.deepEqual(equip,{type:'weapon',unitId:'doctor',slot:'medical'});const held=replay(start,[equip]);
 assert.equal(actor(held,'doctor').ap,doctor.ap-actionCosts(start,doctor).weapon);assert.equal(actor(held,'doctor').stance,'standing');
 const quote=medicalUsePreview(held,actor(held,'doctor'),actor(held,'patient')),aid=policy.controller(held,actor(held,'doctor'));assert.equal(quote.allowed,true);assert.deepEqual(aid,{type:'useItem',unitId:'doctor',targetId:'patient'});
 const after=replay(start,[equip,aid]);assert.equal(actor(after,'doctor').ap,actor(held,'doctor').ap-quote.cost);assert.equal(actor(after,'doctor').stance,'standing');
 for(const [key,value]of Object.entries({hp:quote.treatment.hpAfter,bleeding:quote.treatment.bleedingAfter,bandaged:quote.treatment.bandagedAfter}))assert.equal(actor(after,'patient')[key],value);
 assert.ok(actor(after,'patient').hp>patient.hp||actor(after,'patient').bleeding<patient.bleeding,'actual finite treatment must make clinical progress');stableGoods(start,after,{kitDebit:1,patientId:'patient'});assert.deepEqual(start,before);
});

test('a critical patient on the other floor keeps the real standing and authored descent before finite aid',()=>{
 const start=arena({patient:'ground',stance:'crouched'}),before=structuredClone(start),policy=opted(start),doctor=actor(start,'doctor'),patient=actor(start,'patient');
 assert.equal(surfaceAt(start,start.climbLinks[0].from).cover,surfaceAt(start,doctor).cover,'the positive medical landing preserves the physician current cover');
 assert.ok(!sameSurface(doctor,patient));assert.equal(climbPreview(publicRouteView(start,doctor),doctor,{linkId:'clinic-west-access'}).valid,false);
 const stand=policy.controller(start,doctor);assert.deepEqual(stand,{type:'stance',unitId:'doctor',stance:'standing'});const stood=replay(start,[stand]);assert.equal(actor(stood,'doctor').ap,doctor.ap-stanceCost(doctor,'standing'));
 const quote=climbPreview(publicRouteView(stood,actor(stood,'doctor')),actor(stood,'doctor'),{linkId:'clinic-west-access'}),climb=policy.controller(stood,actor(stood,'doctor'));assert.equal(quote.valid,true);assert.deepEqual(climb,{type:'climb',unitId:'doctor',linkId:'clinic-west-access'});
 const down=replay(start,[stand,climb]);assert.ok(sameCell(actor(down,'doctor'),start.climbLinks[0].from));assert.equal(actor(down,'doctor').ap,actor(stood,'doctor').ap-quote.pa);assert.ok(actor(down,'doctor').energy<doctor.energy);
 const equip=policy.controller(down,actor(down,'doctor'));assert.deepEqual(equip,{type:'weapon',unitId:'doctor',slot:'medical'});const held=replay(start,[stand,climb,equip]);
 const medical=medicalUsePreview(held,actor(held,'doctor'),actor(held,'patient')),aid=policy.controller(held,actor(held,'doctor'));assert.equal(medical.allowed,true);assert.deepEqual(aid,{type:'useItem',unitId:'doctor',targetId:'patient'});
 const after=replay(start,[stand,climb,equip,aid]);assert.equal(actor(after,'doctor').ap,actor(held,'doctor').ap-medical.cost);assert.equal(actor(after,'patient').hp,medical.treatment.hpAfter);assert.equal(actor(after,'patient').bleeding,medical.treatment.bleedingAfter);
 assert.equal(after.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);stableGoods(start,after,{kitDebit:1,patientId:'patient'});assert.deepEqual(start,before);
});

test('genuine paid looks leave a marginal budget that cannot pay protective posture plus the medical reserve',()=>{
 const start=arena(),before=structuredClone(start),policy=opted(start),orders=[];let b=start;
 for(let pass=0;pass<40;pass++){
  const u=actor(b,'doctor'),cost=stanceCost(u,'prone'),reserve=actionCosts(b,u).weapon+actionCosts(b,u).heal+stanceCost({...u,stance:'prone'},'standing');
  if(u.ap>=cost&&u.ap<cost+reserve)break;
  const action={type:'look',unitId:u.id,x:u.x,y:pass%2?u.y+1:u.y-1},quote=lookPreview(b,u,action);assert.equal(quote.valid,true);assert.ok(quote.pa>0&&quote.pa<=u.ap);orders.push(action);const next=replay(start,orders);assert.equal(actor(next,u.id).ap,u.ap-quote.pa);b=next;
 }
 const u=actor(b,'doctor'),cost=stanceCost(u,'prone'),reserve=actionCosts(b,u).weapon+actionCosts(b,u).heal+stanceCost({...u,stance:'prone'},'standing');assert.ok(orders.length>0);assert.ok(u.ap>=cost&&u.ap<cost+reserve,'real Native payments must establish the marginal premise');
 assert.equal(coordinatedHospitalBattery(start).controller(b,u),null);assert.equal(policy.controller(b,u),null);
 const paid=replay(start,[...orders,{type:'stance',unitId:u.id,stance:'prone'}]);assert.equal(actor(paid,u.id).ap,u.ap-cost);assert.ok(actor(paid,u.id).ap<reserve,'the posture itself is payable, but cannot conserve the declared medical budget');stableGoods(start,b);stableGoods(start,paid);assert.deepEqual(start,before);
});

test('ground placement and absent actual carried linen keep the original policy behavior',()=>{
 for(const options of [{ground:true},{noKits:true}]){
  const start=arena(options),before=structuredClone(start),doctor=actor(start,'doctor'),policy=opted(start),old=coordinatedHospitalBattery(start);
  assert.deepEqual(policy.roles,old.roles);if(options.noKits)assert.equal(policy.roles.physicianId,null);else assert.equal(doctor.tacticalLevel,0);
  assert.deepEqual(policy.controller(start,doctor),old.controller(start,doctor));assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(start))),start);stableGoods(start,start);assert.deepEqual(start,before);
 }
});

test('actual charged contact cannot borrow the supplied physician or gain a new protective order',()=>{
 const start=arena({contact:true,missingCrew:true}),before=structuredClone(start),doctor=actor(start,'doctor'),policy=opted(start),old=coordinatedHospitalBattery(start),gun=piece(start);
 assert.ok(doctor.tacticalLevel>0);assert.ok(sameSurface(doctor,gun)&&sameSurface(actor(start,'crew1'),gun));assert.equal(sameCell(doctor,gun),false);assert.equal(sameCell(actor(start,'crew1'),gun),false);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(start))),start,'the declared upper-surface body and gun positions must pass full Native snapshot admission');
 assert.equal(artilleryContact(start,doctor,gun),true);assert.equal(policy.roles.physicianId,'doctor');assert.deepEqual(policy.roles.crews,[{gunId:'clinic-gun',ids:['crew1']}]);
 const plan=artilleryCrewPlan(start,actor(start,'crew1'),gun,artilleryCosts(start,actor(start,'crew1'),gun).fire);assert.equal(plan.reason,null);assert.deepEqual(plan.crew,['crew1','doctor'],'Native would admit this actual local physician if the controller borrowed him');
 // This is a real Native contact/AP crew preview, not an upper-level fire
 // order or a campaign gun placement. The ground guard no longer masks the
 // charged-contact protection of this otherwise held roof physician.
 assert.equal(old.controller(start,doctor),null);assert.equal(policy.controller(start,doctor),null);assert.ok(!policy.controller(start,doctor)?.type?.startsWith('artillery'));
 assert.deepEqual(policy.controller(start,actor(start,'crew1')),old.controller(start,actor(start,'crew1')));stableGoods(start,start);assert.deepEqual(start,before);
});

test('a genuine completed battle and a genuine Native interruption cannot receive a new protective stance',()=>{
 const start=arena({terminal:true}),before=structuredClone(start),policy=opted(start),old=coordinatedHospitalBattery(start),gun=piece(start),leader=actor(start,'crew1'),fire={type:'artillery',unitId:'crew1',artilleryId:gun.id,x:14,y:5,mode:'solid'};
 const cost=artilleryCosts(start,leader,gun).fire,crew=artilleryCrewPlan(start,leader,gun,cost);assert.equal(crew.reason,null);assert.deepEqual(crew.crew,['crew1','crew2']);
 const final=replay(start,[fire]);assert.equal(final.status,'victory');assert.equal(actor(final,'target').hp,0);assert.equal(piece(final).loaded,false);assert.equal(piece(final).ammo,gun.ammo);
 for(const id of crew.crew)assert.equal(actor(final,id).ap,actor(start,id).ap-cost);assert.equal(actor(final,'doctor').ap,actor(start,'doctor').ap);assert.deepEqual(spacePoint(actor(final,'doctor')),spacePoint(actor(start,'doctor')));for(const key of ['hp','maxHp','bleeding','medkits','loaded','inventory','weapon','stance'])assert.deepEqual(actor(final,'doctor')[key],actor(start,'doctor')[key]);assert.equal(policy.controller(final,actor(final,'doctor')),null);assert.equal(old.controller(final,actor(final,'doctor')),null);assert.deepEqual(start,before);
 const interruptStart=createBattle([{id:'doctor',x:5,y:2,tacticalLevel:1,weapon:1800,loaded:1,ammo:5,medical:90,medkits:3,marksmanship:0,agility:100,experienceLevel:10,facing:0,stance:'standing',patrol:false}],
  {id:'declared-physician-hearing-interrupt',width:16,height:10,tiles:tiles(16,10),seed:45,hour:12,upperSurfaces:Array.from({length:9},(_,i)=>({id:`interrupt-roof:${i}`,x:4+i%3,y:1+Math.floor(i/3),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20})),
   enemies:[{id:'listener-source',x:5,y:5,facing:0,loaded:0,ammo:2,weapon:1800,medical:0,medkits:0,patrol:false}],artillery:[]});
 const interruptBefore=structuredClone(interruptStart),p=actor(interruptStart,'doctor');assert.equal(teamCanSee(interruptStart,'player',actor(interruptStart,'listener-source')),false);
 const paused=replay(interruptStart,[{type:'endTurn'}]);assert.equal(paused.phase,'interrupt');assert.ok(paused.interrupt.unitIds.includes(p.id));assert.ok(actor(paused,'doctor').lastHeardNoise,'the interruption must come from actual Native work, not a phase patch');
 assert.deepEqual(opted(interruptStart).controller(paused,actor(paused,'doctor')),coordinatedHospitalBattery(interruptStart).controller(paused,actor(paused,'doctor')));assert.notDeepEqual(opted(interruptStart).controller(paused,actor(paused,'doctor')),{type:'stance',unitId:p.id,stance:'prone'});assert.deepEqual(interruptStart,interruptBefore);
});

test('unseen distant opponents, guns and residents cannot select or price the paid physician hold',()=>{
 const a=arena({hidden:1}),b=arena({hidden:2}),beforeA=structuredClone(a),beforeB=structuredClone(b);
 for(const state of [a,b])for(const body of [actor(state,'unknown'),state.artillery.find(g=>g.id==='unknown-piece'),state.npcs[0]])assert.equal(teamCanSee(state,'player',body),false);
 const first=opted(a).controller(a,actor(a,'doctor')),second=opted(b).controller(b,actor(b,'doctor'));assert.deepEqual(first,{type:'stance',unitId:'doctor',stance:'prone'});assert.deepEqual(second,first);assert.deepEqual(publicRouteView(a,actor(a,'doctor')),publicRouteView(b,actor(b,'doctor')));
 const afterA=replay(a,[first]),afterB=replay(b,[second]);assert.deepEqual(actor(afterA,'doctor'),actor(afterB,'doctor'));assert.equal(afterA.elapsedSeconds,afterB.elapsedSeconds);stableGoods(a,afterA);stableGoods(b,afterB);assert.deepEqual(a,beforeA);assert.deepEqual(b,beforeB);
});
