import assert from 'node:assert/strict';
import { dispatchCampaign, rosterFor, civicStatus } from '../packages/game/campaign.js';
import { contractQuote, contractExpiresSeconds } from '../packages/game/contracts.js';
import { hiringArrivalReason, hireArrivalDueSeconds } from '../packages/game/hiring-arrivals.js';
import { immediateRecruitmentExpectation } from './immediate-recruitment-fixture.ts';
import {
  operativeLocation,
  operativeInTransit,
  canReassignOperative,
} from '../packages/game/squads.js';
import {
  northernReliefFitLocal,
  northernReliefReplacements,
  hireNorthernReliefReplacement,
} from './northern-relief-service.mjs';

const source = 'cordoba',
  destination = 'tucuman',
  clock = (c) => c.hour * 3600 + (c.secondOfHour ?? 0);
const live = (c, id) =>
  c.recruited.includes(id) && c.operativeState[id]?.alive && !c.operativeState[id].captured;
const fit = (c, id) => {
  const r = c.operativeState[id];
  return (
    live(c, id) && r.hp === r.maxHp && !r.bleeding && r.morale >= 30 && !r.asleep && r.energy > 10
  );
};
const dutyKeys = [
  'alive',
  'captured',
  'location',
  'assignment',
  'residentSector',
  'residentScene',
  'residentPosition',
];

// Only the route's explicit support homes can release a soldier. Defence
// homes, busy clinic staff and the strongest actual rear medic stay in place.
// One existing dressing stays with each retained serving doctor, the strongest
// medic and any conscious skilled patient needing self-aid. Other actual linen
// can still fund ordinary finite donations.
export function stockNorthernRearReserve(c) {
  const local = c.recruited.filter(
    (id) => live(c, id) && operativeLocation(c, id) === source && !operativeInTransit(c, id),
  );
  const supportHomes = c.squads.filter(
    (home) => home.location === source && !home.journey && home.name === 'Apoyo de Tucumán',
  );
  const strongest = rosterFor(c)
    .filter((op) => local.includes(op.id))
    .sort((a, b) => b.medical - a.medical || a.id - b.id)[0];
  const ids = local.filter(
    (id) =>
      id === strongest?.id ||
      !['active', 'rest'].includes(c.operativeState[id].assignment) ||
      c.squads.some(
        (home) =>
          home.members.includes(id) && !supportHomes.some((support) => support.id === home.id),
      ),
  );
  const homes = ids.map((id) => ({
    id,
    homeId: c.squads.find((home) => home.members.includes(id))?.id,
    record: Object.fromEntries(
      dutyKeys.map((key) => [key, structuredClone(c.operativeState[id][key])]),
    ),
  }));
  const medkits = Object.fromEntries(
    rosterFor(c)
      .filter((op) => {
        const r = c.operativeState[op.id],
          selfCare =
            r.assignment === 'patient' &&
            op.medical > 0 &&
            r.hp >= 15 &&
            !r.asleep &&
            r.energy > 0 &&
            !r.unconscious &&
            !r.routed &&
            !r.surrendered &&
            (r.bleeding > 0 || (r.bandaged ?? 0) < r.maxHp - r.hp);
        return (
          ids.includes(op.id) &&
          (op.id === strongest?.id ||
            ['doctor', 'militia_doctor'].includes(r.assignment) ||
            selfCare)
        );
      })
      .map((op) => [op.id, Math.min(1, c.operativeState[op.id].medkits ?? 0)]),
  );
  return { ids, homes, medkits, strongestMedic: strongest?.id ?? null };
}

export function assertStockNorthernRear(c, rear) {
  for (const { id, homeId, record } of rear.homes) {
    assert.equal(
      c.squads.find((home) => home.members.includes(id))?.id,
      homeId,
      'The actual Córdoba defence and medical homes stay occupied.',
    );
    for (const key of dutyKeys) {
      assert.deepEqual(
        c.operativeState[id][key],
        record[key],
        `The retained Córdoba rear keeps ${id}'s ${key}.`,
      );
    }
    assert.ok(
      c.operativeState[id].medkits >= (rear.medkits[id] ?? 0),
      'The rear medic keeps its actual finite care reserve.',
    );
  }
}

// Recruitment quotes share one current cash budget for the remaining care period.
function affordableReliefHires(c, remainingCareHours, missing) {
  assert.ok(
    Number.isSafeInteger(remainingCareHours) && remainingCareHours >= 0 && remainingCareHours <= 48,
  );
  if (!missing || hiringArrivalReason(c, destination)) {
    return [];
  }
  const candidates = northernReliefReplacements(c).filter((op) => {
    const r = c.operativeState[op.id],
      quote = contractQuote(c, op, 'week'),
      arrival = immediateRecruitmentExpectation(c, op, 'week', quote, destination);
    return (
      r.hp === r.maxHp &&
      !r.bleeding &&
      r.morale >= 30 &&
      !r.asleep &&
      r.energy > 10 &&
      civicStatus(c, op.id).available &&
      quote.price > 0 &&
      arrival.travelHours <= remainingCareHours
    );
  });
  let availableCash = c.resources.treasury;
  const selected = [];
  for (const op of candidates) {
    const quote = contractQuote(c, op, 'week');
    if (quote.total > availableCash) {
      continue;
    }
    selected.push(op);
    availableCash -= quote.total;
    if (selected.length === missing) {
      break;
    }
  }
  return selected;
}

// Plan only the existing rest windows. Expected officers, eligible source
// support and current affordable offers are not accepted as a serving field.
// The caller still checks eight actual fit arrivals after all public orders.
export function stockNorthernReliefRestPlan(
  c,
  { rear, plannedOfficers = [], includeSourceSupport = false, remainingCareHours = 48 } = {},
) {
  const fitIds = northernReliefFitLocal(c),
    officers = plannedOfficers.filter(
      (id) => !fitIds.includes(id) && c.operativeState[id]?.alive && !c.operativeState[id].captured,
    );
  const sourceSupport = includeSourceSupport
    ? c.recruited
        .filter(
          (id) =>
            !rear.ids.includes(id) &&
            fit(c, id) &&
            canReassignOperative(c, id) &&
            !operativeInTransit(c, id) &&
            operativeLocation(c, id) === source &&
            ['active', 'rest'].includes(c.operativeState[id].assignment) &&
            c.squads.some(
              (home) =>
                home.location === source &&
                !home.journey &&
                home.name === 'Apoyo de Tucumán' &&
                home.members.includes(id),
            ),
        )
        .slice(0, 4)
    : [];
  const plannedFit = new Set([...fitIds, ...officers, ...sourceSupport]);
  const replacements = affordableReliefHires(
    c,
    remainingCareHours,
    Math.max(0, 8 - plannedFit.size),
  ).map((op) => op.id);
  return {
    fitIds,
    officers,
    sourceSupport,
    replacements,
    requiredFit: 8,
    needsRest: plannedFit.size + replacements.length < 8,
  };
}

export function attachStockNorthernSupport(start, { rear, report = () => {} } = {}) {
  let c = start;
  const home = c.squads.find((row) => row.id === c.activeSquadId),
    orders = [],
    ids = [];
  assert.ok(
    rear && Array.isArray(rear.ids),
    'Capture the actual rear before the northern envoy leaves.',
  );
  assert.equal(c.location, source);
  assert.ok(home && !home.journey);
  assert.equal(c.pendingBattle, null);
  assert.equal(c.pendingEncounter, null);
  // Keep one real slot for the later officer envoy. Never create another home
  // or remove a defender to make room for this optional support transfer.
  const room = Math.max(0, 5 - home.members.length),
    available = c.recruited
      .filter(
        (id) =>
          !rear.ids.includes(id) &&
          !home.members.includes(id) &&
          fit(c, id) &&
          canReassignOperative(c, id) &&
          !operativeInTransit(c, id) &&
          operativeLocation(c, id) === source &&
          ['active', 'rest'].includes(c.operativeState[id].assignment) &&
          c.squads.some(
            (row) =>
              row.location === source &&
              !row.journey &&
              row.name === 'Apoyo de Tucumán' &&
              row.members.includes(id),
          ),
      )
      .sort((a, b) => a - b);
  const actualFit = new Set([
    ...northernReliefFitLocal(c),
    ...home.members.filter((id) => fit(c, id)),
  ]);
  for (const id of available.slice(0, Math.min(room, Math.max(0, 8 - actualFit.size)))) {
    const before = c,
      action = { type: 'assignToSquad', operativeId: id, squadId: home.id };
    c = dispatchCampaign(c, action);
    assert.equal(c.lastError, null, c.lastError);
    orders.push(action);
    const active = { type: 'assignCare', operativeId: id, assignment: 'active' };
    c = dispatchCampaign(c, active);
    assert.equal(c.lastError, null, c.lastError);
    orders.push(active);
    assert.equal(clock(c), clock(before));
    assert.equal(c.resources.treasury, before.resources.treasury);
    assert.deepEqual(c.contracts, before.contracts);
    assert.equal(c.operativeState[id].hp, before.operativeState[id].hp);
    assert.equal(c.operativeState[id].morale, before.operativeState[id].morale);
    assertStockNorthernRear(c, rear);
    ids.push(id);
    report({
      event: 'stockNorthernSupportAttached',
      id,
      squadId: home.id,
      orders: orders.slice(-2),
    });
  }
  return { campaign: c, ids, orders, rear };
}

// Recruitment is immediate. The caller checks the actual eight-person field
// before finite equipment work or assault departure.
export function bookStockNorthernReliefHires(
  start,
  { remainingCareHours, report = () => {} } = {},
) {
  assert.ok(
    Number.isSafeInteger(remainingCareHours) && remainingCareHours >= 0 && remainingCareHours <= 48,
  );
  let c = start;
  const hires = [],
    missing = Math.max(0, 8 - northernReliefFitLocal(c).length),
    now = clock(c);
  assert.equal(start.pendingBattle, null);
  assert.equal(start.pendingEncounter, null);
  if (!missing) {
    return { campaign: c, hires };
  }
  assert.equal(hiringArrivalReason(start, destination), null);
  const selected = affordableReliefHires(c, remainingCareHours, missing);
  assert.ok(
    !missing || selected.length === missing,
    'Eight fit northern soldiers need actual affordable hires arriving inside the remaining48-hour care budget.',
  );
  for (const op of selected.slice(0, missing)) {
    const quote = contractQuote(c, op, 'week'),
      arrival = immediateRecruitmentExpectation(c, op, 'week', quote, destination),
      cash = c.resources.treasury;
    c = hireNorthernReliefReplacement(c, op.id, { report });
    assert.equal(clock(c), now);
    assert.equal(c.resources.treasury, cash - quote.total);
    assert.ok(hireArrivalDueSeconds(arrival) <= now + remainingCareHours * 3600);
    hires.push({
      id: op.id,
      quote,
      arrival,
      deadlineSeconds: now + remainingCareHours * 3600,
      treasuryBefore: cash,
      treasury: c.resources.treasury,
    });
  }
  return { campaign: c, hires };
}

export function assertStockNorthernHiresArrived(c, hires) {
  for (const { id, quote, arrival, deadlineSeconds } of hires) {
    assert.ok(
      northernReliefFitLocal(c).includes(id),
      'A booked soldier must actually arrive fit before joining the northern field.',
    );
    const contract = c.contracts[id],
      actualStart = contract.started * 3600 + (contract.startedSecond ?? 0);
    assert.equal(contract.paid, quote.price);
    assert.equal(
      actualStart,
      hireArrivalDueSeconds(arrival),
      'Service starts at the accepted recruitment instant.',
    );
    assert.ok(actualStart <= deadlineSeconds);
    assert.equal(contractExpiresSeconds(contract), actualStart + quote.hours * 3600);
  }
}
