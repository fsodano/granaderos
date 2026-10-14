import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createBattle,actBattle,endTurn,presentedActBattle,actionCosts,canSee,teamCanSee,hasLineOfSight,shotChance,getReachable,movementEnergy,stanceCost,artilleryCosts,artilleryCrewPlan,artilleryReloadPreview} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {COMBAT_ROUND_SECONDS} from '../game/time.js';
import {sameCell,surfaceAt} from '../game/tactical-space.js';
import {chooseEnemyAction,choosePlayerSharedSightingInvestigation} from '../game/tactical-ai.js';
import {directionTo,turnAPCost} from '../game/tactical-awareness.js';
import {cautiousCombatOrder} from './cautious-driver.mjs';
import {combatOrder,sharedSightingInvestigationOrder,openingControlWindow} from './opening-driver.mjs';
import {hiredAssaultOrder} from './hired-assault-driver.mjs';
import {northernReliefDefenseController} from './northern-relief-defense.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
const provenance=JSON.parse(readFileSync(new URL('./fixtures/opening-cordoba-shared-sighting.provenance.json',import.meta.url),'utf8'));
const bytes=readFileSync(new URL('./fixtures/opening-cordoba-shared-sighting.json.gz',import.meta.url));
assert.equal(bytes.length,provenance.fixture.bytes);assert.equal(digest(bytes),provenance.fixture.sha256);
const decoded=gunzipSync(bytes);
assert.equal(decoded.length,provenance.fixture.decodedBytes);assert.equal(digest(decoded),provenance.fixture.decodedSha256);
const fixture=JSON.parse(decoded);
const priorityProvenance=JSON.parse(readFileSync(new URL('./fixtures/opening-squad-priority.provenance.json',import.meta.url),'utf8'));
const priorityBytes=readFileSync(new URL('./fixtures/opening-squad-priority.json.gz',import.meta.url));
assert.equal(priorityBytes.length,priorityProvenance.fixture.bytes);assert.equal(digest(priorityBytes),priorityProvenance.fixture.sha256);
const priorityDecoded=gunzipSync(priorityBytes);
assert.equal(priorityDecoded.length,priorityProvenance.fixture.decodedBytes);assert.equal(digest(priorityDecoded),priorityProvenance.fixture.decodedSha256);
const priorityFixture=JSON.parse(priorityDecoded);
const record=(name,value)=>{
 const directory=process.env.GRANADEROS_OPENING_CONTROL_DIR;if(!directory)return;
 mkdirSync(directory,{recursive:true});writeFileSync(join(directory,name),JSON.stringify(value,null,2)+'\n');
};
const witness=()=>{
 const battle=structuredClone(fixture.battle),unit=battle.units.find(u=>u.id===fixture.unit.id);
 assert.deepEqual(unit,fixture.unit);
 assert.deepEqual({sector:battle.sectorId,turn:battle.turn,phase:battle.phase,mode:battle.mode,elapsed:battle.elapsedSeconds},
  {sector:'cordoba',turn:1,phase:'player',mode:'combat',elapsed:21});
 assert.deepEqual({id:unit.id,x:unit.x,y:unit.y,hp:unit.hp,bleeding:unit.bleeding,stance:unit.stance,ap:unit.ap,loaded:unit.loaded,ammo:unit.ammo,energy:unit.energy},
  {id:'124',x:63,y:27,hp:85,bleeding:0,stance:'prone',ap:78,loaded:1,ammo:9,energy:76});
 const sighting=battle.units.find(u=>u.id==='enemy-8');
 assert.deepEqual(fixture.sharedContacts,[sighting]);
 assert.equal(sighting.hp,46);assert.equal(canSee(battle,unit,sighting),false);
 assert.equal(teamCanSee(battle,unit.side,sighting),true);assert.equal(hasLineOfSight(battle,unit,sighting),true);
 assert.equal(unit.lastKnownEnemy??null,null);assert.equal(unit.lastHeardNoise??null,null);assert.equal(unit.patrolOrigin??null,null);
 assert.equal(fixture.automatic,null);assert.equal(provenance.capture.controllerReturnValue,null);
 return {battle,unit,sighting};
};

test('the actual post-prone Cordoba witness retains the original native and ordinary personal-sight null',()=>{
 const {battle,unit}=witness(),original=structuredClone(battle);
 const automatic=chooseEnemyAction(battle,unit),ordinary=combatOrder(battle,unit);
 record('original-native-null-control.json',{before:battle,automatic,ordinary,nativeChooserInvocations:2,ordinaryControllerInvocations:1,nativeActionInvocations:0});
 assert.deepEqual(automatic,fixture.automatic);
 assert.equal(ordinary,null,'ordinary priorities retain the original hold');
 assert.deepEqual(battle,original,'the native chooser does not change the raw witness');
});

test('the actual shared sighting admits one finite native investigation move while the soldier stays prone',()=>{
 const {battle,unit}=witness(),original=structuredClone(battle);
 let action,path,after,failure,nativeActionInvocations=0;
 try{
  assert.equal(combatOrder(battle,unit),null,'the optional policy cannot replace the ordinary controller');
  action=sharedSightingInvestigationOrder(battle,unit);
  assert.deepEqual(battle,original,'shared investigation cannot write remembered contact or equipment');
  assert.deepEqual(action,{type:'move',unitId:'124',x:62,y:27,tacticalLevel:0});
  const observed=point=>teamCanSee(battle,unit.side,point);
  const planning={...battle,units:battle.units.filter(v=>v.side===unit.side||observed(v)),npcs:(battle.npcs??[]).filter(observed)};
  path=getReachable(planning,unit,{stopAt:point=>sameCell(point,action)})[0];
  assert.ok(path&&path.cost>0&&path.cost<=24&&path.path.length>0&&path.path.length<=3);
  const costs=actionCosts(battle,unit);
  assert.ok(unit.ap-path.cost>=costs.fire+costs.aim*2,'the native investigation retains its attack reserve');
  nativeActionInvocations++;
  after=actBattle(battle,action);
  assert.equal(after.lastError,null,JSON.stringify(action));
  const moved=after.units.find(u=>u.id===unit.id);
  assert.ok(sameCell(moved,action));assert.deepEqual(moved.lastMovePath,path.path);
  assert.equal(moved.ap,unit.ap-path.cost,'native movement charges the real prone route');
  let from=unit,energy=0;
  for(const step of path.path){
   const diagonal=from.x!==step.x&&from.y!==step.y?1.4:1;
   energy+=Math.ceil(movementEnergy(unit,surfaceAt(battle,step))*diagonal);from=step;
  }
  assert.equal(moved.energy,unit.energy-energy,'native movement spends finite energy');
  assert.equal(moved.stance,'prone');assert.equal(moved.movementMode,'prone');
  for(const key of ['loaded','ammo','medkits','weapon','condition','inventory','weaponFittings'])assert.deepEqual(moved[key],unit[key],key);
  assert.equal(after.elapsedSeconds,battle.elapsedSeconds,'this combat move retains the native round clock');
  assert.equal(Object.hasOwn(after,'actionDurationSeconds'),false,'the native reducer removes transient action duration');
  assert.equal(Object.hasOwn(after,'actionTimeAppliedSeconds'),false,'the native reducer removes transient time accounting');
  assert.equal(after.turn,battle.turn);assert.equal(after.status,'active');
  for(const before of battle.units){
   const current=after.units.find(u=>u.id===before.id);
   assert.ok(current.hp<=before.hp,'movement grants no healing or revival');
   if(before.hp<=0)assert.equal(current.hp,before.hp,'the earned casualty remains');
  }
  assert.deepEqual(battle,original,'native execution does not change its input');
 }catch(error){failure={name:error.name,code:error.code??null,message:error.message};throw error;}
 finally{record('corrected-native-investigation-control.json',{before:battle,action,path,after,failure,ordinaryControllerInvocations:1,optionalFallbackInvocations:1,nativeActionInvocations});}
});

test('a custom whole-squad hold keeps the actual earned battle unchanged without implicit shared investigation',()=>{
 const {battle}=witness(),original=structuredClone(battle),consulted=[];
 const controller=(state,unit)=>{assert.equal(state,battle);consulted.push(unit.id);return null;};
 const result=openingControlWindow(battle,{controller});
 assert.equal(consulted.length,battle.units.filter(u=>u.side==='player'&&!u.militia).length,'every current eligible player receives its explicit hold');
 assert.deepEqual(result.orders,[]);assert.equal(result.actions,0);assert.equal(result.sharedInvestigation,null);
 assert.deepEqual(result.battle,original);assert.deepEqual(battle,original);
 record('custom-hold-scheduling-control.json',{before:battle,consulted,result,nativeActionInvocations:0});
});

test('an explicit shared callback gets one paid bound after the whole squad holds, then yields native control',()=>{
 const {battle}=witness(),original=structuredClone(battle),ordinaryConsulted=[],fallbackConsulted=[];
 let result,failure,nextProposal;
 try{
  result=openingControlWindow(battle,{
   controller:(state,unit)=>{assert.equal(state,battle);ordinaryConsulted.push(unit.id);return null;},
   sharedFallback:(state,unit)=>{
    assert.equal(ordinaryConsulted.length,12,'all actual players receive their ordinary decision before any shared proposal');
    fallbackConsulted.push(unit.id);return sharedSightingInvestigationOrder(state,unit);
   },
  });
  assert.deepEqual(ordinaryConsulted,['137','113','124','120','136','134','141','111','125','127','117','119']);
  assert.deepEqual(fallbackConsulted,['137','113','124']);
  assert.equal(result.actions,1,'one shared bound ends the control window');
  assert.deepEqual(result.orders,[{type:'move',unitId:'124',x:62,y:27,tacticalLevel:0}]);
  assert.deepEqual(result.sharedInvestigation,result.orders[0]);
  const moved=result.battle.units.find(u=>u.id==='124');
  assert.deepEqual({x:moved.x,y:moved.y,ap:moved.ap,energy:moved.energy,stance:moved.stance,loaded:moved.loaded,ammo:moved.ammo,medkits:moved.medkits},
   {x:62,y:27,ap:62,energy:73,stance:'prone',loaded:1,ammo:9,medkits:2});
  assert.equal(result.battle.turn,battle.turn);assert.equal(result.battle.phase,battle.phase);assert.equal(result.battle.elapsedSeconds,battle.elapsedSeconds);
  for(const before of battle.units){const after=result.battle.units.find(u=>u.id===before.id);assert.equal(after.hp,before.hp);assert.equal(after.bleeding,before.bleeding);}
  nextProposal=sharedSightingInvestigationOrder(result.battle,moved);
  assert.equal(nextProposal?.type,'move','the cap yields even while another native paid bound is available');
  assert.deepEqual(battle,original);
 }catch(error){failure={name:error.name,code:error.code??null,message:error.message};throw error;}
 finally{record('explicit-one-bound-scheduling-control.json',{before:battle,ordinaryConsulted,fallbackConsulted,result,nextProposal,nextProposalExecuted:false,failure});}
});

test('the actual stock common13 boundary schedules the available ordinary shot before shared investigation',()=>{
 const battle=structuredClone(priorityFixture),original=structuredClone(battle);
 assert.equal(priorityProvenance.acceptedOrders,13);assert.equal(priorityProvenance.commonOrdersByteEquivalent,true);
 assert.equal(priorityProvenance.recordedUnexecutedNextOrders.executed,false);
 assert.deepEqual({sector:battle.sectorId,turn:battle.turn,phase:battle.phase,status:battle.status,elapsed:battle.elapsedSeconds,seed:battle.seed},
  {sector:'san_nicolas',turn:1,phase:'player',status:'active',elapsed:109,seed:2591988814});
 const shooter=battle.units.find(u=>u.id==='123'),scout=battle.units.find(u=>u.id==='1000');
 assert.deepEqual({x:shooter.x,y:shooter.y,hp:shooter.hp,ap:shooter.ap,loaded:shooter.loaded,ammo:shooter.ammo,stance:shooter.stance},
  {x:42,y:38,hp:83,ap:74,loaded:1,ammo:9,stance:'prone'});
 assert.deepEqual({x:scout.x,y:scout.y,hp:scout.hp,ap:scout.ap,loaded:scout.loaded,ammo:scout.ammo,stance:scout.stance},
  {x:43,y:42,hp:85,ap:76,loaded:1,ammo:9,stance:'prone'});
 let result,failure,unexecutedSharedProposal;
 try{
  unexecutedSharedProposal=sharedSightingInvestigationOrder(battle,scout);
  assert.deepEqual(unexecutedSharedProposal,priorityProvenance.recordedUnexecutedNextOrders.current,'the competing paid shared move exists in the actual earned state');
  result=openingControlWindow(battle,{controller:hiredAssaultOrder,sharedFallback:sharedSightingInvestigationOrder});
  const first=result.orders[0];
  assert.deepEqual({...first,hitLocation:first?.hitLocation??'torso'},priorityProvenance.recordedUnexecutedNextOrders.original,
   'the real loaded ordinary shot wins before the shared move');
  assert.ok(result.actions>0&&result.actions<=16*6+1,'this control is bounded to one six-actor native window');
  if(result.sharedInvestigation)assert.deepEqual(result.orders.at(-1),result.sharedInvestigation,'a shared bound ends the window');
  assert.equal(result.battle.lastError,null);assert.deepEqual(battle,original,'the reducer preserves its raw input');
  for(const before of battle.units){const after=result.battle.units.find(u=>u.id===before.id);assert.ok(after.hp<=before.hp,'scheduling grants no healing or revival');if(before.hp<=0)assert.equal(after.hp,before.hp);}
 }catch(error){failure={name:error.name,code:error.code??null,message:error.message};throw error;}
 finally{record('stock-common13-ordinary-priority-control.json',{before:battle,unexecutedSharedProposal,unexecutedSharedProposalIsNotAnExtraOrder:true,result,failure});}
});

// Declared finite tactical arena only. The physician sees an opponent beyond
// the prone guard's personal sight and pistol flight range. This is not an
// earned counterattack win. A useful ordinary team-sighted shot must act first.
function reliefArena(guardFields={},geometry={}){
 const width=32,height=12,kit={hp:80,maxHp:80,energy:100,weapon:1800,loaded:1,ammo:9,condition:100,medical:0,medkits:0,stance:'prone',movementMode:'prone',facing:2,overwatch:false};
 const players=[
  {...kit,id:'301',name:'Armed guard',x:1,y:6,marksmanship:80,weapon:1805,...guardFields},
  {...kit,id:'302',name:'Observing physician',x:10,y:5,marksmanship:50,medical:90},
  {...kit,id:'303',name:'Rear physician',x:1,y:8,marksmanship:40,medical:90},
  {...kit,id:'304',name:'Unarmed reserve',x:1,y:10,marksmanship:30,weapon:1813,blade:1813,loaded:0,ammo:0},
 ];
 const battle=createBattle(players,{id:'declared-northern-shared-contact',width,height,seed:42,exploration:false,deferContact:true,
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'e',name:'Declared opponent',x:18,y:6,hp:100,maxHp:100,weapon:1800,loaded:1,ammo:3,facing:6,patrol:false,overwatch:false}],
  artillery:[{id:'declared-finite-gun',type:'bronze4',side:'player',x:27,y:2,loaded:true,ammo:4}],
  ...geometry,
 });
 return validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));
}
const reliefActor=(battle,id='301')=>battle.units.find(unit=>unit.id===id);
function reliefReplay(start,result){
 assert.equal(start.mode,'combat');assert.equal(start.roundTimeCharged,false,'the fresh arena has not paid its first combat round');assert.ok(result.orders.length>0);
 let ordinary=structuredClone(start),presented=structuredClone(start),restored=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of result.orders){
  const elapsed=ordinary.elapsedSeconds,charge=ordinary.roundTimeCharged?0:COMBAT_ROUND_SECONDS;
  ordinary=actBattle(ordinary,action);assert.equal(ordinary.lastError,null,JSON.stringify(action));
  assert.equal(ordinary.elapsedSeconds,elapsed+charge,'the first accepted combat order pays the round once');assert.equal(ordinary.roundTimeCharged,true);
  presented=presentedActBattle(presented,action).state;assert.deepEqual(presented,ordinary);
  restored=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(restored,action))));assert.deepEqual(restored,ordinary);
 }
 assert.deepEqual(result.battle,ordinary);assert.deepEqual(result.battle.artillery,start.artillery);
 assert.equal(result.battle.turn,start.turn);assert.equal(result.battle.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);
 return ordinary;
}

test('a declared northern guard pays one shared bound after the actual physicians and unarmed reserve hold',t=>{
 const battle=reliefArena(),before=structuredClone(battle),guard=reliefActor(battle),target=reliefActor(battle,'e');
 const controller=northernReliefDefenseController([302,303]);assert.equal(typeof controller.sharedFallback,'function');
 assert.equal(canSee(battle,guard,target),false);assert.equal(teamCanSee(battle,'player',target),true);assert.equal(hasLineOfSight(battle,guard,target),true);
 assert.ok(shotChance(battle,guard,target,4)<25,'the declared short pistol has no useful ordinary team-sighted shot');
 for(const unit of battle.units.filter(unit=>unit.side==='player'))assert.equal(controller(battle,unit),null,'the whole ordinary pass has no admitted work');
 const proposal=sharedSightingInvestigationOrder(battle,guard);assert.equal(proposal?.type,'move');
 assert.deepEqual(controller.sharedFallback(battle,guard),proposal);
 const result=openingControlWindow(battle,{controller,sharedFallback:controller.sharedFallback});
 assert.deepEqual(result.orders,[proposal]);assert.equal(result.actions,1);assert.deepEqual(result.sharedInvestigation,proposal);
 const route=getReachable(battle,guard).find(point=>sameCell(point,proposal));assert.ok(route&&route.cost>0&&route.cost<=24&&route.path.length<=3);
 const after=reliefReplay(battle,result),moved=reliefActor(after);
 assert.equal(moved.ap,guard.ap-route.cost);assert.ok(moved.energy<guard.energy);assert.equal(moved.stance,'prone');
 for(const key of ['hp','bleeding','loaded','ammo','medkits','inventory','condition'])assert.deepEqual(moved[key],guard[key],key);
 for(const id of ['302','303','304'])for(const key of ['x','y','ap','hp','bleeding','energy','loaded','ammo','medkits','inventory'])assert.deepEqual(reliefActor(after,id)[key],reliefActor(battle,id)[key],`${id} ${key}`);
 assert.deepEqual(battle,before);t.diagnostic(JSON.stringify({scope:'Declared shared-contact guard scheduling only; no campaign victory',orders:result.orders,paidAP:route.cost,finiteGunCharges:5,nativePresentedSnapshotReplay:true}));
});

test('actually wounded northern support retains ordinary work but holds instead of a blind shared advance',()=>{
 const battle=reliefArena({hp:64,bandaged:16}),before=structuredClone(battle),guard=reliefActor(battle),controller=northernReliefDefenseController([302,303]);
 assert.equal(guard.hp,64);assert.equal(guard.maxHp,80);assert.equal(guard.bleeding,0);
 assert.equal(canSee(battle,guard,reliefActor(battle,'e')),false);assert.equal(teamCanSee(battle,'player',reliefActor(battle,'e')),true);
 assert.equal(sharedSightingInvestigationOrder(battle,guard)?.type,'move','the public native bound exists but this wounded support must not take it');
 assert.deepEqual(controller(battle,guard),cautiousCombatOrder(battle,guard),'ordinary finite work retains its original priority');
 assert.equal(controller.sharedFallback(battle,guard),null);
 const result=openingControlWindow(battle,{controller,sharedFallback:controller.sharedFallback});
 assert.deepEqual(result.orders,[]);assert.equal(result.actions,0);assert.equal(result.sharedInvestigation,null);assert.deepEqual(result.battle,before);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(result.battle))),before);assert.deepEqual(battle,before);
});

test('a clinic shared bound waits for three physically quiet native rounds and resets for exact replay',()=>{
 const start=reliefArena({}, {enemies:[{id:'e',x:18,y:6,hp:100,maxHp:100,weapon:1800,loaded:1,ammo:3,facing:2,patrol:false,overwatch:false}]}),before=structuredClone(start);
 const controller=northernReliefDefenseController([302,303],{minimumIdleRounds:3});
 const execute=input=>{
  let battle=input;const orders=[];
  for(let quiet=0;quiet<3;quiet++){
   const held=openingControlWindow(battle,{controller,sharedFallback:controller.sharedFallback});assert.deepEqual(held.orders,[]);assert.deepEqual(held.battle,battle);
   const next=endTurn(battle);assert.equal(next.lastError,null);assert.equal(next.turn,battle.turn+1);assert.equal(next.status,'active');orders.push({type:'endTurn'});battle=next;
  }
  const result=openingControlWindow(battle,{controller,sharedFallback:controller.sharedFallback});assert.equal(result.actions,1);assert.deepEqual(result.orders,[result.sharedInvestigation]);assert.equal(result.sharedInvestigation?.type,'move');
  const guard=reliefActor(battle),moved=reliefActor(result.battle),path=getReachable(battle,guard).find(point=>sameCell(point,result.sharedInvestigation));
  assert.ok(path&&path.cost>0);assert.equal(moved.ap,guard.ap-path.cost);assert.ok(moved.energy<guard.energy);
  for(const actor of battle.units)for(const key of ['hp','bleeding','ammo','loaded','medkits','inventory'])assert.deepEqual(result.battle.units.find(unit=>unit.id===actor.id)[key],actor[key]);
  assert.deepEqual(result.battle.artillery,start.artillery);return {battle:result.battle,orders:[...orders,...result.orders]};
 };
 const first=execute(start),replayed=execute(validateBattleSnapshot(JSON.parse(JSON.stringify(start))));assert.deepEqual(replayed,first);assert.deepEqual(start,before);
});

test('real public physical progress resets quiet rounds while unseen opposing positions do not',()=>{
 const start=reliefArena({}, {enemies:[{id:'e',x:18,y:6,hp:100,maxHp:100,weapon:1800,loaded:1,ammo:3,facing:2,patrol:false,overwatch:false},{id:'hidden',x:31,y:11,hp:100,maxHp:100,weapon:1813,loaded:0,ammo:0,facing:2,patrol:false,overwatch:false}]}),before=structuredClone(start),controller=northernReliefDefenseController([302,303],{minimumIdleRounds:3});
 let battle=start;
 for(let quiet=0;quiet<3;quiet++){assert.equal(controller.sharedFallback(battle,reliefActor(battle)),null);battle=endTurn(battle);assert.equal(battle.lastError,null);}
 const ordinary={type:'move',unitId:'301',x:2,y:5,tacticalLevel:0},progressed=actBattle(battle,ordinary);assert.equal(progressed.lastError,null);assert.ok(!sameCell(reliefActor(progressed),reliefActor(battle)));assert.equal(controller.sharedFallback(progressed,reliefActor(progressed)),null,'actual own movement resets the stall');
 assert.equal(teamCanSee(progressed,'player',reliefActor(progressed,'hidden')),false);
 const hidden=structuredClone(progressed);Object.assign(reliefActor(hidden,'hidden'),{x:31,y:10});assert.equal(teamCanSee(hidden,'player',reliefActor(hidden,'hidden')),false);
 assert.equal(controller.sharedFallback(hidden,reliefActor(hidden)),null,'an unseen coordinate cannot alter the same-round hold');assert.deepEqual(start,before);
});

test('a standing northern guard investigates a current public contact around a wall with one paid native bound',()=>{
 const width=32,height=12,tiles=Array.from({length:width*height},(_,i)=>{const x=i%width,y=Math.floor(i/width),blocked=x===5&&y>=2&&y<=8;return {x,y,type:blocked?'wall':'grass',blocked,blocksSight:blocked,cover:blocked?40:0};});
 const battle=reliefArena({x:2,stance:'standing',movementMode:'walk'},{tiles}),before=structuredClone(battle),guard=reliefActor(battle),target=reliefActor(battle,'e'),controller=northernReliefDefenseController([302,303]);
 assert.equal(canSee(battle,guard,target),false);assert.equal(hasLineOfSight(battle,guard,target),false);assert.equal(teamCanSee(battle,'player',target),true);assert.equal(controller(battle,guard),null);
 assert.equal(sharedSightingInvestigationOrder(battle,guard),null,'the existing generic hold policy is unchanged');
 const proposal=choosePlayerSharedSightingInvestigation(battle,guard,target);assert.equal(proposal?.type,'move');assert.deepEqual(controller.sharedFallback(battle,guard),proposal);
 const result=openingControlWindow(battle,{controller,sharedFallback:controller.sharedFallback});assert.deepEqual(result.orders,[proposal]);assert.equal(result.actions,1);
 const route=getReachable(battle,guard).find(point=>sameCell(point,proposal));assert.ok(route&&route.cost>0&&route.cost<=24&&route.path.length<=3);
 const after=reliefReplay(battle,result),moved=reliefActor(after);assert.equal(moved.ap,guard.ap-route.cost);assert.ok(moved.energy<guard.energy);assert.equal(moved.stance,'standing');
 for(const key of ['hp','bleeding','loaded','ammo','medkits','inventory'])assert.deepEqual(moved[key],guard[key]);
 for(const id of ['302','303','304'])for(const key of ['x','y','ap','hp','energy','loaded','ammo','medkits'])assert.deepEqual(reliefActor(after,id)[key],reliefActor(battle,id)[key]);
 assert.deepEqual(battle,before);
});

test('a public look pays an actual direction change and cannot repeat the same look without progress',()=>{
 const battle=reliefArena({facing:6}),before=structuredClone(battle),guard=reliefActor(battle),controller=northernReliefDefenseController([302,303]);assert.equal(controller(battle,guard),null);
 const result=openingControlWindow(battle,{controller,sharedFallback:controller.sharedFallback}),look=result.sharedInvestigation;assert.equal(look?.type,'look');assert.deepEqual(result.orders,[look]);
 const cost=turnAPCost(guard,directionTo(guard,look));assert.ok(cost>0);const after=reliefReplay(battle,result),turned=reliefActor(after);assert.equal(turned.ap,guard.ap-cost);assert.equal(turned.facing,directionTo(guard,look));
 assert.notDeepEqual(controller.sharedFallback(after,turned),look,'the same paid orientation is not a second progress action');assert.deepEqual(battle,before);
});

test('current public investigation keeps physicians and empty reserves still and ignores unseen opposing coordinates',()=>{
 const battle=reliefArena({stance:'standing',movementMode:'walk'}),before=structuredClone(battle),controller=northernReliefDefenseController([302,303]),target=reliefActor(battle,'e');
 const physician=reliefActor(battle,'303');assert.ok(choosePlayerSharedSightingInvestigation(battle,physician,target));assert.equal(controller.sharedFallback(battle,physician),null);assert.equal(controller.sharedFallback(battle,reliefActor(battle,'304')),null);
 const hidden=reliefArena({stance:'standing',movementMode:'walk'},{enemies:[{id:'e',x:31,y:11,weapon:1800,loaded:1,ammo:3,patrol:false,overwatch:false}]}),hiddenBefore=structuredClone(hidden);assert.equal(teamCanSee(hidden,'player',reliefActor(hidden,'e')),false);
 assert.equal(controller.sharedFallback(hidden,reliefActor(hidden)),null);
 const moved=structuredClone(hidden);Object.assign(reliefActor(moved,'e'),{x:31,y:10});assert.equal(teamCanSee(moved,'player',reliefActor(moved,'e')),false);assert.equal(controller.sharedFallback(moved,reliefActor(moved)),null);
 assert.deepEqual(hidden,hiddenBefore);assert.deepEqual(battle,before);
});

function reliefCrewArena(loaded=true,helperFields={}){
 const width=20,height=12,kit={hp:80,maxHp:80,energy:100,weapon:1805,loaded:1,ammo:9,marksmanship:1,medical:0,medkits:0,stance:'standing',movementMode:'walk',facing:2,overwatch:false};
 return validateBattleSnapshot(createBattle([{...kit,id:'301',x:2,y:2},{...kit,id:'305',x:1,y:3,...helperFields},{...kit,id:'302',x:8,y:9,medical:90},{...kit,id:'304',x:8,y:10,weapon:1813,loaded:0,ammo:0}],{
  id:'declared-northern-adjacent-crew',width,height,seed:42,exploration:false,deferContact:true,tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'e',x:14,y:3,hp:300,maxHp:300,weapon:1813,loaded:0,ammo:0,patrol:false,overwatch:false}],artillery:[{id:'declared-finite-gun',type:'bronze4',side:'player',x:2,y:3,facing:0,loaded,ammo:2}],
 }));
}
for(const loaded of [true,false])test(`ordinary adjacent northern cannon ${loaded?'fire':'reload'} pays its real crew before public investigation`,()=>{
 const battle=reliefCrewArena(loaded),before=structuredClone(battle),operator=reliefActor(battle),controller=northernReliefDefenseController([302]),action=controller(battle,operator),gun=battle.artillery[0];
 assert.equal(action?.type,loaded?'artillery':'artilleryReload');
 const plan=loaded?{...artilleryCrewPlan(battle,operator,gun,artilleryCosts(battle,operator,gun).fire),pa:artilleryCosts(battle,operator,gun).fire}:artilleryReloadPreview(battle,operator,gun);assert.equal(plan.reason,null);assert.deepEqual([...plan.crew].sort(),['301','305']);
 const after=actBattle(battle,action);assert.equal(after.lastError,null);assert.deepEqual(presentedActBattle(battle,action).state,after);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),action)))),after);
 for(const id of plan.crew){const old=reliefActor(battle,id),current=reliefActor(after,id);assert.equal(current.ap,old.ap-plan.pa);for(const key of ['x','y','hp','loaded','ammo','medkits','inventory'])assert.deepEqual(current[key],old[key]);}
 for(const id of ['302','304'])for(const key of ['x','y','ap','hp','energy','loaded','ammo','medkits'])assert.deepEqual(reliefActor(after,id)[key],reliefActor(battle,id)[key]);
 const actual=after.artillery[0];assert.equal(actual.id,gun.id);assert.deepEqual([actual.x,actual.y],[gun.x,gun.y]);assert.equal(actual.ammo,gun.ammo-(loaded?0:plan.rounds));assert.equal(actual.loaded,loaded?false:Boolean(plan.rounds));if(!loaded)assert.equal(actual.reloadProgress,plan.progress||undefined);assert.equal(after.elapsedSeconds,battle.elapsedSeconds+COMBAT_ROUND_SECONDS);assert.deepEqual(battle,before);
});

test('a native cannon crew cannot spend a held physician or empty reserve as its selected helper',()=>{
 for(const held of ['physician','empty']){
  const start=reliefCrewArena(true,held==='empty'?{loaded:0,ammo:0}:{}),before=structuredClone(start),controller=northernReliefDefenseController(held==='physician'?[302,305]:[302]),operator=reliefActor(start),ordinary=cautiousCombatOrder(start,operator);
  assert.equal(ordinary?.type,'artillery');assert.equal(controller(start,operator),null);
  const helper=reliefActor(start,'305'),hold=controller(start,helper);assert.deepEqual(hold,{type:'stance',unitId:'305',stance:'prone'});
  const after=actBattle(start,hold);assert.equal(after.lastError,null);assert.equal(reliefActor(after,'305').ap,helper.ap-stanceCost(helper,'prone'));assert.equal(reliefActor(after,'305').stance,'prone');assert.deepEqual(after.artillery,start.artillery);
  for(const old of start.units.filter(unit=>unit.side==='player'))for(const key of ['x','y','hp','energy','loaded','ammo','medkits','inventory'])assert.deepEqual(reliefActor(after,old.id)[key],old[key]);
  assert.equal(reliefActor(after).ap,operator.ap);assert.equal(after.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);assert.equal(after.seed,start.seed);
  assert.deepEqual(presentedActBattle(start,hold).state,after);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(start))),hold)))),after);
  assert.deepEqual(start,before);
 }
});

test('the northern callback excludes a physician with a real shared route and an unarmed reserve',()=>{
 const battle=reliefArena(),before=structuredClone(battle),controller=northernReliefDefenseController([302,303]),physician=reliefActor(battle,'303'),unarmed=reliefActor(battle,'304');
 assert.equal(sharedSightingInvestigationOrder(battle,physician)?.type,'move','this exclusion must not rely on an unavailable route');
 assert.equal(controller.sharedFallback(battle,physician),null);assert.equal(controller.sharedFallback(battle,unarmed),null);
 assert.equal(controller(battle,physician),null);assert.equal(controller(battle,unarmed),null);assert.deepEqual(battle,before);
});

test('a useful ordinary northern team-sighted musket shot takes precedence over shared movement',()=>{
 const battle=reliefArena({weapon:1800}),before=structuredClone(battle),guard=reliefActor(battle),target=reliefActor(battle,'e'),controller=northernReliefDefenseController([302,303]);
 assert.equal(canSee(battle,guard,target),false);assert.equal(teamCanSee(battle,'player',target),true);assert.ok(shotChance(battle,guard,target,4)>=25);
 const shot=controller(battle,guard);assert.equal(shot?.type,'fire');assert.equal(shot.unitId,guard.id);assert.equal(shot.targetId,target.id);
 const result=openingControlWindow(battle,{controller,sharedFallback:controller.sharedFallback});assert.deepEqual(result.orders[0],shot);
 reliefReplay(battle,result);assert.deepEqual(battle,before);
});

for(const phase of ['reload','aid'])test(`ordinary finite northern ${phase} completes before ${phase==='reload'?'a shared investigation bound':'wounded support holds'}`,()=>{
 const battle=reliefArena(phase==='reload'?{loaded:0}:{hp:60,bleeding:4,medical:50,medkits:2}),before=structuredClone(battle),controller=northernReliefDefenseController([302,303]);
 assert.ok(shotChance(battle,reliefActor(battle),reliefActor(battle,'e'),4)<25,'the declared pistol holds after ordinary finite work');
 assert.equal(controller.sharedFallback(battle,reliefActor(battle)),null,'empty or bleeding guards have no shared fallback');
 const result=openingControlWindow(battle,{controller,sharedFallback:controller.sharedFallback});
 if(phase==='reload')assert.equal(result.orders[0]?.type,'reload');
 else assert.deepEqual(result.orders.slice(0,2),[{type:'weapon',unitId:'301',slot:'medical'},{type:'useItem',unitId:'301',targetId:'301'}]);
 if(phase==='reload'){assert.ok(result.sharedInvestigation,'the later healthy idle guard receives its one shared bound');assert.deepEqual(result.orders.at(-1),result.sharedInvestigation);}
 else assert.equal(result.sharedInvestigation,null,'finite bleeding aid does not make the still-wounded support fit for a blind advance');
 const after=reliefReplay(battle,result),old=reliefActor(battle),guard=reliefActor(after);
 if(phase==='reload'){assert.equal(guard.loaded,1);assert.equal(guard.ammo,old.ammo-1);assert.equal(guard.medkits,old.medkits);}
 else{assert.equal(guard.medkits,old.medkits-1);assert.equal(guard.bleeding,0);assert.equal(guard.hp,old.hp);assert.equal(guard.loaded,old.loaded);assert.equal(guard.ammo,old.ammo);assert.ok(guard.hp<guard.maxHp);assert.equal(sameCell(guard,old),true);}
 assert.equal(after.seed,battle.seed);assert.deepEqual(battle,before);
});
