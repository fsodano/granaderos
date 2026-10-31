import { present } from './assert-present.ts';
import type { CampaignAction, CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import type { TacticalAction, TacticalPoint } from '../packages/game/public/compatibility-types.ts';
import { northernHospitalCoverOrder } from './northern-hospital-cover.ts';
import { completeQueuedAssault } from './assault-fixture.ts';
import { routeHiringCeiling } from './funded-route-fixture.ts';
import {
  restoreNorthernRoad,
  returnNorthernOfficers,
  prepareRestoredSalta,
} from './recovery-road-route.ts';
import { operativeLocation, operativeInTransit } from '../packages/game/squads.js';
import {
  contractQuote,
  contractRenewalQuote,
  contractExpiresSeconds,
} from '../packages/game/contracts.js';
import { supplyRouteAmmunition } from './route-ammunition.ts';
import { recoverRoutePrimary } from './route-owned-equipment.ts';
import { finishReloadsBeforeMarch } from './pre-march-reload.ts';
import { autoBandageBattle } from '../packages/game/auto-bandage.js';
import {
  fightNorthernSector,
  northernCombatOrder,
  northernClinicDefenseOrder,
} from './northern-route.ts';
import { tucumanCombatOrder } from './tucuman-driver.ts';
import { meetRecruits } from './campaign-recruitment-route.ts';
import '../packages/game/ammunition-types.js';
import assert from 'node:assert/strict';
import { decodeSave, encodeSave } from '../packages/game/save.ts';
import { dispatchCampaign, rosterFor, civicStatus } from '../packages/game/campaign.js';
import { careAssignmentIssue } from '../packages/game/medical-care.js';

import { sectorInventoryModel } from '../packages/game/sector-inventory.js';
import { enterSector } from '../packages/game/world.js';
import { syncBattleTime } from '../packages/game/time.js';
import {
  actBattle,
  endTurn,
  teamCanSee,
  hasLineOfSight,
  firearmShotOptions,
  actionCosts,
  getReachable,
  interruptAvailable,
  completedTacticalVictory,
} from '../packages/game/tactical.js';
import { approachNPC } from './approach-npc.ts';
import { collectRouteItems } from './finite-route-equipment.ts';
import { careRules } from '../packages/game/campaign-care-rules.js';
import { stageRouteRoofDefenders } from './route-roof-defenders.ts';
import { prepareRouteBattery } from './route-battery.ts';
import { coastalBatteryController } from './coastal-command-driver.ts';
import { fight as fightOpeningBattle, type FightOptions } from './opening-driver.ts';
import { artilleryProfile } from '../packages/game/artillery-definitions.ts';
import { recoverRecapturedRoad } from './recovery-road-care.ts';
import {
  captureRouteStrategicInput,
  recordRouteStrategicEvidence,
} from './route-strategic-failure-evidence.ts';
import { campaignSectors } from '../packages/game/campaign-definition.js';
import { cellTravelPlan } from '../packages/game/world-cells.ts';
import { baseMorale } from '../packages/game/morale.js';
import { bookRouteHires, assertRouteHireArrived } from './paid-route-hiring.ts';
import { sameCell, sameSurface, spacePoint } from '../packages/game/tactical-space.js';
import { prepareNorthernHospitalRear } from './northern-hospital-rear-readiness.ts';
import {
  retainNorthernHandoverService,
  resolveNorthernHandoverEncounter,
  continueNorthernHandoverTravel,
} from './northern-handover-route.ts';
import { previewStrategicRoute } from '../packages/game/strategic-route.js';
import { coordinatedHospitalBattery } from './coordinated-hospital-battery.ts';
import { prepareNorthernHospitalReserveReadiness } from './northern-hospital-reserve-readiness.ts';
import { prepareNorthernHospitalReserveStock } from './northern-hospital-reserve-stock.ts';
import { prepareNorthernHospitalSixPersonReserve } from './northern-hospital-six-person-reserve.ts';
import {
  saltaHospitalBattleOptions,
  saltaHospitalEncounterExecutor,
} from './salta-hospital-encounter.ts';
import { createPairedRouteOrders } from './paired-route-battle.ts';
import { journaledHospitalFight } from './hospital-order-health-journal.ts';
import { knownRouteShotSafety } from './route-fire-safety.ts';

// A hospital is an actual controlled locality reached through the ordinary
// land planner. An occupied preferred hospital remains occupied; this helper
// neither attacks it nor changes the enemy group's state.
export function northernRecoveryHospital(c: CampaignSnapshot, patients, preferred = 'cordoba') {
  const locations = [
    ...new Set(
      patients
        .filter((id: string|number) => c.operativeState[id].alive && !c.operativeState[id].captured)
        .map((id: number) => operativeLocation(c, id)),
    ),
  ];
  assert.ok(locations.length, 'actual living patients need a controlled hospital');
  const choices = campaignSectors(c)
    .filter(
      (sector) =>
        c.sectors[sector.id]?.owner === 'patriot' &&
        !c.enemyGroups.some((group) => group.target === sector.id && group.status === 'stationed'),
    )
    .map((sector) => {
      const plans = locations.map((location) => cellTravelPlan({ ...c, location }, sector.id));
      return { sector: sector.id, plans, hours: plans.reduce((sum, plan) => sum + plan.hours, 0) };
    })
    .filter((choice) => choice.plans.every((plan) => !plan.reason && plan.path.length <= 65));
  const selected =
    choices.find((choice) => choice.sector === preferred) ??
    choices.sort((a, b) => a.hours - b.hours || a.sector.localeCompare(b.sector))[0];
  assert.ok(
    selected,
    'the actual patients need a controlled reachable hospital; restore a cut route through real orders first',
  );
  return selected.sector;
}

export function northernHospitalOrder(state: CampaignSnapshot, a: CampaignAction, { inputCapture = null, report = () => {} } = {}) {
  let c = state;
  const elapsed = a.type === 'wait' ? a.hours : a.type === 'travel' && a.queue !== true ? 48 : 0;
  if (elapsed) {
    for (const id of c.recruited.filter(
      (id: string|number) => c.operativeState[id].alive && !c.operativeState[id].captured,
    )) {
      const until = (c.hour + elapsed) * 3600 + (c.secondOfHour ?? 0);
      while (
        contractExpiresSeconds(c.contracts[id]) !== null &&
        present(contractExpiresSeconds(c.contracts[id])) <= until
      ) {
        const contract = c.contracts[id],
          quote = contractRenewalQuote(
            c,
            rosterFor(c).find((op) => op.id === id),
            'day',
          ),
          cash = c.resources.treasury,
          action = {
            type: 'renewContract',
            id,
            term: 'day',
            expectedExpiresAt: present(contract).expiresAt,
            expectedExpiresSecond: present(contract).expiresSecond ?? 0,
          };
        assert.equal(quote.available, true, quote.reason);
        const next = dispatchCampaign(c, action);
        assert.equal(next.lastError, null, next.lastError);
        c = next;
        assert.equal(c.resources.treasury, cash - quote.price);
        assert.equal(
          contractExpiresSeconds(c.contracts[id]),
          present(quote.expiresAt) * 3600 + (quote.expiresSecond ?? 0),
        );
        report({
          event: 'northernHospitalRenewal',
          action,
          quote: structuredClone(quote),
          cost: cash - c.resources.treasury,
          hour: c.hour,
          secondOfHour: c.secondOfHour ?? 0,
          contract: structuredClone(c.contracts[id]),
        });
      }
    }
  }
  const before = c,
    diagnosticBefore = a.type === 'travel' ? captureRouteStrategicInput(c) : null;
  c = dispatchCampaign(c, a);
  if (c.lastError && a.type === 'travel') {
    recordRouteStrategicEvidence({
      helper: 'recoverFreshNorthernDoctor',
      stage: 'campaign-action-refusal',
      campaign: diagnosticBefore ?? before,
      action: a,
      returnedCampaign: c,
      inputCapture,
      error: c.lastError,
      preDispatchInputIndependentlyCloned: diagnosticBefore !== null,
    });
  }
  assert.equal(c.lastError, null, JSON.stringify(a) + c.lastError);
  report({
    event: 'northernHospitalOrder',
    action: a.type === 'leaveSector' ? { type: a.type, battleId: a.battleId } : structuredClone(a),
    hour: c.hour,
    secondOfHour: c.secondOfHour ?? 0,
    location: c.location,
    cost: before.resources.treasury - c.resources.treasury,
    ...(['travel', 'resumeTravel'].includes(a.type)
      ? {
          path: c.squads.find((q) => q.id === c.activeSquadId)?.journey?.path ?? [],
          destination: a.sector ?? null,
        }
      : {}),
  });
  return c;
}

// Preserve the established prepaid march when its actual service quotes can
// be paid. Otherwise use zero-time queued departure and renew before each
// real wait, so ordinary income can fund the same serving cohort.
export function northernHospitalReturnFunding(state: CampaignSnapshot, hours = 48) {
  const now = state.hour * 3600 + (state.secondOfHour ?? 0),
    until = now + hours * 3600,
    roster = rosterFor(state),
    renewals = [];
  for (const id of state.recruited.filter(
    (id) => present(state.operativeState[id]).alive && !present(state.operativeState[id]).captured,
  )) {
    const expiry = contractExpiresSeconds(state.contracts[id]);
    if (expiry === null || expiry > until) {
      continue;
    }
    const quote = contractRenewalQuote(
        state,
        roster.find((op) => op.id === id),
        'day',
      ),
      count = quote.hours
        ? Math.floor((until - Math.max(now, expiry)) / (quote.hours * 3600)) + 1
        : 1;
    renewals.push({ id, count, quote: structuredClone(quote), cost: count * quote.price });
  }
  const total = renewals.reduce((sum, row) => sum + row.cost, 0);
  return {
    hours,
    untilSeconds: until,
    treasury: state.resources.treasury,
    total,
    queued: total > state.resources.treasury,
    renewals,
  };
}

// Local linen can be truly exhausted after the preceding native battles.
// Book supplied relief only after known stock and local donations are absent.
// Each arrival carries its existing finite kit; an expired profile is not refilled.
export function stabilizeNorthernHospitalPatients(
  start,
  patients,
  doctorIds,
  { inputCapture = null, report = () => {} } = {},
) {
  let c = decodeSave(encodeSave(start)).campaign;
  const before = structuredClone(start),
    doctors = [...doctorIds],
    orders = [],
    hires = [],
    donations = [],
    ticks = [];
  const observe = (event) => {
    if (event.event === 'northernHospitalOrder' || event.event === 'northernHospitalRenewal') {
      orders.push(structuredClone(event.action));
    }
    report(event);
  };
  const order = (action) => {
    c = northernHospitalOrder(c, action, { inputCapture, report: observe });
  };
  const urgent = (id: string|number) => c.operativeState[id].hp < 15 || c.operativeState[id].bleeding > 0;
  const local = (id: number, at: string) =>
    c.recruited.includes(id) &&
    present(c.operativeState[id]).alive &&
    !present(c.operativeState[id]).captured &&
    !operativeInTransit(c, id) &&
    operativeLocation(c, id) === at;
  for (let h = 0; h < 24 && patients.some(urgent); h++) {
    assert.equal(
      c.pendingEncounter,
      null,
      'defend a real hospital interruption before continuing critical care',
    );
    assert.equal(c.pendingBattle, null);
    for (let index = 0; index < doctors.length; index++) {
      let id = doctors[index];
      const at = operativeLocation(c, id);
      if (
        present(c.operativeState[id]).asleep ||
        !patients.some((patient) => local(patient, at) && urgent(patient))
      ) {
        continue;
      }
      if (present(c.operativeState[id]).medkits) {
        order({ type: 'assignCare', operativeId: id, assignment: 'doctor' });
        continue;
      }
      let row = sectorInventoryModel(c, at, rosterFor(c), id).entries.find(
        (row) => row.reachable && JSON.parse(row.expected).item === 'medkits',
      );
      if (row) {
        order({
          type: 'sectorInventory',
          sector: at,
          operativeId: id,
          direction: 'take',
          sourceKey: row.key,
          expected: row.expected,
          count: 1,
        });
        order({ type: 'assignCare', operativeId: id, assignment: 'doctor' });
        continue;
      }
      let donor = c.recruited.find(
        (other) =>
          other !== id &&
          local(other, at) &&
          present(c.operativeState[other]).medkits > 0 &&
          !sectorInventoryModel(c, at, rosterFor(c), other).reason,
      );
      if (
        donor === undefined &&
        c.sectorStates[at]?.props.some((prop) =>
          prop.contents?.some((item) => item.item === 'medkits' && item.count > 0),
        )
      ) {
        c = collectRouteItems(c, id, { item: 'medkits' }, 1).campaign;
        continue;
      }
      if (donor === undefined) {
        const candidate = rosterFor(c)
          .filter((op) => {
            const record = c.operativeState[op.id],
              quote = contractQuote(c, op, 'day');
            return (
              civicStatus(c, op.id).available &&
              !c.recruited.includes(op.id) &&
              !c.hiringArrivals.some((arrival) => arrival.operativeId === op.id) &&
              present(record).alive &&
              !present(record).captured &&
              present(record).medkits > 0 &&
              op.medical >= careRules(c).minimumSkill &&
              quote.available &&
              quote.total <= c.resources.treasury
            );
          })
          .sort(
            (a, b) =>
              b.medical - a.medical ||
              contractQuote(c, a, 'day').total - contractQuote(c, b, 'day').total ||
              a.id - b.id,
          )[0];
        assert.ok(
          candidate,
          'critical hospital care needs known finite linen or an actual supplied immediate paid medic',
        );
        const booked = bookRouteHires(c, [candidate.id], { term: 'day', destination: at, report });
        c = booked.campaign;
        hires.push(...booked.hires);
        assertRouteHireArrived(c, booked.hires[0]);
        orders.push({ type: 'recruitCivic', id: candidate.id, term: 'day', destination: at });
        const home = c.squads.find(
          (squad) =>
            squad.location === at &&
            !squad.journey &&
            squad.members.length > 0 &&
            squad.members.length < 6 &&
            squad.members.some((member) => patients.includes(member) || doctors.includes(member)),
        );
        if (home) {
          order({ type: 'assignToSquad', operativeId: candidate.id, squadId: home.id });
        } else {
          order({
            type: 'createSquad',
            name: 'Socorro del hospital',
            ids: [candidate.id],
            sector: at,
          });
        }
        const physician = rosterFor(c)
          .filter(
            (op) =>
              local(op.id, at) &&
              [undefined, 'no_medkits'].includes(careAssignmentIssue(c, op, 'doctor')?.code),
          )
          .sort((a, b) => b.medical - a.medical || a.id - b.id)[0];
        assert.ok(physician);
        if (physician.id !== id) {
          order({ type: 'assignCare', operativeId: id, assignment: 'rest' });
          id = physician.id;
          doctors[index] = id;
        }
        donor = candidate.id;
      }
      if (!present(c.operativeState[id]).medkits) {
        const stock = present(c.operativeState[id]).medkits + present(c.operativeState[donor]).medkits,
          known = new Set(
            sectorInventoryModel(c, at, rosterFor(c), id).entries.map((row) => row.key),
          );
        order({
          type: 'sectorInventory',
          sector: at,
          operativeId: donor,
          direction: 'drop',
          item: 'medkits',
          count: 1,
        });
        row = sectorInventoryModel(c, at, rosterFor(c), id).entries.find(
          (row) =>
            !known.has(row.key) && row.reachable && JSON.parse(row.expected).item === 'medkits',
        );
        assert.ok(row, 'the clinic physician needs a real path to the finite local donation');
        order({
          type: 'sectorInventory',
          sector: at,
          operativeId: id,
          direction: 'take',
          sourceKey: row.key,
          expected: row.expected,
          count: 1,
        });
        assert.equal(present(c.operativeState[id]).medkits + present(c.operativeState[donor]).medkits, stock);
        donations.push({ sector: at, donor, recipient: id, count: 1 });
      }
      order({ type: 'assignCare', operativeId: id, assignment: 'doctor' });
    }
    const began = c.hour * 3600 + (c.secondOfHour ?? 0),
      stock = doctors.reduce((sum, id) => sum + present(c.operativeState[id]).medkits, 0);
    for (let notice = 0; c.hour * 3600 + (c.secondOfHour ?? 0) === began && notice < 3; notice++) {
      order({ type: 'wait', hours: 1 });
    }
    assert.ok(
      c.hour * 3600 + (c.secondOfHour ?? 0) > began || c.pendingEncounter,
      'critical care must advance or expose its real encounter',
    );
    assert.ok(
      patients.every((id: number) => c.recruited.includes(id) && present(c.operativeState[id]).alive),
      'retain every actual serving patient during critical care',
    );
    c = decodeSave(encodeSave(c)).campaign;
    const tick = {
      hour: c.hour,
      secondOfHour: c.secondOfHour ?? 0,
      doctors: [...doctors],
      dressingsSpent: stock - doctors.reduce((sum, id) => sum + present(c.operativeState[id]).medkits, 0),
      patients: patients.map((id: string|number) => ({
        id,
        hp: c.operativeState[id].hp,
        bleeding: c.operativeState[id].bleeding,
      })),
    };
    ticks.push(tick);
    report({ event: 'northernHospitalStabilizationTick', tick, campaign: structuredClone(c) });
  }
  assert.ok(
    patients.every((id: string|number) => c.operativeState[id].alive && !urgent(id)),
    'stop real critical wounds and bleeding before evacuation',
  );
  for (const [id, record] of Object.entries(before.operativeState)) {
    if (!record.alive) {
      assert.equal(c.operativeState[id].alive, false);
      assert.equal(c.operativeState[id].deathMinute, record.deathMinute);
    }
  }
  assert.deepEqual(start, before);
  const receipt = {
    orders,
    hires,
    donations,
    ticks,
    patients: [...patients],
    doctors: [...doctors],
    startSeconds: start.hour * 3600 + (start.secondOfHour ?? 0),
    endSeconds: c.hour * 3600 + (c.secondOfHour ?? 0),
  };
  report({ event: 'northernHospitalStabilized', receipt });
  return { campaign: c, doctors, receipt };
}

// A distant clinic's clock still advances wounds in the town just defended.
// Stop those actual acute wounds first, then let its surviving reserve rest
// while the original hospital continues its own paid care.
export function prepareNorthernRemoteDefenseRest(
  start,
  sector,
  { inputCapture = null, report = () => {} } = {},
) {
  const before = structuredClone(start);
  let c = decodeSave(encodeSave(start)).campaign;
  assert.equal(c.pendingBattle, null);
  assert.equal(c.pendingEncounter, null);
  assert.equal(c.sectors[sector]?.owner, 'patriot');
  const local = () =>
    c.recruited.filter((id) => {
      const r = c.operativeState[id];
      return (
        present(r).alive && !present(r).captured && !operativeInTransit(c, id) && operativeLocation(c, id) === sector
      );
    });
  const patients = local().filter(
      (id) => present(c.operativeState[id]).hp < 15 || present(c.operativeState[id]).bleeding > 0,
    ),
    orders = [];
  const observe = (event) => {
    if (event.event === 'northernHospitalOrder' || event.event === 'northernHospitalRenewal') {
      orders.push(structuredClone(event.action));
    }
    report(event);
  };
  const order = (action: { type: string; operativeId: number; assignment: string; }) => {
    c = northernHospitalOrder(c, action, { inputCapture, report: observe });
  };
  let stabilization = null;
  if (patients.length) {
    const doctors = rosterFor(c)
      .filter(
        (op) =>
          local().includes(op.id) &&
          !patients.includes(op.id) &&
          [undefined, 'no_medkits'].includes(careAssignmentIssue(c, op, 'doctor')?.code),
      )
      .sort(
        (a, b) =>
          Number(present(c.operativeState[b.id]).medkits > 0) - Number(present(c.operativeState[a.id]).medkits > 0) ||
          b.medical - a.medical ||
          a.id - b.id,
      )
      .slice(0, patients.length)
      .map((op) => op.id);
    assert.ok(
      doctors.length,
      'New remote casualties need an actual stable local physician before the hospital clock resumes.',
    );
    for (const operativeId of patients) {
      order({ type: 'assignCare', operativeId, assignment: 'patient' });
    }
    const aided = stabilizeNorthernHospitalPatients(c, patients, doctors, {
      inputCapture,
      report: observe,
    });
    c = aided.campaign;
    stabilization = aided.receipt;
  }
  for (const operativeId of local()) {
    const r = c.operativeState[operativeId];
    assert.ok(present(r).hp >= 15 && !present(r).bleeding, 'Remote survivors must be stable before ordinary rest.');
    if (present(r).assignment !== 'rest') {
      order({ type: 'assignCare', operativeId, assignment: 'rest' });
    }
  }
  for (const [id, r] of Object.entries(before.operativeState)) {
    if (!r.alive) {
      assert.equal(c.operativeState[id].alive, false);
      assert.equal(c.operativeState[id].deathMinute, r.deathMinute);
    }
  }
  assert.deepEqual(start, before);
  assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
  const receipt = { sector, patients, ids: local(), orders, stabilization };
  report({ event: 'northernRemoteDefenseRestReady', receipt });
  return { campaign: c, receipt };
}

// Stabilize the actual survivors and use their controlled hospital. The
// continued return is separate so a saved hospital boundary can be checked.
export function recoverFreshNorthernHospital(
  start: CampaignSnapshot,
  { report = () => {}, coordinateDefense = false } = {},
) {
  assert.equal(typeof coordinateDefense, 'boolean');
  const inputCapture = recordRouteStrategicEvidence({
    helper: 'recoverFreshNorthernDoctor',
    stage: 'preparation-input',
    campaign: start,
  });
  let c = start;
  try {
    c = decodeSave(encodeSave(start)).campaign;
    const order = (a) => {
      c = northernHospitalOrder(c, a, { inputCapture, report });
    };
    const patients = c.recruited.filter((id: string|number) => {
      const r = c.operativeState[id];
      return r.alive && !r.captured && r.hp < r.maxHp;
    });
    assert.ok(patients.length && patients.length < 6, 'a real wounded survivor needs relief');
    // Book the already-planned relief officer at the isolated rear clinic before
    // a field visit advances the bleeding patient's clock. Its issued dressings
    // are finite; a returning former doctor does not receive replacement stock.
    if (!c.officer && patients.some((id: string|number) => c.operativeState[id].location === 'cordoba')) {
      const localPatients = patients.filter((id: string|number) => c.operativeState[id].location === 'cordoba'),
        cash = c.resources.treasury;
      order({
        type: 'createSquad',
        name: 'Socorro de Córdoba',
        ids: localPatients,
        sector: 'cordoba',
      });
      order({
        type: 'createOfficer',
        name: 'Oficial de socorro',
        answers: { origin: 'cabildo', doctrine: 'line_marksman', crisis: 'rescue' },
      });
      assert.equal(cash - c.resources.treasury, 300);
      assert.equal(present(c.operativeState[1000]).medkits, 2);
      for (const operativeId of localPatients) {
        order({ type: 'assignCare', operativeId, assignment: 'patient' });
      }
      order({ type: 'assignCare', operativeId: 1000, assignment: 'doctor' });
      report({
        event: 'northernReliefOfficer',
        operativeId: 1000,
        sector: 'cordoba',
        cost: 300,
        dressings: 2,
        hour: c.hour,
      });
    }
    // Set up paid care at every actual patient location before any field visit
    // advances time for a distant, critically wounded survivor.
    // Keep the healthy local guard while the doctor and actual patients evacuate.
    const escort = rosterFor(c)
      .filter(
        (op) =>
          c.recruited.includes(op.id) &&
          present(c.operativeState[op.id]).alive &&
          !present(c.operativeState[op.id]).captured &&
          operativeLocation(c, op.id) === 'tucuman' &&
          !patients.includes(op.id) &&
          present(c.operativeState[op.id]).hp >= 15 &&
          !present(c.operativeState[op.id]).bleeding &&
          op.medical < 80,
      )
      .sort((a, b) => b.marksmanship - a.marksmanship)
      .slice(0, 6)
      .map((op) => op.id);
    if (escort.length) {
      order({ type: 'createSquad', name: 'Guardia de Tucumán', ids: escort, sector: 'tucuman' });
      for (const operativeId of escort) {
        order({ type: 'assignCare', operativeId, assignment: 'active' });
      }
    }
    const stabilizationDoctors = [];
    for (const at of new Set(patients.map((id: string|number) => c.operativeState[id].location))) {
      let medic = rosterFor(c)
        .filter(
          (op) =>
            c.recruited.includes(op.id) &&
            present(c.operativeState[op.id]).alive &&
            !present(c.operativeState[op.id]).captured &&
            present(c.operativeState[op.id]).location === at &&
            present(c.operativeState[op.id]).hp >= 15 &&
            !present(c.operativeState[op.id]).bleeding &&
            op.medical >= 20,
        )
        .sort((a, b) => b.medical - a.medical)[0];
      if (!medic) {
        const candidate = rosterFor(c)
          .filter(
            (op) =>
              op.id >= 100 &&
              op.id < 1000 &&
              op.medical >= 20 &&
              !c.recruited.includes(op.id) &&
              present(c.operativeState[op.id]).alive &&
              !present(c.operativeState[op.id]).captured &&
              contractQuote(c, op, 'week').available &&
              contractQuote(c, op, 'week').price <=
                Math.min(routeHiringCeiling(c, 250), c.resources.treasury),
          )
          .sort(
            (a, b) =>
              b.medical - a.medical ||
              contractQuote(c, a, 'week').price - contractQuote(c, b, 'week').price,
          )[0];
        assert.ok(candidate);
        order({ type: 'recruitCivic', id: candidate.id, term: 'week', destination: at });
        for (let h = 0; h < 24 && !c.recruited.includes(candidate.id); h++) {
          order({ type: 'wait', hours: 1 });
        }
        assert.ok(c.recruited.includes(candidate.id));
        medic = rosterFor(c).find((op) => op.id === candidate.id);
      }
      const localPatients = patients.filter((id: string|number) => c.operativeState[id].location === at);
      order({
        type: 'createSquad',
        name: 'Estabilización previa',
        ids: [...new Set([present(medic).id, ...localPatients])],
        sector: at,
      });
      for (const row of sectorInventoryModel(c, at, rosterFor(c), present(medic).id).entries.filter(
        (row) => row.reachable && JSON.parse(row.expected).item === 'medkits',
      )) {
        const count = Math.min(row.count, 10 - present(c.operativeState[medic.id]).medkits);
        if (count > 0) {
          order({
            type: 'sectorInventory',
            sector: at,
            operativeId: present(medic).id,
            direction: 'take',
            sourceKey: row.key,
            expected: row.expected,
            count,
          });
        }
      }
      for (const operativeId of localPatients) {
        order({ type: 'assignCare', operativeId, assignment: 'patient' });
      }
      order({ type: 'assignCare', operativeId: present(medic).id, assignment: 'doctor' });
      stabilizationDoctors.push(present(medic).id);
      // Stop the critical patient's bleeding with the already observed dressing
      // before the physician walks to the cache and spends real tactical time.
      if (at === 'tucuman' && localPatients.some((id: string|number) => c.operativeState[id].bleeding)) {
        order({ type: 'wait', hours: 1 });
        for (const id of localPatients) {
          assert.ok(present(c.operativeState[id]).alive);
        }
      }
      if (present(c.operativeState[medic.id]).medkits < 3 && at === 'tucuman') {
        c = collectRouteItems(c, present(medic).id, { item: 'medkits' }, 12).campaign;
        order({ type: 'assignCare', operativeId: present(medic).id, assignment: 'doctor' });
      }
    }
    const stabilized = stabilizeNorthernHospitalPatients(c, patients, stabilizationDoctors, {
      inputCapture,
      report,
    });
    c = stabilized.campaign;
    stabilizationDoctors.splice(0, stabilizationDoctors.length, ...stabilized.doctors);
    for (const id of patients) {
      assert.ok(present(c.operativeState[id]).alive && present(c.operativeState[id]).hp >= 15);
      assert.equal(present(c.operativeState[id]).bleeding, 0);
    }
    for (const operativeId of [...patients, ...stabilizationDoctors]) {
      order({ type: 'assignCare', operativeId, assignment: 'active' });
    }
    // Treat each actual location before the evacuation clock advances. The
    // defeated enemy may have routed a survivor back to a different province.
    for (const at of new Set(patients.map((id: string|number) => c.operativeState[id].location))) {
      const local = c.recruited.filter(
        (id: string|number) =>
          c.operativeState[id].alive &&
          !c.operativeState[id].captured &&
          c.operativeState[id].location === at,
      );
      let medic = rosterFor(c)
        .filter(
          (op) =>
            local.includes(op.id) &&
            present(c.operativeState[op.id]).hp >= 15 &&
            !present(c.operativeState[op.id]).bleeding &&
            op.medical >= 20,
        )
        .sort((a, b) => b.medical - a.medical)[0];
      if (!medic) {
        const candidate = rosterFor(c)
          .filter(
            (op) =>
              op.id >= 100 &&
              op.id < 1000 &&
              op.medical >= 20 &&
              !c.recruited.includes(op.id) &&
              present(c.operativeState[op.id]).alive &&
              !present(c.operativeState[op.id]).captured &&
              contractQuote(c, op, 'week').available &&
              contractQuote(c, op, 'week').price <=
                Math.min(routeHiringCeiling(c, 250), c.resources.treasury),
          )
          .sort(
            (a, b) =>
              b.medical - a.medical ||
              contractQuote(c, a, 'week').price - contractQuote(c, b, 'week').price,
          )[0];
        assert.ok(candidate, 'a real available paid medic must reach the isolated patient');
        order({ type: 'recruitCivic', id: candidate.id, term: 'week', destination: at });
        medic = rosterFor(c).find((op) => op.id === candidate.id);
        assert.ok(c.recruited.includes(present(medic).id) && present(c.operativeState[medic.id]).location === at);
      }
      assert.ok(medic);
      const medicalParty = [
        ...new Set([medic.id, ...patients.filter((id: string|number) => c.operativeState[id].location === at)]),
      ];
      assert.ok(medicalParty.length <= 6, 'the doctor and actual patients must fit a real squad');
      order({ type: 'createSquad', name: 'Puesto de socorro', ids: medicalParty, sector: at });
      for (const row of sectorInventoryModel(c, at, rosterFor(c), medic.id).entries.filter(
        (row) => row.reachable && JSON.parse(row.expected).item === 'medkits',
      )) {
        const count = Math.min(row.count, 10 - present(c.operativeState[medic.id]).medkits);
        if (count > 0) {
          order({
            type: 'sectorInventory',
            sector: at,
            operativeId: medic.id,
            direction: 'take',
            sourceKey: row.key,
            expected: row.expected,
            count,
          });
        }
      }
      order({ type: 'visitSector' });
      const aid = autoBandageBattle(enterSector(c.pendingBattle, c.sectorStates[at]));
      const synced = syncBattleTime(c, aid.battle);
      assert.equal(synced.error, null);
      c = synced.campaign;
      order({
        type: 'leaveSector',
        battleId: present(c.pendingBattle).id,
        sectorState: synced.battle,
        survivors: synced.battle.units.filter((u) => u.side === 'player'),
      });
      for (const id of patients.filter((id: string|number) => c.operativeState[id].location === at)) {
        assert.ok(present(c.operativeState[id]).hp >= 15, 'stabilize critical wounds before travel');
        assert.equal(present(c.operativeState[id]).bleeding, 0);
      }
    }
    let sector = northernRecoveryHospital(c, patients);
    report({
      event: 'northernHospitalSelected',
      sector,
      preferred: 'cordoba',
      preferredOwner: present(c.sectors.cordoba).owner,
      hour: c.hour,
      patientLocations: [...new Set(patients.map((id: number) => operativeLocation(c, id)))],
    });
    assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
    report({
      event: 'northernHospitalCheckpoint',
      stage: 'stabilized',
      sector,
      campaign: structuredClone(c),
    });
    const rear = escort.filter((id) => operativeLocation(c, id) !== sector);
    if (rear.length) {
      const reserves = rosterFor(c)
        .filter((op) => {
          const r = c.operativeState[op.id];
          return (
            c.recruited.includes(op.id) &&
            present(r).alive &&
            !present(r).captured &&
            present(r).hp === present(r).maxHp &&
            !present(r).bleeding &&
            !patients.includes(op.id) &&
            op.id !== 1000 &&
            operativeLocation(c, op.id) === sector
          );
        })
        .sort((a, b) => b.marksmanship - a.marksmanship || a.id - b.id)
        .map((op) => op.id);
      const prepared = prepareNorthernHospitalRear(c, rear, {
        applyOrder: (state, action) =>
          northernHospitalOrder(state, action, { inputCapture, report }),
        reserveIds: reserves,
        coordinatePhysicians: coordinateDefense,
        report,
      });
      c = prepared.campaign;
      escort.push(...prepared.ids.filter((id) => !escort.includes(id)));
      for (let index = stabilizationDoctors.length - 1; index >= 0; index--) {
        if (prepared.ids.includes(stabilizationDoctors[index])) {
          stabilizationDoctors.splice(index, 1);
        }
      }
    }
    for (const at of new Set(
      patients.map((id: string|number) => c.operativeState[id].location).filter((at: string) => at !== sector),
    )) {
      const evacuees = [
        ...new Set([
          ...patients.filter((id: string|number) => c.operativeState[id].location === at),
          ...stabilizationDoctors.filter((id) => present(c.operativeState[id]).location === at),
        ]),
      ];
      order({ type: 'createSquad', name: 'Evacuación de heridos', ids: evacuees, sector: at });
      for (let leg = 0; leg < 6 && c.location !== sector; leg++) {
        for (const operativeId of evacuees) {
          order({ type: 'assignCare', operativeId, assignment: 'rest' });
        }
        for (
          let h = 0;
          h < 48 &&
          evacuees.some(
            (id) =>
              present(c.operativeState[id]).energy < 100 ||
              present(c.operativeState[id]).fatigue > 0 ||
              present(c.operativeState[id]).asleep,
          );
          h++
        ) {
          assert.equal(c.pendingEncounter, null);
          order({ type: 'wait', hours: 1 });
        }
        for (const operativeId of evacuees) {
          order({ type: 'assignCare', operativeId, assignment: 'active' });
        }
        // Rest advances the strategic clock. Recheck ownership and the physical
        // land route before each departure rather than trusting the earlier plan.
        if (present(c.sectors[sector]).owner !== 'patriot' || cellTravelPlan(c, sector).reason) {
          sector = northernRecoveryHospital(c, patients);
        }
        if (c.location !== sector) {
          order({ type: 'travel', sector });
        }
        assert.equal(c.pendingEncounter, null);
      }
      assert.equal(c.location, sector);
    }
    order({ type: 'createSquad', name: `Hospital de ${sector}`, ids: patients, sector });
    if (!c.officer) {
      order({
        type: 'createOfficer',
        name: 'Oficial de socorro',
        answers: { origin: 'cabildo', doctrine: 'line_marksman', crisis: 'rescue' },
      });
    }
    c = supplyRouteAmmunition(c, c.squad, { report }).campaign;

    for (const row of sectorInventoryModel(c, sector, rosterFor(c), 1000).entries.filter(
      (row) => row.reachable && JSON.parse(row.expected).item === 'medkits',
    )) {
      const count = Math.min(row.count, 10 - present(c.operativeState[1000]).medkits);
      if (count <= 0) {
        break;
      }
      order({
        type: 'sectorInventory',
        sector,
        operativeId: 1000,
        direction: 'take',
        sourceKey: row.key,
        expected: row.expected,
        count,
      });
    }
    for (let level = present(c.sectors[sector]).fort; level < 3; level++) {
      const cash = c.resources.treasury;
      order({ type: 'fortify', sector });
      assert.equal(cash - c.resources.treasury, 150);
      report({
        event: 'hospitalFortification',
        sector,
        cost: 150,
        level: present(c.sectors[sector]).fort,
        hour: c.hour,
      });
    }
    const bestLocalMedicine = Math.max(
      ...rosterFor(c)
        .filter(
          (op) =>
            c.recruited.includes(op.id) &&
            present(c.operativeState[op.id]).alive &&
            !present(c.operativeState[op.id]).captured &&
            operativeLocation(c, op.id) === sector &&
            present(c.operativeState[op.id]).hp >= 15 &&
            !present(c.operativeState[op.id]).bleeding,
        )
        .map((op) => op.medical),
    );
    const relief = rosterFor(c)
      .filter(
        (op) =>
          op.id >= 100 &&
          op.id < 1000 &&
          op.medical > bestLocalMedicine &&
          !c.recruited.includes(op.id) &&
          present(c.operativeState[op.id]).alive &&
          !present(c.operativeState[op.id]).captured &&
          contractQuote(c, op, 'week').available &&
          contractQuote(c, op, 'week').price <=
            Math.min(routeHiringCeiling(c, 250), c.resources.treasury),
      )
      .sort(
        (a, b) =>
          b.medical - a.medical ||
          contractQuote(c, a, 'week').price - contractQuote(c, b, 'week').price,
      )[0];
    if (relief) {
      const cash = c.resources.treasury,
        quote = contractQuote(c, relief, 'week');
      order({ type: 'recruitCivic', id: relief.id, term: 'week', destination: sector });
      for (let h = 0; h < 24 && !c.recruited.includes(relief.id); h++) {
        order({ type: 'wait', hours: 1 });
      }
      assert.ok(
        c.recruited.includes(relief.id) && operativeLocation(c, relief.id) === sector,
        'the actual paid relief doctor must arrive at the selected hospital',
      );
      assert.equal(cash - c.resources.treasury, quote.price);
      escort.push(relief.id);
      report({
        event: 'northernHospitalPaidRelief',
        sector,
        operativeId: relief.id,
        cost: quote.price,
        medical: relief.medical,
        hour: c.hour,
      });
    }
    c = stageRouteRoofDefenders(
      c,
      c.recruited.filter((id: string|number) => {
        const r = c.operativeState[id];
        return (
          r.alive && !r.captured && r.location === sector && r.hp >= 15 && !r.bleeding && !r.asleep
        );
      }),
      { report },
    );
    for (const operativeId of escort.filter((id) => operativeLocation(c, id) === sector)) {
      order({ type: 'assignCare', operativeId, assignment: 'rest' });
    }
    const localPatients = () =>
      c.recruited.filter((id: string|number) => {
        const r = c.operativeState[id];
        return r.alive && !r.captured && r.location === sector && r.hp < r.maxHp;
      });
    const recoveryHours =
        96 +
        Math.max(...patients.map((id: string|number) => c.operativeState[id].maxHp - c.operativeState[id].hp)) *
          careRules(c).restHealingHours,
      careStartSeconds = c.hour * 3600 + (c.secondOfHour ?? 0),
      careDeadlineSeconds = careStartSeconds + recoveryHours * 3600;
    for (let h = 0; h < recoveryHours && localPatients().length; h++) {
      if (c.pendingEncounter) {
        const encounter = c.pendingEncounter;
        report({ event: 'hospitalCounterattack', campaign: structuredClone(c) });
        const defenders = c.squads.find((q) => q.location === encounter.sector && q.members.length);
        assert.ok(defenders, 'a real local squad must defend the hospital');
        order({ type: 'selectSquad', id: defenders.id });
        order({ type: 'respondToEncounter', groupId: encounter.groupId, choice: 'tactical' });
        const initial = enterSector(c.pendingBattle, c.sectorStates[encounter.sector]),
          hospital = coordinateDefense
            ? coordinatedHospitalBattery(initial, {
                coordinateSpentCrew: true,
                coordinatePhysicianHold: true,
              })
            : null,
          controller = hospital
            ? hospital.controller
            : initial.artillery.some((g) => g.side === 'player' && (g.loaded || g.ammo > 0))
              ? coastalBatteryController(initial, { sharedArtillerySight: true })
              : northernHospitalCoverOrder;
        const journalDirectory = process.env.GRANADEROS_HOSPITAL_HEALTH_JOURNAL_DIR;
        c = fightNorthernSector(c, encounter.sector, {
          controller,
          ...(coordinateDefense ? { sharedFallback: controller.sharedFallback } : {}),
          ...(journalDirectory
            ? {
                executeBattle: journaledHospitalFight(journalDirectory, {
                  roles: hospital?.roles ?? null,
                }),
              }
            : {}),
          report,
        }).campaign;
        if (encounter.sector !== sector) {
          c = prepareNorthernRemoteDefenseRest(c, encounter.sector, {
            inputCapture,
            report,
          }).campaign;
        }
        report({ event: 'hospitalDefended', campaign: structuredClone(c) });
      }
      const injured = localPatients();
      if (!injured.length) {
        break;
      }
      const medics = rosterFor(c).filter(
        (op) =>
          c.recruited.includes(op.id) &&
          present(c.operativeState[op.id]).alive &&
          !present(c.operativeState[op.id]).captured &&
          present(c.operativeState[op.id]).location === sector &&
          present(c.operativeState[op.id]).hp >= 15 &&
          !present(c.operativeState[op.id]).bleeding &&
          !present(c.operativeState[op.id]).asleep &&
          present(c.operativeState[op.id]).energy > 10 &&
          op.medical >= careRules(c).minimumSkill &&
          injured.some((id: number) => id !== op.id),
      );
      medics.sort(
        (a, b) =>
          Number(!injured.includes(b.id)) - Number(!injured.includes(a.id)) ||
          b.medical - a.medical ||
          Number(present(c.operativeState[b.id]).medkits > 0) - Number(present(c.operativeState[a.id]).medkits > 0),
      );
      const medic = medics[0];
      assert.ok(medic, 'a living local medic must treat the remaining patients');
      const assign = (operativeId: number, assignment: string) => {
        if (present(c.operativeState[operativeId]).assignment !== assignment) {
          order({ type: 'assignCare', operativeId, assignment });
        }
      };
      // An exhausted earlier doctor is a real blocked assignment. Rotate that
      // actor through ordinary rest/service before asking the clock to continue.
      for (const op of rosterFor(c).filter(
        (op) =>
          c.recruited.includes(op.id) &&
          present(c.operativeState[op.id]).alive &&
          !present(c.operativeState[op.id]).captured &&
          operativeLocation(c, op.id) === sector &&
          op.id !== medic.id &&
          present(c.operativeState[op.id]).assignment === 'doctor',
      )) {
        const r = c.operativeState[op.id];
        assign(
          op.id,
          present(r).hp < present(r).maxHp || present(r).energy < 100 || present(r).fatigue > 0 || present(r).morale < baseMorale(op)
            ? 'rest'
            : 'active',
        );
      }
      for (const operativeId of injured) {
        assign(
          operativeId,
          present(c.operativeState[operativeId]).hp < 15 || present(c.operativeState[operativeId]).bleeding
            ? 'patient'
            : 'rest',
        );
      }
      if (!present(c.operativeState[medic.id]).medkits) {
        const donor = c.recruited.find(
          (id: number) =>
            id !== medic.id &&
            present(c.operativeState[id]).alive &&
            !present(c.operativeState[id]).captured &&
            operativeLocation(c, id) === sector &&
            present(c.operativeState[id]).medkits > 0 &&
            !sectorInventoryModel(c, sector, rosterFor(c), id).reason,
        );
        if (donor !== undefined) {
          const before = present(c.operativeState[medic.id]).medkits + present(c.operativeState[donor]).medkits;
          const known = new Set(
            sectorInventoryModel(c, sector, rosterFor(c), medic.id).entries.map((row) => row.key),
          );
          order({
            type: 'sectorInventory',
            sector,
            operativeId: donor,
            direction: 'drop',
            item: 'medkits',
            count: 1,
          });
          const donated = sectorInventoryModel(c, sector, rosterFor(c), medic.id).entries.find(
            (row) =>
              !known.has(row.key) && row.reachable && JSON.parse(row.expected).item === 'medkits',
          );
          assert.ok(
            donated,
            'the selected physician needs a real path to the local dressing donation',
          );
          order({
            type: 'sectorInventory',
            sector,
            operativeId: medic.id,
            direction: 'take',
            sourceKey: donated.key,
            expected: donated.expected,
            count: 1,
          });
          assert.equal(
            present(c.operativeState[medic.id]).medkits + present(c.operativeState[donor]).medkits,
            before,
            'doctor rotation conserves the actual dressing pool',
          );
          report({
            event: 'northernHospitalDonation',
            sector,
            donor,
            recipient: medic.id,
            quantity: 1,
            hour: c.hour,
          });
        }
        const row =
          !present(c.operativeState[medic.id]).medkits &&
          sectorInventoryModel(c, sector, rosterFor(c), medic.id).entries.find(
            (row) => row.reachable && JSON.parse(row.expected).item === 'medkits',
          );
        if (row) {
          order({
            type: 'sectorInventory',
            sector,
            operativeId: medic.id,
            direction: 'take',
            sourceKey: row.key,
            expected: row.expected,
            count: 1,
          });
        } else if (
          !present(c.operativeState[medic.id]).medkits &&
          c.sectorStates[sector]?.props.some((prop) =>
            prop.contents?.some((item: { item: string; count: number; }) => item.item === 'medkits' && item.count > 0),
          )
        ) {
          const found = collectRouteItems(c, medic.id, { item: 'medkits' }, 12);
          c = found.campaign;
          report({
            event: 'northernHospitalFiniteCare',
            sector,
            operativeId: medic.id,
            quantity: found.collected,
            hour: c.hour,
          });
        }
      }
      if (present(c.operativeState[medic.id]).medkits) {
        const patient = injured
          .filter((id: number) => id !== medic.id)
          .sort(
            (a: string|number, b: string|number) =>
              c.operativeState[a].hp / c.operativeState[a].maxHp -
              c.operativeState[b].hp / c.operativeState[b].maxHp,
          )[0];
        assign(patient, 'patient');
      }
      assign(medic.id, present(c.operativeState[medic.id]).medkits ? 'doctor' : 'rest');
      for (const op of rosterFor(c).filter(
        (op) =>
          c.recruited.includes(op.id) &&
          present(c.operativeState[op.id]).alive &&
          !present(c.operativeState[op.id]).captured &&
          operativeLocation(c, op.id) === sector &&
          !injured.includes(op.id) &&
          op.id !== medic.id,
      )) {
        const r = c.operativeState[op.id];
        if (
          present(r).assignment === 'patient' ||
          (present(r).assignment === 'rest' &&
            present(r).energy >= 100 &&
            present(r).fatigue <= 0 &&
            present(r).morale >= baseMorale(op))
        ) {
          assign(op.id, 'active');
        }
      }
      const beforeClock = c.hour * 3600 + (c.secondOfHour ?? 0);
      const careBefore = {
        stock: present(c.operativeState[medic.id]).medkits,
        energy: present(c.operativeState[medic.id]).energy,
        fatigue: present(c.operativeState[medic.id]).fatigue,
        health: injured.reduce((sum, id) => sum + present(c.operativeState[id]).hp, 0),
      };
      for (
        let notice = 0;
        c.hour * 3600 + (c.secondOfHour ?? 0) === beforeClock && !c.pendingEncounter && notice < 3;
        notice++
      ) {
        order({ type: 'wait', hours: 1 });
      }
      assert.ok(
        c.hour * 3600 + (c.secondOfHour ?? 0) > beforeClock || c.pendingEncounter,
        'the actual care wait must advance or expose its real encounter',
      );
      report({
        event: 'northernHospitalCareTick',
        medic: medic.id,
        medical: medic.medical,
        before: careBefore,
        after: {
          stock: present(c.operativeState[medic.id]).medkits,
          energy: present(c.operativeState[medic.id]).energy,
          fatigue: present(c.operativeState[medic.id]).fatigue,
          asleep: present(c.operativeState[medic.id]).asleep,
          health: injured.reduce((sum, id) => sum + present(c.operativeState[id]).hp, 0),
        },
        elapsedSeconds: c.hour * 3600 + (c.secondOfHour ?? 0) - beforeClock,
        hour: c.hour,
      });
    }
    assert.deepEqual(localPatients(), [], 'surviving local patients must finish recovery');
    assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
    report({
      event: 'northernHospitalCheckpoint',
      stage: 'recovered',
      sector,
      campaign: structuredClone(c),
    });
    return {
      campaign: c,
      sector,
      patients,
      escort,
      ...(coordinateDefense
        ? { reserveReadiness: { careStartSeconds, careDeadlineSeconds, recoveryHours } }
        : {}),
    };
  } catch (error) {
    recordRouteStrategicEvidence({
      helper: 'recoverFreshNorthernDoctor',
      stage: 'preparation-failure',
      campaign: c,
      inputCapture,
      error,
    });
    throw error;
  }
}

// A settled victory can leave no living wounded patients. Keep that fact
// separate from the clinical course above; no healthy person becomes a patient.
// The existing 96-hour base bounds rear preparation, not invented treatment.
function prepareHealthyNorthernReturn(start, { report = () => {} } = {}) {
  const before = structuredClone(start),
    clock = (c: CampaignSnapshot) => c.hour * 3600 + (c.secondOfHour ?? 0),
    began = clock(start),
    deadlineSeconds = began + 96 * 3600,
    sector = start.location;
  let c = decodeSave(encodeSave(start)).campaign;
  const orders = [];
  let rearVisitId: string|null|undefined = null;
  const living = () =>
    c.recruited.filter((id) => {
      const r = c.operativeState[id];
      return present(r).alive && present(r).hp > 0 && !present(r).captured;
    });
  const check = (visitId = null) => {
    assert.equal(c.lastError, null);
    assert.equal(c.defeated, false);
    assert.ok(
      visitId === null
        ? c.pendingBattle === null
        : c.pendingBattle?.id === visitId &&
            c.pendingBattle.exploration === true &&
            c.pendingBattle.sector === sector &&
            c.location === sector &&
            present(c.sectors[sector]).owner === 'patriot',
      'Healthy preparation permits only its matched controlled rear exploration visit.',
    );
    assert.ok(
      c.pendingEncounter === null,
      'Resolve the actual encounter before healthy return preparation.',
    );
    assert.ok(
      clock(c) <= deadlineSeconds,
      'Healthy rear preparation shares only the original 96-hour base.',
    );
    assert.ok(
      before.recruited
        .filter((id: string|number) => before.operativeState[id].alive && !before.operativeState[id].captured)
        .every(
          (id: number) =>
            c.recruited.includes(id) &&
            present(c.operativeState[id]).alive &&
            !present(c.operativeState[id]).captured,
        ),
      'Healthy preparation cannot discard an actual surviving resident.',
    );
    assert.ok(
      living().every((id) => {
        const r = c.operativeState[id];
        return present(r).hp === present(r).maxHp && !present(r).bleeding;
      }),
      'A new actual wound needs the existing clinical course.',
    );
  };
  const order = (action, { rear = false } = {}) => {
    const leaving = rear && action.type === 'leaveSector';
    assert.ok(
      rearVisitId === null ? !leaving : leaving && action.battleId === rearVisitId,
      'Only the matching leave may close the current rear visit.',
    );
    check(leaving ? rearVisitId : null);
    if (action.type === 'visitSector') {
      assert.ok(
        rear &&
          c.location === sector &&
          present(c.sectors[sector]).owner === 'patriot' &&
          (action.sector ?? c.location) === sector,
        'Only rear staging may visit this controlled sector.',
      );
    }
    c = northernHospitalOrder(c, action, { report });
    orders.push(structuredClone(action));
    if (action.type === 'visitSector') {
      assert.ok(
        c.pendingBattle?.exploration === true &&
          c.pendingBattle.sector === sector &&
          typeof c.pendingBattle.id === 'string' &&
          c.pendingBattle.id.length > 0,
        'The actual rear order must open an identified exploration visit.',
      );
      rearVisitId = c.pendingBattle.id;
    } else if (leaving) {
      rearVisitId = null;
    }
    check(rearVisitId);
  };
  check();
  assert.equal(sector, 'tucuman');
  assert.equal(present(c.sectors[sector]).owner, 'patriot');
  assert.ok(
    completedTacticalVictory(c.sectorStates[sector]),
    'Healthy continuation requires the actual settled Native victory.',
  );
  const available = () =>
    rosterFor(c).filter((op) => {
      const r = c.operativeState[op.id],
        contract = c.contracts[op.id],
        expiry = contract && contractExpiresSeconds(contract);
      return (
        living().includes(op.id) &&
        operativeLocation(c, op.id) === sector &&
        !operativeInTransit(c, op.id) &&
        contract &&
        !contract.departurePending &&
        (expiry === null || present(expiry) > clock(c)) &&
        present(r).hp >= 15 &&
        !present(r).routed &&
        !present(r).unconscious &&
        !present(r).surrendered &&
        !present(r).asleep &&
        present(r).energy > 10 &&
        ['active', 'rest'].includes(present(r).assignment ?? 'active')
      );
    });
  const locals = available();
  assert.ok(locals.length, 'The real healthy return needs a fit local serving party.');
  const envoy = locals
    .filter((op) => op.id !== 1000 && op.leadership >= 40)
    .sort((a, b) => c.recruited.indexOf(a.id) - c.recruited.indexOf(b.id))[0];
  assert.ok(envoy, 'The physical capital meetings need an actual qualified living envoy.');
  const party = [
    envoy.id,
    ...locals
      .filter(
        (op) =>
          op.id !== envoy.id &&
          op.id !== 1000 &&
          c.recruited.indexOf(op.id) > c.recruited.indexOf(envoy.id),
      )
      .sort((a, b) => b.marksmanship - a.marksmanship || a.id - b.id)
      .slice(0, 4)
      .map((op) => op.id),
  ];
  const kitsBefore = living().reduce((sum, id) => sum + (present(c.operativeState[id]).medkits ?? 0), 0),
    cash = c.resources.treasury;
  let issuedDressings = 0;
  order({ type: 'createSquad', name: 'Supervivientes sin heridas', ids: party, sector });
  if (!c.officer) {
    order({
      type: 'createOfficer',
      name: 'Oficial de socorro',
      answers: { origin: 'cabildo', doctrine: 'line_marksman', crisis: 'rescue' },
    });
    assert.equal(cash - c.resources.treasury, 300);
    assert.equal(present(c.operativeState[1000]).medkits, 2);
    issuedDressings = 2;
    report({
      event: 'northernReliefOfficer',
      operativeId: 1000,
      sector,
      cost: 300,
      dressings: 2,
      hour: c.hour,
    });
  }
  assert.equal(
    c.contracts[1000]?.paid,
    300,
    'The original continuation retains its actual paid legacy officer.',
  );
  assert.ok(
    available().some((op) => op.id === 1000),
    'The actual officer must be fit, local and serving.',
  );
  if (!c.squad.includes(1000)) {
    order({ type: 'squad', ids: [...party, 1000] });
  }
  const returning = [...c.squad],
    returnHome = c.activeSquadId;
  assert.ok(returning.length > 0 && returning.length <= 6 && returning.includes(1000));
  c = finishReloadsBeforeMarch(c, { deadlineSeconds, report });
  check();
  const escort = living().filter(
    (id) => operativeLocation(c, id) === sector && !returning.includes(id),
  );
  assert.ok(
    escort.every((id) => available().some((op) => op.id === id)),
    'Other local clinical or unavailable residents cannot be borrowed for healthy rear work.',
  );
  if (escort.length) {
    const guards = rosterFor(c)
      .filter((op) => escort.includes(op.id))
      .sort((a, b) => b.marksmanship - a.marksmanship || a.id - b.id)
      .slice(0, 6)
      .map((op) => op.id);
    order({ type: 'createSquad', name: 'Guardia de los supervivientes', ids: guards, sector });
    check();
    c = prepareNorthernHospitalRear(c, guards, {
      applyOrder: (state, action) => {
        c = state;
        order(action, { rear: true });
        return c;
      },
      targetCount: guards.length,
      coordinatePhysicians: true,
      report,
    }).campaign;
    check();
    assert.ok(rearVisitId === null, 'Rear staging must close its actual exploration visit.');
    for (const operativeId of escort) {
      if (present(c.operativeState[operativeId]).assignment !== 'rest') {
        order({ type: 'assignCare', operativeId, assignment: 'rest' });
      }
    }
  }
  if (c.activeSquadId !== returnHome) {
    order({ type: 'selectSquad', id: returnHome });
  }
  assert.equal(
    living().reduce((sum, id) => sum + (present(c.operativeState[id]).medkits ?? 0), 0),
    kitsBefore + issuedDressings,
    'Healthy preparation cannot invent or spend clinical linen.',
  );
  for (const id of returning) {
    assert.ok(
      c.recruited.includes(id) && present(c.operativeState[id]).alive && operativeLocation(c, id) === sector,
    );
    assert.equal(present(c.operativeState[id]).hp, present(c.operativeState[id]).maxHp);
    assert.equal(present(c.operativeState[id]).bleeding, 0);
  }
  for (const [id, r] of Object.entries(before.operativeState)) {
    if (!r.alive) {
      assert.equal(c.operativeState[id].alive, false);
      assert.equal(c.operativeState[id].hp, r.hp);
      assert.equal(c.operativeState[id].deathMinute, r.deathMinute);
    }
  }
  check();
  assert.ok(rearVisitId === null, 'The healthy return must finish with no rear visit.');
  assert.deepEqual(start, before);
  assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
  report({
    event: 'northernHealthyReturnPrepared',
    sector,
    patients: [],
    returning,
    escort,
    orders,
    issuedDressings,
    dressingsSpent: 0,
    startSeconds: began,
    endSeconds: clock(c),
    deadlineSeconds,
  });
  return {
    campaign: c,
    sector,
    patients: [],
    escort,
    reserveReadiness: {
      careStartSeconds: began,
      careDeadlineSeconds: deadlineSeconds,
      recoveryHours: 96,
    },
  };
}

// Continue either actual survivor state through the same ordinary return.
// An occupied town remains for the later explicit northern-road recapture.
export function recoverFreshNorthernDoctor(start: CampaignSnapshot, { report = () => {} } = {}) {
  // The canonical funded continuation retains paid rear roles during a raid.
  // Direct historical hospital callers keep their established default policy.
  const patients = start.recruited.filter((id) => {
    const r = start.operativeState[id];
    return present(r).alive && !present(r).captured && (present(r).hp < present(r).maxHp || present(r).bleeding > 0);
  });
  return returnFreshNorthernHospital(
    patients.length
      ? recoverFreshNorthernHospital(start, { report, coordinateDefense: true })
      : prepareHealthyNorthernReturn(start, { report }),
    { report },
  );
}

// Keep an actual paid rifleman at the clinic before the return advances time.
// Its issued dressing is transferred through the public sector inventory. The
// physician takes a reachable vacant roof cell beside the earned guard posts;
// no other defender is restaged and no body, stock or clock is assigned.
export function prepareNorthernHospitalReturnGuard(hospital, { report = () => {} } = {}) {
  const before = structuredClone(hospital),
    sector = hospital.sector,
    escort = [...hospital.escort];
  let c = decodeSave(encodeSave(hospital.campaign)).campaign;
  if (!c.enemyGroups.some((group) => group.target === sector && group.status === 'marching')) {
    return { ...hospital, campaign: c, escort, returnDoctor: null };
  }
  assert.equal(c.pendingEncounter, null);
  assert.equal(c.pendingBattle, null);
  const candidates = rosterFor(c)
    .filter(
      (op) =>
        op.id >= 100 &&
        op.id < 1000 &&
        !c.recruited.includes(op.id) &&
        !c.hiringArrivals.some((row) => row.operativeId === op.id) &&
        present(c.operativeState[op.id]).alive &&
        !present(c.operativeState[op.id]).captured,
    )
    .map((op) => ({ op, quote: contractQuote(c, op, 'day') }))
    .filter((row) => row.quote.available && row.quote.total <= c.resources.treasury)
    .sort(
      (a, b) =>
        b.op.marksmanship - a.op.marksmanship || a.quote.total - b.quote.total || a.op.id - b.op.id,
    );
  const selected = candidates[0];
  assert.ok(selected, 'The threatened clinic needs an actual available paid guard.');
  const booked = bookRouteHires(c, [selected.op.id], { term: 'day', destination: sector, report });
  c = booked.campaign;
  const hire = booked.hires[0];
  const order = (action) => {
    c = northernHospitalOrder(c, action, { report });
  };
  for (
    let hour = 0;
    hour < 24 && c.hiringArrivals.some((row) => row.operativeId === present(hire).id);
    hour++
  ) {
    assert.equal(c.pendingEncounter, null);
    order({ type: 'wait', hours: 1 });
  }
  assertRouteHireArrived(c, hire);
  const home = c.squads
    .filter(
      (q) =>
        q.location === sector &&
        !q.journey &&
        q.members.length > 0 &&
        q.members.length < 6 &&
        q.members.some((id) => escort.includes(id)),
    )
    .sort((a, b) => b.members.length - a.members.length || a.id.localeCompare(b.id))[0];
  if (home) {
    order({ type: 'assignToSquad', operativeId: present(hire).id, squadId: home.id });
  } else {
    order({ type: 'createSquad', ids: [present(hire).id], sector, name: 'Guardia de la evacuación' });
  }
  escort.push(present(hire).id);
  const doctor = rosterFor(c)
    .filter(
      (op) =>
        escort.includes(op.id) &&
        op.id !== present(hire).id &&
        operativeLocation(c, op.id) === sector &&
        present(c.operativeState[op.id]).alive &&
        !present(c.operativeState[op.id]).captured &&
        present(c.operativeState[op.id]).hp >= 15 &&
        !present(c.operativeState[op.id]).bleeding &&
        !present(c.operativeState[op.id]).asleep &&
        op.medical > 0,
    )
    .sort((a, b) => b.medical - a.medical || a.id - b.id)[0];
  assert.ok(doctor, 'A serving local physician must cover the actual clinic guard.');
  if (!present(c.operativeState[doctor.id]).medkits) {
    assert.ok(
      present(c.operativeState[hire.id]).medkits > 0,
      'The paid guard must carry a real dressing for the clinic.',
    );
    const stock = present(c.operativeState[hire.id]).medkits + present(c.operativeState[doctor.id]).medkits,
      known = new Set(
        sectorInventoryModel(c, sector, rosterFor(c), doctor.id).entries.map((row) => row.key),
      );
    order({
      type: 'sectorInventory',
      sector,
      operativeId: present(hire).id,
      direction: 'drop',
      item: 'medkits',
      count: 1,
    });
    const row = sectorInventoryModel(c, sector, rosterFor(c), doctor.id).entries.find(
      (row) => !known.has(row.key) && row.reachable && JSON.parse(row.expected).item === 'medkits',
    );
    assert.ok(row, 'The clinic physician needs the actual reachable donated dressing.');
    order({
      type: 'sectorInventory',
      sector,
      operativeId: doctor.id,
      direction: 'take',
      sourceKey: row.key,
      expected: row.expected,
      count: 1,
    });
    assert.equal(present(c.operativeState[hire.id]).medkits + present(c.operativeState[doctor.id]).medkits, stock);
    report({
      event: 'northernReturnDressingDonation',
      donor: present(hire).id,
      doctor: doctor.id,
      count: 1,
      sourceKey: row.key,
      stockBefore: stock,
      stockAfter: stock,
    });
  }
  const active = c.activeSquadId,
    startSeconds = c.hour * 3600 + (c.secondOfHour ?? 0),
    positions = escort
      .filter(
        (id) =>
          id !== doctor.id &&
          present(c.operativeState[id]).residentPosition &&
          (present(c.operativeState[id]).residentPosition.tacticalLevel ?? 0) > 0,
      )
      .map((id) => present(c.operativeState[id]).residentPosition);
  const occupied = c.recruited
    .filter(
      (id) =>
        id !== doctor.id &&
        present(c.operativeState[id]).alive &&
        !present(c.operativeState[id]).captured &&
        operativeLocation(c, id) === sector,
    )
    .map((id) => present(c.operativeState[id]).residentPosition)
    .filter(Boolean);
  order({ type: 'createSquad', ids: [doctor.id], sector, name: 'Sanitario de la guardia' });
  order({ type: 'assignCare', operativeId: doctor.id, assignment: 'active' });
  order({ type: 'visitSector' });
  let battle = enterSector(c.pendingBattle, c.sectorStates[sector]);
  const unitId = String(doctor.id),
    actions = [];
  const roofs = getReachable(
    battle,
    battle.units.find((unit) => unit.id === unitId),
  )
    .filter(
      (point) =>
        (point.tacticalLevel ?? 0) > 0 && !occupied.some((other) => sameCell(other, point)),
    )
    .map((point: TacticalPoint) => ({
      ...point,
      neighbors: positions.filter(
        (other: TacticalPoint) =>
          sameSurface(other, point) && Math.hypot(other.x - point.x, other.y - point.y) <= 1.5,
      ).length,
      distance: positions.reduce(
        (sum, other: TacticalPoint) => sum + Math.hypot(other.x - point.x, other.y - point.y),
        0,
      ),
    }))
    .sort(
      (a, b) =>
        b.neighbors - a.neighbors ||
        present(a.distance) - present(b.distance) ||
        a.cost - b.cost ||
        a.y - b.y ||
        a.x - b.x,
    );
  const destination = roofs[0];
  assert.ok(
    destination && destination.neighbors > 0,
    'The physician needs reachable cover beside the actual roof guards.',
  );
  const act = (action: TacticalAction) => {
    battle = actBattle(battle, action);
    assert.equal(battle.lastError, null, JSON.stringify(action) + battle.lastError);
    actions.push(action);
  };
  act({ type: 'movement', unitId, movement: 'walk' });
  for (
    let leg = 0;
    !sameCell(
      battle.units.find((unit) => unit.id === unitId),
      destination,
    ) && leg < 64;
    leg++
  ) {
    act({ type: 'move', unitId, ...spacePoint(destination) });
  }
  assert.ok(
    sameCell(
      battle.units.find((unit) => unit.id === unitId),
      destination,
    ),
  );
  act({ type: 'stance', unitId, stance: 'crouched' });
  const synced = syncBattleTime(c, battle);
  assert.equal(synced.error, null);
  c = synced.campaign;
  order({
    type: 'leaveSector',
    battleId: present(c.pendingBattle).id,
    sectorState: synced.battle,
    survivors: synced.battle.units.filter((unit) => unit.side === 'player'),
  });
  order({ type: 'selectSquad', id: active });
  report({
    event: 'northernReturnGuardReady',
    guardId: present(hire).id,
    doctorId: doctor.id,
    hire: structuredClone(hire),
    position: structuredClone(present(c.operativeState[doctor.id]).residentPosition),
    actions,
    elapsedSeconds: c.hour * 3600 + (c.secondOfHour ?? 0) - startSeconds,
    campaign: structuredClone(c),
  });
  assert.deepEqual(hospital, before);
  assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
  return { ...hospital, campaign: c, escort, returnDoctor: doctor.id };
}

// Stop at the same native victory gate as the game. A cleared exploration
// sector is complete even while its status remains active. Replay only real
// issued orders, with the official campaign/battle save at the midpoint.
export function settleNorthernHospitalReturnDefense(
  start: CampaignSnapshot,
  sector: string|number|undefined,
  { doctorId, report = () => {} } = {},
) {
  const before = structuredClone(start),
    request = start.pendingBattle,
    previous = start.sectorStates[sector];
  assert.equal(present(request).sector, sector);
  let battle = enterSector(request, previous);
  const orders = [];
  report({
    event: 'northernReturnDefenseInput',
    campaign: structuredClone(start),
    battle: structuredClone(battle),
  });
  for (
    let window = 0;
    window < 600 &&
    battle.turn <= 80 &&
    battle.status === 'active' &&
    !completedTacticalVictory(battle);
    window++
  ) {
    const ids = battle.units
      .filter((unit) => unit.side === 'player' && !unit.militia)
      .sort((a, b) => b.marksmanship - a.marksmanship)
      .map((unit) => unit.id);
    for (
      let attempt = 0;
      attempt < 16 && battle.status === 'active' && !completedTacticalVictory(battle);
      attempt++
    ) {
      let acted = false;
      for (const id of ids) {
        if (battle.status !== 'active' || completedTacticalVictory(battle)) {
          break;
        }
        const unit = battle.units.find((unit) => unit.id === id);
        if (!interruptAvailable(battle, unit) || present(unit).ap < 3) {
          continue;
        }
        const action =
          id === String(doctorId)
            ? northernHospitalCoverOrder(battle, unit)
            : tucumanCombatOrder(battle, unit);
        if (!action) {
          continue;
        }
        const next = actBattle(battle, action);
        assert.equal(next.lastError, null, JSON.stringify(action) + next.lastError);
        battle = next;
        orders.push(action);
        acted = true;
      }
      if (!acted) {
        break;
      }
    }
    if (battle.status === 'active' && !completedTacticalVictory(battle)) {
      battle = endTurn(battle);
      assert.equal(battle.lastError, null, battle.lastError);
      orders.push({ type: 'endTurn' });
    }
  }
  const summary = {
    sector,
    preparationSeconds: 0,
    startSeconds: battle.startSeconds,
    elapsedSeconds: battle.elapsedSeconds,
    status: battle.status,
    mode: battle.mode,
    sectorCleared: battle.sectorCleared,
    turns: battle.turn,
    actions: orders.filter((action) => action.type !== 'endTurn').length,
    units: battle.units.map((unit) => ({
      id: unit.id,
      side: unit.side,
      hp: unit.hp,
      ammo: unit.ammo,
      loaded: unit.loaded,
      routed: unit.routed,
    })),
  };
  report({ event: 'battleFinished', ...summary });
  assert.ok(completedTacticalVictory(battle), JSON.stringify(summary));
  const replay = (withSave: boolean) => {
    let pair = { campaign: structuredClone(start), battle: enterSector(request, previous) };
    for (let index = 0; index < orders.length; index++) {
      const action = orders[index],
        next = action.type === 'endTurn' ? endTurn(pair.battle) : actBattle(pair.battle, action);
      assert.equal(next.lastError, null, JSON.stringify(action) + next.lastError);
      const synced = syncBattleTime(pair.campaign, next);
      assert.equal(synced.error, null, synced.error);
      pair = { campaign: synced.campaign, battle: synced.battle };
      if (withSave && index === Math.floor(orders.length / 2)) {
        pair = decodeSave(encodeSave(pair.campaign, pair.battle));
      }
    }
    return pair;
  };
  const played = replay(false),
    restored = replay(true);
  assert.deepEqual(restored, played);
  assert.deepEqual(played.battle.units, battle.units);
  assert.equal(played.battle.seed, battle.seed);
  assert.equal(played.battle.elapsedSeconds, battle.elapsedSeconds);
  assert.ok(completedTacticalVictory(restored.battle));
  const c = dispatchCampaign(restored.campaign, {
    type: 'battleResult',
    battleId: present(request).id,
    outcome: 'victory',
    sectorState: restored.battle,
    survivors: restored.battle.units.filter((unit) => unit.side === 'player'),
  });
  assert.equal(c.lastError, null, c.lastError);
  assert.equal(c.defeated, false);
  assert.equal(c.sectors[sector].owner, 'patriot');
  assert.equal(c.pendingBattle, null);
  for (const unit of battle.units.filter(
    (unit) => unit.side === 'player' && unit.hp <= 0 && !unit.militia && !unit.missionAlly,
  )) {
    assert.equal(present(c.operativeState[Number(unit.id)]).alive, false);
  }
  for (const [id, record] of Object.entries(before.operativeState)) {
    if (!record.alive) {
      assert.equal(c.operativeState[id].alive, false);
    }
  }
  assert.deepEqual(start, before);
  assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
  report({
    event: 'northernReturnDefenseReplay',
    ...summary,
    orders,
    exactSavedReplay: true,
    losses: start.recruited.filter(
      (id) => present(start.operativeState[id]).alive && !present(c.operativeState[id]).alive,
    ),
    campaign: structuredClone(c),
  });
  return { campaign: c, summary };
}

// Resume a strict saved hospital boundary without repeating treatment or fees.
export function returnFreshNorthernHospital(hospital, { report = () => {} } = {}) {
  const start = hospital.campaign,
    inputCapture = recordRouteStrategicEvidence({
      helper: 'recoverFreshNorthernDoctor',
      stage: 'recovered-hospital-input',
      campaign: start,
    });
  let c = decodeSave(encodeSave(start)).campaign;
  assert.deepEqual(c, start);
  const originalReturnParty = hospital.reserveReadiness
    ? c.recruited.filter((id) => {
        const r = c.operativeState[id];
        return (
          present(r).alive &&
          !present(r).captured &&
          operativeLocation(c, id) === hospital.sector &&
          !hospital.escort.includes(id)
        );
      })
    : null;
  const prepared = prepareNorthernHospitalReturnGuard(hospital, { report });
  c = prepared.campaign;
  const { sector, escort, returnDoctor } = prepared;
  const order = (a) => {
    c = northernHospitalOrder(c, a, { inputCapture, report });
  };
  try {
    const party =
      originalReturnParty ??
      c.recruited.filter((id) => {
        const r = c.operativeState[id];
        return (
          present(r).alive && !present(r).captured && operativeLocation(c, id) === sector && !escort.includes(id)
        );
      });
    assert.ok(
      party.every(
        (id) =>
          c.recruited.includes(id) &&
          present(c.operativeState[id]).alive &&
          !present(c.operativeState[id]).captured &&
          operativeLocation(c, id) === sector,
      ),
      'Keep the actual recovered field party before reserve preparation.',
    );
    assert.ok(party.length > 0 && party.length <= 6);
    if (c.location !== sector) {
      const home = c.squads.find(
        (q) => q.location === sector && !q.journey && q.members.includes(party[0]),
      );
      assert.ok(
        home,
        'Select an actual local hospital squad before assembling its returning patients.',
      );
      order({ type: 'selectSquad', id: home.id });
    }
    order({ type: 'squad', ids: party });
    const resolveReturnContact = () => {
      while (c.pendingEncounter) {
        const returning = c.activeSquadId,
          encounter = c.pendingEncounter;
        const defenders = c.squads.find(
          (q) =>
            q.location === encounter.sector &&
            q.members.some((id) => present(c.operativeState[id]).alive && !present(c.operativeState[id]).captured),
        );
        assert.ok(defenders, 'the threatened sector needs its actual local guard');
        order({ type: 'selectSquad', id: defenders.id });
        order({ type: 'respondToEncounter', groupId: encounter.groupId, choice: 'tactical' });
        const defense = settleNorthernHospitalReturnDefense(c, encounter.sector, {
          doctorId: returnDoctor,
          report,
        });
        c = defense.campaign;
        const injured = defense.summary.units
          .filter(
            (unit) => unit.side === 'player' && unit.hp > 0 && c.operativeState[Number(unit.id)],
          )
          .map((unit) => Number(unit.id))
          .filter((id) => present(c.operativeState[id]).hp < 15 || present(c.operativeState[id]).bleeding > 0);
        if (injured.length) {
          for (const operativeId of injured) {
            order({ type: 'assignCare', operativeId, assignment: 'patient' });
          }
          const physician = rosterFor(c)
            .filter(
              (op) =>
                operativeLocation(c, op.id) === encounter.sector &&
                [undefined, 'no_medkits'].includes(careAssignmentIssue(c, op, 'doctor')?.code),
            )
            .sort((a, b) => b.medical - a.medical || a.id - b.id)[0];
          assert.ok(
            physician,
            'Actual bleeding return guards need a serving local physician before the clock advances.',
          );
          const care = stabilizeNorthernHospitalPatients(c, injured, [physician.id], {
            inputCapture,
            report,
          });
          c = care.campaign;
          report({
            event: 'northernReturnFiniteCare',
            sector: encounter.sector,
            receipt: care.receipt,
            campaign: structuredClone(c),
          });
        }
        for (const unit of defense.summary.units.filter(
          (unit) => unit.side === 'player' && unit.hp > 0,
        )) {
          const record = c.operativeState[Number(unit.id)];
          if (record) {
            assert.ok(
              record.alive && record.hp >= 15 && !record.bleeding,
              'Actual surviving guards need timely finite aid before the return clock advances.',
            );
          }
        }
        report({ event: 'northernReturnDefended', groupId: encounter.groupId, ...defense.summary });
        order({ type: 'selectSquad', id: returning });
      }
    };
    if (hospital.reserveReadiness) {
      const { careStartSeconds, careDeadlineSeconds, recoveryHours } = hospital.reserveReadiness;
      assert.equal(careDeadlineSeconds, careStartSeconds + recoveryHours * 3600);
      const reserveSectors = [
        ...new Set(
          escort
            .filter(
              (id: number) =>
                c.recruited.includes(id) &&
                present(c.operativeState[id]).alive &&
                !present(c.operativeState[id]).captured &&
                !operativeInTransit(c, id),
            )
            .map((id: number) => operativeLocation(c, id)),
        ),
      ].filter((at) => at !== sector);
      for (const at of reserveSectors) {
        const ids = escort.filter(
          (id: number) =>
            c.recruited.includes(id) &&
            present(c.operativeState[id]).alive &&
            !present(c.operativeState[id]).captured &&
            !operativeInTransit(c, id) &&
            operativeLocation(c, id) === at,
        );
        const ready = prepareNorthernHospitalReserveReadiness(c, {
          sector: at,
          ids,
          deadlineSeconds: careDeadlineSeconds,
          report,
          resolveEncounter: (state: CampaignSnapshot) => {
            c = state;
            resolveReturnContact();
            return c;
          },
        });
        c = ready.campaign;
        report({
          event: 'northernHospitalReservePrepared',
          receipt: ready.receipt,
          campaign: structuredClone(c),
        });
        const stock = prepareNorthernHospitalReserveStock(c, {
          sector: at,
          ids,
          deadlineSeconds: careDeadlineSeconds,
          report,
        });
        c = stock.campaign;
        report({
          event: 'northernHospitalReserveStockPrepared',
          receipt: stock.receipt,
          campaign: structuredClone(c),
        });
        if (at === 'tucuman' && ids.length === 5) {
          const funding = northernHospitalReturnFunding(c),
            horizonSeconds = funding.untilSeconds,
            deadlineSeconds = Math.min(careDeadlineSeconds, horizonSeconds);
          const reserve = prepareNorthernHospitalSixPersonReserve(c, {
            sector: at,
            ids,
            deadlineSeconds,
            horizonSeconds,
            report,
          });
          c = reserve.campaign;
          if (!reserve.ready) {
            throw Object.assign(
              new Error('The actual hospital reserve preparation stopped: ' + reserve.reason),
              {
                campaign: c,
                battle: reserve.battle,
                pair: { campaign: c, battle: reserve.battle },
                hospitalSixPersonReserve: reserve.receipt,
              },
            );
          }
          assert.ok(reserve.reliefId !== null);
          escort.push(reserve.reliefId);
          report({
            event: 'northernHospitalSixPersonReservePrepared',
            receipt: reserve.receipt,
            campaign: structuredClone(c),
          });
        }
      }
    }
    const journey = () => c.squads.find((q) => q.id === c.activeSquadId)?.journey;
    for (let leg = 0; leg < 6 && c.location !== 'buenos_aires'; leg++) {
      resolveReturnContact();
      // A remote defense stops the clock without cancelling this physical route.
      for (let h = 0; h < 240 && journey()?.status === 'moving'; h++) {
        order({ type: 'wait', hours: 1 });
        resolveReturnContact();
      }
      assert.notEqual(
        journey()?.status,
        'moving',
        'the real return leg must finish or stop for rest',
      );
      if (c.location === 'buenos_aires') {
        break;
      }
      if (journey()) {
        assert.equal(
          present(journey()).status,
          'paused',
          'the medical return must remain a normal travel route',
        );
      }
      // Rural cells admit ordinary sleep, but they are not owned hospitals. End
      // the paused leg at its real boundary, sleep, then plan the remaining route.
      if (journey()) {
        order({ type: 'cancelTravel', choice: 'stop' });
      }
      assert.equal(journey(), undefined, 'actual rural recovery needs a finished travel boundary');
      for (const operativeId of c.squad) {
        const r = c.operativeState[operativeId];
        if (!present(r).asleep && (present(r).fatigue > 0 || present(r).energy < 100)) {
          order({ type: 'setSleep', operativeId, asleep: true });
        }
      }
      for (let h = 0; h < 48 && c.squad.some((id) => present(c.operativeState[id]).asleep); h++) {
        order({ type: 'wait', hours: 1 });
        resolveReturnContact();
      }
      assert.ok(
        c.squad.every((id) => !present(c.operativeState[id]).asleep),
        'the actual party must finish its sleep before continuing',
      );
      for (const operativeId of c.squad) {
        order({ type: 'assignCare', operativeId, assignment: 'active' });
      }
      if (journey()) {
        order({ type: 'resumeTravel' });
      } else {
        const funding = northernHospitalReturnFunding(c);
        report({
          event: 'northernHospitalReturnFunding',
          hour: c.hour,
          secondOfHour: c.secondOfHour ?? 0,
          ...funding,
        });
        order({
          type: 'travel',
          sector: 'buenos_aires',
          ...(funding.queued ? { queue: true } : {}),
        });
      }
      resolveReturnContact();
    }
    assert.equal(c.location, 'buenos_aires');
    for (const operativeId of c.squad) {
      order({ type: 'assignCare', operativeId, assignment: 'active' });
    }
    c = meetRecruits(
      c,
      ['paroissien', 'dorrego'],
      c.squad.find((id) => present(c.operativeState[id]).alive),
    );
    for (const [id, r] of Object.entries(start.operativeState)) {
      if (!r.alive) {
        assert.equal(c.operativeState[id].alive, false);
      }
    }
    assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
    return c;
  } catch (error) {
    if (error?.campaign) {
      c = error.campaign;
    }
    recordRouteStrategicEvidence({
      helper: 'recoverFreshNorthernDoctor',
      stage: 'preparation-failure',
      campaign: c,
      inputCapture,
      error,
      context: {
        hospitalReserveReadiness: error?.hospitalReserveReadiness ?? null,
        hospitalReserveStock: error?.hospitalReserveStock ?? null,
        hospitalSixPersonReserve: error?.hospitalSixPersonReserve ?? null,
        battle: error?.battle ?? null,
      },
    });
    throw error;
  }
}

// Use one native controller run, then replay only its issued orders. The official
// midpoint save must preserve the full campaign/battle pair before settlement.
function settleNorthernReturnRecapture(start: CampaignSnapshot, report) {
  const request = start.pendingBattle,
    previous = start.sectorStates.cordoba;
  assert.equal(present(request).sector, 'cordoba');
  // The returning infantry has two edge approaches. Use the existing native
  // infantry policy rather than advancing every soldier with the mobile gun.
  const result = fightOpeningBattle(request, previous, { controller: northernCombatOrder });
  const summary = {
    sector: 'cordoba',
    preparationSeconds: 0,
    startSeconds: result.battle.startSeconds,
    elapsedSeconds: result.battle.elapsedSeconds,
    status: result.battle.status,
    turns: result.battle.turn,
    actions: result.actions,
    units: result.battle.units.map((u) => ({
      id: u.id,
      side: u.side,
      hp: u.hp,
      ammo: u.ammo,
      loaded: u.loaded,
      routed: u.routed,
    })),
  };
  report({ event: 'battleFinished', ...summary });
  assert.equal(result.battle.status, 'victory', JSON.stringify(summary));
  const replay = (withSave: boolean) => {
    let pair = { campaign: structuredClone(start), battle: enterSector(request, previous) };
    for (let index = 0; index < result.orders.length; index++) {
      const action = result.orders[index],
        battle = present(action).type === 'endTurn' ? endTurn(pair.battle) : actBattle(pair.battle, action);
      assert.equal(battle.lastError, null, JSON.stringify(action) + battle.lastError);
      const synced = syncBattleTime(pair.campaign, battle);
      assert.equal(synced.error, null, synced.error);
      pair = { campaign: synced.campaign, battle: synced.battle };
      if (withSave && index === Math.floor(result.orders.length / 2)) {
        pair = decodeSave(encodeSave(pair.campaign, pair.battle));
      }
    }
    return pair;
  };
  const played = replay(false),
    restored = replay(true);
  assert.deepEqual(restored, played);
  assert.deepEqual(played.battle.units, result.battle.units);
  assert.equal(played.battle.seed, result.battle.seed);
  assert.equal(played.battle.elapsedSeconds, result.battle.elapsedSeconds);
  assert.equal(played.battle.status, result.battle.status);
  const c = dispatchCampaign(restored.campaign, {
    type: 'battleResult',
    battleId: present(request).id,
    outcome: restored.battle.status,
    sectorState: restored.battle,
    survivors: restored.battle.units.filter((u) => u.side === 'player'),
  });
  assert.equal(c.lastError, null, c.lastError);
  assert.equal(c.defeated, false);
  assert.equal(present(c.sectors.cordoba).owner, 'patriot');
  assert.equal(c.pendingBattle, null);
  for (const unit of result.battle.units.filter(
    (u) => u.side === 'player' && u.hp <= 0 && !u.militia && !u.missionAlly,
  )) {
    assert.equal(present(c.operativeState[Number(unit.id)]).alive, false);
  }
  assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
  recordRouteStrategicEvidence({
    helper: 'settleNorthernReturnRecapture',
    stage: 'route-checkpoint',
    campaign: c,
    context: {
      start,
      request,
      previous,
      result,
      played,
      restored,
      summary,
      scope:
        'Completed native road victory, exact synchronized and official midpoint replay, and the already applied unique settlement. No additional orders or settlement.',
    },
  });
  report({
    event: 'northernReturnRecaptured',
    ...summary,
    orders: result.orders.length,
    exactSavedReplay: true,
    campaign: structuredClone(c),
  });
  return c;
}

// Stabilize the actual recapture survivors before a conversation advances the
// tactical clock. This uses only ordinary orders and the carried finite kits.
// Full health still requires the existing paid, supplied clinical care below.
export function stabilizeNorthernRecapture(start: CampaignSnapshot, { report = () => {} } = {}) {
  const prior = decodeSave(encodeSave(start)).campaign;
  const urgent = prior.squad.filter((id) => {
    const r = prior.operativeState[id];
    return present(r).alive && !present(r).captured && (present(r).hp < 15 || present(r).bleeding > 0);
  });
  if (!urgent.length) {
    return prior;
  }
  const campaign = dispatchCampaign(prior, { type: 'visitSector' });
  assert.equal(campaign.lastError, null, campaign.lastError);
  const initial = enterSector(campaign.pendingBattle, campaign.sectorStates[campaign.location]),
    aid = autoBandageBattle(initial);
  const replay = (withSave: boolean) => {
    let pair = { campaign: structuredClone(campaign), battle: initial };
    for (let index = 0; index < aid.steps.length; index++) {
      const battle = actBattle(pair.battle, aid.steps[index]);
      assert.equal(battle.lastError, null, JSON.stringify(aid.steps[index]) + battle.lastError);
      const synced = syncBattleTime(pair.campaign, battle);
      assert.equal(synced.error, null, synced.error);
      pair = { campaign: synced.campaign, battle: synced.battle };
      if (withSave && index === Math.floor(aid.steps.length / 2)) {
        pair = decodeSave(encodeSave(pair.campaign, pair.battle));
      }
    }
    return pair;
  };
  const played = replay(false),
    restored = replay(true);
  assert.deepEqual(restored, played);
  assert.deepEqual(played.battle.units, aid.battle.units);
  assert.equal(played.battle.seed, aid.battle.seed);
  assert.equal(played.battle.elapsedSeconds, aid.battle.elapsedSeconds);
  for (const id of urgent) {
    const patient = played.battle.units.find((u) => u.id === String(id));
    assert.ok(
      present(patient?.hp) >= 15 && !present(patient).bleeding,
      `Actual recapture patient ${id} needs finite first aid before the meeting: ${aid.stoppedReason ?? ''}`,
    );
  }
  const c = dispatchCampaign(restored.campaign, {
    type: 'leaveSector',
    battleId: present(campaign.pendingBattle).id,
    sectorState: restored.battle,
    survivors: restored.battle.units.filter((u) => u.side === 'player'),
  });
  assert.equal(c.lastError, null, c.lastError);
  for (const [id, r] of Object.entries(prior.operativeState)) {
    if (!r.alive) {
      assert.equal(c.operativeState[id].alive, false);
    }
  }
  for (const id of prior.recruited.filter((id) => present(prior.operativeState[id]).alive)) {
    assert.equal(present(c.operativeState[id]).alive, true);
  }
  assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
  report({
    event: 'northernRecaptureFirstAid',
    urgent,
    actions: aid.steps,
    elapsedSeconds: aid.elapsedSeconds,
    treatedIds: aid.treatedIds,
    untreated: aid.untreated,
    stoppedReason: aid.stoppedReason,
    exactSavedReplay: true,
    before: initial.units
      .filter((u) => u.side === 'player')
      .map((u) => ({
        id: u.id,
        hp: u.hp,
        bleeding: u.bleeding,
        bandaged: u.bandaged,
        medical: u.medical,
        medkits: u.medkits,
        energy: u.energy,
        x: u.x,
        y: u.y,
        tacticalLevel: u.tacticalLevel ?? 0,
        routed: u.routed,
        unconscious: u.unconscious,
      })),
    campaign: structuredClone(c),
  });
  return c;
}

// The relief can return with seven living soldiers after the two real Buenos
// Aires conversations. Form ordinary columns; no survivor is left behind to
// satisfy the public six-member squad limit.
export function prepareNorthernReunionColumns(start: CampaignSnapshot, { report = () => {} } = {}) {
  let c = decodeSave(encodeSave(start)).campaign;
  const field = [...new Set([10, 4, ...c.squad])].filter(
    (id) => c.operativeState[id]?.alive && !c.operativeState[id]?.captured,
  );
  assert.ok(field.length, 'The reunion needs its actual living field soldiers.');
  const actions = [],
    groups = [],
    at = c.location;
  const order = (action: CampaignAction) => {
    c = dispatchCampaign(c, action);
    assert.equal(c.lastError, null, JSON.stringify(action) + c.lastError);
    actions.push(structuredClone(action));
  };
  order({ type: 'squad', ids: field.slice(0, 6) });
  groups.push(c.activeSquadId);
  for (let offset = 6; offset < field.length; offset += 6) {
    order({
      type: 'createSquad',
      ids: field.slice(offset, offset + 6),
      sector: at,
      name: 'Apoyo del regreso',
    });
    groups.push(c.activeSquadId);
  }
  order({ type: 'selectSquad', id: groups[0] });
  const columns = groups.map((id) => ({
    id,
    members: [...present(c.squads.find((q) => q.id === id)).members],
  }));
  assert.deepEqual(
    columns.flatMap((q) => q.members),
    field,
  );
  report({
    event: 'northernReunionColumns',
    field: [...field],
    columns,
    actions,
    campaign: structuredClone(c),
  });
  return { campaign: c, field, groups };
}

// The original cohort, returning ward, permanent recruits and actual free
// Tucuman roof guards stay under service. Other temporary clinic work does not.
export function northernReunionDutyKeepers(start: CampaignSnapshot, originalIds) {
  assert.ok(Array.isArray(originalIds) && originalIds.every(Number.isSafeInteger));
  const now = start.hour * 3600 + (start.secondOfHour ?? 0),
    roofGuards = start.recruited.filter((id) => {
      const body = start.operativeState[id],
        contract = start.contracts[id],
        expiry = contractExpiresSeconds(contract);
      return (
        present(body).alive &&
        !present(body).captured &&
        contract &&
        (expiry === null || expiry > now) &&
        !operativeInTransit(start, id) &&
        operativeLocation(start, id) === 'tucuman' &&
        present(body).residentPosition?.tacticalLevel > 0 &&
        ['active', 'rest'].includes(present(body).assignment) &&
        start.squads.some(
          (group) => group.location === 'tucuman' && !group.journey && group.members.includes(id),
        )
      );
    });
  return [
    ...new Set([
      ...originalIds,
      ...start.squad,
      ...start.recruited.filter((id) => start.contracts[id]?.kind === 'patriot'),
      ...roofGuards,
    ]),
  ].filter(
    (id) =>
      start.recruited.includes(id) &&
      present(start.operativeState[id]).alive &&
      !present(start.operativeState[id]).captured,
  );
}

// Use the actual encounter response after paid cover, not the earlier field
// formation. Other sectors, mixed cover and explicit policies stay ordinary.
export function northernReunionEncounterOptions(campaign: CampaignSnapshot, sector: string|undefined, { encounterController } = {}) {
  const controller = encounterController ?? tucumanCombatOrder;
  if (!saltaHospitalEncounterExecutor({ campaign, encounterController }, sector)) {
    return { controller };
  }
  function fightNorthernReunionHospital(request: CampaignPendingBattle, previous: BattleSnapshot|null|undefined, options: FightOptions|undefined) {
    // Each real execution and replay receives one Native entry, new roles and
    // its own paired order bridge. Settlement must use this returned campaign.
    const bridge = createPairedRouteOrders(campaign),
      hospital = saltaHospitalBattleOptions();
    const result = fightOpeningBattle(request, previous, {
      ...options,
      ...hospital,
      admitBattle: (initial) => hospital.admitBattle(bridge.admitBattle(initial)),
      executeOrder: bridge.executeOrder,
    });
    assert.equal(result.battle, present(bridge.pair).battle);
    assert.deepEqual(result.orders, bridge.orders);
    return { ...result, pair: bridge.pair };
  }
  return { controller, executeBattle: fightNorthernReunionHospital };
}

export function reuniteFreshNorthernSquad(
  start: CampaignSnapshot,
  { report = () => {}, keepServing, mode = 'march' } = {},
) {
  let c = decodeSave(encodeSave(start)).campaign;
  assert.ok(
    ['march', 'posta'].includes(mode),
    'The actual reunion uses an ordinary land travel mode.',
  );
  assert.ok(
    keepServing === undefined ||
      (Array.isArray(keepServing) &&
        new Set(keepServing).size === keepServing.length &&
        keepServing.every(
          (id) =>
            Number.isSafeInteger(id) &&
            c.recruited.includes(id) &&
            present(c.operativeState[id]).alive &&
            !present(c.operativeState[id]).captured,
        )),
    'Necessary keepers must be actual distinct serving survivors.',
  );
  const keepers = keepServing === undefined ? null : new Set(keepServing);
  const lostCordoba = present(c.sectors.cordoba).owner === 'royalist';
  const retainFor = (hours: number) => {
    const until = (c.hour + hours) * 3600 + (c.secondOfHour ?? 0);
    for (const id of c.recruited.filter(
      (id) =>
        present(c.operativeState[id]).alive &&
        !present(c.operativeState[id]).captured &&
        (!keepers || keepers.has(id)),
    )) {
      while (
        contractExpiresSeconds(c.contracts[id]) !== null &&
        present(contractExpiresSeconds(c.contracts[id])) <= until
      ) {
        const contract = c.contracts[id],
          quote = contractRenewalQuote(
            c,
            rosterFor(c).find((op) => op.id === id),
            'day',
          ),
          cash = c.resources.treasury,
          action = {
            type: 'renewContract',
            id,
            term: 'day',
            expectedExpiresAt: present(contract).expiresAt,
            expectedExpiresSecond: present(contract).expiresSecond ?? 0,
          };
        if (!quote.available || quote.price > cash) {
          report({
            event: 'northernReunionFundingRefused',
            id,
            quote: structuredClone(quote),
            campaign: structuredClone(c),
          });
        }
        assert.equal(quote.available, true, quote.reason);
        c = dispatchCampaign(c, action);
        assert.equal(c.lastError, null, c.lastError);
        assert.equal(c.resources.treasury, cash - quote.price);
        assert.equal(
          contractExpiresSeconds(c.contracts[id]),
          present(quote.expiresAt) * 3600 + (quote.expiresSecond ?? 0),
        );
        report({
          event: 'northernReunionRenewal',
          id,
          action,
          quote: structuredClone(quote),
          cost: cash - c.resources.treasury,
          beforeExpiry: contractExpiresSeconds(contract),
          afterExpiry: contractExpiresSeconds(c.contracts[id]),
          hour: c.hour,
          second: c.secondOfHour ?? 0,
        });
      }
    }
  };
  const order = (a) => {
    const elapsed =
      a.type === 'wait'
        ? a.hours
        : a.type === 'travel' && (a.queue !== true || (!keepers && mode === 'march'))
          ? 48
          : 0;
    if (elapsed) {
      retainFor(elapsed);
    }
    const before = c;
    c = dispatchCampaign(c, a);
    assert.equal(c.lastError, null, JSON.stringify(a) + c.lastError);
    report({
      event: 'northernReunionOrder',
      action: structuredClone(a),
      cost: before.resources.treasury - c.resources.treasury,
      elapsedSeconds:
        (c.hour - before.hour) * 3600 + (c.secondOfHour ?? 0) - (before.secondOfHour ?? 0),
      hour: c.hour,
      second: c.secondOfHour ?? 0,
    });
    const expired = before.recruited.filter(
      (id) =>
        present(before.operativeState[id]).alive && !c.recruited.includes(id) && present(c.operativeState[id]).alive,
    );
    if (expired.length) {
      report({
        event: 'northernReunionServiceExpired',
        rows: expired.map((id) => ({
          id,
          contract: structuredClone(before.contracts[id]),
          before: structuredClone(before.operativeState[id]),
          after: structuredClone(c.operativeState[id]),
        })),
        campaign: structuredClone(c),
      });
    }
    if (lostCordoba) {
      assert.equal(
        c.pendingEncounter,
        null,
        'the real recapture preparation must stop for an unrelated encounter',
      );
    }
    while (elapsed && c.pendingEncounter) {
      const returning = c.activeSquadId,
        encounter = c.pendingEncounter;
      const defenders = c.squads.find(
        (q) =>
          q.location === encounter.sector && q.members.some((id) => present(c.operativeState[id]).alive),
      );
      assert.ok(defenders, 'the threatened sector needs its actual garrison');
      order({ type: 'selectSquad', id: defenders.id });
      order({ type: 'respondToEncounter', groupId: encounter.groupId, choice: 'tactical' });
      c = fightNorthernSector(c, encounter.sector, {
        ...northernReunionEncounterOptions(c, encounter.sector),
        report,
      }).campaign;
      order({ type: 'selectSquad', id: returning });
    }
  };
  const formation = prepareNorthernReunionColumns(c, { report });
  c = formation.campaign;
  const { field, groups: southernColumns } = formation,
    primaryField = [...c.squad];
  assert.ok(
    !keepers || field.every((id) => keepers.has(id)),
    'Every actual returning soldier must retain service.',
  );
  report({
    event: 'northernReunionKeepers',
    ids: keepers
      ? [...keepers]
      : c.recruited.filter((id) => present(c.operativeState[id]).alive && !present(c.operativeState[id]).captured),
    campaign: structuredClone(c),
  });
  const reloadColumns = () => {
    const selected = c.activeSquadId;
    for (const id of southernColumns) {
      order({ type: 'selectSquad', id });
      c = finishReloadsBeforeMarch(c, { report });
    }
    order({ type: 'selectSquad', id: selected });
  };
  if (lostCordoba) {
    const occupations = c.enemyGroups
      .filter((group) => group.target === 'cordoba' && group.status === 'stationed')
      .map((group) => group.id);
    assert.ok(occupations.length, 'the return must identify the actual occupying force');
    const guard = c.recruited.filter((id) => {
      const r = c.operativeState[id];
      return (
        present(r).alive &&
        !present(r).captured &&
        !operativeInTransit(c, id) &&
        operativeLocation(c, id) === 'tucuman'
      );
    });
    assert.ok(guard.length, 'the joined recapture needs its actual northern guard');
    for (const operativeId of field) {
      order({ type: 'assignCare', operativeId, assignment: 'rest' });
    }
    for (
      let h = 0;
      h < 30 &&
      field.some(
        (id) =>
          present(c.operativeState[id]).fatigue > 0 ||
          present(c.operativeState[id]).energy < 100 ||
          present(c.operativeState[id]).asleep,
      );
      h++
    ) {
      order({ type: 'wait', hours: 1 });
    }
    for (const operativeId of field) {
      order({ type: 'assignCare', operativeId, assignment: 'active' });
    }
    retainFor(48);
    report({ event: 'northernReturnRested', campaign: structuredClone(c) });
    for (const id of field) {
      if (present(c.operativeState[id]).weaponDropped) {
        c = recoverRoutePrimary(c, id, { report });
      }
    }
    c = supplyRouteAmmunition(c, field, { target: 10, report }).campaign;
    reloadColumns();
    const pool = [
      ...Object.entries(c.artilleryDepots ?? {}).flatMap(([at, guns]) =>
        guns.map((gun) => ({ at, source: 'depot', gun })),
      ),
      ...Object.entries(c.sectorStates).flatMap(([at, scene]) =>
        (scene.artillery ?? []).map((gun) => ({ at, source: 'field', gun })),
      ),
    ].filter((row) => c.sectors[row.at]?.owner === 'patriot' && row.gun.side === 'player');
    const piece = pool
      .filter(
        (row) =>
          (row.gun.loaded || row.gun.ammo > 0) &&
          artilleryProfile(c, row.gun).crew <= primaryField.length,
      )
      .sort(
        (a, b) =>
          Number(b.at === c.location) - Number(a.at === c.location) ||
          Number(b.source === 'depot') - Number(a.source === 'depot') ||
          b.gun.ammo + Number(b.gun.loaded) - a.gun.ammo - Number(a.gun.loaded) ||
          a.gun.id.localeCompare(b.gun.id),
      )[0];
    assert.ok(piece, 'the recapture needs an actual controlled cannon and enough living crew');
    const keepServing = [...new Set([...guard, ...field])];
    const battery = prepareRouteBattery(c, [piece.gun.type], {
      destination: 'san_nicolas',
      excludeIds: pool.filter((row) => row.gun.id !== piece.gun.id).map((row) => row.gun.id),
      keepServing,
      report,
    });
    c = battery.campaign;
    assert.equal(c.location, 'san_nicolas');
    assert.deepEqual(c.squad, primaryField);
    const southern = c.activeSquadId;
    // The support column has its own ordinary journey, sleep and paid terms.
    // An empty battery request moves people without acquiring another gun.
    for (const id of southernColumns.slice(1)) {
      order({ type: 'selectSquad', id });
      c = prepareRouteBattery(c, [], { destination: 'san_nicolas', keepServing, report }).campaign;
      assert.equal(c.location, 'san_nicolas');
      report({
        event: 'northernReunionColumnArrived',
        id,
        members: [...c.squad],
        campaign: structuredClone(c),
      });
    }
    order({ type: 'selectSquad', id: southern });
    for (const operativeId of field) {
      order({ type: 'assignCare', operativeId, assignment: 'rest' });
    }
    for (
      let h = 0;
      h < 48 &&
      field.some(
        (id) =>
          present(c.operativeState[id]).fatigue > 0 ||
          present(c.operativeState[id]).energy < 100 ||
          present(c.operativeState[id]).asleep,
      );
      h++
    ) {
      order({ type: 'wait', hours: 1 });
    }
    for (const operativeId of field) {
      order({ type: 'assignCare', operativeId, assignment: 'active' });
    }
    reloadColumns();
    const northern = [];
    for (let offset = 0; offset < guard.length; offset += 6) {
      // A living local guard may be unassigned after the earlier native defense.
      // Creating its real local squad does not require an existing squad first.
      order({
        type: 'createSquad',
        ids: guard.slice(offset, offset + 6),
        sector: 'tucuman',
        name: 'Guardia del camino',
      });
      northern.push(c.activeSquadId);
      for (const operativeId of c.squad) {
        order({ type: 'assignCare', operativeId, assignment: 'active' });
      }
      c = finishReloadsBeforeMarch(c, { report });
    }
    // A depot choice belongs to its physical origin, even when another squad is
    // currently selected. Both real approaches join the same assault afterward.
    order({ type: 'selectSquad', id: southern });
    order({ type: 'configureArtillery', types: battery.selections });
    retainFor(36);
    const groups = [...southernColumns, ...northern];
    for (const id of groups) {
      order({ type: 'selectSquad', id });
      order({ type: 'attack', sector: 'cordoba', queue: true });
    }
    c = completeQueuedAssault(c, groups, 'cordoba', {
      execute: (request) => {
        order(request);
        return c;
      },
    });
    assert.deepEqual(
      present(c.pendingBattle).squad.map((u) => u.id).sort((a, b) => a - b),
      [...field, ...guard].sort((a, b) => a - b),
    );
    report({ event: 'northernReturnRecaptureReady', campaign: structuredClone(c), occupations });
    c = settleNorthernReturnRecapture(c, report);
    for (const id of occupations) {
      assert.equal(
        present(c.enemyGroups.find((group) => group.id === id)).status,
        'defeated',
        'the actual road occupation must be defeated, not skipped',
      );
    }
    c = stabilizeNorthernRecapture(c, { report });
    const actor = c.squad.includes(4)
      ? 4
      : rosterFor(c)
          .filter(
            (op) =>
              c.squad.includes(op.id) &&
              present(c.operativeState[op.id]).hp >= 15 &&
              !present(c.operativeState[op.id]).asleep,
          )
          .sort((a, b) => b.leadership - a.leadership)[0]?.id;
    assert.ok(actor !== undefined);
    c = meetRecruits(c, ['quiroga', 'paz'], actor);
    report({ event: 'northernRoadMeeting', campaign: structuredClone(c) });
    const recovered = recoverRecapturedRoad(c);
    c = recovered.campaign;
    report({
      event: 'northernRoadRecovered',
      hour: c.hour,
      treasury: c.resources.treasury,
      careEvents: recovered.events,
      campaign: structuredClone(c),
    });
    // Real clinical work can leave its physician asleep. Finish ordinary paid
    // rest before forming the returning columns; no patient is left behind.
    const local = c.recruited.filter(
      (id) =>
        present(c.operativeState[id]).alive &&
        !present(c.operativeState[id]).captured &&
        operativeLocation(c, id) === 'cordoba' &&
        !operativeInTransit(c, id),
    );
    for (const operativeId of local) {
      order({ type: 'assignCare', operativeId, assignment: 'rest' });
    }
    for (
      let h = 0;
      h < 48 &&
      local.some((id) => {
        const r = c.operativeState[id];
        return present(r).asleep || present(r).fatigue > 0 || present(r).energy < 100;
      });
      h++
    ) {
      order({ type: 'wait', hours: 1 });
    }
    assert.ok(
      local.every((id) => {
        const r = c.operativeState[id];
        return !present(r).asleep && present(r).fatigue === 0 && present(r).energy === 100;
      }),
      'The actual clinical survivors must finish rest before returning.',
    );
    for (const operativeId of local) {
      order({ type: 'assignCare', operativeId, assignment: 'active' });
    }
    report({ event: 'northernRoadCareRested', campaign: structuredClone(c) });
    if (!c.routes.posta) {
      order({ type: 'transport', mode: 'posta' });
    }
    c = returnNorthernOfficers(c);
    // Future marching incursions remain real campaign state. This branch only
    // replaces the occupation that already blocked the original return route.
    assert.equal(c.pendingEncounter, null);
    for (const [id, r] of Object.entries(start.operativeState)) {
      if (!r.alive) {
        assert.equal(c.operativeState[id].alive, false);
      }
    }
    assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
    report({ event: 'northernReturnReunited', campaign: structuredClone(c) });
    return c;
  }
  if (mode === 'posta') {
    // Organize the same network already needed by the later northern road. Both
    // real columns depart before advancing time; neither survivor is dropped.
    for (const operativeId of field) {
      order({ type: 'assignCare', operativeId, assignment: 'rest' });
    }
    for (
      let h = 0;
      h < 30 &&
      field.some(
        (id) =>
          present(c.operativeState[id]).fatigue > 0 ||
          present(c.operativeState[id]).energy < 100 ||
          present(c.operativeState[id]).asleep,
      );
      h++
    ) {
      order({ type: 'wait', hours: 1 });
    }
    for (const operativeId of field) {
      order({ type: 'assignCare', operativeId, assignment: 'active' });
    }
    if (!c.routes.posta) {
      order({ type: 'transport', mode: 'posta' });
    }
    for (const id of southernColumns) {
      order({ type: 'selectSquad', id });
      const quote = previewStrategicRoute(c, id, 'cordoba', 'posta');
      assert.equal(quote.valid, true, quote.reason);
      report({
        event: 'northernReunionTravelQuote',
        id,
        quote: structuredClone(quote),
        campaign: structuredClone(c),
      });
      order(quote.action);
    }
    for (
      let h = 0;
      h < 48 &&
      !southernColumns.every((id) => {
        const q = c.squads.find((q) => q.id === id);
        return present(q).location === 'cordoba' && !present(q).journey;
      });
      h++
    ) {
      order({ type: 'wait', hours: 1 });
    }
    assert.ok(
      southernColumns.every((id) => {
        const q = c.squads.find((q) => q.id === id);
        return present(q).location === 'cordoba' && !present(q).journey;
      }),
      'Both paid reunion columns must reach Córdoba through their actual journeys.',
    );
    report({
      event: 'northernReunionColumnsArrived',
      field: [...field],
      campaign: structuredClone(c),
    });
  } else {
    for (const id of southernColumns) {
      order({ type: 'selectSquad', id });
      for (let leg = 0; leg < 6 && c.location !== 'cordoba'; leg++) {
        for (const operativeId of c.squad) {
          order({ type: 'assignCare', operativeId, assignment: 'rest' });
        }
        for (
          let i = 0;
          i < 30 &&
          c.squad.some(
            (id) =>
              present(c.operativeState[id]).fatigue > 0 ||
              present(c.operativeState[id]).energy < 100 ||
              present(c.operativeState[id]).asleep,
          );
          i++
        ) {
          order({ type: 'wait', hours: 1 });
        }
        for (const operativeId of c.squad) {
          order({ type: 'assignCare', operativeId, assignment: 'active' });
        }
        order({ type: 'travel', sector: 'cordoba' });
        assert.equal(c.pendingEncounter, null);
      }
      assert.equal(c.location, 'cordoba');
    }
  }
  order({ type: 'selectSquad', id: southernColumns[0] });
  c = meetRecruits(c, ['quiroga', 'paz']);
  // The actual meeting can add permanent local officers after the original
  // reunion duty was quoted. Retain those real recruits and the current party,
  // while leaving unrelated temporary clinic service outside road duty.
  const roadDuty = keepers ? northernReunionDutyKeepers(c, [...keepers]) : undefined;
  return restoreNorthernRoad(c, { report, ...(roadDuty ? { keepServing: roadDuty } : {}) });
}

export const prepareFreshSaltaAssault = prepareRestoredSalta;

export function prepareFreshNorthernHandover(start: CampaignSnapshot, { report = () => {} } = {}) {
  let c = decodeSave(encodeSave(start)).campaign;
  const order = (a: CampaignAction) => {
    const next = dispatchCampaign(c, a);
    if (next.lastError) {
      report({
        event: 'northernHandoverStopped',
        campaign: structuredClone(c),
        action: a,
        error: next.lastError,
      });
    }
    c = next;
    assert.equal(c.lastError, null, JSON.stringify(a) + c.lastError);
  };
  const waitHour = () => {
    if (c.pendingEncounter) {
      report({ event: 'saltaCounterattack', campaign: structuredClone(c) });
      c = resolveNorthernHandoverEncounter(c, { report });
      report({ event: 'saltaDefended', campaign: structuredClone(c) });
    }
    c = retainNorthernHandoverService(c, { report });
    order({ type: 'wait', hours: 1 });
  };
  // Stabilize the actual local casualties before meetings advance tactical time.
  const urgent = () =>
    c.recruited.filter((id) => {
      const r = c.operativeState[id];
      return present(r).alive && !present(r).captured && present(r).location === 'salta' && (present(r).bleeding || present(r).hp < 15);
    });
  const careDoctors = new Set();
  for (let h = 0; h < 24 && urgent().length; h++) {
    const patients = urgent(),
      doctor = rosterFor(c)
        .filter((op) => {
          const r = c.operativeState[op.id];
          return (
            c.recruited.includes(op.id) &&
            present(r).alive &&
            !present(r).captured &&
            present(r).location === 'salta' &&
            !patients.includes(op.id) &&
            present(r).hp >= 15 &&
            !present(r).bleeding &&
            present(r).energy > 10 &&
            present(r).medkits > 0 &&
            op.medical >= 20
          );
        })
        .sort((a, b) => b.medical - a.medical)[0];
    assert.ok(doctor, 'local urgent care needs an actual supplied doctor');
    careDoctors.add(doctor.id);
    order({ type: 'assignCare', operativeId: doctor.id, assignment: 'doctor' });
    for (const operativeId of patients) {
      order({ type: 'assignCare', operativeId, assignment: 'patient' });
    }
    waitHour();
  }
  assert.deepEqual(urgent(), [], 'the handover must not abandon critical casualties');
  for (const operativeId of careDoctors) {
    order({ type: 'assignCare', operativeId, assignment: 'active' });
  }
  const before = structuredClone(c.resources);
  order({ type: 'diplomacy', kind: 'northPact' });
  assert.equal(c.resources.treasury, before.treasury - 300);
  assert.deepEqual(Object.keys(c.resources), ['treasury']);
  // Keep the strongest eligible envoy and bring serving local northern
  // officers with him. Other survivors retain their actual Salta records.
  const envoy = rosterFor(c)
    .filter((op) => {
      const r = c.operativeState[op.id];
      return (
        c.recruited.includes(op.id) &&
        present(r).alive &&
        !present(r).captured &&
        present(r).hp >= 15 &&
        present(r).location === 'salta'
      );
    })
    .sort((a, b) => b.leadership - a.leadership || a.id - b.id)[0];
  assert.ok(envoy, 'a living local envoy must continue the northern mission');
  const envoySquad = c.squads.find((q) => q.members.includes(envoy.id));
  assert.ok(envoySquad);
  const party = [
    ...new Set([
      envoy.id,
      ...[1, 0, 8].filter((id) => {
        const r = c.operativeState[id];
        return (
          c.recruited.includes(id) &&
          present(r).alive &&
          !present(r).captured &&
          !operativeInTransit(c, id) &&
          operativeLocation(c, id) === 'salta'
        );
      }),
    ]),
  ];
  assert.ok(party.length <= 6, 'The actual envoy party must fit the ordinary squad limit.');
  order({ type: 'selectSquad', id: envoySquad.id });
  const partyAction = { type: 'squad', ids: party };
  order(partyAction);
  report({
    event: 'northernHandoverParty',
    action: partyAction,
    envoy: envoy.id,
    campaign: structuredClone(c),
  });
  c = meetRecruits(c, ['guemes', 'macacha'], envoy.id);
  for (const operativeId of c.squad) {
    order({ type: 'assignCare', operativeId, assignment: 'rest' });
  }
  for (
    let i = 0;
    i < 30 &&
    c.squad.some(
      (id) =>
        present(c.operativeState[id]).fatigue > 0 ||
        present(c.operativeState[id]).energy < 100 ||
        present(c.operativeState[id]).asleep,
    );
    i++
  ) {
    waitHour();
  }
  for (const operativeId of c.squad) {
    order({ type: 'assignCare', operativeId, assignment: 'active' });
  }
  order({ type: 'travel', sector: 'tucuman' });
  report({
    event: 'northernHandoverTravel',
    campaign: structuredClone(c),
    envoy: envoy.id,
    envoySquad: envoySquad.id,
  });
  c = continueNorthernHandoverTravel(c, { squadId: envoySquad.id, report });
  return { campaign: c, envoy: envoy.id };
}

export function finishFreshNorthernCampaign(start, { report = () => {} } = {}) {
  const handover = prepareFreshNorthernHandover(start, { report });
  let c = handover.campaign;
  const envoy = { id: handover.envoy },
    order = (a: CampaignAction) => {
      c = dispatchCampaign(c, a);
      assert.equal(c.lastError, null, JSON.stringify(a) + c.lastError);
    };
  order({ type: 'visitMission', mission: 'yatasto' });
  let b = enterSector(c.pendingBattle, c.sceneStates.yatasto);
  for (const npcId of ['yatasto-belgrano', 'yatasto-san-martin', 'yatasto-san-martin']) {
    b = approachNPC(b, String(envoy.id), npcId);
    const pair = syncBattleTime(c, b);
    assert.equal(pair.error, null);
    c = pair.campaign;
    b = pair.battle;
    order({ type: 'talkNPC', npcId, unitId: envoy.id, approach: 'mission', sectorState: b });
    const saved = decodeSave(encodeSave(c, b));
    c = saved.campaign;
    b = saved.battle;
  }
  order({
    type: 'finishMission',
    battleId: present(c.pendingBattle).id,
    sectorState: b,
    survivors: b.units.filter((u) => u.side === 'player'),
  });
  assert.equal(c.phase, 3);
  assert.equal(present(c.missions.yatasto).completed, true);
  assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
  return c;
}
