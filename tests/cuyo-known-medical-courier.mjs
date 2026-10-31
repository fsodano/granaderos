import assert from 'node:assert/strict';
import { rosterFor } from '../packages/game/campaign.js';
import { operativeLocation, operativeInTransit } from '../packages/game/squads.js';
import { sectorInventoryModel, sectorInventorySites } from '../packages/game/sector-inventory.js';
import { previewStrategicRoute } from '../packages/game/strategic-route.js';
import { applyItemQuantity, SUPPLY_ITEMS } from '../packages/game/tactical-inventory.js';
import { careAssignmentReason } from '../packages/game/medical-care.js';
import { contractExpiresSeconds } from '../packages/game/contracts.js';
import { tooTiredToMarch } from '../packages/game/march-fatigue.js';

const clock = (s) => s.hour * 3600 + (s.secondOfHour ?? 0);
const medicalRows = (s, sector, id) =>
  sectorInventorySites(s, sector).flatMap((site) =>
    sectorInventoryModel(s, site.id, rosterFor(s), id)
      .entries.filter((row) => JSON.parse(row.expected).item === 'medkits')
      .map((row) => ({ ...row, siteId: site.id })),
  );
const knownTotal = (s, sector, id) =>
  medicalRows(s, sector, id).reduce((sum, row) => sum + row.count, 0);
const ownedDonors = (s, sector, reserve) =>
  s.recruited.filter((id) => {
    const r = s.operativeState[id],
      expiry = contractExpiresSeconds(s.contracts[id]);
    if (
      !r?.alive ||
      r.captured ||
      !s.contracts[id] ||
      (expiry !== null && expiry <= clock(s)) ||
      operativeInTransit(s, id) ||
      operativeLocation(s, id) !== sector ||
      r.hp !== r.maxHp ||
      r.bleeding ||
      r.medkits <= reserve
    ) {
      return false;
    }
    const model = sectorInventoryModel(s, sector, rosterFor(s), id);
    return model.operativeId === id && !model.reason;
  });

// Carried stock is only a candidate. The real donor must still pay a local
// drop at courier arrival, then the carrier must quote that reachable parcel.
export function knownCuyoDressingSources(
  s,
  physicianId,
  { ownedCarried = false, donorReserve = 1 } = {},
) {
  assert.equal(typeof ownedCarried, 'boolean');
  assert.ok(Number.isSafeInteger(donorReserve) && donorReserve >= 1);
  const clinic = operativeLocation(s, physicianId);
  return Object.keys(s.sectors)
    .filter((at) => at !== clinic && s.sectors[at].owner === 'patriot')
    .map((at) => ({
      at,
      known: knownTotal(s, at, physicianId),
      owned: ownedCarried
        ? ownedDonors(s, at, donorReserve).reduce(
            (sum, id) => sum + s.operativeState[id].medkits - donorReserve,
            0,
          )
        : 0,
    }))
    .filter((source) => source.known + source.owned > 0);
}

// The caller supplies its ordinary paid-retained orders. The default reads
// only discovered inventory rows. The opt-in also admits real owned donations.
// The carrier physically brings both kinds of stock between the same towns.
// A new encounter or an unavailable path remains a real route interruption.
export function collectKnownCuyoDressings(
  read,
  order,
  physicianId,
  requested,
  { report = () => {}, ownedCarried = false, donorReserve = 1 } = {},
) {
  const start = read(),
    clinic = operativeLocation(start, physicianId),
    previous = start.activeSquadId;
  assert.ok(Number.isSafeInteger(requested) && requested > 0 && requested <= 1000);
  assert.equal(start.pendingBattle, null);
  assert.equal(start.pendingEncounter, null);
  assert.equal(start.sectors[clinic]?.owner, 'patriot', 'The actual clinic must be controlled.');
  assert.equal(start.routes.posta, true, 'The actual posta network must already be available.');
  assert.ok(
    start.recruited.includes(physicianId) &&
      start.operativeState[physicianId].alive &&
      !start.operativeState[physicianId].captured,
  );
  const local = start.recruited.filter(
    (id) =>
      operativeLocation(start, id) === clinic &&
      start.operativeState[id].alive &&
      !start.operativeState[id].captured,
  );
  assert.ok(
    local.every((id) => start.operativeState[id].hp >= 15 && !start.operativeState[id].bleeding),
    'Stabilize actual local acute patients before a medical supply trip.',
  );
  const sources = knownCuyoDressingSources(start, physicianId, {
    ownedCarried,
    donorReserve,
  }).filter((source) => source.known + source.owned >= requested);
  assert.ok(
    sources.length,
    'No known controlled finite medical source can supply this actual request.',
  );
  const parcel = { item: 'medkits', count: requested, weight: SUPPLY_ITEMS.medkits.weight };
  if (ownedCarried) {
    const model = sectorInventoryModel(start, clinic, rosterFor(start), physicianId);
    assert.equal(model.operativeId, physicianId);
    assert.equal(model.reason, null, model.reason);
    applyItemQuantity(model.personal, parcel);
  }
  const roomForParcel = (id) => {
    if (!ownedCarried) {
      return true;
    }
    const model = sectorInventoryModel(start, clinic, rosterFor(start), id);
    if (model.operativeId !== id || model.reason) {
      return false;
    }
    try {
      applyItemQuantity(model.personal, parcel);
      return true;
    } catch {
      return false;
    }
  };
  const carrier = rosterFor(start)
    .filter((op) => {
      const r = start.operativeState[op.id];
      return (
        op.id !== physicianId &&
        local.includes(op.id) &&
        !operativeInTransit(start, op.id) &&
        r.hp === r.maxHp &&
        !r.asleep &&
        (r.assignment === 'active' ||
          (ownedCarried &&
            ['rest', 'doctor'].includes(r.assignment) &&
            !careAssignmentReason(start, op, 'active'))) &&
        (r.energy ?? 100) > 50 &&
        (!ownedCarried || (!r.unconscious && !r.routed && !r.surrendered && !tooTiredToMarch(r))) &&
        roomForParcel(op.id)
      );
    })
    .sort(
      (a, b) =>
        start.operativeState[b.id].energy - start.operativeState[a.id].energy ||
        b.strength - a.strength ||
        a.id - b.id,
    )[0];
  assert.ok(
    carrier,
    ownedCarried
      ? 'An actual healthy awake local carrier with room for the complete parcel must fetch the known stock.'
      : 'An actual healthy awake local carrier must fetch the known stock.',
  );
  const home = start.squads.find((q) => q.members.includes(carrier.id) && !q.journey),
    assignment = start.operativeState[carrier.id].assignment;
  assert.ok(home, 'The actual carrier must have a stationary home squad.');
  const oldCarried = start.operativeState[carrier.id].medkits ?? 0,
    oldDoctor = start.operativeState[physicianId].medkits ?? 0,
    receipts = [];
  try {
    if (ownedCarried && assignment !== 'active') {
      order({ type: 'assignCare', operativeId: carrier.id, assignment: 'active' });
    }
    order({ type: 'createSquad', name: 'Vendas para Cuyo', ids: [carrier.id], sector: clinic });
    const courier = read().activeSquadId;
    const candidates = sources
      .map((source) => ({
        ...source,
        quote: previewStrategicRoute(read(), courier, source.at, 'posta'),
      }))
      .filter((source) => source.quote.valid)
      .sort((a, b) => a.quote.hours - b.quote.hours || a.at.localeCompare(b.at));
    const source = candidates[0];
    assert.ok(source, 'A current ordinary route must reach the known medical source.');
    const travel = (destination) => {
      const quote = previewStrategicRoute(read(), courier, destination, 'posta');
      assert.equal(quote.valid, true, quote.reason);
      assert.ok(
        quote.hours > 0 && quote.hours <= 48,
        'The known-source courier must have a bounded current trip.',
      );
      const began = clock(read());
      order(quote.action);
      assert.equal(clock(read()), began, 'A queued courier departure must not advance time.');
      let zeroTimeNotices = 0;
      for (let h = 0; read().squads.find((q) => q.id === courier)?.journey && h < 64; h++) {
        assert.equal(
          read().pendingEncounter,
          null,
          'Resolve the actual courier encounter before continuing.',
        );
        assert.equal(read().pendingBattle, null);
        const before = clock(read());
        order({ type: 'wait', hours: 1 });
        const elapsed = clock(read()) - before;
        assert.ok(
          elapsed >= 0 && elapsed <= 3600,
          'A normal courier wait cannot exceed its requested hour.',
        );
        zeroTimeNotices = elapsed === 0 ? zeroTimeNotices + 1 : 0;
        assert.ok(zeroTimeNotices < 3, 'The actual courier stopped on repeated zero-time notices.');
      }
      assert.ok(
        !read().squads.find((q) => q.id === courier)?.journey,
        'The actual quoted courier journey must finish.',
      );
      assert.equal(operativeLocation(read(), carrier.id), destination);
      assert.equal(read().location, destination);
      assert.equal(read().pendingEncounter, null);
      assert.equal(read().pendingBattle, null);
      receipts.push({
        event: 'cuyoKnownCourierArrival',
        carrier: carrier.id,
        destination,
        quote,
        departedSeconds: began,
        arrivedSeconds: clock(read()),
      });
    };
    const departure = clock(read());
    travel(source.at);
    let remaining = requested;
    while (remaining) {
      const s = read(),
        model = (site) => sectorInventoryModel(s, site, rosterFor(s), carrier.id);
      const row = medicalRows(s, source.at, carrier.id)
        .filter((row) => row.reachable && row.count > 0)
        .sort(
          (a, b) =>
            b.count - a.count || a.siteId.localeCompare(b.siteId) || a.key.localeCompare(b.key),
        )[0];
      if (!row && ownedCarried) {
        const donor = ownedDonors(s, source.at, donorReserve).find((id) => id !== carrier.id);
        assert.notEqual(
          donor,
          undefined,
          'The actual source must retain its admitted owned surplus.',
        );
        const before = s.operativeState[donor].medkits,
          count = Math.min(remaining, before - donorReserve),
          pool = knownTotal(s, source.at, carrier.id);
        order({
          type: 'sectorInventory',
          sector: source.at,
          operativeId: donor,
          direction: 'drop',
          item: 'medkits',
          count,
        });
        assert.equal(read().operativeState[donor].medkits, before - count);
        assert.ok(read().operativeState[donor].medkits >= donorReserve);
        assert.equal(knownTotal(read(), source.at, carrier.id), pool + count);
        receipts.push({
          event: 'cuyoKnownCourierDonation',
          donor,
          source: source.at,
          count,
          reserve: donorReserve,
        });
        continue;
      }
      assert.ok(row, 'The known source must still be physically reachable at the actual arrival.');
      const count = Math.min(remaining, row.count),
        pool = knownTotal(s, source.at, carrier.id),
        carried = s.operativeState[carrier.id].medkits ?? 0;
      applyItemQuantity(model(row.siteId).personal, { ...JSON.parse(row.expected), count });
      order({
        type: 'sectorInventory',
        sector: row.siteId,
        operativeId: carrier.id,
        direction: 'take',
        sourceKey: row.key,
        expected: row.expected,
        count,
      });
      assert.equal(read().operativeState[carrier.id].medkits, carried + count);
      assert.equal(
        knownTotal(read(), source.at, carrier.id),
        pool - count,
        'A compacted container row must still debit the exact same-site medical pool.',
      );
      receipts.push({
        event: 'cuyoKnownCourierPickup',
        carrier: carrier.id,
        source: source.at,
        siteId: row.siteId,
        sourceKey: row.key,
        expected: row.expected,
        count,
        knownBefore: pool,
        knownAfter: pool - count,
      });
      remaining -= count;
    }
    travel(clinic);
    order({ type: 'assignToSquad', operativeId: carrier.id, squadId: home.id });
    if (
      read()
        .squads.find((q) => q.id === home.id)
        .members.some((id, index) => id !== home.members[index])
    ) {
      order({ type: 'selectSquad', id: home.id });
      order({ type: 'squad', ids: home.members });
    }
    if (!ownedCarried && assignment !== 'active') {
      order({ type: 'assignCare', operativeId: carrier.id, assignment });
    }
    if (read().activeSquadId !== previous) {
      order({ type: 'selectSquad', id: previous });
    }
    order({
      type: 'sectorInventory',
      sector: clinic,
      operativeId: carrier.id,
      direction: 'drop',
      item: 'medkits',
      count: requested,
    });
    let delivered = 0;
    while (delivered < requested) {
      const s = read(),
        row = medicalRows(s, clinic, physicianId).find((row) => row.reachable && row.count > 0);
      assert.ok(row, 'The actual physician must reach the finite returned dressings.');
      const count = Math.min(requested - delivered, row.count);
      applyItemQuantity(sectorInventoryModel(s, row.siteId, rosterFor(s), physicianId).personal, {
        ...JSON.parse(row.expected),
        count,
      });
      order({
        type: 'sectorInventory',
        sector: row.siteId,
        operativeId: physicianId,
        direction: 'take',
        sourceKey: row.key,
        expected: row.expected,
        count,
      });
      delivered += count;
    }
    assert.equal(read().operativeState[carrier.id].medkits, oldCarried);
    assert.equal(read().operativeState[physicianId].medkits, oldDoctor + requested);
    if (ownedCarried && assignment !== 'active') {
      const current = read(),
        op = rosterFor(current).find((op) => op.id === carrier.id),
        restored = careAssignmentReason(current, op, assignment) ? 'rest' : assignment;
      order({ type: 'assignCare', operativeId: carrier.id, assignment: restored });
      receipts.push({
        event: 'cuyoKnownCourierAssignmentRestored',
        carrier: carrier.id,
        previous: assignment,
        assignment: restored,
      });
    }
    assert.equal(read().activeSquadId, previous);
    assert.equal(read().location, clinic);
    receipts.push({
      event: 'cuyoKnownCourierReturned',
      carrier: carrier.id,
      physician: physicianId,
      clinic,
      source: source.at,
      count: requested,
      elapsedSeconds: clock(read()) - departure,
      campaign: read(),
    });
    // Success summaries describe only the completed physical transfer.
    for (const receipt of receipts) {
      report(receipt);
    }
    return read();
  } catch (error) {
    if (ownedCarried) {
      error.campaign = read();
      report({ event: 'cuyoKnownCourierStopped', reason: error.message, campaign: read() });
    }
    throw error;
  }
}
