import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,artilleryCosts,artilleryCrewPlan,getReachable,actionCosts,lookPreview,teamCanSee,medicalUsePreview,stanceCost,canSee,hasLineOfSight,firearmShotOptions} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {sameCell,spacePoint} from '../game/tactical-space.js';
import {COMBAT_ROUND_SECONDS} from '../game/time.js';
import {coordinatedHospitalBattery} from './coordinated-hospital-battery.mjs';
import {publicRouteView,usefulRouteRifleShot} from './route-infantry-progress.mjs';
import {openingControlWindow} from './opening-driver.mjs';

// Fresh Native declarations only. The spent state below comes from an actual
// paid finite cannon discharge, not editing a campaign failure or a gun field.
function arena({wall=true,patient=false,distant=false,hidden=0,contactPoint={x:16,y:17}}={}){
 const tiles=Array.from({length:800},(_,i)=>({x:i%40,y:Math.floor(i/40),type:'grass',blocked:false,cover:[5*40+5,4*40+6].includes(i)?40:0}));
 return createBattle([
  {id:'crew1',x:5,y:5,weapon:1800,loaded:1,ammo:5,medkits:patient?1:0,medical:20,marksmanship:70,stance:'standing',facing:2,energy:100,morale:90,patrol:false},
  {id:'crew2',x:6,y:4,weapon:1800,loaded:1,ammo:5,medkits:0,medical:20,marksmanship:70,stance:'standing',facing:2,energy:100,morale:90,patrol:false},
  {id:'doctor',x:13,y:11,weapon:0,loaded:0,ammo:0,medkits:3,medical:90,marksmanship:0,stance:'standing',facing:2,energy:100,morale:90,patrol:false},
  ...(patient?[{id:'patient',x:4,y:5,weapon:0,loaded:0,ammo:0,medkits:0,medical:0,hp:9,maxHp:100,bleeding:3,bandaged:88,stance:'crouched',facing:2,energy:100,morale:90}]:[]),
 ],{id:'declared-hospital-spent-public-progress',width:40,height:20,tiles,hour:12,seed:45,deferContact:false,
  wallEdges:wall?Array.from({length:10},(_,i)=>({id:`declared-public-wall:${i}`,x:8,y:6+i,axis:'y',type:'wall',material:'adobe',blocked:true,blocksSight:true,cover:40})):[],
  enemies:[{id:'finite-cannon-target',x:14,y:5,weapon:0,loaded:0,ammo:0,hp:30,maxHp:30,medical:0,medkits:0,patrol:false,overwatch:false},
   {id:'public-contact',x:distant?37:contactPoint.x,y:contactPoint.y,weapon:0,loaded:0,ammo:0,hp:500,maxHp:500,medical:0,medkits:0,patrol:false,overwatch:false},
   ...(hidden?[{id:'unobserved',x:hidden===2?38:35,y:18,weapon:0,loaded:0,ammo:0,hp:100,maxHp:100,patrol:false,overwatch:false}]:[])],
  artillery:[{id:'finite-clinic-gun',side:'player',type:'bronze4',x:6,y:5,facing:0,loaded:true,ammo:0},
   ...(hidden?[{id:'unobserved-gun',side:'enemy',type:'swivel',x:hidden===2?38:35,y:19,loaded:true,ammo:9}]:[])],
 });
}
const actor=(b,id)=>b.units.find(u=>u.id===id),piece=b=>b.artillery.find(g=>g.id==='finite-clinic-gun');
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function replay(start,orders){
 let direct=structuredClone(start),presented=structuredClone(start),saved=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  assert.ok(action);direct=actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));
  presented=presentedActBattle(presented,action).state;assert.deepEqual(presented,direct);
  saved=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(saved,JSON.parse(JSON.stringify(action))))));assert.deepEqual(saved,direct);
 }
 return direct;
}
function emptied(start){
 const leader=actor(start,'crew1'),gun=piece(start),fire={type:'artillery',unitId:leader.id,artilleryId:gun.id,x:14,y:5,mode:'solid'},cost=artilleryCosts(start,leader,gun).fire,crew=artilleryCrewPlan(start,leader,gun,cost);
 assert.equal(crew.reason,null);assert.deepEqual(crew.crew,['crew1','crew2']);
 const battle=replay(start,[fire]);assert.equal(piece(battle).loaded,false);assert.equal(piece(battle).ammo,0);
 for(const id of crew.crew)assert.equal(actor(battle,id).ap,actor(start,id).ap-cost);
 assert.equal(actor(battle,'finite-cannon-target').hp,0,'only the real paid Native shell creates this death');
 assert.equal(battle.status,'active','the separate living contact is not declared defeated');
 return {battle,orders:[fire]};
}
function unchangedGoods(before,after,id){
 const a=actor(before,id),b=actor(after,id);
 for(const key of ['hp','maxHp','bleeding','medkits','loaded','weapon','blade','inventory','condition','weaponInstanceId','weaponMetadata','outfit','headwear','legwear'])assert.deepEqual(b[key],a[key],key);
 assert.deepEqual(unitAmmunitionByType(b),unitAmmunitionByType(a));assert.deepEqual(after.artillery,before.artillery);
}

test('the real final cannon charge pays both original crew and then admits one bounded public ground-contact move',()=>{
 const start=arena(),before=structuredClone(start),policy=coordinatedHospitalBattery(start,{coordinateSpentCrew:true}),defaultPolicy=coordinatedHospitalBattery(start),spent=emptied(start);
 // The supplied unarmed doctor still has ordinary paid cover work. Complete
 // that real order before claiming a whole squad pass is idle.
 const doctor=actor(spent.battle,'doctor'),posture=defaultPolicy.controller(spent.battle,doctor),paid=stanceCost(doctor,'prone');
 assert.deepEqual(posture,{type:'stance',unitId:doctor.id,stance:'prone'});assert.ok(paid>0&&paid<=doctor.ap);
 const preparation=openingControlWindow(spent.battle,{controller:defaultPolicy.controller});assert.deepEqual(preparation.orders,[posture]);assert.equal(preparation.actions,1);
 const prefix=[...spent.orders,...preparation.orders],battle=replay(start,prefix),member=actor(battle,'crew1'),target=actor(battle,'public-contact');assert.deepEqual(preparation.battle,battle);
 assert.equal(actor(battle,doctor.id).stance,'prone');assert.equal(actor(battle,doctor.id).ap,doctor.ap-paid);assert.deepEqual(spacePoint(actor(battle,doctor.id)),spacePoint(doctor));unchangedGoods(spent.battle,battle,doctor.id);
 for(const id of ['crew1','crew2'])assert.deepEqual(actor(battle,id),actor(spent.battle,id));assert.equal(battle.elapsedSeconds,spent.battle.elapsedSeconds,'the already-paid combat round is retained during the real doctor stance');
 assert.equal(teamCanSee(battle,'player',target),true);
 for(const id of ['crew1','crew2'])assert.equal(defaultPolicy.controller(battle,actor(battle,id)),null,'both actual crew must reach the ordinary custom hold before the whole-pass fallback');
 assert.deepEqual(policy.roles,defaultPolicy.roles);assert.equal(policy.roles.physicianId,'doctor');assert.equal(policy.controller.sharedFallback(battle,actor(battle,'doctor')),null);
 const action=policy.controller.sharedFallback(battle,member);assert.equal(action?.type,'move');
 const route=getReachable(publicRouteView(battle,member),member).find(p=>sameCell(p,action));assert.ok(route&&route.cost>0&&route.cost<=20);assert.ok(route.path.length<=3);assert.ok(route.path.every(p=>(p.kind===undefined||p.kind==='move')&&(p.tacticalLevel??0)===0));
 const after=replay(start,[...prefix,action]),moved=actor(after,member.id);assert.deepEqual(spacePoint(moved),spacePoint(route));assert.equal(moved.ap,member.ap-route.cost);assert.ok(moved.energy<member.energy);
 const oldWindow=openingControlWindow(battle,{controller:defaultPolicy.controller});assert.deepEqual(oldWindow.orders,[]);assert.deepEqual(oldWindow.battle,battle);
 const window=openingControlWindow(battle,{controller:policy.controller,sharedFallback:policy.controller.sharedFallback});assert.deepEqual(window.orders,[action]);assert.equal(window.actions,1);assert.deepEqual(window.battle,after,'the real full-pass runner emits only this one paid fallback bound');
 const shot=usefulRouteRifleShot(publicRouteView(after,moved),moved);
 if(shot){const cost=actionCosts(after,moved,actor(after,shot.targetId));assert.ok(moved.ap>=cost.fire+shot.aim*cost.aim);}
 else{assert.ok(distance(moved,target)<distance(member,target));const cost=actionCosts(after,moved,target);assert.ok(moved.ap>=cost.fire+2*cost.aim);}
 unchangedGoods(battle,after,member.id);assert.equal(actor(after,'finite-cannon-target').hp,0);assert.deepEqual(actor(after,'finite-cannon-target'),actor(battle,'finite-cannon-target'));
 for(const id of ['crew2','doctor'])assert.deepEqual(actor(after,id),actor(battle,id));assert.equal(after.elapsedSeconds,battle.elapsedSeconds,'same-round movement does not invent another clock payment');
 assert.deepEqual(replay(start,[...prefix,action]),after);assert.deepEqual(start,before);
});

test('charged crew and the false/default custom controller retain their exact old actions and holds',()=>{
 const start=arena(),before=structuredClone(start),defaultPolicy=coordinatedHospitalBattery(start),explicit=coordinatedHospitalBattery(start,{coordinateSpentCrew:false}),enabled=coordinatedHospitalBattery(start,{coordinateSpentCrew:true});
 assert.equal(defaultPolicy.controller.sharedFallback,undefined);assert.equal(explicit.controller.sharedFallback,undefined);
 for(const u of start.units.filter(u=>u.side==='player')){
  assert.deepEqual(defaultPolicy.controller(start,u),explicit.controller(start,u));assert.deepEqual(enabled.controller(start,u),defaultPolicy.controller(start,u));assert.equal(enabled.controller.sharedFallback(start,u),null);
 }
 const spent=emptied(start);for(const u of spent.battle.units.filter(u=>u.side==='player'))assert.deepEqual(defaultPolicy.controller(spent.battle,u),explicit.controller(spent.battle,u));assert.deepEqual(start,before);
});

test('an actually payable rifle shot remains ordinary work before empty-crew progression',()=>{
 // This case declares a short vertical lane. It retains the actual final
 // cannon shell and its smoke; no returned body or AP field is changed.
 const start=arena({wall:false,contactPoint:{x:5,y:8}}),before=structuredClone(start),policy=coordinatedHospitalBattery(start,{coordinateSpentCrew:true}),spent=emptied(start),battle=spent.battle,member=actor(battle,'crew1'),target=actor(battle,'public-contact'),view=publicRouteView(battle,member);
 assert.equal(teamCanSee(battle,'player',target),true);assert.equal(canSee(battle,member,target),true);assert.equal(hasLineOfSight(view,member,target),true);
 const shot=usefulRouteRifleShot(view,member);assert.ok(shot);assert.equal(shot.targetId,target.id);
 const quote=actionCosts(battle,member,target),forecast=firearmShotOptions(view,member,target,shot.aim).find(option=>option.aim===shot.aim&&option.hitLocation===shot.hitLocation);
 assert.ok(member.ap>=quote.fire+shot.aim*quote.aim);assert.ok(forecast&&forecast.chance>=25&&forecast.damageFactor>0);assert.notEqual(forecast.interveningFriendly,true);
 assert.equal(policy.controller.sharedFallback(battle,member),null);const action=policy.controller(battle,member);assert.ok(['fire','stance'].includes(action?.type));
 let orders=[...spent.orders,action],after=replay(start,orders),fireBefore=battle,fireAction=action;
 if(action.type==='stance'){const fire=policy.controller(after,actor(after,member.id));assert.equal(fire?.type,'fire');fireBefore=after;fireAction=fire;orders.push(fire);after=replay(start,orders);}
 const fireActor=actor(fireBefore,member.id),fireCost=actionCosts(fireBefore,fireActor,actor(fireBefore,fireAction.targetId));assert.equal(actor(after,member.id).ap,fireActor.ap-fireCost.fire-(fireAction.aim??0)*fireCost.aim);
 assert.equal(actor(after,member.id).loaded,member.loaded-1);assert.ok(actor(after,member.id).ap<member.ap);assert.ok(sameCell(actor(after,member.id),member));assert.deepEqual(after.artillery,battle.artillery);assert.deepEqual(start,before);
});

test('the original supplied physician and actual adjacent finite aid cannot be borrowed for spent-gun search',()=>{
 const start=arena({patient:true}),before=structuredClone(start),policy=coordinatedHospitalBattery(start,{coordinateSpentCrew:true}),spent=emptied(start),battle=spent.battle,member=actor(battle,'crew1');
 assert.equal(policy.controller.sharedFallback(battle,actor(battle,'doctor')),null);assert.equal(policy.controller.sharedFallback(battle,member),null);
 const equip=policy.controller(battle,member);assert.deepEqual(equip,{type:'weapon',unitId:member.id,slot:'medical'});let after=replay(start,[...spent.orders,equip]);
 const beforeAid=after,held=actor(beforeAid,member.id),patient=actor(beforeAid,'patient'),preview=medicalUsePreview(beforeAid,held,patient),aid=policy.controller(beforeAid,held);
 assert.equal(preview.allowed,true);assert.equal(preview.treatment.dressingsUsed,1);assert.ok(preview.treatment.hpGain>0||preview.treatment.bleedingAfter<patient.bleeding);
 assert.equal(aid?.type,'useItem');assert.equal(aid.targetId,'patient');after=replay(start,[...spent.orders,equip,aid]);
 assert.equal(actor(after,member.id).medkits,member.medkits-1);assert.equal(actor(after,member.id).ap,held.ap-preview.cost);
 for(const [key,field] of [['hp','hpAfter'],['bleeding','bleedingAfter'],['bandaged','bandagedAfter']])assert.equal(actor(after,'patient')[key],preview.treatment[field],'actual Native finite medical work matches its public admitted treatment');
 assert.ok(actor(after,'patient').hp>patient.hp||actor(after,'patient').bleeding<patient.bleeding);assert.ok(sameCell(actor(after,member.id),member));assert.deepEqual(after.artillery,battle.artillery);assert.deepEqual(unitAmmunitionByType(actor(after,member.id)),unitAmmunitionByType(member));assert.deepEqual(start,before);
});

test('real paid facing orders exhaust the current movement and rifle reserve without a new budget',()=>{
 const start=arena(),before=structuredClone(start),policy=coordinatedHospitalBattery(start,{coordinateSpentCrew:true}),spent=emptied(start),orders=[...spent.orders];let b=spent.battle;
 const offsets=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
 for(let pass=0;pass<64&&actor(b,'crew1').ap>=2;pass++){
  const u=actor(b,'crew1'),offset=offsets[(u.facing+1)%8],point={x:u.x+offset[0],y:u.y+offset[1],tacticalLevel:0},preview=lookPreview(b,u,point);assert.equal(preview.valid,true);assert.ok(preview.pa>0&&preview.pa<=u.ap);
  const action={type:'look',unitId:u.id,...point},ap=u.ap;orders.push(action);b=replay(start,orders);assert.equal(actor(b,u.id).ap,ap-preview.pa);
 }
 const member=actor(b,'crew1');assert.ok(member.ap<2);assert.equal(member.loaded,1);assert.equal(policy.controller.sharedFallback(b,member),null);assert.deepEqual(unitAmmunitionByType(member),unitAmmunitionByType(actor(spent.battle,member.id)));assert.deepEqual(b.artillery,spent.battle.artillery);assert.deepEqual(start,before);
});

test('unseen bodies and guns cannot select or price an empty-crew public contact approach',()=>{
 const a=arena({hidden:1}),b=arena({hidden:2}),beforeA=structuredClone(a),beforeB=structuredClone(b),pa=coordinatedHospitalBattery(a,{coordinateSpentCrew:true}),pb=coordinatedHospitalBattery(b,{coordinateSpentCrew:true}),sa=emptied(a).battle,sb=emptied(b).battle;
 for(const s of [sa,sb]){assert.equal(teamCanSee(s,'player',actor(s,'unobserved')),false);assert.equal(teamCanSee(s,'player',s.artillery.find(g=>g.id==='unobserved-gun')),false);}
 const first=pa.controller.sharedFallback(sa,actor(sa,'crew1')),second=pb.controller.sharedFallback(sb,actor(sb,'crew1'));assert.equal(first?.type,'move');assert.deepEqual(second,first);assert.deepEqual(publicRouteView(sa,actor(sa,'crew1')),publicRouteView(sb,actor(sb,'crew1')));assert.deepEqual(a,beforeA);assert.deepEqual(b,beforeB);
});

test('an empty gun without any actual public contact does not authorize a hidden goal or resurrection',()=>{
 const start=arena({distant:true}),before=structuredClone(start),policy=coordinatedHospitalBattery(start,{coordinateSpentCrew:true}),spent=emptied(start),battle=spent.battle;
 assert.equal(teamCanSee(battle,'player',actor(battle,'public-contact')),false);assert.equal(actor(battle,'finite-cannon-target').hp,0);
 for(const id of ['crew1','crew2','doctor'])assert.equal(policy.controller.sharedFallback(battle,actor(battle,id)),null);assert.equal(policy.controller.sharedFallback(battle,actor(battle,'finite-cannon-target')),null);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);assert.equal(battle.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);assert.deepEqual(start,before);
});
