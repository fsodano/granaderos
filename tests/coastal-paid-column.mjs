import assert from 'node:assert/strict';
import { dispatchCampaign, rosterFor, contractQuote } from '../packages/game/campaign.js';
import { decodeSave, encodeSave } from '../packages/game/save.ts';
import { sectorInventoryModel } from '../packages/game/sector-inventory.js';
import { BLADES } from '../packages/game/tactical.js';
import { contractExpiresSeconds } from '../packages/game/contracts.js';
import { previewStrategicRoute } from '../packages/game/strategic-route.js';
import { prepareCoastalReinforcements } from './coastal-reinforcements.mjs';
import { recoverRoutePrimary } from './route-owned-equipment.mjs';
import { supplyCoastalAmmunition } from './coastal-ammunition.mjs';
import { finishReloadsBeforeMarch } from './pre-march-reload.ts';

const clock = (c) => c.hour * 3600 + (c.secondOfHour ?? 0);
const saved = (c) => decodeSave(encodeSave(c)).campaign;

// Rehire affordable actual veterans beside their recovered finite property.
// Their separate paid column can march while the coastal battery is staged.
export function preparePaidCoastalColumn(
  start,
  { count = 4, destination = 'buenos_aires', keepServing = [], report = () => {} } = {},
) {
  const before = structuredClone(start),
    selection = start.activeSquadId,
    started = clock(start),
    events = [],
    orders = [],
    bookings = [],
    renewals = [];
  assert.equal(start.pendingBattle, null);
  assert.equal(start.pendingEncounter, null);
  const excluded = [
    ...start.recruited,
    ...rosterFor(start)
      .filter((op) => contractQuote(start, op, 'day').topTier)
      .map((op) => op.id),
  ];
  const recovered = prepareCoastalReinforcements(start, {
    excluded,
    count,
    stageReturnedItems: true,
    report,
  });
  let c = recovered.campaign;
  const ids = recovered.reinforcements,
    sites = [...new Set(recovered.receipts.map((row) => row.marker.sectorId))];
  assert.equal(
    sites.length,
    1,
    'the paid reserve must assemble beside its actual recovered property',
  );
  const origin = sites[0];
  const retained = new Set([...keepServing, ...ids]);
  const issue = (action) => {
    const cash = c.resources.treasury,
      time = clock(c),
      next = dispatchCampaign(c, action);
    assert.equal(next.lastError, null, JSON.stringify(action) + ': ' + next.lastError);
    c = next;
    orders.push(structuredClone(action));
    const row = {
      event: 'coastalPaidColumnOrder',
      action: structuredClone(action),
      cost: cash - c.resources.treasury,
      startSeconds: time,
      endSeconds: clock(c),
    };
    events.push(row);
    report(row);
  };
  const renew = (hours) => {
    for (const id of retained) {
      if (!c.recruited.includes(id)) {
        continue;
      }
      let expiry = contractExpiresSeconds(c.contracts[id]);
      while (expiry !== null && expiry <= clock(c) + hours * 3600) {
        const contract = c.contracts[id],
          price = contractQuote(
            c,
            rosterFor(c).find((op) => op.id === id),
            'day',
          ).price,
          cash = c.resources.treasury;
        issue({
          type: 'renewContract',
          id,
          term: 'day',
          expectedExpiresAt: contract.expiresAt,
          expectedExpiresSecond: contract.expiresSecond ?? 0,
        });
        assert.equal(c.resources.treasury, cash - price);
        renewals.push({ id, price });
        expiry = contractExpiresSeconds(c.contracts[id]);
      }
    }
  };
  for (const id of ids) {
    const quote = contractQuote(
        c,
        rosterFor(c).find((op) => op.id === id),
        'day',
      ),
      cash = c.resources.treasury;
    assert.equal(quote.available, true, quote.reason);
    assert.equal(quote.topTier, false);
    issue({ type: 'recruitCivic', id, term: 'day', destination: origin });
    assert.equal(c.resources.treasury, cash - quote.total);
    bookings.push({ id, quote, cost: quote.total, destination: origin });
  }
  for (let attempt = 0; attempt < 32 && !ids.every((id) => c.recruited.includes(id)); attempt++) {
    assert.equal(
      c.pendingEncounter,
      null,
      'the paid reserve must resolve any real arrival encounter',
    );
    renew(1);
    issue({ type: 'wait', hours: 1 });
  }
  assert.ok(
    ids.every((id) => c.recruited.includes(id) && c.operativeState[id].location === origin),
    'all paid reserves must actually arrive beside their property',
  );
  const squadIds = [];
  for (let offset = 0; offset < ids.length; offset += 6) {
    issue({
      type: 'createSquad',
      ids: ids.slice(offset, offset + 6),
      sector: origin,
      name: 'Reserva pagada de la costa',
    });
    squadIds.push(c.activeSquadId);
  }
  for (const id of ids) {
    if (c.operativeState[id].assignment !== 'active') {
      issue({ type: 'assignCare', operativeId: id, assignment: 'active' });
    }
  }
  for (const id of ids) {
    c = recoverRoutePrimary(c, id, { report });
    for (const slot of ['headwear', 'outfit', 'legwear', 'blade']) {
      const model = () => sectorInventoryModel(c, origin, rosterFor(c), id),
        personal = model().personal;
      if (slot === 'blade' ? personal.blade > 0 : personal[slot]?.condition > 0) {
        continue;
      }
      const matches = (record) =>
        slot === 'blade'
          ? !!BLADES[record.weapon]
          : record.kind === 'outfit' &&
            record.outfit === { headwear: 'hat', outfit: 'poncho', legwear: 'trousers' }[slot];
      let carried = model().carried.find(
        (row) =>
          row.inventoryKey &&
          row.expected &&
          matches(JSON.parse(row.expected)) &&
          row.equip.some((choice) => choice.slot === slot && choice.valid),
      );
      if (!carried) {
        const source = model().entries.find(
          (row) => row.reachable && matches(JSON.parse(row.expected)),
        );
        assert.ok(source, `the paid reserve ${id} needs finite local ${slot}`);
        const keys = new Set(model().carried.map((row) => row.inventoryKey));
        issue({
          type: 'sectorInventory',
          sector: origin,
          operativeId: id,
          direction: 'take',
          sourceKey: source.key,
          expected: source.expected,
          count: 1,
        });
        carried = model().carried.find(
          (row) =>
            row.inventoryKey &&
            !keys.has(row.inventoryKey) &&
            row.expected &&
            matches(JSON.parse(row.expected)),
        );
        assert.ok(carried);
      }
      issue({
        type: 'sectorInventory',
        sector: origin,
        operativeId: id,
        direction: 'equip',
        inventoryKey: carried.inventoryKey,
        expected: carried.expected,
        slot,
      });
    }
  }
  c = supplyCoastalAmmunition(c, ids, { target: 16, report }).campaign;
  for (const id of squadIds) {
    issue({ type: 'selectSquad', id });
    c = finishReloadsBeforeMarch(c, { report });
  }
  const routes = [];
  for (const id of squadIds) {
    issue({ type: 'selectSquad', id });
    const route = previewStrategicRoute(c, id, destination, 'posta');
    assert.equal(route.valid, true, route.reason);
    renew(route.hours);
    issue(route.action);
    assert.equal(c.squads.find((q) => q.id === id).journey.path.at(-1), destination);
    routes.push({ squadId: id, ...route });
  }
  issue({ type: 'selectSquad', id: selection });
  assert.equal(c.activeSquadId, selection);
  assert.equal(c.location, start.location);
  for (const [id, r] of Object.entries(start.operativeState)) {
    if (!r.alive) {
      assert.equal(c.operativeState[id].alive, false);
      assert.equal(c.operativeState[id].deathMinute, r.deathMinute);
    }
  }
  assert.deepEqual(start, before);
  c = saved(c);
  const receipt = {
    ids,
    origin,
    destination,
    squadIds,
    bookings,
    renewals,
    recovered: recovered.receipts,
    orders,
    events,
    routes,
    startSeconds: started,
    endSeconds: clock(c),
    cashBefore: start.resources.treasury,
    cashAfter: c.resources.treasury,
  };
  report({
    event: 'coastalPaidColumnQueued',
    ids,
    origin,
    destination,
    squadIds,
    routes,
    hour: c.hour,
    second: c.secondOfHour,
    treasury: c.resources.treasury,
  });
  return { campaign: c, ids, receipt };
}
