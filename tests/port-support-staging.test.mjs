import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,getReachable,teamCanSee,actionCosts,medicalUsePreview,artilleryContact,artilleryCosts,artilleryCrewPlan,stanceCost,reprimePlan,exitPreview,endTurn,presentedEndTurn,firearmShotOptions} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {sameCell,spacePoint,surfaceAt} from '../game/tactical-space.js';
import {validEntry} from '../game/tactical-exits.js';
import {COMBAT_ROUND_SECONDS} from '../game/time.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {publicRouteView,usefulRouteRifleShot} from './route-infantry-progress.mjs';
import {publicSupportStagingPlan,publicSupportPriorityWork,publicSupportAPDepletion,publicSupportRouteWorkPreview} from './public-support-staging.mjs';
import {recoveryPortSearchController} from './recovery-port-battery-driver.mjs';
import {knownRouteShotSafety} from './route-fire-safety.mjs';

const options={coordinateInfantry:true,coordinateRifleCover:true,coordinateSupportStaging:true};
const unit=(battle,id)=>battle.units.find(actor=>actor.id===id),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const flat=()=>Array.from({length:24*16},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0}));
// Fresh declared arenas. Coordinates and finite body/weapon stocks are
// declared before the native factory. No earned save or failed route input.
function blockedSupport({hidden=false,energy=100,weapon=1800,weaponMode,frontStance='prone',supportProfile={}}={}){
 return createBattle([
  {id:'support',x:3,y:8,facing:6,stance:'standing',weapon,weaponMode,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:60,energy,...supportProfile},
  {id:'front',x:10,y:8,facing:2,stance:frontStance,weapon:1800,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:100},
 ],{id:'declared-support-wall',width:24,height:16,tiles:flat(),hour:12,seed:45,deferContact:false,
  wallEdges:Array.from({length:13},(_,i)=>({id:`public-obstruction:${i}`,x:6,y:2+i,axis:'y',type:'wall',material:'adobe',blocksSight:true,cover:40})),
  enemies:[{id:'contact',x:18,y:8,facing:6,weapon:0,hp:500,maxHp:500,patrol:false,overwatch:false},...(hidden?[{id:'unobserved',x:9,y:15,facing:6,weapon:0,hp:100,maxHp:100,patrol:false,overwatch:false}]:[])],artillery:[],
 });
}
function lane({cart=false}={}){
 const tiles=flat().map(t=>({...t,blocked:!(t.y===8&&t.x>=4&&t.x<=20||t.x===6&&t.y===7)}));
 return createBattle([
  {id:'rear',x:4,y:8,facing:2,stance:'standing',weapon:1800,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:50},
  {id:'blocker',x:6,y:8,facing:2,stance:'standing',weapon:1800,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:60},
  {id:'front',x:12,y:8,facing:2,stance:'prone',weapon:1800,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:100},
 ],{id:'declared-support-lane',width:24,height:16,tiles,hour:12,seed:45,deferContact:false,
  enemies:[{id:'contact',x:20,y:8,weapon:0,hp:500,maxHp:500,patrol:false,overwatch:false}],artillery:[],
  wallEdges:Array.from({length:7},(_,i)=>({id:`lane-screen:${i}`,x:8,y:5+i,axis:'y',type:'wall',material:'adobe',blocksSight:true,cover:40})),
  props:cart?[{id:'actual-cart',type:'cart',x:6,y:7,footprint:{width:1,height:1},blocksMovement:true}]:[],
 });
}
function replay(start,orders){
 let direct=structuredClone(start),presented=structuredClone(start),restored=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  assert.ok(action);direct=action.type==='endTurn'?endTurn(direct):actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));
  presented=(action.type==='endTurn'?presentedEndTurn(presented):presentedActBattle(presented,action)).state;assert.deepEqual(presented,direct);
  const restoredAction=JSON.parse(JSON.stringify(action));restored=validateBattleSnapshot(JSON.parse(JSON.stringify(restoredAction.type==='endTurn'?endTurn(restored):actBattle(restored,restoredAction))));assert.deepEqual(restored,direct);
 }
 return direct;
}
// Use only actual returned Native orders. Some controls deliberately exhaust
// front work to isolate other budgets; clear rear paths need not wait for it.
function completeFront(start,supportId,frontId,prior=[]){
 const orders=[...prior],controller=recoveryPortSearchController(start,options);let battle=replay(start,orders);
 for(let count=0;count<16;count++){
  const front=unit(battle,frontId),action=controller(battle,front);
  if(!action)break;
  assert.ok(['fire','stance','reload','reprime','weapon','useItem'].includes(action.type),'the declared front pays ordinary local work, not a move');
  orders.push(action);battle=replay(start,orders);
 }
 assert.ok(orders.some(action=>action.unitId===frontId&&action.type==='fire'),'actual ordinary front fire precedes support');
 assert.equal(publicSupportPriorityWork(battle,unit(battle,supportId)),null,'all remaining current payable front work really holds');
 return {battle,orders};
}

const unchangedPhysical=(before,after,id)=>{
 const a=unit(before,id),b=unit(after,id);for(const key of ['hp','maxHp','bleeding','medkits','loaded','inventory','weapon','condition','weaponInstanceId','outfit','headwear','legwear'])assert.deepEqual(b[key],a[key],key);
 assert.deepEqual(unitAmmunitionByType(b),unitAmmunitionByType(a));assert.deepEqual(after.artillery,before.artillery);
};


function nativeShotQuote(battle,front,action){
 const target=unit(battle,action.targetId),cost=actionCosts(battle,front,target),option=firearmShotOptions(battle,front,target,action.aim).find(row=>row.aim===action.aim&&row.hitLocation===(action.hitLocation??'torso'));
 assert.ok(option&&option.chance>=25&&option.damageFactor>0);assert.equal(knownRouteShotSafety(battle,front,target)(option),true);
 return {pa:cost.fire+action.aim*cost.aim,chance:option.chance,damageFactor:option.damageFactor};
}
function proveUnchangedFrontWork(start,plan,frontId,frontAction){
 const before=unit(start,frontId),baseline=nativeShotQuote(start,before,frontAction);let current=start,paid=0;const stepOrders=[];
 for(const step of plan.route.path){
  const actor=unit(current,plan.unitId),route=getReachable(publicRouteView(current,actor),actor).find(point=>sameCell(point,step));assert.ok(route&&route.cost>0);
  stepOrders.push({type:'move',unitId:actor.id,...spacePoint(step)});current=replay(start,stepOrders);paid+=route.cost;
  const quoted=nativeShotQuote(current,unit(current,frontId),frontAction);assert.equal(quoted.pa,baseline.pa);assert.ok(quoted.chance>=baseline.chance&&quoted.damageFactor>=baseline.damageFactor);
  for(const key of ['ap','loaded','inventory','medkits','x','y','tacticalLevel'])assert.deepEqual(unit(current,frontId)[key],before[key]);
 }
 assert.equal(paid,plan.route.cost);const moved=replay(start,[plan.action]),quote=nativeShotQuote(moved,unit(moved,frontId),frontAction);assert.equal(quote.pa,baseline.pa);
 const fired=replay(start,[plan.action,frontAction]);assert.equal(unit(fired,frontId).ap,before.ap-baseline.pa);assert.equal(unit(fired,frontId).loaded,before.loaded-1);
 return moved;
}

test('public support staging stays false by default and does not replace admitted front fire',()=>{
 const battle=blockedSupport(),before=structuredClone(battle),base={coordinateInfantry:true,coordinateRifleCover:true};
 for(const actor of battle.units.filter(actor=>actor.side==='player'))assert.deepEqual(recoveryPortSearchController(battle,base)(battle,actor),recoveryPortSearchController(battle,{...base,coordinateSupportStaging:false})(battle,actor));
 const front=unit(battle,'front'),normal=recoveryPortSearchController(battle,base)(battle,front),current=recoveryPortSearchController(battle,options)(battle,front);
 assert.equal(normal?.type,'fire');assert.deepEqual(current,normal);assert.deepEqual(battle,before);
});

test('an idle rear guard can stage while the actual clear front shot remains payable at every paid cell',()=>{
 const start=blockedSupport(),before=structuredClone(start),support=unit(start,'support'),front=unit(start,'front'),contact=unit(start,'contact');
 assert.equal(teamCanSee(start,'player',contact),true);assert.equal(usefulRouteRifleShot(publicRouteView(start,support),support),null);
 assert.equal(recoveryPortSearchController(start,{coordinateInfantry:true,coordinateRifleCover:true})(start,support),null);
 const priority=publicSupportPriorityWork(start,support);assert.equal(priority.unitId,front.id);assert.equal(priority.type,'fire');
 const controller=recoveryPortSearchController(start,options),plan=publicSupportStagingPlan(start,support),frontAction=controller(start,front);
 assert.equal(plan?.kind,'support-stage');assert.equal(plan.screenId,front.id);assert.equal(frontAction?.type,'fire');assert.deepEqual(controller(start,support),plan.action);
 assert.equal(surfaceAt(start,plan.route).cover,0);assert.ok(plan.route.cost>0&&plan.route.cost<=16);
 assert.ok(plan.route.path.every(step=>distance(step,contact)>=distance(front,contact)+1));
 const after=proveUnchangedFrontWork(start,plan,front.id,frontAction),moved=unit(after,support.id);
 assert.deepEqual(spacePoint(moved),spacePoint(plan.route));assert.equal(moved.ap,support.ap-plan.route.cost);assert.ok(moved.energy<support.energy);assert.ok(moved.ap>=plan.fireReserve.totalPA);
 unchangedPhysical(start,after,support.id);assert.deepEqual(start,before);
});

test('a known idle body clears its actual rear lane while preserving the separate payable front shot',()=>{
 const start=lane(),before=structuredClone(start),blocker=unit(start,'blocker'),rear=unit(start,'rear'),front=unit(start,'front');
 const inherited=recoveryPortSearchController(start,{coordinateInfantry:true,coordinateRifleCover:true}),controller=recoveryPortSearchController(start,options);
 assert.equal(usefulRouteRifleShot(publicRouteView(start,blocker),blocker),null);assert.equal(inherited(start,blocker),null);const frontAction=controller(start,front);assert.equal(frontAction?.type,'fire');
 const plan=publicSupportStagingPlan(start,blocker);assert.equal(plan?.kind,'friendly-lane-clear');assert.equal(plan.rearId,rear.id);assert.equal(plan.route.path.length,1);assert.ok(plan.waitingRoute.path.some(step=>sameCell(step,blocker)));assert.ok(!plan.waitingRoute.path.some(step=>sameCell(step,plan.route)));
 assert.deepEqual(controller(start,blocker),plan.action);assert.ok(getReachable(publicRouteView(start,blocker),blocker).some(point=>sameCell(point,plan.route)&&point.cost===plan.route.cost));
 const after=proveUnchangedFrontWork(start,plan,front.id,frontAction);assert.equal(unit(after,blocker.id).ap,blocker.ap-plan.route.cost);unchangedPhysical(start,after,blocker.id);assert.deepEqual(unit(after,rear.id),rear);
 const next=publicSupportStagingPlan(after,unit(after,rear.id));assert.equal(next?.kind,'support-stage');assert.ok(next.route.path.some(step=>sameCell(step,blocker)));assert.ok(next.route.path.every(step=>!sameCell(step,unit(after,blocker.id))));
 const paid=replay(start,[plan.action,next.action]);assert.equal(unit(paid,rear.id).ap,rear.ap-next.route.cost);unchangedPhysical(after,paid,rear.id);assert.deepEqual(start,before);
});

test('the cart still blocks clearance; after front fire the actual road admits only its finite prefix',()=>{
 const start=lane({cart:true}),before=structuredClone(start),early=publicSupportStagingPlan(start,unit(start,'blocker'));assert.equal(early?.kind,'support-stage');assert.deepEqual(early.action,{type:'move',unitId:'blocker',x:7,y:8,tacticalLevel:0});
 proveUnchangedFrontWork(start,early,'front',recoveryPortSearchController(start,options)(start,unit(start,'front')));
 const prepared=completeFront(start,'blocker','front'),battle=prepared.battle,blocker=unit(battle,'blocker'),cart=battle.props.find(prop=>prop.id==='actual-cart'),plan=publicSupportStagingPlan(battle,blocker),reachable=getReachable(publicRouteView(battle,blocker),blocker);
 assert.equal(battle.mode,'combat');assert.equal(plan?.kind,'support-stage');assert.notEqual(plan.kind,'friendly-lane-clear');assert.equal(plan.screenId,'front');
 assert.deepEqual(plan.action,{type:'move',unitId:blocker.id,x:7,y:8,tacticalLevel:0});assert.equal(plan.route.cost,8);
 const nativeRoute=reachable.find(point=>sameCell(point,plan.route));assert.ok(nativeRoute);assert.deepEqual(nativeRoute,plan.route);
 assert.equal(reachable.some(point=>sameCell(point,cart)),false);assert.ok(plan.route.path.every(step=>!sameCell(step,cart)));assert.equal(reachable.some(point=>point.x>=8&&point.y===8),false);
 const controller=recoveryPortSearchController(battle,options);assert.deepEqual(controller(battle,blocker),plan.action);
 const after=replay(start,[...prepared.orders,plan.action]),moved=unit(after,blocker.id);assert.deepEqual(spacePoint(moved),{x:7,y:8,tacticalLevel:0});assert.equal(moved.ap,blocker.ap-nativeRoute.cost);assert.ok(moved.energy<blocker.energy);assert.ok(moved.ap>=plan.fireReserve.totalPA);
 assert.equal(after.elapsedSeconds,battle.elapsedSeconds+(battle.roundTimeCharged?0:COMBAT_ROUND_SECONDS));assert.equal(after.seed,battle.seed);
 unchangedPhysical(battle,after,blocker.id);assert.deepEqual(after.props,battle.props);assert.deepEqual(after.wallEdges,battle.wallEdges);assert.ok(!sameCell(moved,cart));
 for(const id of ['rear','front']){unchangedPhysical(battle,after,id);for(const key of ['ap','x','y','tacticalLevel'])assert.deepEqual(unit(after,id)[key],unit(battle,id)[key]);}
 assert.deepEqual(replay(start,[...prepared.orders,plan.action]),after);assert.deepEqual(start,before);
});

test('medical reserves and a finite medical activation sequence cannot become staging guards',()=>{
 const start=createBattle([
  {id:'medic',x:3,y:8,medical:90,medkits:2,weapon:1800,loaded:1,ammo:5,marksmanship:40},
  {id:'patient',x:4,y:8,hp:10,maxHp:100,bleeding:3,weapon:1800,loaded:1,ammo:5,medical:0,medkits:0},
  {id:'front',x:10,y:8,facing:2,stance:'prone',weapon:1800,loaded:1,ammo:5,marksmanship:100,medical:0,medkits:0},
 ],{id:'declared-support-medical',width:24,height:16,tiles:flat(),hour:12,seed:45,deferContact:false,enemies:[{id:'contact',x:18,y:8,weapon:0,hp:500,maxHp:500,patrol:false,overwatch:false}],artillery:[]});
 const before=structuredClone(start),medic=unit(start,'medic'),controller=recoveryPortSearchController(start,{...options,reserveIds:['medic']});
 assert.equal(publicSupportStagingPlan(start,medic,{protectedIds:['medic']}),null);
 const activation=controller(start,medic);assert.deepEqual(activation,{type:'weapon',unitId:medic.id,slot:'medical'});const active=replay(start,[activation]);assert.equal(unit(active,medic.id).ap,medic.ap-actionCosts(start,medic).weapon);
 const aid=controller(active,unit(active,medic.id)),preview=medicalUsePreview(active,unit(active,medic.id),unit(active,'patient'));assert.equal(preview.allowed,true);assert.equal(aid?.type,'useItem');
 const after=replay(start,[activation,aid]);assert.equal(unit(after,medic.id).medkits,medic.medkits-1);assert.equal(unit(after,medic.id).ap,unit(active,medic.id).ap-preview.cost);assert.ok(unit(after,'patient').hp>unit(start,'patient').hp);assert.deepEqual(after.artillery,start.artillery);assert.deepEqual(start,before);
});

for(const kind of ['melee-mode','unarmed','exhausted'])test(`the new support move holds a ${kind} body without changing its native state`,()=>{
 const battle=blockedSupport(kind==='melee-mode'?{weaponMode:'melee'}:kind==='unarmed'?{weapon:0}:{energy:1}),before=structuredClone(battle),actor=unit(battle,'support');
 assert.equal(publicSupportStagingPlan(battle,actor),null);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);assert.deepEqual(battle,before);
});

test('an unobserved opposing body cannot change a public support route or become its goal',()=>{
 const clear=blockedSupport(),hidden=blockedSupport({hidden:true}),before=structuredClone(hidden),unknown=unit(hidden,'unobserved');assert.equal(teamCanSee(hidden,'player',unknown),false);
 const prepared=completeFront(clear,'support','front'),actualHidden=replay(hidden,prepared.orders);assert.equal(teamCanSee(actualHidden,'player',unit(actualHidden,'unobserved')),false);
 const a=publicSupportStagingPlan(prepared.battle,unit(prepared.battle,'support')),b=publicSupportStagingPlan(actualHidden,unit(actualHidden,'support'));assert.ok(a);assert.deepEqual(b,a);assert.deepEqual(hidden,before);
});

test('an actual charged gun contact holds support staging and keeps its ordinary paid finite crew fire',()=>{
 const start=createBattle([
  {id:'2',x:5,y:8,facing:2,stance:'crouched',weapon:1800,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:60},
  {id:'crew',x:6,y:7,facing:2,stance:'crouched',weapon:1800,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:50},
  {id:'front',x:10,y:5,facing:2,stance:'prone',weapon:1800,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:100},
 ],{id:'declared-support-charged-contact',width:24,height:16,tiles:flat(),hour:12,seed:45,deferContact:false,
  enemies:[{id:'contact',x:18,y:8,weapon:0,hp:500,maxHp:500,patrol:false,overwatch:false}],
  artillery:[{id:'actual-charged-bronze',type:'bronze4',side:'player',x:6,y:8,facing:0,loaded:true,ammo:2}],
 });
 const before=structuredClone(start),gun=start.artillery[0],operator=unit(start,'2'),assistant=unit(start,'crew');
 assert.equal(artilleryContact(start,operator,gun),true);assert.equal(artilleryContact(start,assistant,gun),true);assert.equal(sameCell(operator,gun),false);assert.equal(sameCell(assistant,gun),false);
 for(const actor of [operator,assistant])assert.equal(publicSupportStagingPlan(start,actor),null,'an actual charged contact body is not a new advancing support');
 const inherited=recoveryPortSearchController(start,{coordinateInfantry:true,coordinateRifleCover:true}),controller=recoveryPortSearchController(start,options),action=controller(start,operator);
 assert.deepEqual(action,inherited(start,operator));assert.equal(action?.type,'artillery');assert.equal(action.artilleryId,gun.id);
 const cost=artilleryCosts(start,operator,gun).fire,crew=artilleryCrewPlan(start,operator,gun,cost);assert.equal(crew.reason,null);assert.deepEqual(new Set(crew.crew),new Set([operator.id,assistant.id]));
 const after=replay(start,[action]);assert.equal(Number(after.artillery[0].loaded)+after.artillery[0].ammo,Number(gun.loaded)+gun.ammo-1);
 for(const actor of [operator,assistant]){assert.equal(unit(after,actor.id).ap,actor.ap-cost);assert.deepEqual(spacePoint(unit(after,actor.id)),spacePoint(actor));assert.deepEqual(unitAmmunitionByType(unit(after,actor.id)),unitAmmunitionByType(actor));for(const key of ['hp','bleeding','medkits','inventory'])assert.deepEqual(unit(after,actor.id)[key],actor[key]);}
 for(const key of ['hp','ap','x','y','loaded','ammo','medkits','inventory'])assert.deepEqual(unit(after,'front')[key],unit(start,'front')[key]);
 for(const key of ['id','type','side','x','y','facing'])assert.deepEqual(after.artillery[0][key],gun[key]);assert.deepEqual(start,before);
});


test('a forced public side step makes small positive screen progress while old ordinary work holds and the front fires',()=>{
 const free=new Set(['3,10','3,9',...Array.from({length:9},(_,i)=>`${12+i},8`)]),tiles=flat().map(tile=>({...tile,blocked:!free.has(`${tile.x},${tile.y}`)}));
 const start=createBattle([
  {id:'support',x:3,y:10,facing:6,stance:'standing',weapon:1800,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:60},
  {id:'front',x:12,y:8,facing:2,stance:'prone',weapon:1800,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:100},
 ],{id:'declared-support-short-side-progress',width:24,height:16,tiles,hour:12,seed:45,deferContact:false,
  wallEdges:Array.from({length:13},(_,i)=>({id:`short-progress-wall:${i}`,x:5,y:2+i,axis:'y',type:'wall',material:'adobe',blocksSight:true,cover:40})),
  enemies:[{id:'contact',x:20,y:8,weapon:0,hp:500,maxHp:500,patrol:false,overwatch:false}],artillery:[],
 });
 const before=structuredClone(start),support=unit(start,'support'),front=unit(start,'front'),inherited=recoveryPortSearchController(start,{coordinateInfantry:true,coordinateRifleCover:true}),controller=recoveryPortSearchController(start,options);
 assert.equal(teamCanSee(start,'player',unit(start,'contact')),true);assert.equal(usefulRouteRifleShot(publicRouteView(start,support),support),null);
 assert.equal(inherited(start,support),null);const frontOrder=inherited(start,front);assert.equal(frontOrder?.type,'fire');assert.deepEqual(controller(start,front),frontOrder);
 const choices=getReachable(publicRouteView(start,support),support).filter(point=>point.cost>0);assert.equal(choices.length,1,'the declared public obstacle leaves one actual paid side step');
 const early=publicSupportStagingPlan(start,support);assert.equal(early?.kind,'support-stage');assert.deepEqual(controller(start,support),early.action);proveUnchangedFrontWork(start,early,front.id,frontOrder);
 const prepared=completeFront(start,support.id,front.id),battle=prepared.battle,actor=unit(battle,support.id),plan=publicSupportStagingPlan(battle,actor);assert.equal(plan?.kind,'support-stage');assert.ok(sameCell(plan.route,choices[0]));
 const progress=distance(support,front)-distance(plan.route,front);assert.ok(progress>0&&progress<.5,'small strict positive movement must not be replaced with an arbitrary half-cell minimum');
 assert.equal(plan.route.cost,8);assert.equal(surfaceAt(battle,plan.route).cover,0);assert.deepEqual(controller(battle,actor),plan.action);
 const after=replay(start,[...prepared.orders,plan.action]),moved=unit(after,support.id);assert.deepEqual(spacePoint(moved),spacePoint(plan.route));assert.equal(moved.ap,actor.ap-plan.route.cost);assert.ok(moved.energy<actor.energy);
 unchangedPhysical(battle,after,support.id);assert.equal(usefulRouteRifleShot(publicRouteView(after,moved),moved),null);assert.ok(plan.fireReserve.turnPA>0,'the paid north step reserves the real turn back toward the public eastern contact');assert.ok(moved.ap>=plan.fireReserve.totalPA);
 assert.deepEqual(unit(after,'front'),unit(battle,'front'));assert.deepEqual(replay(start,[...prepared.orders,plan.action]),after);assert.deepEqual(start,before);
});


// New contracts follow the genuine seed8 regression, not a rewritten old
// outcome. All bodies below are fresh declarations before createBattle.
test('an unrelated payable Native front posture and shot remain valid during a clear rear bound',()=>{
 const start=blockedSupport({frontStance:'standing'}),before=structuredClone(start),support=unit(start,'support'),front=unit(start,'front'),base={coordinateInfantry:true,coordinateRifleCover:true};
 const inherited=recoveryPortSearchController(start,base),controller=recoveryPortSearchController(start,options),posture=inherited(start,front);
 assert.equal(posture?.type,'stance');assert.deepEqual(controller(start,front),posture);assert.equal(usefulRouteRifleShot(publicRouteView(start,support),support),null);
 assert.equal(publicSupportPriorityWork(start,support)?.unitId,front.id);const plan=publicSupportStagingPlan(start,support);assert.equal(plan?.kind,'support-stage');assert.deepEqual(controller(start,support),plan.action);
 const moved=replay(start,[plan.action]),afterPose=replay(start,[plan.action,posture]);assert.equal(unit(afterPose,front.id).ap,front.ap-stanceCost(front,posture.stance));
 const fire=controller(afterPose,unit(afterPose,front.id));assert.equal(fire?.type,'fire');nativeShotQuote(afterPose,unit(afterPose,front.id),fire);
 const after=replay(start,[plan.action,posture,fire]),cost=actionCosts(afterPose,unit(afterPose,front.id),unit(afterPose,fire.targetId));
 assert.equal(unit(after,front.id).ap,unit(afterPose,front.id).ap-cost.fire-fire.aim*cost.aim);assert.equal(unit(after,front.id).loaded,front.loaded-1);unchangedPhysical(start,moved,support.id);assert.deepEqual(start,before);
});

test('the support quote reserves the actual reached facing, paid posture, turn and aim costs on an isolated public body',()=>{
 const start=blockedSupport(),before=structuredClone(start),prepared=completeFront(start,'support','front'),battle=prepared.battle,actor=unit(battle,'support'),plan=publicSupportStagingPlan(battle,actor);
 assert.ok(plan);const moved=replay(start,[...prepared.orders,plan.action]),actual=unit(moved,actor.id),reserve=plan.fireReserve,target=unit(moved,reserve.targetId);
 assert.equal(reserve.useful,false,'the wall admits support only, not an invented immediate shot');assert.equal(reserve.aim,4);
 const stance=reserve.stance===actual.stance?null:{type:'stance',unitId:actual.id,stance:reserve.stance},stancePA=stance?stanceCost(actual,stance.stance):0;
 const posed=stance?replay(start,[...prepared.orders,plan.action,stance]):moved,body=unit(posed,actual.id),cost=actionCosts(posed,body,unit(posed,target.id));
 assert.equal(reserve.stancePA,stancePA);assert.equal(reserve.firePA,cost.fire);assert.equal(reserve.turnPA,cost.turn);assert.equal(reserve.readyPA,cost.ready);assert.equal(reserve.aimPA,reserve.aim*cost.aim);
 assert.equal(reserve.totalPA,stancePA+cost.fire+reserve.aim*cost.aim);assert.ok(actual.ap>=reserve.totalPA);assert.equal(body.ap,actual.ap-stancePA);
 assert.equal(actual.ap,actor.ap-plan.route.cost);assert.equal(plan.apDepleted,publicSupportAPDepletion(actor));unchangedPhysical(battle,moved,actor.id);assert.deepEqual(start,before);
});

test('Native base-fire AP alone cannot admit support that would lose the real posture and aimed-shot margin',()=>{
 const start=blockedSupport({supportProfile:{agility:0,dexterity:0,experienceLevel:1,fatigue:20,energy:80}}),before=structuredClone(start),prepared=completeFront(start,'support','front'),battle=prepared.battle,actor=unit(battle,'support'),target=unit(battle,'contact');
 const generic=actionCosts(battle,actor).fire,route=getReachable(publicRouteView(battle,actor),actor).filter(point=>point.cost>0&&point.cost===8).sort((a,b)=>a.y-b.y||a.x-b.x)[0];assert.ok(route);
 assert.equal(publicSupportAPDepletion(actor),0);assert.ok(actor.ap-generic>=route.cost,'the old target-free base-fire margin admits a real paid step');assert.equal(publicSupportPriorityWork(battle,actor),null);
 assert.equal(publicSupportStagingPlan(battle,actor),null,'the full Native turn/posture/aim reserve refuses this budget');assert.equal(recoveryPortSearchController(battle,options)(battle,actor),null);
 const action={type:'move',unitId:actor.id,...spacePoint(route)},moved=replay(start,[...prepared.orders,action]),body=unit(moved,actor.id),stance={type:'stance',unitId:actor.id,stance:'prone'},posturePA=stanceCost(body,'prone');
 const posed=replay(start,[...prepared.orders,action,stance]),cost=actionCosts(posed,unit(posed,actor.id),unit(posed,target.id));
 assert.ok(body.ap<posturePA+cost.fire+4*cost.aim);assert.equal(body.ap,actor.ap-route.cost);assert.equal(unit(posed,actor.id).ap,body.ap-posturePA);unchangedPhysical(battle,moved,actor.id);assert.deepEqual(start,before);
});

test('repeated support uses only remaining Native allocation; an actual next turn establishes its own carried AP',()=>{
 const start=blockedSupport(),before=structuredClone(start),prepared=completeFront(start,'support','front'),battle=prepared.battle,actor=unit(battle,'support'),plan=publicSupportStagingPlan(battle,actor);assert.ok(plan);assert.equal(plan.route.cost,16);
 const orders=[...prepared.orders,plan.action],after=replay(start,orders),body=unit(after,actor.id);
 assert.equal(publicSupportAPDepletion(actor),0);assert.equal(publicSupportAPDepletion(body),16);assert.equal(body.ap,body.maxAP+body.carriedAP-16);
 assert.ok(getReachable(publicRouteView(after,body),body).some(point=>point.cost>0&&point.cost<=16),'Native still has routes; the optional expenditure cap is the reason to hold');assert.equal(publicSupportStagingPlan(after,body),null);
 // A real end-turn can return a pending enemy phase or player interrupt.
 // Complete only those returned phases; do not grant/normalize an allocation.
 const phaseOrders=[],phaseTrace=[];let actualNext=after;
 for(let commit=0;commit<16&&actualNext.turn===after.turn;commit++){
  assert.equal(actualNext.status,'active');assert.ok(['player','enemy','interrupt'].includes(actualNext.phase));
  const previous=actualNext;phaseOrders.push({type:'endTurn'});actualNext=replay(start,[...orders,...phaseOrders]);
  phaseTrace.push({beforeTurn:previous.turn,beforePhase:previous.phase,afterTurn:actualNext.turn,afterPhase:actualNext.phase});
  assert.ok(actualNext.turn===after.turn||actualNext.turn===after.turn+1,'one Native continuation cannot skip the next allocation');
  assert.deepEqual(previous,replay(start,[...orders,...phaseOrders.slice(0,-1)]),'the prior Native phase is unchanged');
 }
 assert.ok(phaseTrace.length>1,'the declared first end-turn really stops before the new allocation');
 assert.equal(phaseTrace[0].afterTurn,after.turn,'the original1 versus2 boundary remains explicitly exercised');
 assert.equal(actualNext.phase,'player');const next=unit(actualNext,actor.id);
 assert.equal(actualNext.turn,after.turn+1);assert.equal(next.carriedAP,Math.min(20,Math.floor(body.ap)));assert.equal(next.ap,next.maxAP+next.carriedAP);assert.equal(publicSupportAPDepletion(next),0,'no closure counter or granted budget persists across Native beginUnitTurn');
 unchangedPhysical(after,actualNext,actor.id);assert.deepEqual(replay(start,[...orders,...phaseOrders]),actualNext);
 assert.deepEqual(start,before);
});

function reserveArena({screen,patient=false,jammed=false,loaded=1,contact=false,exit=false}={}){
 return createBattle([
  {id:'required',x:exit?0:3,y:8,facing:2,stance:contact?'prone':'standing',weapon:1800,loaded,ammo:5,medical:93,medkits:2,marksmanship:100,jammed},
  ...(screen?[{id:'existing-screen',x:12,y:7,facing:2,weapon:0,loaded:0,ammo:0,medical:screen,medkits:0}]:[]),
  ...(patient?[{id:'patient',x:4,y:8,hp:10,maxHp:100,bleeding:3,weapon:0,loaded:0,ammo:0,medical:0,medkits:0}]:[]),
 ],{id:'declared-required-no-screen',width:40,height:16,tiles:Array.from({length:40*16},(_,i)=>({x:i%40,y:Math.floor(i/40),type:'grass',blocked:false,cover:0})),hour:12,seed:45,deferContact:false,
  enemies:[{id:'contact',x:contact?18:39,y:contact?8:15,facing:6,weapon:0,hp:500,maxHp:500,patrol:false,overwatch:false}],artillery:[],
  exits:exit?[{id:'declared:west',edge:'W',destination:'declared-safe-rear',entryEdge:'E',entryAnchor:{x:19,y:8}}]:[],
 });
}

test('a required rear holds move without a current screen only in the explicit new doctrine; the lone default remains paid',()=>{
 const start=reserveArena(),before=structuredClone(start),actor=unit(start,'required'),base={reserveIds:[actor.id],coordinateInfantry:true,coordinateRifleCover:true},inherited=recoveryPortSearchController(start,base)(start,actor);
 assert.equal(inherited?.type,'move','the declared Native ordinary path reaches the existing lone-reserve passthrough');
 assert.deepEqual(recoveryPortSearchController(start,{...base,coordinateSupportStaging:false})(start,actor),inherited);assert.equal(recoveryPortSearchController(start,{...base,coordinateSupportStaging:true})(start,actor),null);
 const after=replay(start,[inherited]),route=getReachable(publicRouteView(start,actor),actor).find(point=>sameCell(point,inherited));assert.ok(route);assert.equal(unit(after,actor.id).ap,actor.ap-route.cost);unchangedPhysical(start,after,actor.id);assert.deepEqual(start,before);
});

test('the existing rear screen still admits a medical70 unarmed empty body; the new option does not invent an armed screen rule',()=>{
 const start=reserveArena({screen:70}),before=structuredClone(start),actor=unit(start,'required'),screen=unit(start,'existing-screen'),base={reserveIds:[actor.id],coordinateInfantry:true,coordinateRifleCover:true};
 assert.equal(screen.loaded,0);assert.equal(screen.ammo,0);assert.equal(screen.weapon,0);assert.ok(screen.medical>=60&&screen.medical<90);assert.ok(screen.hp>=15);
 const inherited=recoveryPortSearchController(start,base)(start,actor),current=recoveryPortSearchController(start,{...base,coordinateSupportStaging:true})(start,actor);assert.equal(inherited?.type,'move');assert.deepEqual(current,inherited);
 const after=replay(start,[current]);unchangedPhysical(start,after,actor.id);assert.deepEqual(unit(after,screen.id),screen);assert.deepEqual(start,before);
});

test('missing-screen hold retains finite adjacent medicine, pan work, rifle fire and the actual paid authorized exit',()=>{
 const aidStart=reserveArena({patient:true}),aidBefore=structuredClone(aidStart),aidActor=unit(aidStart,'required'),aidController=recoveryPortSearchController(aidStart,{...options,reserveIds:[aidActor.id]}),activation=aidController(aidStart,aidActor);
 assert.deepEqual(activation,{type:'weapon',unitId:aidActor.id,slot:'medical'});const active=replay(aidStart,[activation]),aid=aidController(active,unit(active,aidActor.id)),medical=medicalUsePreview(active,unit(active,aidActor.id),unit(active,'patient'));
 assert.equal(medical.allowed,true);assert.equal(aid?.type,'useItem');const treated=replay(aidStart,[activation,aid]);assert.equal(unit(treated,aidActor.id).medkits,aidActor.medkits-1);assert.equal(unit(treated,aidActor.id).ap,unit(active,aidActor.id).ap-medical.cost);assert.ok(unit(treated,'patient').hp>unit(aidStart,'patient').hp);assert.deepEqual(aidStart,aidBefore);
 for(const kind of ['pan','fire']){
  const start=reserveArena(kind==='pan'?{jammed:true}:{contact:true}),before=structuredClone(start),actor=unit(start,'required'),base={reserveIds:[actor.id],coordinateInfantry:true,coordinateRifleCover:true},inherited=recoveryPortSearchController(start,base)(start,actor),current=recoveryPortSearchController(start,{...base,coordinateSupportStaging:true})(start,actor);
  assert.deepEqual(current,inherited);assert.equal(current?.type,kind==='pan'?'reprime':'fire');const after=replay(start,[current]);
  if(kind==='pan'){assert.equal(unit(after,actor.id).ap,actor.ap-reprimePlan(actor,start).pa);assert.equal(unit(after,actor.id).jammed,false);assert.deepEqual(unitAmmunitionByType(unit(after,actor.id)),unitAmmunitionByType(actor));}
  else{const cost=actionCosts(start,actor,unit(start,current.targetId));assert.equal(unit(after,actor.id).ap,actor.ap-cost.fire-current.aim*cost.aim);assert.equal(unit(after,actor.id).loaded,actor.loaded-1);}
  for(const key of ['hp','bleeding','medkits','x','y','tacticalLevel'])assert.deepEqual(unit(after,actor.id)[key],actor[key]);assert.deepEqual(after.artillery,start.artillery);assert.deepEqual(start,before);
 }
 const exitStart=reserveArena({exit:true}),exitBefore=structuredClone(exitStart),exit=exitStart.exits[0];assert.equal(validEntry(exit.entryEdge,exit.entryAnchor),true,'declared arrival metadata is admitted before any Native exit');assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(exitStart))),exitStart);
 const actor=unit(exitStart,'required'),preview=exitPreview(exitStart,{unitIds:[actor.id],exitId:'declared:west'});assert.equal(preview.available,true,preview.reason);
 const action={type:'exit',unitIds:[actor.id],exitId:'declared:west'},departed=replay(exitStart,[action]);assert.ok(unit(departed,actor.id).departure);assert.equal(unit(departed,actor.id).departure.destination,'declared-safe-rear');assert.equal(unit(departed,actor.id).ap,actor.ap-preview.costById[actor.id]);
 for(const key of ['hp','bleeding','loaded','medkits','inventory'])assert.deepEqual(unit(departed,actor.id)[key],actor[key]);assert.deepEqual(departed.artillery,exitStart.artillery);assert.deepEqual(exitStart,exitBefore);
});


test('a fresh 147/128-equivalent public boundary admits the real16AP rear bound without delaying the current front job',()=>{
 // Fresh declarations, not copied earned/failed battle bodies. Positions,
 // Native98/96AP, finite primary stocks and the six-cell support gap match
 // the retained common boundary. An authored wall makes the rear idle while
 // the front's eastern Native trajectory remains clear.
 const width=52,height=48,tiles=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
 const start=createBattle([
  {id:'rear',x:25,y:23,facing:2,hp:78,maxHp:78,agility:78,dexterity:75,experienceLevel:4,energy:100,fatigue:0,medical:47,medkits:2,weapon:1801,loaded:1,ammo:11,marksmanship:83},
  {id:'front',x:31,y:23,facing:2,hp:79,maxHp:79,agility:74,dexterity:75,experienceLevel:4,energy:100,fatigue:0,medical:22,medkits:2,weapon:1800,loaded:1,ammo:11,marksmanship:94,traits:['line_marksman']},
 ],{id:'declared-clear-current-work-boundary',width,height,tiles,hour:12,seed:45,deferContact:false,enemies:[{id:'contact',x:47,y:23,facing:6,weapon:0,hp:500,maxHp:500,patrol:false,overwatch:false}],artillery:[],wallEdges:Array.from({length:5},(_,i)=>({id:`idle-rear-wall:${i}`,x:29,y:21+i,axis:'y',type:'wall',material:'adobe',blocksSight:true,cover:40}))});
 const before=structuredClone(start),rear=unit(start,'rear'),front=unit(start,'front'),controller=recoveryPortSearchController(start,options);
 assert.equal(rear.ap,98);assert.equal(front.ap,96);assert.equal(publicSupportAPDepletion(rear),0);assert.equal(usefulRouteRifleShot(publicRouteView(start,rear),rear),null);assert.equal(recoveryPortSearchController(start,{coordinateInfantry:true,coordinateRifleCover:true})(start,rear),null);
 const work=publicSupportPriorityWork(start,rear);assert.equal(work.unitId,front.id);assert.equal(work.type,'fire');const frontAction={type:work.type,unitId:work.unitId,targetId:work.targetId,aim:work.aim,hitLocation:work.hitLocation};assert.equal(work.pa,nativeShotQuote(start,front,frontAction).pa);
 const plan=publicSupportStagingPlan(start,rear);assert.equal(plan?.kind,'support-stage');assert.deepEqual(plan.action,{type:'move',unitId:rear.id,x:27,y:23,tacticalLevel:0});assert.equal(plan.route.cost,16);assert.deepEqual(controller(start,rear),plan.action);
 const after=proveUnchangedFrontWork(start,plan,front.id,frontAction);assert.equal(unit(after,rear.id).ap,82);assert.ok(unit(after,rear.id).energy<rear.energy);unchangedPhysical(start,after,rear.id);assert.deepEqual(start,before);
});

test('a farther public shooter protects its real line at a transient support step, outside the screen-radius rule',()=>{
 const width=30,height=16,tiles=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
 const start=createBattle([
  {id:'support',x:7,y:7,facing:6,medical:0,medkits:0,weapon:1800,loaded:1,ammo:5,marksmanship:20},
  {id:'screen',x:16,y:10,facing:2,stance:'prone',medical:0,medkits:0,weapon:1800,loaded:1,ammo:5,marksmanship:100},
  {id:'farther-front',x:4,y:6,facing:2,stance:'prone',medical:0,medkits:0,weapon:1801,loaded:1,ammo:5,marksmanship:100},
 ],{id:'declared-farther-current-work-crossing',width,height,tiles,hour:12,seed:45,deferContact:false,wallEdges:[{id:'rear-only-sight-wall',x:12,y:7,axis:'y',type:'wall',material:'adobe',blocksSight:true,cover:40}],enemies:[{id:'contact',x:24,y:6,facing:6,weapon:0,hp:500,maxHp:500,patrol:false,overwatch:false}],artillery:[]});
 const before=structuredClone(start),support=unit(start,'support'),farther=unit(start,'farther-front'),contact=unit(start,'contact'),work=usefulRouteRifleShot(publicRouteView(start,farther),farther);
 assert.equal(usefulRouteRifleShot(publicRouteView(start,support),support),null);assert.ok(work);assert.ok(distance(farther,contact)>distance(support,contact),'the old nearer-front selector cannot protect this shooter');const quoted=nativeShotQuote(start,farther,work);
 const route=getReachable(publicRouteView(start,support),support).find(point=>point.x===8&&point.y===6);assert.ok(route&&route.cost>0&&route.cost<=16);
 const rejected=publicSupportRouteWorkPreview(start,support,route);assert.equal(rejected.allowed,false);
 const action={type:'move',unitId:support.id,...spacePoint(route)},crossed=replay(start,[action]),next=unit(crossed,farther.id),target=unit(crossed,contact.id),option=firearmShotOptions(crossed,next,target,work.aim).find(row=>row.aim===work.aim&&row.hitLocation===work.hitLocation);
 assert.ok(!option||!knownRouteShotSafety(crossed,next,target)(option)||option.chance<quoted.chance||option.damageFactor<quoted.damageFactor,'the actual Native support body compromises the exact previously payable job');
 assert.equal(unit(crossed,support.id).ap,support.ap-route.cost);assert.ok(unit(crossed,support.id).energy<support.energy);unchangedPhysical(start,crossed,support.id);
 for(const key of ['ap','loaded','inventory','hp','x','y'])assert.deepEqual(next[key],farther[key]);assert.deepEqual(start,before);
});
