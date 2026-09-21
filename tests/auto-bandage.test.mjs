import test from 'node:test';
import assert from 'node:assert/strict';
import {actBattle, createBattle} from '../game/tactical.js';
import {autoBandageBattle, autoBandageStatus} from '../game/auto-bandage.js';

const map = (extra = {}) => ({width: 12, height: 7, exploration: true, enemies: [], tiles: Array.from({length: 84}, (_, i) => ({x: i % 12, y: Math.floor(i / 12), type: 'grass', blocked: false, cover: 0})), ...extra});
const medic = (extra = {}) => ({id: 'medic', name: 'Sanitario', x: 1, y: 2, medical: 80, medkits: 3, ...extra});
const patient = (extra = {}) => ({id: 'patient', name: 'Herido', x: 5, y: 2, medical: 0, medkits: 0, hp: 55, bleeding: 2, bandaged: 0, ...extra});
const make = (squad = [medic(), patient()], sector = {}) => createBattle(squad, map(sector));
const replay = (initial, steps) => steps.reduce((state, action) => {const next = actBattle(state, action); assert.equal(next.lastError, null); return next;}, initial);

test('auto-bandage replays legal orders with paid movement, finite kits and critical stabilization only', () => {
  const state = make([medic({hp: 85, bleeding: 2}), patient({hp: 12, bleeding: 1})]);
  state.units[0].ap = 3;
  const before = structuredClone(state), report = autoBandageBattle(state);
  assert.deepEqual(state, before);
  assert.deepEqual(report.battle, replay(state, report.steps));
  assert.deepEqual(report.steps[0], {type: 'weapon', unitId: 'medic', slot: 'medical'});
  assert.deepEqual(report.steps[1], {type: 'useItem', unitId: 'medic', targetId: 'medic'});
  assert.deepEqual(report.treatedIds, ['medic', 'patient']);
  assert.equal(report.untreated.length, 0); assert.equal(report.stoppedReason, null);
  assert.equal(report.battle.units[0].medkits, 1);
  assert.equal(report.battle.units[0].ap, 3);
  assert.ok(report.elapsedSeconds > 4); assert.ok(report.battle.units[0].energy < state.units[0].energy);
  for (const unit of report.battle.units) assert.equal(unit.bleeding, 0);
  assert.equal(report.battle.units[0].hp, before.units[0].hp, 'ordinary bandaging does not restore health');
  assert.equal(report.battle.units[1].unconscious, false); assert.equal(report.battle.units[1].hp, 15);
  assert.equal(report.battle.units[0].activeSlot, 'medical');
});

test('cleared victory enters exploration once without resetting PA, supplies or the clock', () => {
  const state = make(undefined, {exploration: false});
  assert.equal(state.status, 'victory');
  state.units[0].lastKnownEnemy = {x: 8, y: 2, turn: state.turn};
  state.units[0].lastHeardNoise = {x: 7, y: 2, turn: state.turn, kind: 'fire', uncertainty: 2};
  state.elapsedSeconds = 37; state.units[0].ap = 7;
  const report = autoBandageBattle(state);
  assert.equal(autoBandageStatus(state).available, true);
  assert.deepEqual(report.steps[0], {type: 'explore'});
  assert.equal(report.steps.filter(action => action.type === 'explore').length, 1);
  assert.equal(report.battle.units[0].ap, 7);
  assert.equal(report.battle.elapsedSeconds, 37 + report.elapsedSeconds);
  assert.equal(report.battle.mode, 'exploration'); assert.equal(report.battle.status, 'active');
  assert.deepEqual(report.battle, replay(state, report.steps));
});

test('an unconscious hostile remains on the cleared map without interrupting post-combat bandaging', () => {
  const state = make([medic({hp: 65, bleeding: 2})], {exploration: false, enemies: [{id: 'critical', x: 3, y: 2, hp: 10}]});
  assert.equal(state.status, 'victory'); assert.equal(autoBandageStatus(state).available, true);
  const report = autoBandageBattle(state);
  assert.deepEqual(report.treatedIds, ['medic']); assert.equal(report.untreated.length, 0);
  assert.equal(report.battle.mode, 'exploration'); assert.equal(report.battle.status, 'active');
  assert.equal(report.battle.units[1].hp, 10); assert.equal(report.battle.units[1].unconscious, true);
  assert.deepEqual(report.battle, replay(state, report.steps));
});

test('combat and recent contact refuse without changing the state', () => {
  const state = make(undefined, {width: 40, enemies: [{id: 'hidden', x: 39, y: 2}], deferContact: true});
  for (const altered of [{...state, mode: 'combat'}, {...state, phase: 'interrupt', interrupt: {side: 'player', unitIds: ['medic'], enemyId: 'hidden'}}]) {
    const result = autoBandageBattle(altered); assert.equal(result.battle, altered); assert.equal(result.steps.length, 0); assert.equal(autoBandageStatus(altered).available, false);
  }
  state.units[0].lastHeardNoise = {x: 25, y: 2, turn: state.turn, kind: 'fire', uncertainty: 3};
  const result = autoBandageBattle(state);
  assert.equal(result.battle, state); assert.match(result.stoppedReason, /contacto/);
  assert.ok(!JSON.stringify(autoBandageStatus(state)).includes('hidden'));
});

test('real supplies and conscious medical aptitude are required', () => {
  for (const extra of [{medical: 0}, {hp: 10}, {energy: 0}, {routed: true}, {medkits: 0}]) {
    const state = make([medic(extra), patient()]);
    const report = autoBandageBattle(state);
    assert.equal(report.steps.length, 0); assert.equal(report.battle, state); assert.ok(report.untreated.length > 0);
  }
  const exhaustedSupply = make([medic({medkits: 1}), patient({x: 2}), patient({id: 'second', name: 'Segundo', x: 1, y: 3})]);
  const report = autoBandageBattle(exhaustedSupply);
  assert.equal(report.treatedIds.length, 1); assert.equal(report.untreated.length, 1);
  assert.equal(report.battle.units[0].medkits, 0); assert.match(report.stoppedReason, /vendas/);
});

test('blocked paths consume no kits and accessible casualties are still treated', () => {
  const state = make([medic(), patient({id: 'blocked', x: 9}), patient({id: 'near', x: 2})]);
  for (const tile of state.tiles.filter(tile => tile.x === 6)) Object.assign(tile, {type: 'door', blocked: true, open: false});
  const report = autoBandageBattle(state);
  assert.deepEqual(report.treatedIds, ['near']); assert.equal(report.battle.units[0].medkits, 2);
  assert.deepEqual(report.untreated.map(unit => unit.id), ['blocked']); assert.match(report.untreated[0].reason, /camino abierto/);
  const inaccessible = make();
  for (const tile of inaccessible.tiles.filter(tile => tile.x === 3)) tile.blocked = true;
  assert.equal(autoBandageBattle(inaccessible).steps.length, 0);
});

test('movement exhaustion stops without treatment, refill, rest or a repeated failed order', () => {
  const state = make([medic({energy: 1, activeSlot: 'medical'}), patient({x: 10})]);
  const report = autoBandageBattle(state);
  assert.equal(report.steps.length, 1); assert.equal(report.steps[0].type, 'move');
  assert.equal(report.battle.units[0].energy, 0); assert.equal(report.battle.units[0].unconscious, true);
  assert.equal(report.battle.units[0].medkits, 3); assert.equal(report.treatedIds.length, 0);
  assert.match(report.stoppedReason, /sanitario/); assert.ok(report.battle.units[0].x < 9);
  assert.deepEqual(report.battle, replay(state, report.steps));
});

test('time spent equipping can incapacitate a bleeding medic and preserves the failed rescue', () => {
  const state = make([medic({hp: 15, bleeding: 2}), patient()]);
  state.bleedSeconds = 5;
  const report = autoBandageBattle(state);
  assert.equal(report.steps.length, 1); assert.equal(report.steps[0].type, 'weapon');
  assert.equal(report.battle.units[0].hp, 13); assert.equal(report.battle.units[0].unconscious, true);
  assert.equal(report.battle.units[0].medkits, 3); assert.equal(report.treatedIds.length, 0);
  assert.match(report.stoppedReason, /sanitario/);
});

test('immobilized medics only treat within reach and completed squads do nothing', () => {
  const state = make([medic({entangled: true, activeSlot: 'medical'}), patient({x: 10})]);
  const blocked = autoBandageBattle(state); assert.equal(blocked.steps.length, 0); assert.match(blocked.stoppedReason, /camino/);
  state.units[1].x = 2;
  const done = autoBandageBattle(state); assert.equal(done.treatedIds.length, 1); assert.ok(done.steps.every(action => action.type === 'useItem'));
  const repeated = autoBandageBattle(done.battle); assert.equal(repeated.battle, done.battle); assert.equal(repeated.steps.length, 0); assert.equal(repeated.untreated.length, 0);
});

test('an enemy discovered along the legal route interrupts bandaging before any kit is consumed', () => {
  const sector = {width: 24, height: 12, exploration: true, enemies: [{id: 'sentry', x: 22, y: 5}], tiles: Array.from({length: 288}, (_, i) => ({x: i % 24, y: Math.floor(i / 24), type: 'grass', blocked: Math.floor(i / 24) === 5 && i % 24 < 6, cover: 0}))};
  const state = createBattle([medic({x: 1, y: 1}), patient({x: 1, y: 9, hp: 95, bleeding: 1})], sector);
  assert.equal(state.mode, 'exploration'); assert.equal(autoBandageStatus(state).available, true);
  const report = autoBandageBattle(state);
  assert.equal(report.battle.mode, 'combat'); assert.match(report.stoppedReason, /contacto/);
  assert.equal(report.battle.units[0].medkits, 3); assert.equal(report.treatedIds.length, 0);
  assert.deepEqual(report.steps.map(action => action.type), ['weapon', 'move']);
  assert.deepEqual(report.battle, replay(state, report.steps));
});


test('departed medics and patients stay outside squad bandaging while their records remain intact',()=>{
 const state=make([medic({x:0,hp:90,bleeding:1}),patient({x:1})],{exits:[{id:'west',edge:'W',destination:'retiro',entryEdge:'E',entryAnchor:{x:19,y:3}}]});
 const next=actBattle(state,{type:'exit',unitIds:['medic'],exitId:'west'});assert.ok(next.units[0].departure);
 const report=autoBandageStatus(next);assert.deepEqual(report.doctors,[]);assert.deepEqual(report.patients.map(unit=>unit.id),['patient']);assert.equal(report.available,false);
 const result=autoBandageBattle(next);assert.equal(result.battle,next);assert.deepEqual(result.steps,[]);
});
