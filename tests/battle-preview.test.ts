import type { BattleWorkerJob } from '../packages/game/public/battle-job-types.ts';
import type {
  BattlePreviewKind,
  ReachablePreviewPoint,
} from '../packages/game/public/battle-preview-types.ts';
import { present } from './assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readBattlePreview } from '../apps/web/lib/battle-preview.ts';
import { createBattle } from '../packages/game/tactical.js';
import { runBattleJob } from '../packages/game/battle-job.ts';

function fixture() {
  return createBattle(
    [
      { id: 'a', x: 1, y: 2 },
      { id: 'b', x: 1, y: 3 },
    ],
    {
      width: 8,
      height: 8,
      exploration: true,
      enemies: [],
      tiles: Array.from({ length: 64 }, (_, index) => ({
        x: index % 8,
        y: Math.floor(index / 8),
        type: 'grass',
        blocked: false,
        cover: 0,
      })),
    },
  );
}

void test('preview admission preserves real routes and formation reports without changing the snapshot', () => {
  const battle = fixture();
  const before = structuredClone(battle);
  for (const job of [
    { battle, action: { unitId: 'a', previewBudget: true }, kind: 'reachable-preview' },
    { battle, action: { unitId: 'absent', previewBudget: true }, kind: 'reachable-preview' },
    {
      battle,
      action: { unitIds: ['a', 'b'], anchorId: 'a', x: 5, y: 2 },
      kind: 'group-preview',
    },
    {
      battle,
      action: { unitIds: ['a', 'b'], anchorId: 'a', x: -1, y: 2 },
      kind: 'group-preview',
    },
  ] satisfies BattleWorkerJob<BattlePreviewKind>[]) {
    const result = runBattleJob(job);
    assert.equal(readBattlePreview(job.kind, result), result);
    assert.deepEqual(battle, before);
  }
});

void test('a result for the wrong preview kind is refused', () => {
  assert.throws(
    () => readBattlePreview('reachable-preview', { ok: false, reason: 'Unavailable', members: [] }),
    /invalid preview/,
  );
  assert.throws(() => readBattlePreview('group-preview', []), /invalid preview/);
});

void test('empty routes and blocked formation members retain their exact refusal details', () => {
  const routes: ReachablePreviewPoint[] = [];
  assert.equal(readBattlePreview('reachable-preview', routes), routes);
  const battle = fixture();
  for (const tile of battle.tiles) {
    if (tile.x === 2) {
      Object.assign(tile, { type: 'wall', blocked: true, blocksSight: true });
    }
  }
  const before = structuredClone(battle);
  const formation = runBattleJob({
    battle,
    action: { unitIds: ['a'], anchorId: 'a', x: 6, y: 2 },
    kind: 'group-preview',
  });
  assert.equal(formation.ok, true);
  assert.equal(present(formation.members[0]).status, 'blocked');
  assert.equal(present(formation.members[0]).destination, null);
  assert.equal(readBattlePreview('group-preview', formation), formation);
  assert.deepEqual(battle, before);
});

void test('elevated route coordinates and climb metadata reach the renderer unchanged', () => {
  const route = [
    {
      x: 2,
      y: 3,
      tacticalLevel: 1,
      cost: 10,
      path: [{ x: 2, y: 3, tacticalLevel: 1, kind: 'climb', climbLinkId: 'ladder-1' }],
    },
  ];
  assert.equal(readBattlePreview('reachable-preview', route), route);
  assert.equal(present(present(route[0]).path[0]).climbLinkId, 'ladder-1');
});

void test('malformed fields cannot reach route or formation rendering', () => {
  for (const value of [
    null,
    [{ x: 1, y: 2, cost: NaN, path: [] }],
    [{ x: 1, y: 2, cost: 3, path: null }],
    [{ x: 1, y: 2, cost: 3, path: [null] }],
    [{ x: 1, y: 2, cost: 3, path: [{ x: '2', y: 2 }] }],
    [{ x: 1, y: 2, tacticalLevel: 'roof', cost: 3, path: [] }],
  ]) {
    assert.throws(() => readBattlePreview('reachable-preview', value), /invalid preview/);
  }
  for (const member of [
    { unitId: 'a', destination: null, path: null, cost: 0, reason: '' },
    { unitId: 'a', destination: null, path: [null], cost: 0, reason: '' },
    { unitId: 'a', destination: { x: Infinity, y: 2 }, path: [], cost: 0, reason: '' },
    { unitId: 7, destination: null, path: [], cost: 0, reason: '' },
    { unitId: 'a', destination: null, path: [], reason: '' },
    { unitId: 'a', destination: null, path: [], cost: Infinity, reason: '' },
  ]) {
    assert.throws(
      () => readBattlePreview('group-preview', { ok: true, reason: '', members: [member] }),
      /invalid preview/,
    );
  }
});
