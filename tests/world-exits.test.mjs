import {initializeUnitAmmunition} from '../game/tactical-ammunition.js';
import {refreshMilitaryCondition} from '../game/actor-condition.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMPAIGN_SECTORS} from '../game/data.js';
import {enterSector} from '../game/world.js';
import {sectorExits,boundaryMatches,inwardFromBoundary} from '../game/tactical-exits.js';
import {movementStepCost} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

// Coordinate-specific resident/mission fixtures retain compact-save geometry.
// The all-destinations test explicitly exercises newly expanded maps.
const request = (sector = 'cordoba', extra = {}) => ({id: `entry-${sector}`, sector, exploration: true, compactLayout:true, squad: [{id: 'p'}], enemies: [], ...extra});
const arrival = (id = 'p', entryEdge = 'W', entryAnchor = {x: 0, y: 7}, extra = {}) => ({id, entryReason: 'arrival', entryEdge, entryAnchor, ...extra});
const unit = (s, id = 'p') => s.units.find(u => u.id === id);
// A declared casualty still needs the canonical zero action budget.
const dead = u => {Object.assign(u, {hp: 0, bleeding: 0, unconscious: false});refreshMilitaryCondition(u);return u;};
const closeEdge = (s, edge, except = []) => {
  for (const t of s.tiles.filter(t => boundaryMatches(s, t, edge))) if (!except.some(p => p.x === t.x && p.y === t.y)) Object.assign(t, {type: 'wall', blocked: true, blocksSight: true});
};

test('every logical destination accepts six deterministic boundary arrivals with finite gear unchanged', () => {
  const endpoints = [...CAMPAIGN_SECTORS.flatMap(s => sectorExits(s.id)), ...sectorExits('san_lorenzo'), ...sectorExits('tucuman', 'yatasto')];
  for (const exit of endpoints) {
    const squad = Array.from({length: 6}, (_, i) => arrival(`p${i}`, exit.entryEdge, exit.entryAnchor, {hp: 61 + i, energy: 70 + i, ammo: 3, loaded: 0, condition: 47, medkits: 1, inventory: {legacy: {count: 1, weight: .2, weapon: 1820, loaded: 0, condition: 38, jammed: false}}}));
    for(const u of squad){u.weapon=1800;initializeUnitAmmunition(u);}
    const req = request(exit.destination, {squad,compactLayout:false}), before = structuredClone(req), a = enterSector(req), b = enterSector(req);
    assert.deepEqual(a, b, exit.id);
    assert.deepEqual(req, before);
    assert.equal(new Set(a.units.map(u => `${u.x},${u.y}`)).size, 6);
    for (const u of a.units) {
      assert.equal(boundaryMatches(a, u, exit.entryEdge), true, exit.id);
      assert.equal(u.facing, {N: 4, E: 6, S: 0, W: 2}[exit.entryEdge]);
      assert.ok(Number.isFinite(movementStepCost(a, u, u, inwardFromBoundary(u, exit.entryEdge))));
      for (const key of ['hp', 'energy', 'ammo', 'loaded', 'condition', 'medkits', 'inventory']) assert.deepEqual(u[key], squad.find(p => p.id === u.id)[key]);
    }
    assert.doesNotThrow(() => validateBattleSnapshot(a));
  }
});

test('mission scene arrivals use their own boundary and keep scene identity', () => {
  const san = enterSector(request('san_lorenzo', {squad: [arrival('p', 'S', {x: 11, y: 15})]}));
  assert.equal(unit(san).y, 15);
  const conference = enterSector(request('tucuman', {sceneId: 'yatasto', squad: [arrival('p', 'S', {x: 3, y: 15})]}));
  assert.equal(unit(conference).y, 15);
  assert.equal(conference.sceneId, 'yatasto');
  assert.equal(conference.sectorId, 'tucuman');
});

test('a new arrival ignores a historical interior position while an explicit resident uses it', () => {
  const prior = enterSector(request());
  Object.assign(unit(prior), {x: 5, y: 8});
  prior.returnLedger = {battleId: prior.battleId, creditedCartridges: 0, entries: [{unitId: 'p', kind: 'resident', sector: 'cordoba'}]};
  const resident = enterSector(request('cordoba', {squad: [{id: 'p', hp: 67, entryReason: 'resident'}]}), prior);
  assert.deepEqual([unit(resident).x, unit(resident).y], [5, 8]);
  assert.equal(unit(resident).hp, 67, 'Current roster condition remains authoritative');
  const entered = enterSector(request('cordoba', {squad: [arrival()]}), prior);
  assert.equal(unit(entered).x, 0);
  assert.equal(unit(entered).y, 7);
  assert.notDeepEqual([unit(enterSector(request(), prior)).x, unit(enterSector(request(), prior)).y], [5, 8]);
});

test('NPC and resident reservations prevent arrival overlap without moving the NPC', () => {
  const prior = enterSector(request('cordoba', {squad: [{id: 'resident'}]}));
  Object.assign(unit(prior, 'resident'), {x: 0, y: 8});
  const req = request('cordoba', {squad: [arrival(), {id: 'resident', entryReason: 'resident'}], npcs: [{id: 'guide', name: 'Guía', x: 0, y: 7}]});
  const n = enterSector(req, prior);
  assert.deepEqual([n.npcs[0].x, n.npcs[0].y], [0, 7]);
  assert.deepEqual([unit(n, 'resident').x, unit(n, 'resident').y], [0, 8]);
  assert.equal(unit(n).x, 0);
  assert.notEqual(unit(n).y, 7);
  assert.notEqual(unit(n).y, 8);
  assert.equal(new Set([...n.units, ...n.npcs].map(u => `${u.x},${u.y}`)).size, 3);
});

test('blocked or undersized edge arrivals reject without an interior fallback or input mutation', () => {
  for (const remaining of [[], [{x: 0, y: 7}]]) {
    const prior = enterSector(request());
    closeEdge(prior, 'W', remaining);
    const req = request('cordoba', {squad: [arrival('p1'), arrival('p2')]}), before = structuredClone({req, prior});
    assert.throws(() => enterSector(req, prior), /borde de entrada/);
    assert.deepEqual({req, prior}, before);
  }
  const blockedApproach = enterSector(request());
  closeEdge(blockedApproach, 'W', [{x: 0, y: 7}]);
  blockedApproach.props.push({id: 'blocked-approach', type: 'chest', x: 1, y: 7, blocksMovement: true});
  assert.throws(() => enterSector(request('cordoba', {squad: [arrival()]}), blockedApproach), /borde de entrada/);
});

test('invalid arrival metadata and forged exit topology reject before deployment', () => {
  for (const soldier of [
    arrival('p', 'E', {x: 0, y: 7}), arrival('p', 'W', {x: 2, y: 7}), arrival('p', 'west'),
    {id: 'p', entryEdge: 'W', entryAnchor: {x: 0, y: 7}}, {id: 'p', entryReason: 'teleport'},
  ]) assert.throws(() => enterSector(request('cordoba', {squad: [soldier]})), /entrada/);
  assert.throws(() => enterSector(request('cordoba', {exits: [{...sectorExits('cordoba')[0], destination: 'humahuaca'}]})), /salidas/);
});

test('initial contact runs after edge arrivals rather than at their historical spawn', () => {
  const req = request('cordoba', {hour: 0, exploration: true, squad: [arrival('p', 'E', {x: 19, y: 7}, {facing: 2})], enemies: [{id: 'e', overwatch: false}]});
  const n = enterSector(req);
  assert.equal(unit(n).x, 19);
  assert.equal(unit(n).facing, 6);
  assert.equal(n.mode, 'combat');
  assert.equal(n.elapsedSeconds, 0);
  assert.equal(n.phase, 'player');
});

test('source ledgers preserve local dead gear and exclude departed, captive, and dispersed records', () => {
  const ids = ['local', 'resident', 'departed', 'captured', 'dispersed', 'elsewhere'];
  const prior = enterSector(request('cordoba', {squad: [{id: 'old'}, ...ids.map(id => ({id, loaded: 1, ammo: 2, condition: 43, weaponInstanceId: `gun-${id}`}))]}));
  for (const id of ids) dead(unit(prior, id));
  prior.returnLedger = {battleId: prior.battleId, creditedCartridges: 0, entries: ids.map(id => ({unitId: id, kind: id === 'local' || id === 'elsewhere' ? 'dead' : id, sector: id === 'elsewhere' ? 'mendoza' : 'cordoba'}))};
  const n = enterSector(request('cordoba', {squad: [{id: 'new'}]}), prior);
  assert.deepEqual(n.units.map(u => u.id).sort(), ['local', 'new', 'resident']);
  for (const id of ['local', 'resident']) {
    assert.equal(unit(n, id).hp, 0);
    assert.equal(unit(n, id).ammo, 2);
    assert.equal(unit(n, id).loaded, 1);
    assert.equal(unit(n, id).condition, 43);
    assert.equal(unit(n, id).weaponInstanceId, `gun-${id}`);
  }
  assert.doesNotThrow(() => validateBattleSnapshot(n));
});

test('San Lorenzo resident and body ownership uses its San Nicolás strategic parent', () => {
  const prior = enterSector(request('san_lorenzo', {squad: [{id: 'resident'}, {id: 'body', loaded: 1, condition: 28}]}));
  Object.assign(unit(prior, 'resident'), {x: 11, y: 13});dead(unit(prior, 'body'));
  prior.returnLedger = {battleId: prior.battleId, creditedCartridges: 0, entries: [
    {unitId: 'resident', kind: 'resident', sector: 'san_nicolas'}, {unitId: 'body', kind: 'dead', sector: 'san_nicolas'},
  ]};
  const n = enterSector(request('san_lorenzo', {squad: [{id: 'resident', entryReason: 'resident'}]}), prior);
  assert.deepEqual([unit(n, 'resident').x, unit(n, 'resident').y], [11, 13]);
  assert.equal(unit(n, 'body').hp, 0);assert.equal(unit(n, 'body').loaded, 1);assert.equal(unit(n, 'body').condition, 28);
});

test('dead hired legacy records persist and a reused enemy ID receives a unique corpse identity', () => {
  const prior = enterSector(request('cordoba', {squad: [{id: 'dead-hired'}], enemies: [{id: 'enemy-0', loaded: 1, ammo: 3, condition: 29, weaponInstanceId: 'old-enemy-gun'}]}));
  dead(unit(prior, 'dead-hired'));dead(unit(prior, 'enemy-0'));prior.sectorCleared = true;
  const n = enterSector(request('cordoba', {squad: [{id: 'new'}], enemies: [{id: 'enemy-0', loaded: 1, weaponInstanceId: 'new-enemy-gun'}]}), prior);
  const corpse = n.units.find(u => u.originalUnitId === 'enemy-0');
  assert.ok(corpse);
  assert.equal(corpse.hp, 0);
  assert.equal(corpse.weaponInstanceId, 'old-enemy-gun');
  assert.equal(corpse.condition, 29);
  assert.equal(unit(n, 'enemy-0').weaponInstanceId, 'new-enemy-gun');
  assert.equal(unit(n, 'dead-hired').hp, 0);
  assert.equal(new Set(n.units.map(u => u.id)).size, n.units.length);
  assert.throws(() => enterSector(request('cordoba', {squad: [{id: 'dead-hired'}]}), prior), /fallecido/);
  assert.throws(() => enterSector(request('cordoba', {squad: [{id: 'new'}], enemies: [{id: 'enemy-0', weaponInstanceId: 'old-enemy-gun'}]}), prior), /identidad del equipo/);
  dead(unit(n, 'enemy-0'));n.sectorCleared = true;
  const third = enterSector(request('cordoba', {squad: [{id: 'new'}], enemies: [{id: 'enemy-0', weaponInstanceId: 'third-enemy-gun'}]}), n);
  assert.equal(third.units.filter(u => u.originalUnitId === 'enemy-0').length, 2);
  assert.equal(new Set(third.units.map(u => u.id)).size, third.units.length);
  assert.ok(third.units.some(u => u.weaponInstanceId === 'old-enemy-gun'));
  assert.ok(third.units.some(u => u.weaponInstanceId === 'new-enemy-gun'));
});

test('queued destination remains appear once at the arrival edge and never refill after re-entry', () => {
  const source = enterSector(request('mendoza', {squad: [{id: 'fallen', loaded: 1, ammo: 4, condition: 31, weaponInstanceId: 'fallen-gun', blade: 1813, bladeCondition: 44, bladeInstanceId: 'fallen-knife', inventory: {relic: {count: 1, weight: .2, weapon: 1820, condition: 12, loaded: 0, instanceId: 'relic'}}}]}));
  const corpse = dead(unit(source, 'fallen'));
  Object.assign(corpse, {entryReason: 'arrival', entryEdge: 'N', entryAnchor: {x: 12, y: 0}});
  corpse.lastKnownEnemy = {x: 1, y: 1, turn: 20};
  const remains = [{battleId: 'source-battle', unitId: 'fallen', unit: corpse, entryEdge: 'S', entryAnchor: {x: 9, y: 15}}];
  const req = request('cordoba', {squad: [arrival('rescuer', 'S', {x: 9, y: 15})], remains});
  const before = structuredClone(req), first = enterSector(req);
  assert.deepEqual(req, before);
  const body = unit(first, 'fallen');
  assert.equal(body.hp, 0);
  assert.equal(body.y, 15);
  assert.equal(body.loaded, 1);
  assert.equal(body.bladeCondition, 44);
  assert.equal(body.lastKnownEnemy, undefined);
  body.ammo = 0;body.loaded = 0;body.inventory = {};
  const again = enterSector(req, validateBattleSnapshot(JSON.parse(JSON.stringify(first))));
  assert.equal(again.units.filter(u => u.id === 'fallen').length, 1);
  assert.equal(unit(again, 'fallen').ammo, 0);
  assert.equal(unit(again, 'fallen').loaded, 0);
  assert.deepEqual(unit(again, 'fallen').inventory, {});
  assert.equal(unit(again, 'fallen').y, 15);
  assert.throws(() => enterSector({...req, remains: [remains[0], remains[0]]}), /restos pendientes/);
});
