import { present } from './assert-present.ts';
import type { CampaignAction, CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import { createFreshRouteOrders, type FreshRouteOrderEvent } from './fresh-route-orders.ts';
import { completeQueuedAssault } from './assault-fixture.ts';
import assert from 'node:assert/strict';
import { dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import {
  contractQuote,
  contractRenewalQuote,
  contractExpiresSeconds,
} from '../packages/game/contracts.js';
import { lowMoraleRenewalStatus } from '../packages/game/morale-renewal.js';
import { queueSquadTravel, travelLegHours } from '../packages/game/squad-travel.js';
import {
  artilleryTransportQuote,
  artilleryTransportPath,
  storedArtilleryRecord,
} from '../packages/game/artillery-transport.js';
import { artilleryTransportRules } from '../packages/game/artillery-transport-rules.js';
import { FINITE_ARTILLERY_ARSENALS } from '../packages/game/finite-artillery-arsenals.js';

import {
  stabilizeCreatedCuyoSurvivors,
  stabilizeCreatedCuyoBattleSurvivors,
  recoverCreatedCuyoLocalPatients,
} from './created-cuyo-route.ts';
import {
  supplyFreshMountainAmmunition,
  NATIVE_MOUNTAIN_RESERVE_BOUNDS,
} from './fresh-mountain-route.ts';
import { recoverRoutePrimary } from './route-owned-equipment.ts';
import { supplyRouteDressings } from './route-dressings.ts';
import { finishReloadsBeforeMarch } from './pre-march-reload.ts';
import { recoveryPortSearchController } from './recovery-port-battery-driver.ts';
import { enterSector } from '../packages/game/world.js';
import { fightNorthernSector } from './northern-route.ts';
import { visit, saved, leave, sync } from './local-contract-fixture.ts';
import { takeFiniteCache } from './finite-cache-driver.ts';
import { autoBandageBattle } from '../packages/game/auto-bandage.js';
import { collectRouteMedicalSupplies } from './finite-route-equipment.ts';
import { sectorInventoryModel } from '../packages/game/sector-inventory.js';
import { recordRouteStrategicEvidence } from './route-strategic-failure-evidence.ts';
import {
  arsenalRearServicePlan,
  withdrawArsenalRear,
  reuniteArsenalRear,
  restArsenalRear,
} from './arsenal-medical-reserve.ts';
import { fight } from './opening-driver.ts';
import { fightPairedRouteBattle } from './paired-route-battle.ts';
import { recordRouteBattleFailure } from './route-failure-evidence.ts';
import { beginRouteControllerBoundaryEvidence } from './route-controller-decision-evidence.ts';
import '../packages/game/tactical.js';
import '../packages/game/sector-deployment.js';
import '../packages/game/time.js';
import { encodeSave, decodeSave } from '../packages/game/save.ts';
import { operativeLocation, canReassignOperative } from '../packages/game/squads.js';
import { extractItemQuantity } from '../packages/game/tactical-inventory.js';
import { locationId } from '../packages/game/world-cells.ts';
import { encounterContacts, encounterRequirements } from '../packages/game/encounters.js';
import { meetRecruits } from './campaign-recruitment-route.ts';

const living = (c: CampaignSnapshot) =>
  c.recruited.filter((id) => c.operativeState[id]?.alive && !c.operativeState[id].captured);
const stable = (c: CampaignSnapshot, id: number) => {
  const r = c.operativeState[id];
  return r?.alive && !r.captured && r.hp >= 15 && !r.bleeding && !r.unconscious && !r.routed;
};
const healthyLocalVeterans = (c: CampaignSnapshot) =>
  rosterFor(c)
    .filter(
      (op) =>
        op.id !== 2 &&
        living(c).includes(op.id) &&
        present(c.operativeState[op.id]).location === 'mendoza' &&
        stable(c, op.id) &&
        present(c.operativeState[op.id]).hp === present(c.operativeState[op.id]).maxHp,
    )
    .sort((a, b) => b.marksmanship - a.marksmanship || a.id - b.id);

// Return an existing physician through the whole squad's actual public route.
// Arrival does not supply dressings, recover morale or claim combat readiness.
export function returnCreatedCuyoArsenalPhysician(start: CampaignSnapshot, { report = () => {} } = {}) {
  const local = healthyLocalVeterans(start).find((op) => op.medical >= 60);
  if (local) {
    return { campaign: start, physician: local.id, returned: false };
  }
  let c = saved({ campaign: start }).campaign;
  const original = { id: c.activeSquadId, members: [...c.squad], location: c.location },
    clock = (s: CampaignSnapshot) => s.hour * 3600 + (s.secondOfHour ?? 0),
    began = clock(c);
  assert.equal(c.location, 'mendoza');
  assert.equal(c.pendingBattle, null);
  assert.equal(c.pendingEncounter, null);
  const plans = rosterFor(c)
    .filter(
      (op) =>
        op.medical >= 60 &&
        living(c).includes(op.id) &&
        stable(c, op.id) &&
        present(c.operativeState[op.id]).hp === present(c.operativeState[op.id]).maxHp &&
        present(c.operativeState[op.id]).location !== 'mendoza',
    )
    .sort(
      (a, b) =>
        b.medical - a.medical ||
        present(c.operativeState[b.id]).morale - present(c.operativeState[a.id]).morale ||
        a.id - b.id,
    )
    .flatMap((op) => {
      const group = c.squads.find((q) => q.members.includes(op.id) && !q.journey);
      if (!group) {
        return [];
      }
      const preview = structuredClone(c),
        squad = preview.squads.find((q) => q.id === group.id);
      try {
        const journey = queueSquadTravel(preview, squad, { sector: 'mendoza', mode: 'march' }),
          hours = journey.path
            .slice(1)
            .reduce((sum: number, to: string, i: string|number) => sum + travelLegHours(journey.path[i], to, journey.mode, c), 0);
        return hours <= 24
          ? [
              {
                id: op.id,
                squadId: group.id,
                members: [...group.members],
                journey: structuredClone(journey),
                hours,
              },
            ]
          : [];
      } catch {
        return [];
      }
    });
  const plan = plans[0];
  assert.ok(
    plan,
    'The arsenal needs a healthy serving physician with an available existing squad route to Mendoza.',
  );
  const events: FreshRouteOrderEvent[] = [],
    retained = createFreshRouteOrders(
      () => c,
      (next) => {
        c = next;
      },
      { report: (event) => events.push(event) },
    ),
    order = (action: CampaignAction) => retained.order(action);
  try {
    retained.retain((plan.hours + 1) * 3600);
    order({ type: 'selectSquad', id: plan.squadId });
    order({ type: 'travel', sector: 'mendoza', mode: 'march', queue: true });
    assert.deepEqual(present(c.squads.find((q) => q.id === plan.squadId)).journey, plan.journey);
    for (
      let attempt = 0;
      attempt < 48 &&
      present(c.squads.find((q) => q.id === plan.squadId)).journey &&
      clock(c) - began < 24 * 3600;
      attempt++
    ) {
      if (present(c.squads.find((q) => q.id === plan.squadId)).journey.status === 'paused') {
        order({ type: 'resumeTravel' });
      }
      order({ type: 'wait', hours: 1 });
    }
    const arrived = c.squads.find((q) => q.id === plan.squadId);
    assert.equal(
      present(arrived).journey,
      undefined,
      'The physician must finish the actual public route before staffing the arsenal.',
    );
    assert.equal(present(arrived).location, 'mendoza');
    assert.deepEqual(present(arrived).members, plan.members);
    assert.equal(present(c.operativeState[plan.id]).location, 'mendoza');
    assert.ok(
      living(c).includes(plan.id) &&
        stable(c, plan.id) &&
        present(c.operativeState[plan.id]).hp === present(c.operativeState[plan.id]).maxHp,
    );
    order({ type: 'selectSquad', id: original.id });
    assert.deepEqual(c.squad, original.members);
    assert.equal(c.location, original.location);
    const campaign = saved({ campaign: c }).campaign;
    assert.deepEqual(campaign, c);
    for (const event of events) {
      report(event);
    }
    report({
      event: 'createdCuyoArsenalPhysicianReturned',
      physician: plan.id,
      plan,
      seconds: clock(c) - began,
      hour: c.hour,
      second: c.secondOfHour ?? 0,
      campaign,
    });
    return { campaign, physician: plan.id, returned: true };
  } catch (error) {
    recordRouteStrategicEvidence({
      helper: 'returnCreatedCuyoArsenalPhysician',
      stage: 'preparation-failure',
      campaign: c,
      context: { original, plan },
      error,
    });
    throw error;
  }
}

// The second column keeps one real vacancy until its existing capital stop.
// This is a physical conversation, not bulletin hiring or a reserved actor.
export function recruitCreatedCuyoArsenalPhysician(
  start: CampaignSnapshot,
  { squadId, deadlineSeconds, report = () => {} } = {},
) {
  const clock = (c: CampaignSnapshot) => c.hour * 3600 + (c.secondOfHour ?? 0),
    person = rosterFor(start).find((op) => op.id === 10);
  assert.ok(
    person &&
      person.medical >= 60 &&
      stable(start, 10) &&
      present(start.operativeState[10]).hp === present(start.operativeState[10]).maxHp,
    'The physical arsenal physician must be alive, qualified and healthy.',
  );
  assert.equal(start.pendingBattle, null);
  assert.equal(start.pendingEncounter, null);
  assert.equal(start.location, 'buenos_aires');
  if (living(start).includes(10)) {
    assert.equal(operativeLocation(start, 10), 'buenos_aires');
    const expiry = contractExpiresSeconds(start.contracts[10]);
    assert.ok(
      start.contracts[10] && (expiry === null || expiry > clock(start)),
      'The existing physician must retain an actual current native service term.',
    );
    assert.ok(
      start.squads.some(
        (group) =>
          !group.journey && group.location === 'buenos_aires' && group.members.includes(10),
      ),
    );
    return { campaign: start, physician: 10, recruited: false };
  }
  assert.ok(
    Number.isSafeInteger(deadlineSeconds) && clock(start) < deadlineSeconds,
    'The physical meeting must fit the original arsenal arrival allowance.',
  );
  const home = start.squads.find((group) => group.id === squadId);
  assert.ok(
    home && !home.journey && home.location === 'buenos_aires' && home.members.length === 5,
    'The second actual local column must keep one vacant place for the physician.',
  );
  const contact = encounterContacts(start).find((npc) => npc.operativeId === 10);
  assert.ok(
    contact && locationId(contact.sector, start) === 'buenos_aires',
    'The actual public contact must belong to the existing capital stop.',
  );
  const speaker = rosterFor(start).find(
    (op) =>
      home.members.includes(op.id) &&
      stable(start, op.id) &&
      !present(start.operativeState[op.id]).asleep &&
      present(start.operativeState[op.id]).energy > 10 &&
      !encounterRequirements(start, contact, op),
  );
  assert.ok(
    speaker,
    'A fit actual second-column member must satisfy the physical conversation requirements.',
  );
  let c = saved({ campaign: start }).campaign;
  const retained = createFreshRouteOrders(
    () => c,
    (next) => {
      c = next;
    },
    { report },
  );
  retained.retain(deadlineSeconds - clock(c));
  retained.order({ type: 'selectSquad', id: squadId });
  const beforeMembers = [...c.squad],
    before = clock(c),
    quote = contractQuote(
      c,
      rosterFor(c).find((op) => op.id === 10),
      'day',
    );
  assert.equal(quote.available, true, quote.reason);
  assert.ok(
    quote.total <= c.resources.treasury,
    'The physical physician meeting must fit its actual quoted native service cost.',
  );
  const joined = meetRecruits(c, [contact.id], speaker.id);
  assert.ok(
    clock(joined) <= deadlineSeconds,
    'The actual conversation clock must remain inside the same original arrival allowance.',
  );
  retained.adopt(joined, 'physical-arsenal-physician');
  assert.ok(
    living(c).includes(10) &&
      stable(c, 10) &&
      present(c.operativeState[10]).hp === present(c.operativeState[10]).maxHp,
  );
  assert.equal(operativeLocation(c, 10), 'buenos_aires');
  assert.deepEqual(c.squad, [...beforeMembers, 10]);
  assert.deepEqual(present(c.squads.find((group) => group.id === squadId)).members, c.squad);
  // The actual conversation signs its own default day term after the paid
  // approach. A legacy permanent profile stays permanent; an authored finite
  // profile keeps its real expiry seconds and ordinary renewal costs.
  const meetingContract = structuredClone(c.contracts[10]),
    signedSeconds = present(meetingContract).started * 3600 + (present(meetingContract).startedSecond ?? 0);
  assert.ok(signedSeconds >= before && signedSeconds <= clock(c));
  assert.equal(present(meetingContract).kind, quote.permanent ? 'patriot' : 'paid');
  assert.equal(present(meetingContract).term, 'day');
  assert.equal(present(meetingContract).paid, quote.price);
  assert.equal(
    contractExpiresSeconds(meetingContract),
    quote.permanent ? null : signedSeconds + present(quote.hours) * 3600,
  );
  retained.retain(deadlineSeconds - clock(c));
  assert.ok(clock(c) <= deadlineSeconds);
  const expiry = contractExpiresSeconds(c.contracts[10]);
  assert.ok(
    expiry === null || expiry > deadlineSeconds,
    'The real physician term must cover the same original arsenal arrival allowance.',
  );
  report({
    event: 'createdCuyoArsenalPhysicianRecruited',
    id: 10,
    speaker: speaker.id,
    squadId,
    beforeMembers,
    seconds: clock(c) - before,
    deadlineSeconds,
    quote,
    meetingContract,
    hour: c.hour,
    second: c.secondOfHour ?? 0,
    campaign: c,
  });
  return { campaign: c, physician: 10, recruited: true };
}

// Only an actual completed recapture can retire its recorded temporary role.
// A wounded survivor remains paid and rests on the existing readiness clock.
// No provenance means no extra query, dismissal, assignment or save.
function finishCompletedConvoyService(start, receipts, protectedIds, { report }) {
  if (!receipts.length) {
    return { campaign: start, released: [], resting: [] };
  }
  const clock = (s) => s.hour * 3600 + (s.secondOfHour ?? 0),
    bodyKeys = [
      'alive',
      'hp',
      'maxHp',
      'bleeding',
      'bandaged',
      'energy',
      'fatigue',
      'morale',
      'location',
      'xp',
      'trainedStats',
      'skillPractice',
      'practiceSeed',
    ];
  const body = (r) => Object.fromEntries(bodyKeys.map((key) => [key, structuredClone(r[key])]));
  const before = structuredClone(start),
    released = [],
    resting = [],
    seen = new Set();
  let c = start;
  assert.equal(c.location, 'mendoza');
  assert.equal(c.pendingBattle, null);
  assert.equal(c.pendingEncounter, null);
  for (const receipt of receipts) {
    assert.equal(receipt.version, 1);
    assert.equal(receipt.returnedSector, 'mendoza');
    assert.equal(receipt.destination, 'cordoba');
    assert.ok(
      Number.isSafeInteger(receipt.completedSeconds) && receipt.completedSeconds <= clock(c),
    );
    assert.ok(
      receipt.battles.length > 0 &&
        receipt.battles.every(
          (row: { status: string; actions: number; turns: number; }) => row.status === 'victory' && row.actions > 0 && row.turns > 0,
        ),
    );
    const custody = [
      ...Object.values(c.artilleryDepots ?? {}).flat(),
      ...(c.artilleryTransfers ?? []).map((row) => row.gun),
    ].filter((gun) => gun.id === receipt.transferId);
    assert.equal(
      custody.length,
      1,
      'The delivered gun must still have one actual owned custodian after later normal transport.',
    );
    assert.deepEqual(
      custody[0],
      receipt.record,
      'Later normal transport keeps the exact finite delivered gun.',
    );
    for (const hire of receipt.hires) {
      assert.ok(!seen.has(hire.id), 'A completed temporary hire must have one source receipt.');
      seen.add(hire.id);
      if (hire.purpose !== 'convoy-replacement-and-dressings') {
        continue;
      }
      assert.equal(hire.debited, hire.quote.total);
      assert.equal(hire.quote.permanent, false);
      assert.equal(hire.arrival.term, 'week');
      const id = hire.id,
        r = c.operativeState[id],
        op = rosterFor(c).find((person) => person.id === id),
        contract = c.contracts[id];
      if (
        id < 100 ||
        id >= 1000 ||
        protectedIds.includes(id) ||
        !op ||
        op.medical >= 60 ||
        !stable(c, id) ||
        !canReassignOperative(c, id) ||
        operativeLocation(c, id) !== 'mendoza' ||
        r.asleep ||
        r.energy <= 10 ||
        !['active', 'rest'].includes(r.assignment) ||
        r.equipmentCursor ||
        r.toolkitPoints ||
        contract?.kind !== 'paid' ||
        contract.guaranteeId
      ) {
        continue;
      }
      assert.ok(
        present(contractExpiresSeconds(contract)) > clock(c),
        'The completed survivor still needs actual paid service at release or rest.',
      );
      if (r.hp < r.maxHp) {
        const physical = body(r),
          action = { type: 'assignCare', operativeId: id, assignment: 'rest' };
        c = dispatchCampaign(c, action);
        assert.equal(c.lastError, null);
        assert.deepEqual(body(c.operativeState[id]), physical);
        resting.push(id);
        report({
          event: 'createdCuyoConvoyWoundedRest',
          transferId: receipt.transferId,
          id,
          action,
          hour: c.hour,
          second: c.secondOfHour ?? 0,
        });
        continue;
      }
      const collector = c.recruited.find(
        (other: number) =>
          other !== id &&
          stable(c, other) &&
          !c.operativeState[other].asleep &&
          canReassignOperative(c, other) &&
          operativeLocation(c, other) === 'mendoza',
      );
      assert.notEqual(collector, undefined);
      const model = sectorInventoryModel(c, 'mendoza', rosterFor(c), id);
      assert.equal(model.operativeId, id);
      assert.equal(model.carriedReason, null);
      const kit = model.carried.map(
          (row) => extractItemQuantity(model.personal, row.item, row.count).stack,
        ),
        oldKeys = new Set(
          sectorInventoryModel(c, 'mendoza', rosterFor(c), collector).entries.map((row) => row.key),
        );
      const physical = body(r),
        cash = c.resources.treasury,
        now = clock(c),
        selected = c.activeSquadId,
        members = [...c.squad],
        identity = { id: op.id, name: op.name, contentId: op.contentId },
        action = { type: 'dismiss', id };
      c = dispatchCampaign(c, action);
      assert.equal(c.lastError, null);
      assert.equal(c.recruited.includes(id), false);
      assert.equal(c.contracts[id], undefined);
      assert.deepEqual(body(c.operativeState[id]), physical);
      assert.equal(c.resources.treasury, cash);
      assert.equal(clock(c), now);
      assert.equal(c.activeSquadId, selected);
      assert.deepEqual(c.squad, members);
      const same = rosterFor(c).find((person) => person.id === id);
      assert.deepEqual({ id: present(same).id, name: present(same).name, contentId: present(same).contentId }, identity);
      const returned = sectorInventoryModel(c, 'mendoza', rosterFor(c), collector)
          .entries.filter((row) => !oldKeys.has(row.key))
          .map((row) => JSON.parse(row.expected)),
        sort = (stacks) => stacks.map((stack) => JSON.stringify(stack)).sort();
      assert.deepEqual(
        sort(returned),
        sort(kit),
        'Every exact carried stack remains once in the actual local return.',
      );
      assert.equal(c.operativeState[id].startingCartridgesIssued, r.startingCartridgesIssued);
      released.push({
        id,
        transferId: receipt.transferId,
        physical,
        returned: structuredClone(returned),
      });
      report({
        event: 'createdCuyoConvoyServiceEnded',
        transferId: receipt.transferId,
        id,
        action,
        physical,
        returned,
        hour: c.hour,
        second: c.secondOfHour ?? 0,
      });
    }
  }
  assert.equal(clock(c), clock(before));
  assert.equal(c.resources.treasury, before.resources.treasury);
  for (const [id, r] of Object.entries(before.operativeState)) {
    if (!r.alive) {
      assert.deepEqual(c.operativeState[id], r);
    }
  }
  assert.deepEqual(saved({ campaign: c }).campaign, c);
  return { campaign: c, released, resting };
}

// A native victory spent the three original bronze guns. This side operation
// earns the remaining finite arsenal; it never refills those existing pieces.
export function prepareCreatedCuyoArsenalAssault(
  start: CampaignSnapshot,
  { report = () => {}, completedConvoyService = [] } = {},
) {
  const inputCapture = recordRouteStrategicEvidence({
    helper: 'prepareCreatedCuyoArsenalAssault',
    stage: 'preparation-input',
    campaign: start,
  });
  let c = saved({ campaign: start }).campaign;
  try {
    assert.equal(c.flags.armyFunded, true);
    assert.equal(c.location, 'mendoza');
    assert.equal(c.pendingBattle, null);
    assert.equal(c.pendingEncounter, null);
    assert.equal(present(c.sectors.ensenada).owner, 'royalist');
    assert.equal(present(c.artilleryArsenalRecoveries).ensenada, undefined);
    const originalSquad = c.activeSquadId,
      originalMembers = [...c.squad];
    const completedService = finishCompletedConvoyService(
      c,
      completedConvoyService,
      originalMembers,
      { report },
    );
    c = completedService.campaign;
    const retain = () =>
      createFreshRouteOrders(
        () => c,
        (next) => {
          c = next;
        },
        { report, handledEncounters: ['tucuman', 'salta'] },
      );
    let retained = retain(),
      arrivalDeadline: number|null = null;
    const resolve = () => {
      if (!c.pendingEncounter) {
        return;
      }
      const selected = c.activeSquadId,
        encounter = c.pendingEncounter;
      assert.ok(
        ['tucuman', 'salta'].includes(encounter.sector),
        'Resolve an unexpected real encounter before this side operation.',
      );
      const alive = living(c);
      const destination = encounter.sector === 'salta' ? 'tucuman' : 'cordoba';
      c = dispatchCampaign(c, {
        type: 'respondToEncounter',
        groupId: encounter.groupId,
        choice: 'retreat',
        destination,
      });
      assert.equal(c.lastError, null, c.lastError);
      assert.equal(c.defeated, false);
      assert.equal(c.pendingBattle, null);
      report({
        event: 'createdCuyoArsenalRearEncounter',
        sector: encounter.sector,
        choice: 'retreat',
        destination,
        deaths: alive.filter((id) => !present(c.operativeState[id]).alive),
        hour: c.hour,
        second: c.secondOfHour,
        campaign: c,
      });
      retained = retain();
      retained.order({ type: 'selectSquad', id: selected });
    };
    const checkArrival = () => {
      if (arrivalDeadline !== null) {
        assert.ok(
          c.hour * 3600 + (c.secondOfHour ?? 0) <= arrivalDeadline,
          'Arsenal arrival orders must stay inside the one original travel allowance.',
        );
      }
    };
    const order = (action: CampaignAction) => {
      resolve();
      checkArrival();
      const next = retained.order(action);
      checkArrival();
      return next;
    };
    if (!healthyLocalVeterans(c).some((op) => op.medical >= 60)) {
      const returned = returnCreatedCuyoArsenalPhysician(c, { report });
      retained.adopt(returned.campaign, 'arsenal-physician-arrival');
    }
    const healthy = healthyLocalVeterans(c);
    const reserve = healthy.filter((op) => !originalMembers.includes(op.id)),
      veterans = reserve.length >= 5 ? reserve : healthy;
    let local = veterans.slice(0, 5).map((op) => op.id);
    if (!veterans.slice(0, 5).some((op) => op.medical >= 60)) {
      const medic = veterans
        .filter((op) => op.medical >= 60)
        .sort(
          (a, b) =>
            present(c.operativeState[b.id]).morale - present(c.operativeState[a.id]).morale ||
            b.medical - a.medical ||
            a.id - b.id,
        )[0];
      assert.ok(medic, 'The actual local column needs a healthy serving physician.');
      local = [
        ...veterans
          .filter((op) => op.id !== medic.id)
          .slice(0, 4)
          .map((op) => op.id),
        medic.id,
      ];
    }
    assert.ok(
      local.length > 0 && local.length <= 5,
      'Use the actual healthy local veterans and fill the remaining places through quoted paid recruitment.',
    );
    assert.ok(
      local.some((id) => present(rosterFor(c).find((op) => op.id === id)).medical >= 60),
      'The actual local column needs its existing physician.',
    );
    const freshPhysician = rosterFor(c).find(
      (op) =>
        op.id >= 100 &&
        op.id < 1000 &&
        op.medical >= 60 &&
        !c.recruited.includes(op.id) &&
        stable(c, op.id) &&
        present(c.operativeState[op.id]).hp === present(c.operativeState[op.id]).maxHp &&
        present(c.operativeState[op.id]).morale >= 50 &&
        contractQuote(c, op, 'day').available,
    );
    const servingPhysician = freshPhysician
      ? null
      : veterans
          .filter((op) => !local.includes(op.id) && op.medical >= 60)
          .sort(
            (a, b) =>
              present(c.operativeState[b.id]).morale - present(c.operativeState[a.id]).morale ||
              b.medical - a.medical ||
              a.id - b.id,
          )[0];
    const historicalPhysician =
      !freshPhysician && !servingPhysician
        ? rosterFor(c).find(
            (op) =>
              op.id === 10 &&
              !c.recruited.includes(op.id) &&
              op.medical >= 60 &&
              stable(c, op.id) &&
              present(c.operativeState[op.id]).hp === present(c.operativeState[op.id]).maxHp &&
              encounterContacts(c).some(
                (npc) => npc.operativeId === op.id && locationId(npc.sector, c) === 'buenos_aires',
              ),
          )
        : null;
    assert.ok(
      freshPhysician || servingPhysician || historicalPhysician,
      'The second column needs an available physician, an actual serving reserve or its known living capital contact.',
    );
    const rested = [...local, ...(servingPhysician ? [servingPhysician.id] : [])];
    for (const operativeId of rested) {
      order({ type: 'assignCare', operativeId, assignment: 'rest' });
    }
    // Safe strategic rest earns one morale point per six actual hours. The
    // fresh loose route can bring permanent veterans home with zero morale;
    // its paid wait must cover the real deficit before the readiness check.
    const restLimit = Math.max(
      240,
      ...rested.map((id) => Math.ceil(Math.max(0, 50 - present(c.operativeState[id]).morale)) * 6 + 24),
    );
    for (
      let hour = 0;
      hour < restLimit &&
      rested.some((id) => {
        const r = c.operativeState[id];
        return present(r).morale < 50 || present(r).fatigue || present(r).energy < 100 || present(r).asleep;
      });
      hour++
    ) {
      order({ type: 'wait', hours: 1 });
    }
    assert.ok(
      rested.every((id) => {
        const r = c.operativeState[id];
        return present(r).morale >= 50 && !present(r).fatigue && present(r).energy === 100 && !present(r).asleep;
      }),
      'Existing paid rest must finish before the actual coastal march.',
    );
    const candidates = rosterFor(c)
      .filter(
        (op) =>
          op.id >= 100 &&
          op.id < 1000 &&
          !c.recruited.includes(op.id) &&
          stable(c, op.id) &&
          present(c.operativeState[op.id]).hp === present(c.operativeState[op.id]).maxHp &&
          present(c.operativeState[op.id]).morale >= 50 &&
          contractQuote(c, op, 'day').available,
      )
      .sort(
        (a, b) =>
          b.marksmanship - a.marksmanship ||
          contractQuote(c, a, 'day').price - contractQuote(c, b, 'day').price,
      );
    let physician = historicalPhysician
      ? null
      : (servingPhysician ??
        candidates.filter((op) => op.medical >= 60).sort((a, b) => b.medical - a.medical)[0]);
    assert.ok(
      physician || historicalPhysician,
      'The second actual physician must be serving or physically recruited at the capital stop.',
    );
    const recruitCount = 12 - local.length - (historicalPhysician ? 1 : 0);
    const recruits = [
      ...candidates
        .filter((op) => op.id !== physician?.id)
        .slice(0, recruitCount - (physician ? 1 : 0)),
      ...(physician ? [physician] : []),
    ];
    assert.equal(
      recruits.length,
      recruitCount,
      'The actual local veterans and available paid recruits must fill every nonreserved arsenal place.',
    );
    const hired = recruits.filter((op) => !c.recruited.includes(op.id));
    assert.ok(
      hired.reduce((sum, op) => sum + contractQuote(c, op, 'day').total, 0) <=
        c.resources.treasury - 30000,
      'The actual first paid terms must fit the treasury and return reserve.',
    );
    for (const recruit of hired) {
      const returnedSupport = completedService.released.find((row) => row.id === recruit.id),
        beforeRehire = returnedSupport ? structuredClone(c.operativeState[recruit.id]) : null;
      retained.retain(3600);
      const quote = contractQuote(c, recruit, 'day'),
        cash = c.resources.treasury;
      assert.equal(quote.available, true, quote.reason);
      order({ type: 'recruitCivic', id: recruit.id, term: 'day', destination: 'mendoza' });
      assert.equal(c.resources.treasury, cash - quote.total);
      if (returnedSupport) {
        for (const key of [
          'alive',
          'hp',
          'maxHp',
          'bleeding',
          'bandaged',
          'xp',
          'trainedStats',
          'startingCartridgesIssued',
          'medkits',
          'rations',
          'torches',
          'boleadoras',
          'ammo',
          'carriedLoaded',
          'inventory',
          'outfit',
          'headwear',
          'legwear',
          'condition',
          'weaponMetadata',
          'bladeMetadata',
          'weaponInstanceId',
          'carriedReloadProgress',
        ]) {
          assert.deepEqual(
            present(c.operativeState[recruit.id])[key],
            present(beforeRehire)[key],
            'Rehire keeps the actual returned person and never restores a wound, death or initial issue.',
          );
        }
        report({
          event: 'createdCuyoConvoySupportRehired',
          id: recruit.id,
          transferId: returnedSupport.transferId,
          quote,
          treasuryBefore: cash,
          treasuryAfter: c.resources.treasury,
          hour: c.hour,
          second: c.secondOfHour ?? 0,
        });
      }
      report({
        event: 'createdCuyoArsenalHired',
        id: recruit.id,
        quote,
        treasuryBefore: cash,
        treasuryAfter: c.resources.treasury,
        hour: c.hour,
        second: c.secondOfHour ?? 0,
      });
    }
    for (let hour = 0; hour < 24 && recruits.some((op) => !c.recruited.includes(op.id)); hour++) {
      order({ type: 'wait', hours: 1 });
    }
    assert.ok(
      recruits.every(
        (op) => c.recruited.includes(op.id) && present(c.operativeState[op.id]).location === 'mendoza',
      ),
    );
    const field = [...local, ...recruits.map((op) => op.id)],
      columns: string[] = [];
    const localSlots = c.squads
      .filter((q) => q.id !== originalSquad && q.location === 'mendoza' && !q.journey)
      .map((q) => q.id);
    for (let offset = 0; offset < field.length; offset += 6) {
      const slot = localSlots.find((id) => !columns.includes(id)),
        ids = field.slice(offset, offset + 6);
      if (slot) {
        order({ type: 'selectSquad', id: slot });
        order({ type: 'squad', ids });
      } else {
        order({ type: 'createSquad', name: 'Arsenal de Barragán', ids, sector: 'mendoza' });
      }
      columns.push(c.activeSquadId);
    }
    for (const operativeId of field) {
      order({ type: 'assignCare', operativeId, assignment: 'active' });
    }
    for (const id of field) {
      if (
        present(c.operativeState[id]).weaponDropped ||
        ![1800, 1801, 1802, 1803].includes(present(rosterFor(c).find((op) => op.id === id)).weapon)
      ) {
        c = recoverRoutePrimary(c, id, { preferredWeapon: 1801, replace: true, report });
      }
    }
    assert.ok(
      field.every(
        (id) =>
          !present(c.operativeState[id]).weaponDropped &&
          [1800, 1801, 1802, 1803].includes(present(rosterFor(c).find((op) => op.id === id)).weapon),
      ),
      'Every actual arsenal soldier must hold a compatible firearm before ammunition is supplied.',
    );
    c = supplyFreshMountainAmmunition(c, field, { target: 12, report });
    const doctor = rosterFor(c)
      .filter((op) => local.includes(op.id) && op.medical >= 60)
      .sort((a, b) => b.medical - a.medical)[0];
    const medicalReserves = {};
    const supplyPhysician = (op: CampaignOperative|null|undefined) => {
      const at = operativeLocation(c, op.id),
        localStock = () =>
          present(c.operativeState[op.id]).medkits +
          sectorInventoryModel(c, at, rosterFor(c), op.id)
            .entries.filter((row) => row.reachable && JSON.parse(row.expected).item === 'medkits')
            .reduce((sum, row) => sum + row.count, 0) +
          c.recruited
            .filter(
              (id) =>
                id !== op.id &&
                present(c.operativeState[id]).alive &&
                !present(c.operativeState[id]).captured &&
                present(c.operativeState[id]).location === at &&
                !sectorInventoryModel(c, at, rosterFor(c), id).reason,
            )
            .reduce(
              (sum, id) =>
                sum + Math.max(0, present(c.operativeState[id]).medkits - (medicalReserves[id] ?? 0)),
              0,
            );
      for (let delivery = 0; localStock() < 8; delivery++) {
        assert.ok(delivery < 8, 'Finite arsenal medical couriers must make actual progress.');
        const found = collectRouteMedicalSupplies(c, op.id, 8 - localStock(), {
          mode: c.routes.posta ? 'posta' : 'march',
          ...(arrivalDeadline !== null ? { deadlineSeconds: arrivalDeadline } : {}),
          report,
        });
        c = found.campaign;
        assert.ok(found.collected > 0);
      }
      c = supplyRouteDressings(c, op.id, 8, { reserves: medicalReserves, report });
      medicalReserves[op.id] = 8;
      if (arrivalDeadline !== null) {
        assert.ok(
          c.hour * 3600 + (c.secondOfHour ?? 0) <= arrivalDeadline,
          'Finite capital supply must fit the same original arrival allowance.',
        );
      }
    };
    if (!historicalPhysician) {
      for (const op of [doctor, physician]) {
        supplyPhysician(op);
      }
    }
    if (historicalPhysician) {
      arrivalDeadline = c.hour * 3600 + (c.secondOfHour ?? 0) + 168 * 3600;
    }
    order({ type: 'configureArtillery', types: [] });
    for (const id of columns) {
      order({ type: 'selectSquad', id });
      c = finishReloadsBeforeMarch(c, { report });
      order({ type: 'travel', sector: 'buenos_aires', mode: 'posta', queue: true });
    }
    for (
      let hour = 0;
      hour < 168 && columns.some((id) => present(c.squads.find((q) => q.id === id)).journey);
      hour++
    ) {
      resolve();
      for (const id of columns) {
        if (present(c.squads.find((q) => q.id === id)).journey?.status === 'paused') {
          order({ type: 'selectSquad', id });
          order({ type: 'resumeTravel' });
        }
      }
      order({ type: 'wait', hours: 1 });
    }
    resolve();
    assert.equal(c.location, 'buenos_aires');
    assert.ok(
      columns.every(
        (id) =>
          present(c.squads.find((q) => q.id === id)).location === 'buenos_aires' &&
          !present(c.squads.find((q) => q.id === id)).journey,
      ),
    );
    if (historicalPhysician) {
      const joined = recruitCreatedCuyoArsenalPhysician(c, {
        squadId: columns.at(-1),
        deadlineSeconds: arrivalDeadline,
        report,
      });
      retained.adopt(joined.campaign, 'capital-arsenal-physician');
      physician = rosterFor(c).find((op) => op.id === joined.physician);
      field.push(present(physician).id);
      assert.equal(field.length, 12);
      assert.equal(new Set(field).size, 12);
      assert.ok(
        present(doctor).id !== present(physician).id &&
          [doctor, physician].every(
            (op) =>
              present(op).medical >= 60 &&
              living(c).includes(present(op).id) &&
              operativeLocation(c, present(op).id) === 'buenos_aires' &&
              stable(c, present(op).id) &&
              present(c.operativeState[op.id]).hp === present(c.operativeState[op.id]).maxHp,
          ),
        'Both actual qualified physicians must be present before capital supply or the assault.',
      );
      if (
        present(c.operativeState[physician.id]).weaponDropped ||
        ![1800, 1801, 1802, 1803].includes(present(physician).weapon)
      ) {
        c = recoverRoutePrimary(c, present(physician).id, { preferredWeapon: 1801, replace: true, report });
      }
      assert.ok(
        !present(c.operativeState[physician.id]).weaponDropped &&
          [1800, 1801, 1802, 1803].includes(
            present(rosterFor(c).find((op) => op.id === physician.id)).weapon,
          ),
      );
      c = supplyFreshMountainAmmunition(c, [present(physician).id], { target: 12, report });
      for (const op of [doctor, physician]) {
        supplyPhysician(op);
      }
      c = finishReloadsBeforeMarch(c, { report });
      assert.ok(
        c.hour * 3600 + (c.secondOfHour ?? 0) <= present(arrivalDeadline),
        'The completed twelve-person field must fit the original 168-hour arrival allowance.',
      );
      arrivalDeadline = null;
    }
    assert.equal(field.length, 12);
    assert.equal(new Set(field).size, 12);
    assert.ok(
      present(doctor).id !== present(physician).id &&
        [doctor, physician].every(
          (op) =>
            present(op).medical >= 60 &&
            living(c).includes(present(op).id) &&
            operativeLocation(c, present(op).id) === 'buenos_aires' &&
            stable(c, present(op).id),
        ),
      'The completed arsenal field keeps two distinct actual serving physicians.',
    );
    for (const operativeId of field) {
      order({ type: 'assignCare', operativeId, assignment: 'rest' });
    }
    for (
      let hour = 0;
      hour < 72 &&
      (c.hour % 24 < 6 ||
        c.hour % 24 > 10 ||
        field.some((id) => {
          const r = c.operativeState[id];
          return present(r).fatigue || present(r).energy < 100 || present(r).asleep;
        }));
      hour++
    ) {
      order({ type: 'wait', hours: 1 });
    }
    for (const operativeId of field) {
      assert.ok(
        !present(c.operativeState[operativeId]).fatigue &&
          present(c.operativeState[operativeId]).energy === 100 &&
          !present(c.operativeState[operativeId]).asleep,
      );
      order({ type: 'assignCare', operativeId, assignment: 'active' });
    }
    const approachHours = Math.max(
      ...columns.map((id) =>
        travelLegHours(present(c.squads.find((group) => group.id === id)).location, 'ensenada', 'posta', c),
      ),
    );
    retained.retain((8 + approachHours) * 3600);
    // Existing serving veterans stay after the temporary recruits return.
    // Pay their actual terms before combat can make a renewal unavailable.
    // The cart route is a public plan; only a real victory can ship the guns.
    const cartPath = artilleryTransportPath(c, 'ensenada', 'mendoza', 'carts');
    assert.ok(
      c.routes.carts && cartPath,
      'The finite arsenal needs its controlled public return route.',
    );
    const cartHours = (cartPath.length - 1) * artilleryTransportRules(c).cartsHours,
      deadline = c.hour * 3600 + (c.secondOfHour ?? 0) + (8 + cartHours + approachHours) * 3600;
    const temporary = new Set(hired.map((op) => op.id));
    for (const id of living(c).filter((id) => !temporary.has(id))) {
      let contract = c.contracts[id],
        expiry = contractExpiresSeconds(contract);
      while (expiry !== null && expiry <= deadline) {
        const quote = contractRenewalQuote(
          c,
          rosterFor(c).find((op) => op.id === id),
          'day',
        );
        assert.equal(quote.available, true, quote.reason);
        const cash = c.resources.treasury,
          prior = structuredClone(contract),
          action = {
            type: 'renewContract',
            id,
            term: 'day',
            expectedExpiresAt: present(contract).expiresAt,
            expectedExpiresSecond: present(contract).expiresSecond ?? 0,
          };
        order(action);
        assert.equal(c.resources.treasury, cash - quote.price);
        assert.equal(
          contractExpiresSeconds(c.contracts[id]),
          present(quote.expiresAt) * 3600 + (quote.expiresSecond ?? 0),
        );
        report({
          event: 'createdCuyoArsenalReturnRetained',
          id,
          action,
          quote,
          prior,
          contract: structuredClone(c.contracts[id]),
          paid: quote.price,
          deadline,
          cartHours,
          hour: c.hour,
          second: c.secondOfHour ?? 0,
        });
        contract = c.contracts[id];
        expiry = contractExpiresSeconds(contract);
      }
    }
    // A keeper with an authored low-morale refusal can become unavailable after
    // real losses. Quote the existing next reserve phase while renewal is legal.
    // Ordinary keepers still renew as needed; temporary recruits still end service.
    const roster = rosterFor(c),
      reserveKeepers = living(c).filter(
        (id) =>
          !temporary.has(id) &&
          contractExpiresSeconds(c.contracts[id]) !== null &&
          lowMoraleRenewalStatus(
            c,
            roster.find((op) => op.id === id),
          ).eligible,
      );
    if (reserveKeepers.length) {
      const rear = roster
        .filter(
          (op) =>
            op.id >= 100 &&
            op.id < 1000 &&
            living(c).includes(op.id) &&
            !temporary.has(op.id) &&
            !field.includes(op.id) &&
            op.medical < 60 &&
            stable(c, op.id) &&
            present(c.operativeState[op.id]).hp === present(c.operativeState[op.id]).maxHp &&
            present(c.operativeState[op.id]).location !== 'mendoza' &&
            c.sectors[present(c.operativeState[op.id]).location]?.owner === 'patriot' &&
            !c.squads.find((q) => q.members.includes(op.id))?.journey,
        )
        .sort((a, b) => b.marksmanship - a.marksmanship || a.id - b.id)
        .slice(0, NATIVE_MOUNTAIN_RESERVE_BOUNDS.count);
      const routes = [...new Set(rear.map((op) => present(c.operativeState[op.id]).location))].map(
        (from) => {
          const path = artilleryTransportPath(c, from, 'mendoza', 'carts');
          assert.ok(path, 'The known rear reserve needs a controlled public road to Mendoza.');
          const ids = rear
              .filter((op) => present(c.operativeState[op.id]).location === from)
              .map((op) => op.id),
            hours = path
              .slice(1)
              .reduce((sum, to, i) => sum + travelLegHours(path[i], to, 'posta', c), 0);
          return { from, path, ids, hours, columns: Math.ceil(ids.length / 6) };
        },
      );
      const infantryReturnHours = cartPath
          .slice(1)
          .reduce((sum, to, i) => sum + travelLegHours(cartPath[i], to, 'posta', c), 0),
        preMarchRestHours =
          routes.reduce((sum, route) => sum + route.columns, 0) *
          NATIVE_MOUNTAIN_RESERVE_BOUNDS.preMarchRestHours,
        reserveTravelHours = Math.max(0, ...routes.map((route) => route.hours));
      const hours =
          8 +
          approachHours +
          Math.max(cartHours, infantryReturnHours) +
          preMarchRestHours +
          reserveTravelHours +
          NATIVE_MOUNTAIN_RESERVE_BOUNDS.readinessRestHours,
        clock = c.hour * 3600 + (c.secondOfHour ?? 0),
        reserveDeadline = clock + hours * 3600;
      const quotes = reserveKeepers.map((id) => {
          const quote = contractRenewalQuote(
              c,
              roster.find((op) => op.id === id),
              'day',
            ),
            expiry = contractExpiresSeconds(c.contracts[id]);
          assert.equal(quote.available, true, quote.reason);
          const renewals = Math.max(
            0,
            Math.floor((reserveDeadline - present(expiry)) / (present(quote.hours) * 3600)) + 1,
          );
          return { id, quote, renewals, cost: renewals * quote.price };
        }),
        cost = quotes.reduce((sum, row) => sum + row.cost, 0),
        cash = c.resources.treasury;
      assert.ok(
        cost <= cash,
        'The actual next reserve service must fit the current treasury without projected income.',
      );
      report({
        event: 'createdCuyoArsenalReserveRetentionPlan',
        ids: reserveKeepers,
        routes,
        cartHours,
        infantryReturnHours,
        preMarchRestHours,
        reserveTravelHours,
        readinessRestHours: NATIVE_MOUNTAIN_RESERVE_BOUNDS.readinessRestHours,
        hours,
        deadline: reserveDeadline,
        quotes,
        cost,
        treasury: cash,
        hour: c.hour,
        second: c.secondOfHour ?? 0,
      });
      for (const id of reserveKeepers) {
        while (present(contractExpiresSeconds(c.contracts[id])) <= reserveDeadline) {
          const quote = contractRenewalQuote(
            c,
            rosterFor(c).find((op) => op.id === id),
            'day',
          );
          assert.equal(quote.available, true, quote.reason);
          const prior = structuredClone(c.contracts[id]),
            body = structuredClone(c.operativeState[id]),
            beforeCash = c.resources.treasury,
            action = {
              type: 'renewContract',
              id,
              term: 'day',
              expectedExpiresAt: present(prior).expiresAt,
              expectedExpiresSecond: present(prior).expiresSecond ?? 0,
            };
          order(action);
          assert.equal(c.resources.treasury, beforeCash - quote.price);
          assert.equal(
            contractExpiresSeconds(c.contracts[id]),
            present(contractExpiresSeconds(prior)) + present(quote.hours) * 3600,
          );
          assert.equal(c.hour * 3600 + (c.secondOfHour ?? 0), clock);
          const physical = (record) =>
            Object.fromEntries(
              Object.entries(record).filter(
                ([key]) => !['morale', 'lastMoralePayAt', 'lastMoralePaySecond'].includes(key),
              ),
            );
          assert.deepEqual(
            physical(c.operativeState[id]),
            physical(body),
            'Quoted renewal keeps actual health, wounds, property, position and service body state.',
          );
          assert.ok(
            present(c.operativeState[id]).morale >= present(body).morale &&
              present(c.operativeState[id]).morale <= Math.min(100, present(body).morale + 2),
          );
          report({
            event: 'createdCuyoArsenalReserveRetained',
            id,
            action,
            quote,
            prior,
            contract: structuredClone(c.contracts[id]),
            paid: quote.price,
            deadline: reserveDeadline,
            hour: c.hour,
            second: c.secondOfHour ?? 0,
            treasuryBefore: beforeCash,
            treasury: c.resources.treasury,
          });
        }
      }
      assert.equal(c.resources.treasury, cash - cost);
      assert.ok(
        reserveKeepers.every((id) => present(contractExpiresSeconds(c.contracts[id])) > reserveDeadline),
      );
    }
    for (const id of columns) {
      order({ type: 'selectSquad', id });
      order({ type: 'attack', sector: 'ensenada', queue: true, mode: 'posta' });
    }
    c = completeQueuedAssault(c, columns, 'ensenada', {
      execute: (request) => {
        order(request);
        return c;
      },
    });
    assert.deepEqual(
      present(c.pendingBattle).squad.map((op) => op.id),
      field,
    );
    assert.deepEqual(present(c.pendingBattle).artillery, []);
    report({
      event: 'createdCuyoArsenalAssaultReady',
      field,
      doctors: [present(doctor).id, present(physician).id],
      reinforcements: hired.map((op) => op.id),
      hour: c.hour,
      second: c.secondOfHour,
      campaign: c,
    });
    return {
      campaign: c,
      originalSquad,
      originalMembers,
      field,
      recruits: hired.map((op) => op.id),
    };
  } catch (error) {
    recordRouteStrategicEvidence({
      helper: 'prepareCreatedCuyoArsenalAssault',
      stage: 'preparation-failure',
      campaign: c,
      inputCapture,
      error,
    });
    throw error;
  }
}

// A real routed departure is not a local member of the later care party.
// Stabilize its actual wounds first, then pay its ordinary physical return.
export function returnCreatedCuyoArsenalField(start: CampaignSnapshot, field, { report = () => {} } = {}) {
  const original = structuredClone(start),
    destination = 'ensenada',
    clock = (c: CampaignSnapshot) => c.hour * 3600 + (c.secondOfHour ?? 0);
  assert.equal(start.pendingBattle, null);
  assert.equal(start.pendingEncounter, null);
  assert.equal(start.location, destination);
  assert.ok(Array.isArray(field) && new Set(field).size === field.length);
  const survivors = field.filter((id) => living(start).includes(id)),
    remote = survivors.filter((id) => operativeLocation(start, id) !== destination);
  if (!remote.length) {
    return start;
  }
  const ledger = start.sectorStates[destination]?.returnLedger;
  for (const id of remote) {
    const arrival = present(start.operativeState[id]).arrival,
      entry = ledger?.entries.find((row) => Number(row.unitId) === id && row.kind === 'departed');
    assert.ok(
      entry &&
        entry.sector === operativeLocation(start, id) &&
        arrival?.fromSector === destination &&
        arrival.battleId === ledger.battleId &&
        arrival.exitId === entry.departure.exitId,
      'Only an actual issued field departure enters this return.',
    );
    assert.ok(
      start.squads.some((q) => q.members.includes(id) && !q.journey),
      'The departed survivor needs an actual stationary local squad.',
    );
  }
  const columns = [],
    began = clock(start),
    selected = start.activeSquadId;
  // The existing finite-care helper owns its own Native failure. Do not replace
  // an unreturned care result with the earlier input in a return-stage catch.
  let c = stabilizeCreatedCuyoSurvivors(start, { report });
  try {
    const retained = createFreshRouteOrders(
        () => c,
        (next) => {
          c = next;
        },
        { report },
      ),
      order = retained.order;
    for (const from of new Set(remote.map((id) => operativeLocation(c, id)))) {
      const remaining = remote.filter((id) => operativeLocation(c, id) === from);
      while (remaining.length) {
        const home = c.squads.find(
          (q) => q.location === from && !q.journey && q.members.includes(remaining[0]),
        );
        assert.ok(home);
        const ids = remaining.filter((id) => home.members.includes(id));
        assert.ok(ids.length && ids.length <= 6);
        assert.ok(
          ids.every(
            (id) =>
              living(c).includes(id) &&
              stable(c, id) &&
              !present(c.operativeState[id]).asleep &&
              present(c.operativeState[id]).energy > 10,
          ),
          'Every actual returning survivor needs finite stabilization before travel.',
        );
        if (home.members.every((id) => ids.includes(id))) {
          order({ type: 'selectSquad', id: home.id });
        } else {
          order({ type: 'createSquad', name: 'Regreso del arsenal', sector: from, ids });
        }
        const squadId = c.activeSquadId;
        for (const operativeId of ids) {
          order({ type: 'assignCare', operativeId, assignment: 'active' });
        }
        const preview = structuredClone(c),
          group = preview.squads.find((q) => q.id === squadId),
          journey = queueSquadTravel(preview, group, { sector: destination, mode: 'march' });
        const hours = journey.path
          .slice(1)
          .reduce((sum: number, to: string, i: string|number) => sum + travelLegHours(journey.path[i], to, journey.mode, c), 0);
        assert.ok(
          hours > 0 && hours <= 24,
          'The actual escaped field needs a bounded safe public return.',
        );
        retained.retain(hours * 3600 + 1);
        const departure = clock(c),
          bodies = new Map(ids.map((id) => [id, structuredClone(c.operativeState[id])]));
        order({ type: 'travel', sector: destination, mode: 'march', queue: true });
        assert.deepEqual(present(c.squads.find((q) => q.id === squadId)).journey, journey);
        for (
          let attempt = 0;
          attempt < 48 && present(c.squads.find((q) => q.id === squadId)).journey;
          attempt++
        ) {
          assert.ok(
            clock(c) - departure < 24 * 3600,
            'The actual return cannot exceed its public bounded clock.',
          );
          assert.equal(
            present(c.squads.find((q) => q.id === squadId)).journey.status,
            'moving',
            'A real paused return needs a new plan.',
          );
          order({ type: 'wait', hours: 1 });
        }
        assert.equal(present(c.squads.find((q) => q.id === squadId)).journey, undefined);
        assert.equal(c.location, destination);
        for (const id of ids) {
          assert.equal(operativeLocation(c, id), destination);
          assert.ok(living(c).includes(id) && stable(c, id));
          for (const key of [
            'hp',
            'bleeding',
            'medkits',
            'inventory',
            'carriedAmmo',
            'carriedLoaded',
            'ammoStock',
            'weaponDropped',
            'condition',
          ]) {
            assert.deepEqual(
              present(c.operativeState[id])[key],
              present(bodies.get(id))[key],
              `The actual return preserves ${id} ${key}`,
            );
          }
          remaining.splice(remaining.indexOf(id), 1);
        }
        columns.push({ ids, squadId, from, journey, hours, elapsedSeconds: clock(c) - departure });
      }
    }
    order({ type: 'selectSquad', id: selected });
    assert.ok(
      survivors.every((id) => living(c).includes(id) && operativeLocation(c, id) === destination),
    );
    for (const [id, r] of Object.entries(start.operativeState)) {
      if (!r.alive) {
        assert.equal(c.operativeState[id].alive, false);
      }
    }
    assert.deepEqual(start, original);
    assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
    report({
      event: 'createdCuyoEscapedFieldReturned',
      ids: remote,
      columns,
      elapsedSeconds: clock(c) - began,
      campaign: c,
    });
    return c;
  } catch (error) {
    if (error?.campaign) {
      c = error.campaign;
    }
    if (error && typeof error === 'object') {
      error.campaign = c;
    }
    recordRouteStrategicEvidence({
      helper: 'returnCreatedCuyoArsenalField',
      stage: 'preparation-failure',
      campaign: c,
      error,
      context: { field, survivors, remote, columns },
    });
    throw error;
  }
}

export function recoverCreatedCuyoMountainArtillery(
  start: CampaignSnapshot,
  {
    report = () => {},
    onCheckpoint = () => {},
    preserveMedicalReserve = false,
    coordinateRifleCover = false,
    coordinateSupportStaging = false,
    coordinateRearFormation = false,
    completedConvoyService = [],
  } = {},
) {
  const before = structuredClone(start),
    oldDeaths = Object.entries(start.operativeState)
      .filter(([, r]) => !r.alive)
      .map(([id]) => Number(id));
  const spent = Object.entries(start.artilleryDepots ?? {}).flatMap(([sector, guns]) =>
    guns
      .filter((g) => !g.loaded && !g.ammo)
      .map((g) => ({ sector, gun: storedArtilleryRecord(g) })),
  );
  const prepared = prepareCreatedCuyoArsenalAssault(start, { report, completedConvoyService });
  let c = prepared.campaign;
  onCheckpoint('arsenal-assault', c);
  const initial = enterSector(c.pendingBattle, c.sectorStates.ensenada),
    foundryField = initial.units
      .filter(
        (unit) =>
          unit.side === 'player' &&
          unit.hp > 0 &&
          prepared.originalMembers.includes(Number(unit.id)),
      )
      .map((unit) => unit.id);
  recordRouteStrategicEvidence({
    helper: 'recoverCreatedCuyoMountainArtillery',
    stage: 'route-checkpoint',
    campaign: c,
    context: {
      scope:
        'True native pre-execution input after the one existing enterSector construction; no extra queries, entry, orders or synchronization.',
      request: c.pendingBattle,
      previous: c.sectorStates.ensenada ?? null,
      initial,
      originalMembers: prepared.originalMembers,
      field: prepared.field,
    },
  });
  // Every present required founder follows behind the paid infantry. Fire,
  // reload and adjacent finite aid retain their ordinary native priorities.
  const reserveIds = foundryField;
  const rear = preserveMedicalReserve
    ? arsenalRearServicePlan(c, prepared.field, prepared.originalMembers, { fieldPhysicians: 1 })
    : null;
  const controller = recoveryPortSearchController(initial, {
    reserveIds,
    fieldPhysicianIds: rear?.fieldPhysicianIds ?? [],
    coordinateInfantry: initial.artillery.every((gun) => gun.side !== 'player'),
    coordinateRifleCover: preserveMedicalReserve || coordinateRifleCover,
    coordinateSupportStaging,
    coordinateRearFormation,
  });
  // Historical earned callers retain the old default. The fresh route opts
  // into real departure and reunion of its scarce qualified/paid reserves.
  const executeBattle = rear
    ? (request, previous, options) => {
        const deploymentOrders = [],
          observeOrder = beginRouteControllerBoundaryEvidence({
            initial,
            fieldPhysicianIds: rear.fieldPhysicianIds,
          });
        const result = fightPairedRouteBattle(c, request, previous, {
          ...options,
          observeOrder,
          deploy: (battle, executeOrder) =>
            withdrawArsenalRear(initial, rear.withdrawalIds, {
              executeOrder,
              onOrder: (action) => deploymentOrders.push(action),
            })(battle),
          onNativeResult: ({ result }) => {
            recordRouteStrategicEvidence({
              helper: 'arsenalPairedNativeResult',
              stage: 'route-checkpoint',
              campaign: c,
              context: {
                scope:
                  'Complete actual native result, full paid deployment/combat order tape and returned pair before identity or replay comparisons. No additional queries, orders, synchronization or settlement.',
                request,
                previous,
                result,
              },
            });
          },
          onExecution: ({ result, replay }) => {
            recordRouteStrategicEvidence({
              helper: 'arsenalPairedExecution',
              stage: 'route-checkpoint',
              campaign: c,
              context: {
                scope:
                  'Actual native synchronized execution and complete replay before their exact comparison; no extra orders, synchronization or queries.',
                request,
                previous,
                result,
                replay,
              },
            });
            if (result.battle.status !== 'victory') {
              recordRouteBattleFailure({
                campaign: c,
                request,
                previous,
                result,
                expectedOutcome: 'victory',
                controller,
                deploy: null,
                executeBattle: null,
              });
            }
          },
        });
        for (const id of rear.withdrawalIds) {
          const actor = result.battle.units.find((unit) => unit.id === String(id));
          assert.ok(present(actor?.hp) > 0);
          assert.equal(present(actor).departure?.destination, 'buenos_aires');
        }
        return {
          ...result,
          actions: result.actions + rear.withdrawalIds.length,
          deploymentOrders,
          medicalRear: rear,
        };
      }
    : fight;
  const victory = fightNorthernSector(c, 'ensenada', {
    controller,
    sharedFallback: controller.sharedFallback,
    executeBattle,
    report,
    ...(rear
      ? {
          beforeSettlement: (pair, { execute }) =>
            stabilizeCreatedCuyoBattleSurvivors(pair, { execute, report }),
        }
      : {}),
  });
  c = victory.campaign;
  onCheckpoint('arsenal-victory', c);
  if (rear) {
    c = stabilizeCreatedCuyoSurvivors(c, { report });
    c = reuniteArsenalRear(c, rear.withdrawalIds, { report });
    const localSurvivors = c.recruited.filter(
      (id) =>
        present(c.operativeState[id]).alive &&
        !present(c.operativeState[id]).captured &&
        present(c.operativeState[id]).location === 'ensenada',
    );
    c = recoverCreatedCuyoLocalPatients(c, localSurvivors, { restOnShortage: true, report });
    const rearReady = rear.reserveIds.every(
      (id) =>
        living(c).includes(id) &&
        present(c.operativeState[id]).location === 'ensenada' &&
        stable(c, id) &&
        present(c.operativeState[id]).hp === present(c.operativeState[id]).maxHp,
    );
    if (!rearReady) {
      const now = c.hour * 3600 + (c.secondOfHour ?? 0),
        details = rear.reserveIds.map((id) => {
          const r = c.operativeState[id],
            contract = c.contracts[id],
            expires = contractExpiresSeconds(contract);
          return {
            id,
            recruited: c.recruited.includes(id),
            alive: r?.alive,
            captured: r?.captured,
            serving: c.recruited.includes(id) && !!contract && (expires === null || expires > now),
            location: r?.location,
            hp: r?.hp,
            maxHp: r?.maxHp,
            bleeding: r?.bleeding,
            unconscious: r?.unconscious,
            routed: r?.routed,
            asleep: r?.asleep,
            energy: r?.energy,
            fatigue: r?.fatigue,
            assignment: r?.assignment,
            medkits: r?.medkits,
            contract,
            arrival: r?.arrival,
            squad: c.squads.find((q) => q.members.includes(id)),
            checks: {
              living: living(c).includes(id),
              local: r?.location === 'ensenada',
              stable: !!stable(c, id),
              fullHealth: r?.hp === r?.maxHp,
            },
          };
        });
      const error = Error(
        'Every protected rear member must return alive, local, stable and at full health: ' +
          JSON.stringify(details),
      );
      recordRouteStrategicEvidence({
        helper: 'recoverCreatedCuyoMountainArtillery',
        stage: 'preparation-failure',
        campaign: c,
        context: { rear, reserveDetails: details },
        error,
      });
      assert.ok(rearReady, error.message);
    }
    report({
      event: 'createdCuyoArsenalRearServicePreserved',
      ...rear,
      hour: c.hour,
      second: c.secondOfHour ?? 0,
      campaign: c,
    });
  }
  const survivors = prepared.field.filter(
    (id) => present(c.operativeState[id]).alive && !present(c.operativeState[id]).captured,
  );
  assert.ok(survivors.length >= 3, 'The actual field gun needs three surviving available crew.');
  assert.ok(
    prepared.originalMembers.every((id) => present(c.operativeState[id]).alive),
    'The original foundry squad must survive this side operation.',
  );
  if (!rear) {
    c = returnCreatedCuyoArsenalField(c, prepared.field, { report });
  }
  let retained = createFreshRouteOrders(
    () => c,
    (next) => {
      c = next;
    },
    { report },
  );
  const order = (action: CampaignAction) => retained.order(action);
  const endService = (id: number) => {
    const cash = c.resources.treasury;
    c = dispatchCampaign(c, { type: 'dismiss', id });
    assert.equal(c.lastError, null, c.lastError);
    assert.equal(c.resources.treasury, cash);
    // Ending a paid term must not first purchase another day for that person.
    // Rebuild retention from the actual remaining serving cohort afterward.
    retained = createFreshRouteOrders(
      () => c,
      (next) => {
        c = next;
      },
      { report },
    );
    report({
      event: 'createdCuyoArsenalServiceEnded',
      id,
      sector: 'mendoza',
      hour: c.hour,
      second: c.secondOfHour,
    });
  };
  const doctors = rosterFor(c)
    .filter((op) => survivors.includes(op.id) && op.medical > 0 && present(c.operativeState[op.id]).hp >= 15)
    .sort((a, b) => b.medical - a.medical)
    .map((op) => op.id);
  const remaining = [...survivors],
    groups: { id: string; members: (number|undefined)[]; }[] = [],
    localSlots = c.squads.filter((q) => q.location === 'ensenada' && !q.journey).map((q) => q.id);
  while (remaining.length) {
    const doctor = doctors.find((id) => remaining.includes(id));
    assert.notEqual(
      doctor,
      undefined,
      'Each actual surviving six-person care party needs a conscious member with medical skill.',
    );
    const reserved = doctors
        .filter((id) => id !== doctor && remaining.includes(id))
        .slice(0, Math.ceil(remaining.length / 6) - 1),
      ids = [doctor, ...remaining.filter((id) => id !== doctor && !reserved.includes(id))].slice(
        0,
        6,
      );
    for (const id of ids) {
      remaining.splice(remaining.indexOf(id), 1);
    }
    const slot = localSlots.find((id) => !groups.some((group) => group.id === id));
    if (slot) {
      order({ type: 'selectSquad', id: slot });
      order({ type: 'squad', ids });
    } else {
      order({
        type: 'createSquad',
        name: 'Arsenal y socorro de Barragán',
        ids,
        sector: 'ensenada',
      });
    }
    groups.push({ id: c.activeSquadId, members: ids });
  }
  for (const operativeId of survivors) {
    order({ type: 'assignCare', operativeId, assignment: 'active' });
  }
  retained.retain(8 * 3600);
  for (const group of [...groups].sort(
    (a, b) =>
      Number(
        b.members.some((id) => c.operativeState[id].hp < 15 || c.operativeState[id].bleeding),
      ) -
      Number(a.members.some((id) => c.operativeState[id].hp < 15 || c.operativeState[id].bleeding)),
  )) {
    order({ type: 'selectSquad', id: group.id });
    let care = visit(c);
    const dressings = care.battle.units
        .filter((u) => u.side === 'player')
        .reduce((sum, u) => sum + (u.medkits ?? 0), 0),
      aid = autoBandageBattle(care.battle);
    assert.equal(
      aid.battle.units
        .filter((u) => u.side === 'player')
        .reduce((sum, u) => sum + (u.medkits ?? 0), 0),
      dressings - aid.steps.filter((action) => action.type === 'useItem').length,
      'First aid consumes one actual finite dressing per treatment.',
    );
    care = sync({ campaign: care.campaign, battle: aid.battle });
    assert.deepEqual(
      aid.untreated,
      [],
      'Finite actual first aid must stabilize the surviving coastal crew.',
    );
    c = leave(care);
    report({
      event: 'createdCuyoArsenalCare',
      ids: group.members,
      treated: aid.treatedIds,
      seconds: aid.elapsedSeconds,
      dressingsSpent: aid.steps.filter((action) => action.type === 'useItem').length,
    });
  }
  assert.ok(survivors.every((id) => stable(c, id)));
  order({ type: 'selectSquad', id: present(groups.find((q) => q.members.length >= 3)).id });
  let pair = visit(c);
  const carrier = pair.battle.units
    .filter((u) => u.side === 'player' && u.hp >= 15 && !u.bleeding && !u.unconscious && !u.routed)
    .sort((a, b) => b.energy - a.energy)[0];
  assert.ok(carrier);
  pair = takeFiniteCache(pair, carrier.id, []);
  c = leave(pair);
  const source = FINITE_ARTILLERY_ARSENALS.ensenada;
  assert.deepEqual(
    present(c.sectorStates.ensenada).artillery.map(storedArtilleryRecord),
    source.pieces,
    'The one-time chest exposes only its two canonical finite guns.',
  );
  onCheckpoint('arsenal-open', c);
  for (const gun of source.pieces) {
    const quote = artilleryTransportQuote(c, 'ensenada', gun.id, 'mendoza', 'carts', 'field');
    assert.equal(quote.available, true, quote.reason);
    const cash = c.resources.treasury;
    order({
      type: 'transportArtillery',
      sector: 'ensenada',
      artilleryId: gun.id,
      to: 'mendoza',
      mode: 'carts',
      source: 'field',
    });
    assert.equal(c.resources.treasury, cash - quote.cost);
    assert.deepEqual(present(c.artilleryTransfers).find((t) => t.id === gun.id).gun, gun);
    report({
      event: 'createdCuyoArsenalShipment',
      id: gun.id,
      cost: quote.cost,
      hours: quote.hours,
      hour: c.hour,
    });
  }
  for (const group of groups) {
    order({ type: 'selectSquad', id: group.id });
    order({ type: 'travel', sector: 'mendoza', mode: 'posta', queue: true });
  }
  for (
    let hour = 0;
    hour < 168 &&
    (groups.some((group) => present(c.squads.find((q) => q.id === group.id)).journey) ||
      source.pieces.some((gun) => !present(c.artilleryDepots).mendoza?.some((g) => g.id === gun.id)));
    hour++
  ) {
    // End temporary service after the real return, while the slower carts
    // finish their paid delivery. Their exact returned kit stays in Mendoza.
    for (const id of prepared.recruits) {
      if (
        !rear?.reserveIds.includes(id) &&
        c.recruited.includes(id) &&
        present(c.operativeState[id]).alive &&
        present(c.operativeState[id]).location === 'mendoza' &&
        !c.squads.some((q) => q.members.includes(id) && q.journey)
      ) {
        endService(id);
      }
    }
    // The actual rear may arrive before its slow finite guns. Use that
    // existing delivery wait for native rest; never rest a travelling keeper
    // or replace a current patient/doctor duty. The default caller is unchanged.
    if (rear) {
      for (const id of rear.reserveIds) {
        const home = c.squads.find((q) => q.members.includes(id)),
          r = c.operativeState[id];
        if (
          home?.location !== 'mendoza' ||
          home.journey ||
          present(r).location !== 'mendoza' ||
          present(r).assignment === 'rest'
        ) {
          continue;
        }
        assert.ok(
          living(c).includes(id) && stable(c, id) && present(r).hp === present(r).maxHp,
          'An arrived rear keeper must remain actual full-health local serving personnel.',
        );
        assert.equal(
          present(r).assignment,
          'active',
          'Existing clinical or working duties must not be silently replaced by arrival rest.',
        );
        assert.equal(c.pendingBattle, null);
        assert.equal(c.pendingEncounter, null);
        // Any real due fee belongs before the zero-time assignment baseline.
        // Keep the existing all-serving retained guard and its actual day quotes.
        retained.retain();
        const body = structuredClone(c.operativeState[id]),
          terms = structuredClone(c.contracts),
          cash = c.resources.treasury,
          clock = [c.hour, c.secondOfHour ?? 0],
          action = { type: 'assignCare', operativeId: id, assignment: 'rest' };
        order(action);
        assert.equal(c.resources.treasury, cash);
        assert.deepEqual([c.hour, c.secondOfHour ?? 0], clock);
        assert.deepEqual(c.contracts, terms);
        assert.deepEqual(
          c.operativeState[id],
          { ...body, assignment: 'rest', recoveryHours: 0 },
          'Native arrival rest changes only the admitted assignment and its normal work counter.',
        );
        report({
          event: 'createdCuyoArsenalArrivalRest',
          id,
          action,
          hour: c.hour,
          second: c.secondOfHour ?? 0,
          treasury: cash,
          bodyBefore: body,
          bodyAfter: structuredClone(c.operativeState[id]),
          contract: structuredClone(c.contracts[id]),
        });
      }
    }
    const waitBefore = rear ? c.hour * 3600 + (c.secondOfHour ?? 0) : null;
    order({ type: 'wait', hours: 1 });
    if (rear) {
      const advanced = c.hour * 3600 + (c.secondOfHour ?? 0) - present(waitBefore),
        notices = [
          c.assignmentAttention?.notice,
          c.contractAttention?.notice,
          c.logisticsNotice,
          c.travelNotice,
        ].filter(Boolean);
      assert.ok(
        advanced === 0 || advanced === 3600,
        'The unchanged hourly delivery wait uses only its actual Native returned clock.',
      );
      if (!advanced) {
        assert.ok(
          notices.length,
          'A zero-time delivery pause needs an actual Native attention notice.',
        );
      }
      report({
        event: 'createdCuyoArsenalDeliveryWait',
        seconds: advanced,
        hour: c.hour,
        second: c.secondOfHour ?? 0,
        notices: structuredClone(notices),
      });
    }
  }
  assert.equal(c.location, 'mendoza');
  assert.ok(groups.every((group) => !present(c.squads.find((q) => q.id === group.id)).journey));
  if (rear) {
    c = restArsenalRear(c, rear.reserveIds, {
      maxHours: NATIVE_MOUNTAIN_RESERVE_BOUNDS.readinessRestHours,
      report,
    });
  }
  // The opt-in rear remains actual paid local service for the next mountain
  // preparation. A default temporary hire still ends service normally.
  for (const id of prepared.recruits) {
    if (!rear?.reserveIds.includes(id) && c.recruited.includes(id) && present(c.operativeState[id]).alive) {
      endService(id);
    }
  }
  for (const id of prepared.originalMembers) {
    if (!present(c.squads.find((q) => q.id === prepared.originalSquad)).members.includes(id)) {
      order({ type: 'assignToSquad', operativeId: id, squadId: prepared.originalSquad });
    }
  }
  order({ type: 'selectSquad', id: prepared.originalSquad });
  assert.deepEqual(c.squad, prepared.originalMembers);
  for (const { sector, gun } of spent) {
    assert.deepEqual(
      present(c.artilleryDepots)[sector].find((g) => g.id === gun.id),
      gun,
      'Existing spent pieces retain their original depot and exact ammunition.',
    );
  }
  for (const gun of source.pieces) {
    assert.deepEqual(
      present(c.artilleryDepots).mendoza.find((g) => g.id === gun.id),
      gun,
      'The exact two finite arsenal guns arrive without changing ammunition.',
    );
  }
  for (const id of oldDeaths) {
    assert.equal(present(c.operativeState[id]).alive, false);
  }
  assert.deepEqual(start, before);
  const selections = source.pieces.map((gun) => 'depot:' + gun.id);
  onCheckpoint('arsenal-delivered', c);
  report({
    event: 'createdCuyoMountainArsenalReady',
    selections,
    hour: c.hour,
    second: c.secondOfHour,
    campaign: c,
  });
  return { campaign: saved({ campaign: c }).campaign, selections, summary: victory.summary };
}
