import { present } from './assert-present.ts';
import type { CampaignContent } from '../packages/campaign-format/types.ts';
import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import type { BattleUnit } from '../packages/game/public/compatibility-types.ts';
import type { ReachableCell } from '../packages/game/public/tactical-query-types.ts';
import type { ActiveGame } from './local-contract-fixture.ts';
import { fightOnArrival } from './assault-fixture.ts';
import assert from 'node:assert/strict';
import { initialCampaign } from '../packages/game/campaign.js';
import { defaultContentPackage } from '../packages/game/content-package.js';
import '../packages/game/world.js';
import { actBattle, getReachable } from '../packages/game/tactical.js';
import { advanceCampaignHours } from './campaign-wait-fixture.ts';
import { needsCollapseRecovery } from '../packages/game/fatigue.js';
import { tooTiredToMarch } from '../packages/game/march-fatigue.js';
import { previewStrategicRoute } from '../packages/game/strategic-route.js';
import { travelLegHours } from '../packages/game/squad-travel.js';
import { completeTestTravel } from './campaign-test-helpers.ts';
import { fight } from './battery-field-driver.ts';
import { order, saved, sync } from './local-contract-fixture.ts';
import { contentFixtureCache } from './content-fixture-cache.ts';
import { withStoredGear } from './commerce-gear-fixture.ts';
export function issuedBattery(content?: CampaignContent) {
  const d = content ? structuredClone(content) : defaultContentPackage();
  present(d.rules).startingTreasury = 10000;
  present(d.startingTerritory)['buenos_aires'] = { owner: 'patriot', loyalty: 65 };
  for (const id of [110, 114, 136, 141, 120, 131]) {
    present(d.characters.find((c) => c.id === `person-${id}`)).arrivalHours = 0;
  }
  let s = initialCampaign(8, d);
  for (const id of [110, 114, 136, 141, 120, 131]) {
    s = order(s, { type: 'recruitCivic', id, term: 'week' });
  }
  // Declared finite isolated battery stock, issued once by ordinary deployment.
  const money = s.resources.treasury;
  s = withStoredGear(s, 'swivel');
  assert.equal(s.resources.treasury, money);
  // This declared artillery scenario engages at 08:00. Use the current real
  // capital approach, staging and assault durations to choose its departure.
  const capital = previewStrategicRoute(s, present(s.activeSquadId), 'buenos_aires');
  assert.equal(capital.valid, true);
  const stagingHours = 2,
    departureWait =
      (8 -
        capital.hours -
        stagingHours -
        travelLegHours('buenos_aires', 'san_nicolas') -
        (s.hour % 24) +
        48) %
      24;
  if (departureWait) {
    s = advanceCampaignHours(s, departureWait);
  }
  s = completeTestTravel(s, { sector: 'buenos_aires' });
  // Stage for two hours after the march. Recovery, light, casualties and the
  // victory below all follow ordinary orders; no combat result is fabricated.
  s = advanceCampaignHours(s, stagingHours);
  s = fightOnArrival(order(s, { type: 'attack', sector: 'san_nicolas' }));
  assert.equal(s.hour % 24, 8);
  return s;
}
const victoryWithReserve = (reserveCharges: number) =>
  contentFixtureCache((content) => {
    const s = issuedBattery(content),
      result = fight(
        { ...present(s.pendingBattle), hour: s.hour, secondOfHour: s.secondOfHour ?? 0 },
        null,
        { scoutCostWeight: 0.01, avoidCivilians: true, reserveCharges },
      );
    assert.equal(result.battle.status, 'victory');
    assert.ok(result.actions > 0);
    assert.ok(
      present(result.battle.artillery[0]).ammo +
        Number(present(result.battle.artillery[0]).loaded) >=
        reserveCharges,
      'the declared tactic must retain its actual reserved charge',
    );
    const p = saved(sync({ campaign: s, battle: result.battle }));
    return saved({
      campaign: order(p.campaign, {
        type: 'battleResult',
        battleId: present(p.campaign.pendingBattle).id,
        outcome: 'victory',
        sectorState: p.battle,
        survivors: p.battle.units.filter((u) => u.side === 'player'),
      }),
    }).campaign;
  });
const reservedVictory = victoryWithReserve(1),
  fullConsumptionVictory = victoryWithReserve(0);
export function wonBattery(content?: CampaignContent, { reserveCharges = 1 } = {}) {
  assert.ok(
    reserveCharges === 0 || reserveCharges === 1,
    'declare either one retained charge or unrestricted firing',
  );
  return (reserveCharges ? reservedVictory : fullConsumptionVictory)(content);
}
export function fireStationed(p: ActiveGame): ActiveGame {
  const gun = present(p.battle.artillery[0]);
  let approach: { u: BattleUnit; spot: ReachableCell } | undefined;
  for (const u of p.battle.units.filter(
    (u) => u.side === 'player' && !u.militia && u.hp >= 15 && !u.unconscious && !u.routed,
  )) {
    const spot = getReachable(p.battle, u)
      .filter((q) => Math.hypot(q.x - gun.x, q.y - gun.y) <= 1.5)
      .sort((a, b) => a.cost - b.cost)[0];
    if (spot && (!approach || spot.cost < approach.spot.cost)) {
      approach = { u, spot };
    }
  }
  assert.ok(approach);
  let b = p.battle;
  if (approach.spot.cost) {
    b = actBattle(b, {
      type: 'move',
      unitId: approach.u.id,
      x: approach.spot.x,
      y: approach.spot.y,
    });
  }
  assert.equal(b.lastError, null);
  // The real victory can spend the loaded shot. Prepare the next shot using
  // only the surviving reserve; loading cannot create ammunition.
  if (!present(b.artillery.find((piece) => piece.id === gun.id)).loaded) {
    const remaining = present(b.artillery.find((piece) => piece.id === gun.id)).ammo;
    b = actBattle(b, { type: 'artilleryReload', unitId: approach.u.id, artilleryId: gun.id });
    assert.equal(b.lastError, null);
    const loaded = present(b.artillery.find((piece) => piece.id === gun.id));
    assert.equal(loaded.loaded, true);
    assert.equal(loaded.ammo, remaining - 1);
  }
  // Fire at a nearby empty exterior point. This spends an actual loaded shot;
  // it does not edit cannon state or assign a combat outcome.
  const target = b.tiles.filter(
    (t) =>
      !t.blocked &&
      !t.buildingId &&
      Math.hypot(t.x - gun.x, t.y - gun.y) >= 2 &&
      Math.hypot(t.x - gun.x, t.y - gun.y) <= 4 &&
      !b.units.some((u) => Math.hypot(u.x - t.x, u.y - t.y) < 2) &&
      !b.npcs.some((u) => Math.hypot(u.x - t.x, u.y - t.y) < 2),
  )[0];
  assert.ok(target);
  const current = present(b.artillery.find((piece) => piece.id === gun.id)),
    facing = Math.atan2(target.y - current.y, target.x - current.x);
  if (
    current.facing !== undefined &&
    Number.isFinite(current.facing) &&
    Math.abs(Math.atan2(Math.sin(facing - current.facing), Math.cos(facing - current.facing))) >
      Math.PI / 4
  ) {
    const before = structuredClone(current),
      seconds = present(b.elapsedSeconds);
    b = actBattle(b, {
      type: 'artilleryPivot',
      unitId: approach.u.id,
      artilleryId: gun.id,
      x: target.x,
      y: target.y,
    });
    assert.equal(b.lastError, null);
    const pivoted = present(b.artillery.find((piece) => piece.id === gun.id));
    assert.deepEqual({ ...pivoted, facing: before.facing }, before);
    assert.ok(
      present(b.elapsedSeconds) > seconds,
      'the ordinary pivot pays actual exploration work time',
    );
  }
  b = actBattle(b, {
    type: 'artillery',
    unitId: approach.u.id,
    artilleryId: gun.id,
    x: target.x,
    y: target.y,
    mode: 'solid',
  });
  assert.equal(b.lastError, null);
  assert.equal(present(b.artillery[0]).loaded, false);
  return saved(sync({ campaign: p.campaign, battle: b }));
}

// Depleted-boundary tests must spend the actual retained stock. A real victory
// can end before the gun fires, so its starting loaded round cannot be assumed.
export function exhaustStationed(pair: ActiveGame): ActiveGame {
  const initial = present(pair.battle.artillery[0]),
    count = Number(initial.loaded) + initial.ammo;
  assert.ok(
    Number.isInteger(count) && count > 0,
    'the retained piece must own a finite charge to spend',
  );
  let next = pair;
  for (let shot = 0; shot < count; shot++) {
    const before = structuredClone(
      present(next.battle.artillery.find((piece) => piece.id === initial.id)),
    );
    next = fireStationed(next);
    const after = next.battle.artillery.find((piece) => piece.id === initial.id);
    assert.ok(after);
    assert.equal(after.loaded, false);
    assert.equal(Number(after.loaded) + after.ammo, Number(before.loaded) + before.ammo - 1);
    assert.equal(after.ammo, before.ammo - (before.loaded ? 0 : 1));
  }
  assert.equal(present(next.battle.artillery.find((piece) => piece.id === initial.id)).ammo, 0);
  return next;
}

// Travel may end with exhausted soldiers asleep. Wait for real recovery, then
// issue wake orders before another departure; never edit fatigue or sleep state.
export function wakeBatteryCrew(state: CampaignSnapshot): CampaignSnapshot {
  let s = state;
  for (let attempt = 0; attempt < 48; attempt++) {
    for (const id of s.squad) {
      if (tooTiredToMarch(present(s.operativeState[id])) && !present(s.operativeState[id]).asleep) {
        s = order(s, { type: 'setSleep', operativeId: id, asleep: true });
      }
    }
    const sleeping = s.squad.filter(
      (id) => present(s.operativeState[id])?.alive && present(s.operativeState[id]).asleep,
    );
    if (!sleeping.length) {
      return s;
    }
    for (const id of sleeping) {
      if (
        !needsCollapseRecovery(present(s.operativeState[id])) &&
        !tooTiredToMarch(present(s.operativeState[id]))
      ) {
        s = order(s, { type: 'setSleep', operativeId: id, asleep: false });
      }
    }
    if (s.squad.every((id) => !present(s.operativeState[id]).asleep)) {
      return s;
    }
    s = advanceCampaignHours(s, 1);
  }
  assert.fail('The battery crew did not recover after 48 actual hours.');
}
