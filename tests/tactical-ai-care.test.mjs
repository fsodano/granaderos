import test from 'node:test';
import {setTestAmmunition} from './typed-ammunition-fixture.mjs';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,getReachable,canSee,actionCosts} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

function field(medic={},patient={},extra={}) {
  const tiles=Array.from({length:128},(_,i)=>({x:i%16,y:Math.floor(i/16),type:i%16===8?'wall':'grass',blocked:i%16===8,blocksSight:i%16===8,cover:0}));
  const s=createBattle([{id:'p',x:1,y:1}],{width:16,height:8,seed:45,tiles,enemies:[
    {id:'medic',name:'medic',x:12,y:3,facing:2,medical:60,medkits:2,patrol:false,loaded:1,ammo:3,...medic},
    {id:'patient',name:'patient',x:13,y:3,hp:10,maxHp:100,bleeding:3,medical:0,medkits:0,patrol:false,...patient},
  ],...extra});
  s.units[0].ap=0;s.units[1].ap=medic.ap??33;s.units[2].ap=0;
  return s;
}
const medic=s=>s.units.find(u=>u.id==='medic');
const patient=s=>s.units.find(u=>u.id==='patient');

test('a real enemy turn equips dressings, treats a critical ally and restores its weapon with paid AP',()=>{
  const s=field(),before=structuredClone(s),n=endTurn(s);
  assert.equal(n.lastError,null);assert.equal(n.turn,2);assert.equal(n.elapsedSeconds,6);
  assert.equal(medic(n).ap,0);assert.equal(medic(n).medkits,1);assert.equal(medic(n).activeSlot,'primary');
  assert.equal(medic(n).loaded,1);assert.equal(medic(n).ammo,3);assert.equal(patient(n).bleeding,0);assert.equal(patient(n).hp,15);assert.equal(patient(n).bandaged,85);assert.equal(patient(n).unconscious,false);assert.equal(patient(n).ap,0);
  assert.ok(!n.log.some(line=>/medic|patient|venda/.test(line)),'unseen treatment stays out of the player journal');
  assert.deepEqual(s,before);assert.deepEqual(n,endTurn(validateBattleSnapshot(JSON.parse(JSON.stringify(s)))));
  assert.doesNotThrow(()=>validateBattleSnapshot(n));
});

test('aid spends only the available dressing and does not repeat on a stable patient',()=>{
  const s=field({medkits:1,ap:100}),n=endTurn(s);
  assert.equal(medic(n).medkits,0);assert.equal(patient(n).bleeding,0);assert.equal(patient(n).bandaged,85);assert.ok(!n.log.some(line=>line.includes('venda a')));
  assert.equal(patient(n).hp,15);assert.equal(patient(endTurn(n)).hp,15);
  assert.equal(medic(endTurn(n)).medkits,0);
});

test('triage uses blood-loss urgency, stable identity ties and the medic’s own wound first',()=>{
  const s=field({activeSlot:'medical'},{hp:40,bleeding:2});
  s.units.push({...structuredClone(patient(s)),id:'urgent',x:12,y:4,hp:30,bleeding:6});
  assert.equal(chooseEnemyAction(s,medic(s)).targetId,'urgent');
  s.units.reverse();assert.equal(chooseEnemyAction(s,medic(s)).targetId,'urgent');
  Object.assign(medic(s),{hp:90,bleeding:1});assert.equal(chooseEnemyAction(s,medic(s)).targetId,'medic');
});

test('finite supplies, aptitude, AP and patient state exclude impossible treatment',()=>{
  for(const patch of [{medkits:0},{medical:0},{ap:28},{energy:0},{routed:true}]) {
    const s=field(patch);assert.notEqual(chooseEnemyAction(s,medic(s))?.slot,'medical');
  }
  for(const patch of [{hp:0},{routed:true},{surrendered:true},{fled:true},{departure:{edge:'E'}},{hp:15,bleeding:0,bandaged:85}]) {
    const s=field({},patch);assert.notEqual(chooseEnemyAction(s,medic(s))?.slot,'medical');
  }
  const s=field({ap:25,activeSlot:'medical'});assert.equal(chooseEnemyAction(s,medic(s)).targetId,'patient');
});

test('a medic walks a real short path while reserving AP for equipment, treatment and a weapon',()=>{
  const s=field({x:11,ap:49},{x:14}),order=chooseEnemyAction(s,medic(s));
  assert.equal(order.type,'move');assert.deepEqual([order.x,order.y],[13,3]);
  const path=getReachable(s,medic(s)).find(p=>p.x===order.x&&p.y===order.y);
  assert.equal(path.cost,16);assert.ok(medic(s).ap-path.cost>=actionCosts(s,medic(s)).heal+4);
  const n=endTurn(s);assert.equal(medic(n).x,13);assert.equal(medic(n).ap,0);assert.equal(medic(n).activeSlot,'primary');
  assert.equal(medic(n).medkits,1);assert.equal(patient(n).bleeding,0);assert.equal(patient(n).hp,15);assert.equal(patient(n).ap,0);
});

test('rescue decisions do not reveal hidden patients or respond to unseen opposing coordinates',()=>{
  const s=field({x:11,ap:60},{x:7});assert.equal(canSee(s,medic(s),patient(s)),false);assert.equal(chooseEnemyAction(s,medic(s)),null);
  patient(s).x=14;const before=structuredClone(s),order=chooseEnemyAction(s,medic(s));assert.equal(order.type,'move');
  s.units[0].x=2;s.units[0].y=6;s.units[0].inventory={secret:{count:1,weight:1}};setTestAmmunition(s.units[0],500);
  assert.deepEqual(chooseEnemyAction(s,medic(s)),order);assert.deepEqual(chooseEnemyAction(before,medic(before)),order);
  assert.equal(medic(before).ap,60);assert.equal(medic(before).medkits,2);
});

test('a rescue does not start during an interrupt or through a visible close opponent',()=>{
  const s=field({x:11,ap:60},{x:14});s.phase='interrupt';
  assert.equal(chooseEnemyAction(s,medic(s)),null);
  s.phase='enemy';s.reactionStack=[{unitIds:['medic']}];assert.equal(chooseEnemyAction(s,medic(s)),null);
  delete s.reactionStack;Object.assign(s.units[0],{x:12,y:4,loaded:0});
  assert.notEqual(chooseEnemyAction(s,medic(s))?.type,'move');
});

test('enemy rescue movement can be interrupted, saved and continued without refreshing AP or time',()=>{
  const s=field({x:11,ap:49,agility:30,experienceLevel:1},{x:14});
  s.tiles.forEach(t=>{t.blocked=false;t.blocksSight=false;t.type='grass';});
  Object.assign(s.units[0],{x:7,y:3,facing:2,ap:20,agility:100,experienceLevel:10});
  const paused=endTurn(s);assert.equal(paused.phase,'interrupt');assert.equal(medic(paused).x,12);assert.equal(medic(paused).ap,41);assert.equal(patient(paused).bleeding,3);assert.equal(medic(paused).medkits,2);
  const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(paused))),n=endTurn(restored);
  assert.deepEqual(n,endTurn(paused));assert.equal(n.elapsedSeconds,6);assert.equal(n.turn,2);assert.equal(medic(n).ap,0);assert.equal(medic(n).x,13);assert.equal(medic(n).medkits,1);assert.equal(patient(n).bleeding,0);
});

test('treatment cannot be forced through a player order addressed to an enemy',()=>{
  const s=field({activeSlot:'medical'}),n=actBattle(s,{type:'useItem',unitId:'medic',targetId:'patient'});
  assert.ok(n.lastError);assert.deepEqual(n.units,s.units);assert.equal(n.elapsedSeconds,s.elapsedSeconds);assert.equal(n.seed,s.seed);
});
