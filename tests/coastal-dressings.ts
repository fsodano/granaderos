import {present} from './assert-present.ts';
import type { CampaignSnapshot, CampaignAction } from '../packages/game/public/campaign-types.ts';
import assert from 'node:assert/strict';
import { dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import { decodeSave, encodeSave } from '../packages/game/save.ts';
import { sectorInventoryModel } from '../packages/game/sector-inventory.js';
import { operativeLocation } from '../packages/game/squads.js';
import { contractExpiresSeconds, contractRenewalQuote } from '../packages/game/contracts.js';
import { previewStrategicRoute } from '../packages/game/strategic-route.js';
import { controlledPortAvailable } from './controlled-port-handover.ts';
import { supplyRouteDressings } from './route-dressings.ts';

const clock = (c: CampaignSnapshot) => c.hour * 3600 + (c.secondOfHour ?? 0);
const linen = (rows) => rows.filter((row) => JSON.parse(row.expected).item === 'medkits');

// A cleared capital retains its known finite battle supplies. A real serving
// physician carries only the local clinic deficit, then returns to his squad.
export function supplyCoastalDressings(
  start: CampaignSnapshot,
  id: number,
  target: number,
  { reserves = {}, report = () => {} } = {},
) {
  assert.ok(Number.isSafeInteger(target) && target >= 0 && target <= 100000);
  let c = decodeSave(encodeSave(start)).campaign;
  const before = structuredClone(start),
    origin = operativeLocation(c, id),
    orders = [],
    renewals = [],
    sources = [];
  const local = sectorInventoryModel(c, origin, rosterFor(c), id);
  assert.equal(local.reason, null);
  const donors = c.recruited.filter(
    (other) =>
      other !== id &&
      present(c.operativeState[other]).alive &&
      !present(c.operativeState[other]).captured &&
      operativeLocation(c, other) === origin &&
      !sectorInventoryModel(c, origin, rosterFor(c), other).reason,
  );
  const available =
      present(c.operativeState[id]).medkits +
      linen(local.entries)
        .filter((row) => row.reachable)
        .reduce((n, row) => n + row.count, 0) +
      donors.reduce(
        (n, other) => n + Math.max(0, present(c.operativeState[other]).medkits - (reserves[other] ?? 0)),
        0,
      ),
    missing = Math.max(0, target - available);
  if (missing) {
    const source = 'buenos_aires',
      protectedKits = Object.fromEntries(
        Object.entries(reserves)
          .filter(([other]) => Number(other) !== id)
          .map(([other]) => [other, present(c.operativeState[other]).medkits]),
      );
    assert.equal(origin, 'retiro');
    assert.equal(c.location, origin);
    assert.equal(c.pendingBattle, null);
    assert.equal(c.pendingEncounter, null);
    assert.equal(controlledPortAvailable(c, source), true);
    const known = linen(sectorInventoryModel(c, source, rosterFor(c), id).entries);
    assert.ok(
      known.reduce((n, row) => n + row.count, 0) >= missing,
      'The capital courier needs already known finite linen.',
    );
    const knownKeys = new Set(known.map((row) => row.key));
    const active = c.activeSquadId,
      home = c.squads.find((q) => q.members.includes(id) && !q.journey);
    assert.ok(home);
    const homeId = home.id,
      members = [...home.members],
      kitStart = present(c.operativeState[id]).medkits;
    const order = (action: CampaignAction) => {
      const seconds = clock(c),
        cash = c.resources.treasury;
      c = dispatchCampaign(c, action);
      assert.equal(c.lastError, null, JSON.stringify(action) + ': ' + c.lastError);
      orders.push({
        action,
        from: seconds,
        to: clock(c),
        cashBefore: cash,
        cashAfter: c.resources.treasury,
      });
    };
    order({ type: 'selectSquad', id: homeId });
    order({ type: 'squad', ids: [id] });
    order({ type: 'assignCare', operativeId: id, assignment: 'active' });
    const outbound = previewStrategicRoute(c, c.activeSquadId, source, 'posta');
    assert.equal(outbound.valid, true, outbound.reason);
    for (const other of c.recruited.filter(
      (other) => present(c.operativeState[other]).alive && !present(c.operativeState[other]).captured,
    )) {
      let expiry = contractExpiresSeconds(c.contracts[other]);
      assert.ok(expiry === null || expiry > clock(c));
      while (expiry !== null && expiry <= clock(c) + (outbound.hours * 2 + 1) * 3600) {
        const contract = c.contracts[other],
          quote = contractRenewalQuote(
            c,
            rosterFor(c).find((op) => op.id === other),
            'day',
          ),
          cash = c.resources.treasury;
        assert.equal(quote.available, true, quote.reason);
        order({
          type: 'renewContract',
          id: other,
          term: 'day',
          expectedExpiresAt: contract.expiresAt,
          expectedExpiresSecond: contract.expiresSecond ?? 0,
        });
        assert.equal(c.resources.treasury, cash - quote.price);
        assert.equal(contractExpiresSeconds(c.contracts[other]), expiry + quote.hours * 3600);
        renewals.push({ id: other, quote });
        expiry = contractExpiresSeconds(c.contracts[other]);
      }
    }
    const departed = clock(c);
    order({ type: 'travel', sector: source, mode: 'posta' });
    assert.equal(c.pendingEncounter, null);
    assert.equal(c.pendingBattle, null);
    assert.equal(c.location, source);
    assert.equal(clock(c) - departed, outbound.hours * 3600);
    while (present(c.operativeState[id]).medkits < kitStart + missing) {
      const model = sectorInventoryModel(c, source, rosterFor(c), id),
        row = linen(model.entries).find(
          (row) => knownKeys.has(row.key) && row.reachable && row.count > 0,
        );
      assert.ok(
        row,
        'The courier must reach an already known source; hidden stock cannot replace it.',
      );
      const count = Math.min(row.count, kitStart + missing - present(c.operativeState[id]).medkits),
        cash = c.resources.treasury,
        seconds = clock(c),
        kits = present(c.operativeState[id]).medkits;
      order({
        type: 'sectorInventory',
        sector: source,
        operativeId: id,
        direction: 'take',
        sourceKey: row.key,
        expected: row.expected,
        count,
      });
      assert.equal(present(c.operativeState[id]).medkits, kits + count);
      assert.equal(c.resources.treasury, cash);
      assert.equal(clock(c), seconds);
      assert.equal(
        sectorInventoryModel(c, source, rosterFor(c), id).entries.find(
          (next) => next.key === row.key,
        )?.count ?? 0,
        row.count - count,
      );
      sources.push({
        key: row.key,
        expected: row.expected,
        count,
        before: row.count,
        after: row.count - count,
      });
    }
    const returned = previewStrategicRoute(c, c.activeSquadId, origin, 'posta');
    assert.equal(returned.valid, true, returned.reason);
    assert.equal(
      returned.hours,
      outbound.hours,
      'This bounded local courier uses the actual symmetric capital road.',
    );
    order({ type: 'travel', sector: origin, mode: 'posta' });
    assert.equal(c.pendingEncounter, null);
    assert.equal(c.pendingBattle, null);
    assert.equal(c.location, origin);
    assert.equal(clock(c) - departed, (outbound.hours + returned.hours) * 3600);
    order({ type: 'squad', ids: members });
    order({ type: 'selectSquad', id: active });
    for (const [other, kits] of Object.entries(protectedKits)) {
      assert.equal(
        present(c.operativeState[other]).medkits,
        kits,
        'The reserved physician keeps his actual dressings during the courier.',
      );
    }
    report({
      event: 'coastalDressingCourier',
      operativeId: id,
      origin,
      source,
      missing,
      sources,
      orders,
      renewals,
      startSeconds: clock(start),
      endSeconds: clock(c),
      cashBefore: start.resources.treasury,
      cashAfter: c.resources.treasury,
    });
  }
  c = supplyRouteDressings(c, id, target, { reserves, report });
  for (const [other, kits] of Object.entries(reserves)) {
    if (Number(other) !== id) {
      assert.ok(
        present(c.operativeState[other]).medkits >= Math.min(kits, present(start.operativeState[other]).medkits),
      );
    }
  }
  for (const [other, r] of Object.entries(start.operativeState)) {
    if (!r.alive) {
      assert.equal(present(c.operativeState[other]).alive, false);
      assert.equal(present(c.operativeState[other]).deathMinute, r.deathMinute);
    }
  }
  assert.deepEqual(start, before);
  return decodeSave(encodeSave(c)).campaign;
}
