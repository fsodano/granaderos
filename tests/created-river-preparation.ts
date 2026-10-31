import { prepareRouteMixedBattery } from './route-battery.ts';
import { supplyRouteDressings } from './route-dressings.ts';
import { recoverRoutePrimary } from './route-owned-equipment.ts';
import assert from 'node:assert/strict';
import { dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import { contractQuote, contractExpiresSeconds } from '../packages/game/contracts.js';
import {
  artilleryTransportQuote,
  storedArtilleryRecord,
} from '../packages/game/artillery-transport.js';
import { recoverFreshPort } from './fresh-coastal-route.ts';
import { prepareCreatedRiverApproaches } from './created-river-approaches.ts';
import { supplyRouteAmmunition } from './route-ammunition.ts';
import { finishReloadsBeforeMarch } from './pre-march-reload.ts';
import { routeHiringCeiling } from './funded-route-fixture.ts';
import { recordRouteStrategicEvidence } from './route-strategic-failure-evidence.ts';
import { recoverRouteBodywear } from './route-owned-bodywear.ts';
import { preparePaidCoastalColumn } from './coastal-paid-column.ts';
import { sectorInventoryModel } from '../packages/game/sector-inventory.js';
import { carriedAmmunition } from '../packages/game/campaign-ammunition.js';
import { ammoCount } from '../packages/game/ammo-types.js';

// Reunite the real rear guard with the navy, then pay for available surviving
// local support. Every gun, rifle, dressing, arrival and renewal uses ordinary
// campaign actions before the coordinated river assault.
export function prepareCreatedRiverAssault(
  start,
  { report = () => {}, reinforcementCount = 0 } = {},
) {
  assert.ok(
    Number.isInteger(reinforcementCount) && reinforcementCount >= 0 && reinforcementCount <= 12,
  );
  const originalLiving = start.recruited.filter((id) => {
    const u = start.operativeState[id];
    return u.alive && !u.captured;
  });
  let c = start;
  const events = [];
  let reinforcements = [];
  if (reinforcementCount) {
    const column = preparePaidCoastalColumn(c, {
      count: reinforcementCount,
      destination: 'buenos_aires',
      keepServing: originalLiving,
      report,
    });
    c = column.campaign;
    reinforcements = column.ids;
    events.push(
      ...column.receipt.events.map((row) => ({
        action: row.action,
        hour: Math.floor(row.endSeconds / 3600),
        cost: row.cost,
      })),
    );
  }
  const living = [...originalLiving, ...reinforcements];
  // The conquered capital retains the real battle cartridges and dressings.
  // Collect them locally before leaving for the depleted river assembly.
  for (const id of living) {
    let expiry = contractExpiresSeconds(c.contracts[id]);
    while (expiry !== null && expiry <= c.hour * 3600 + (c.secondOfHour ?? 0) + 24 * 3600) {
      const contract = c.contracts[id],
        price = contractQuote(
          c,
          rosterFor(c).find((op) => op.id === id),
          'day',
        ).price,
        cash = c.resources.treasury,
        action = {
          type: 'renewContract',
          id,
          term: 'day',
          expectedExpiresAt: contract.expiresAt,
          expectedExpiresSecond: contract.expiresSecond ?? 0,
        };
      c = dispatchCampaign(c, action);
      assert.equal(c.lastError, null);
      assert.equal(c.resources.treasury, cash - price);
      events.push({ action, hour: c.hour, cost: price });
      expiry = contractExpiresSeconds(c.contracts[id]);
    }
  }
  c = recoverFreshPort(c, { hospital: 'buenos_aires', fieldIds: originalLiving, report });
  for (const id of living) {
    assert.ok(c.recruited.includes(id));
    assert.equal(c.operativeState[id].location, 'buenos_aires');
    assert.ok(!c.squads.find((q) => q.members.includes(id))?.journey);
  }
  c = recoverRouteBodywear(c, living, { report });
  for (const id of living) {
    if (
      c.operativeState[id].weaponDropped ||
      ![1800, 1801, 1802].includes(rosterFor(c).find((op) => op.id === id).weapon)
    ) {
      c = recoverRoutePrimary(c, id, { preferredWeapon: 1801, replace: true, report });
    }
  }
  const riflemen = rosterFor(c)
    .filter((op) => living.includes(op.id) && op.id !== 57)
    .sort((a, b) => b.marksmanship - a.marksmanship || a.id - b.id)
    .slice(0, 2);
  assert.equal(riflemen.length, 2);
  const rifleStock = () =>
    (c.ammunitionStores.buenos_aires?.ammoRifle ?? 0) +
    sectorInventoryModel(c, 'buenos_aires', rosterFor(c), riflemen[0].id)
      .entries.filter(
        (row) =>
          row.reachable &&
          JSON.parse(row.expected).kind === 'ammunition' &&
          JSON.parse(row.expected).ammoType === 'rifle_62',
      )
      .reduce((sum, row) => sum + row.count, 0);
  const rifleRoundsBefore = rifleStock();
  for (const op of riflemen) {
    c = recoverRoutePrimary(c, op.id, {
      preferredWeapon: 1802,
      strictPreference: true,
      replace: true,
      report,
    });
    assert.equal(rosterFor(c).find((u) => u.id === op.id).weapon, 1802);
  }
  const supplied = supplyRouteAmmunition(c, living, { target: 20, report });
  c = supplied.campaign;
  const rifleRoundsTaken = supplied.transactions
      .filter((row) => row.family === 'ammoRifle')
      .reduce((sum, row) => sum + row.quantity, 0),
    rifleRoundsAfter = rifleStock();
  assert.equal(rifleRoundsBefore - rifleRoundsAfter, rifleRoundsTaken);
  const rifleLoads = riflemen.map((op) => {
    const u = carriedAmmunition(
      rosterFor(c).find((unit) => unit.id === op.id),
      c.operativeState[op.id],
    );
    return { id: op.id, loaded: u.loaded, rounds: ammoCount(u) };
  });
  assert.ok(rifleLoads.every((u) => u.loaded + u.rounds >= 20));
  report({
    event: 'createdRiverRiflesPrepared',
    rifleRoundsBefore,
    rifleRoundsTaken,
    rifleRoundsAfter,
    rifleLoads,
  });
  const sourceDoctors = rosterFor(c)
      .filter((op) => living.includes(op.id) && op.medical >= 30)
      .sort((a, b) => b.medical - a.medical || a.id - b.id)
      .slice(0, 2),
    sourceReserves = Object.fromEntries(sourceDoctors.map((op) => [op.id, 10]));
  assert.equal(sourceDoctors.length, 2);
  for (const op of sourceDoctors) {
    if (c.operativeState[op.id].medkits < 10) {
      c = supplyRouteDressings(c, op.id, 10, { reserves: sourceReserves, report });
    }
  }
  // Dispatch the owned guns while their real crew is still at the source.
  // The rest of the force leaves in its ordinary squads before delivery waits.
  const outgoing = prepareRouteMixedBattery(c, 3, {
    destination: 'buenos_aires',
    keepServing: living,
    report,
  });
  c = outgoing.campaign;
  if (!c.routes.carts) {
    const next = dispatchCampaign(c, { type: 'transport', mode: 'carts' });
    assert.equal(next.lastError, null);
    c = next;
  }
  for (const gun of outgoing.records) {
    const quote = artilleryTransportQuote(c, 'buenos_aires', gun.id, 'cordoba', 'carts', 'depot');
    assert.equal(quote.available, true, quote.reason);
    const cash = c.resources.treasury,
      action = {
        type: 'transportArtillery',
        sector: 'buenos_aires',
        artilleryId: gun.id,
        to: 'cordoba',
        mode: 'carts',
        source: 'depot',
      };
    c = dispatchCampaign(c, action);
    assert.equal(c.lastError, null);
    assert.equal(c.resources.treasury, cash - quote.cost);
    assert.deepEqual(
      c.artilleryTransfers.find((t) => t.id === gun.id).gun,
      storedArtilleryRecord(gun),
    );
    events.push({ action, hour: c.hour, cost: quote.cost });
    report({
      event: 'createdRiverGunDispatched',
      id: gun.id,
      quote,
      record: storedArtilleryRecord(gun),
      hour: c.hour,
    });
  }
  c = recoverFreshPort(c, { hospital: 'cordoba', fieldIds: living, report });
  const field = c.recruited.filter((id) => {
    const u = c.operativeState[id];
    return u.alive && !u.captured && u.location === 'cordoba';
  });
  assert.ok(field.includes(57));
  assert.ok(field.length <= 48);
  assert.deepEqual(
    field.slice().sort((a, b) => a - b),
    living.slice().sort((a, b) => a - b),
    'every actual serving survivor must reach the river assembly',
  );
  const expectedFieldSize = Math.max(8, field.length);
  const order = (action) => {
    if (action.type === 'wait') {
      for (const id of field) {
        while (
          c.contracts[id]?.expiresAt != null &&
          c.contracts[id].expiresAt <= c.hour + action.hours
        ) {
          order({
            type: 'renewContract',
            id,
            term: 'day',
            expectedExpiresAt: c.contracts[id].expiresAt,
          });
        }
      }
    }
    const money = c.resources.treasury,
      next = dispatchCampaign(c, action);
    assert.equal(next.lastError, null, JSON.stringify(action) + ' ' + next.lastError);
    c = next;
    events.push({ action, hour: c.hour, cost: money - c.resources.treasury });
  };
  const candidates = rosterFor(c)
    .filter((op) => {
      const u = c.operativeState[op.id],
        q = contractQuote(c, op, 'day');
      return (
        op.id >= 100 &&
        op.id < 1000 &&
        !c.recruited.includes(op.id) &&
        u.alive &&
        !u.captured &&
        u.hp === u.maxHp &&
        !u.bleeding &&
        q.available &&
        q.price <= routeHiringCeiling(c, 100)
      );
    })
    .sort(
      (a, b) =>
        b.marksmanship - a.marksmanship ||
        contractQuote(c, a, 'day').price - contractQuote(c, b, 'day').price ||
        a.id - b.id,
    )
    .slice(0, Math.max(0, 8 - field.length));
  const fees = candidates.reduce((sum, op) => sum + contractQuote(c, op, 'week').price, 0);
  assert.ok(
    c.resources.treasury >= fees + 3000,
    'actual river support and finite supplies must fit the banked treasury',
  );
  for (const op of candidates) {
    const q = contractQuote(c, op, 'week'),
      money = c.resources.treasury;
    order({ type: 'recruitCivic', id: op.id, term: 'week', destination: 'cordoba' });
    assert.equal(c.resources.treasury, money - q.price);
    field.push(op.id);
  }
  assert.equal(
    field.length,
    expectedFieldSize,
    'the batteries require at least eight actual arriving people, including every earned survivor',
  );
  for (let h = 0; h < 24 && field.some((id) => !c.recruited.includes(id)); h++) {
    order({ type: 'wait', hours: 1 });
  }
  assert.ok(
    field.every((id) => c.recruited.includes(id) && c.operativeState[id].location === 'cordoba'),
  );
  const groups = [];
  for (let offset = 0; offset < field.length; offset += 6) {
    order({
      type: 'createSquad',
      ids: field.slice(offset, offset + 6),
      sector: 'cordoba',
      name: 'Columna del río',
    });
    groups.push(c.activeSquadId);
  }
  for (const id of field) {
    order({ type: 'assignCare', operativeId: id, assignment: 'rest' });
  }
  for (let h = 0; h < 600 && field.some((id) => c.operativeState[id].morale < 65); h++) {
    assert.equal(c.pendingEncounter, null);
    order({ type: 'wait', hours: 1 });
  }
  assert.ok(
    field.every((id) => c.operativeState[id].morale >= 65),
    'actual paid rest must restore the complete assembled column',
  );
  for (const id of field) {
    const op = rosterFor(c).find((op) => op.id === id);
    if (c.operativeState[id].weaponDropped || ![1800, 1801, 1802].includes(op.weapon)) {
      c = recoverRoutePrimary(c, id, { preferredWeapon: 1801, replace: true, report });
    }
    order({ type: 'assignCare', operativeId: id, assignment: 'active' });
  }
  c = supplyRouteAmmunition(c, field, { target: 20 }).campaign;
  order({ type: 'configureArtillery', types: [] });
  for (const group of groups) {
    order({ type: 'selectSquad', id: group });
    c = finishReloadsBeforeMarch(c);
  }
  const doctors = rosterFor(c)
    .filter((op) => field.includes(op.id) && op.medical >= 30)
    .sort((a, b) => b.medical - a.medical || a.id - b.id)
    .slice(0, 2);
  assert.equal(doctors.length, 2);
  const medicalReserves = Object.fromEntries(doctors.map((op) => [op.id, 10]));
  for (const op of doctors) {
    if (c.operativeState[op.id].medkits < 10) {
      c = supplyRouteDressings(c, op.id, 10, { reserves: medicalReserves, report });
    }
  }
  assert.ok(doctors.every((op) => c.operativeState[op.id].medkits >= 10));
  for (
    let h = 0;
    h < 48 &&
    outgoing.records.some(
      (gun) => !c.artilleryDepots.cordoba?.some((stored) => stored.id === gun.id),
    );
    h++
  ) {
    assert.equal(c.pendingEncounter, null);
    order({ type: 'wait', hours: 1 });
  }
  for (const gun of outgoing.records) {
    assert.deepEqual(
      c.artilleryDepots.cordoba?.find((stored) => stored.id === gun.id),
      storedArtilleryRecord(gun),
      'every finite dispatched piece must really arrive without ammunition changes',
    );
  }
  order({ type: 'selectSquad', id: groups[0] });
  recordRouteStrategicEvidence({
    helper: 'prepareCreatedRiverAssault',
    stage: 'river-battery-input',
    campaign: c,
    context: { field, doctors: doctors.map((op) => op.id) },
  });
  const battery = prepareRouteMixedBattery(c, 3, {
    destination: 'cordoba',
    keepServing: field,
    report,
  });
  c = battery.campaign;
  for (const id of field) {
    order({ type: 'assignCare', operativeId: id, assignment: 'rest' });
  }
  for (
    let h = 0;
    h < 48 &&
    field.some((id) => {
      const u = c.operativeState[id];
      return u.energy < 100 || u.fatigue || u.asleep;
    });
    h++
  ) {
    order({ type: 'wait', hours: 1 });
  }
  for (const id of field) {
    const u = c.operativeState[id];
    assert.ok(u.hp === u.maxHp && !u.bleeding && u.energy === 100 && !u.fatigue && !u.asleep);
    order({ type: 'assignCare', operativeId: id, assignment: 'active' });
  }
  order({ type: 'configureArtillery', types: battery.selections });
  c = prepareCreatedRiverApproaches(c, field, { report });
  assert.equal(c.pendingBattle.squad.length, expectedFieldSize);
  assert.deepEqual(
    c.pendingBattle.squad.map((u) => u.id).sort((a, b) => a - b),
    field.slice().sort((a, b) => a - b),
  );
  assert.equal(c.pendingBattle.artillery.filter((g) => !g.stationed).length, 3);
  for (const [id, u] of Object.entries(start.operativeState)) {
    if (!u.alive) {
      assert.equal(c.operativeState[id].alive, false);
    }
  }
  report({
    event: 'createdRiverAssaultReady',
    hour: c.hour,
    treasury: c.resources.treasury,
    field,
    doctors: doctors.map((op) => op.id),
    fees,
    events,
  });
  return c;
}
