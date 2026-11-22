import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from './game-session.ts';
import { RandomSource } from '../shared/random-source.ts';

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

void test('a session created with a seed draws the sequence of that seed', () => {
  const game = GameSession.create('game-1', 1812);
  const expected = RandomSource.create(1812);
  assert.deepEqual(
    [game.randomSource.next(), game.randomSource.next(), game.randomSource.next()],
    [expected.next(), expected.next(), expected.next()],
  );
});

void test('a restored session repeats the random sequence it saved', () => {
  const game = GameSession.create('game-1', 1812);
  const restored = GameSession.restore(game.snapshot());
  assert.deepEqual(
    [restored.randomSource.next(), restored.randomSource.next(), restored.randomSource.next()],
    [game.randomSource.next(), game.randomSource.next(), game.randomSource.next()],
  );
});

void test('a snapshot without the random source is accepted and uses seed zero', () => {
  const { randomSource: _omitted, ...snapshot } = GameSession.create('game-1', 1812).snapshot();
  const restored = GameSession.restore(snapshot);
  const expected = RandomSource.create(0);
  assert.equal(restored.randomSource.next(), expected.next());
  assert.deepEqual(restored.snapshot().randomSource, expected.snapshot());
});

void test('the session snapshot carries the random source state', () => {
  const game = GameSession.create('game-1', 1812);
  const expected = RandomSource.create(1812);
  game.randomSource.next();
  expected.next();
  assert.deepEqual(game.snapshot().randomSource, expected.snapshot());
  assert.deepEqual(game.snapshot().randomSource, game.randomSource.snapshot());
});
