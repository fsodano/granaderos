import { stabilizeStockMendozaSurvivors } from './created-cuyo-route.mjs';
import assert from 'node:assert/strict';
import { rosterFor } from '../packages/game/campaign.js';
import { contractQuote } from '../packages/game/contracts.js';
import { decodeSave, encodeSave } from '../packages/game/save.ts';
import { carriedAmmunition } from '../packages/game/campaign-ammunition.js';
import { ammoTypeFor } from '../packages/game/ammo-types.js';
import { enterSector } from '../packages/game/world.js';
import { bookRouteHires, finishRouteHireArrivals } from './paid-route-hiring.ts';
import { recoverRoutePrimary } from './route-owned-equipment.mjs';
import { supplyRouteAmmunition } from './route-ammunition.ts';
import { finishReloadsBeforeMarch } from './pre-march-reload.ts';
import { transferRouteSupply } from './route-ammunition-transfer.mjs';
import { prepareFinalAssault } from './final-campaign-route.mjs';
import { fightNorthernSector, northernCombatOrder } from './northern-route.mjs';

const available = (c, id, sector) =>
  c.recruited.includes(id) &&
  c.operativeState[id].alive &&
  !c.operativeState[id].captured &&
  c.operativeState[id].location === sector;
const stable = (r) => r.hp >= 15 && !r.bleeding && !r.asleep;
const unusedHires = (c) =>
  rosterFor(c).filter(
    (op) =>
      op.id >= 100 &&
      op.id < 1000 &&
      !c.recruited.includes(op.id) &&
      !c.hiringArrivals.some((row) => row.operativeId === op.id) &&
      c.operativeState[op.id].alive &&
      !c.operativeState[op.id].captured &&
      !c.operativeState[op.id].startingCartridgesIssued &&
      contractQuote(c, op, 'week').available &&
      contractQuote(c, op, 'week').total <= c.resources.treasury,
  );

// Restore every actual cut locality on an existing owned gun's route.
// The callers supply their ordinary service and care controllers; this module
// does not create an alternative campaign, restock a gun or rewrite a battle.
export function recaptureFoundryConvoy(
  start,
  { transferId, createOrders, recoverPatients, report = () => {} } = {},
) {
  assert.equal(typeof createOrders, 'function');
  assert.equal(typeof recoverPatients, 'function');
  const before = structuredClone(start),
    origin = start.activeSquadId,
    transfer = structuredClone(start.artilleryTransfers.find((row) => row.id === transferId));
  assert.ok(transfer);
  assert.equal(start.location, 'mendoza');
  assert.equal(transfer.to, 'cordoba');
  const reverse = [...transfer.path].reverse();
  assert.equal(reverse[0], 'cordoba');
  assert.equal(start.sectors.cordoba.owner, 'patriot');
  let c = decodeSave(encodeSave(start)).campaign;
  const checkpoints = [],
    battleRecords = [],
    temporaryHires = [];
  const save = (stage) => {
    assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
    const row = { stage, campaign: structuredClone(c) };
    checkpoints.push(row);
    report({ event: 'foundryConvoyCheckpoint', ...row });
  };
  const newDoctor = unusedHires(c)
    .filter((op) => op.medical >= 60)
    .sort((a, b) => b.medical - a.medical || a.id - b.id)[0];
  let physicianId;
  if (newDoctor) {
    const booked = bookRouteHires(c, [newDoctor.id], {
      term: 'week',
      destination: 'mendoza',
      report,
    });
    c = finishRouteHireArrivals(booked.campaign, booked.hires, { minimumWaitHours: 0, report });
    physicianId = newDoctor.id;
    temporaryHires.push(
      ...booked.hires.map((hire) => ({ ...structuredClone(hire), purpose: 'convoy-physician' })),
    );
  } else {
    physicianId = rosterFor(c)
      .filter(
        (op) =>
          available(c, op.id, 'mendoza') &&
          stable(c.operativeState[op.id]) &&
          op.medical >= 60 &&
          c.operativeState[op.id].medkits > 0,
      )
      .sort((a, b) => b.medical - a.medical)[0]?.id;
  }
  assert.notEqual(
    physicianId,
    undefined,
    'A real supplied serving physician must accompany the convoy recovery.',
  );
  let retained = createOrders(
    () => c,
    (next) => {
      c = next;
    },
    { report },
  );
  const order = (action) => retained.order(action);
  const local = (sector) => c.recruited.filter((id) => id !== 2 && available(c, id, sector));
  const ready = (sector, { ammunition = false } = {}) => {
    const field = local(sector);
    assert.ok(
      field.length >= 12 && field.length <= 48,
      'The actual surviving field needs sufficient real personnel.',
    );
    assert.ok(field.every((id) => c.operativeState[id].hp >= 15 && !c.operativeState[id].bleeding));
    const columns = [];
    for (let offset = 0; offset < field.length; offset += 6) {
      order({
        type: 'createSquad',
        name: 'Recuperación del convoy',
        ids: field.slice(offset, offset + 6),
        sector,
      });
      columns.push(c.activeSquadId);
    }
    for (const operativeId of field) {
      order({ type: 'assignCare', operativeId, assignment: 'rest' });
    }
    for (
      let hours = 0;
      hours < 48 &&
      field.some(
        (id) =>
          c.operativeState[id].energy < 100 ||
          c.operativeState[id].fatigue ||
          c.operativeState[id].asleep,
      );
      hours++
    ) {
      order({ type: 'wait', hours: 1 });
    }
    for (const id of field) {
      assert.ok(
        c.operativeState[id].energy === 100 &&
          !c.operativeState[id].fatigue &&
          !c.operativeState[id].asleep,
      );
    }
    for (const id of columns) {
      order({ type: 'selectSquad', id });
      for (const operativeId of c.squad) {
        order({ type: 'assignCare', operativeId, assignment: 'active' });
      }
      if (ammunition) {
        c = supplyRouteAmmunition(c, c.squad, { target: 12, report }).campaign;
      }
      c = finishReloadsBeforeMarch(c, { report, readyPrimary: true });
    }
    order({ type: 'configureArtillery', types: [] });
    return field;
  };
  for (const id of local('mendoza')) {
    const carried = carriedAmmunition(
      rosterFor(c).find((op) => op.id === id),
      c.operativeState[id],
    );
    c = recoverRoutePrimary(c, id, {
      replace: !['ammoMusket', 'ammoRifle'].includes(ammoTypeFor(carried)),
      report,
    });
  }
  let field = ready('mendoza', { ammunition: true });
  save('initial-field-ready');
  for (let index = 1; index < reverse.length; index++) {
    const target = reverse[index],
      staging = reverse[index - 1];
    if (c.sectors[target].owner === 'patriot') {
      continue;
    }
    assert.equal(c.sectors[staging].owner, 'patriot');
    if (battleRecords.length) {
      c = recoverPatients(c, { report });
      save('between-localities-care');
      if (!available(c, physicianId, c.location) || !stable(c.operativeState[physicianId])) {
        physicianId = rosterFor(c)
          .filter(
            (op) =>
              available(c, op.id, c.location) &&
              stable(c.operativeState[op.id]) &&
              op.medical >= 20,
          )
          .sort((a, b) => b.medical - a.medical)[0]?.id;
      }
      assert.notEqual(
        physicianId,
        undefined,
        'The actual surviving force needs an available physician.',
      );
      const missing = Math.max(0, 4 - c.operativeState[physicianId].medkits),
        fieldMissing = Math.max(0, 12 - local(c.location).length),
        hires = [];
      for (let quantity = 0; quantity < missing || hires.length < fieldMissing;) {
        const guard = unusedHires(c)
          .filter((op) => quantity >= missing || c.operativeState[op.id].medkits > 0)
          .sort((a, b) => b.marksmanship - a.marksmanship || a.id - b.id)[0];
        assert.ok(
          guard,
          'Actual unused paid guards must supply the remaining personnel and finite field dressings.',
        );
        const booked = bookRouteHires(c, [guard.id], {
          term: 'week',
          destination: c.location,
          report,
        });
        c = booked.campaign;
        hires.push(...booked.hires);
        quantity += c.operativeState[guard.id].medkits;
      }
      if (hires.length) {
        c = finishRouteHireArrivals(c, hires, { minimumWaitHours: 0, report });
        temporaryHires.push(
          ...hires.map((hire) => ({
            ...structuredClone(hire),
            purpose: 'convoy-replacement-and-dressings',
          })),
        );
        if (missing) {
          c = transferRouteSupply(c, {
            sector: c.location,
            recipientId: physicianId,
            donorIds: hires.map((row) => row.id),
            item: 'medkits',
            count: missing,
            report,
          }).campaign;
        }
        for (const hire of hires) {
          c = recoverRoutePrimary(c, hire.id, { report });
        }
      }
      retained = createOrders(
        () => c,
        (next) => {
          c = next;
        },
        { report },
      );
      field = ready(c.location);
    }
    c = prepareFinalAssault(retained.retain(7 * 24 * 3600), {
      staging,
      target,
      fieldIds: field,
      daylight: true,
    });
    report({
      event: 'foundryConvoyAssaultReady',
      sector: target,
      campaign: structuredClone(c),
      battle: enterSector(c.pendingBattle, c.sectorStates[target]),
    });
    const won = fightNorthernSector(c, target, { controller: northernCombatOrder, report });
    c = won.campaign;
    // The retained service set is for the living force after actual settlement.
    // Native battle deaths remain permanent; they cannot receive later orders.
    retained = createOrders(
      () => c,
      (next) => {
        c = next;
      },
      { report },
    );
    battleRecords.push(won.summary);
    save('recaptured-' + target);
  }
  assert.ok(transfer.path.every((sector) => c.sectors[sector].owner === 'patriot'));
  // The final cut has no following between-localities clinic. Stabilize its
  // actual local and escaped survivors before any convoy or return wait.
  if (
    c.recruited.some(
      (id) =>
        c.operativeState[id].alive &&
        (c.operativeState[id].hp < 15 || c.operativeState[id].bleeding),
    )
  ) {
    const stagingSector = c.location;
    c = stabilizeStockMendozaSurvivors(c, {
      report,
      stagingSector,
      immediateFieldAid: true,
      returnSector: stagingSector,
    });
    retained = createOrders(
      () => c,
      (next) => {
        c = next;
      },
      { report },
    );
    save('final-localities-field-aid');
  }
  const acute = c.recruited.filter(
    (id) =>
      c.operativeState[id].alive && (c.operativeState[id].hp < 15 || c.operativeState[id].bleeding),
  );
  assert.deepEqual(
    acute,
    [],
    'The actual recapture must stabilize urgent casualties before the convoy clock resumes.',
  );
  if (c.artilleryTransfers.some((row) => row.id === transfer.id)) {
    order({ type: 'wait', hours: 1 });
  }
  assert.equal(
    c.artilleryTransfers.some((row) => row.id === transfer.id),
    false,
  );
  assert.deepEqual(
    c.artilleryDepots[transfer.to].find((gun) => gun.id === transfer.id),
    transfer.gun,
  );
  // Return the surviving field through the same ordinary land planner. The
  // engineer kept at Mendoza never enters these battles.
  const returning = local(c.location),
    columns = [];
  for (let offset = 0; offset < returning.length; offset += 6) {
    order({
      type: 'createSquad',
      name: 'Regreso a la fundición',
      ids: returning.slice(offset, offset + 6),
      sector: c.location,
    });
    columns.push(c.activeSquadId);
    order({ type: 'travel', sector: 'mendoza', queue: true, mode: 'posta' });
  }
  for (
    let hours = 0;
    hours < 168 && columns.some((id) => c.squads.find((row) => row.id === id).journey);
    hours++
  ) {
    order({ type: 'wait', hours: 1 });
  }
  for (const id of columns) {
    const squad = c.squads.find((row) => row.id === id);
    assert.equal(squad.location, 'mendoza');
    assert.equal(squad.journey, undefined);
  }
  order({ type: 'selectSquad', id: origin });
  assert.equal(c.location, 'mendoza');
  assert.ok(c.operativeState[2].alive);
  const originalSurvivors = start.squad.filter((id) => available(c, id, 'mendoza'));
  order({ type: 'squad', ids: originalSurvivors });
  assert.deepEqual(c.squad, originalSurvivors);
  for (const [id, record] of Object.entries(before.operativeState)) {
    if (!record.alive) {
      assert.equal(c.operativeState[id].alive, false);
    }
  }
  assert.deepEqual(start, before);
  save('delivered-and-returned');
  // This receipt exists only after the same actual victories, finite care,
  // physical delivery, surviving return and official save guards above.
  const completedService = {
    version: 1,
    transferId: transfer.id,
    record: structuredClone(transfer.gun),
    path: [...transfer.path],
    destination: transfer.to,
    returnedSector: c.location,
    completedSeconds: c.hour * 3600 + (c.secondOfHour ?? 0),
    battles: structuredClone(battleRecords),
    hires: temporaryHires,
  };
  report({
    event: 'foundryConvoyRecovered',
    id: transfer.id,
    record: transfer.gun,
    battles: battleRecords,
    completedService,
    campaign: structuredClone(c),
  });
  return { campaign: c, battles: battleRecords, checkpoints, completedService };
}
