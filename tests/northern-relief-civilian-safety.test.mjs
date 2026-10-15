import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,firearmShotOptions,getReachable,actionCosts} from '../game/tactical.js';
import {firearmBystanderRisk} from '../game/firearm-bystander-risk.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {knownRouteCivilianShotSafety} from './route-fire-safety.mjs';
import {cautiousCombatOrder} from './cautious-driver.mjs';
import {northernReliefDefenseController} from './northern-relief-defense.mjs';

const actor=b=>b.units.find(u=>u.id==='shooter');
const civilianRisk=(b,u,action)=>{
 const target=b.units.find(t=>t.id===action.targetId),risk=firearmBystanderRisk(b,u,target,action.hitLocation??'torso');
 return [...risk.direct,...risk.scatter].some(body=>body.kind==='npc');
};
function field({npcs=[],alternative=false,weapon=1802,front={},actor:changed={}}={}){
 return createBattle([{id:'shooter',x:1,y:4,weapon,loaded:1,ammo:8,stance:'prone',marksmanship:90,dexterity:90,agility:90,...changed}],{
  id:'declared-relief-civilian-safety',width:20,height:12,seed:45,
  tiles:Array.from({length:240},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'front',x:8,y:4,hp:100,stance:'standing',patrol:false,overwatch:false,...front},...(alternative?[{id:'other',x:14,y:0,hp:100,stance:'standing',patrol:false,overwatch:false}]:[])],npcs,
 });
}
const resident=(x,y,other={})=>({id:'resident',name:'Habitante',x,y,hp:100,maxHp:100,civilianHealthVersion:1,energy:100,unconscious:false,stance:'standing',...other});
function actual(b,action){
 const before=structuredClone(b),result=actBattle(b,action);assert.equal(result.lastError,null,JSON.stringify(action)+': '+result.lastError);
 assert.deepEqual(presentedActBattle(b,action).state,result);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(result))),result);assert.deepEqual(b,before);return result;
}

test('a safe ordinary relief shot retains its exact aim and body order and pays Native ammunition and AP',()=>{
 const b=field(),before=structuredClone(b),u=actor(b),ordinary=cautiousCombatOrder(b,u),selected=northernReliefDefenseController([])(b,u);
 assert.equal(ordinary.type,'fire');assert.deepEqual(selected,ordinary);assert.equal(civilianRisk(b,u,selected),false);
 const result=actual(b,selected),costs=actionCosts(b,u,b.units.find(t=>t.id===selected.targetId));
 assert.equal(actor(result).loaded,u.loaded-1);assert.equal(actor(result).ammo,u.ammo);assert.equal(actor(result).ap,u.ap-costs.fire-selected.aim*costs.aim);assert.ok(result.elapsedSeconds>b.elapsedSeconds);assert.deepEqual(b,before);
});

test('an unsafe ordinary scatter shot selects a real safe affordable alternative target',()=>{
 const b=field({npcs:[resident(8,5)],alternative:true}),before=structuredClone(b),u=actor(b),ordinary=cautiousCombatOrder(b,u);
 assert.equal(ordinary.type,'fire');assert.equal(ordinary.targetId,'front');assert.equal(firearmBystanderRisk(b,u,b.units.find(t=>t.id==='front'),ordinary.hitLocation).direct.some(body=>body.kind==='npc'),false);assert.equal(civilianRisk(b,u,ordinary),true,'The rejected ordinary shot has an actual known miss-path risk although its central ray has no civilian impact.');
 const selected=northernReliefDefenseController([])(b,u);assert.equal(selected.type,'fire');assert.equal(selected.targetId,'other');assert.equal(civilianRisk(b,u,selected),false);
 const result=actual(b,selected);assert.equal(result.npcs[0].hp,b.npcs[0].hp);assert.equal(actor(result).loaded,u.loaded-1);assert.deepEqual(b,before);
});

test('when the current lane is unsafe a short real move can fund a safe next shot instead of parking the shooter',()=>{
 const b=field({front:{x:12},npcs:[resident(5,5)]}),before=structuredClone(b),u=actor(b),ordinary=cautiousCombatOrder(b,u);assert.equal(ordinary.type,'fire');assert.equal(civilianRisk(b,u,ordinary),true);
 const controller=northernReliefDefenseController([]),selected=controller(b,u);assert.equal(selected.type,'move');
 const quote=getReachable(b,u).find(p=>p.x===selected.x&&p.y===selected.y&&(p.tacticalLevel??0)===(selected.tacticalLevel??0));assert.ok(quote);assert.ok(quote.cost>0&&quote.cost<=24&&quote.path.length<=3);
 const moved=actual(b,selected);assert.equal(actor(moved).ap,u.ap-quote.cost);assert.ok(actor(moved).energy<u.energy);assert.equal(actor(moved).loaded,u.loaded);assert.equal(actor(moved).ammo,u.ammo);assert.equal(moved.npcs[0].hp,b.npcs[0].hp);
 const fire=controller(moved,actor(moved));assert.equal(fire.type,'fire');assert.equal(civilianRisk(moved,actor(moved),fire),false);const result=actual(moved,fire);
 let replay=validateBattleSnapshot(JSON.parse(JSON.stringify(before)));for(const action of [selected,fire])replay=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(replay,action))));assert.deepEqual(replay,result);assert.deepEqual(b,before);
});

test('paired offhand and typed pellet paths retain their actual Native civilian risk',()=>{
 for(const config of [{weapon:1806,actor:{offHand:{weapon:1805,count:1,loaded:1,condition:100}}},{weapon:1807}]){
  const b=field({...config,npcs:[resident(8,5)]}),before=structuredClone(b),u=actor(b),target=b.units.find(t=>t.id==='front');
  const options=firearmShotOptions(b,u,target,0),option=options.find(o=>o.hitLocation==='torso'&&o.aim===0);assert.ok(option);
  assert.equal(civilianRisk(b,u,{type:'fire',targetId:target.id,aim:0,hitLocation:'torso'}),true);assert.equal(knownRouteCivilianShotSafety(b,u,target)(option),false);assert.deepEqual(b,before);
 }
});

test('hidden departed and dead civilians cannot alter a clear relief decision',()=>{
 const clear=field(),expected=northernReliefDefenseController([])(clear,actor(clear));assert.equal(expected.type,'fire');
 for(const npc of [resident(8,5,{roomId:'unrevealed'}),resident(8,5,{departure:{}}),resident(8,5,{hp:0})]){
  const b=field({npcs:[npc]}),before=structuredClone(b);assert.deepEqual(northernReliefDefenseController([])(b,actor(b)),expected);assert.deepEqual(b,before);
 }
});

test('an unrevealed interior occupant cannot redirect the new paid lane-clearing proposal',()=>{
 const clear=field({front:{x:12},npcs:[resident(5,5)]}),before=structuredClone(clear),expected=northernReliefDefenseController([])(clear,actor(clear));assert.equal(expected.type,'move');
 const hidden=field({front:{x:12},npcs:[resident(5,5),resident(expected.x,expected.y,{id:'private-resident',roomId:'unrevealed'})]}),hiddenBefore=structuredClone(hidden);
 assert.deepEqual(northernReliefDefenseController([])(hidden,actor(hidden)),expected);assert.deepEqual(clear,before);assert.deepEqual(hidden,hiddenBefore);
});

test('held physicians keep actual finite aid and empty reserves keep their ordinary paid prone hold',()=>{
 const wounded=field({actor:{hp:60,maxHp:80,bleeding:1,medical:80,medkits:1,activeSlot:'medical'}}),before=structuredClone(wounded),u=actor(wounded),ordinary=cautiousCombatOrder(wounded,u),selected=northernReliefDefenseController(['shooter'])(wounded,u);
 assert.deepEqual(selected,ordinary);assert.equal(selected.type,'useItem');const treated=actual(wounded,selected);assert.equal(actor(treated).medkits,u.medkits-1);assert.ok(actor(treated).bleeding<u.bleeding);assert.deepEqual(wounded,before);
 const empty=field({actor:{loaded:0,ammo:0,stance:'standing'}}),held=northernReliefDefenseController([])(empty,actor(empty));assert.equal(held.type,'stance');assert.equal(held.stance,'prone');const lowered=actual(empty,held);assert.equal(northernReliefDefenseController([])(lowered,actor(lowered)),null);
});

test('a current movement remains unchanged and insufficient remaining AP cannot buy a replacement shot',()=>{
 const moving=field({npcs:[resident(4,4)]}),before=structuredClone(moving),ordinary=cautiousCombatOrder(moving,actor(moving)),selected=northernReliefDefenseController([])(moving,actor(moving));
 assert.equal(ordinary.type,'move');assert.deepEqual(selected,ordinary);actual(moving,selected);assert.deepEqual(moving,before);
 const blocked=field({front:{x:12},npcs:[resident(5,5)],actor:{hp:39,maxHp:100,bandaged:0,energy:10,fatigue:100,medical:0,medkits:0}}),heldBefore=structuredClone(blocked),proposed=cautiousCombatOrder(blocked,actor(blocked));
 assert.equal(actor(blocked).ap,actionCosts(blocked,actor(blocked),blocked.units.find(u=>u.id==='front')).fire,'Native wounds and fatigue leave exactly the actual shot cost, without an AP assignment.');
 assert.equal(proposed.type,'fire');assert.equal(proposed.aim,0);assert.equal(civilianRisk(blocked,actor(blocked),proposed),true);
 assert.equal(northernReliefDefenseController([])(blocked,actor(blocked)),null);assert.deepEqual(blocked,heldBefore,'A refused lane grants no AP, movement, shot or clock.');
});
