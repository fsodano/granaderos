import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle, actBattle, getReachable, actionCosts, shotChance, canSee} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';

function battle(players = [{id: 'p', x: 2, y: 3}], enemy = {}, extra = {}) {
  const width = 20, height = 9;
  return createBattle(players, {width, height, tiles: Array.from({length: width * height}, (_, i) => ({x: i % width, y: Math.floor(i / width), type: 'grass', blocked: false, cover: 0})), enemies: [{id: 'e', x: 9, y: 3, ...enemy}], ...extra});
}
const enemy = state => state.units.find(unit => unit.id === 'e');

test('AI binds wounds first, then recovers from knockdown and entanglement', () => {
  const state = battle(), unit = enemy(state);
  unit.bleeding = 4; unit.hp = 50; unit.knockedDown = true; unit.entangled = true;
  unit.activeSlot='medical';
  assert.deepEqual(chooseEnemyAction(state, unit), {type:'useItem',unitId:unit.id,targetId:unit.id});
  unit.bleeding = 0;
  assert.deepEqual(chooseEnemyAction(state, unit), {type: 'stance', unitId: 'e', stance: 'standing'});
  unit.knockedDown = false;
  assert.equal(chooseEnemyAction(state, unit).type, 'free');
  unit.ap = 14;
  assert.equal(chooseEnemyAction(state, unit), null);
});

test('AI selects an affordable aimed shot and does not spend aim after accuracy stops improving', () => {
  const state = battle([{id: 'p', x: 2, y: 3}], {marksmanship: 45}), unit = enemy(state);
  unit.ap = 25;
  const action = chooseEnemyAction(state, unit), costs = actionCosts(state, unit);
  assert.equal(action.type, 'fire');
  assert.ok(action.aim > 0 && action.aim <= 4);
  assert.ok(costs.fire + costs.aim * action.aim <= unit.ap);
  assert.ok(shotChance(state, unit, state.units[0], action.aim) > shotChance(state, unit, state.units[0], 0));
  unit.marksmanship = 100; unit.ap = 100;
  const precise=chooseEnemyAction(state,unit),target=state.units[0];
  assert.equal(shotChance(state,unit,target,precise.aim,precise.hitLocation),shotChance(state,unit,target,4,precise.hitLocation));
  if(precise.aim>0)assert.ok(shotChance(state,unit,target,precise.aim-1,precise.hitLocation)<shotChance(state,unit,target,precise.aim,precise.hitLocation));
});

test('AI targets remain deterministic when equally useful opponents change array order', () => {
  const state = battle([{id: 'a', x: 2, y: 2, loaded: 0}, {id: 'b', x: 2, y: 4, loaded: 0}]);
  const copy = structuredClone(state);
  copy.units.reverse();
  assert.deepEqual(chooseEnemyAction(state, enemy(state)), chooseEnemyAction(copy, enemy(copy)));
  assert.equal(chooseEnemyAction(state, enemy(state)).targetId, 'a');
});

test('AI reloads and repairs a failed ignition only with enough AP and supplies', () => {
  const state = battle(), unit = enemy(state);
  unit.loaded = 0;
  assert.equal(chooseEnemyAction(state, unit).type, 'reload');
  unit.jammed = true;
  assert.equal(chooseEnemyAction(state, unit).type, 'reprime');
  unit.priming = 0; unit.ap = 1;
  assert.equal(chooseEnemyAction(state, unit), null);
});

test('AI changes from medical equipment to a weapon before fighting', () => {
  const state = battle([{id: 'p', x: 8, y: 3}], {activeSlot: 'medical'}), unit = enemy(state);
  assert.deepEqual(chooseEnemyAction(state, unit), {type: 'weapon', unitId: 'e', slot: 'primary'});
  unit.ap = 3;
  assert.equal(chooseEnemyAction(state, unit), null);
});

test('a jammed soldier without priming powder can close for a blade attack', () => {
  const state = battle([{id: 'p', x: 5, y: 3}], {priming: 0}), unit = enemy(state);
  unit.jammed = true;
  const action = chooseEnemyAction(state, unit);
  assert.equal(action.type, 'move');
  assert.ok(Math.hypot(action.x - state.units[0].x, action.y - state.units[0].y) <= 2);
  const path = getReachable(state, unit).find(cell => cell.x === action.x && cell.y === action.y);
  assert.ok(unit.ap - path.cost >= actionCosts(state, unit).melee);
});

test('outnumbered AI uses nearby cover and keeps enough AP to fire', () => {
  const state = battle([{id: 'a', x: 2, y: 2, marksmanship: 90}, {id: 'b', x: 2, y: 4, marksmanship: 90}], {marksmanship: 70}), unit = enemy(state);
  state.tiles.find(tile => tile.x === 9 && tile.y === 4).cover = 50;
  const action = chooseEnemyAction(state, unit);
  assert.equal(action.type, 'move');
  assert.deepEqual([action.x, action.y], [9, 4]);
  const path = getReachable(state, unit).find(cell => cell.x === action.x && cell.y === action.y);
  assert.ok(unit.ap - path.cost >= actionCosts(state, unit).fire);
  const positioned = {...unit, x: action.x, y: action.y, ap: unit.ap - path.cost};
  assert.equal(chooseEnemyAction(state, positioned).type, 'fire');
});

test('AI does not chase a hidden soldier or read its current coordinates from memory', () => {
  const state = battle([{id: 'p', x: 1, y: 3}], {x: 17, y: 3}, {night: true}), unit = enemy(state);
  assert.equal(canSee(state, unit, state.units[0]), false);
  assert.equal(chooseEnemyAction(state, unit)?.patrol, true);
  const hiddenMoved=structuredClone(state);hiddenMoved.units[0].x=1;
  assert.deepEqual(chooseEnemyAction(hiddenMoved,enemy(hiddenMoved)),chooseEnemyAction(state,unit));
  unit.lastKnownEnemy = {x: 12, y: 3, turn: state.turn};
  const action = chooseEnemyAction(state, unit);
  assert.equal(action.type, 'move');
  const path = getReachable(state, unit).find(cell => cell.x === action.x && cell.y === action.y);
  assert.ok(path.path.length <= 3 && path.cost <= 24);
  assert.ok(Math.hypot(action.x - 12, action.y - 3) < Math.hypot(unit.x - 12, unit.y - 3));
  const costs = actionCosts(state, unit);
  assert.ok(unit.ap - path.cost >= costs.fire + 2 * costs.aim);
  const movedHidden = structuredClone(state);
  movedHidden.units[0].y = 8;
  assert.deepEqual(chooseEnemyAction(movedHidden, enemy(movedHidden)), action);
  unit.x = 12;
  assert.equal(chooseEnemyAction(state, unit), null);
  unit.x = 17; unit.lastKnownEnemy.turn = state.turn - 4;
  assert.equal(chooseEnemyAction(state, unit)?.patrol, true);
});

test('AI can approach the last sighted position around a wall without targeting unseen units', () => {
  const tiles = Array.from({length: 180}, (_, i) => {
    const x = i % 20, y = Math.floor(i / 20), wall = x === 5 && y >= 2 && y <= 4;
    return {x, y, type: wall ? 'wall' : 'grass', blocked: wall, blocksSight: wall, cover: 0};
  });
  const state = battle([{id: 'p', x: 2, y: 3}], {x: 7, y: 3}, {tiles}), unit = enemy(state);
  assert.equal(canSee(state, unit, state.units[0]), false);
  assert.equal(chooseEnemyAction(state, unit)?.patrol, true);
  const hiddenMoved=structuredClone(state);hiddenMoved.units[0].x=1;
  assert.deepEqual(chooseEnemyAction(hiddenMoved,enemy(hiddenMoved)),chooseEnemyAction(state,unit));
  unit.lastKnownEnemy = {x: 3, y: 3, turn: state.turn};
  const action = chooseEnemyAction(state, unit);
  assert.equal(action.type, 'move');
  assert.ok(getReachable(state, unit).some(cell => cell.x === action.x && cell.y === action.y));
  assert.notDeepEqual([action.x, action.y], [state.units[0].x, state.units[0].y]);
});

test('AI uses melee in reach and an ordinary approach with enough AP to attack', () => {
  const state = battle([{id: 'p', x: 7, y: 3, loaded: 0, ammo: 0}], {weapon: 1813, loaded: 0, ammo: 0}), unit = enemy(state);
  unit.x = 8;
  assert.equal(chooseEnemyAction(state, unit).type, 'melee');
  unit.x = 11;
  const action = chooseEnemyAction(state, unit);
  assert.equal(action.type, 'move');
  const path = getReachable(state, unit).find(cell => cell.x === action.x && cell.y === action.y);
  assert.ok(unit.ap - path.cost >= actionCosts(state, unit).melee);
  assert.equal(chooseEnemyAction(state, {...unit, x: action.x, y: action.y, ap: unit.ap - path.cost}).type, 'melee');
  state.units[0].braced = true;
  assert.notEqual(chooseEnemyAction(state, unit)?.type, 'charge');
  state.units[0].braced = false; state.units[0].loaded = 1;
  assert.notEqual(chooseEnemyAction(state, unit)?.type, 'charge');
});

test('choosing an order preserves the input and repeated choices agree', () => {
  const state = battle(), original = structuredClone(state);
  const first = chooseEnemyAction(state, enemy(state));
  assert.deepEqual(chooseEnemyAction(state, enemy(state)), first);
  assert.deepEqual(state, original);
});

test('blade soldiers can close a visible distance that needs more than one turn',()=>{
 const state=battle([{id:'p',x:2,y:3,weapon:1813}],{x:17,y:3,weapon:1813}),unit=enemy(state);
 const before=structuredClone(state),action=chooseEnemyAction(state,unit);
 assert.equal(action.type,'move');const path=getReachable(state,unit).find(p=>p.x===action.x&&p.y===action.y);
 assert.ok(path.cost<=32);assert.ok(unit.ap-path.cost>=actionCosts(state,unit).melee);
 assert.ok(Math.hypot(action.x-2,action.y-3)<15);assert.deepEqual(state,before);
});


test('automated field aid equips dressings and pays both actions before restoring its weapon',()=>{
 let state=battle([{id:'p',x:2,y:3,hp:60,bleeding:3,medkits:1}],{overwatch:false});
 let unit=state.units[0];unit.ap=28;
 assert.notDeepEqual(chooseEnemyAction(state,unit),{type:'weapon',unitId:'p',slot:'medical'});
 unit.ap=40;
 const equip=chooseEnemyAction(state,unit);assert.deepEqual(equip,{type:'weapon',unitId:'p',slot:'medical'});
 state=actBattle(state,equip);assert.equal(state.lastError,null);assert.equal(state.units[0].ap,36);
 const aid=chooseEnemyAction(state,state.units[0]);assert.deepEqual(aid,{type:'useItem',unitId:'p',targetId:'p'});
 state=actBattle(state,aid);assert.equal(state.lastError,null);assert.equal(state.units[0].ap,11);assert.equal(state.units[0].medkits,0);assert.equal(state.units[0].bleeding,0);assert.equal(state.units[0].hp,60);
 assert.deepEqual(chooseEnemyAction(state,state.units[0]),{type:'weapon',unitId:'p',slot:'primary'});
});
