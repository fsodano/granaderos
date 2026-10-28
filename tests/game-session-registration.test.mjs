import test from 'node:test';
import assert from 'node:assert/strict';
import {
  restoreGameSession,
  sectorSessionRegistration,
} from '../packages/game/infrastructure/session/campaign-game-session-mapper.js';

const request = (id, sector, characterId, overrides = {}) => ({
  id,
  sector,
  squad: [{ id: characterId }],
  ...overrides,
});
const campaign = (active, suspended) => ({
  gameSessionId: 'registrations',
  gameRevision: 0,
  pendingBattle: active,
  suspendedSectorSessions: [{ request: suspended }],
});

test('one persistent mission ally cannot participate in two open visits', () => {
  const active = request('visit-a', 'sector-a', 1, { missionAllies: [{ id: 99 }] });
  const suspended = request('visit-b', 'sector-b', 2, { missionAllies: [{ id: 99 }] });
  assert.throws(
    () => restoreGameSession(campaign(active, suspended)),
    /duplicate-sector-participation/,
  );
  assert.throws(
    () => restoreGameSession(campaign(active, request('visit-b', 'sector-b', 99))),
    /duplicate-sector-participation/,
  );
});

test('garrison identity is persistent and generated enemy labels are scoped to a visit', () => {
  const active = request('visit-a', 'sector-a', 1, {
    garrison: [{ id: 20000 }],
    enemies: [{ id: 'guard-1' }],
  });
  const suspended = request('visit-b', 'sector-b', 2, {
    garrison: [{ id: 20001 }],
    enemies: [{ id: 'guard-1' }],
  });
  const game = restoreGameSession(campaign(active, suspended));
  assert.equal(game.snapshot().sectorSessions.length, 2);
  assert.deepEqual(sectorSessionRegistration(active).characterIds, [
    '1',
    '20000',
    'visit:visit-a:enemy:guard-1',
  ]);
  suspended.garrison[0].id = 20000;
  assert.throws(
    () => restoreGameSession(campaign(active, suspended)),
    /duplicate-sector-participation/,
  );
});

test('a request cannot issue one persistent character twice in different participant roles', () => {
  const active = request('visit-a', 'sector-a', 1, { missionAllies: [{ id: 1 }] });
  assert.throws(
    () =>
      restoreGameSession({
        gameSessionId: 'duplicate-issue',
        gameRevision: 0,
        pendingBattle: active,
      }),
    /invalid-domain-value/,
  );
});
