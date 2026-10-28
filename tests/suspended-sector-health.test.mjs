import assert from 'node:assert/strict';
import test from 'node:test';
import { Health } from '../packages/game/domain/personnel/health.ts';
import { advanceMilitaryWoundTime } from '../packages/game/military-health.js';
import { advanceBattleClock } from '../packages/game/time.js';
import { advanceSectorWorld, advanceSuspendedSectorConditions } from '../packages/game/military-remains.js';
import { initialCampaign } from './legacy-campaign-fixture.mjs';
import { dispatchCampaign } from '../packages/game/campaign.js';
import { enterSector } from '../packages/game/world.js';
import { validateEquipmentOwnership } from '../packages/game/equipment.js';
import { rosterFor } from '../packages/game/recruitment.js';
import { DEFAULT_CORPSE_LIFETIME_SECONDS } from '../packages/game/domain/world/corpse.ts';

function suspendedVisit() {
  const campaign = dispatchCampaign(initialCampaign(), { type: 'visitSector' });
  assert.equal(campaign.lastError, null);
  const request = structuredClone(campaign.pendingBattle);
  const snapshot = enterSector(request);
  snapshot.npcs = [];
  const wounded = snapshot.units.find((actor) => actor.side === 'player');
  wounded.hp = 20;
  wounded.bleeding = 3;
  wounded.bandaged = 0;
  const session = {
    request,
    snapshot,
    activeSquadId: campaign.activeSquadId,
    location: campaign.location,
    suspendedAtSeconds: 0,
  };
  campaign.pendingBattle = null;
  campaign.suspendedSectorSessions = [session];
  return { campaign, session, woundedId: wounded.id };
}

test('health applies finite bleeding and preserves the exact death tick', () => {
  const health = new Health({ current: 20, maximum: 100, bleeding: 3, bandaged: 40 });
  assert.deepEqual(health.advanceBleeding(2), {
    healthLost: 6,
    died: false,
    deathAfterTicks: null,
  });
  assert.deepEqual(health.advanceBleeding(20), { healthLost: 14, died: true, deathAfterTicks: 5 });
  assert.equal(health.alive, false);
  assert.equal(health.toSnapshot().bleeding, 0);
  assert.equal(health.advanceBleeding(20).healthLost, 0);
  assert.throws(() => new Health({ current: 101, maximum: 100, bleeding: 0, bandaged: 0 }));
  assert.throws(() => new Health({ current: 0, maximum: 100, bleeding: 2, bandaged: 0 }));
});

test('loaded and suspended military bleeding produce the same conditions without granting turns or AP', () => {
  const { campaign, session, woundedId } = suspendedVisit();
  const loaded = structuredClone(session.snapshot);
  const before = loaded.units.map((actor) => ({ id: actor.id, ap: actor.ap, maxAP: actor.maxAP }));
  const phase = loaded.phase;
  const turn = loaded.turn;
  advanceBattleClock(loaded, 120);
  advanceMilitaryWoundTime(loaded, 120);
  advanceSectorWorld(loaded, 120);
  advanceSuspendedSectorConditions(campaign, session, 120);
  assert.deepEqual(session.snapshot.units, loaded.units);
  assert.equal(session.snapshot.phase, phase);
  assert.equal(session.snapshot.turn, turn);
  for (const actor of session.snapshot.units) {
    const initial = before.find((value) => value.id === actor.id);
    assert.equal(actor.ap, actor.hp === 0 ? 0 : initial.ap);
    assert.equal(actor.maxAP, actor.hp === 0 ? 0 : initial.maxAP);
  }
  const casualty = session.snapshot.units.find((actor) => actor.id === woundedId);
  assert.equal(casualty.corpse.diedAtSecond, 42);
  assert.equal(campaign.operativeState[Number(woundedId)].alive, false);
  assert.equal(session.snapshot.elapsedSeconds, 120);
  assert.equal(session.request.syncedSeconds, 120);
  assert.equal(validateEquipmentOwnership(campaign, rosterFor(campaign)), true);
});

test('suspended death removal conserves custody through repeated progression', () => {
  const { campaign, session, woundedId } = suspendedVisit();
  advanceSuspendedSectorConditions(campaign, session, DEFAULT_CORPSE_LIFETIME_SECONDS + 42);
  assert.equal(
    session.snapshot.units.some((actor) => actor.id === woundedId),
    false,
  );
  const death = session.snapshot.deathHistory.find((death) => death.actor.id === woundedId);
  assert.equal(death.corpse.diedAtSecond, 42);
  assert.equal(death.corpse.removedAtSecond, DEFAULT_CORPSE_LIFETIME_SECONDS + 42);
  assert.equal(campaign.operativeState[Number(woundedId)].hp, 0);
  assert.equal(campaign.operativeState[Number(woundedId)].medkits, 0);
  assert.deepEqual(campaign.operativeState[Number(woundedId)].inventory, death.actor.inventory);
  const ground = structuredClone(session.snapshot.groundItems);
  advanceSuspendedSectorConditions(campaign, session, DEFAULT_CORPSE_LIFETIME_SECONDS + 42);
  assert.deepEqual(session.snapshot.groundItems, ground);
  assert.equal(validateEquipmentOwnership(campaign, rosterFor(campaign)), true);
});
