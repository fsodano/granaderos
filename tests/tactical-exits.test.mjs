import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalEntryAnchor} from '../game/sector-expansion.js';
import {CAMPAIGN_SECTORS} from '../game/data.js';
import {sectorExits,findSectorExit,entryFromSector,exitAnchorFor,boundaryMatches,validEntry,inwardFromBoundary,validateSectorExits} from '../game/tactical-exits.js';
import {buildSectorMap} from '../game/maps.js';
import {createBattle,getReachable,movementStepCost} from '../game/tactical.js';

test('route definitions cover the exact campaign graph and use fresh stable descriptors', () => {
  let directed = 0;
  for (const sector of CAMPAIGN_SECTORS) {
    const exits = sectorExits(sector.id);
    assert.deepEqual(exits.map(e => e.destination).sort(), [...sector.neighbors].sort());
    assert.equal(new Set(exits.map(e => e.id)).size, exits.length);
    assert.equal(validateSectorExits(sector.id, null, exits), true);
    for (const exit of exits) {
      assert.equal(exit.id, `${sector.id}:${exit.destination}`);
      assert.deepEqual(findSectorExit(sector.id, null, exit.id), exit);
      assert.ok(sectorExits(exit.destination).some(e => e.destination === sector.id));
      directed++;
    }
    exits[0].entryAnchor.x = -1;
    assert.ok(sectorExits(sector.id).every(e => e.entryAnchor.x >= 0));
  }
  assert.equal(directed, 32);
});

test('scene exits return to their explicit parent without adding ordinary graph links', () => {
  assert.deepEqual(sectorExits('san_lorenzo'), [{id: 'san_lorenzo:san_nicolas', edge: 'S', destination: 'san_nicolas', entryEdge: 'N', entryAnchor: {x: 12, y: 0}}]);
  assert.deepEqual(sectorExits('tucuman', 'yatasto'), [{id: 'yatasto:tucuman', edge: 'S', destination: 'tucuman', entryEdge: 'N', entryAnchor: {x: 13, y: 0}}]);
  assert.equal(sectorExits('san_nicolas').some(e => e.destination === 'san_lorenzo'), false);
  assert.equal(sectorExits('tucuman').some(e => e.destination === 'yatasto'), false);
  for (const [sector, scene] of [['salta', 'yatasto'], ['unknown', null], ['yatasto', null], ['tucuman', 'unknown']]) {
    assert.deepEqual(sectorExits(sector, scene), []);
    assert.equal(validateSectorExits(sector, scene, []), false);
  }
});

test('new travel and mission entries use explicit target edges, not the opposite compass side', () => {
  for (const sector of CAMPAIGN_SECTORS) for (const exit of sectorExits(sector.id)) {
    assert.deepEqual(entryFromSector(sector.id, exit.destination), {entryEdge: exit.entryEdge, entryAnchor: exit.entryAnchor});
    assert.equal(validEntry(exit.edge, exitAnchorFor(sector.id, null, exit.id)), true);
  }
  assert.deepEqual(entryFromSector('salta', 'jujuy'), {entryEdge: 'E', entryAnchor: {x: 19, y: 7}});
  assert.deepEqual(entryFromSector('san_nicolas', 'san_lorenzo'), {entryEdge: 'S', entryAnchor: {x: 11, y: 15}});
  assert.deepEqual(entryFromSector('tucuman', 'tucuman', 'yatasto'), {entryEdge: 'S', entryAnchor: {x: 3, y: 15}});
  assert.equal(entryFromSector('buenos_aires', 'humahuaca'), null);
  assert.equal(entryFromSector('salta', 'tucuman', 'yatasto'), null);
  assert.equal(entryFromSector('tucuman', 'tucuman'), null);
});

test('every route enters a reachable road boundary with a legal inward step', () => {
  for (const [source, scene] of [...CAMPAIGN_SECTORS.map(s => [s.id, null]), ['san_lorenzo', null], ['tucuman', 'yatasto']]) {
    for (const exit of sectorExits(source, scene)) {
      const map = buildSectorMap({sector: exit.destination, squad: [{id: 'probe'}], enemies: [], exploration: true});
      const s = createBattle(map.squad, map), u = s.units[0],anchor=physicalEntryAnchor(exit.entryEdge,exit.entryAnchor,s.width,s.height,exit.destination);
      assert.equal(boundaryMatches(s, anchor, exit.entryEdge), true);
      assert.equal(s.tiles.find(t => t.x === anchor.x && t.y === anchor.y).type, 'road');
      assert.ok(getReachable(s, u).some(t => t.x === anchor.x && t.y === anchor.y), exit.id);
      assert.ok(Number.isFinite(movementStepCost(s, u, anchor, inwardFromBoundary(anchor, exit.entryEdge))));
    }
  }
});

test('boundary geometry rejects interior, fractional, outside, and malformed entries', () => {
  const state = {width: 20, height: 16};
  for (const [edge, point] of [['N', {x: 3, y: 0}], ['E', {x: 19, y: 5}], ['S', {x: 4, y: 15}], ['W', {x: 0, y: 9}]]) {
    assert.equal(boundaryMatches(state, point, edge), true);
    assert.equal(validEntry(edge, point), true);
    assert.equal(boundaryMatches(state, inwardFromBoundary(point, edge), edge), false);
  }
  for (const point of [null, {}, {x: 1, y: 1}, {x: 20, y: 0}, {x: -1, y: 0}, {x: .5, y: 0}]) assert.equal(boundaryMatches(state, point, 'N'), false);
  assert.equal(boundaryMatches(state, {x: 0, y: 0}, 'north'), false);
  assert.equal(validEntry('N', {x: 2, y: 0, interiorFallback: true}), false);
  assert.equal(validEntry('E', {x: 19, y: 3}, 10, 10), false);
});

test('authorized route subsets validate while forged topology and duplicate IDs reject', () => {
  const exits = sectorExits('buenos_aires');
  assert.equal(validateSectorExits('buenos_aires', null, []), true);
  assert.equal(validateSectorExits('buenos_aires', null, [exits[0]]), true);
  for (const bad of [
    [...exits, exits[0]], [{...exits[0], destination: 'humahuaca'}], [{...exits[0], edge: 'S'}],
    [{...exits[0], entryAnchor: {x: 2, y: 0}}], [{...exits[0], ignoreOccupancy: true}],
    [{...exits[0], entryEdge: 'N'}], [null], {}, null,
  ]) assert.equal(validateSectorExits('buenos_aires', null, bad), false);
});
