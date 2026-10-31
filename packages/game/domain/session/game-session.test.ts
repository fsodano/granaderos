import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from './game-session.ts';

const first = { id: 'visit-a', sectorId: 'a', characterIds: ['1', '2'] };
const second = { id: 'visit-b', sectorId: 'b', characterIds: ['3'] };

void test('activating another sector suspends the previous visit and preserves registrations through restoration', () => {
  const game = GameSession.create('game-1');
  game.activateSectorSession(first);
  game.activateSectorSession(second);
  assert.equal(game.activeSectorSessionId, second.id);
  assert.deepEqual(game.suspendedSectorSessionIds, [first.id]);
  const restored = GameSession.restore(game.snapshot());
  restored.activateSectorSession(first);
  assert.equal(restored.activeSectorSessionId, first.id);
  assert.deepEqual(restored.suspendedSectorSessionIds, [second.id]);
  restored.closeSectorSession(first.id);
  assert.equal(restored.activeSectorSessionId, null);
  assert.deepEqual(restored.suspendedSectorSessionIds, [second.id]);
});

void test('a person and a sector each participate in one open visit and rejected activation is atomic', () => {
  const game = GameSession.create('game-1');
  game.activateSectorSession(first);
  const before = game.snapshot();
  assert.throws(
    () => game.activateSectorSession({ ...second, characterIds: ['2'] }),
    /duplicate-sector/,
  );
  assert.throws(
    () => game.activateSectorSession({ ...second, sectorId: first.sectorId }),
    /duplicate-sector/,
  );
  assert.throws(
    () => game.activateSectorSession({ ...first, characterIds: ['2'] }),
    /invalid-domain/,
  );
  assert.deepEqual(game.snapshot(), before);
});

void test('revision admission refuses stale input and serialized references cannot fabricate visits', () => {
  const game = GameSession.create('game-1');
  game.acceptRevision(0);
  assert.throws(() => game.acceptRevision(0), /revision-conflict/);
  assert.equal(game.revision, 1);
  assert.throws(
    () => GameSession.restore({ ...game.snapshot(), activeSectorSessionId: 'missing' }),
    /invalid-domain/,
  );
});
