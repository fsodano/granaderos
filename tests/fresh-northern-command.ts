import { present } from './assert-present.ts';
import type { CampaignAction, CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import { encounterDefinitions } from '../packages/game/encounters.js';
import { routeHiringCeiling } from './funded-route-fixture.ts';
import assert from 'node:assert/strict';
import { stabilizeCreatedCuyoSurvivors } from './created-cuyo-route.ts';
import { dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import { contractQuote, contractExpiresSeconds } from '../packages/game/contracts.js';
import { actBattle, getReachable, hasLineOfSight } from '../packages/game/tactical.js';
import '../packages/game/tactical-space.js';
import { atHand } from '../packages/game/tactical-planning-space.ts';
import { firstAidPlan } from '../packages/game/first-aid.js';
import { isUnconscious } from '../packages/game/actor-condition.js';
import { visit, sync, leave } from './local-contract-fixture.ts';
import { meetRecruits } from './campaign-recruitment-route.ts';
import { equipOpeningRifles } from './opening-equipment.ts';
import { finishReloadsBeforeMarch } from './pre-march-reload.ts';
import { supplyRouteAmmunition } from './route-ammunition.ts';
import { sectorInventoryModel } from '../packages/game/sector-inventory.js';
import { prepareFinalAssault } from './final-campaign-route.ts';
import { autoBandageBattle } from '../packages/game/auto-bandage.js';
import { decodeSave, encodeSave } from '../packages/game/save.ts';
import { attendYatasto } from './mission-helpers.ts';
import {
  collectRouteItems,
  collectRouteMedicalSupplies,
  discoverRouteCache,
} from './finite-route-equipment.ts';
import { supplyRouteDressings } from './route-dressings.ts';
import { prepareRouteBattery } from './route-battery.ts';
import { completeTestTravel } from './campaign-test-helpers.ts';
import { operativeLocation, operativeInTransit } from '../packages/game/squads.js';
import { doctorRate } from '../packages/game/medical-care.js';
import { worldCell } from '../packages/game/world-cells.ts';
import { previewStrategicRoute } from '../packages/game/strategic-route.js';
import { recoverVisibleRouteDressings } from './route-visible-medical-remains.ts';
import { recordRouteStrategicEvidence } from './route-strategic-failure-evidence.ts';
import { resolveStockNorthernReliefEncounter } from './northern-relief-defense.ts';
import { northernEmergencyAid } from './northern-emergency-aid.ts';
import { aidNorthernMissionRelief } from './northern-mission-aid.ts';
import { resolveNorthernHandoverEncounter } from './northern-handover-route.ts';
import { stageRouteRoofDefenders } from './route-roof-defenders.ts';
import {
  northernReliefFitLocal,
  northernReliefReplacements,
  retainNorthernReliefSupport,
  hireNorthernReliefReplacement,
} from './northern-relief-service.ts';
import {
  stockNorthernRearReserve,
  assertStockNorthernRear,
  attachStockNorthernSupport,
  bookStockNorthernReliefHires,
  assertStockNorthernHiresArrived,
  stockNorthernReliefRestPlan,
} from './stock-northern-relief-staffing.ts';

// Reinforce and position the real survivors before the arriving counterattack.
export function prepareHiredNorthernDefense(start, { report = () => {} } = {}) {
  let c = structuredClone(start);
  const order = (a: CampaignAction) => {
    if (a.type === 'wait') {
      for (const id of c.recruited.filter((id: string|number) => c.operativeState[id].alive)) {
        const q = c.contracts[id];
        if (q?.expiresAt != null && q.expiresAt <= c.hour + a.hours) {
          const n = dispatchCampaign(c, {
            type: 'renewContract',
            id,
            term: 'day',
            expectedExpiresAt: q.expiresAt,
          });
          assert.equal(n.lastError, null);
          c = n;
        }
      }
    }
    const n = dispatchCampaign(c, a);
    assert.equal(n.lastError, null, JSON.stringify(a) + n.lastError);
    c = n;
  };
  const defendNow = () => {
    assert.equal(c.pendingEncounter?.sector, 'cordoba');
    order({ type: 'respondToEncounter', groupId: c.pendingEncounter.groupId, choice: 'tactical' });
    return c;
  };
  if (c.pendingEncounter) {
    return defendNow();
  }

  // Keep the actual hired force; local officers are not unlocked yet.

  const candidates = rosterFor(c)
    .filter(
      (o) =>
        o.id >= 100 &&
        o.id < 1000 &&
        !c.recruited.includes(o.id) &&
        c.operativeState[o.id].alive &&
        !c.operativeState[o.id].captured &&
        contractQuote(c, o, 'week').price <= routeHiringCeiling(c, 200),
    )
    .sort((a, b) => b.marksmanship - a.marksmanship)
    .slice(0, 6)
    .map((o) => o.id);
  for (const id of candidates) {
    order({ type: 'recruitCivic', id, term: 'week', destination: 'cordoba' });
  }
  const until = c.hour + 6;
  for (let h = 0; c.hour < until && !c.pendingEncounter && h < 20; h++) {
    order({ type: 'wait', hours: 1 });
  }
  // An actual arrival ends preparation. Fight with whoever reached the province;
  // outstanding paid hires cannot be granted their remaining travel time early.
  if (c.pendingEncounter) {
    return defendNow();
  }
  const field = rosterFor(c)
      .filter(
        (o) =>
          c.recruited.includes(o.id) &&
          c.operativeState[o.id].alive &&
          !c.operativeState[o.id].captured &&
          c.operativeState[o.id].location === 'cordoba',
      )
      .sort((a, b) => b.marksmanship - a.marksmanship)
      .map((o) => o.id),
    groups = [];
  for (let i = 0; i < field.length; i += 6) {
    order({
      type: 'createSquad',
      ids: field.slice(i, i + 6),
      name: 'Defensa de Córdoba',
      sector: 'cordoba',
    });
    groups.push(c.activeSquadId);
    for (const operativeId of c.squad) {
      order({ type: 'assignCare', operativeId, assignment: 'active' });
    }
    const p = visit(c);
    c = leave(sync({ campaign: p.campaign, battle: equipOpeningRifles(p.battle, c.squad).battle }));
    c = supplyRouteAmmunition(c, c.squad, { target: 12 }).campaign;
    c = finishReloadsBeforeMarch(c);
  }
  order({ type: 'selectSquad', id: groups[0] });
  // Every existing local group receives a paid post before the same raid wait.
  // The shared helper reserves earlier posts and restores this selected group.
  c = stageRouteRoofDefenders(c, field, { report });
  order({ type: 'fortify', sector: 'cordoba' });
  for (const operativeId of field) {
    order({ type: 'assignCare', operativeId, assignment: 'rest' });
  }
  for (let h = 0; !c.pendingEncounter && h < 144; h++) {
    order({ type: 'wait', hours: 1 });
  }
  assert.equal(c.pendingEncounter?.sector, 'cordoba');
  order({ type: 'respondToEncounter', groupId: c.pendingEncounter.groupId, choice: 'tactical' });
  return c;
}

// The rear clinic and envoy use existing stock, real paid arrivals and one
// conquered gun. Care continues while the officers and cannon travel.
function prepareCreatedNorthernOfficerRelief(
  start: CampaignSnapshot,
  { report = () => {}, onCheckpoint = () => {} } = {},
) {
  const inputCapture = recordRouteStrategicEvidence({
    helper: 'prepareCreatedNorthernOfficerRelief',
    stage: 'preparation-input',
    campaign: start,
  });
  const before = structuredClone(start);
  let c = decodeSave(encodeSave(start)).campaign;
  onCheckpoint('northern-officer-relief-input', c);
  const live = () =>
    c.recruited.filter((id) => present(c.operativeState[id]).alive && !present(c.operativeState[id]).captured);
  const at = (id: number) => present(c.operativeState[id]).location;
  const doctors = new Map(),
    patients = live().filter(
      (id) => present(c.operativeState[id]).hp < present(c.operativeState[id]).maxHp || present(c.operativeState[id]).bleeding,
    );
  const order = (a: CampaignAction) => {
    if (a.type === 'assignCare' && c.operativeState[a.operativeId].assignment === a.assignment) {
      return;
    }
    if (a.type === 'wait') {
      for (const id of live()) {
        const q = c.contracts[id];
        if (
          contractExpiresSeconds(q) !== null &&
          present(contractExpiresSeconds(q)) <= c.hour * 3600 + (c.secondOfHour ?? 0) + present(a.hours) * 3600
        ) {
          const quote = contractQuote(
              c,
              rosterFor(c).find((op) => op.id === id),
              'day',
            ),
            cash = c.resources.treasury;
          const n = dispatchCampaign(c, {
            type: 'renewContract',
            id,
            term: 'day',
            expectedExpiresAt: present(q).expiresAt,
            expectedExpiresSecond: present(q).expiresSecond ?? 0,
          });
          assert.equal(n.lastError, null);
          assert.equal(n.resources.treasury, cash - quote.price);
          c = n;
        }
      }
    }
    const n = dispatchCampaign(c, a);
    assert.equal(n.lastError, null, JSON.stringify(a) + n.lastError);
    c = n;
  };
  const localPatients = (sector: string|undefined) =>
    patients.filter(
      (id) =>
        at(id) === sector &&
        (present(c.operativeState[id]).hp < present(c.operativeState[id]).maxHp || present(c.operativeState[id]).bleeding),
    );
  const takeKnown = (id: number, wanted: number) => {
    for (let taken = 0; taken < wanted;) {
      const row = sectorInventoryModel(c, at(id), rosterFor(c), id).entries.find(
        (row) => row.reachable && JSON.parse(row.expected).item === 'medkits',
      );
      if (!row) {
        break;
      }
      const count = Math.min(row.count, wanted - taken),
        before = present(c.operativeState[id]).medkits;
      order({
        type: 'sectorInventory',
        sector: at(id),
        operativeId: id,
        direction: 'take',
        sourceKey: row.key,
        expected: row.expected,
        count,
      });
      assert.equal(present(c.operativeState[id]).medkits, before + count);
      taken += count;
      report({
        event: 'provincialClinicRecovery',
        id,
        sector: at(id),
        source: row.key,
        count,
        hour: c.hour,
        second: c.secondOfHour ?? 0,
      });
    }
  };
  const maintainClinics = () => {
    for (const [sector, id] of doctors) {
      const wounded = localPatients(sector);
      if (!wounded.length) {
        order({ type: 'assignCare', operativeId: id, assignment: 'rest' });
        for (const patient of patients.filter((other) => at(other) === sector)) {
          order({ type: 'assignCare', operativeId: patient, assignment: 'rest' });
        }
        continue;
      }
      if (!present(c.operativeState[id]).medkits) {
        takeKnown(id, 1);
      }
      const supplied = present(c.operativeState[id]).medkits > 0;
      order({ type: 'assignCare', operativeId: id, assignment: supplied ? 'doctor' : 'rest' });
      for (const patient of wounded.filter((patient) => patient !== id)) {
        order({
          type: 'assignCare',
          operativeId: patient,
          assignment:
            supplied || present(c.operativeState[patient]).bleeding || present(c.operativeState[patient]).hp < 15
              ? 'patient'
              : 'rest',
        });
      }
    }
  };
  // Stabilize these actual local casualties before the rear doctor's paid
  // arrival or a long equipment walk. Each stroke spends recovered linen.
  for (const sector of new Set(patients.map(at))) {
    for (let attempt = 0; attempt < patients.length; attempt++) {
      const urgent = localPatients(sector).filter(
        (id) => present(c.operativeState[id]).bleeding || present(c.operativeState[id]).hp < 15,
      );
      if (!urgent.length) {
        break;
      }
      // A conscious wounded soldier can dress his own injury before a long
      // doctor approach. Obtain one actual reachable dressing for that work.
      for (const id of urgent) {
        if (
          present(c.operativeState[id]).hp >= 15 &&
          present(rosterFor(c).find((op) => op.id === id)).medical > 0 &&
          !present(c.operativeState[id]).medkits
        ) {
          takeKnown(id, 1);
        }
      }
      const medic = rosterFor(c)
        .filter(
          (op) =>
            live().includes(op.id) &&
            at(op.id) === sector &&
            op.medical > 0 &&
            present(c.operativeState[op.id]).hp >= 15 &&
            !present(c.operativeState[op.id]).asleep &&
            present(c.operativeState[op.id]).energy > 10,
        )
        .sort(
          (a, b) =>
            Number(Boolean(present(c.operativeState[a.id]).bleeding)) -
              Number(Boolean(present(c.operativeState[b.id]).bleeding)) ||
            b.medical - a.medical ||
            a.id - b.id,
        )[0];
      assert.ok(medic, 'an actual conscious local medic must stabilize the urgent casualty');
      const ids = [...new Set([medic.id, ...urgent])].slice(0, 6),
        need = ids
          .filter((id) => urgent.includes(id))
          .reduce(
            (sum, id) =>
              sum +
              Number(present(c.operativeState[id]).bleeding > 0) +
              Math.ceil(Math.max(0, 15 - present(c.operativeState[id]).hp) / 7),
            0,
          );
      if (present(c.operativeState[medic.id]).medkits < need) {
        takeKnown(medic.id, need - present(c.operativeState[medic.id]).medkits);
      }
      order({ type: 'createSquad', ids, name: 'Socorro provincial urgente', sector });
      for (const operativeId of ids) {
        order({ type: 'assignCare', operativeId, assignment: 'active' });
      }
      onCheckpoint(`northern-officer-emergency-input-${sector}`, c);
      const emergencyInputCapture = recordRouteStrategicEvidence({
        helper: 'prepareCreatedNorthernOfficerRelief',
        stage: 'route-checkpoint',
        campaign: c,
        inputCapture,
        context: {
          phase: 'before-existing-emergency-visit',
          sector,
          physicianId: medic.id,
          urgent,
          ids,
          need,
          scope:
            'Actual preparation state before the one existing visit and its finite aid; no additional entry, orders, queries or synchronization.',
        },
      });
      const initial = visit(c),
        aid = northernEmergencyAid(initial.battle, { physicianId: medic.id, urgentIds: urgent });
      let paid = initial;
      for (let step = 0; step < aid.steps.length; step++) {
        const battle = actBattle(paid.battle, aid.steps[step]);
        assert.equal(battle.lastError, null);
        paid = sync({ campaign: paid.campaign, battle });
        if (step === Math.floor(aid.steps.length / 2)) {
          paid = decodeSave(encodeSave(paid.campaign, paid.battle));
        }
      }
      assert.deepEqual(
        paid.battle,
        sync({ campaign: initial.campaign, battle: aid.battle }).battle,
      );
      c = leave(paid);
      if (
        ids
          .filter((id) => urgent.includes(id))
          .some(
            (id) =>
              !present(c.operativeState[id]).alive ||
              present(c.operativeState[id]).hp < 15 ||
              present(c.operativeState[id]).bleeding !== 0,
          )
      ) {
        recordRouteStrategicEvidence({
          helper: 'prepareCreatedNorthernOfficerRelief',
          stage: 'preparation-failure',
          campaign: c,
          inputCapture: emergencyInputCapture ?? inputCapture,
          context: {
            phase: 'after-existing-emergency-aid-and-leave-before-strict-health-check',
            preparationInputCapture: inputCapture,
            sector,
            physicianId: medic.id,
            urgent,
            ids,
            need,
            aid: {
              steps: aid.steps,
              treatedIds: aid.treatedIds,
              untreated: aid.untreated,
              stoppedReason: aid.stoppedReason,
              elapsedSeconds: aid.elapsedSeconds,
            },
            initialBattle: initial.battle,
            returnedBattle: paid.battle,
            scope:
              'Actual existing visit input battle, paid replay return and settled campaign before the unchanged urgent-survivor assertions; no additional Native orders, queries, synchronization or outcome changes.',
          },
          error:
            'Actual emergency aid left an urgent survivor dead, critical or bleeding before the strict existing check.',
        });
      }
      for (const id of ids.filter((id) => urgent.includes(id))) {
        assert.ok(present(c.operativeState[id]).alive && present(c.operativeState[id]).hp >= 15);
        assert.equal(present(c.operativeState[id]).bleeding, 0);
      }
      report({
        event: 'provincialEmergencyAid',
        sector,
        doctor: medic.id,
        steps: aid.steps,
        elapsedSeconds: aid.elapsedSeconds,
        officialMidpoint: true,
        patients: ids
          .filter((id) => urgent.includes(id))
          .map((id) => ({
            id,
            hp: present(c.operativeState[id]).hp,
            bleeding: present(c.operativeState[id]).bleeding,
          })),
      });
      onCheckpoint(`northern-officer-emergency-${sector}`, c);
    }
  }
  for (const id of live()) {
    order({
      type: 'assignCare',
      operativeId: id,
      assignment: patients.includes(id) ? 'patient' : 'rest',
    });
  }
  const booked = [];
  for (const sector of new Set(patients.map(at))) {
    const local = rosterFor(c)
      .filter(
        (op) =>
          live().includes(op.id) &&
          at(op.id) === sector &&
          op.medical >= 70 &&
          !patients.includes(op.id) &&
          present(c.operativeState[op.id]).hp === present(c.operativeState[op.id]).maxHp &&
          !present(c.operativeState[op.id]).bleeding &&
          !present(c.operativeState[op.id]).asleep &&
          present(c.operativeState[op.id]).energy > 10,
      )
      .sort(
        (a, b) =>
          Number(present(c.operativeState[b.id]).medkits > 0) - Number(present(c.operativeState[a.id]).medkits > 0) ||
          b.medical - a.medical ||
          a.id - b.id,
      )[0];
    if (local) {
      doctors.set(sector, local.id);
      takeKnown(local.id, 8);
      continue;
    }
    const recruit = rosterFor(c)
      .filter(
        (op) =>
          op.id >= 100 &&
          op.id < 1000 &&
          !c.recruited.includes(op.id) &&
          !c.hiringArrivals.some((row) => row.operativeId === op.id) &&
          present(c.operativeState[op.id]).alive &&
          !present(c.operativeState[op.id]).captured &&
          op.medical >= 70 &&
          contractQuote(c, op, 'week').available &&
          contractQuote(c, op, 'week').price <= routeHiringCeiling(c, 200),
      )
      .sort(
        (a, b) =>
          Number(b.id === 139) - Number(a.id === 139) || b.medical - a.medical || a.id - b.id,
      )[0];
    assert.ok(recruit, 'a real available paid doctor must reach the rear casualty');
    const quote = contractQuote(c, recruit, 'week'),
      cash = c.resources.treasury;
    order({ type: 'recruitCivic', id: recruit.id, term: 'week', destination: sector });
    assert.equal(c.resources.treasury, cash - quote.price);
    const arrival = c.hiringArrivals.find((row) => row.operativeId === recruit.id);
    assert.ok(arrival);
    assert.ok(!c.recruited.includes(recruit.id));
    booked.push({ id: recruit.id, sector, arrival: structuredClone(arrival), quote });
    report({
      event: 'provincialClinicBooked',
      id: recruit.id,
      sector,
      quote,
      arrival: structuredClone(arrival),
    });
  }
  maintainClinics();
  for (let hour = 0; booked.some((row) => !c.recruited.includes(row.id)) && hour < 24; hour++) {
    assert.equal(c.pendingEncounter, null);
    order({ type: 'wait', hours: 1 });
    maintainClinics();
    for (const row of booked) {
      if (c.recruited.includes(row.id) && !doctors.has(row.sector)) {
        assert.equal(at(row.id), row.sector);
        assert.equal(present(c.contracts[row.id]).started, row.arrival.dueAt);
        doctors.set(row.sector, row.id);
        maintainClinics();
      }
    }
    for (const id of patients) {
      assert.ok(
        present(c.operativeState[id]).alive,
        'the actual wounded veteran must survive the paid doctor arrival',
      );
    }
  }
  assert.ok(
    booked.every((row) => c.recruited.includes(row.id)),
    'each paid doctor must actually arrive',
  );
  // Local strategic bandaging must stop bleeding before a long tactical walk.
  // The native aid then restores only the critical health that first aid allows.
  for (let hour = 0; patients.some((id) => present(c.operativeState[id]).bleeding) && hour < 12; hour++) {
    assert.equal(c.pendingEncounter, null);
    maintainClinics();
    order({ type: 'wait', hours: 1 });
    for (const id of patients) {
      assert.ok(present(c.operativeState[id]).alive);
    }
  }
  for (const id of patients) {
    assert.equal(present(c.operativeState[id]).bleeding, 0);
  }
  for (const sector of new Set(patients.filter((id) => present(c.operativeState[id]).hp < 15).map(at))) {
    const doctor = doctors.get(sector),
      critical = patients.filter((id) => at(id) === sector && present(c.operativeState[id]).hp < 15);
    assert.ok(doctor);
    const needed = critical.reduce(
      (sum, id) => sum + Math.ceil((15 - present(c.operativeState[id]).hp) / 7),
      0,
    );
    if (present(c.operativeState[doctor]).medkits < needed) {
      takeKnown(doctor, needed - present(c.operativeState[doctor]).medkits);
    }
    order({
      type: 'createSquad',
      ids: [doctor, ...critical].slice(0, 6),
      name: 'Socorro provincial',
      sector,
    });
    for (const operativeId of c.squad) {
      order({ type: 'assignCare', operativeId, assignment: 'active' });
    }
    const pair = visit(c),
      aid = autoBandageBattle(pair.battle);
    c = leave(sync({ campaign: pair.campaign, battle: aid.battle }));
    for (const id of critical) {
      assert.ok(present(c.operativeState[id]).alive && present(c.operativeState[id]).hp >= 15);
      assert.equal(present(c.operativeState[id]).bleeding, 0);
    }
    report({
      event: 'provincialCriticalAid',
      sector,
      doctor,
      steps: aid.steps,
      elapsedSeconds: aid.elapsedSeconds,
      patients: critical.map((id) => ({ id, hp: present(c.operativeState[id]).hp })),
    });
  }
  // Recover what these actual wounds need. A partial local collection keeps
  // its exact debit; natural patient/rest recovery completes any stable shortfall.
  for (const [sector, id] of doctors) {
    const need = localPatients(sector).reduce(
      (sum, patient) =>
        sum +
        Math.ceil(
          (present(c.operativeState[patient]).maxHp - present(c.operativeState[patient]).hp) /
            doctorRate(rosterFor(c).find((op) => op.id === id)),
        ),
      0,
    );
    if (need > present(c.operativeState[id]).medkits) {
      c = collectRouteItems(
        c,
        id,
        { item: 'medkits' },
        need - present(c.operativeState[id]).medkits,
      ).campaign;
    }
  }
  maintainClinics();
  const courier = rosterFor(c)
    .filter(
      (op) =>
        live().includes(op.id) &&
        op.leadership >= 60 &&
        at(op.id) === 'tucuman' &&
        present(c.operativeState[op.id]).hp === present(c.operativeState[op.id]).maxHp &&
        !present(c.operativeState[op.id]).bleeding &&
        ![...doctors.values()].includes(op.id),
    )
    .sort(
      (a, b) =>
        Number(b.id === 114) - Number(a.id === 114) ||
        present(c.operativeState[b.id]).energy - present(c.operativeState[a.id]).energy ||
        b.leadership - a.leadership,
    )[0]?.id;
  assert.ok(
    courier,
    'the envoy must be an actual fit local leader, preserving every fallen soldier',
  );
  // Healthy off-duty survivors already rest while the clinics keep working.
  // Use the same envoy window for their actual morale, not just his energy.
  // Planned officers and current offers inform waiting only; the later real
  // recruitment, two-physician and eight-person guards remain authoritative.
  const supportRestPlan = () => {
    assert.equal(c.pendingEncounter, null);
    assert.equal(c.pendingBattle, null);
    const now = c.hour * 3600 + (c.secondOfHour ?? 0),
      officerIds = [9, 11, 1],
      priceCeiling = routeHiringCeiling(c, 200);
    const plannedOfficers = officerIds.filter(
      (id) => c.operativeState[id]?.alive && !c.operativeState[id].captured,
    );
    const quotedCandidates = rosterFor(c)
      .filter(
        (op) =>
          op.id >= 100 &&
          op.id < 1000 &&
          !c.recruited.includes(op.id) &&
          !c.hiringArrivals.some((row) => row.operativeId === op.id) &&
          present(c.operativeState[op.id]).alive &&
          !present(c.operativeState[op.id]).captured,
      )
      .map((op) => ({ id: op.id, quote: contractQuote(c, op, 'week') }))
      .filter((row) => row.quote.available && row.quote.price <= priceCeiling)
      .map((row) => row.id);
    const fitPaid = live().filter((id) => {
      const r = c.operativeState[id],
        contract = c.contracts[id],
        expiry = contractExpiresSeconds(contract);
      return (
        !officerIds.includes(id) &&
        contract?.kind === 'paid' &&
        (expiry === null || expiry > now) &&
        operativeLocation(c, id) === 'tucuman' &&
        !operativeInTransit(c, id) &&
        !present(r).captive &&
        !present(r).bound &&
        !present(r).detained &&
        !present(r).surrendered &&
        !present(r).departure &&
        !present(r).routed &&
        !present(r).unconscious &&
        present(r).hp === present(r).maxHp &&
        !present(r).bleeding &&
        present(r).morale >= 30
      );
    });
    const target = Math.max(0, 8 - plannedOfficers.length - quotedCandidates.length);
    return {
      target,
      fitPaid,
      plannedOfficers,
      quotedCandidates,
      priceCeiling,
      needsRest: fitPaid.length < target,
    };
  };
  const supportRestStartSeconds = c.hour * 3600 + (c.secondOfHour ?? 0);
  for (
    let hour = 0;
    hour < 72 &&
    (present(c.operativeState[courier]).fatigue ||
      present(c.operativeState[courier]).energy < 100 ||
      present(c.operativeState[courier]).asleep ||
      supportRestPlan().needsRest);
    hour++
  ) {
    assert.equal(c.pendingEncounter, null);
    order({ type: 'wait', hours: 1 });
    assert.equal(c.pendingEncounter, null);
    maintainClinics();
  }
  report({
    event: 'northernSharedRestWindow',
    startSeconds: supportRestStartSeconds,
    endSeconds: c.hour * 3600 + (c.secondOfHour ?? 0),
    requestLimit: 72,
    ...supportRestPlan(),
  });
  assert.equal(present(c.operativeState[courier]).asleep, false);
  assert.equal(present(c.operativeState[courier]).energy, 100);
  const travel = (sector: string) => {
    const squad = c.activeSquadId;
    order({ type: 'travel', sector, queue: true, mode: 'posta' });
    for (let hour = 0; hour < 48 && present(c.squads.find((row) => row.id === squad)).journey; hour++) {
      assert.equal(c.pendingEncounter, null);
      order({ type: 'wait', hours: 1 });
      maintainClinics();
    }
    assert.equal(c.location, sector);
    assert.equal(present(c.squads.find((row) => row.id === squad)).journey, undefined);
  };
  order({ type: 'transport', mode: 'posta' });
  order({ type: 'createSquad', ids: [courier], name: 'Enlace provincial', sector: 'tucuman' });
  order({ type: 'assignCare', operativeId: courier, assignment: 'active' });
  travel('cordoba');
  c = meetRecruits(c, ['quiroga', 'paz'], courier);
  order({
    type: 'createSquad',
    ids: [9, 11, courier],
    name: 'Batería provincial',
    sector: 'cordoba',
  });
  for (const operativeId of c.squad) {
    order({ type: 'assignCare', operativeId, assignment: 'active' });
  }
  // Finish this doctor's actual local care before departure. The same battery
  // column can carry finite rear linen to the remaining northern patients.
  for (let hour = 0; hour < 48 && localPatients('cordoba').length; hour++) {
    assert.equal(c.pendingEncounter, null);
    maintainClinics();
    order({ type: 'wait', hours: 1 });
  }
  maintainClinics();
  assert.deepEqual(
    localPatients('cordoba'),
    [],
    'the rear doctor must finish actual local care before departure',
  );
  const rearDoctors = [...doctors.values()].filter((id) => at(id) === 'cordoba');
  for (const id of rearDoctors) {
    for (
      let hour = 0;
      hour < 48 &&
      (present(c.operativeState[id]).energy < 100 ||
        present(c.operativeState[id]).fatigue ||
        present(c.operativeState[id]).asleep);
      hour++
    ) {
      assert.equal(c.pendingEncounter, null);
      order({ type: 'wait', hours: 1 });
    }
    order({ type: 'assignToSquad', operativeId: id, squadId: c.activeSquadId });
    order({ type: 'assignCare', operativeId: id, assignment: 'active' });
  }
  const northernDoctor = doctors.get('tucuman');
  assert.ok(northernDoctor);
  const northernNeed = () =>
    localPatients('tucuman').reduce(
      (sum, id) =>
        sum +
        Math.ceil(
          (present(c.operativeState[id]).maxHp - present(c.operativeState[id]).hp) /
            doctorRate(
              rosterFor(c).find((op) => op.id === northernDoctor),
              c,
            ),
        ),
      0,
    );
  const knownNorthern = sectorInventoryModel(c, 'tucuman', rosterFor(c), northernDoctor)
    .entries.filter((row) => row.reachable && JSON.parse(row.expected).item === 'medkits')
    .reduce((sum, row) => sum + row.count, 0);
  const delivery = Math.max(
    0,
    northernNeed() - present(c.operativeState[northernDoctor]).medkits - knownNorthern,
  );
  if (delivery) {
    c = supplyRouteDressings(c, courier, delivery, { report });
  }
  report({
    event: 'provincialDressingDeliveryPacked',
    courier,
    doctor: northernDoctor,
    requested: delivery,
    carried: present(c.operativeState[courier]).medkits,
    hour: c.hour,
    second: c.secondOfHour ?? 0,
  });
  onCheckpoint('northern-officer-battery-input', c);
  const prepared = prepareRouteBattery(c, ['bronze4'], {
    destination: 'tucuman',
    keepServing: live(),
    report,
  });
  c = retreatNorthernRear(prepared.campaign, { report });
  order({ type: 'configureArtillery', types: prepared.selections });
  onCheckpoint('northern-officer-battery-ready', c);
  const clinicTarget = Math.min(
    northernNeed(),
    present(c.operativeState[northernDoctor]).medkits + present(c.operativeState[courier]).medkits,
  );
  if (clinicTarget > present(c.operativeState[northernDoctor]).medkits) {
    c = supplyRouteDressings(c, northernDoctor, clinicTarget, { report });
  }
  for (
    let hour = 0;
    hour < 48 && patients.some((id) => present(c.operativeState[id]).hp < present(c.operativeState[id]).maxHp);
    hour++
  ) {
    assert.equal(c.pendingEncounter, null);
    maintainClinics();
    order({ type: 'wait', hours: 1 });
  }
  maintainClinics();
  for (const id of patients) {
    assert.equal(
      present(c.operativeState[id]).hp,
      present(c.operativeState[id]).maxHp,
      'finite provincial care and real rest must restore the actual injured support',
    );
    assert.equal(present(c.operativeState[id]).bleeding, 0);
  }
  onCheckpoint('northern-officer-care-complete', c);
  for (const operativeId of c.squad) {
    order({ type: 'assignCare', operativeId, assignment: 'active' });
  }
  order({ type: 'diplomacy', kind: 'partisanSupply' });
  c = meetRecruits(c, ['azurduy'], courier);
  const physicians = [
    1,
    ...rosterFor(c)
      .filter(
        (op) =>
          op.id !== 1 &&
          live().includes(op.id) &&
          op.medical >= 20 &&
          at(op.id) === 'tucuman' &&
          present(c.operativeState[op.id]).morale >= 30 &&
          present(c.operativeState[op.id]).hp >= 15 &&
          !present(c.operativeState[op.id]).bleeding,
      )
      .sort((a, b) => b.medical - a.medical)
      .map((op) => op.id),
  ].slice(0, 2);
  assert.equal(physicians.length, 2, 'the column needs two actual living local doctors');
  for (const id of physicians) {
    if (present(c.operativeState[id]).medkits < 2) {
      c = supplyRouteDressings(c, id, 2, { report });
    }
  }
  const retention = retainNorthernReliefSupport(c, { report });
  c = retention.campaign;
  const fitLocal = () => northernReliefFitLocal(c);
  const vacancies = Math.max(0, 8 - fitLocal().length),
    replacements = northernReliefReplacements(c).slice(0, vacancies);
  if (replacements.length !== vacancies && process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR) {
    // Observe current accepted preparation and current public quotes before
    // the unchanged staffing guard. Failed captures never become route input.
    try {
      recordRouteStrategicEvidence({
        helper: 'prepareCreatedNorthernOfficerRelief',
        stage: 'route-checkpoint',
        campaign: c,
        inputCapture,
        context: {
          phase: 'before-original-staffing-guard',
          requiredFit: 8,
          vacancies,
          replacements: replacements.map((op) => op.id),
          fitLocal: fitLocal(),
          priceCeiling: routeHiringCeiling(c, 200),
          localPeople: live()
            .filter((id) => at(id) === 'tucuman')
            .map((id) => ({
              id,
              ...Object.fromEntries(
                ['hp', 'maxHp', 'bleeding', 'morale', 'energy', 'fatigue', 'assignment'].map(
                  (key) => [key, present(c.operativeState[id])[key]],
                ),
              ),
            })),
          unusedCandidates: rosterFor(c)
            .filter(
              (op) =>
                op.id >= 100 &&
                op.id < 1000 &&
                !c.recruited.includes(op.id) &&
                present(c.operativeState[op.id]).alive &&
                !present(c.operativeState[op.id]).captured,
            )
            .map((op) => ({
              id: op.id,
              monthlyPay: op.monthlyPay,
              quote: contractQuote(c, op, 'week'),
            })),
          scope:
            'Actual accepted preparation immediately before the original staffing guard; no added order, synchronization, care time or save normalization.',
        },
      });
    } catch {
      /* Keep the original staffing assertion if observation fails. */
    }
  }
  assert.equal(
    replacements.length,
    vacancies,
    'real available recruits must fill the existing eight-person support requirement',
  );
  for (const recruit of replacements) {
    c = hireNorthernReliefReplacement(c, recruit.id, { report });
  }
  for (
    let hour = 0;
    hour < 24 && replacements.some((recruit) => !c.recruited.includes(recruit.id));
    hour++
  ) {
    c = retreatNorthernRear(c, { report });
    order({ type: 'wait', hours: 1 });
    c = retreatNorthernRear(c, { report });
  }
  for (const recruit of replacements) {
    assert.ok(c.recruited.includes(recruit.id));
    assert.equal(at(recruit.id), 'tucuman');
    assert.equal(present(c.operativeState[recruit.id]).hp, present(c.operativeState[recruit.id]).maxHp);
  }
  for (const operativeId of live().filter((id) => at(id) === 'tucuman')) {
    order({ type: 'assignCare', operativeId, assignment: 'rest' });
  }
  const officers = [9, 11, 1],
    field = [
      ...officers,
      ...live().filter(
        (id) =>
          !officers.includes(id) &&
          at(id) === 'tucuman' &&
          present(c.operativeState[id]).hp === present(c.operativeState[id]).maxHp &&
          present(c.operativeState[id]).morale >= 30,
      ),
    ];
  report({
    event: 'northernReliefField',
    hour: c.hour,
    field,
    people: live().map((id) => ({
      id,
      at: at(id),
      hp: present(c.operativeState[id]).hp,
      maxHp: present(c.operativeState[id]).maxHp,
      morale: present(c.operativeState[id]).morale,
      energy: present(c.operativeState[id]).energy,
      fatigue: present(c.operativeState[id]).fatigue,
      assignment: present(c.operativeState[id]).assignment,
    })),
  });
  assert.ok(field.length >= 8, 'the officers need actual fit survivors as support');
  for (const id of retention.retained) {
    assert.ok(
      field.includes(id),
      'The paid retained supporter must join the actual northern field.',
    );
  }
  for (
    let hour = 0;
    hour < 36 &&
    field.some(
      (id) =>
        present(c.operativeState[id]).fatigue ||
        present(c.operativeState[id]).energy < 100 ||
        present(c.operativeState[id]).asleep,
    );
    hour++
  ) {
    c = retreatNorthernRear(c, { report });
    assert.equal(c.pendingEncounter, null);
    order({ type: 'wait', hours: 1 });
  }
  for (const id of field) {
    assert.ok(present(c.operativeState[id]).hp >= 15);
    assert.equal(present(c.operativeState[id]).bleeding, 0);
    order({ type: 'assignCare', operativeId: id, assignment: 'active' });
  }
  for (let offset = 0; offset < field.length; offset += 6) {
    order({
      type: 'createSquad',
      ids: field.slice(offset, offset + 6),
      name: 'Columna con oficiales',
      sector: 'tucuman',
    });
    const pair = visit(c);
    c = leave(
      sync({ campaign: pair.campaign, battle: equipOpeningRifles(pair.battle, c.squad).battle }),
    );
    c = supplyRouteAmmunition(c, c.squad, { report }).campaign;
    c = finishReloadsBeforeMarch(c);
  }
  c = retreatNorthernRear(c, { report });
  assert.deepEqual(start, before);
  assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
  for (const [id, record] of Object.entries(start.operativeState)) {
    if (!record.alive) {
      assert.equal(c.operativeState[id].alive, false);
    }
  }
  report({
    event: 'finiteNorthernRelief',
    hour: c.hour,
    second: c.secondOfHour ?? 0,
    field,
    physicians,
    selections: prepared.selections,
    patients: patients.map((id) => ({
      id,
      hp: present(c.operativeState[id]).hp,
      alive: present(c.operativeState[id]).alive,
    })),
  });
  onCheckpoint('northern-officer-field-ready', c);
  return prepareFinalAssault(c, { staging: 'tucuman', target: 'salta', fieldIds: field });
}

// A new real rear incursion can arrive while the northern column is away.
// Withdraw only the actual healed rear survivors through the native response;
// the occupied town keeps every piece left behind.
function retreatNorthernRear(start: CampaignSnapshot, { report = () => {} } = {}) {
  if (!start.pendingEncounter) {
    return start;
  }
  assert.equal(
    start.pendingEncounter.sector,
    'cordoba',
    'an unexpected encounter must be resolved through its own actual defense',
  );
  const defenders = start.recruited.filter(
    (id) =>
      present(start.operativeState[id]).alive &&
      !present(start.operativeState[id]).captured &&
      present(start.operativeState[id]).location === 'cordoba' &&
      !operativeInTransit(start, id),
  );
  assert.ok(
    defenders.length &&
      defenders.every(
        (id) =>
          ![9, 11, 1].includes(id) &&
          present(start.operativeState[id]).hp === present(start.operativeState[id]).maxHp &&
          !present(start.operativeState[id]).bleeding,
      ),
    'only the actual fully healed rear party may withdraw',
  );
  const next = dispatchCampaign(start, {
    type: 'respondToEncounter',
    groupId: start.pendingEncounter.groupId,
    choice: 'retreat',
    destination: 'tucuman',
  });
  assert.equal(next.lastError, null);
  assert.equal(next.pendingEncounter, null);
  assert.equal(present(next.sectors.cordoba).owner, 'royalist');
  for (const id of defenders) {
    assert.equal(present(next.operativeState[id]).hp, present(start.operativeState[id]).hp);
    assert.equal(present(next.operativeState[id]).location, 'tucuman');
    assert.equal(present(next.operativeState[id]).alive, true);
  }
  for (const [id, record] of Object.entries(start.operativeState)) {
    if (!record.alive) {
      assert.equal(next.operativeState[id].alive, false);
    }
  }
  report({
    event: 'actualNorthernRearWithdrawal',
    hour: next.hour,
    sector: 'cordoba',
    defenders,
    groupId: start.pendingEncounter.groupId,
  });
  return next;
}

// Stabilize the actual critical survivor before the envoy carries the agreement.
function completeCreatedNorthernMission(start, { report = () => {} } = {}) {
  let c = retreatNorthernRear(structuredClone(start), { report });
  const prior = structuredClone(start);
  const order = (a: CampaignAction) => {
    c = dispatchCampaign(c, a);
    assert.equal(c.lastError, null, JSON.stringify(a) + c.lastError);
  };

  const relief = rosterFor(c)
    .filter(
      (op) =>
        c.recruited.includes(op.id) &&
        present(c.operativeState[op.id]).alive &&
        !present(c.operativeState[op.id]).captured &&
        present(c.operativeState[op.id]).location === 'salta',
    )
    .sort((a, b) => Number(b.id === 11) - Number(a.id === 11) || b.medical - a.medical)
    .slice(0, 6)
    .map((op) => op.id);
  assert.ok(relief.includes(11), 'the actual living envoy must remain in the relief party');
  order({ type: 'createSquad', ids: relief, sector: 'salta', name: 'Socorro de Salta' });
  c = aidNorthernMissionRelief(c, relief, { report }).campaign;
  for (const id of relief) {
    assert.ok(present(c.operativeState[id]).hp >= 15);
    assert.equal(
      present(c.operativeState[id]).bleeding,
      0,
      'actual surviving relief receives finite first aid',
    );
  }
  c = retreatNorthernRear(c, { report });
  order({ type: 'diplomacy', kind: 'northPact' });
  order({ type: 'squad', ids: [11] });
  for (let leg = 0; leg < 16 && c.location !== 'tucuman'; leg++) {
    c = completeTestTravel(c, { sector: 'tucuman', mode: 'posta' });
    c = retreatNorthernRear(c, { report });
  }
  assert.equal(c.location, 'tucuman');
  assert.equal(present(c.squads.find((row) => row.id === c.activeSquadId)).journey, undefined);
  c = attendYatasto(c);
  c = retreatNorthernRear(c, { report });
  assert.equal(c.phase, 3);
  assert.equal(present(c.missions.yatasto).completed, true);
  assert.equal(c.defeated, false);
  assert.equal(c.completed, false);
  assert.equal(present(c.operativeState[1000]).alive, false);
  for (const [id, r] of Object.entries(prior.operativeState)) {
    if (!r.alive) {
      assert.equal(c.operativeState[id].alive, false);
    }
  }
  assert.equal(present(c.operativeState[10]).alive, prior.operativeState[10].alive);
  assert.equal(present(c.operativeState[57]).hp, 88);
  assert.ok(!c.recruited.includes(57));
  assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);

  return c;
}

// Keep the two authored routes explicit: their actual wounds, paid cohorts
// and finite supply journeys differ.
export function prepareNorthernOfficerRelief(start: CampaignSnapshot, { routeKind = 'created', ...options } = {}) {
  assert.ok(
    ['created', 'stock'].includes(routeKind),
    'the northern relief needs an authored route kind',
  );
  return routeKind === 'stock'
    ? prepareStockNorthernOfficerRelief(start, options)
    : prepareCreatedNorthernOfficerRelief(start, options);
}

export function completeHiredNorthernMission(start, { routeKind = 'created', ...options } = {}) {
  assert.ok(
    ['created', 'stock'].includes(routeKind),
    'the northern mission needs an authored route kind',
  );
  return routeKind === 'stock'
    ? completeStockNorthernMission(start, options)
    : completeCreatedNorthernMission(start, options);
}

// A courier recovers officers, a real provincial gun and finite dressings.
function prepareStockNorthernOfficerRelief(start, { report = () => {} } = {}) {
  const inputCapture = recordRouteStrategicEvidence({
    helper: 'prepareStockNorthernOfficerRelief',
    stage: 'preparation-input',
    campaign: start,
  });
  let c = structuredClone(start),
    physicians = [];
  const supportPatients = new Set();
  const patients = () =>
    [...supportPatients].filter(
      (id) =>
        c.recruited.includes(id) &&
        c.operativeState[id].alive &&
        !c.operativeState[id].captured &&
        c.operativeState[id].location === 'tucuman' &&
        !physicians.includes(id),
    );
  const refreshPatients = () => {
    for (const id of c.recruited) {
      if (
        c.operativeState[id].alive &&
        !c.operativeState[id].captured &&
        c.operativeState[id].location === 'tucuman' &&
        !physicians.includes(id) &&
        (c.operativeState[id].hp < c.operativeState[id].maxHp || c.operativeState[id].bleeding)
      ) {
        supportPatients.add(id);
      }
    }
  };
  const resolveEncounter = () => {
    if (!c.pendingEncounter) {
      return;
    }
    const physicianIds = physicians.length
      ? physicians
      : c.recruited.filter(
          (id: string|number) =>
            c.operativeState[id].alive &&
            c.operativeState[id].location === 'tucuman' &&
            c.operativeState[id].assignment === 'doctor',
        );
    report({ event: 'northernReliefEncounter', physicianIds, campaign: structuredClone(c) });
    c = resolveStockNorthernReliefEncounter(c, { physicianIds, report }).campaign;
    refreshPatients();
  };
  try {
    // The settled field retains actual bleeding. Native finite aid must precede
    // the courier's rest and supply trip, including a wounded serving doctor.
    c = stabilizeCreatedCuyoSurvivors(c, { report });
    const rear = stockNorthernRearReserve(c);
    const live = () =>
      c.recruited.filter((id: string|number) => c.operativeState[id].alive && !c.operativeState[id].captured);
    const order = (a: CampaignAction) => {
      resolveEncounter();
      if (a.type === 'assignCare' && c.operativeState[a.operativeId].assignment === a.assignment) {
        return;
      }
      if (a.type === 'wait') {
        for (const id of live()) {
          const q = c.contracts[id];
          if (q?.expiresAt != null && q.expiresAt <= c.hour + a.hours) {
            c = dispatchCampaign(c, {
              type: 'renewContract',
              id,
              term: 'day',
              expectedExpiresAt: q.expiresAt,
            });
            assert.equal(c.lastError, null);
          }
        }
      }
      c = dispatchCampaign(c, a);
      assert.equal(c.lastError, null, JSON.stringify(a) + c.lastError);
      if (a.type === 'wait') {
        resolveEncounter();
      }
    };
    const travel = (at: string) => {
      const id = c.activeSquadId;
      order({ type: 'travel', sector: at, queue: true, mode: 'posta' });
      for (let h = 0; h < 36 && c.squads.find((q) => q.id === id).journey; h++) {
        resolveEncounter();
        order({ type: 'wait', hours: 1 });
      }
      assert.equal(c.location, at);
    };

    for (const id of live().filter((id: number) => !rear.ids.includes(id))) {
      order({ type: 'assignCare', operativeId: id, assignment: 'rest' });
    }
    const initialLeadership = Math.max(
      ...encounterDefinitions(c)
        .filter((n) => ['quiroga', 'paz'].includes(n.id))
        .map((n) => n.requiredLeadership),
    );
    const courier = rosterFor(c)
      .filter(
        (op) =>
          live().includes(op.id) &&
          op.leadership >= initialLeadership &&
          c.operativeState[op.id].location === 'tucuman' &&
          c.operativeState[op.id].hp >= 15 &&
          !c.operativeState[op.id].bleeding,
      )
      .sort(
        (a, b) =>
          Number(b.id === 114) - Number(a.id === 114) ||
          c.operativeState[b.id].energy - c.operativeState[a.id].energy ||
          b.leadership - a.leadership,
      )[0]?.id;
    assert.ok(
      courier,
      'the envoy must be a living local leader, preserving every actual fallen soldier',
    );
    report({
      event: 'northernReliefCourier',
      id: courier,
      leadership: present(rosterFor(c).find((op) => op.id === courier)).leadership,
      requiredLeadership: initialLeadership,
      campaign: structuredClone(c),
    });
    // The envoy's existing rest window also covers the actual support's morale.
    // Preserve the same72 requests and every casualty; no payment creates a fit
    // replacement when the affordable living roster has already been exhausted.
    for (
      let h = 0;
      h < 72 &&
      (c.operativeState[courier].fatigue ||
        c.operativeState[courier].energy < 100 ||
        c.operativeState[courier].asleep ||
        stockNorthernReliefRestPlan(c, {
          rear,
          plannedOfficers: [9, 11, 1],
          includeSourceSupport: true,
        }).needsRest);
      h++
    ) {
      resolveEncounter();
      order({ type: 'wait', hours: 1 });
    }
    assert.equal(c.operativeState[courier].asleep, false);
    assert.equal(c.operativeState[courier].energy, 100);
    order({ type: 'transport', mode: 'posta' });
    order({ type: 'createSquad', ids: [courier], name: 'Enlace provincial', sector: 'tucuman' });
    order({ type: 'assignCare', operativeId: courier, assignment: 'active' });
    travel('cordoba');
    c = meetRecruits(c, ['quiroga', 'paz'], courier);
    // The clinic delivery needs twenty owned dressings in total. Existing
    // carried stock counts toward that delivery; demanding twenty extra can
    // exceed the courier's real pockets and force an unnecessary supply trip.
    const dressingTarget = Math.max(c.operativeState[courier].medkits ?? 0, 20);
    c = discoverRouteCache(c, courier);
    const localStock = sectorInventoryModel(c, 'cordoba', rosterFor(c), courier)
      .entries.filter((row) => row.reachable && JSON.parse(row.expected).item === 'medkits')
      .reduce((sum, row) => sum + row.count, 0);
    const donations = live()
      .filter(
        (id: number) =>
          id !== courier &&
          c.operativeState[id].location === 'cordoba' &&
          !sectorInventoryModel(c, 'cordoba', rosterFor(c), id).reason,
      )
      .reduce(
        (sum: number, id: string|number) =>
          sum + Math.max(0, (c.operativeState[id].medkits ?? 0) - (rear.medkits[id] ?? 0)),
        0,
      );
    c = supplyRouteDressings(
      c,
      courier,
      Math.min(dressingTarget, (c.operativeState[courier].medkits ?? 0) + localStock + donations),
      { reserves: rear.medkits, report },
    );
    for (
      let trip = 0;
      trip < 20 && (c.operativeState[courier].medkits ?? 0) < dressingTarget;
      trip++
    ) {
      const found = collectRouteMedicalSupplies(
        c,
        courier,
        dressingTarget - (c.operativeState[courier].medkits ?? 0),
        { report },
      );
      c = found.campaign;
    }
    assert.equal(
      c.operativeState[courier].medkits,
      dressingTarget,
      'the courier must recover every delivered dressing from actual finite stocks',
    );
    // Ensenada holds the only swivel. The first northern assault instead uses
    // Córdoba's existing bronze piece and its real two-person provincial crew.
    assertStockNorthernRear(c, rear);
    c = attachStockNorthernSupport(c, { rear, report }).campaign;
    const battery = prepareRouteBattery(c, ['bronze4'], {
      destination: 'tucuman',
      keepServing: live(),
      report,
    });
    c = battery.campaign;
    assertStockNorthernRear(c, rear);
    // Retain the original clinic selection and its real native defense context.
    // Quiet visits may issue this finite piece into the local field.
    order({ type: 'configureArtillery', types: battery.selections });
    order({ type: 'diplomacy', kind: 'partisanSupply' });
    // The Córdoba envoy meets the actual fifty-point officer contacts. A
    // genuinely recruited local officer then meets Azurduy's higher gate.
    const officerLeadership = present(encounterDefinitions(c).find(
      (n) => n.id === 'azurduy',
    )).requiredLeadership;
    const officerEnvoy = rosterFor(c)
      .filter(
        (op) =>
          live().includes(op.id) &&
          op.leadership >= officerLeadership &&
          c.operativeState[op.id].location === 'tucuman' &&
          c.operativeState[op.id].hp >= 15 &&
          !c.operativeState[op.id].bleeding,
      )
      .sort((a, b) => b.leadership - a.leadership || a.id - b.id)[0]?.id;
    assert.ok(officerEnvoy, 'a real local officer must meet the later native leadership gate');
    if (!c.squad.includes(officerEnvoy)) {
      order({ type: 'assignToSquad', operativeId: officerEnvoy, squadId: c.activeSquadId });
    }
    order({ type: 'assignCare', operativeId: officerEnvoy, assignment: 'active' });
    report({
      event: 'northernReliefOfficerEnvoy',
      id: officerEnvoy,
      leadership: present(rosterFor(c).find((op) => op.id === officerEnvoy)).leadership,
      requiredLeadership: officerLeadership,
      campaign: structuredClone(c),
    });
    c = meetRecruits(c, ['azurduy'], officerEnvoy);
    order({
      type: 'sectorInventory',
      sector: 'tucuman',
      operativeId: courier,
      direction: 'drop',
      item: 'medkits',
      count: 20,
    });
    const model = (id: number) => sectorInventoryModel(c, 'tucuman', rosterFor(c), id);
    physicians = [
      1,
      ...rosterFor(c)
        .filter(
          (op) =>
            op.id !== 1 &&
            live().includes(op.id) &&
            op.medical >= 20 &&
            c.operativeState[op.id].location === 'tucuman' &&
            c.operativeState[op.id].hp >= 15 &&
            !c.operativeState[op.id].bleeding,
        )
        .sort((a, b) => b.medical - a.medical)
        .map((op) => op.id),
    ].slice(0, 2);
    assert.equal(
      physicians.length,
      2,
      'two actual living local doctors must carry the delivered dressings',
    );
    for (const id of physicians) {
      const row = model(id).entries.find(
        (r) => r.reachable && JSON.parse(r.expected).item === 'medkits' && r.count >= 10,
      );
      assert.ok(row);
      order({
        type: 'sectorInventory',
        sector: 'tucuman',
        operativeId: id,
        direction: 'take',
        sourceKey: row.key,
        expected: row.expected,
        count: 10,
      });
    }
    refreshPatients();
    for (const operativeId of physicians) {
      order({ type: 'assignCare', operativeId, assignment: 'doctor' });
    }
    for (const operativeId of patients()) {
      order({ type: 'assignCare', operativeId, assignment: 'patient' });
    }
    let careHours = 0;
    for (
      ;
      careHours < 48 &&
      patients().some(
        (id) =>
          c.operativeState[id].hp < c.operativeState[id].maxHp || c.operativeState[id].bleeding,
      );
      careHours++
    ) {
      resolveEncounter();
      for (const operativeId of patients()) {
        order({ type: 'assignCare', operativeId, assignment: 'patient' });
      }
      for (const id of physicians) {
        if (!c.operativeState[id].medkits) {
          const row = model(id).entries.find(
            (r) => r.reachable && JSON.parse(r.expected).item === 'medkits',
          );
          if (row) {
            order({
              type: 'sectorInventory',
              sector: 'tucuman',
              operativeId: id,
              direction: 'take',
              sourceKey: row.key,
              expected: row.expected,
              count: Math.min(10, row.count),
            });
          } else {
            // Keep every discovery or patrol's real time even if it finds no supply.
            // Carried donations precede public inspection of the actual fallen bodies.
            const reserves = Object.fromEntries(
              physicians
                .filter((other) => other !== id)
                .map((other) => [other, c.operativeState[other].medkits]),
            );
            const donor = live().find(
              (other: number) =>
                other !== id &&
                c.operativeState[other].location === 'tucuman' &&
                c.operativeState[other].medkits > (reserves[other] ?? 0) &&
                !model(other).reason,
            );
            if (donor !== undefined) {
              c = supplyRouteDressings(c, id, 1, { reserves, report });
            } else {
              c = discoverRouteCache(c, id);
              const cache = model(id).entries.find(
                (entry) => entry.reachable && JSON.parse(entry.expected).item === 'medkits',
              );
              if (cache) {
                order({
                  type: 'sectorInventory',
                  sector: 'tucuman',
                  operativeId: id,
                  direction: 'take',
                  sourceKey: cache.key,
                  expected: cache.expected,
                  count: 1,
                });
              } else {
                const found = recoverVisibleRouteDressings(c, id, 1, { report });
                c = found.campaign;
                assert.equal(
                  found.collected,
                  1,
                  'the doctor must recover an actual finite field dressing',
                );
              }
            }
            assert.ok(c.operativeState[id].medkits > 0);
            report({
              event: 'northernReliefFiniteFieldDressing',
              id,
              hour: c.hour,
              campaign: structuredClone(c),
            });
          }
        }
      }
      // Visiting the cleared field for a dressing returns the physician to active
      // service. Restore the real doctor assignment before the next care hour.
      for (const operativeId of physicians) {
        order({ type: 'assignCare', operativeId, assignment: 'doctor' });
      }
      order({ type: 'wait', hours: 1 });
    }
    for (const id of patients()) {
      assert.equal(
        c.operativeState[id].hp,
        c.operativeState[id].maxHp,
        'finite provincial care must restore the actual injured support',
      );
    }
    for (const operativeId of [...physicians, ...patients()]) {
      order({ type: 'assignCare', operativeId, assignment: 'rest' });
    }
    // Spend the original36 field-rest requests before the staffing guard. The
    // courier can be fit while wounded comrades still need ordinary morale rest.
    // This moves the same window; it does not add another preparation budget.
    const restingField = () =>
      live().filter((id: number) => !rear.ids.includes(id) && c.operativeState[id].location === 'tucuman');
    for (
      let h = 0;
      h < 36 &&
      (stockNorthernReliefRestPlan(c, { remainingCareHours: 48 - careHours }).needsRest ||
        restingField().some(
          (id: string|number) =>
            c.operativeState[id].fatigue ||
            c.operativeState[id].energy < 100 ||
            c.operativeState[id].asleep,
        ));
      h++
    ) {
      resolveEncounter();
      for (const id of restingField()) {
        order({
          type: 'assignCare',
          operativeId: id,
          assignment: c.operativeState[id].hp < c.operativeState[id].maxHp ? 'patient' : 'rest',
        });
      }
      order({ type: 'wait', hours: 1 });
    }
    const staffing = bookStockNorthernReliefHires(c, {
      remainingCareHours: 48 - careHours,
      report,
    });
    c = staffing.campaign;
    for (
      ;
      careHours < 48 && staffing.hires.some(({ id }) => !c.recruited.includes(id));
      careHours++
    ) {
      order({ type: 'wait', hours: 1 });
    }
    assertStockNorthernHiresArrived(c, staffing.hires);
    assertStockNorthernRear(c, rear);
    const officers = [9, 11, 1],
      field = [
        ...officers,
        ...live().filter(
          (id: number) =>
            !officers.includes(id) &&
            c.operativeState[id].location === 'tucuman' &&
            c.operativeState[id].hp === c.operativeState[id].maxHp &&
            c.operativeState[id].morale >= 30,
        ),
      ];
    report({ event: 'northernReliefFormation', field, campaign: structuredClone(c) });
    assert.ok(field.length >= 8, 'the officers need actual fit survivors as support');
    for (const id of field) {
      assert.ok(c.operativeState[id].hp >= 15);
      assert.equal(c.operativeState[id].bleeding, 0);
      order({ type: 'assignCare', operativeId: id, assignment: 'active' });
    }
    for (let i = 0; i < field.length; i += 6) {
      order({
        type: 'createSquad',
        ids: field.slice(i, i + 6),
        name: 'Columna con oficiales',
        sector: 'tucuman',
      });
      const p = visit(c);
      c = leave(
        sync({ campaign: p.campaign, battle: equipOpeningRifles(p.battle, c.squad).battle }),
      );
      const ammunitionStart = structuredClone(c),
        supplied = supplyRouteAmmunition(c, c.squad, { target: 12, report });
      c = supplied.campaign;
      report({
        event: 'northernReliefFieldAmmunition',
        ids: [...c.squad],
        ammunitionStart,
        transactions: supplied.transactions,
        campaign: structuredClone(c),
      });
      c = finishReloadsBeforeMarch(c, { report });
    }
    // Recover the surviving physical piece after the last quiet equipment visit.
    // Ordinary storage preserves any actual spent charges and native losses.
    const batteryRecoveryStart = structuredClone(c),
      assaultBattery = prepareRouteBattery(c, ['bronze4'], {
        destination: 'tucuman',
        keepServing: live(),
        report,
      });
    c = assaultBattery.campaign;
    report({
      event: 'northernReliefAssaultBattery',
      batteryRecoveryStart,
      selections: assaultBattery.selections,
      campaign: structuredClone(c),
    });
    order({ type: 'configureArtillery', types: assaultBattery.selections });
    const ready = prepareFinalAssault(c, { staging: 'tucuman', target: 'salta', fieldIds: field });
    recordRouteStrategicEvidence({
      helper: 'prepareStockNorthernOfficerRelief',
      stage: 'route-checkpoint',
      campaign: ready,
      inputCapture,
      context: {
        phase: 'whole-officer-preparation-return-after-unchanged-final-assault-request',
        staging: 'tucuman',
        target: 'salta',
        fieldIds: field,
      },
    });
    return ready;
  } catch (error) {
    recordRouteStrategicEvidence({
      helper: 'prepareStockNorthernOfficerRelief',
      stage: 'preparation-failure',
      campaign: c,
      inputCapture,
      error,
    });
    throw error;
  }
}

// A routed survivor can occupy a real rural cell without a local medic. Send
// a serving doctor with actual carried dressings through an ordinary journey.
export function relieveStockNorthernPatient(
  start: CampaignSnapshot,
  { patientId, doctorId, report = () => {}, onCheckpoint = () => {} } = {},
) {
  let c = decodeSave(encodeSave(start)).campaign;
  const before = structuredClone(start),
    orders = [];
  const target = operativeLocation(c, patientId),
    destination = worldCell(target),
    clock = () => c.hour * 3600 + (c.secondOfHour ?? 0);
  assert.ok(destination && c.recruited.includes(patientId) && present(c.operativeState[patientId]).alive);
  const order = (action: CampaignAction) => {
    const previous = c;
    c = dispatchCampaign(c, action);
    assert.equal(c.lastError, null, JSON.stringify(action) + c.lastError);
    orders.push({
      action: structuredClone(action),
      from: previous.hour * 3600 + (previous.secondOfHour ?? 0),
      to: clock(),
      treasuryBefore: previous.resources.treasury,
      treasuryAfter: c.resources.treasury,
    });
  };
  const retain = () => {
    for (const id of c.recruited.filter(
      (id) => present(c.operativeState[id]).alive && !present(c.operativeState[id]).captured,
    )) {
      const contract = c.contracts[id],
        expiry = contractExpiresSeconds(contract);
      assert.ok(contract && (expiry === null || expiry > clock()));
      if (expiry !== null && expiry <= clock() + 3601) {
        const quote = contractQuote(
            c,
            rosterFor(c).find((op) => op.id === id),
            'day',
          ),
          cash = c.resources.treasury;
        assert.equal(quote.available, true, quote.reason);
        order({
          type: 'renewContract',
          id,
          term: 'day',
          expectedExpiresAt: contract.expiresAt,
          expectedExpiresSecond: contract.expiresSecond ?? 0,
        });
        assert.equal(c.resources.treasury, cash - quote.price);
      }
    }
  };
  const distance = (op: CampaignOperative) => {
    const cell = worldCell(operativeLocation(c, op.id));
    return cell
      ? Math.abs(cell.col - destination.col) + Math.abs(cell.row - destination.row)
      : Infinity;
  };
  const candidates = rosterFor(c)
    .filter((op) => {
      const record = c.operativeState[op.id];
      return (
        (doctorId === undefined || op.id === doctorId) &&
        c.recruited.includes(op.id) &&
        present(record).alive &&
        !present(record).captured &&
        !operativeInTransit(c, op.id) &&
        present(record).hp >= 15 &&
        !present(record).bleeding &&
        !present(record).asleep &&
        present(record).energy > 10 &&
        present(record).medkits > 0 &&
        op.medical >= 20
      );
    })
    .sort(
      (a, b) =>
        distance(a) - distance(b) ||
        Number(present(c.operativeState[b.id]).medkits > 1) - Number(present(c.operativeState[a.id]).medkits > 1) ||
        b.medical - a.medical ||
        a.id - b.id,
    );
  let doctor = null,
    route = null;
  for (const candidate of candidates) {
    order({
      type: 'createSquad',
      ids: [candidate.id],
      sector: operativeLocation(c, candidate.id),
      name: 'Socorro del camino',
    });
    order({ type: 'assignCare', operativeId: candidate.id, assignment: 'active' });
    if (operativeLocation(c, candidate.id) === target) {
      doctor = candidate;
      route = { path: [target], hours: 0 };
      break;
    }
    const quote = previewStrategicRoute(
      c,
      c.activeSquadId,
      target,
      destination.anchor && c.routes.posta ? 'posta' : 'march',
    );
    if (quote.valid) {
      doctor = candidate;
      route = quote;
      break;
    }
  }
  assert.ok(doctor, `No actual serving doctor can reach the patient at ${target}.`);
  const source = operativeLocation(c, doctor.id),
    squadId = c.activeSquadId,
    preparation = [];
  // Preparing a finite dressing before departure avoids a weapon delay at a
  // critical patient's cell. This remains an ordinary paid tactical order.
  const prepared = visit(c),
    unit = prepared.battle.units.find((unit) => unit.id === String(doctor.id));
  assert.ok(unit);
  let preparedBattle = prepared.battle;
  if (unit.activeSlot !== 'medical') {
    const action = { type: 'weapon', unitId: unit.id, slot: 'medical' };
    preparedBattle = actBattle(preparedBattle, action);
    assert.equal(preparedBattle.lastError, null);
    preparation.push(action);
  }
  c = leave(sync({ campaign: prepared.campaign, battle: preparedBattle }));
  if (present(route).action) {
    order(present(route).action);
  }
  for (let hour = 0; present(c.squads.find((squad) => squad.id === squadId)).journey && hour < 48; hour++) {
    assert.equal(c.pendingEncounter, null);
    retain();
    order({ type: 'wait', hours: 1 });
    assert.ok(
      present(c.operativeState[patientId]).alive,
      'The actual patient must survive the real relief journey.',
    );
  }
  assert.equal(present(c.squads.find((squad) => squad.id === squadId)).journey, undefined);
  assert.equal(operativeLocation(c, doctor.id), target);
  const group = [doctor.id, patientId];
  order({ type: 'createSquad', ids: group, sector: target, name: 'Socorro del herido' });
  for (const id of group) {
    order({ type: 'assignCare', operativeId: id, assignment: 'active' });
  }
  onCheckpoint('stock-road-relief-before-aid', structuredClone(c));
  const p = visit(c),
    stock = p.battle.units
      .filter((unit) => group.includes(Number(unit.id)))
      .reduce((total, unit) => total + unit.medkits, 0),
    aid = autoBandageBattle(p.battle);
  c = leave(sync({ campaign: p.campaign, battle: aid.battle }));
  const treatments = aid.steps.filter((action) => action.type === 'useItem').length;
  assert.equal(
    group.reduce((total, id) => total + present(c.operativeState[id]).medkits, 0),
    stock - treatments,
  );
  assert.ok(present(c.operativeState[patientId]).alive && present(c.operativeState[patientId]).hp >= 15);
  assert.equal(present(c.operativeState[patientId]).bleeding, 0);
  for (const [id, record] of Object.entries(start.operativeState)) {
    if (!record.alive) {
      assert.equal(c.operativeState[id].alive, false);
    }
  }
  assert.deepEqual(start, before);
  c = decodeSave(encodeSave(c)).campaign;
  assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
  const receipt = {
    doctor: doctor.id,
    patientId,
    source,
    destination: target,
    route: present(route).path,
    hours: present(route).hours,
    orders,
    preparation,
    aid: {
      steps: aid.steps,
      elapsedSeconds: aid.elapsedSeconds,
      treatedIds: aid.treatedIds,
      stoppedReason: aid.stoppedReason,
    },
  };
  report({
    event: 'northernRoadRelief',
    doctor: doctor.id,
    patientId,
    source,
    destination: target,
    hours: present(route).hours,
    actions: aid.steps.length,
    elapsedSeconds: aid.elapsedSeconds,
    dressingsUsed: treatments,
  });
  onCheckpoint('stock-road-relief-complete', structuredClone(c));
  return { campaign: c, receipt };
}

// Yatasto accepts a capable local envoy; it does not require a particular officer.
// Stable wounds remain real wounds. Only acute survivors need finite field aid.
export function advanceStockNorthernMissionHour(start: CampaignSnapshot, { report = () => {} } = {}) {
  assert.equal(start.pendingEncounter, null);
  assert.equal(start.pendingBattle, null);
  const before = start.hour * 3600 + (start.secondOfHour ?? 0),
    waited = dispatchCampaign(start, { type: 'wait', hours: 1 });
  assert.equal(waited.lastError, null, waited.lastError);
  assert.ok(
    waited.hour * 3600 + (waited.secondOfHour ?? 0) > before,
    'The real mission wait must advance time.',
  );
  let campaign = waited;
  if (waited.pendingEncounter) {
    report({ event: 'northernMissionRaid', campaign: structuredClone(waited) });
    campaign = resolveNorthernHandoverEncounter(waited, { report });
  }
  assert.equal(
    campaign.pendingEncounter,
    null,
    'An actual raid must be resolved before continuing to Yatasto.',
  );
  assert.equal(
    campaign.pendingBattle,
    null,
    'The actual mission defense must finish before continuing to Yatasto.',
  );
  return campaign;
}

function completeStockNorthernMission(start, { report = () => {}, onCheckpoint } = {}) {
  let c = structuredClone(start);
  const prior = structuredClone(start),
    now = () => c.hour * 3600 + (c.secondOfHour ?? 0);
  const live = () =>
    c.recruited.filter((id: string|number) => c.operativeState[id].alive && !c.operativeState[id].captured);
  const acute = () =>
    live().filter((id: string|number) => c.operativeState[id].hp < 15 || c.operativeState[id].bleeding > 0);
  const order = (a: CampaignAction) => {
    c = dispatchCampaign(c, a);
    assert.equal(c.lastError, null, JSON.stringify(a) + c.lastError);
  };
  const checkpoint = (stage: string) => {
    assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
    report({ event: stage, campaign: structuredClone(c) });
    onCheckpoint?.(stage, structuredClone(c));
  };
  const keepServing = (hours = 2) => {
    for (const id of live()) {
      let contract = c.contracts[id],
        expiry = contractExpiresSeconds(contract);
      assert.ok(
        contract && (expiry === null || expiry > now()),
        `The actual survivor ${id} must still be serving; expired service cannot be restored by this route.`,
      );
      for (let renewals = 0; expiry !== null && expiry <= now() + hours * 3600; renewals++) {
        assert.ok(renewals < 4, 'The mission renewal horizon must remain bounded.');
        const quote = contractQuote(
            c,
            rosterFor(c).find((op) => op.id === id),
            'day',
          ),
          cash = c.resources.treasury;
        assert.equal(quote.available, true, quote.reason);
        order({
          type: 'renewContract',
          id,
          term: 'day',
          expectedExpiresAt: contract.expiresAt,
          expectedExpiresSecond: contract.expiresSecond ?? 0,
        });
        assert.equal(c.resources.treasury, cash - quote.price);
        assert.equal(contractExpiresSeconds(c.contracts[id]), expiry + 86400);
        report({
          event: 'northernMissionRenewal',
          id,
          price: quote.price,
          hour: c.hour,
          secondOfHour: c.secondOfHour ?? 0,
          expiresAt: c.contracts[id].expiresAt,
          expiresSecond: c.contracts[id].expiresSecond ?? 0,
        });
        contract = c.contracts[id];
        expiry = contractExpiresSeconds(contract);
      }
    }
  };
  const waitHour = () => {
    assert.equal(
      acute().length,
      0,
      `All actual acute survivors need care before mission hours: ${acute().join(',')}.`,
    );
    assert.equal(c.pendingEncounter, null);
    keepServing();
    c = advanceStockNorthernMissionHour(c, { report });
  };

  // Inspect every owned survivor, including people left in another cell. A
  // local capable medic and actual reachable dressing stock are mandatory.
  for (let batches = 0; acute().length; batches++) {
    assert.ok(batches < live().length, 'Finite first aid must resolve each actual acute group.');
    keepServing();
    const patients = acute().sort(
        (a: string|number, b: string|number) =>
          c.operativeState[a].hp / Math.max(1, c.operativeState[a].bleeding) -
          c.operativeState[b].hp / Math.max(1, c.operativeState[b].bleeding),
      ),
      at = operativeLocation(c, patients[0]);
    // A more skilled but distant physician can arrive after a critical patient
    // dies. Plan from the actual retained friendly positions and finite stock.
    // These read-only forecasts neither move a doctor nor spend a dressing.
    const retained = c.sectorStates[at],
      patient = retained?.units.find(
        (unit: { side: string; id: string; }) => unit.side === 'player' && unit.id === String(patients[0]),
      );
    const candidates = rosterFor(c)
      .filter(
        (op) =>
          live().includes(op.id) &&
          operativeLocation(c, op.id) === at &&
          !operativeInTransit(c, op.id) &&
          c.operativeState[op.id].hp >= 15 &&
          !c.operativeState[op.id].asleep &&
          c.operativeState[op.id].energy > 0 &&
          op.medical > 0,
      )
      .flatMap((op) => {
        const record = c.operativeState[op.id],
          stock =
            record.medkits ||
            sectorInventoryModel(c, at, rosterFor(c), op.id)
              .entries.filter((row) => row.reachable && JSON.parse(row.expected).item === 'medkits')
              .reduce((sum, row) => sum + row.count, 0);
        if (
          !firstAidPlan({ ...op, ...record, medkits: stock }, c.operativeState[patients[0]]).valid
        ) {
          return [];
        }
        const doctor = retained?.units.find(
          (unit: { side: string; id: string; }) => unit.side === 'player' && unit.id === String(op.id),
        );
        if (!doctor || !patient) {
          return [{ op, cost: Infinity }];
        }
        const planning = { ...retained, status: 'active', mode: 'exploration', phase: 'player' },
          destination = getReachable(planning, doctor)
            .filter((point) => atHand(point, patient) && hasLineOfSight(planning, point, patient))
            .sort((a, b) => a.cost - b.cost || a.path.length - b.path.length)[0];
        return destination ? [{ op, cost: destination.cost }] : [];
      });
    const medic = candidates.sort(
      (a, b) =>
        Number(c.operativeState[a.op.id].bleeding > 0) -
          Number(c.operativeState[b.op.id].bleeding > 0) ||
        a.cost - b.cost ||
        b.op.medical - a.op.medical,
    )[0]?.op;
    if (!medic) {
      c = relieveStockNorthernPatient(c, { patientId: patients[0], report, onCheckpoint }).campaign;
      continue;
    }
    const group = [
      medic.id,
      ...patients.filter((id: number) => id !== medic.id && operativeLocation(c, id) === at).slice(0, 5),
    ];
    order({ type: 'createSquad', ids: group, sector: at, name: 'Socorro del norte' });
    for (const id of group) {
      order({ type: 'assignCare', operativeId: id, assignment: 'active' });
    }
    if (!(c.operativeState[medic.id].medkits > 0)) {
      const row = sectorInventoryModel(c, at, rosterFor(c), medic.id).entries.find(
        (row) => row.reachable && JSON.parse(row.expected).item === 'medkits',
      );
      assert.ok(row, `No actual reachable dressings remain for first aid at ${at}.`);
      const count = Math.min(row.count, 2 * group.length);
      order({
        type: 'sectorInventory',
        sector: at,
        operativeId: medic.id,
        direction: 'take',
        sourceKey: row.key,
        expected: row.expected,
        count,
      });
      report({
        event: 'northernMissionDressingsCollected',
        id: medic.id,
        sector: at,
        count,
        sourceKey: row.key,
      });
    }
    const p = visit(c),
      aid = autoBandageBattle(p.battle);
    c = leave(sync({ campaign: p.campaign, battle: aid.battle }));
    for (const id of group) {
      assert.ok(
        c.operativeState[id].alive && c.operativeState[id].hp >= 15,
        `Actual finite first aid must stabilize ${id}.`,
      );
      assert.equal(c.operativeState[id].bleeding, 0);
    }
    report({
      event: 'northernMissionFirstAid',
      sector: at,
      ids: group,
      actions: aid.steps.length,
      elapsedSeconds: aid.elapsedSeconds,
      treatedIds: aid.treatedIds,
      stoppedReason: aid.stoppedReason,
    });
  }
  assert.equal(acute().length, 0);
  keepServing();
  const envoy = rosterFor(c)
    .filter(
      (op) =>
        live().includes(op.id) &&
        operativeLocation(c, op.id) === 'salta' &&
        !operativeInTransit(c, op.id) &&
        c.operativeState[op.id].hp >= 15 &&
        !c.operativeState[op.id].bleeding,
    )
    .sort(
      (a, b) =>
        c.operativeState[b.id].hp / c.operativeState[b.id].maxHp -
          c.operativeState[a.id].hp / c.operativeState[a.id].maxHp ||
        b.leadership - a.leadership ||
        a.id - b.id,
    )[0];
  assert.ok(envoy, 'The agreement needs an actual living capable local envoy.');
  order({ type: 'createSquad', ids: [envoy.id], sector: 'salta', name: 'Enlace de Yatasto' });
  order({ type: 'assignCare', operativeId: envoy.id, assignment: 'rest' });
  for (
    let h = 0;
    h < 72 &&
    (c.operativeState[envoy.id].fatigue ||
      c.operativeState[envoy.id].energy < 100 ||
      c.operativeState[envoy.id].asleep);
    h++
  ) {
    waitHour();
  }
  assert.equal(c.operativeState[envoy.id].fatigue, 0);
  assert.equal(c.operativeState[envoy.id].energy, 100);
  assert.equal(c.operativeState[envoy.id].asleep, false);
  order({ type: 'assignCare', operativeId: envoy.id, assignment: 'active' });
  report({
    event: 'northernMissionEnvoy',
    id: envoy.id,
    name: envoy.name,
    hp: c.operativeState[envoy.id].hp,
    actualSurvivors: live(),
  });
  if (!c.flags.northPact) {
    const cash = c.resources.treasury;
    order({ type: 'diplomacy', kind: 'northPact' });
    assert.equal(c.resources.treasury, cash - 300);
    report({ event: 'northernMissionPact', cost: 300 });
  }
  order({ type: 'travel', sector: 'tucuman', queue: true, mode: 'posta' });
  const squadId = c.activeSquadId;
  for (let h = 0; h < 48 && c.squads.find((q) => q.id === squadId).journey; h++) {
    const journey = c.squads.find((q) => q.id === squadId).journey;
    assert.equal(journey.status, 'moving', `The real envoy route stopped: ${journey.reason}.`);
    waitHour();
  }
  assert.equal(c.squads.find((q) => q.id === squadId).journey, undefined);
  assert.equal(c.location, 'tucuman');
  checkpoint('northernMissionArrival');
  assert.equal(acute().length, 0);
  keepServing();
  c = attendYatasto(c);
  assert.equal(c.phase, 3);
  assert.equal(c.missions.yatasto.completed, true);
  assert.equal(c.defeated, false);
  assert.equal(c.completed, false);
  // Preserve the envoy party and use existing local squads for the surviving
  // reserve. Reorganizing bodies in their actual cells frees later relief
  // slots without a journey, recovery hour, or equipment transfer.
  const envoySquad = c.activeSquadId,
    envoyMembers = [...c.squad],
    records = structuredClone(c.operativeState),
    contracts = structuredClone(c.contracts),
    cash = c.resources.treasury,
    seconds = now(),
    locations = new Map(live().map((id: number) => [id, operativeLocation(c, id)]));
  const cells = [
    ...new Set(
      live()
        .filter((id: number) => !envoyMembers.includes(id) && !operativeInTransit(c, id))
        .map((id) => locations.get(id)),
    ),
  ];
  for (const cell of cells) {
    const ids = live().filter(
        (id: number) =>
          !envoyMembers.includes(id) &&
          !operativeInTransit(c, id) &&
          operativeLocation(c, id) === cell,
      ),
      used = new Set();
    for (let offset = 0; offset < ids.length; offset += 6) {
      const members = ids.slice(offset, offset + 6),
        target =
          c.squads.find(
            (squad) =>
              squad.id !== envoySquad &&
              !used.has(squad.id) &&
              squad.location === cell &&
              !squad.journey &&
              squad.members.includes(members[0]),
          ) ??
          c.squads.find(
            (squad) =>
              squad.id !== envoySquad &&
              !used.has(squad.id) &&
              squad.location === cell &&
              !squad.journey,
          );
      assert.ok(target, 'Actual local survivors need an existing stationary party.');
      used.add(target.id);
      order({ type: 'selectSquad', id: target.id });
      order({ type: 'squad', ids: members });
    }
  }
  order({ type: 'selectSquad', id: envoySquad });
  assert.deepEqual(c.squad, envoyMembers);
  assert.deepEqual(c.operativeState, records);
  assert.deepEqual(c.contracts, contracts);
  assert.equal(c.resources.treasury, cash);
  assert.equal(now(), seconds);
  for (const [id, cell] of locations) {
    assert.equal(operativeLocation(c, id), cell);
  }
  report({
    event: 'northernMissionLocalFormation',
    occupiedSquads: c.squads.filter((squad) => squad.members.length).length,
    envoySquad,
    envoyMembers,
    actualSurvivors: live().length,
  });
  for (const [id, r] of Object.entries(prior.operativeState)) {
    if (!r.alive) {
      assert.equal(c.operativeState[id].alive, false);
    }
  }
  for (const id of live()) {
    assert.ok(c.operativeState[id].hp >= 15);
    assert.equal(c.operativeState[id].bleeding, 0);
    const expiry = contractExpiresSeconds(c.contracts[id]);
    assert.ok(expiry === null || expiry > now());
  }
  assert.equal(c.operativeState[10].alive, prior.operativeState[10].alive);
  const commander = c.operativeState[57];
  assert.ok(
    commander.alive && !isUnconscious(commander),
    'The native Yatasto commander must remain alive and conscious.',
  );
  assert.equal(
    commander.hp,
    prior.operativeState[57].hp,
    'The conference preserves the actual allied commander wounds; it does not restore untouched health.',
  );
  assert.equal(
    commander.bleeding,
    prior.operativeState[57].bleeding,
    'The conference preserves the actual allied commander bleeding.',
  );
  assert.ok(!c.recruited.includes(57));
  checkpoint('northernMissionCompleted');
  return c;
}
