import type { CampaignSnapshot, CampaignAction } from '../packages/game/public/campaign-types.ts';
import { present } from './assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign } from './legacy-campaign-fixture.ts';
import { initialCampaign as freshCampaign, dispatchCampaign } from '../packages/game/campaign.js';
import { previewStrategicRoute } from '../packages/game/strategic-route.js';
import { defaultContentPackage } from '../packages/game/content-package.js';
import { worldCells, cellTravelReason } from '../packages/game/world-cells.ts';
import { encodeSave, decodeSave } from '../packages/game/save.ts';
import { launchEnemyGroup } from '../packages/game/enemy-groups.js';
const order = (s: CampaignSnapshot, a: CampaignAction) => {
  const next = dispatchCampaign(s, a);
  assert.equal(next.lastError, null);
  return next;
};
void test('map preview is read-only, queues the real multi-sector route and waits for the clock', () => {
  let s = initialCampaign();
  const original = structuredClone(s);
  const preview = previewStrategicRoute(s, s.activeSquadId, 'ensenada');
  assert.equal(preview.valid, true);
  assert.equal(preview.hours, 5);
  assert.deepEqual(preview.path, ['retiro', 'cell-27-29', 'cell-27-30', 'ensenada']);
  assert.deepEqual(s, original);
  // Sector snapshots can be large; preview must never traverse or copy them.
  Object.defineProperty(s, 'sectorStates', {
    get() {
      throw Error('Preview touched tactical snapshots');
    },
    configurable: true,
  });
  assert.equal(previewStrategicRoute(s, s.activeSquadId, 'ensenada').valid, true);
  s = order(original, present(preview.action));
  assert.equal(s.hour, 0);
  assert.equal(s.location, 'retiro');
  assert.deepEqual(present(present(s.squads[0]).journey).path, preview.path);
  s = decodeSave(encodeSave(s, null)).campaign;
  s = order(s, { type: 'advanceStrategicTime', seconds: 1800 });
  assert.equal(s.hour, 0);
  assert.equal(s.secondOfHour, 1800);
  assert.equal(s.location, 'retiro');
  assert.equal(present(present(s.squads[0]).journey).elapsedSecond, 1800);
  s = order(s, { type: 'advanceStrategicTime', seconds: 1800 });
  assert.equal(s.hour, 1);
  assert.equal(s.location, 'cell-27-29');
  assert.equal(present(present(s.squads[0]).journey).elapsed, 0);
});
void test('a selected second squad gets the plotted route without changing the first squad', () => {
  let s = order(initialCampaign(), { type: 'createSquad', name: 'Reserva', ids: [10] });
  const reserve = s.squads.find((q) => q.name === 'Reserva');
  s = order(s, { type: 'selectSquad', id: present(reserve).id });
  const first = structuredClone(s.squads[0]),
    preview = previewStrategicRoute(s, present(reserve).id, 'buenos_aires');
  assert.equal(preview.valid, true);
  s = order(s, present(preview.action));
  assert.deepEqual(s.squads[0], first);
  assert.deepEqual(
    present(present(s.squads.find((q) => q.id === present(reserve).id)).journey).path,
    ['retiro', 'cell-26-28', 'buenos_aires'],
  );
});
void test('blocked route previews explain refusals and valid redirection previews remain read-only', () => {
  const base = initialCampaign();
  const refusals: [(campaign: CampaignSnapshot) => void, string, RegExp][] = [
    [
      (s) => {
        s.pendingBattle = {
          ...present(order(s, { type: 'visitSector' }).pendingBattle),
          id: 'active',
        };
      },
      'buenos_aires',
      /táctico/,
    ],
    [
      (s) => {
        s.pendingEncounter = { id: 'route-blocking-encounter', sector: s.location };
      },
      'buenos_aires',
      /encuentro/,
    ],
    [
      (s: CampaignSnapshot) => {
        present(s.operativeState[3]).asleep = true;
      },
      'buenos_aires',
      /durmiendo/,
    ],
    [
      (s: CampaignSnapshot) => {
        present(s.operativeState[3]).assignment = 'doctor';
      },
      'buenos_aires',
      /asignación/,
    ],
    [() => {}, 'retiro', /ya está/],
    [() => {}, 'salta', /frente|vecino/],
  ];
  for (const [change, destination, pattern] of refusals) {
    const s = structuredClone(base);
    change(s);
    const before = structuredClone(s),
      p = previewStrategicRoute(s, s.activeSquadId, destination);
    assert.equal(p.valid, false);
    assert.match(present(p.reason), pattern);
    assert.deepEqual(s, before);
  }
  const s = order(base, { type: 'travel', sector: 'buenos_aires', queue: true }),
    before = structuredClone(s);
  const redirected = previewStrategicRoute(s, s.activeSquadId, 'ensenada');
  assert.equal(redirected.valid, true);
  assert.equal(present(redirected.action).type, 'redirectJourney');
  assert.deepEqual(s, before);
  assert.equal(previewStrategicRoute(freshCampaign(), 'squad-1', 'buenos_aires').valid, false);
});
void test('an adjacent enemy destination previews an assault and arrives at the boundary before combat', () => {
  let s = initialCampaign();
  present(s.sectors['buenos_aires']).owner = 'royalist';
  const p = previewStrategicRoute(s, s.activeSquadId, 'buenos_aires');
  assert.equal(p.valid, true);
  assert.equal(present(p.action).type, 'attack');
  assert.equal(p.hours, 2);
  s = order(s, present(p.action));
  assert.equal(s.pendingBattle, null);
  assert.equal(s.location, 'retiro');
  s = order(s, { type: 'wait', hours: 12 });
  assert.equal(s.hour, 2);
  assert.equal(present(present(s.squads[0]).journey).status, 'ready');
  assert.equal(s.location, 'retiro');
  assert.equal(s.pendingBattle, null);
});
void test('transport preview uses the selected transport duration and rejects unavailable transport', () => {
  const s = initialCampaign();
  assert.equal(previewStrategicRoute(s, s.activeSquadId, 'buenos_aires', 'posta').valid, false);
  s.routes['posta'] = true;
  assert.equal(previewStrategicRoute(s, s.activeSquadId, 'ensenada', 'posta').hours, 6);
});

for (const mode of ['march', 'posta', 'carts'] as const) {
  void test(`a naval blockade leaves ${mode} routes to an empty friendly coast available`, () => {
    const s = initialCampaign();
    present(s.sectors['san_nicolas']).owner = 'patriot';
    s.blockade = true;
    s.routes[mode] = true;
    const before = structuredClone(s),
      preview = previewStrategicRoute(s, s.activeSquadId, 'san_nicolas', mode);
    assert.equal(preview.valid, true, preview.reason ?? undefined);
    assert.equal(present(preview.action).type, 'travel');
    assert.ok(
      preview.path.length > 2,
      'the friendly destination permits a route with intermediate sectors',
    );
    assert.equal(preview.path.at(-1), 'san_nicolas');
    assert.deepEqual(s, before);
    const queued = order(s, present(preview.action)),
      journey = present(queued.squads.find((q) => q.id === s.activeSquadId)).journey;
    assert.deepEqual(present(journey).path, preview.path);
    assert.equal(present(journey).intent, undefined);
    assert.equal(queued.pendingBattle, null);
    assert.equal(queued.blockade, true);
    assert.equal(queued.hour, s.hour);
    assert.deepEqual(queued.resources, s.resources);
    assert.deepEqual(decodeSave(encodeSave(queued)).campaign.squads, queued.squads);
  });
}

void test('a naval blockade still refuses flotilla travel to an empty friendly coast', () => {
  const s = initialCampaign();
  present(s.sectors['san_nicolas']).owner = 'patriot';
  s.blockade = true;
  s.routes['flotilla'] = true;
  const before = structuredClone(s),
    preview = previewStrategicRoute(s, s.activeSquadId, 'san_nicolas', 'flotilla');
  const rejected = dispatchCampaign(s, {
    type: 'travel',
    sector: 'san_nicolas',
    mode: 'flotilla',
    queue: true,
  });
  assert.equal(preview.valid, false);
  assert.equal(preview.action, null);
  assert.equal(preview.reason, 'El transporte no está disponible.');
  assert.equal(rejected.lastError, preview.reason);
  assert.deepEqual({ ...rejected, lastError: null }, before);
  assert.deepEqual(s, before);
});

function occupiedCapital() {
  const s = initialCampaign();
  present(s.sectors['san_nicolas']).owner = 'patriot';
  s.routes['posta'] = true;
  launchEnemyGroup(s, 'coast', 'buenos_aires', { immediate: true });
  const occupied = order(s, { type: 'wait', hours: 1 });
  assert.equal(occupied.blockade, true);
  assert.equal(present(occupied.sectors['buenos_aires']).owner, 'patriot');
  assert.equal(present(occupied.enemyGroups[0]).status, 'stationed');
  return occupied;
}

void test('a stationed coastal force still blocks the post route through a friendly intermediate sector', () => {
  const s = occupiedCapital(),
    before = structuredClone(s),
    preview = previewStrategicRoute(s, s.activeSquadId, 'san_nicolas', 'posta');
  const rejected = dispatchCampaign(s, {
    type: 'travel',
    sector: 'san_nicolas',
    mode: 'posta',
    queue: true,
  });
  assert.equal(preview.valid, false);
  assert.equal(preview.action, null);
  assert.equal(preview.reason, 'La ruta está ocupada.');
  assert.equal(rejected.lastError, preview.reason);
  assert.deepEqual({ ...rejected, lastError: null }, before);
  assert.deepEqual(s, before);
});

void test('the map still prepares a counterattack against a stationed force in a friendly coastal sector', () => {
  const s = occupiedCapital(),
    before = structuredClone(s),
    preview = previewStrategicRoute(s, s.activeSquadId, 'buenos_aires', 'posta');
  assert.equal(preview.valid, true, preview.reason ?? undefined);
  assert.equal(present(preview.action).type, 'attack');
  assert.deepEqual(s, before);
  let attack = order(s, present(preview.action));
  assert.equal(present(present(attack.squads[0]).journey).intent, 'attack');
  assert.equal(attack.pendingBattle, null);
  attack = order(attack, { type: 'wait', hours: preview.hours });
  assert.equal(present(present(attack.squads[0]).journey).status, 'ready');
  attack = order(attack, { type: 'beginAssault', sector: 'buenos_aires' });
  assert.deepEqual(present(attack.pendingBattle).occupationGroupIds, [
    present(s.enemyGroups[0]).id,
  ]);
  assert.deepEqual(present(attack.pendingBattle).enemies, present(s.enemyGroups[0]).units);
  assert.equal(attack.blockade, true);
});

void test('hostile districts explain their existing main-sector restriction while anchors still admit attacks and liberated districts admit travel', () => {
  for (const liberated of [false, true]) {
    const content = defaultContentPackage();
    if (liberated) {
      present(present(content.startingTerritory)['buenos_aires']).owner = 'patriot';
    }
    const s = order(freshCampaign(42, content), { type: 'recruitCivic', id: 110, term: 'week' }),
      before = structuredClone(s),
      district = worldCells(s).find(
        (cell) => cell.locality === 'buenos_aires' && cell.location !== cell.locality,
      ),
      preview = previewStrategicRoute(s, s.activeSquadId, present(district).location),
      anchor = previewStrategicRoute(s, s.activeSquadId, 'buenos_aires');
    assert.equal(anchor.valid, true);
    assert.equal(present(anchor.action).type, liberated ? 'travel' : 'attack');
    assert.equal(present(anchor.action).sector, 'buenos_aires');
    if (liberated) {
      assert.equal(preview.valid, true);
      assert.equal(present(preview.action).type, 'travel');
      assert.equal(present(preview.action).sector, present(district).location);
    } else {
      assert.equal(preview.valid, false);
      assert.equal(preview.reason, cellTravelReason(s, present(district).location));
      assert.match(present(preview.reason), /Liberá su sector principal/);
      assert.equal(preview.action, null);
      assert.deepEqual(preview.path, []);
      assert.equal(preview.hours, 0);
    }
    assert.deepEqual(s, before);
  }
});
