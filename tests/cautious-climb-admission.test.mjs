import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,canSee,teamCanSee,climbPreview,actionCosts,reloadPlan} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {sameCell} from '../game/tactical-space.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {COMBAT_ROUND_SECONDS} from '../game/time.js';
import {cautiousCombatOrder} from './cautious-driver.mjs';

const access={id:'declared-access',kind:'climb',from:{x:3,y:4,tacticalLevel:0},to:{x:4,y:4,tacticalLevel:1}};
const actor=(battle,id='guard')=>battle.units.find(unit=>unit.id===id);
const rounds=unit=>Object.values(unitAmmunitionByType(unit)).reduce((sum,count)=>sum+count,0);
const physical=unit=>Object.fromEntries(['hp','maxHp','bleeding','bandaged','medkits','weapon','blade','loaded','ammo','inventory','condition','weaponInstanceId'].map(key=>[key,structuredClone(unit[key])]));

function arena({blocked=false,observer=false,descending=false,care=false,fire=false,reload=false}={}){
 const width=16,height=10;
 const tiles=Array.from({length:width*height},(_,index)=>({x:index%width,y:Math.floor(index/width),type:'grass',blocked:false,cover:0}));
 // A real solid partition keeps the distant, finite opponent out of sight.
 // Every body, remembered position and surface belongs to this new declared
 // component arena before the factory. No campaign checkpoint is an input.
 for(const tile of tiles.filter(tile=>tile.x===10))Object.assign(tile,{type:'stone',blocked:true,blocksSight:true,obstacleHeight:10,material:'stone'});
 const upperSurfaces=Array.from({length:12},(_,index)=>({id:`declared-roof:${index}`,x:4+index%4,y:4+Math.floor(index/4),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0}));
 const guard={id:'guard',x:fire?5:descending?4:3,y:4,tacticalLevel:fire||descending?1:0,
  hp:80,maxHp:80,energy:100,morale:90,weapon:fire||reload?1800:1809,blade:1809,
  loaded:fire?1:0,ammo:reload?2:fire?3:0,medical:care?70:0,medkits:care?2:0,
  activeSlot:care?'medical':'primary',stance:'standing',movementMode:'walk',facing:fire?0:2,
  marksmanship:90,overwatch:false,patrol:false,
  lastKnownEnemy:{x:descending?1:6,y:descending?4:5,tacticalLevel:descending?0:1,turn:1}};
 const players=[guard,
  ...(observer?[{id:'observer',x:5,y:4,tacticalLevel:1,hp:80,maxHp:80,weapon:1809,loaded:0,ammo:0,medical:0,medkits:0,facing:6,overwatch:false,patrol:false}]:[]),
  ...(care?[{id:'patient',x:3,y:5,hp:9,maxHp:80,bandaged:71,bleeding:0,weapon:1809,loaded:0,ammo:0,medical:0,medkits:0,overwatch:false,patrol:false}]:[]),
 ];
 const enemies=[{id:'distant',x:fire?5:15,y:fire?2:9,hp:200,maxHp:200,weapon:1809,loaded:0,ammo:0,medical:0,medkits:0,patrol:false,overwatch:false},
  ...(blocked?[{id:'blocker',x:4,y:4,tacticalLevel:1,hp:80,maxHp:80,weapon:1809,loaded:0,ammo:0,medical:0,medkits:0,stance:'prone',movementMode:'prone',facing:2,patrol:false,overwatch:false}]:[]),
 ];
 const declaration={players,sector:{id:'declared-cautious-climb',width,height,tiles,upperSurfaces,climbLinks:[structuredClone(access)],seed:45,hour:12,exploration:false,deferContact:true,enemies}};
 const before=structuredClone(declaration),battle=createBattle(declaration.players,declaration.sector);
 assert.deepEqual(declaration,before);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);
 return battle;
}

function successfulReplay(start,orders){
 let direct=structuredClone(start),presented=structuredClone(start),saved=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  const before=structuredClone(direct),next=actBattle(direct,action);
  assert.equal(next.lastError,null,`${JSON.stringify(action)}: ${next.lastError}`);assert.deepEqual(direct,before);
  presented=presentedActBattle(presented,JSON.parse(JSON.stringify(action))).state;assert.deepEqual(presented,next);
  saved=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(saved,JSON.parse(JSON.stringify(action))))));assert.deepEqual(saved,next);
  direct=next;
 }
 return direct;
}

for(const observer of [false,true])test(`a ${observer?'team-known':'wholly unseen'} occupied climb landing holds at the current public quote`,()=>{
 const start=arena({blocked:true,observer}),before=structuredClone(start),guard=actor(start),blocker=actor(start,'blocker');
 assert.equal(canSee(start,guard,blocker),false);assert.equal(teamCanSee(start,'player',blocker),observer);
 const intended=chooseEnemyAction(start,guard);assert.deepEqual(intended,{type:'climb',unitId:'guard',linkId:access.id});
 const quote=climbPreview(start,guard,intended);assert.equal(quote.valid,false);assert.equal(quote.reason,'El acceso está bloqueado.');
 for(let callback=0;callback<3;callback++)assert.equal(cautiousCombatOrder(start,guard),null);
 assert.deepEqual(start,before,'planning and the guard cannot spend a paid action or change hidden identities');
 // This one intentional Native refusal is terminal. Inspect its plain data
 // only; never query, replay, validate or save a rejected result as game input.
 const refused=actBattle(start,intended);assert.equal(refused.lastError,quote.reason);
 for(const key of ['units','artillery','tiles','upperSurfaces','climbLinks','seed','turn','elapsedSeconds'])assert.deepEqual(refused[key],before[key],key);
 assert.deepEqual(start,before);
});

for(const descending of [false,true])test(`a clear ${descending?'descending':'ascending'} landing keeps the exact choice and pays a real Native climb`,()=>{
 const start=arena({descending}),before=structuredClone(start),guard=actor(start),intended=chooseEnemyAction(start,guard),action=cautiousCombatOrder(start,guard);
 assert.deepEqual(intended,{type:'climb',unitId:'guard',linkId:access.id});assert.deepEqual(action,intended);
 const quote=climbPreview(start,guard,action);assert.equal(quote.valid,true,quote.reason);assert.equal(quote.pa,descending?15:20);
 const after=successfulReplay(start,[action]),moved=actor(after);
 assert.ok(sameCell(moved,descending?access.from:access.to));assert.equal(moved.ap,guard.ap-quote.pa);assert.equal(moved.energy,guard.energy-quote.energy);
 assert.equal(after.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);assert.equal(after.turn,start.turn);
 for(const unit of start.units)assert.deepEqual(physical(actor(after,unit.id)),physical(unit));
 for(const key of ['tiles','upperSurfaces','climbLinks','artillery','groundItems'])assert.deepEqual(after[key],start[key]);assert.deepEqual(start,before);
});

test('adjacent finite critical care remains before a remembered roof approach',()=>{
 const start=arena({care:true}),before=structuredClone(start),guard=actor(start),patient=actor(start,'patient');
 assert.equal(climbPreview(start,guard,{linkId:access.id}).valid,true);
 const action=cautiousCombatOrder(start,guard);assert.deepEqual(action,{type:'useItem',unitId:'guard',targetId:'patient'});assert.deepEqual(action,chooseEnemyAction(start,guard));
 const cost=actionCosts(start,guard),after=successfulReplay(start,[action]),doctor=actor(after);
 assert.equal(doctor.medkits,guard.medkits-1);assert.equal(doctor.ap,guard.ap-cost.heal);assert.ok(actor(after,'patient').hp>patient.hp);
 assert.ok(sameCell(doctor,guard));assert.equal(after.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);assert.deepEqual(start,before);
});

test('an actual visible finite shot remains before a climb or a roof-edge posture loop',()=>{
 const start=arena({fire:true}),before=structuredClone(start),guard=actor(start),target=actor(start,'distant');
 assert.equal(canSee(start,guard,target),true);assert.equal(canSee(start,{...guard,stance:'prone'},target),false);
 const action=cautiousCombatOrder(start,guard);assert.equal(action?.type,'fire');assert.equal(action.targetId,target.id);
 const cost=actionCosts(start,guard,target),after=successfulReplay(start,[action]),fired=actor(after);
 assert.equal(fired.ap,guard.ap-cost.fire-(action.aim??0)*cost.aim);assert.equal(fired.loaded,guard.loaded-1);assert.equal(rounds(fired),rounds(guard)-1);
 assert.equal(fired.stance,guard.stance);assert.ok(sameCell(fired,guard));assert.equal(fired.medkits,guard.medkits);assert.deepEqual(start,before);
});

test('finite reload remains before a remembered climb and uses the same actual Native payment',()=>{
 const start=arena({reload:true}),before=structuredClone(start),guard=actor(start),plan=reloadPlan(guard,start);
 const action=cautiousCombatOrder(start,guard);assert.deepEqual(action,{type:'reload',unitId:'guard'});assert.deepEqual(action,chooseEnemyAction(start,guard));
 assert.ok(plan.available>0&&plan.totalPA>0);const after=successfulReplay(start,[action]),loaded=actor(after);
 assert.equal(loaded.ap,guard.ap-plan.totalPA);assert.ok(loaded.loaded>guard.loaded);assert.equal(rounds(loaded),rounds(guard));
 assert.ok(sameCell(loaded,guard));assert.equal(loaded.medkits,guard.medkits);assert.deepEqual(start,before);
});
