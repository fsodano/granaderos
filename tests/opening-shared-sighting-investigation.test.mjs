import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {actBattle,actionCosts,canSee,teamCanSee,hasLineOfSight,getReachable,movementEnergy} from '../game/tactical.js';
import {sameCell,surfaceAt} from '../game/tactical-space.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {combatOrder,sharedSightingInvestigationOrder,openingControlWindow} from './opening-driver.mjs';
import {hiredAssaultOrder} from './hired-assault-driver.mjs';

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
