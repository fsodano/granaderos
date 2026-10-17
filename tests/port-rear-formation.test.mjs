import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,endTurn,presentedEndTurn,getReachable,teamCanSee,actionCosts,medicalUsePreview,artilleryContact,artilleryCosts,artilleryCrewPlan,reprimePlan,reloadPlan,stanceCost} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {sameCell,sameSurface,spacePoint} from '../game/tactical-space.js';
import {COMBAT_ROUND_SECONDS} from '../game/time.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {ammunitionByType,isAmmunitionStack,weaponAmmoType} from '../game/ammunition-types.js';
import {publicRouteView} from './route-infantry-progress.mjs';
import {publicSupportAPDepletion,previewPublicPaidWalk} from './public-support-staging.mjs';
import {publicRearFormationFollowPlan} from './public-rear-formation.mjs';
import {recoveryPortSearchController} from './recovery-port-battery-driver.mjs';
import {openingControlWindow} from './opening-driver.mjs';

const oldOptions={coordinateInfantry:true,coordinateRifleCover:true,coordinateSupportStaging:true,reserveIds:['required']};
const options={...oldOptions,coordinateRearFormation:true};
const unit=(battle,id)=>battle.units.find(actor=>actor.id===id),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const flat=(width=40,height=16)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));

// Fresh declared controller arenas only. Every position, wall/cart and finite
// body/weapon stock below is declared before createBattle. No earned input,
// failed output, live HP/AP/clock overwrite or campaign money/return claim.
function followArena({wall=true,cart=false,pocket=false,screen=true,medicalScreen=false,hiddenKind,frontY=7,reserveOverrides={}}={}){
 let tiles=flat();
 if(cart||pocket){
  const free=new Set(['3,8','4,8','5,8',...(pocket?[]:['3,9','4,9','5,9','6,9','7,9','8,9',...Array.from({length:13},(_,i)=>(8+i)+',8')])]);
  for(const point of ['12,7','13,8','12,8','20,8'])free.add(point);
  tiles=tiles.map(tile=>({...tile,blocked:!free.has(tile.x+','+tile.y)}));
 }
 const required={id:'required',x:3,y:8,facing:6,stance:'standing',weapon:1800,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:40,strength:75,...reserveOverrides};
 const front=cart||pocket?{id:'front',x:13,y:8}:{id:'front',x:12,y:frontY};
 const players=[required,...(screen?[{...front,facing:2,stance:'prone',weapon:medicalScreen?0:1800,loaded:medicalScreen?0:1,ammo:medicalScreen?0:50,medical:medicalScreen?70:0,medkits:0,marksmanship:100}]:[]),
  ...(screen&&(cart||pocket)?[{id:'second-screen',x:12,y:8,facing:2,stance:'prone',weapon:1800,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:60}]:[])];
 const hiddenPoint={x:6,y:8};
 return createBattle(players,{id:'declared-rear-formation',width:40,height:16,tiles,hour:12,seed:45,deferContact:false,
  wallEdges:wall&&!cart&&!pocket?Array.from({length:13},(_,i)=>({id:'public-screen-wall:'+i,x:6,y:2+i,axis:'y',type:'wall',material:'adobe',blocksSight:true,cover:40})):[],
  props:cart||pocket?[{id:'actual-cart',type:'cart',x:4,y:8,footprint:{width:2,height:1},blocksMovement:true}]:[],
  enemies:[{id:'contact',x:20,y:8,facing:6,weapon:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false},
   ...(hiddenKind==='actor'?[{id:'unknown',...hiddenPoint,facing:6,weapon:0,loaded:0,ammo:0,hp:100,maxHp:100,patrol:false,overwatch:false}]:[])],
  artillery:hiddenKind==='gun'?[{id:'unknown',...hiddenPoint,type:'swivel',side:'enemy',loaded:true,ammo:3}]:[],
 });
}

function replay(start,orders,{refusal=false}={}){
 let direct=structuredClone(start),presented=structuredClone(start),restored=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  direct=action.type==='endTurn'?endTurn(direct):actBattle(direct,action);
  if(refusal)assert.equal(typeof direct.lastError,'string');else assert.equal(direct.lastError,null,JSON.stringify(action));
  presented=(action.type==='endTurn'?presentedEndTurn(presented):presentedActBattle(presented,action)).state;assert.deepEqual(presented,direct);
  const copied=JSON.parse(JSON.stringify(action));restored=validateBattleSnapshot(JSON.parse(JSON.stringify(copied.type==='endTurn'?endTurn(restored):actBattle(restored,copied))));assert.deepEqual(restored,direct);
 }
 return direct;
}
const immutableBody=(before,after,id)=>{
 const a=unit(before,id),b=unit(after,id);
 for(const key of ['hp','maxHp','bleeding','medkits','loaded','weapon','condition','weaponInstanceId','inventory','outfit','headwear','legwear','assignment'])assert.deepEqual(b[key],a[key],key);
 assert.deepEqual(unitAmmunitionByType(b),unitAmmunitionByType(a));
};
function paidFollow(start,plan,{prior=[]}={}){
 assert.equal(plan?.kind,'rear-formation-follow');const before=replay(start,prior),actor=unit(before,plan.unitId),view=publicRouteView(before,actor);
 const native=getReachable(view,actor).find(point=>sameCell(point,plan.route));assert.ok(native);assert.deepEqual(native,plan.route);
 assert.ok(native.cost>0&&native.cost<=16&&native.cost<=actor.ap);assert.ok(native.path.length>0&&native.path.length<=3);
 assert.ok(native.path.every(point=>(point.kind===undefined||point.kind==='move')&&sameSurface(point,actor)&&point.x<=plan.goal.x));
 const forecast=previewPublicPaidWalk(view,actor,native,Math.min(16,actor.ap));assert.ok(forecast);
 const after=replay(start,[...prior,plan.action]),moved=unit(after,actor.id);assert.deepEqual(spacePoint(moved),spacePoint(native));
 for(const key of ['ap','facing','momentum','lastDirection','weaponReady','energy','fatigue'])assert.deepEqual(moved[key],forecast.actor[key],key);
 assert.equal(moved.ap,actor.ap-native.cost);assert.ok(moved.ap>=plan.fireReserve.totalPA);assert.ok(moved.energy<actor.energy);
 assert.equal(after.elapsedSeconds,before.elapsedSeconds+(before.roundTimeCharged?0:COMBAT_ROUND_SECONDS));assert.equal(after.seed,before.seed);
 immutableBody(before,after,actor.id);assert.deepEqual(after.artillery,before.artillery);assert.deepEqual(after.props,before.props);assert.deepEqual(after.wallEdges,before.wallEdges);
 return after;
}

test('rear formation is a separate false default and pays one actual affordable screen-present route prefix',()=>{
 const start=followArena(),before=structuredClone(start),actor=unit(start,'required'),old=recoveryPortSearchController(start,oldOptions),explicitFalse=recoveryPortSearchController(start,{...oldOptions,coordinateRearFormation:false}),current=recoveryPortSearchController(start,options);
 assert.equal(start.mode,'combat');assert.equal(teamCanSee(start,'player',unit(start,'contact')),true);
 for(const friend of start.units.filter(u=>u.side==='player')){assert.deepEqual(explicitFalse(start,friend),old(start,friend));assert.deepEqual(explicitFalse.sharedFallback(start,friend),old.sharedFallback(start,friend));}
 assert.equal(old(start,actor),null);assert.equal(current(start,actor),null,'the ordinary role hold is unchanged');assert.equal(old.sharedFallback(start,actor),null);
 const plan=publicRearFormationFollowPlan(start,actor,{reserveIds:options.reserveIds});assert.ok(plan);assert.deepEqual(current.sharedFallback(start,actor),plan.action);
 const after=paidFollow(start,plan);for(const friend of start.units.filter(u=>u.side==='player'&&u.id!==actor.id))assert.deepEqual(unit(after,friend.id),friend);
 assert.deepEqual(start,before);
});

test('the public cart detour admits its real16AP prefix even when the first step increases straight-line distance',()=>{
 const start=followArena({cart:true}),before=structuredClone(start),actor=unit(start,'required'),cart=start.props[0],plan=publicRearFormationFollowPlan(start,actor,{reserveIds:options.reserveIds});
 assert.ok(plan);assert.deepEqual(plan.goal,{x:8,y:8,tacticalLevel:0});assert.deepEqual(plan.action,{type:'move',unitId:actor.id,x:4,y:9,tacticalLevel:0});assert.equal(plan.route.cost,16);
 assert.deepEqual(plan.route.path.map(spacePoint),[{x:3,y:9,tacticalLevel:0},{x:4,y:9,tacticalLevel:0}]);assert.ok(distance(plan.route.path[0],plan.goal)>distance(actor,plan.goal));
 const reachable=getReachable(publicRouteView(start,actor),actor);for(const x of [cart.x,cart.x+1])assert.equal(reachable.some(point=>point.x===x&&point.y===cart.y),false);
 assert.ok(plan.route.path.every(point=>point.y!==cart.y||point.x<cart.x||point.x>=cart.x+2));
 const after=paidFollow(start,plan);assert.deepEqual(start,before);assert.deepEqual(after.props,start.props);
});

test('real ordinary front fire and every squad consultation precede at most one formation fallback and full replay',()=>{
 const start=followArena(),before=structuredClone(start),controller=recoveryPortSearchController(start,options),consulted=[],fallbackChecks=[];
 const front=unit(start,'front');
 const result=openingControlWindow(start,{controller:(state,actor)=>{consulted.push(actor.id);return controller(state,actor);},sharedFallback:(state,actor)=>{
  for(const friend of state.units.filter(u=>u.side==='player'&&u.ap>=3))assert.ok(consulted.includes(friend.id),'each actual ordinary actor was consulted');
  fallbackChecks.push(actor.id);return controller.sharedFallback(state,actor);
 }});
 assert.ok(result.orders.some(action=>action.unitId===front.id&&action.type==='fire'));assert.ok(fallbackChecks.length>0);
 assert.equal(result.sharedInvestigation?.type,'move');assert.equal(result.sharedInvestigation.unitId,'required');assert.deepEqual(result.orders.at(-1),result.sharedInvestigation);
 assert.equal(result.orders.filter(action=>action.unitId==='required'&&action.type==='move').length,1,'one bound follows the complete idle pass');
 assert.equal(result.orders[0].type,'fire');assert.equal(result.orders[0].unitId,front.id);assert.deepEqual(replay(start,result.orders),result.battle);
 const shots=result.orders.filter(action=>action.unitId===front.id&&action.type==='fire').length,totalAmmo=actor=>Object.values(unitAmmunitionByType(actor)).reduce((sum,count)=>sum+count,0);
 assert.equal(totalAmmo(front)-totalAmmo(unit(result.battle,front.id)),shots,'each actual personal shot consumes one finite cartridge');
 for(let index=0;index<result.orders.length-1;index++){
  const action=result.orders[index],at=replay(start,result.orders.slice(0,index)),actor=unit(at,action.unitId),next=replay(start,result.orders.slice(0,index+1));
  assert.equal(action.unitId,front.id);assert.ok(['fire','stance','reload','reprime','weapon'].includes(action.type));
  const costs=actionCosts(at,actor,unit(at,action.targetId)),paid=action.type==='fire'?costs.fire+action.aim*costs.aim:action.type==='stance'?stanceCost(actor,action.stance):action.type==='reload'?reloadPlan(actor,at).pa:action.type==='reprime'?reprimePlan(actor,at).pa:costs.weapon;
  assert.equal(unit(next,actor.id).ap,actor.ap-paid,'the ordinary order pays its actual current Native quote');
 }
 const beforeBound=replay(start,result.orders.slice(0,-1)),plan=publicRearFormationFollowPlan(beforeBound,unit(beforeBound,'required'),{reserveIds:options.reserveIds});assert.deepEqual(plan.action,result.sharedInvestigation);
 paidFollow(start,plan,{prior:result.orders.slice(0,-1)});assert.deepEqual(start,before);
});

test('finite ordinary adjacent medicine remains first and actual physician or clinical duties never become formation movement',()=>{
 const start=createBattle([
  {id:'required',x:3,y:8,medical:93,medkits:2,weapon:1800,loaded:1,ammo:5,marksmanship:40},
  {id:'patient',x:4,y:8,hp:10,maxHp:100,bleeding:3,medical:0,medkits:0,weapon:0,loaded:0,ammo:0},
  {id:'front',x:12,y:7,facing:2,stance:'prone',medical:0,medkits:0,weapon:1800,loaded:1,ammo:5,marksmanship:100},
 ],{id:'declared-rear-medical',width:40,height:16,tiles:flat(),hour:12,seed:45,deferContact:false,enemies:[{id:'contact',x:20,y:8,weapon:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false}],artillery:[]});
 const before=structuredClone(start),doctor=unit(start,'required'),controller=recoveryPortSearchController(start,options);assert.equal(publicRearFormationFollowPlan(start,doctor,{reserveIds:options.reserveIds}),null);
 const activation=controller(start,doctor);assert.deepEqual(activation,{type:'weapon',unitId:doctor.id,slot:'medical'});const active=replay(start,[activation]),activeDoctor=unit(active,doctor.id);assert.equal(activeDoctor.ap,doctor.ap-actionCosts(start,doctor).weapon);
 assert.equal(publicRearFormationFollowPlan(active,activeDoctor,{reserveIds:options.reserveIds}),null);const aid=controller(active,activeDoctor),quote=medicalUsePreview(active,activeDoctor,unit(active,'patient'));assert.equal(quote.allowed,true,quote.reason);assert.equal(aid?.type,'useItem');
 const treated=replay(start,[activation,aid]);assert.equal(active.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);assert.equal(treated.elapsedSeconds,active.elapsedSeconds);assert.equal(unit(treated,doctor.id).medkits,doctor.medkits-1);assert.equal(unit(treated,doctor.id).ap,activeDoctor.ap-quote.cost);assert.ok(unit(treated,'patient').hp>unit(start,'patient').hp);assert.ok(unit(treated,'patient').bleeding<unit(start,'patient').bleeding);
 assert.deepEqual(treated.artillery,start.artillery);assert.deepEqual(start,before);
 for(const assignment of ['doctor','militia_doctor','patient']){
  const duty=followArena({reserveOverrides:{medical:52,medkits:2,assignment}}),copy=structuredClone(duty);assert.equal(publicRearFormationFollowPlan(duty,unit(duty,'required'),{reserveIds:options.reserveIds}),null);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(duty))),duty);assert.deepEqual(duty,copy);
 }
});

test('actual charged gun contact holds formation while ordinary finite cannon fire pays the native crew and charge',()=>{
 const start=createBattle([
  {id:'2',x:5,y:8,facing:2,stance:'crouched',weapon:1800,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:60},
  {id:'crew',x:6,y:7,facing:2,stance:'crouched',weapon:1800,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:50},
  {id:'front',x:10,y:5,facing:2,stance:'prone',weapon:1800,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:100},
 ],{id:'declared-rear-charged-gun',width:24,height:16,tiles:flat(24,16),hour:12,seed:45,deferContact:false,enemies:[{id:'contact',x:18,y:8,weapon:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false}],artillery:[{id:'actual-bronze',type:'bronze4',side:'player',x:6,y:8,facing:0,loaded:true,ammo:2}]});
 const before=structuredClone(start),gun=start.artillery[0],operator=unit(start,'2'),assistant=unit(start,'crew'),localOptions={...options,reserveIds:[operator.id]};
 assert.equal(artilleryContact(start,operator,gun),true);assert.equal(sameCell(operator,gun),false);assert.equal(publicRearFormationFollowPlan(start,operator,{reserveIds:[operator.id]}),null);
 const current=recoveryPortSearchController(start,localOptions),old=recoveryPortSearchController(start,{...localOptions,coordinateRearFormation:false}),action=current(start,operator);assert.deepEqual(action,old(start,operator));assert.equal(action?.type,'artillery');
 const cost=artilleryCosts(start,operator,gun).fire,crew=artilleryCrewPlan(start,operator,gun,cost);assert.equal(crew.reason,null);assert.deepEqual(new Set(crew.crew),new Set([operator.id,assistant.id]));
 const after=replay(start,[action]);assert.equal(Number(after.artillery[0].loaded)+after.artillery[0].ammo,Number(gun.loaded)+gun.ammo-1);
 for(const actor of [operator,assistant]){assert.equal(unit(after,actor.id).ap,actor.ap-cost);immutableBody(start,after,actor.id);assert.deepEqual(spacePoint(unit(after,actor.id)),spacePoint(actor));}
 for(const key of ['id','type','side','x','y','facing'])assert.deepEqual(after.artillery[0][key],gun[key]);
 for(const key of ['hp','ap','x','y','loaded','ammo','medkits','inventory'])assert.deepEqual(unit(after,'front')[key],unit(start,'front')[key]);assert.deepEqual(start,before);
});

test('unknown opposing bodies or guns do not change the public formation proposal but actual Native movement stops at them',()=>{
 // The authored Native quick_movement ability is declared on BOTH inputs
 // before creation, allowing3 real running steps beyond peripheral sight.
 for(const hiddenKind of ['actor','gun']){
  const clear=followArena({wall:false,frontY:8,reserveOverrides:{movementMode:'run',abilities:['quick_movement']}}),hidden=followArena({wall:false,frontY:8,hiddenKind,reserveOverrides:{movementMode:'run',abilities:['quick_movement']}}),before=structuredClone(hidden),unknown=hiddenKind==='gun'?hidden.artillery[0]:unit(hidden,'unknown');
  assert.equal(teamCanSee(hidden,'player',unknown),false);
  const plan=publicRearFormationFollowPlan(clear,unit(clear,'required'),{reserveIds:options.reserveIds}),actual=publicRearFormationFollowPlan(hidden,unit(hidden,'required'),{reserveIds:options.reserveIds});assert.ok(plan);assert.deepEqual(actual,plan);
  assert.ok(plan.route.path.some(point=>sameCell(point,unknown)),'the public proposal retains the unseen physical obstruction');
  const after=replay(hidden,[actual.action]),moved=unit(after,'required');assert.equal(sameCell(moved,unknown),false);assert.ok(moved.lastMovePath.length>0&&moved.lastMovePath.length<plan.route.path.length);
  const actualPaid=getReachable(publicRouteView(hidden,unit(hidden,'required')),unit(hidden,'required')).find(point=>sameCell(point,moved));assert.ok(actualPaid);assert.equal(moved.ap,unit(hidden,'required').ap-actualPaid.cost);
  immutableBody(hidden,after,'required');assert.deepEqual(after.artillery,hidden.artillery);assert.deepEqual(hidden,before);
 }
});

test('the new full-pass option keeps the exact ordinary no-screen hold and still admits a medical70 unarmed existing screen',()=>{
 const lone=followArena({wall:false,screen:false}),before=structuredClone(lone),actor=unit(lone,'required'),current=recoveryPortSearchController(lone,options),prior=recoveryPortSearchController(lone,oldOptions);
 assert.equal(current(lone,actor),null);assert.equal(prior(lone,actor),null);assert.equal(current.sharedFallback(lone,actor),null);assert.equal(publicRearFormationFollowPlan(lone,actor,{reserveIds:options.reserveIds}),null);
 const defaultPolicy=recoveryPortSearchController(lone,{...oldOptions,coordinateSupportStaging:false}),defaultAction=defaultPolicy(lone,actor);assert.equal(defaultAction?.type,'move');const paidDefault=replay(lone,[defaultAction]);assert.ok(!sameCell(unit(paidDefault,actor.id),actor));immutableBody(lone,paidDefault,actor.id);assert.deepEqual(lone,before);
 const existing=followArena({medicalScreen:true}),copy=structuredClone(existing),screen=unit(existing,'front');assert.equal(screen.medical,70);assert.equal(screen.loaded,0);assert.equal(screen.weapon,0);assert.equal(screen.ammo,0);
 const plan=publicRearFormationFollowPlan(existing,unit(existing,'required'),{reserveIds:options.reserveIds});assert.ok(plan);assert.equal(plan.screenId,screen.id);paidFollow(existing,plan);assert.deepEqual(existing,copy);
});

test('wounded empty jammed or unavailable declared bodies hold formation and actual reload or pan work stays finite',()=>{
 for(const profile of [{hp:70,maxHp:100},{loaded:0},{jammed:true},{knockedDown:true},{weaponMode:'melee'},{weapon:0,loaded:0,ammo:0},{energy:0}]){
  const start=followArena({reserveOverrides:profile}),before=structuredClone(start),actor=unit(start,'required');assert.equal(publicRearFormationFollowPlan(start,actor,{reserveIds:options.reserveIds}),null);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(start))),start);assert.deepEqual(start,before);
 }
 for(const kind of ['reload','reprime']){
  const start=followArena({reserveOverrides:kind==='reload'?{loaded:0}:{jammed:true}}),before=structuredClone(start),actor=unit(start,'required'),controller=recoveryPortSearchController(start,options),action=controller(start,actor);assert.equal(action?.type,kind);
  const quote=kind==='reload'?reloadPlan(actor,start):reprimePlan(actor,start),after=replay(start,[action]),body=unit(after,actor.id);assert.equal(body.ap,actor.ap-quote.pa);
  if(kind==='reload'){
   const type=weaponAmmoType(actor),stacks=Object.entries(actor.inventory).filter(([,stack])=>isAmmunitionStack(stack)&&stack.ammoType===type);assert.equal(stacks.length,1,'the declared Native5-cartridge reserve occupies one real typed stack');
   const [key,stack]=stacks[0];assert.ok(quote.rounds>0&&stack.count>quote.rounds,'this actual complete reload retains the finite source stack');
   const expectedInventory={...actor.inventory,[key]:{...stack,count:stack.count-quote.rounds}};assert.deepEqual(body.inventory,expectedInventory,'exact typed debit preserves all ammo metadata and every non-ammo item');
   assert.deepEqual(ammunitionByType(body),{...ammunitionByType(actor),[type]:ammunitionByType(actor)[type]-quote.rounds});assert.equal(body.ammo,actor.ammo-quote.rounds);
   assert.equal(body.loaded,actor.loaded+quote.rounds);assert.deepEqual(unitAmmunitionByType(body),unitAmmunitionByType(actor),'loading transfers cartridges into the barrel without creating them');
  }else{assert.equal(body.jammed,false);assert.deepEqual(body.inventory,actor.inventory);assert.deepEqual(unitAmmunitionByType(body),unitAmmunitionByType(actor));}
  for(const key of ['hp','bleeding','medkits','x','y','tacticalLevel'])assert.deepEqual(body[key],actor[key]);assert.deepEqual(after.artillery,start.artillery);assert.deepEqual(start,before);
 }
});

test('a real20AP setup still admits a separate bounded follow from remaining Native AP without resetting its allocation',()=>{
 const start=followArena(),before=structuredClone(start),actor=unit(start,'required'),orders=[{type:'move',unitId:actor.id,x:4,y:9,tacticalLevel:0},{type:'move',unitId:actor.id,x:3,y:9,tacticalLevel:0}],firstRoute=getReachable(publicRouteView(start,actor),actor).find(point=>sameCell(point,orders[0]));assert.equal(firstRoute.cost,12);
 const first=replay(start,[orders[0]]),secondRoute=getReachable(publicRouteView(first,unit(first,actor.id)),unit(first,actor.id)).find(point=>sameCell(point,orders[1]));assert.equal(secondRoute.cost,8);
 const prepared=replay(start,orders),body=unit(prepared,actor.id);assert.equal(body.ap,actor.ap-20);assert.equal(publicSupportAPDepletion(body),20);assert.equal(body.maxAP,actor.maxAP);assert.equal(body.carriedAP,actor.carriedAP);
 const current=recoveryPortSearchController(start,options);assert.equal(current(prepared,body),null,'real ordinary work is idle at this declared boundary');
 const plan=publicRearFormationFollowPlan(prepared,body,{reserveIds:options.reserveIds});assert.ok(plan);assert.deepEqual(current.sharedFallback(prepared,body),plan.action);
 const after=paidFollow(start,plan,{prior:orders});assert.equal(unit(after,body.id).ap,actor.ap-20-plan.route.cost);assert.equal(publicSupportAPDepletion(unit(after,body.id)),20+plan.route.cost);assert.deepEqual(start,before);
});

test('blocked geometry and actually exhausted AP never become a granted prefix; native cell refusal is atomic and replayed',()=>{
 const pocket=followArena({pocket:true}),before=structuredClone(pocket),actor=unit(pocket,'required');assert.equal(publicRearFormationFollowPlan(pocket,actor,{reserveIds:options.reserveIds}),null);assert.equal(getReachable(publicRouteView(pocket,actor),actor).filter(point=>point.cost>0).length,0);
 const refused=replay(pocket,[{type:'move',unitId:actor.id,x:4,y:8,tacticalLevel:0}],{refusal:true});assert.ok(refused.lastError);assert.deepEqual(refused.units,pocket.units);assert.deepEqual(refused.artillery,pocket.artillery);assert.deepEqual(refused.props,pocket.props);
 for(const key of ['seed','elapsedSeconds','syncedSeconds','turn','phase','status','roundTimeCharged'])assert.deepEqual(refused[key],pocket[key]);assert.deepEqual(pocket,before);
 const start=followArena(),initial=structuredClone(start),orders=[];let paid=start;
 for(let count=0;count<20;count++){
  const body=unit(paid,'required'),target={x:3,y:body.y===8?9:8,tacticalLevel:0},route=getReachable(publicRouteView(paid,body),body).find(point=>sameCell(point,target));if(!route||route.cost>body.ap)break;
  orders.push({type:'move',unitId:body.id,...target});paid=replay(start,orders);
 }
 const body=unit(paid,'required');assert.ok(orders.length>0);assert.ok(body.ap<8);assert.equal(body.ap,unit(start,body.id).ap-8*orders.length);assert.equal(publicRearFormationFollowPlan(paid,body,{reserveIds:options.reserveIds}),null);
 immutableBody(start,paid,body.id);assert.deepEqual(paid.artillery,start.artillery);assert.equal(paid.elapsedSeconds,COMBAT_ROUND_SECONDS);assert.equal(paid.seed,start.seed);assert.deepEqual(replay(start,orders),paid);assert.deepEqual(start,initial);
});
