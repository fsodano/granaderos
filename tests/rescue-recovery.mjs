import assert from 'node:assert/strict';
import {
  dispatchCampaign,
  rosterFor,
  civicStatus,
  CIVIC_RECRUITS,
} from '../packages/game/campaign.js';
import { sectorInventoryModel } from '../packages/game/sector-inventory.js';
import { decodeSave, encodeSave } from '../packages/game/save.ts';
import { applyItemQuantity } from '../packages/game/tactical-inventory.js';
import { contractQuote, contractExpiresSeconds } from '../packages/game/contracts.js';
import { collectRouteItems, discoverRouteCache } from './finite-route-equipment.ts';
import {
  prepareRescueClinicGuards,
  restRescuePatients,
  resolveRescueClinicEncounter,
} from './rescue-clinic-readiness.mjs';
import { prepareNorthernHospitalFortification } from './northern-hospital-fortification.mjs';
import { recoverVisibleRouteDressings } from './route-visible-medical-remains.mjs';
import {
  actBattle,
  endTurn,
  hasFirearm,
  canSee,
  hasLineOfSight,
  getReachable,
  artilleryContact,
  interruptAvailable,
  meleePreview,
} from '../packages/game/tactical.js';
import { enterSector } from '../packages/game/world.js';
import { syncBattleTime } from '../packages/game/time.js';
import { autoBandageBattle } from '../packages/game/auto-bandage.js';
import { previewStrategicRoute } from '../packages/game/strategic-route.js';
import {
  canReassignOperative,
  operativeLocation,
  operativeInTransit,
} from '../packages/game/squads.js';
import { hiringArrivalReason } from '../packages/game/hiring-arrivals.js';
import { bookRouteHires } from './paid-route-hiring.ts';
import { recoverRoutePrimary } from './route-owned-equipment.mjs';
import { supplyRouteAmmunition } from './route-ammunition.ts';
import { finishReloadsBeforeMarch } from './pre-march-reload.ts';
import { stageRouteRoofDefenders } from './route-roof-defenders.mjs';
import {
  refreshCordobaClinicReadiness,
  cordobaClinicGroundCrew,
  cordobaClinicDefenseOrder,
} from './cordoba-clinic-combat-readiness.mjs';
import { fightNorthernSector } from './northern-route.mjs';
import { fight as openingFight } from './opening-driver.ts';
import { aidCordobaMedicalRear } from './cordoba-medical-rear-guard.mjs';
import { artilleryProfile } from '../packages/game/artillery-definitions.ts';
import {
  coordinatedHospitalBattery,
  paidHospitalRoofWalkPreview,
} from './coordinated-hospital-battery.mjs';
import { publicRouteView, usefulRouteRifleShot } from './route-infantry-progress.mjs';
import { knownRouteBystanderShotSafety } from './route-fire-safety.ts';
import { recordRouteStrategicEvidence } from './route-strategic-failure-evidence.ts';
import { carriedAmmunition } from '../packages/game/campaign-ammunition.js';
import { ammoCount } from '../packages/game/ammo-types.js';
import { firearmServiceable } from '../packages/game/firearm-serviceability.js';
import { sameCell, sameSurface, spacePoint, surfaceAt } from '../packages/game/tactical-space.js';
import {
  beginRouteControllerBoundaryEvidence,
  recordRouteControllerDecisionEvidence,
} from './route-controller-decision-evidence.ts';

const recoveryClock = (c) => c.hour * 3600 + (c.secondOfHour ?? 0);

// The existing courier visit leaves a real depot behind. Five is the maximum:
// the unchanged Salta route must still quote and pay its sixth rear defender.
// All preparation shares this one original hour, including loading and posts.
export function prepareRescueCordobaRear(start, { courier, report = () => {} } = {}) {
  let c = start;
  const before = structuredClone(start),
    selected = c.activeSquadId,
    deadlineSeconds = recoveryClock(start) + 3600,
    hires = [],
    orders = [],
    equipment = [],
    reloads = [],
    staging = [];
  let rearRoleContext = null;
  const sector = 'cordoba',
    clinical = (r) =>
      ['doctor', 'patient', 'militia_doctor', 'militia_patient'].includes(r.assignment);
  const local = (id) =>
    id !== courier &&
    canReassignOperative(c, id) &&
    !operativeInTransit(c, id) &&
    operativeLocation(c, id) === sector &&
    !c.contracts[id]?.departurePending;
  const rear = () => c.recruited.filter(local),
    fit = (id) => {
      const r = c.operativeState[id];
      return (
        r.alive &&
        !r.captured &&
        r.hp === r.maxHp &&
        !r.bleeding &&
        !r.asleep &&
        r.energy > 10 &&
        !r.routed &&
        !r.surrendered &&
        !clinical(r)
      );
    };
  const initialRear = rear(),
    oldPosts = initialRear.map((id) => ({
      id,
      position: structuredClone(c.operativeState[id].residentPosition ?? null),
      assignment: c.operativeState[id].assignment,
    }));
  const check = () => {
    assert.equal(c.lastError, null);
    assert.equal(c.pendingBattle, null);
    assert.equal(c.pendingEncounter, null, 'An actual encounter stops rear preparation.');
    assert.equal(c.defeated, false);
    assert.ok(
      recoveryClock(c) <= deadlineSeconds,
      'All paid rear work shares the original one-hour visit.',
    );
    assert.ok(rear().length <= 5, 'Leave the real vacancy for the later paid Salta guard.');
  };
  const order = (action) => {
    check();
    c = dispatchCampaign(c, action);
    orders.push(structuredClone(action));
    assert.equal(c.lastError, null, JSON.stringify(action) + ': ' + c.lastError);
    check();
  };
  const people = () => rosterFor(c),
    physicians = () =>
      people().filter(
        (op) =>
          local(op.id) && fit(op.id) && op.medical >= 70 && c.operativeState[op.id].medkits > 0,
      );
  const crew = () =>
    people()
      .filter(
        (op) =>
          local(op.id) && fit(op.id) && op.medical < 60 && c.operativeState[op.id].morale >= 30,
      )
      .sort((a, b) => a.marksmanship - b.marksmanship || a.id - b.id);
  const hire = (predicate) => {
    assert.ok(rear().length < 5, 'No legal rear vacancy remains.');
    assert.equal(hiringArrivalReason(c, sector), null);
    const candidate = people()
      .map((op) => ({ op, r: c.operativeState[op.id], quote: contractQuote(c, op, 'day') }))
      .filter(
        ({ op, r, quote }) =>
          !c.recruited.includes(op.id) &&
          !c.contracts[op.id] &&
          !c.hiringArrivals.some((row) => row.operativeId === op.id) &&
          r.alive &&
          !r.captured &&
          !r.serviceEquipmentReturn &&
          fit(op.id) &&
          civicStatus(c, op.id).available &&
          quote.available &&
          !quote.permanent &&
          quote.total <= c.resources.treasury &&
          predicate(op, r),
      )
      .sort(
        (a, b) =>
          a.quote.total - b.quote.total ||
          a.op.marksmanship - b.op.marksmanship ||
          a.op.id - b.op.id,
      )[0];
    assert.ok(candidate, 'The rear needs an actually quoted affordable immediate local hire.');
    const booked = bookRouteHires(c, [candidate.op.id], {
      term: 'day',
      destination: sector,
      report,
    });
    c = booked.campaign;
    hires.push(...booked.hires);
    check();
    assert.equal(booked.hires[0].arrival.travelHours, 0);
    assert.equal(c.operativeState[candidate.op.id].location, sector);
    assert.ok(c.recruited.includes(candidate.op.id));
    return candidate.op.id;
  };
  try {
    check();
    assert.equal(c.location, sector);
    assert.equal(operativeLocation(c, courier), sector);
    assert.ok(c.squad.includes(courier));
    assert.ok(
      (c.sectorStates[sector]?.artillery ?? []).some(
        (gun) =>
          gun.side === 'player' && (gun.loaded || gun.ammo > 0) && (gun.tacticalLevel ?? 0) === 0,
      ),
      'Use an already discovered actual finite rear cannon.',
    );
    if (!physicians().length) {
      hire((op, r) => op.medical >= 70 && r.medkits > 0);
    }
    while (crew().length < 2) {
      hire((op, r) => op.medical < 60 && r.morale >= 30);
    }
    while (rear().length < 5) {
      hire((op, r) => op.medical < 60 && r.morale >= 30);
    }
    const newIds = hires.map((row) => row.id);
    if (newIds.length) {
      order({ type: 'createSquad', sector, ids: newIds, name: 'Guardia del correo sanitario' });
    }
    const physician = physicians().sort((a, b) => b.medical - a.medical || a.id - b.id)[0];
    assert.ok(physician);
    const prospectiveCrew = crew()
      .slice(0, 2)
      .map((op) => op.id);
    assert.ok(
      oldPosts.every(
        (row) => !prospectiveCrew.includes(row.id) || (row.position?.tacticalLevel ?? 0) === 0,
      ),
      'A new crew cannot borrow an existing roof post.',
    );
    const armed = rear().filter(
      (id) => people().find((op) => op.id === id).medical < 60 && !clinical(c.operativeState[id]),
    );
    for (const id of armed) {
      c = recoverRoutePrimary(c, id, {
        report: (event) => {
          equipment.push(event);
          report(event);
        },
      });
      check();
    }
    c = supplyRouteAmmunition(c, armed, {
      report: (event) => {
        equipment.push(event);
        report(event);
      },
    }).campaign;
    check();
    const fortified = prepareNorthernHospitalFortification(c, { sector, report });
    c = fortified.campaign;
    check();
    const ready = refreshCordobaClinicReadiness(c, courier, {
      deadlineSeconds,
      revalidateGroundCrew: true,
      report,
    });
    c = ready.campaign;
    check();
    assert.equal(ready.receipt.supplied, true);
    assert.equal(
      ready.receipt.crewIds.length,
      2,
      'The existing cannon requires two real current crew contacts.',
    );
    const crewIds = ready.receipt.crewIds,
      newRoof = newIds.filter((id) => !crewIds.includes(id)),
      reservedPositions = oldPosts
        .filter((row) => (row.position?.tacticalLevel ?? 0) > 0)
        .map((row) => ({ id: row.id, ...row.position }));
    const rifles = newRoof.filter((id) => id !== physician.id),
      newPhysician = newRoof.includes(physician.id);
    let retainedRoofRifleId;
    if (newPhysician && !rifles.length) {
      const roster = people();
      retainedRoofRifleId = oldPosts.find((row) => {
        const id = row.id,
          r = c.operativeState[id],
          op = roster.find((op) => op.id === id),
          contract = c.contracts[id];
        if (
          id === courier ||
          crewIds.includes(id) ||
          !armed.includes(id) ||
          !fit(id) ||
          (row.position?.tacticalLevel ?? 0) <= 0 ||
          r.residentSector !== sector ||
          (r.residentScene ?? null) !== null ||
          !sameCell(r.residentPosition, row.position) ||
          !contract ||
          contract.departurePending ||
          (contractExpiresSeconds(contract) !== null &&
            contractExpiresSeconds(contract) <= recoveryClock(c))
        ) {
          return false;
        }
        const load = carriedAmmunition(op, r);
        return (
          hasFirearm(load) &&
          firearmServiceable(load) &&
          !load.jammed &&
          load.loaded + ammoCount(load) > 0
        );
      })?.id;
    }
    if (process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR) {
      rearRoleContext = {
        initialRear,
        oldPosts,
        newIds,
        crewIds,
        prospectiveCrew,
        armed,
        physician,
        rifles,
        newRoof,
        newPhysician,
        retainedRoofRifleId,
      };
    }
    if (newPhysician) {
      assert.ok(
        rifles.length || retainedRoofRifleId !== undefined,
        'The supplied clinician needs one actual rifle neighbor.',
      );
    }
    for (const home of c.squads.filter(
      (q) => q.location === sector && !q.journey && q.members.some((id) => newIds.includes(id)),
    )) {
      order({ type: 'selectSquad', id: home.id });
      c = finishReloadsBeforeMarch(c, {
        deadlineSeconds,
        report: (event) => {
          reloads.push(event);
          report(event);
        },
      });
      check();
    }
    if (newRoof.length) {
      const posted = stageRouteRoofDefenders(c, newRoof, {
        bounded: { deadlineSeconds },
        reservedPositions,
        ...(newPhysician
          ? {
              physicianId: physician.id,
              ...(retainedRoofRifleId === undefined
                ? { landingGuardIds: rifles }
                : { retainedRoofRifleId }),
            }
          : {}),
        report,
      });
      c = posted.campaign;
      staging.push(posted.receipt);
      check();
    }
    // The last home visit can change real occupancy. Revalidate the same finite
    // cannon after that visit before allowing the unchanged courier return.
    const final = refreshCordobaClinicReadiness(c, courier, {
      deadlineSeconds,
      revalidateGroundCrew: true,
      report,
    });
    c = final.campaign;
    check();
    assert.equal(final.receipt.supplied, true);
    assert.equal(final.receipt.crewIds.length, 2);
    assert.equal(cordobaClinicGroundCrew(c).length, 2);
    for (const operativeId of newIds) {
      order({ type: 'assignCare', operativeId, assignment: 'rest' });
    }
    if (c.activeSquadId !== selected) {
      order({ type: 'selectSquad', id: selected });
    }
    for (const row of oldPosts) {
      if ((row.position?.tacticalLevel ?? 0) > 0) {
        assert.deepEqual(c.operativeState[row.id].residentPosition, row.position);
      }
      assert.equal(c.operativeState[row.id].assignment, row.assignment);
    }
    for (const [id, r] of Object.entries(before.operativeState)) {
      assert.equal(c.operativeState[id].alive, r.alive);
      assert.equal(c.operativeState[id].captured, r.captured);
      if (!r.alive) {
        assert.equal(c.operativeState[id].deathMinute, r.deathMinute);
      }
    }
    const receipt = {
      sector,
      courier,
      initialRear,
      rear: rear(),
      newIds,
      hires,
      orders,
      equipment,
      reloads,
      fortification: fortified.receipt,
      readiness: ready.receipt,
      staging,
      finalReadiness: final.receipt,
      deadlineSeconds,
      startSeconds: recoveryClock(start),
      endSeconds: recoveryClock(c),
      treasuryBefore: start.resources.treasury,
      treasuryAfter: c.resources.treasury,
    };
    assert.equal(c.squad.includes(courier), true);
    assert.deepEqual(start, before);
    assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
    report({ event: 'rescueCordobaRearPrepared', receipt });
    return { campaign: c, receipt };
  } catch (error) {
    if (error && typeof error === 'object') {
      error.campaign ??= c;
      error.rescueCordobaRear = {
        courier,
        deadlineSeconds,
        hires,
        orders,
        equipment,
        reloads,
        staging,
        startSeconds: recoveryClock(start),
        endSeconds: recoveryClock(c),
      };
    }
    recordRouteStrategicEvidence({
      helper: 'prepareRescueCordobaRear',
      stage: 'preparation-failure',
      campaign: c,
      context: rearRoleContext ?? { initialRear, oldPosts },
      error,
    });
    throw error;
  }
}

// The exact complete initial nonclinical crew uses one existing coordinator.
// Its Native aid, payable gun work and useful rifle posture keep their order.
// Do not run the ordinary unconditional prone rise before that crew hold.
// Other roles retain that policy except the supplied roof physician's
// current close-threat escape below.
export function rescueCordobaDefenseController(initial, ordinary = cordobaClinicDefenseOrder) {
  const coordinated = coordinatedHospitalBattery(initial);
  const crews = coordinated.roles.crews.filter(
    (crew) =>
      crew.ids.length ===
        artilleryProfile(
          initial,
          initial.artillery.find((gun) => gun.id === crew.gunId),
        ).crew &&
      crew.ids.every((id) => {
        const member = initial.units.find((unit) => unit.id === id);
        return (
          member.medical < 60 &&
          !['doctor', 'patient', 'militia_doctor', 'militia_patient'].includes(member.assignment)
        );
      }),
  );
  const crewIds = new Set(crews.flatMap((crew) => crew.ids));
  const fit = (u) =>
    u?.hp >= 15 &&
    !u.routed &&
    !u.unconscious &&
    !u.departure &&
    !u.fled &&
    !u.surrendered &&
    !u.asleep &&
    !u.captured;
  const roofPhysicians = new Set(
    initial.units
      .filter(
        (u) =>
          u.side === 'player' &&
          fit(u) &&
          !crewIds.has(u.id) &&
          (u.tacticalLevel ?? 0) > 0 &&
          u.medical >= 60 &&
          u.medkits > 0,
      )
      .map((u) => u.id),
  );
  const clinical = (u) =>
    ['doctor', 'patient', 'militia_doctor', 'militia_patient'].includes(u.assignment);
  const held = new Set([
    coordinated.roles.physicianId,
    ...coordinated.roles.crews.flatMap((crew) => crew.ids),
  ]);
  const roofRifles = new Set(
    initial.units
      .filter(
        (u) =>
          u.side === 'player' &&
          fit(u) &&
          !u.militia &&
          !u.missionAlly &&
          !u.mounted &&
          !held.has(u.id) &&
          (u.tacticalLevel ?? 0) > 0 &&
          u.medical < 60 &&
          !clinical(u) &&
          u.loaded > 0 &&
          hasFirearm(u) &&
          !u.weaponDropped &&
          firearmServiceable(u),
      )
      .map((u) => u.id),
  );
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    safeShot = { shotSafety: knownRouteBystanderShotSafety };
  let roofDecisionRecorded = false;
  return (battle, unit) => {
    if (crewIds.has(unit.id)) {
      return coordinated.controller(battle, unit);
    }
    const normal = ordinary(battle, unit);
    // Only an initial nonclinical roof rifle may fill an ordinary hold with
    // the existing paid same-cover useful-shot leaf. Non-null work stays exact.
    if (
      ordinary === cordobaClinicDefenseOrder &&
      normal == null &&
      roofRifles.has(unit.id) &&
      fit(unit) &&
      (unit.tacticalLevel ?? 0) > 0 &&
      unit.medical < 60 &&
      !clinical(unit) &&
      !battle.artillery.some(
        (gun) =>
          gun.side === unit.side &&
          (gun.loaded || gun.ammo > 0) &&
          artilleryContact(battle, unit, gun),
      )
    ) {
      const approach = coordinated.controller(battle, unit);
      if (process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR && !roofDecisionRecorded) {
        roofDecisionRecorded = true;
        const returned = approach?.type === 'move' ? approach : normal,
          kind = (value) =>
            value === null
              ? 'null'
              : value === undefined
                ? 'undefined'
                : (value.type ?? typeof value);
        recordRouteControllerDecisionEvidence({
          battle,
          unit,
          decision: {
            ordinary: normal,
            coordinator: approach,
            returned,
            ordinaryResultKind: kind(normal),
            coordinatorResultKind: kind(approach),
            returnedResultKind: kind(returned),
            roles: coordinated.roles,
            initialRoofRifleIds: [...roofRifles],
            initialRoofPhysicianIds: [...roofPhysicians],
            initialNonclinicalCrewIds: [...crewIds],
          },
        });
      }
      return approach?.type === 'move' ? approach : normal;
    }
    if (
      !roofPhysicians.has(unit.id) ||
      !fit(unit) ||
      !(unit.medkits > 0) ||
      (unit.tacticalLevel ?? 0) <= 0 ||
      battle.mode !== 'combat' ||
      !interruptAvailable(battle, unit) ||
      unit.knockedDown ||
      unit.entangled
    ) {
      return normal;
    }
    const view = publicRouteView(battle, unit),
      contacts = view.units.filter(
        (other) =>
          other.side !== unit.side &&
          fit(other) &&
          sameSurface(unit, other) &&
          canSee(view, unit, other),
      );
    const close = contacts.filter((other) => distance(unit, other) <= 2.5);
    if (!close.length) {
      return normal;
    }
    // Adjacent finite aid and an immediately useful safe defence remain first.
    if (normal?.type === 'useItem' || (normal?.type === 'weapon' && normal.slot === 'medical')) {
      return normal;
    }
    const shot = usefulRouteRifleShot(view, unit, safeShot);
    if (shot) {
      return shot;
    }
    const target =
      normal?.type === 'melee' && view.units.find((other) => other.id === normal.targetId);
    if (target && canSee(view, unit, target) && meleePreview(view, unit, target).valid) {
      return normal;
    }
    // A supplied roof physician may leave a close threat before optional
    // maintenance. This call-specific bound does not change other move caps.
    // Keep every friendly body and current public obstruction in the quote;
    // actual Native movement still owns hidden obstruction and reaction fire.
    if (
      view.artillery.some(
        (gun) =>
          gun.side === unit.side &&
          (gun.loaded || gun.ammo > 0) &&
          artilleryContact(view, unit, gun),
      )
    ) {
      return normal;
    }
    const cover = surfaceAt(view, unit)?.cover ?? 0,
      nearest = (point) => Math.min(...close.map((other) => distance(point, other)));
    const safe = (point) =>
      sameSurface(point, unit) &&
      Boolean(surfaceAt(view, point)) &&
      (surfaceAt(view, point).cover ?? 0) >= cover &&
      contacts.every(
        (other) =>
          distance(point, other) >= distance(unit, other) &&
          (!hasLineOfSight(view, other, { ...unit, ...spacePoint(point) }) ||
            hasLineOfSight(view, other, unit)),
      );
    const paths = getReachable(view, unit)
      .filter(
        (point) =>
          point.cost > 0 &&
          point.cost <= Math.min(24, unit.ap) &&
          point.path.length <= 3 &&
          nearest(point) > nearest(unit) &&
          point.path.every(
            (step) => (step.kind === undefined || step.kind === 'move') && safe(step),
          ),
      )
      .sort((a, b) => nearest(b) - nearest(a) || a.cost - b.cost || a.y - b.y || a.x - b.x);
    for (const point of paths) {
      const paid = paidHospitalRoofWalkPreview(view, unit, point);
      if (paid) {
        return { type: 'move', unitId: unit.id, ...spacePoint(point) };
      }
    }
    return normal;
  };
}

// Treatment in Tucumán can admit a different real rear raid. Use the actual
// sector and actual local force; only a successful Native settlement restores
// the selected courier. The original Tucumán policy stays exact.
export function resolveRescueRecoveryEncounter(
  start,
  { report = () => {}, onCheckpoint = () => {} } = {},
) {
  if (start.pendingEncounter?.sector === 'tucuman') {
    return resolveRescueClinicEncounter(start, { report, onCheckpoint });
  }
  const before = structuredClone(start),
    encounter = structuredClone(start.pendingEncounter),
    selected = start.activeSquadId;
  assert.equal(
    encounter?.sector,
    'cordoba',
    'Recovery cannot bypass an unrelated actual encounter.',
  );
  let c = start;
  const home = c.squads.find(
    (q) =>
      q.location === 'cordoba' &&
      !q.journey &&
      q.members.some(
        (id) =>
          c.recruited.includes(id) && c.operativeState[id].alive && !c.operativeState[id].captured,
      ),
  );
  assert.ok(home, 'The actual rear force needs a living local home.');
  c = dispatchCampaign(c, { type: 'selectSquad', id: home.id });
  assert.equal(c.lastError, null);
  c = dispatchCampaign(c, {
    type: 'respondToEncounter',
    groupId: encounter.groupId,
    choice: 'tactical',
  });
  assert.equal(c.lastError, null);
  let actual = null;
  const executeBattle = (request, previous, options) => {
    const initial = enterSector(request, previous),
      controller = rescueCordobaDefenseController(initial, options.controller);
    const observeOrder = process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR
      ? beginRouteControllerBoundaryEvidence({
          initial,
          fieldPhysicianIds: initial.units
            .filter((unit) => unit.side === 'player' && unit.medical >= 60 && unit.medkits > 0)
            .map((unit) => unit.id),
          existingSynchronizationCompleted: false,
        })
      : null;
    let orderIndex = 0;
    const executeOrder = observeOrder
      ? (current, action) => {
          const next = action.type === 'endTurn' ? endTurn(current) : actBattle(current, action);
          if (next.lastError === null) {
            observeOrder({ before: current, after: next, action, index: orderIndex });
          }
          orderIndex++;
          return next;
        }
      : undefined;
    const result = openingFight(request, previous, {
      ...options,
      controller,
      ...(observeOrder ? { executeOrder } : {}),
    });
    actual ??= result;
    return result;
  };
  const request = c.pendingBattle,
    result = fightNorthernSector(c, 'cordoba', {
      report,
      controller: cordobaClinicDefenseOrder,
      beforeSettlement: aidCordobaMedicalRear,
      executeBattle,
    });
  c = result.campaign;
  for (const unit of request.squad) {
    const id = Number(unit.id),
      r = c.operativeState[id];
    if (r.alive && !r.captured && operativeLocation(c, id) === 'cordoba') {
      c = dispatchCampaign(c, { type: 'assignCare', operativeId: id, assignment: 'rest' });
      assert.equal(c.lastError, null);
    }
  }
  if (c.activeSquadId !== selected) {
    c = dispatchCampaign(c, { type: 'selectSquad', id: selected });
    assert.equal(c.lastError, null);
  }
  const evidence = {
    event: 'rescueCordobaRearDefense',
    sector: encounter.sector,
    groupId: encounter.groupId,
    status: 'victory',
    exactNativeReplay: true,
    ...result.summary,
    orders: structuredClone(actual.orders),
    artilleryBefore: structuredClone(request.artillery),
    artilleryAfter: structuredClone(c.sectorStates.cordoba.artillery),
    medkitsBefore: request.squad.reduce((n, u) => n + (u.medkits ?? 0), 0),
    medkitsAfter: result.summary.beforeSettlement.units.reduce((n, u) => n + (u.medkits ?? 0), 0),
  };
  assert.equal(c.pendingEncounter, null);
  assert.equal(c.pendingBattle, null);
  assert.equal(c.sectors.cordoba.owner, 'patriot');
  assert.equal(c.activeSquadId, selected);
  assert.deepEqual(start, before);
  report(evidence);
  onCheckpoint('rescue-cordoba-rear-defense', c, evidence);
  return { campaign: c, evidence };
}

// Buy the existing local defenses before roof staging or public collection
// advances the clinic clock. Keep the paid fortification and free staging
// receipts separate; later quotes use the actually debited treasury.
export function prepareRescueClinicDefense(start, { courier, report = () => {} } = {}) {
  const fortified = prepareNorthernHospitalFortification(start, { sector: 'tucuman', report });
  const prepared = prepareRescueClinicGuards(fortified.campaign, { courier, report });
  return { ...prepared, fortification: fortified.receipt };
}

// Public inspection can finish with a raid waiting at the real scene exit.
// Resolve that actual encounter before trying to transfer the recovered stock.
export function handoverRescueClinicDressings(
  start,
  {
    courier,
    collected,
    report = () => {},
    onCheckpoint = () => {},
    resolveEncounter = resolveRescueClinicEncounter,
  } = {},
) {
  let campaign = start,
    defense = null,
    handover = null;
  try {
    assert.equal(campaign.lastError, null);
    assert.equal(campaign.pendingBattle, null);
    assert.ok(Number.isSafeInteger(collected) && collected >= 0);
    if (campaign.pendingEncounter) {
      const resolved = resolveEncounter(campaign, { report, onCheckpoint });
      campaign = resolved.campaign;
      defense = resolved.evidence;
      assert.equal(campaign.lastError, null);
    }
    assert.equal(
      campaign.pendingEncounter,
      null,
      'settle the actual clinic encounter before transferring dressings',
    );
    assert.equal(campaign.pendingBattle, null);
    if (collected) {
      handover = {
        type: 'sectorInventory',
        sector: 'tucuman',
        operativeId: courier,
        direction: 'drop',
        item: 'medkits',
        count: collected,
      };
      campaign = dispatchCampaign(campaign, handover);
      assert.equal(campaign.lastError, null, JSON.stringify(handover) + ': ' + campaign.lastError);
    }
    return { campaign, defense, handover, donated: collected };
  } catch (error) {
    // Raw references only. A resolver owns its internal Native result; do not
    // replace that result or perform a query after its original error.
    try {
      if (error && typeof error === 'object') {
        error.rescueClinicHandover = { campaign, courier, collected, defense, handover };
      }
    } catch {}
    throw error;
  }
}

export function recoverRescueForce(
  start,
  { patients, report = () => {}, onCheckpoint = () => {} } = {},
) {
  let campaign = decodeSave(encodeSave(start)).campaign;
  const events = [],
    orders = [],
    rearPhysicians = [],
    courierLegs = [],
    startHour = campaign.hour;
  assert.ok(patients?.length, 'recover the actual released prisoners');
  const order = (action) => {
    const next = dispatchCampaign(campaign, action);
    assert.equal(next.lastError, null, JSON.stringify(action) + ': ' + next.lastError);
    campaign = next;
    events.push({ action, hour: campaign.hour, second: campaign.secondOfHour ?? 0 });
    orders.push({ scope: 'campaign', action });
  };
  const seconds = () => campaign.hour * 3600 + (campaign.secondOfHour ?? 0);
  const renew = (buffer, ids = campaign.recruited) => {
    for (const id of ids) {
      const r = campaign.operativeState[id];
      let contract = campaign.contracts[id];
      while (
        r.alive &&
        !r.captured &&
        contractExpiresSeconds(contract) !== null &&
        contractExpiresSeconds(contract) <= seconds() + buffer * 3600
      ) {
        const cash = campaign.resources.treasury;
        order({
          type: 'renewContract',
          id,
          term: 'day',
          expectedExpiresAt: contract.expiresAt,
          expectedExpiresSecond: contract.expiresSecond ?? 0,
        });
        assert.ok(campaign.resources.treasury < cash);
        contract = campaign.contracts[id];
      }
    }
  };
  const routeTo = (destination) => {
    const quote = previewStrategicRoute(campaign, campaign.activeSquadId, destination, 'march');
    assert.equal(quote.valid, true, quote.reason);
    return quote;
  };
  // A routed surgeon remains at the actual rear province. Recover that serving
  // physician before paying for another hire or advancing a long courier march.
  const qualifiedHere = () =>
    rosterFor(campaign).filter((op) => {
      const r = campaign.operativeState[op.id];
      return (
        campaign.recruited.includes(op.id) &&
        r.alive &&
        !r.captured &&
        !patients.includes(op.id) &&
        r.location === 'tucuman' &&
        r.hp >= 15 &&
        op.medical >= 70
      );
    });
  const rear = rosterFor(campaign)
    .filter((op) => {
      const r = campaign.operativeState[op.id];
      return (
        campaign.recruited.includes(op.id) &&
        r.alive &&
        !r.captured &&
        !patients.includes(op.id) &&
        r.location === 'cordoba' &&
        r.hp >= 15 &&
        !r.asleep &&
        r.energy > 10 &&
        op.medical >= 70
      );
    })
    .sort((a, b) => b.medical - a.medical || a.id - b.id);
  for (const physician of rear) {
    if (qualifiedHere().length >= 2) {
      break;
    }
    const operativeId = physician.id,
      previous = campaign.activeSquadId,
      firstOrder = orders.length,
      departureSeconds = campaign.hour * 3600 + (campaign.secondOfHour ?? 0),
      sourceSector = campaign.operativeState[operativeId].location;
    assert.equal(campaign.sectors[sourceSector].owner, 'patriot');
    assert.equal(campaign.pendingEncounter, null);
    order({
      type: 'createSquad',
      ids: [operativeId],
      name: 'Enlace sanitario',
      sector: sourceSector,
    });
    order({ type: 'assignCare', operativeId, assignment: 'active' });
    let sourceTake = null;
    const aidSteps = [];
    let aidElapsedSeconds = 0;
    if (campaign.operativeState[operativeId].bleeding) {
      if (!campaign.operativeState[operativeId].medkits) {
        const model = sectorInventoryModel(
            campaign,
            sourceSector,
            rosterFor(campaign),
            operativeId,
          ),
          row = model.entries.find(
            (row) => row.reachable && JSON.parse(row.expected).item === 'medkits',
          );
        assert.ok(row, 'the serving rear physician needs one real reachable dressing');
        const carried = campaign.operativeState[operativeId].medkits,
          pool = model.entries
            .filter((row) => JSON.parse(row.expected).item === 'medkits')
            .reduce((sum, row) => sum + row.count, 0),
          cash = campaign.resources.treasury,
          seconds = campaign.hour * 3600 + (campaign.secondOfHour ?? 0);
        order({
          type: 'sectorInventory',
          sector: sourceSector,
          operativeId,
          direction: 'take',
          sourceKey: row.key,
          expected: row.expected,
          count: 1,
        });
        const after = sectorInventoryModel(
            campaign,
            sourceSector,
            rosterFor(campaign),
            operativeId,
          ),
          poolAfter = after.entries
            .filter((row) => JSON.parse(row.expected).item === 'medkits')
            .reduce((sum, row) => sum + row.count, 0);
        assert.equal(poolAfter, pool - 1);
        assert.equal(campaign.operativeState[operativeId].medkits, carried + 1);
        assert.equal(campaign.resources.treasury, cash);
        assert.equal(campaign.hour * 3600 + (campaign.secondOfHour ?? 0), seconds);
        sourceTake = {
          action: orders.at(-1).action,
          medicalPoolBefore: pool,
          medicalPoolAfter: poolAfter,
          carriedBefore: carried,
          carriedAfter: carried + 1,
        };
      }
      order({ type: 'visitSector' });
      let battle = enterSector(
        {
          ...campaign.pendingBattle,
          hour: campaign.hour,
          secondOfHour: campaign.secondOfHour ?? 0,
        },
        campaign.sectorStates[sourceSector],
      );
      const aid = autoBandageBattle(battle);
      assert.ok(aid.steps.length, 'the actual rear physician must perform ordinary self aid');
      for (let i = 0; i < aid.steps.length; i++) {
        battle = actBattle(battle, aid.steps[i]);
        assert.equal(battle.lastError, null);
        const paid = syncBattleTime(campaign, battle);
        assert.equal(paid.error, null);
        campaign = paid.campaign;
        battle = paid.battle;
        orders.push({ scope: 'tactical', action: aid.steps[i] });
        aidSteps.push(aid.steps[i]);
        if (i === Math.floor((aid.steps.length - 1) / 2)) {
          ({ campaign, battle } = decodeSave(encodeSave(campaign, battle)));
        }
        const unit = battle.units.find((unit) => unit.id === String(operativeId));
        if (unit.hp >= 15 && !unit.bleeding) {
          break;
        }
      }
      const unit = battle.units.find((unit) => unit.id === String(operativeId));
      assert.ok(unit.hp >= 15);
      assert.equal(unit.bleeding, 0);
      aidElapsedSeconds = battle.elapsedSeconds ?? 0;
      order({
        type: 'leaveSector',
        battleId: campaign.pendingBattle.id,
        sectorState: battle,
        survivors: battle.units.filter((unit) => unit.side === 'player'),
      });
    }
    const marchQuote = routeTo('tucuman');
    renew(marchQuote.hours + 1, [operativeId]);
    const marchStartSeconds = seconds();
    order(marchQuote.action);
    for (
      let requests = 0;
      requests < 48 &&
      (campaign.location !== 'tucuman' ||
        campaign.squads.find((q) => q.id === campaign.activeSquadId).journey);
      requests++
    ) {
      assert.equal(
        campaign.pendingEncounter,
        null,
        'physician travel cannot bypass an actual encounter',
      );
      order({ type: 'wait', hours: 1 });
    }
    assert.equal(campaign.location, 'tucuman');
    assert.ok(!campaign.squads.find((q) => q.id === campaign.activeSquadId).journey);
    assert.equal(seconds() - marchStartSeconds, marchQuote.hours * 3600);
    assert.ok(campaign.recruited.includes(operativeId));
    assert.equal(campaign.operativeState[operativeId].location, 'tucuman');
    assert.equal(campaign.operativeState[operativeId].bleeding, 0);
    order({ type: 'selectSquad', id: previous });
    const receipt = {
      id: operativeId,
      sourceSector,
      arrivalSector: 'tucuman',
      sourceTake,
      aidSteps,
      aidElapsedSeconds,
      marchQuote,
      marchElapsedSeconds: seconds() - marchStartSeconds,
      elapsedSeconds: seconds() - departureSeconds,
      orders: orders.slice(firstOrder),
    };
    rearPhysicians.push(receipt);
    report({ event: 'rearPhysicianArrived', ...receipt });
    onCheckpoint('rear-physician-arrived', campaign, receipt);
  }
  const courierStartHour = campaign.hour;
  // A rescue may cost the force its surgeons. Replace them through ordinary
  // paid contracts before asking lightly trained survivors to treat every wound.
  const eligible = (op) => {
    const r = campaign.operativeState[op.id];
    return (
      campaign.recruited.includes(op.id) &&
      r.alive &&
      !r.captured &&
      r.location === 'tucuman' &&
      r.hp >= 15 &&
      !patients.includes(op.id)
    );
  };
  const qualified = rosterFor(campaign).filter((op) => eligible(op) && op.medical >= 70),
    hiredDoctors = [],
    hiringCash = campaign.resources.treasury;
  const candidates = CIVIC_RECRUITS.filter(
    (op) =>
      op.medical >= 70 &&
      !campaign.recruited.includes(op.id) &&
      contractQuote(campaign, op, 'week').available &&
      contractQuote(campaign, op, 'week').price <= campaign.resources.treasury,
  ).sort(
    (a, b) =>
      contractQuote(campaign, a, 'week').price - contractQuote(campaign, b, 'week').price ||
      b.medical - a.medical ||
      a.id - b.id,
  );
  for (const doctor of candidates) {
    if (qualified.length + hiredDoctors.length >= 2) {
      break;
    }
    order({ type: 'recruitCivic', id: doctor.id, term: 'week' });
    hiredDoctors.push(doctor.id);
  }
  assert.ok(
    qualified.length + hiredDoctors.length >= 2,
    'two living qualified physicians are available on paid contracts',
  );
  const hiringCost = hiringCash - campaign.resources.treasury;
  assert.equal(
    hiringCost,
    hiredDoctors.reduce((sum, id) => sum + campaign.contracts[id].paid, 0),
  );
  const dead = campaign.recruited.filter((id) => !campaign.operativeState[id].alive),
    roster = rosterFor(campaign);
  const local = roster.filter((op) => {
    const r = campaign.operativeState[op.id];
    return (
      campaign.recruited.includes(op.id) &&
      r.alive &&
      !r.captured &&
      r.location === 'tucuman' &&
      r.hp >= 15 &&
      !patients.includes(op.id)
    );
  });
  const doctors = local
    .filter((op) => op.medical >= 20)
    .sort((a, b) => b.medical - a.medical)
    .slice(0, 2)
    .map((op) => op.id);
  assert.equal(doctors.length, 2, 'two actual doctors provide recovery');
  const courier = local
    .filter((op) => !doctors.includes(op.id) && campaign.operativeState[op.id].energy > 10)
    .sort((a, b) => a.medical - b.medical)[0]?.id;
  assert.ok(courier, 'a living local reserve carries the supplies');
  const [firstDoctor, secondDoctor] = doctors,
    firstPatient = patients[0];
  const courierTravel = (destination) => {
    restCourier();
    const quote = routeTo(destination);
    renew(quote.hours + 1);
    const departureSeconds = seconds();
    onCheckpoint('courier-departure-' + destination, campaign, { quote, doctors, courier });
    order({ ...quote.action, queue: false });
    assert.equal(campaign.location, destination);
    assert.equal(campaign.pendingEncounter, null);
    assert.equal(seconds() - departureSeconds, quote.hours * 3600);
    assert.ok(
      [courier, ...doctors].every((id) => campaign.recruited.includes(id)),
      'the courier and both physicians retain actual paid service through the quoted march',
    );
    courierLegs.push({ destination, quote, departureSeconds, arrivalSeconds: seconds() });
  };
  // Each long march starts after ordinary local rest. Merely being awake above
  // the exhaustion threshold is insufficient for the full quoted return leg.
  const restCourier = () => {
    const needsRest = () =>
      campaign.operativeState[courier].asleep ||
      campaign.operativeState[courier].energy < 100 ||
      campaign.operativeState[courier].fatigue > 0;
    if (!needsRest()) {
      return;
    }
    order({ type: 'assignCare', operativeId: courier, assignment: 'rest' });
    for (let requests = 0; requests < 48 && needsRest(); requests++) {
      assert.equal(
        campaign.pendingEncounter,
        null,
        'courier rest cannot bypass an actual encounter',
      );
      if (
        campaign.operativeState[courier].asleep &&
        campaign.operativeState[courier].energy >= 100
      ) {
        order({ type: 'setSleep', operativeId: courier, asleep: false });
      }
      if (!needsRest()) {
        break;
      }
      renew(2);
      order({ type: 'wait', hours: 1 });
    }
    assert.equal(campaign.operativeState[courier].asleep, false);
    assert.equal(campaign.operativeState[courier].energy, 100);
    assert.equal(campaign.operativeState[courier].fatigue, 0);
    order({ type: 'assignCare', operativeId: courier, assignment: 'active' });
  };
  const model = (id) => sectorInventoryModel(campaign, 'tucuman', rosterFor(campaign), id);
  let recovered = 0,
    donated = 0,
    medicalRemains = null,
    guardPreparation = null,
    rearPreparation = null,
    restRecovery = null;
  const collectionDefenses = [];
  const prepareClinic = () => {
    if (guardPreparation) {
      return;
    }
    const prepared = prepareRescueClinicDefense(campaign, { courier, report });
    campaign = prepared.campaign;
    guardPreparation = { ...prepared.evidence, fortification: prepared.fortification };
    onCheckpoint('rescue-clinic-prepared', campaign, guardPreparation);
  };
  const gather = (id, limit = 1000000) => {
    let taken = 0;
    while (taken < limit) {
      const before = model(id),
        row = before.entries.find((r) => r.reachable && JSON.parse(r.expected).item === 'medkits');
      if (!row) {
        break;
      }
      let count = Math.min(row.count, limit - taken);
      if (!count) {
        break;
      }
      const stack = JSON.parse(row.expected),
        actor = before.personal,
        pool = before.entries
          .filter((r) => JSON.parse(r.expected).item === 'medkits')
          .reduce((sum, r) => sum + r.count, 0),
        carried = campaign.operativeState[id].medkits;
      while (count) {
        try {
          applyItemQuantity(actor, { ...stack, count });
          break;
        } catch (error) {
          assert.match(error.message, /espacio en el inventario/);
          count--;
        }
      }
      if (!count) {
        break;
      }
      order({
        type: 'sectorInventory',
        sector: 'tucuman',
        operativeId: id,
        direction: 'take',
        sourceKey: row.key,
        expected: row.expected,
        count,
      });
      taken += count;
      const after = model(id);
      assert.equal(
        after.entries
          .filter((r) => JSON.parse(r.expected).item === 'medkits')
          .reduce((sum, r) => sum + r.count, 0),
        pool - count,
      );
      assert.equal(campaign.operativeState[id].medkits, carried + count);
      if (count < row.count) {
        assert.equal(
          after.entries.find(
            (entry) => entry.key === row.key && JSON.parse(entry.expected).item === 'medkits',
          )?.count,
          row.count - count,
        );
      }
    }
    return taken;
  };
  assert.equal(campaign.location, 'tucuman');
  assert.equal(campaign.pendingBattle, null);
  for (const operativeId of [...local.map((op) => op.id), ...patients]) {
    order({ type: 'assignCare', operativeId, assignment: 'rest' });
  }
  recovered += gather(firstDoctor);
  if (!campaign.operativeState[firstDoctor].medkits) {
    const found = collectRouteItems(campaign, firstDoctor, { item: 'medkits' }, 6);
    campaign = found.campaign;
    recovered += found.collected;
  }
  const firstPatientHp = campaign.operativeState[firstPatient].hp,
    initialDressings = campaign.operativeState[firstDoctor].medkits;
  assert.ok(initialDressings > 0, 'the doctor needs actual carried or recovered supplies');
  order({ type: 'assignCare', operativeId: firstPatient, assignment: 'patient' });
  order({ type: 'assignCare', operativeId: firstDoctor, assignment: 'doctor' });
  order({ type: 'createSquad', name: 'Correo sanitario', ids: [courier] });
  order({ type: 'assignCare', operativeId: courier, assignment: 'active' });
  courierTravel('cordoba');
  restCourier();
  assert.ok(
    campaign.operativeState[firstPatient].hp > firstPatientHp,
    'the available supplies improve the first patient while the courier travels',
  );
  assert.ok(
    campaign.operativeState[firstDoctor].medkits < initialDressings,
    'the initial treatment consumes actual carried or recovered dressings',
  );
  order({ type: 'assignCare', operativeId: firstDoctor, assignment: 'rest' });
  for (const item of ['torches', 'boleadoras']) {
    const count = campaign.operativeState[courier][item];
    if (count) {
      order({
        type: 'sectorInventory',
        sector: 'cordoba',
        operativeId: courier,
        direction: 'drop',
        item,
        count,
      });
    }
  }
  const cash = campaign.resources.treasury,
    carried = campaign.operativeState[courier].medkits,
    found = collectRouteItems(campaign, courier, { item: 'medkits' }, 13);
  campaign = found.campaign;
  const foundDressings = found.collected,
    boughtDressings = 0,
    cost = 0,
    unitPrice = 0;
  assert.equal(campaign.operativeState[courier].medkits, carried + foundDressings);
  assert.equal(campaign.resources.treasury, cash);
  const rearReady = prepareRescueCordobaRear(campaign, { courier, report });
  campaign = rearReady.campaign;
  rearPreparation = rearReady.receipt;
  onCheckpoint('rescue-cordoba-rear-prepared', campaign, rearPreparation);
  courierTravel('tucuman');
  restCourier();
  order({
    type: 'sectorInventory',
    sector: 'tucuman',
    operativeId: courier,
    direction: 'drop',
    item: 'medkits',
    count: foundDressings,
  });
  const firstShare = Math.ceil(foundDressings / 2),
    secondShare = foundDressings - firstShare;
  assert.equal(gather(firstDoctor, firstShare), firstShare);
  assert.equal(secondShare ? gather(secondDoctor, secondShare) : 0, secondShare);
  for (const operativeId of patients) {
    order({ type: 'assignCare', operativeId, assignment: 'patient' });
  }
  for (const operativeId of doctors) {
    order({ type: 'assignCare', operativeId, assignment: 'doctor' });
  }
  report({
    event: 'medicalCourierReturned',
    hour: campaign.hour,
    boughtDressings,
    foundDressings,
    cost,
    unitPrice,
    recoveredDressings: recovered,
  });
  // A normal treatment tick can admit the same real raid as a body search.
  // Prepare before that clock advances and use the existing strict resolver
  // before another care order, without inventing a dressing handover.
  prepareClinic();
  for (
    let i = 0;
    (patients.some((id) => campaign.operativeState[id].hp < campaign.operativeState[id].maxHp) ||
      campaign.pendingEncounter) &&
    i < 80;
    i++
  ) {
    if (campaign.pendingEncounter) {
      const resolved = handoverRescueClinicDressings(campaign, {
        courier,
        collected: 0,
        report,
        onCheckpoint,
        resolveEncounter: resolveRescueRecoveryEncounter,
      });
      campaign = resolved.campaign;
      if (resolved.defense) {
        collectionDefenses.push(resolved.defense);
      }
    }
    if (
      patients.every((id) => campaign.operativeState[id].hp === campaign.operativeState[id].maxHp)
    ) {
      break;
    }
    assert.equal(
      campaign.pendingEncounter,
      null,
      'resolve an actual encounter before continuing treatment',
    );
    renew(2);
    // Replenish before spending the physician's final real emergency stroke.
    // The existing sources, carrying limits and genuine raid remain authoritative.
    for (const id of doctors) {
      if (campaign.operativeState[id].medkits <= 1) {
        report({
          event: 'rescueClinicDressingReserve',
          id,
          carried: campaign.operativeState[id].medkits,
          reserve: 1,
          hour: campaign.hour,
          secondOfHour: campaign.secondOfHour ?? 0,
        });
        let count = gather(id);
        if (!count) {
          const donor = rosterFor(campaign).find(
            (op) =>
              !doctors.includes(op.id) &&
              model(op.id).operativeId === op.id &&
              !model(op.id).reason &&
              campaign.operativeState[op.id].medkits > 0,
          );
          if (donor) {
            const quantity = campaign.operativeState[donor.id].medkits;
            order({
              type: 'sectorInventory',
              sector: 'tucuman',
              operativeId: donor.id,
              direction: 'drop',
              item: 'medkits',
              count: quantity,
            });
            donated += quantity;
            count = gather(id);
          } else {
            // Another physician can keep treating while it has more than its final
            // emergency stroke. Do not wait for both real packs to become empty.
            if (
              doctors.some((other) => other !== id && campaign.operativeState[other].medkits > 1)
            ) {
              continue;
            }
            const before = campaign.operativeState[id].medkits,
              cash = campaign.resources.treasury,
              departure = seconds();
            // Keep the genuine discovery clock even when the known cache is empty.
            campaign = discoverRouteCache(campaign, id);
            count = gather(id, 6);
            recovered += count;
            assert.equal(campaign.operativeState[id].medkits, before + count);
            assert.equal(campaign.resources.treasury, cash);
            report({
              event: 'localMedicalCacheRecovered',
              operativeId: id,
              count,
              elapsedSeconds: seconds() - departure,
              hour: campaign.hour,
            });
            onCheckpoint('local-medical-cache-' + id, campaign, {
              count,
              elapsedSeconds: seconds() - departure,
            });
            if (!count && medicalRemains === null) {
              // Empty known rows and an opened chest do not establish that the
              // battlefield has been searched. Inspect bodies through the public
              // map patrol and hand-loot controls before declaring local exhaustion.
              renew(2);
              prepareClinic();
              const found = recoverVisibleRouteDressings(campaign, courier, 13, { report });
              campaign = found.campaign;
              medicalRemains = found.evidence;
              recovered += found.collected;
              onCheckpoint('visible-medical-remains', campaign, medicalRemains);
              const handed = handoverRescueClinicDressings(campaign, {
                courier,
                collected: found.collected,
                report,
                onCheckpoint,
                resolveEncounter: resolveRescueRecoveryEncounter,
              });
              campaign = handed.campaign;
              if (handed.defense) {
                collectionDefenses.push(handed.defense);
              }
              if (handed.donated) {
                orders.push({ scope: 'campaign', action: handed.handover });
                events.push({
                  action: handed.handover,
                  hour: campaign.hour,
                  second: campaign.secondOfHour ?? 0,
                });
                donated += handed.donated;
                count = gather(id);
              }
            }
            if (!count) {
              assert.ok(
                foundDressings < 13,
                'a partial actual C collection discovered its finite cache before reporting exhaustion',
              );
              prepareClinic();
              const rested = restRescuePatients(campaign, {
                patients,
                doctors,
                courier,
                exhaustedSources: ['cordoba'],
                report,
                onCheckpoint,
                resolveEncounter: resolveRescueRecoveryEncounter,
              });
              campaign = rested.campaign;
              restRecovery = rested.evidence;
              break;
            }
          }
        }
        assert.ok(count);
      }
    }
    if (restRecovery) {
      break;
    }
    for (const operativeId of patients) {
      order({ type: 'assignCare', operativeId, assignment: 'patient' });
    }
    for (const operativeId of doctors) {
      order({
        type: 'assignCare',
        operativeId,
        assignment: campaign.operativeState[operativeId].medkits ? 'doctor' : 'rest',
      });
    }
    order({ type: 'wait', hours: 1 });
  }
  for (const id of patients) {
    assert.equal(campaign.operativeState[id].hp, campaign.operativeState[id].maxHp);
  }
  for (const operativeId of [...patients, ...doctors]) {
    order({ type: 'assignCare', operativeId, assignment: 'rest' });
  }
  const restUntil = campaign.hour + 6;
  for (let i = 0; campaign.hour < restUntil && i < 20; i++) {
    renew(2);
    order({ type: 'wait', hours: 1 });
  }
  assert.equal(campaign.hour, restUntil);
  for (const id of dead) {
    assert.equal(campaign.operativeState[id].alive, false);
  }
  for (const id of patients) {
    assert.equal(campaign.operativeState[id].bleeding, 0);
    assert.equal(campaign.operativeState[id].captured, false);
    assert.ok(campaign.recruited.includes(id));
  }
  assert.deepEqual(decodeSave(encodeSave(campaign)).campaign, campaign);
  const recovery = {
    startHour,
    endHour: campaign.hour,
    courierStartHour,
    courierLegs,
    rearPhysicians,
    patients,
    doctors,
    hiredDoctors,
    hiringCost,
    courier,
    boughtDressings,
    foundDressings,
    cost,
    unitPrice,
    recoveredDressings: recovered,
    donatedDressings: donated,
    medicalRemains,
    guardPreparation,
    rearPreparation,
    collectionDefenses,
    restRecovery,
  };
  report({ event: 'rescueRecoveryComplete', ...recovery });
  return { campaign, events, recovery };
}
