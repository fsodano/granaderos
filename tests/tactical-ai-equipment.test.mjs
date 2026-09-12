import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,planEquipLoot,equipLootPreview,actionCosts} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {handRecord,inventoryUsage} from '../game/tactical-inventory.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const pistol={count:1,weight:1.3,weapon:1806,loaded:1,condition:100,instanceId:'reserve-pistol'};
function field(patch={}){
  const s=createBattle([{id:'p',x:12,y:3,experienceLevel:1}],{width:20,height:8,seed:45,tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:6,y:3,facing:2,weapon:1800,weaponInstanceId:'old-musket',loaded:0,ammo:0,priming:0,medkits:0,patrol:false,marksmanship:100,condition:64,inventory:{pistol},...patch}]});
  s.units[0].ap=0;s.units[1].ap=patch.ap??14;return s;
}
const enemy=s=>s.units[1];

test('a prepared carried pistol replaces an empty musket and fires through the actual enemy turn',()=>{
  const s=field(),old=handRecord(enemy(s),'primary'),order=chooseEnemyAction(s,enemy(s)),before=structuredClone(s);
  assert.deepEqual(order,{type:'equipLoot',unitId:'e',inventoryKey:'pistol'});
  const n=endTurn(s);assert.equal(n.lastError,null);assert.equal(enemy(n).weapon,1806);assert.equal(enemy(n).weaponInstanceId,'reserve-pistol');assert.equal(enemy(n).loaded,0);assert.equal(enemy(n).condition,99);assert.equal(enemy(n).ammo,0);assert.equal(enemy(n).ap,0);
  assert.ok(n.units[0].hp<100);assert.deepEqual(Object.values(enemy(n).inventory).find(r=>r.weapon===1800),old);assert.equal(n.elapsedSeconds,6);
  assert.deepEqual(s,before);assert.deepEqual(n,endTurn(validateBattleSnapshot(JSON.parse(JSON.stringify(s)))));assert.doesNotThrow(()=>validateBattleSnapshot(n));
});

test('a disarmed soldier unpacks its own reserve instead of fabricating or stealing another weapon',()=>{
  const s=field({weaponDropped:true,activeSlot:'unarmed',ap:6});s.units[0].x=19;s.units[0].y=7;
  s.tiles.filter(t=>t.x===10).forEach(t=>{t.blocked=true;t.blocksSight=true;t.type='wall';});
  const order=chooseEnemyAction(s,enemy(s));assert.equal(order.type,'equipLoot');
  const n=endTurn(s);assert.equal(enemy(n).weapon,1806);assert.equal(enemy(n).weaponDropped,false);assert.equal(enemy(n).loaded,1);assert.equal(enemy(n).condition,100);assert.equal(enemy(n).ap,0);assert.deepEqual(enemy(n).inventory,{});
});

test('the planner rejects a capacity-breaking swap and does not turn other stored equipment into weapons',()=>{
  const s=field({ammo:140,inventory:{pistol}});assert.equal(inventoryUsage(enemy(s)).used,12);
  assert.throws(()=>planEquipLoot(enemy(s),'pistol'));assert.notEqual(chooseEnemyAction(s,enemy(s))?.type,'equipLoot');
  const unsupported=field({inventory:{old:{count:1,weight:1,weapon:1700,loaded:0,condition:100}}});assert.notEqual(chooseEnemyAction(unsupported,enemy(unsupported))?.type,'equipLoot');
});

test('equipment previews support enemy actions only in their action window and never grant player command',()=>{
  const s=field();assert.equal(equipLootPreview(s,enemy(s),'pistol').valid,false);s.phase='enemy';assert.equal(equipLootPreview(s,enemy(s),'pistol').valid,true);
  const n=actBattle(s,{type:'equipLoot',unitId:'e',inventoryKey:'pistol'});assert.ok(n.lastError);assert.deepEqual(n.units,s.units);assert.equal(n.seed,s.seed);assert.equal(n.elapsedSeconds,s.elapsedSeconds);
});

test('pack choices are deterministic and do not consume input, loaded charges, fittings or identities while scoring',()=>{
  const s=field({inventory:{z:{...pistol,instanceId:'z'},a:{...pistol,instanceId:'a'}},ap:20}),before=structuredClone(s),order=chooseEnemyAction(s,enemy(s));
  assert.equal(order.inventoryKey,'a');enemy(s).inventory={a:enemy(s).inventory.a,z:enemy(s).inventory.z};assert.deepEqual(chooseEnemyAction(s,enemy(s)),order);
  assert.deepEqual(chooseEnemyAction(before,enemy(before)),order);assert.equal(enemy(before).inventory.a.loaded,1);assert.equal(enemy(before).inventory.z.loaded,1);assert.equal(before.seed,45);
});

test('a ready held gun and an affordable close blade attack do not cause gratuitous unpacking',()=>{
  const ready=field({loaded:1});assert.notEqual(chooseEnemyAction(ready,enemy(ready))?.type,'equipLoot');
  const close=field({blade:1813,activeSlot:'blade'});close.units[0].x=7;assert.equal(chooseEnemyAction(close,enemy(close)).type,'melee');
  const low=field({ap:11});assert.notEqual(chooseEnemyAction(low,enemy(low))?.type,'equipLoot','six AP to unpack plus six AP to fire must be available');
});

test('jammed spares are not mistaken for ready weapons and a useful holstered gun costs four AP',()=>{
  const jammed=field({inventory:{pistol:{...pistol,jammed:true}}});assert.notEqual(chooseEnemyAction(jammed,enemy(jammed))?.type,'equipLoot');
  const holstered=field({activeSlot:'blade',blade:1813,loaded:1,inventory:{},ap:16});assert.deepEqual(chooseEnemyAction(holstered,enemy(holstered)),{type:'weapon',unitId:'e',slot:'primary'});
  const n=endTurn(holstered);assert.equal(enemy(n).activeSlot,'primary');assert.equal(enemy(n).loaded,0);assert.equal(enemy(n).ap,0);assert.equal(actionCosts(holstered,enemy(holstered)).weapon,4);
});

test('an enemy can actually fit its owned socket bayonet and attack with the shared paid actions',()=>{
  const s=field({inventory:{},blade:1811,bladeCondition:47,bladeFittingPattern:'india_socket',bladeInstanceId:'owned-bayonet',ap:28});s.units[0].x=8;
  assert.equal(chooseEnemyAction(s,enemy(s)).type,'fitBayonet');
  const n=endTurn(s);assert.equal(n.lastError,null);assert.equal(enemy(n).weaponFittings.bayonet.instanceId,'owned-bayonet');assert.equal(enemy(n).blade,undefined);assert.equal(enemy(n).ap,0);assert.ok(n.units[0].hp<100);assert.equal(enemy(n).loaded,0);assert.equal(enemy(n).ammo,0);assert.doesNotThrow(()=>validateBattleSnapshot(n));
});

test('a weapon swap and shot during an enemy reaction survive a nested saved player interruption',()=>{
  const s=field({experienceLevel:5,ap:14});
  Object.assign(s.units[0],{ap:24,agility:30,experienceLevel:1});
  s.units.push({...structuredClone(s.units[0]),id:'observer',x:12,y:5,ap:20,agility:100,experienceLevel:10});
  const paused=actBattle(s,{type:'move',unitId:'p',x:11,y:3});
  assert.equal(paused.lastError,null);assert.equal(paused.phase,'interrupt');assert.equal(paused.interrupt.returnTo,'reaction');
  // The close-range bonus caps the unaimed shot, so the AI retains two aim AP.
  assert.ok(paused.interrupt.unitIds.includes('observer'));assert.equal(enemy(paused).weaponInstanceId,'reserve-pistol');assert.equal(enemy(paused).loaded,0);assert.equal(enemy(paused).ap,2);assert.equal(enemy(paused).ammo,0);
  const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(paused))),n=endTurn(restored);
  assert.deepEqual(n,endTurn(paused));assert.equal(n.elapsedSeconds,6);assert.equal(n.turn,1);assert.equal(n.phase,'player');assert.equal(enemy(n).ap,2);assert.equal(enemy(n).weaponInstanceId,'reserve-pistol');assert.equal(enemy(n).loaded,0);
  assert.equal(n.log.filter(line=>line.includes('equipa Pistola')).length,1);assert.doesNotThrow(()=>validateBattleSnapshot(n));
});
