import { present } from './assert-present.ts';
import type { CampaignOperative, CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import type { TacticalPoint } from '../packages/game/public/compatibility-types.ts';
import type { ActiveGame } from './local-contract-fixture.ts';
import { createFreshRouteOrders } from './fresh-route-orders.ts';
import { completeQueuedAssault, stageAssaultDeparture } from './assault-fixture.ts';
import { bankRouteIncome } from './route-income-banking.ts';
import { supplyRouteDressings } from './route-dressings.ts';
import { supplyKnownRouteDressings } from './route-known-medical-courier.ts';
import { collectRouteMedicalSupplies } from './finite-route-equipment.ts';
import { prepareRouteBattery } from './route-battery.ts';
import { recoverRoutePrimary } from './route-owned-equipment.ts';
import { transferRouteAmmunition } from './route-ammunition-transfer.ts';
import { meetRecruits } from './campaign-recruitment-route.ts';
import assert from 'node:assert/strict';
import { decodeSave, encodeSave } from '../packages/game/save.ts';
import {
  dispatchCampaign,
  rosterFor,
  dailyIncome,
  civicStatus,
} from '../packages/game/campaign.js';
import { sectorInventoryModel } from '../packages/game/sector-inventory.js';
import { carriedAmmunition } from '../packages/game/campaign-ammunition.js';
import { ammoTypeFor, ammoCount } from '../packages/game/ammo-types.js';
import { AMMUNITION_FAMILIES } from '../packages/game/ammunition-families.js';
import {
  applyItemQuantity,
  handRecord,
  extractItemQuantity,
} from '../packages/game/tactical-inventory.js';
import { planEquipLoot } from '../packages/game/tactical.js';
import {
  contractQuote,
  contractRenewalQuote,
  contractExpiresSeconds,
} from '../packages/game/contracts.js';

import { autoBandageBattle } from '../packages/game/auto-bandage.js';
import { visit, sync, leave } from './local-contract-fixture.ts';
import { supplyRouteAmmunition } from './route-ammunition.ts';
import { finishReloadsBeforeMarch } from './pre-march-reload.ts';
import { BLADES } from '../packages/game/tactical.js';
import { routeHiringCeiling } from './funded-route-fixture.ts';
import { artilleryProfile } from '../packages/game/artillery-definitions.ts';
import { worldCell, cellTravelPlan } from '../packages/game/world-cells.ts';
import { entryFromSector } from '../packages/game/tactical-exits.js';
import { campaignRole } from '../packages/game/campaign-roles.js';
import {
  careAssignmentReason,
  careAssignmentProgress,
  doctorRate,
} from '../packages/game/medical-care.js';
import {
  operativeLocation,
  operativeInTransit,
  canCreateSquad,
  canReassignOperative,
} from '../packages/game/squads.js';
import { worldOwner } from '../packages/game/world-cells.ts';
import { previewStrategicRoute } from '../packages/game/strategic-route.js';
import {
  queueSquadTravel,
  squadTravelStatus,
  travelLegHours,
  assaultNeighbor,
} from '../packages/game/squad-travel.js';
import { transportPath } from '../packages/game/logistics.js';
import { quoteMountainServiceBudget } from './mountain-service-budget.ts';
import { sleepRecovery } from '../packages/game/sleep-needs.ts';
import { sleepOrderReason } from '../packages/game/sleep.js';
import { tooTiredToMarch } from '../packages/game/march-fatigue.js';
import { recordRouteStrategicEvidence } from './route-strategic-failure-evidence.ts';
import { mountainCommandRolePlan } from './mountain-command-role-plan.ts';
import {
  prepareReturnedMountainService,
  quoteReturnedMountainAdmission,
} from './mountain-returned-service-admission.ts';
import { assertRouteEquipmentDebit } from './route-equipment-inventory-receipt.ts';

const capableMountainActor = (c: CampaignSnapshot, id: number) => {
  const r = c.operativeState[id];
  return (
    r?.alive &&
    !r.captured &&
    r.hp >= 15 &&
    !r.bleeding &&
    !r.asleep &&
    !r.unconscious &&
    !r.routed &&
    !r.surrendered &&
    r.energy > 10
  );
};

function prepareMountainDressings(
  start: CampaignSnapshot,
  recipientId: number,
  target: number,
  { reserves = {}, report, deadlineSeconds = null } = {},
) {
  let c = start;
  try {
    const stock = () =>
      present(c.operativeState[recipientId]).medkits +
      sectorInventoryModel(c, 'mendoza', rosterFor(c), recipientId)
        .entries.filter((row) => row.reachable && JSON.parse(row.expected).item === 'medkits')
        .reduce((sum, row) => sum + row.count, 0) +
      c.recruited
        .filter(
          (id: string|number) =>
            id !== recipientId &&
            c.operativeState[id].alive &&
            !c.operativeState[id].captured &&
            c.operativeState[id].location === 'mendoza' &&
            !sectorInventoryModel(c, 'mendoza', rosterFor(c), id).reason,
        )
        .reduce(
          (sum: number, id: string|number) => sum + Math.max(0, c.operativeState[id].medkits - (reserves[id] ?? 0)),
          0,
        );
    for (let deliveries = 0; stock() < target; deliveries++) {
      assert.ok(
        deliveries < target,
        'Finite medical deliveries must make progress toward the existing reserve.',
      );
      const before = stock(),
        delivery = collectRouteMedicalSupplies(c, recipientId, target - before, {
          mode: c.routes.posta ? 'posta' : 'march',
          report,
          deadlineSeconds,
        });
      c = delivery.campaign;
      assert.ok(
        delivery.collected > 0 && stock() > before,
        'An ordinary courier must debit and deliver actual finite stock.',
      );
    }
    return c;
  } catch (error) {
    recordRouteStrategicEvidence({
      helper: 'prepareMountainDressings',
      stage: 'preparation-failure',
      campaign: c,
      returnedCampaign: error.campaign,
      context: {
        recipientId,
        target,
        reserves,
        deadlineSeconds,
        scope:
          'Raw last accepted local prefix and any actual nested courier prefix; neither is adopted after failure.',
      },
      error,
    });
    throw error;
  }
}

const ownedMountainGuns = (c) =>
  [
    ...Object.values(c.artilleryDepots ?? {}).flat(),
    ...Object.values(c.sectorStates ?? {}).flatMap((scene) => scene.artillery ?? []),
  ].filter((gun) => gun.side === 'player');
function mountainBatteryRecords(c, batteryIds) {
  assert.ok(
    Array.isArray(batteryIds) &&
      batteryIds.length > 0 &&
      batteryIds.length <= 3 &&
      new Set(batteryIds).size === batteryIds.length,
    'Explicit mountain guns must be distinct finite owned identities.',
  );
  return batteryIds.map((id) => {
    const gun = ownedMountainGuns(c).find((gun) => gun.id === id);
    assert.ok(gun, `The actual mountain gun ${id} must retain canonical custody.`);
    return gun;
  });
}
function prepareMountainBattery(c: CampaignSnapshot, defaults: string[], { batteryIds, destination, keepServing, report }: { batteryIds: null; destination: string; keepServing: number[]; report: (() => void)|(() => void)|(() => void); }) {
  const records = batteryIds ? mountainBatteryRecords(c, batteryIds) : null;
  const result = prepareRouteBattery(c, records ? records.map((gun) => gun.type) : defaults, {
    destination,
    keepServing,
    report,
    ...(records
      ? {
          excludeIds: ownedMountainGuns(c)
            .filter((gun) => !present(batteryIds).includes(gun.id))
            .map((gun) => gun.id),
        }
      : {}),
  });
  if (records) {
    assert.deepEqual(
      result.selections,
      present(batteryIds).map((id: string) => 'depot:' + id),
      'The mountain column keeps the exact selected finite pieces.',
    );
  }
  return result;
}

// The extra native arsenal battle can leave only four unused replacements.
// Move healthy serving reserves from their actual friendly town and pay for
// ordinary rest. Injured clinic patients and the clinic physician stay there.
export const NATIVE_MOUNTAIN_RESERVE_BOUNDS = Object.freeze({
  count: 6,
  preMarchRestHours: 72,
  travelHours: 168,
  readinessRestHours: 600,
});

// Use one current six-replacement census. Serving commanders and physicians
// are separate roles, not replacements which can fill their own vacancy.
export function mountainReplacementCensus(c: CampaignSnapshot, { exclude = [] } = {}) {
  const excluded = new Set(exclude),
    now = c.hour * 3600 + (c.secondOfHour ?? 0);
  const rows = rosterFor(c)
    .filter((op) => op.id >= 100 && op.id < 1000)
    .map((op) => {
      const body = c.operativeState[op.id],
        serving = c.recruited.includes(op.id),
        expiry = contractExpiresSeconds(c.contracts[op.id]),
        local = serving && operativeLocation(c, op.id) === 'mendoza',
        quoted = contractQuote(c, op, 'day');
      const reason = excluded.has(op.id)
        ? 'separate-serving-role'
        : !present(body).alive
          ? 'dead'
          : present(body).captured
            ? 'captured'
            : present(body).hp !== present(body).maxHp || present(body).bleeding
              ? 'not-full-health'
              : present(body).morale < 50
                ? 'morale'
                : serving && (!local || operativeInTransit(c, op.id))
                  ? 'not-local-serving'
                  : serving && (!c.contracts[op.id] || (expiry !== null && expiry <= now))
                    ? 'service-ended'
                    : serving &&
                        (!canReassignOperative(c, op.id) ||
                          !freeMountainDuty(c, op) ||
                          !capableMountainActor(c, op.id))
                      ? 'unavailable-duty'
                      : !serving && (!quoted.available || !civicStatus(c, op.id).available)
                        ? 'unavailable-hire'
                        : null;
      return {
        op,
        quote: local ? { available: true, price: 0 } : quoted,
        daily: quoted.price,
        serving,
        local,
        reason,
      };
    });
  return { exclude: [...excluded], rows, ready: rows.filter((row) => !row.reason) };
}

const currentMountainRole = (c: CampaignSnapshot, id: number) => {
  const expiry = contractExpiresSeconds(c.contracts[id]);
  return (
    c.recruited.includes(id) &&
    c.contracts[id] &&
    (expiry === null || expiry > c.hour * 3600 + (c.secondOfHour ?? 0)) &&
    operativeLocation(c, id) === 'mendoza' &&
    !operativeInTransit(c, id) &&
    capableMountainActor(c, id)
  );
};
const freeMountainRole = (c: CampaignSnapshot, op: CampaignOperative) =>
  canReassignOperative(c, op.id) &&
  freeMountainDuty(c, op) &&
  !c.militiaTraining.some((course) => course.trainerId === op.id);

export function currentMountainServingRoles(
  c: CampaignSnapshot,
  { leaderId, physicianId, battery = false, requiredDressings = 0 },
) {
  assert.notEqual(
    leaderId,
    physicianId,
    'The serving commander and physician are distinct actual roles.',
  );
  const roster = rosterFor(c);
  const leader = roster.find((op) => op.id === leaderId),
    physician = roster.find((op) => op.id === physicianId);
  assert.ok(
    leader && currentMountainRole(c, leaderId) && leader.leadership >= 60,
    'The selected commander must remain in actual local capable service.',
  );
  assert.ok(
    physician && currentMountainRole(c, physicianId) && physician.medical >= (battery ? 60 : 20),
    'The selected physician must remain in actual local capable service with the required medical skill.',
  );
  if (battery) {
    assert.notEqual(
      physicianId,
      campaignRole(c, 'foundryEngineer')?.id,
      'The recovered battery physician cannot be its required engineer reserve.',
    );
    assert.ok(
      [leader, physician].every((op) => freeMountainRole(c, op)),
      'Both recovered-battery roles must remain free of current working duties.',
    );
  }
  assert.ok(
    (present(c.operativeState[physicianId]).medkits ?? 0) >= requiredDressings,
    'The actual selected physician must carry the finite departure dressings.',
  );
  return { leader, physician };
}

// A dual expert cannot take command when that would leave the recovered
// battery without its separate medical-60 physician. Only that physician
// excludes the engineer reserve; ordinary commander choices stay available.
export function currentMountainBatteryRoles(c: CampaignSnapshot) {
  const available = rosterFor(c).filter(
      (op) => currentMountainRole(c, op.id) && freeMountainRole(c, op),
    ),
    reserveId = campaignRole(c, 'foundryEngineer')?.id;
  const ready = (a: CampaignOperative, b: CampaignOperative) =>
    Number(present(c.operativeState[b.id]).morale >= 50) - Number(present(c.operativeState[a.id]).morale >= 50);
  const plan = mountainCommandRolePlan({
    commanders: available
      .filter((op) => op.leadership >= 60)
      .sort((a, b) => ready(a, b) || b.leadership - a.leadership || a.id - b.id),
    physicians: available
      .filter((op) => op.id !== reserveId && op.medical >= 60)
      .sort((a, b) => ready(a, b) || b.medical - a.medical || a.id - b.id),
    count: 1,
  });
  assert.ok(
    plan,
    'The recovered mountain battery needs distinct current serving command and medical-60 roles outside the physician reserve.',
  );
  return currentMountainServingRoles(c, {
    leaderId: plan.commander.id,
    physicianId: plan.doctors[0].id,
    battery: true,
  });
}
export function prepareNativeMountainReserve(
  start: CampaignSnapshot,
  { count = NATIVE_MOUNTAIN_RESERVE_BOUNDS.count, exclude = [], report = () => {} } = {},
) {
  let c = start;
  const clock = () => c.hour * 3600 + (c.secondOfHour ?? 0),
    readinessLimit = NATIVE_MOUNTAIN_RESERVE_BOUNDS.readinessRestHours * 3600;
  let census = mountainReplacementCensus(c, { exclude }),
    needed = Math.max(0, count - census.ready.length),
    readinessSeconds = 0,
    zeroTimeRest = 0;
  recordRouteStrategicEvidence({
    helper: 'prepareNativeMountainReserve',
    stage: 'preparation-input',
    campaign: c,
    context: {
      count,
      exclude,
      needed,
      census,
      bounds: NATIVE_MOUNTAIN_RESERVE_BOUNDS,
      scope:
        'Current already-computed replacement census before any reserve order or refusal; no additional Native queries or orders.',
    },
  });
  if (!needed) {
    return c;
  }
  const originalSquad = c.activeSquadId,
    retained = createFreshRouteOrders(
      () => c,
      (next) => {
        c = next;
      },
      { report },
    ),
    order = retained.order,
    columns = [];
  let localRest: number[] = [];
  const waitReadiness = () => {
    assert.ok(
      readinessSeconds + 3600 <= readinessLimit,
      'Local and arrived reserves share the existing 600-hour readiness-rest allowance.',
    );
    assert.equal(c.pendingEncounter, null);
    assert.equal(c.pendingBattle, null);
    const from = clock();
    try {
      order({ type: 'wait', hours: 1 });
    } finally {
      readinessSeconds += clock() - from;
    }
    census = mountainReplacementCensus(c, { exclude });
    needed = Math.max(0, count - census.ready.length);
    assert.ok(readinessSeconds <= readinessLimit);
    zeroTimeRest = clock() === from ? zeroTimeRest + 1 : 0;
    assert.ok(zeroTimeRest < 3, 'Repeated zero-time attention stops mountain readiness rest.');
  };
  try {
    // Restore an otherwise ready local serving replacement before seeking a
    // remote body. Current paid rest changes morale; the census never does.
    const localMoraleReserve = (op: CampaignOperative) => {
      const r = c.operativeState[op.id],
        expiry = contractExpiresSeconds(c.contracts[op.id]);
      return (
        op.id >= 100 &&
        op.id < 1000 &&
        !exclude.includes(op.id) &&
        c.recruited.includes(op.id) &&
        c.contracts[op.id] &&
        (expiry === null || expiry > clock()) &&
        operativeLocation(c, op.id) === 'mendoza' &&
        !operativeInTransit(c, op.id) &&
        canReassignOperative(c, op.id) &&
        capableMountainActor(c, op.id) &&
        present(r).hp === present(r).maxHp &&
        !present(r).bleeding &&
        present(r).morale < 50 &&
        !present(r).fatigue &&
        present(r).energy === 100 &&
        !present(r).asleep &&
        ['active', 'rest'].includes(present(r).assignment) &&
        !careAssignmentReason(c, op, 'rest')
      );
    };
    localRest = rosterFor(c)
      .filter(localMoraleReserve)
      .sort(
        (a, b) =>
          present(c.operativeState[b.id]).morale - present(c.operativeState[a.id]).morale ||
          b.marksmanship - a.marksmanship ||
          a.id - b.id,
      )
      .slice(0, needed)
      .map((op) => op.id);
    for (const operativeId of localRest) {
      if (present(c.operativeState[operativeId]).assignment !== 'rest') {
        order({ type: 'assignCare', operativeId, assignment: 'rest' });
      }
    }
    while (localRest.length && needed) {
      waitReadiness();
      if (!rosterFor(c).some((op) => localRest.includes(op.id) && localMoraleReserve(op))) {
        break;
      }
    }
    if (localRest.length) {
      report({
        event: 'mountainNativeLocalReserveRest',
        ids: localRest,
        readinessSeconds,
        readinessLimit,
        needed,
        census,
        hour: c.hour,
        second: c.secondOfHour ?? 0,
        treasury: c.resources.treasury,
      });
    }
    if (!needed) {
      return c;
    }
    const reserves = rosterFor(c)
      .filter((op) => {
        const r = c.operativeState[op.id];
        return (
          op.id >= 100 &&
          op.id < 1000 &&
          !exclude.includes(op.id) &&
          c.recruited.includes(op.id) &&
          present(r).alive &&
          !present(r).captured &&
          !present(r).routed &&
          !present(r).unconscious &&
          present(r).hp === present(r).maxHp &&
          !present(r).bleeding &&
          op.medical < 60 &&
          present(r).location !== 'mendoza' &&
          c.sectors[present(r).location]?.owner === 'patriot' &&
          !c.squads.find((q: { members: number[]; }) => q.members.includes(op.id))?.journey
        );
      })
      .sort((a, b) => b.marksmanship - a.marksmanship || a.id - b.id)
      .slice(0, needed)
      .map((op) => op.id);
    assert.equal(
      reserves.length,
      needed,
      'Enough actual healthy serving reserves must remain for the native mountain column.',
    );
    for (const sector of new Set(reserves.map((id) => present(c.operativeState[id]).location))) {
      const local = reserves.filter((id) => present(c.operativeState[id]).location === sector);
      for (let offset = 0; offset < local.length; offset += 6) {
        const ids = local.slice(offset, offset + 6);
        order({ type: 'createSquad', name: 'Reserva de la cordillera', ids, sector });
        const squadId = c.activeSquadId;
        columns.push(squadId);
        for (const operativeId of ids) {
          order({ type: 'assignCare', operativeId, assignment: 'rest' });
        }
        for (
          let hour = 0;
          hour < NATIVE_MOUNTAIN_RESERVE_BOUNDS.preMarchRestHours &&
          ids.some((id) => {
            const r = c.operativeState[id];
            return present(r).fatigue || present(r).energy < 100 || present(r).asleep;
          });
          hour++
        ) {
          assert.equal(c.pendingEncounter, null);
          order({ type: 'wait', hours: 1 });
        }
        assert.ok(
          ids.every((id) => {
            const r = c.operativeState[id];
            return !present(r).fatigue && present(r).energy === 100 && !present(r).asleep;
          }),
          'Actual reserves must finish ordinary rest before travelling.',
        );
        for (const operativeId of ids) {
          order({ type: 'assignCare', operativeId, assignment: 'active' });
        }
        const cash = c.resources.treasury;
        order({ type: 'travel', sector: 'mendoza', queue: true, mode: 'posta' });
        report({
          event: 'mountainNativeReserveTravel',
          ids,
          source: sector,
          squadId,
          bookingCost: cash - c.resources.treasury,
          hour: c.hour,
        });
      }
    }
    for (
      let hour = 0;
      hour < NATIVE_MOUNTAIN_RESERVE_BOUNDS.travelHours &&
      columns.some((id) => present(c.squads.find((q) => q.id === id)).journey);
      hour++
    ) {
      assert.equal(c.pendingEncounter, null);
      order({ type: 'wait', hours: 1 });
    }
    assert.ok(
      columns.every(
        (id) =>
          present(c.squads.find((q) => q.id === id)).location === 'mendoza' &&
          !present(c.squads.find((q) => q.id === id)).journey,
      ),
      'Actual reserves must arrive before mountain preparation.',
    );
    for (const operativeId of reserves) {
      order({ type: 'assignCare', operativeId, assignment: 'rest' });
    }
    while (
      reserves.some((id) => {
        const r = c.operativeState[id];
        return present(r).morale < 50 || present(r).fatigue || present(r).energy < 100 || present(r).asleep;
      })
    ) {
      waitReadiness();
    }
    assert.ok(
      reserves.every((id) => {
        const r = c.operativeState[id];
        return (
          present(r).alive &&
          !present(r).captured &&
          present(r).hp === present(r).maxHp &&
          !present(r).bleeding &&
          present(r).morale >= 50 &&
          !present(r).fatigue &&
          present(r).energy === 100 &&
          !present(r).asleep
        );
      }),
      'Public paid rest must restore actual reserve readiness.',
    );
    order({ type: 'selectSquad', id: originalSquad });
    report({
      event: 'mountainNativeReserveReady',
      ids: reserves,
      readinessSeconds,
      readinessLimit,
      hour: c.hour,
      second: c.secondOfHour,
      treasury: c.resources.treasury,
    });
    return c;
  } catch (error) {
    if (error && typeof error === 'object') {
      error.campaign = c;
      error.mountainReserveReadiness = {
        count,
        exclude,
        census,
        needed,
        localRest,
        readinessSeconds,
        readinessLimit,
        columns,
      };
    }
    throw error;
  }
}

// A spent rifle cannot use surviving musket cartridges. Keep its actual gun
// and rounds in the owner's pockets, and equip a known finite long gun only
// when that gun's compatible local stock meets the same readiness target.
export function supplyFreshMountainAmmunition(start, ids, { target = 12, report = () => {} } = {}) {
  assert.ok(
    Number.isSafeInteger(target) && target >= 0 && target <= 1_000_000,
    'Use a finite integer ammunition target.',
  );
  let c = structuredClone(start);
  const order = (action: CampaignAction) => {
    c = dispatchCampaign(c, action);
    assert.equal(c.lastError, null, c.lastError);
    report({
      event: 'mountainArmamentOrder',
      action,
      hour: c.hour,
      secondOfHour: c.secondOfHour ?? 0,
    });
  };
  for (const id of ids) {
    const model = () => sectorInventoryModel(c, c.location, rosterFor(c), id);
    const carried = () =>
      carriedAmmunition(
        rosterFor(c).find((op) => op.id === id),
        c.operativeState[id],
      );
    const knownRounds = (family: string) =>
      family
        ? (c.ammunitionStores[c.location]?.[family] ?? 0) +
          model()
            .entries.filter(
              (row) =>
                row.reachable &&
                JSON.parse(row.expected).kind === 'ammunition' &&
                JSON.parse(row.expected).ammoType === AMMUNITION_FAMILIES[family].type,
            )
            .reduce((sum, row) => sum + row.count, 0)
        : 0;
    const stocked = (unit: CampaignOperative&{ inventory: Record<string,import("../packages/game/public/compatibility-types.ts").EquipmentItem>; loaded: number; ammo: number; }) => {
      const family = ammoTypeFor({ ...unit, activeSlot: 'primary' });
      return family && unit.loaded + ammoCount(unit, family) + knownRounds(family) >= target;
    };
    const unit = carried();
    if (ammoTypeFor(unit) && !unit.weaponDropped && !stocked(unit)) {
      const before = model(),
        keys = new Set(Object.keys(present(before.personal).inventory ?? {}));
      const usable = (stack: { weapon: number; condition: number; }) => [1800, 1801, 1803].includes(stack.weapon) && stack.condition > 0;
      let choice = before.carried
        .filter(
          (row) =>
            row.inventoryKey &&
            row.expected &&
            usable(JSON.parse(row.expected)) &&
            row.equip?.some((option) => option.slot === 'primary' && option.valid),
        )
        .map((row) => ({
          row,
          planned: planEquipLoot(before.personal, row.inventoryKey, 'primary'),
        }))
        .find((candidate) => stocked(candidate.planned));
      if (!choice) {
        for (const row of before.entries.filter(
          (row) => row.reachable && usable(JSON.parse(row.expected)),
        )) {
          try {
            const packed = applyItemQuantity(before.personal, {
                ...JSON.parse(row.expected),
                count: 1,
              }),
              inventoryKey = Object.keys(packed.inventory).find((key) => !keys.has(key));
            if (!inventoryKey) {
              continue;
            }
            const planned = planEquipLoot(packed, inventoryKey, 'primary');
            if (stocked(planned)) {
              choice = { source: row, inventoryKey, planned };
              break;
            }
          } catch {
            continue;
          }
        }
      }
      if (choice) {
        const oldGun = handRecord(before.personal, 'primary');
        if (choice.source) {
          order({
            type: 'sectorInventory',
            sector: c.location,
            operativeId: id,
            direction: 'take',
            sourceKey: choice.source.key,
            expected: choice.source.expected,
            count: 1,
          });
        }
        const gun =
          choice.row ?? model().carried.find((row) => row.inventoryKey === choice.inventoryKey);
        assert.ok(
          present(gun?.equip).some((option) => option.slot === 'primary' && option.valid),
          'the actual finite replacement must remain admitted',
        );
        order({
          type: 'sectorInventory',
          sector: c.location,
          operativeId: id,
          direction: 'equip',
          inventoryKey: gun.inventoryKey,
          expected: gun.expected,
          slot: 'primary',
        });
        assert.deepEqual(
          handRecord(model().personal, 'primary'),
          handRecord(choice.planned, 'primary'),
          'replacement keeps the actual finite firearm metadata',
        );
        assert.ok(
          Object.values(c.operativeState[id].inventory).some((item) =>
            Object.entries(oldGun).every(
              ([key, value]) => JSON.stringify(item[key]) === JSON.stringify(value),
            ),
          ),
          'the previous firearm and its load remain carried',
        );
        report({
          event: 'mountainFiniteArmament',
          operativeId: id,
          oldWeapon: oldGun.weapon,
          weapon: carried().weapon,
          sourceKey: choice.source?.key ?? null,
          inventoryKey: gun.inventoryKey,
        });
      }
    }
    // Allocate each actor in order so several rifles cannot claim the same last
    // loose rounds. The original finite helper retains its shortage refusal.
    const family = ammoTypeFor({ ...carried(), activeSlot: 'primary' });
    let shortage = family
      ? Math.max(0, target - carried().loaded - ammoCount(carried(), family) - knownRounds(family))
      : 0;
    if (shortage) {
      for (const donorId of c.recruited.filter((donorId) => !ids.includes(donorId))) {
        const record = c.operativeState[donorId];
        if (
          !record?.alive ||
          record.captured ||
          record.location !== c.location ||
          sectorInventoryModel(c, c.location, rosterFor(c), donorId).reason
        ) {
          continue;
        }
        const reserve = ammoCount(
            carriedAmmunition(
              rosterFor(c).find((op) => op.id === donorId),
              record,
            ),
            family,
          ),
          count = Math.min(shortage, Math.max(0, reserve - 2));
        if (count) {
          c = transferRouteAmmunition(c, {
            recipientId: id,
            donorIds: [donorId],
            family,
            count,
            report,
          }).campaign;
          shortage -= count;
        }
        if (!shortage) {
          break;
        }
      }
    }
    c = supplyRouteAmmunition(c, [id], { target, report }).campaign;
  }
  return c;
}

// Preserve the real partial care report before checking completion or leaving.
// A stopped approach can already have paid time, wounds and finite dressings.
export function performFreshMountainFirstAid(
  opened: ActiveGame,
  { stage = 'mountain-first-aid', report = () => {}, saveMidpoint = false } = {},
) {
  const aid = autoBandageBattle(opened.battle);
  // autoBandageBattle stops at the first rejection and includes that final
  // attempt in steps. It has no paid effects and is outside the accepted trace.
  const rejectedStep =
    aid.battle.lastError && aid.steps.length
      ? { action: aid.steps.at(-1), reason: aid.battle.lastError }
      : null;
  const steps = rejectedStep ? aid.steps.slice(0, -1) : aid.steps;
  report({
    event: 'freshMountainAidOrders',
    stage,
    steps,
    attemptedSteps: aid.steps,
    rejectedStep,
    clockSynchronized: false,
    campaign: opened.campaign,
    battle: aid.battle,
    stoppedReason: aid.stoppedReason,
    untreated: aid.untreated,
  });
  const partial = sync({ campaign: opened.campaign, battle: aid.battle });
  report({
    event: 'freshMountainAidCheckpoint',
    stage,
    steps,
    rejectedStep,
    clockSynchronized: true,
    ...partial,
  });
  if (rejectedStep || aid.stoppedReason || aid.untreated.length) {
    const reason =
      rejectedStep?.reason ?? aid.stoppedReason ?? 'Finite first aid left untreated survivors.';
    report({
      event: 'freshRouteStopped',
      stage,
      reason,
      steps,
      rejectedStep,
      untreated: aid.untreated,
      ...partial,
    });
    const error = Error(reason);
    error.pair = partial;
    error.steps = steps;
    throw error;
  }
  // Only a complete successful treatment enters the official midpoint codec.
  // Keep a stopped pair as raw evidence, never as a new playable input.
  const admitted = saveMidpoint
    ? decodeSave(encodeSave(partial.campaign, partial.battle))
    : partial;
  if (saveMidpoint) {
    report({ event: 'freshMountainAidSavedMidpoint', stage, ...admitted });
  }
  return leave(admitted);
}

// A cleared field can contain more than one real home. A critical-only home
// cannot enter alone: borrow the actual local physicians for finite care, then
// restore every home before another batch. No ninth squad or new body is made.
export function performFreshMountainLocalFirstAid(
  start: CampaignSnapshot,
  { sector = 'los_patos', report = () => {} } = {},
) {
  let c = decodeSave(encodeSave(start)).campaign;
  const local = c.recruited.filter(
      (id) =>
        present(c.operativeState[id]).alive &&
        !present(c.operativeState[id]).captured &&
        operativeLocation(c, id) === sector,
    ),
    selected = c.activeSquadId;
  const homes = c.squads
    .filter((home) => home.members.some((id) => local.includes(id)))
    .map((home) => structuredClone(home));
  const duties = local.map((id) => ({ id, assignment: present(c.operativeState[id]).assignment })),
    receipt = {
      sector,
      local: [...local],
      homes: structuredClone(homes),
      duties: structuredClone(duties),
      selected,
      orders: [],
      groups: [],
      completed: false,
    };
  const emit = (event) => {
    if (['freshRouteOrder', 'freshRouteRenewal'].includes(event.event)) {
      receipt.orders.push({
        action: structuredClone(event.action),
        hour: event.hour,
        second: event.second,
      });
    }
    report(event);
  };
  const retained = createFreshRouteOrders(
      () => c,
      (next) => {
        c = next;
      },
      { report: emit },
    ),
    order = retained.order;
  const needsAid = (id: string|number) => {
    const r = c.operativeState[id];
    return r.hp < 15 || r.bleeding > 0 || (r.bandaged ?? 0) < r.maxHp - r.hp;
  };
  const stableDoctor = (op: CampaignOperative) =>
    local.includes(op.id) &&
    op.medical > 0 &&
    capableMountainActor(c, op.id) &&
    canReassignOperative(c, op.id);
  const restore = () => {
    for (const home of homes) {
      order({ type: 'selectSquad', id: home.id });
      order({ type: 'squad', ids: home.members });
    }
    for (const { id, assignment } of duties) {
      if (present(c.operativeState[id]).assignment !== assignment) {
        order({ type: 'assignCare', operativeId: id, assignment });
      }
    }
    if (c.activeSquadId !== selected) {
      order({ type: 'selectSquad', id: selected });
    }
    for (const home of homes) {
      assert.deepEqual(
        c.squads.find((current) => current.id === home.id),
        home,
        'Finite field care restores each original local home and its member order.',
      );
    }
  };
  try {
    assert.equal(c.pendingBattle, null);
    assert.equal(c.pendingEncounter, null);
    assert.ok(
      local.length > 6,
      'The multi-home seam does not replace the existing small-force route.',
    );
    assert.ok(
      homes.length &&
        homes.every((home) => home.location === sector && !home.journey) &&
        local.every((id) => homes.some((home) => home.members.includes(id))),
      'Every patient and physician must already have an actual local home.',
    );
    if (local.some((id) => present(c.operativeState[id]).hp < 15 || present(c.operativeState[id]).bleeding)) {
      // Keep the prior finite pickup rule. Scene coordinates only order current
      // known physicians; a first visit supplies its own Native positions.
      const scene = c.sectorStates[sector],
        patients = (scene?.units ?? []).filter(
          (unit) => local.includes(Number(unit.id)) && (unit.hp < 15 || unit.bleeding),
        );
      const distance = (id: number) => {
        const unit = scene?.units.find((unit) => unit.id === String(id));
        return unit && patients.length
          ? Math.min(
              ...patients.map((patient: TacticalPoint) => Math.hypot(unit.x - patient.x, unit.y - patient.y)),
            )
          : Infinity;
      };
      for (const doctor of rosterFor(c)
        .filter(stableDoctor)
        .sort((a, b) => distance(a.id) - distance(b.id) || b.medical - a.medical || a.id - b.id)) {
        for (let taken = 0; present(c.operativeState[doctor.id]).medkits < 3; taken++) {
          assert.ok(
            taken < 3,
            'Each accepted physical pickup adds one real dressing toward the existing three-piece floor.',
          );
          const model = sectorInventoryModel(c, sector, rosterFor(c), doctor.id),
            source = model.entries.find(
              (row) => row.reachable && JSON.parse(row.expected).item === 'medkits',
            );
          if (!source) {
            break;
          }
          const before = { hour: c.hour, second: c.secondOfHour, treasury: c.resources.treasury },
            carried = present(c.operativeState[doctor.id]).medkits;
          order({
            type: 'sectorInventory',
            sector,
            operativeId: doctor.id,
            direction: 'take',
            sourceKey: source.key,
            expected: source.expected,
            count: 1,
          });
          const remaining = assertRouteEquipmentDebit(
            model,
            sectorInventoryModel(c, sector, rosterFor(c), doctor.id),
            source,
          );
          assert.equal(present(c.operativeState[doctor.id]).medkits, carried + 1);
          assert.deepEqual(
            { hour: c.hour, second: c.secondOfHour, treasury: c.resources.treasury },
            before,
          );
          report({
            event: 'andesFiniteDressingsRecovered',
            operativeId: doctor.id,
            sourceKey: source.key,
            count: 1,
            sourceCount: source.count,
            remaining,
            ...before,
          });
        }
      }
    }
    const pending = local
      .filter(needsAid)
      .sort(
        (a, b) =>
          Number(present(c.operativeState[a]).hp >= 15) - Number(present(c.operativeState[b]).hp >= 15) ||
          present(c.operativeState[a]).hp - present(c.operativeState[b]).hp ||
          a - b,
      );
    while (pending.length) {
      assert.ok(
        receipt.groups.length < local.length,
        'Each successful actual batch must finish at least one previously pending patient.',
      );
      const doctors = rosterFor(c)
        .filter((op) => stableDoctor(op) && present(c.operativeState[op.id]).medkits > 0)
        .sort(
          (a, b) =>
            b.medical - a.medical ||
            present(c.operativeState[b.id]).medkits - present(c.operativeState[a.id]).medkits ||
            a.id - b.id,
        )
        .slice(0, 5);
      assert.ok(
        doctors.length,
        'Actual multi-home survivors need a conscious local physician with finite dressings.',
      );
      const ids = doctors.map((op) => op.id);
      for (const id of pending) {
        if (!ids.includes(id) && ids.length < 6) {
          ids.push(id);
        }
      }
      assert.ok(
        ids.length <= 6 && pending.some((id) => ids.includes(id)),
        'The actual care cohort must include a pending patient within the normal six-person limit.',
      );
      const home = homes.find((home) => home.members.includes(pending[0]));
      const group = {
        homeId: present(home).id,
        ids: [...ids],
        patients: pending.filter((id) => ids.includes(id)),
        from: c.hour * 3600 + (c.secondOfHour ?? 0),
        kitsBefore: ids.reduce((sum, id) => sum + present(c.operativeState[id]).medkits, 0),
      };
      receipt.groups.push(group);
      order({ type: 'selectSquad', id: present(home).id });
      order({ type: 'squad', ids });
      for (const operativeId of ids) {
        if (present(c.operativeState[operativeId]).assignment !== 'active') {
          order({ type: 'assignCare', operativeId, assignment: 'active' });
        }
      }
      const opened = visit(c);
      report({
        event: 'freshMountainLocalAidVisit',
        sector,
        group: structuredClone(group),
        ...opened,
      });
      c = performFreshMountainFirstAid(opened, {
        stage: 'los-patos-multi-home-first-aid',
        saveMidpoint: true,
        report,
      });
      group.to = c.hour * 3600 + (c.secondOfHour ?? 0);
      group.kitsAfter = ids.reduce((sum, id) => sum + present(c.operativeState[id]).medkits, 0);
      assert.ok(
        group.kitsAfter < group.kitsBefore,
        'Every nonempty successful batch spends actual carried dressings.',
      );
      for (const id of group.patients) {
        assert.ok(present(c.operativeState[id]).alive && present(c.operativeState[id]).hp >= 15);
        assert.equal(present(c.operativeState[id]).bleeding, 0);
      }
      report({
        event: 'freshMountainLocalAidDeparted',
        sector,
        group: structuredClone(group),
        campaign: c,
      });
      for (let i = pending.length - 1; i >= 0; i--) {
        if (ids.includes(pending[i])) {
          pending.splice(i, 1);
        }
      }
      restore();
    }
    for (const id of local) {
      assert.ok(
        present(c.operativeState[id]).alive &&
          c.recruited.includes(id) &&
          operativeLocation(c, id) === sector,
      );
      assert.ok(present(c.operativeState[id]).hp >= 15);
      assert.equal(present(c.operativeState[id]).bleeding, 0);
    }
    assert.deepEqual(c.recruited, start.recruited);
    assert.deepEqual(c.squads, start.squads);
    assert.equal(c.activeSquadId, selected);
    assert.deepEqual(
      duties,
      local.map((id) => ({ id, assignment: present(c.operativeState[id]).assignment })),
    );
    receipt.completed = true;
    report({ event: 'freshMountainLocalAidCompleted', receipt: structuredClone(receipt) });
    return c;
  } catch (error) {
    error.campaign = error.pair?.campaign ?? c;
    error.mountainLocalAid = structuredClone(receipt);
    recordRouteStrategicEvidence({
      helper: 'performFreshMountainLocalFirstAid',
      stage: 'preparation-failure',
      campaign: c,
      returnedCampaign: error.campaign,
      context: {
        receipt,
        stoppedPair: error.pair ?? null,
        scope:
          'Actual last accepted strategic prefix and raw failed aid pair only; never replay or adopt after refusal.',
      },
      error,
    });
    throw error;
  }
}

// Choose a complete column at current quotes. The banked treasury also pays
// for finite supplies; Los Patos reserves a second day for its longer march.
function affordableMountainColumn(
  c: CampaignSnapshot,
  count: number,
  {
    reserve = 1500,
    paidDays = 1,
    exclude = [],
    preferRetention = false,
    replacementCensus = null,
  } = {},
) {
  const budget = Math.max(0, (c.resources.treasury - reserve) / paidDays);
  const candidates = (
    replacementCensus?.ready ??
    rosterFor(c)
      .map((op) => ({
        op,
        quote:
          c.recruited.includes(op.id) && present(c.operativeState[op.id]).location === 'mendoza'
            ? { available: true, price: 0 }
            : contractQuote(c, op, 'day'),
      }))
      .filter(({ op, quote }) => {
        const unit = c.operativeState[op.id];
        return (
          op.id >= 100 &&
          op.id < 1000 &&
          !exclude.includes(op.id) &&
          present(unit).alive &&
          !present(unit).captured &&
          present(unit).hp === present(unit).maxHp &&
          present(unit).morale >= 50 &&
          quote.available &&
          quote.price <= budget &&
          (!preferRetention ||
            !c.recruited.includes(op.id) ||
            (freeMountainDuty(c, op) && canReassignOperative(c, op.id)))
        );
      })
      .map((row) => ({ ...row, daily: contractQuote(c, row.op, 'day').price }))
  )
    .filter((row: { quote: { price: number; }; }) => row.quote.price <= budget)
    .sort((a: { daily: number; op: { marksmanship: number; }; quote: { price: number; }; }, b: { daily: number; op: { marksmanship: number; }; quote: { price: number; }; }) =>
      preferRetention
        ? a.daily - b.daily || b.op.marksmanship - a.op.marksmanship
        : b.op.marksmanship - a.op.marksmanship || a.quote.price - b.quote.price,
    );
  recordRouteStrategicEvidence({
    helper: 'affordableMountainColumn',
    stage: 'preparation-input',
    campaign: c,
    context: {
      count,
      reserve,
      paidDays,
      exclude,
      budget,
      preferRetention,
      candidates,
      ...(replacementCensus ? { replacementCensus } : {}),
      scope:
        'Current already-computed candidate quotes before the unchanged finite combination search; no additional Native queries or orders.',
    },
  });
  let best = null;
  const choose = (offset, selected, price, score, daily = 0) => {
    if (selected.length === count) {
      if (
        !best ||
        (preferRetention && daily < best.daily) ||
        ((!preferRetention || daily === best.daily) &&
          (score > best.score || (score === best.score && price < best.price)))
      ) {
        best = { ids: selected.map((row) => row.op.id), price, score, daily };
      }
      return;
    }
    if (candidates.length - offset < count - selected.length) {
      return;
    }
    for (let i = offset; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (price + candidate.quote.price > budget) {
        continue;
      }
      choose(
        i + 1,
        [...selected, candidate],
        price + candidate.quote.price,
        score + candidate.op.marksmanship + candidate.op.medical * 0.05,
        daily + candidate.daily,
      );
    }
  };
  choose(0, [], 0, 0);
  assert.ok(
    best,
    `${count} ready replacements must fit actual quotes, ${paidDays} paid days and the supply reserve`,
  );
  return best;
}

function restorePaidMountainVeterans(start: CampaignSnapshot, { report = () => {} } = {}) {
  let c = start;
  const retained = createFreshRouteOrders(
    () => c,
    (next) => {
      c = next;
    },
    { report },
  );
  const order = retained.order;
  const veterans = rosterFor(c)
    .filter((op) => {
      const unit = c.operativeState[op.id],
        quote = contractQuote(c, op, 'day');
      return (
        op.id >= 100 &&
        op.id < 1000 &&
        !c.recruited.includes(op.id) &&
        present(unit).alive &&
        !present(unit).captured &&
        present(unit).location &&
        present(unit).hp === present(unit).maxHp &&
        !present(unit).bleeding &&
        present(unit).morale < 50 &&
        quote.available &&
        quote.price <= routeHiringCeiling(c, 100)
      );
    })
    .sort((a, b) => b.marksmanship - a.marksmanship)
    .slice(0, 6)
    .map((op) => op.id);
  if (!veterans.length) {
    return c;
  }
  for (const id of veterans) {
    const quote = contractQuote(
        c,
        rosterFor(c).find((op) => op.id === id),
        'week',
      ),
      cash = c.resources.treasury,
      source = present(c.operativeState[id]).location,
      destination = c.sectors[source]?.owner === 'patriot' ? source : 'mendoza';
    order({ type: 'recruitCivic', id, term: 'week', destination });
    assert.equal(c.resources.treasury, cash - quote.price);
    report({
      event: 'mountainVeteranRehired',
      id,
      price: quote.price,
      hour: c.hour,
      morale: present(c.operativeState[id]).morale,
      source,
      destination,
    });
  }
  for (let h = 0; h < 24 && veterans.some((id) => !c.recruited.includes(id)); h++) {
    assert.equal(c.pendingEncounter, null);
    order({ type: 'wait', hours: 1 });
  }
  const columns = [];
  for (const sector of new Set(veterans.map((id) => present(c.operativeState[id]).location))) {
    const local = veterans.filter((id) => present(c.operativeState[id]).location === sector);
    for (let offset = 0; offset < local.length; offset += 6) {
      const members = local.slice(offset, offset + 6);
      order({ type: 'createSquad', name: 'Veteranos de Mendoza', ids: members, sector });
      columns.push(c.activeSquadId);
      if (sector !== 'mendoza') {
        for (const operativeId of members) {
          order({ type: 'assignCare', operativeId, assignment: 'active' });
        }
        order({ type: 'travel', sector: 'mendoza', mode: 'posta', queue: true });
      }
    }
  }
  for (let h = 0; h < 48 && columns.some((id) => c.squads.find((q) => q.id === id)?.journey); h++) {
    assert.equal(c.pendingEncounter, null);
    order({ type: 'wait', hours: 1 });
  }
  for (const operativeId of veterans) {
    assert.ok(c.recruited.includes(operativeId));
    assert.equal(present(c.operativeState[operativeId]).location, 'mendoza');
    order({ type: 'assignCare', operativeId, assignment: 'rest' });
  }
  for (let h = 0; h < 600 && veterans.some((id) => present(c.operativeState[id]).morale < 50); h++) {
    assert.equal(c.pendingEncounter, null);
    order({ type: 'wait', hours: 1 });
  }
  for (const id of veterans) {
    assert.ok(present(c.operativeState[id]).alive);
    assert.equal(present(c.operativeState[id]).hp, present(c.operativeState[id]).maxHp);
    assert.ok(present(c.operativeState[id]).morale >= 50);
  }
  report({
    event: 'mountainVeteransRested',
    hour: c.hour,
    treasury: c.resources.treasury,
    units: veterans.map((id) => ({
      id,
      morale: present(c.operativeState[id]).morale,
      expiresAt: present(c.contracts[id]).expiresAt,
    })),
  });
  return c;
}

export function collectReturnedMountainKit(start, ids, { report = () => {} } = {}) {
  let c = start;
  const originalRoster = rosterFor(c);
  const retained = createFreshRouteOrders(
    () => c,
    (next) => {
      c = next;
    },
    { report },
  );
  const order = retained.order;
  for (const operativeId of ids) {
    for (const slot of ['headwear', 'outfit', 'legwear', 'blade']) {
      const operative = rosterFor(c).find((op) => op.id === operativeId);
      const worn = slot === 'blade' ? present(operative).blade : c.operativeState[operativeId][slot];
      // Local permanent recruits retain deliberate native empty clothing slots.
      // Paid returned kits, broken worn garments and blades still need real stock.
      if (
        slot !== 'blade' &&
        worn === null &&
        present(operative).recruitmentSource === 'encounter' &&
        c.contracts[operativeId]?.kind === 'patriot' &&
        c.contracts[operativeId].expiresAt === null
      ) {
        continue;
      }
      if (slot === 'blade' ? worn > 0 : worn?.condition > 0) {
        continue;
      }
      const blade = originalRoster.find((op) => op.id === operativeId)?.blade;
      const matches = (record: { weapon: string|number; kind: string; outfit: string|undefined; }) =>
        slot === 'blade'
          ? !!BLADES[record.weapon] && (!blade || record.weapon === blade)
          : record.kind === 'outfit' &&
            record.outfit === { headwear: 'hat', outfit: 'poncho', legwear: 'trousers' }[slot];
      const usable = (row) =>
        row.inventoryKey &&
        matches(JSON.parse(row.expected)) &&
        row.equip.some((choice) => choice.slot === slot && choice.valid);
      // Pay due serving terms before quoting the zero-time physical collection.
      retained.retain();
      let model = sectorInventoryModel(c, 'mendoza', rosterFor(c), operativeId),
        carried = model.carried.find(usable),
        receipt = null;
      if (!carried) {
        const source = model.entries
          .filter((row) => row.reachable && matches(JSON.parse(row.expected)))
          .sort(
            (a, b) =>
              Number(b.key.startsWith('ground:service-return-')) -
              Number(a.key.startsWith('ground:service-return-')),
          )[0];
        assert.ok(source, `a real local source must supply ${operativeId}'s missing ${slot}`);
        const before = { hour: c.hour, second: c.secondOfHour, treasury: c.resources.treasury },
          stockBefore = model;
        order({
          type: 'sectorInventory',
          sector: 'mendoza',
          operativeId,
          direction: 'take',
          sourceKey: source.key,
          expected: source.expected,
          count: 1,
        });
        model = sectorInventoryModel(c, 'mendoza', rosterFor(c), operativeId);
        carried = model.carried.find(usable);
        assert.ok(carried);
        const { item, ...record } = JSON.parse(source.expected);
        assert.deepEqual(
          JSON.parse(carried.expected),
          record,
          'collection preserves the actual returned item',
        );
        const remaining = assertRouteEquipmentDebit(stockBefore, model, source);
        assert.deepEqual(
          { hour: c.hour, second: c.secondOfHour, treasury: c.resources.treasury },
          before,
          'local collection does not change time or treasury',
        );
        receipt = {
          event: 'mountainReturnedKit',
          operativeId,
          slot,
          sourceKey: source.key,
          record,
          sourceCount: source.count,
          remaining,
          ...before,
        };
      }
      const record = JSON.parse(carried.expected);
      order({
        type: 'sectorInventory',
        sector: 'mendoza',
        operativeId,
        direction: 'equip',
        inventoryKey: carried.inventoryKey,
        expected: carried.expected,
        slot,
      });
      if (slot === 'blade') {
        assert.equal(present(rosterFor(c).find((op) => op.id === operativeId)).blade, record.weapon);
      } else {
        assert.deepEqual(
          c.operativeState[operativeId][slot],
          record,
          'equipment retains the collected clothing metadata',
        );
      }
      if (receipt) {
        report(receipt);
      }
    }
  }
  return c;
}

// Normal funding, equipment, timed approaches and explicitly coordinated squads.
export function prepareFreshUspallataAssault(
  start: CampaignSnapshot,
  { guns = 2, batteryIds = null, report = () => {} } = {},
) {
  let c = decodeSave(encodeSave(start)).campaign;
  const retained = createFreshRouteOrders(
    () => c,
    (next) => {
      c = next;
    },
    { report },
  );
  const order = retained.order;
  let leader = rosterFor(c)
    .filter(
      (op) => c.recruited.includes(op.id) && capableMountainActor(c, op.id) && op.leadership >= 60,
    )
    .sort(
      (a, b) =>
        Number(present(c.operativeState[b.id]).morale >= 50) - Number(present(c.operativeState[a.id]).morale >= 50) ||
        Number(present(c.operativeState[b.id]).location === 'mendoza') -
          Number(present(c.operativeState[a.id]).location === 'mendoza') ||
        b.leadership - a.leadership ||
        a.id - b.id,
    )[0];
  assert.ok(leader, 'the actual mountain column needs a serving capable leader');
  const leaderSquad = c.squads.find((q) => q.members.includes(present(leader).id) && !q.journey);
  if (leaderSquad) {
    order({ type: 'selectSquad', id: leaderSquad.id });
  } else {
    order({
      type: 'createSquad',
      name: 'Comando de la cordillera',
      ids: [leader.id],
      sector: present(c.operativeState[leader.id]).location,
    });
  }
  for (const operativeId of c.squad) {
    order({ type: 'assignCare', operativeId, assignment: 'active' });
  }
  if (c.location !== 'mendoza') {
    order({ type: 'travel', sector: 'mendoza', mode: 'posta' });
  }
  report({
    event: 'mountainServingLeader',
    id: leader.id,
    hour: c.hour,
    second: c.secondOfHour ?? 0,
    location: present(c.operativeState[leader.id]).location,
  });
  const locals = c.recruited.filter((id) => {
    const r = c.operativeState[id];
    return present(r).alive && !present(r).captured && present(r).location === 'mendoza';
  });
  c = bankRouteIncome(c, 400, { keepIds: retained.keepIds(), report });
  order({ type: 'diplomacy', kind: 'parliament' });
  order({ type: 'fortify', sector: 'mendoza' });
  for (const operativeId of locals) {
    order({ type: 'assignCare', operativeId, assignment: 'rest' });
  }
  c = bankRouteIncome(c, 12000, { keepIds: retained.keepIds(), report });
  c = restorePaidMountainVeterans(c, { report });
  // Contracts can expire while the treasury recovers. Select a physician who
  // is still in service at departure, rather than keeping a stale roster entry.
  let physician;
  if (batteryIds) {
    ({ leader, physician } = currentMountainBatteryRoles(c));
  } else {
    physician = rosterFor(c)
      .filter(
        (op) =>
          c.recruited.includes(op.id) &&
          capableMountainActor(c, op.id) &&
          present(c.operativeState[op.id]).location === 'mendoza' &&
          op.id !== present(leader).id &&
          op.medical >= 20,
      )
      .sort(
        (a, b) =>
          Number(present(c.operativeState[b.id]).morale >= 50) -
            Number(present(c.operativeState[a.id]).morale >= 50) ||
          b.medical - a.medical ||
          a.id - b.id,
      )[0];
    assert.ok(physician, 'the mountain column needs a living local medic');
  }
  const roleIds = {
      leaderId: leader.id,
      physicianId: physician.id,
      ...(batteryIds ? { battery: true } : {}),
    },
    excludedRoles = [leader.id, physician.id];
  ({ leader, physician } = currentMountainServingRoles(c, roleIds));
  if (batteryIds) {
    c = prepareNativeMountainReserve(c, { exclude: excludedRoles, report });
  }
  for (let i = 0; i < 24 && (c.hour % 24 < 6 || c.hour % 24 > 10); i++) {
    order({ type: 'wait', hours: 1 });
  }
  ({ leader, physician } = currentMountainServingRoles(c, roleIds));
  const column = affordableMountainColumn(c, 6, {
      exclude: excludedRoles,
      replacementCensus: mountainReplacementCensus(c, { exclude: excludedRoles }),
    }),
    recruits = column.ids;
  assert.equal(recruits.length, 6, 'six living and ready replacements must accept paid contracts');
  report({
    event: 'mountainPaidColumn',
    sector: 'uspallata',
    ids: recruits,
    price: column.price,
    hour: c.hour,
    treasury: c.resources.treasury,
  });
  const rearm = recruits.filter(
    (id: number) => ![1800, 1801, 1802].includes(present(rosterFor(c).find((op) => op.id === id)).weapon),
  );
  for (let h = 0; h < 24 && (c.hour % 24 < 6 || c.hour % 24 > 10); h++) {
    order({ type: 'wait', hours: 1 });
  }
  for (const id of recruits) {
    if (c.recruited.includes(id)) {
      continue;
    }
    retained.retain();
    const quote = contractQuote(
        c,
        rosterFor(c).find((op) => op.id === id),
        'day',
      ),
      cash = c.resources.treasury;
    order({ type: 'recruitCivic', id, term: 'day' });
    assert.equal(c.resources.treasury, cash - quote.price);
  }
  for (let h = 0; h < 24 && recruits.some((id: number) => !c.recruited.includes(id)); h++) {
    order({ type: 'wait', hours: 1 });
  }
  assert.ok(
    recruits.every((id: number) => c.recruited.includes(id)),
    'paid replacements must arrive before receiving equipment',
  );
  c = collectReturnedMountainKit(c, recruits, { report });
  for (const operativeId of rearm) {
    c = recoverRoutePrimary(c, operativeId, { preferredWeapon: 1801, replace: true, report });
  }
  order({ type: 'squad', ids: [leader.id, physician.id, ...recruits.slice(0, 4)] });
  const main = c.activeSquadId;
  order({
    type: 'createSquad',
    name: 'Apoyo de la cordillera',
    ids: recruits.slice(4),
    sector: 'mendoza',
  });
  const support = c.activeSquadId,
    columns = [main, support];
  const field = [leader.id, physician.id, ...recruits];
  // Redistribute actual remaining field dressings and known local cartridges.
  c = prepareMountainDressings(c, physician.id, 15, { report });
  c = supplyKnownRouteDressings(c, physician.id, 15, { report });
  // Finish real reloads before attaching the recovered reserve battery.
  c = supplyFreshMountainAmmunition(c, field, { target: 12, report });
  for (const operativeId of field) {
    order({ type: 'assignCare', operativeId, assignment: 'rest' });
  }
  for (
    let h = 0;
    h < 48 &&
    field.some((id) => {
      const r = c.operativeState[id];
      return present(r).energy < 100 || present(r).fatigue || present(r).asleep;
    });
    h++
  ) {
    order({ type: 'wait', hours: 1 });
  }
  assert.ok(
    field.every((id) => {
      const r = c.operativeState[id];
      return present(r).energy === 100 && !present(r).fatigue && !present(r).asleep;
    }),
    'Actual field reserves must finish ordinary rest before departure.',
  );
  order({ type: 'configureArtillery', types: [] });
  for (const id of columns) {
    order({ type: 'selectSquad', id });
    for (const operativeId of c.squad) {
      order({ type: 'assignCare', operativeId, assignment: 'active' });
    }
    c = finishReloadsBeforeMarch(c);
  }
  order({ type: 'selectSquad', id: main });
  if (batteryIds) {
    assert.equal(batteryIds.length, guns);
    assert.ok(
      mountainBatteryRecords(c, batteryIds).every((gun) => gun.loaded || gun.ammo > 0),
      'Explicit Uspallata support must carry actual remaining rounds.',
    );
  }
  const battery = prepareMountainBattery(
    c,
    Array.from({ length: guns }, () => 'bronze4'),
    { batteryIds, destination: 'mendoza', keepServing: retained.keepIds(), report },
  );
  c = battery.campaign;
  order({ type: 'configureArtillery', types: battery.selections });
  if (batteryIds) {
    ({ leader, physician } = currentMountainServingRoles(c, { ...roleIds, requiredDressings: 15 }));
  }
  for (const id of columns) {
    order({ type: 'selectSquad', id });
    for (const operativeId of c.squad) {
      order({ type: 'assignCare', operativeId, assignment: 'active' });
    }
    order({ type: 'attack', sector: 'uspallata', queue: true, mode: 'posta' });
  }
  c = completeQueuedAssault(c, columns, 'uspallata', {
    execute: (request) => {
      order(request);
      return c;
    },
  });
  assert.deepEqual(
    present(c.pendingBattle).squad.map((unit) => unit.id).sort((a, b) => a - b),
    field.slice().sort((a, b) => a - b),
  );
  return c;
}

// Treat actual escapees where they arrived, then march them back to the pass.
// Issued return records keep unrelated people outside this recovery party.
export function recoverFreshUspallataDepartures(start, { report = () => {} } = {}) {
  let c = decodeSave(encodeSave(start)).campaign;
  const original = structuredClone(start),
    selected = c.activeSquadId,
    selectedMembers = [...c.squad],
    ledger = c.sectorStates.uspallata?.returnLedger;
  const departures = (ledger?.entries ?? []).filter((entry) => {
    const id = Number(entry.unitId),
      r = c.operativeState[id],
      arrival = r?.arrival;
    return (
      entry.kind === 'departed' &&
      c.recruited.includes(id) &&
      r?.alive &&
      !r.captured &&
      operativeLocation(c, id) === entry.sector &&
      arrival?.battleId === ledger.battleId &&
      arrival.fromSector === 'uspallata' &&
      arrival.exitId === entry.departure.exitId
    );
  });
  if (!departures.length) {
    return c;
  }
  const clock = () => c.hour * 3600 + (c.secondOfHour ?? 0),
    acute = (id: number) => {
      const r = c.operativeState[id];
      return present(r).hp < 15 || present(r).bleeding > 0;
    };
  const retained = createFreshRouteOrders(
      () => c,
      (next) => {
        c = next;
      },
      { report },
    ),
    order = retained.order;
  const sectors = [...new Set(departures.map((entry) => entry.sector))];
  try {
    assert.equal(c.pendingBattle, null);
    assert.equal(c.pendingEncounter, null);
    // An unattended acute group cannot wait while another sector is treated.
    assert.ok(
      sectors.filter((sector) =>
        departures.some((entry) => entry.sector === sector && acute(Number(entry.unitId))),
      ).length <= 1,
      'Separate acute escape groups need an actual immediate care plan before any recovery clock advances.',
    );
    sectors.sort(
      (a, b) =>
        Number(departures.some((entry) => entry.sector === b && acute(Number(entry.unitId)))) -
        Number(departures.some((entry) => entry.sector === a && acute(Number(entry.unitId)))),
    );
    for (const sector of sectors) {
      const ids = departures
        .filter((entry) => entry.sector === sector)
        .map((entry) => Number(entry.unitId));
      assert.ok(
        ids.length <= 6 && ids.every((id: number) => canReassignOperative(c, id)),
        'The actual escaped party must fit one available recovery squad.',
      );
      assert.ok(
        ['neutral', 'patriot'].includes(worldOwner(c, sector)),
        'The actual escaped party needs a currently safe visit.',
      );
      const home = c.squads.find(
        (q) =>
          q.location === sector &&
          !q.journey &&
          q.members.length &&
          q.members.every((id) => ids.includes(id)),
      );
      if (home) {
        order({ type: 'selectSquad', id: home.id });
        order({ type: 'squad', ids });
      } else {
        order({ type: 'createSquad', name: 'Socorro del paso', ids, sector });
      }
      const squadId = c.activeSquadId;
      retained.retain(3600);
      const opened = visit(c);
      c = opened.campaign;
      report({ event: 'uspallataEscapeCareInput', sector, ids, ...opened });
      c = performFreshMountainFirstAid(opened, { stage: 'uspallata-escaped-first-aid', report });
      report({ event: 'uspallataEscapeCareReturned', sector, ids, campaign: c });
      retained.check();
      assert.ok(
        ids.every((id: string|number) => !acute(id) && c.operativeState[id].alive),
        'Every actual escapee must survive finite first aid before strategic travel.',
      );
      const quote = previewStrategicRoute(c, squadId, 'uspallata', 'march');
      assert.ok(
        quote.valid && present(quote.action).type === 'travel' && quote.hours <= 48,
        `The actual stabilized party needs a bounded legal march home: ${quote.reason}`,
      );
      const before = structuredClone(c),
        from = clock();
      order(quote.action);
      for (
        let attempt = 0;
        attempt < 48 && c.squads.find((q) => q.id === squadId)?.journey;
        attempt++
      ) {
        assert.equal(
          present(c.squads.find((q) => q.id === squadId)).journey.status,
          'moving',
          'A stopped escapee journey needs an actual response.',
        );
        order({ type: 'wait', hours: 1 });
      }
      assert.ok(
        !c.squads.find((q) => q.id === squadId)?.journey &&
          ids.every((id: number) => operativeLocation(c, id) === 'uspallata'),
        'Every stabilized escapee must actually arrive back at the pass.',
      );
      assert.ok(
        clock() - from <= 48 * 3600,
        'Escapee return keeps the existing finite travel bound.',
      );
      for (const id of ids) {
        for (const key of [
          'hp',
          'bleeding',
          'medkits',
          'inventory',
          'weaponInstanceId',
          'condition',
        ]) {
          assert.deepEqual(
            present(c.operativeState[id])[key],
            present(before.operativeState[id])[key],
            `The actual return preserves ${id} ${key}.`,
          );
        }
      }
      report({
        event: 'uspallataEscapePartyReturned',
        sector,
        ids,
        squadId,
        quote,
        elapsedSeconds: clock() - from,
        campaign: c,
      });
    }
    order({ type: 'selectSquad', id: selected });
    assert.deepEqual(
      c.squad,
      selectedMembers,
      'Escapee recovery restores the original local selection.',
    );
    assert.deepEqual(start, original, 'Escapee recovery never edits its input.');
    return c;
  } catch (error) {
    if (error.pair) {
      c = error.pair.campaign;
    }
    error.campaign = c;
    report({
      event: 'uspallataEscapeRecoveryStopped',
      reason: error.message,
      campaign: c,
      battle: error.pair?.battle ?? null,
    });
    throw error;
  }
}

// Recover finite field dressings and give real first aid before the return.
// Hire an actual available doctor and retain every intended serving survivor.
export function recoverFreshUspallata(start: CampaignSnapshot, { batteryIds = null, report = () => {} } = {}) {
  let c = recoverFreshUspallataDepartures(start, { report });
  const retained = createFreshRouteOrders(
    () => c,
    (next) => {
      c = next;
    },
    { report },
  );
  const order = retained.order;
  const survivors = c.recruited.filter((id) => {
    const r = c.operativeState[id];
    return present(r).alive && !present(r).captured && present(r).location === 'uspallata';
  });
  assert.ok(survivors.length > 0, 'the actual mountain survivors need recovery');
  const doctors = rosterFor(c)
    .filter(
      (o) =>
        survivors.includes(o.id) &&
        present(c.operativeState[o.id]).hp >= 15 &&
        !present(c.operativeState[o.id]).bleeding &&
        o.medical >= 20,
    )
    .sort((a, b) => b.medical - a.medical)
    .map((o) => o.id);
  assert.ok(doctors.length);
  const remaining = [...survivors],
    groups: { id: string; members: number[]|(number|undefined)[]; }[] = [],
    localSlots = c.squads.filter((q) => q.location === 'uspallata' && !q.journey).map((q) => q.id);
  while (remaining.length) {
    const doctor = doctors.find((id) => remaining.includes(id));
    assert.notEqual(doctor, undefined, 'each physical recovery squad needs a conscious physician');
    const reservedDoctors = doctors
      .filter((id) => id !== doctor && remaining.includes(id))
      .slice(0, Math.ceil(remaining.length / 6) - 1);
    const members = [
      doctor,
      ...remaining.filter((id) => id !== doctor && !reservedDoctors.includes(id)),
    ].slice(0, 6);
    for (const id of members) {
      remaining.splice(remaining.indexOf(id), 1);
    }
    const slot = localSlots.find((id) => !groups.some((group) => group.id === id));
    if (slot) {
      order({ type: 'selectSquad', id: slot });
      order({ type: 'squad', ids: members });
    } else {
      order({
        type: 'createSquad',
        name: 'Socorro de la cordillera',
        ids: members,
        sector: 'uspallata',
      });
    }
    groups.push({ id: c.activeSquadId, members });
  }
  for (const id of doctors) {
    for (const row of sectorInventoryModel(c, 'uspallata', rosterFor(c), id).entries.filter(
      (r) => r.reachable && JSON.parse(r.expected).item === 'medkits',
    )) {
      const count = Math.min(row.count, 10 - present(c.operativeState[id]).medkits);
      if (count > 0) {
        order({
          type: 'sectorInventory',
          sector: 'uspallata',
          operativeId: id,
          direction: 'take',
          sourceKey: row.key,
          expected: row.expected,
          count,
        });
      }
    }
  }
  for (const group of [...groups].sort(
    (a, b) =>
      Number(
        b.members.some((id) => c.operativeState[id].hp < 15 || c.operativeState[id].bleeding > 0),
      ) -
      Number(
        a.members.some((id) => c.operativeState[id].hp < 15 || c.operativeState[id].bleeding > 0),
      ),
  )) {
    order({ type: 'selectSquad', id: group.id });
    c = performFreshMountainFirstAid(visit(c), { stage: 'uspallata-first-aid', report });
  }
  report({
    event: 'mountainFirstAid',
    hour: c.hour,
    survivors: survivors.map((id) => ({
      id,
      hp: present(c.operativeState[id]).hp,
      bleeding: present(c.operativeState[id]).bleeding,
    })),
  });
  for (const id of survivors) {
    assert.ok(present(c.operativeState[id]).hp >= 15);
    assert.equal(present(c.operativeState[id]).bleeding, 0);
    order({ type: 'assignCare', operativeId: id, assignment: 'active' });
  }
  order({ type: 'fortify', sector: 'uspallata' });
  const crewRequired = batteryIds
    ? Math.max(...mountainBatteryRecords(c, batteryIds).map((gun) => artilleryProfile(c, gun).crew))
    : 2;
  // A permanent battlefield loss can leave fewer locals than the actual gun
  // needs. Borrow only unassigned Mendoza support; the rear roles stay home.
  let storageSupport = null;
  if (!groups.some((group) => group.members.length >= crewRequired)) {
    const crew = [...groups].sort((a, b) => b.members.length - a.members.length)[0],
      missing = crewRequired - present(crew).members.length,
      roster = rosterFor(c),
      now = c.hour * 3600 + (c.secondOfHour ?? 0);
    const roles = new Set(
      ['foundryEngineer', 'marchCommander'].map((key) => campaignRole(c, key)?.id),
    );
    const rear = roster.filter(
      (op) =>
        c.recruited.includes(op.id) &&
        present(c.operativeState[op.id]).alive &&
        !present(c.operativeState[op.id]).captured &&
        operativeLocation(c, op.id) === 'mendoza',
    );
    const strongestMedical = Math.max(0, ...rear.map((op) => op.medical));
    const support = rear
      .filter((op) => {
        const r = c.operativeState[op.id],
          expiry = contractExpiresSeconds(c.contracts[op.id]);
        return (
          !roles.has(op.id) &&
          op.leadership < 80 &&
          op.medical < 60 &&
          (op.medical < 20 || op.medical < strongestMedical) &&
          !c.squads.some((q) => q.members.includes(op.id)) &&
          c.contracts[op.id] &&
          !present(c.contracts[op.id]).departurePending &&
          (expiry === null || expiry > now) &&
          canReassignOperative(c, op.id) &&
          !operativeInTransit(c, op.id) &&
          present(r).hp === present(r).maxHp &&
          capableMountainActor(c, op.id) &&
          !tooTiredToMarch(r) &&
          !present(r).departure &&
          !present(r).fled &&
          ['active', 'rest'].includes(present(r).assignment) &&
          !careAssignmentReason(c, op, 'active')
        );
      })
      .sort((a, b) => a.medical - b.medical || a.leadership - b.leadership || a.id - b.id)
      .slice(0, missing)
      .map((op) => op.id);
    assert.equal(
      support.length,
      missing,
      'The actual mountain gun needs enough eligible unassigned Mendoza support.',
    );
    assert.equal(worldOwner(c, 'mendoza'), 'patriot');
    assert.equal(worldOwner(c, 'uspallata'), 'patriot');
    const empty = c.squads.find((q) => q.location === 'mendoza' && !q.journey && !q.members.length);
    assert.ok(
      empty || canCreateSquad(c),
      'An actual free squad slot must carry the unassigned storage support.',
    );
    const duties = Object.fromEntries(support.map((id) => [id, present(c.operativeState[id]).assignment])),
      started = c.hour * 3600 + (c.secondOfHour ?? 0);
    if (empty) {
      order({ type: 'selectSquad', id: empty.id });
      order({ type: 'squad', ids: support });
    } else {
      order({
        type: 'createSquad',
        name: 'Apoyo de almacenamiento',
        ids: support,
        sector: 'mendoza',
      });
    }
    const home = c.activeSquadId;
    for (const id of support) {
      order({ type: 'assignCare', operativeId: id, assignment: 'active' });
    }
    const quote = ['posta', 'march']
      .map((mode) => previewStrategicRoute(c, home, 'uspallata', mode))
      .filter((q) => q.valid && q.hours <= NATIVE_MOUNTAIN_RESERVE_BOUNDS.travelHours)
      .sort((a, b) => a.hours - b.hours)[0];
    assert.ok(quote, 'The storage support needs a current bounded ordinary route to the pass.');
    order(quote.action);
    let notices = 0;
    while (present(c.squads.find((q) => q.id === home)).journey) {
      assert.equal(
        present(c.squads.find((q) => q.id === home)).journey.status,
        'moving',
        'A stopped storage-support route needs an actual response.',
      );
      assert.ok(
        c.hour * 3600 + (c.secondOfHour ?? 0) - started <
          NATIVE_MOUNTAIN_RESERVE_BOUNDS.travelHours * 3600,
        'Storage support keeps the existing reserve travel bound.',
      );
      const before = c.hour * 3600 + (c.secondOfHour ?? 0);
      order({ type: 'wait', hours: 1 });
      notices = c.hour * 3600 + (c.secondOfHour ?? 0) === before ? notices + 1 : 0;
      assert.ok(notices < 3, 'Storage support stops after repeated zero-time notices.');
    }
    assert.ok(
      support.every((id) => operativeLocation(c, id) === 'uspallata'),
      'Every borrowed support actor must actually arrive at the gun.',
    );
    order({ type: 'selectSquad', id: present(crew).id });
    order({ type: 'squad', ids: [...present(crew).members, ...support] });
    storageSupport = { ids: support, home, duties, crew, quote, members: [...present(crew).members] };
    present(crew).members = [...present(crew).members, ...support];
    report({
      event: 'uspallataStorageSupportArrived',
      ids: support,
      home,
      crewId: present(crew).id,
      required: crewRequired,
      quote,
      elapsedSeconds: c.hour * 3600 + (c.secondOfHour ?? 0) - started,
      campaign: c,
    });
  }
  const batteryCrew = groups.find((group) => group.members.length >= crewRequired);
  assert.ok(batteryCrew, 'enough real local survivors must store the actual mountain guns');
  order({ type: 'selectSquad', id: batteryCrew.id });
  c = prepareMountainBattery(c, ['bronze4', 'bronze4'], {
    batteryIds,
    destination: 'uspallata',
    keepServing: retained.keepIds(),
    report,
  }).campaign;
  if (storageSupport) {
    order({ type: 'selectSquad', id: storageSupport.home });
    order({ type: 'squad', ids: storageSupport.ids });
    present(storageSupport.crew).members = storageSupport.members;
    groups.push({ id: storageSupport.home, members: storageSupport.ids });
  }
  for (const group of groups) {
    order({ type: 'selectSquad', id: group.id });
    order({ type: 'travel', sector: 'mendoza', mode: 'posta', queue: true });
  }
  for (
    let h = 0;
    h < 48 && groups.some((group) => c.squads.find((q) => q.id === group.id)?.journey);
    h++
  ) {
    order({ type: 'wait', hours: 1 });
  }
  for (const id of survivors) {
    assert.equal(present(c.operativeState[id]).location, 'mendoza');
  }
  if (storageSupport) {
    const { ids, home, duties, crew } = storageSupport;
    assert.ok(
      ids.every((id) => operativeLocation(c, id) === 'mendoza' && canReassignOperative(c, id)),
      'Every borrowed support actor must actually return within the original 48-hour bound.',
    );
    // Native formation needs at least one member. Move a returned survivor
    // through the transport home, then restore its exact recovery home.
    order({ type: 'selectSquad', id: home });
    order({ type: 'squad', ids: [present(crew).members[0]] });
    order({ type: 'selectSquad', id: present(crew).id });
    order({ type: 'squad', ids: present(crew).members });
    for (const id of ids) {
      order({ type: 'assignCare', operativeId: id, assignment: duties[id] });
      assert.ok(!c.squads.some((q) => q.members.includes(id)));
    }
    assert.ok(
      present(c.squads.find((q) => q.id === home)).members.length === 0 &&
        present(c.squads.find((q) => q.id === home)).location === 'mendoza',
    );
    groups.pop();
    report({ event: 'uspallataStorageSupportReturned', ids, home, duties, campaign: c });
  }
  const clinic = groups.find((group) => group.members.length < 6);
  if (clinic) {
    order({ type: 'selectSquad', id: clinic.id });
  } else {
    order({
      type: 'createSquad',
      name: 'Médicos de Mendoza',
      ids: [doctors[0]],
      sector: 'mendoza',
    });
  }
  assert.equal(c.location, 'mendoza');
  const patients = survivors.filter((id) => present(c.operativeState[id]).hp < present(c.operativeState[id]).maxHp);
  const servingDoctor = rosterFor(c).find(
    (o) =>
      c.recruited.includes(o.id) &&
      !patients.includes(o.id) &&
      present(c.operativeState[o.id]).alive &&
      present(c.operativeState[o.id]).hp >= 15 &&
      present(c.operativeState[o.id]).location === 'mendoza' &&
      o.medical >= 20,
  );
  if (patients.length && !servingDoctor) {
    const medic = rosterFor(c)
      .filter(
        (o) =>
          o.id >= 100 &&
          o.id < 1000 &&
          !c.recruited.includes(o.id) &&
          present(c.operativeState[o.id]).alive &&
          o.medical >= 60 &&
          contractQuote(c, o, 'day').available &&
          contractQuote(c, o, 'day').price <= c.resources.treasury - 50,
      )
      .sort((a, b) => b.medical - a.medical)[0];
    assert.ok(medic, 'actual funds must afford the available physician and finite dressings');
    const medicQuote = contractQuote(c, medic, 'day'),
      medicCash = c.resources.treasury;
    order({ type: 'recruitCivic', id: medic.id, term: 'day' });
    assert.equal(c.resources.treasury, medicCash - medicQuote.price);
    for (let h = 0; h < 24 && !c.recruited.includes(medic.id); h++) {
      order({ type: 'wait', hours: 1 });
    }
    assert.equal(present(c.operativeState[medic.id]).location, 'mendoza');
    assert.ok(c.recruited.includes(medic.id));
  }
  const localDoctors = rosterFor(c)
    .filter(
      (o) =>
        c.recruited.includes(o.id) &&
        !patients.includes(o.id) &&
        present(c.operativeState[o.id]).alive &&
        !present(c.operativeState[o.id]).captured &&
        present(c.operativeState[o.id]).location === 'mendoza' &&
        o.medical >= 20,
    )
    .sort((a, b) => b.medical - a.medical)
    .slice(0, patients.length)
    .map((o) => o.id);
  // A selected physician must keep the dressing already allocated for this
  // medical hour. Cycling it through the other doctors leaves care blocked.
  const medicalReserves = Object.fromEntries(localDoctors.map((id) => [id, 1]));
  let medicalHour = 0,
    supplyRecipient = null,
    clinicStarted = null;
  recordRouteStrategicEvidence({
    helper: 'recoverFreshUspallataClinic',
    stage: 'preparation-input',
    campaign: c,
    context: { patients, localDoctors, medicalReserves },
  });
  try {
    c = bankRouteIncome(c, 5000, { keepIds: retained.keepIds(), report });
    clinicStarted = c.hour * 3600 + (c.secondOfHour ?? 0);
    report({
      event: 'mountainMedicalClinicStarted',
      hour: c.hour,
      secondOfHour: c.secondOfHour ?? 0,
    });
    for (
      ;
      medicalHour < 48 &&
      patients.some((id) => present(c.operativeState[id]).hp < present(c.operativeState[id]).maxHp);
      medicalHour++
    ) {
      assert.equal(c.pendingEncounter, null);
      for (const id of localDoctors) {
        if (!present(c.operativeState[id]).medkits) {
          supplyRecipient = id;
          const physician = rosterFor(c).find((op) => op.id === id),
            course = patients.reduce(
              (sum, patient) =>
                sum +
                Math.ceil(
                  (present(c.operativeState[patient]).maxHp - present(c.operativeState[patient]).hp) /
                    doctorRate(physician, c),
                ),
              0,
            );
          // A real courier brings the remaining course, rather than repeating a
          // round trip for each hour. Existing selected doctors keep their last kit.
          c = prepareMountainDressings(c, id, course, {
            reserves: medicalReserves,
            report,
            deadlineSeconds: clinicStarted + 48 * 3600,
          });
          c = supplyRouteDressings(c, id, course, {
            reserves: medicalReserves,
            report,
            discover: false,
          });
          report({
            event: 'mountainMedicalCourseSupplied',
            operativeId: id,
            target: course,
            hour: c.hour,
            secondOfHour: c.secondOfHour ?? 0,
          });
        }
        order({ type: 'assignCare', operativeId: id, assignment: 'doctor' });
      }
      for (const id of patients) {
        order({ type: 'assignCare', operativeId: id, assignment: 'patient' });
      }
      assert.ok(
        c.hour * 3600 + (c.secondOfHour ?? 0) + 3600 <= clinicStarted + 48 * 3600,
        'Finite medical courier time and care share the original 48-hour clinic bound.',
      );
      order({ type: 'wait', hours: 1 });
      report({
        event: 'mountainMedicalCare',
        hour: c.hour,
        treasury: c.resources.treasury,
        patients: patients.map((id) => ({ id, hp: present(c.operativeState[id]).hp })),
      });
    }
    for (const id of survivors) {
      assert.ok(present(c.operativeState[id]).alive);
      assert.equal(present(c.operativeState[id]).hp, present(c.operativeState[id]).maxHp);
      assert.equal(present(c.operativeState[id]).bleeding, 0);
    }
    for (const [id, r] of Object.entries(start.operativeState)) {
      if (!r.alive) {
        assert.equal(c.operativeState[id].alive, false);
      }
    }
    assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
    return c;
  } catch (error) {
    recordRouteStrategicEvidence({
      helper: 'recoverFreshUspallataClinic',
      stage: 'preparation-failure',
      campaign: c,
      returnedCampaign: error.campaign,
      context: {
        patients,
        localDoctors,
        medicalReserves,
        medicalHour,
        supplyRecipient,
        clinicStarted,
        scope:
          'Raw caller prefix and any actual nested supply prefix only; no query, synchronization or continuation after failure.',
      },
      error,
    });
    throw error;
  }
}

const freeMountainDuty = (c: CampaignSnapshot, op: CampaignOperative) => {
  const r = c.operativeState[op.id];
  if (present(r).assignment === 'doctor') {
    return careAssignmentProgress(c, op, rosterFor(c)).code === 'no_patients';
  }
  return ['active', 'rest', 'patient'].includes(present(r).assignment);
};

// End only completed local duty which the actual next force does not need.
// Native dismissal returns its finite property; it grants no refund or time.
export function completeMountainPaidDuties(
  start: CampaignSnapshot,
  {
    fieldIds,
    doctorIds = [],
    protectedIds = [],
    horizonSeconds,
    fixedCost = 0,
    report = () => {},
  } = {},
) {
  let c = structuredClone(start);
  assert.equal(c.pendingBattle, null);
  assert.equal(c.pendingEncounter, null);
  const sector = c.location,
    roster = rosterFor(c),
    required = new Set([
      ...fieldIds,
      ...doctorIds,
      ...protectedIds,
      ...['foundryEngineer', 'marchCommander']
        .map((key) => campaignRole(c, key)?.id)
        .filter((id) => id !== undefined),
    ]);
  assert.ok(
    fieldIds.length &&
      new Set(fieldIds).size === fieldIds.length &&
      fieldIds.every(
        (id: string|number) =>
          c.recruited.includes(id) && c.operativeState[id]?.alive && !c.operativeState[id].captured,
      ),
    'The continuing mountain field must remain actually serving.',
  );
  assert.ok(
    doctorIds.every(
      (id) => fieldIds.includes(id) && present(roster.find((op) => op.id === id)?.medical) >= 60,
    ),
    'Actual selected field physicians retain their required skill.',
  );
  const orders: CampaignAction[] = [],
    completed = [],
    retained = createFreshRouteOrders(
      () => c,
      (next) => {
        c = next;
      },
      {
        report: (event) => {
          if (event.event === 'freshRouteOrder' || event.event === 'freshRouteRenewal') {
            orders.push(structuredClone(event.action));
          }
          report(event);
        },
      },
    );
  const budget = () =>
    quoteMountainServiceBudget(c, { keepIds: retained.keepIds(), horizonSeconds, fixedCost });
  const threatened = () =>
    c.enemyGroups.some(
      (group) =>
        group.target === sector &&
        ['marching', 'waiting', 'engaged', 'stationed'].includes(group.status),
    );
  const patients = () =>
    roster.some(
      (op) =>
        c.recruited.includes(op.id) &&
        c.operativeState[op.id]?.alive &&
        !present(c.operativeState[op.id]).captured &&
        operativeLocation(c, op.id) === sector &&
        (present(c.operativeState[op.id]).hp < present(c.operativeState[op.id]).maxHp ||
          present(c.operativeState[op.id]).bleeding),
    );
  const eligible = (op: CampaignOperative) => {
    const r = c.operativeState[op.id],
      contract = c.contracts[op.id];
    return (
      !required.has(op.id) &&
      c.recruited.includes(op.id) &&
      contract?.kind === 'paid' &&
      !contract.guaranteeId &&
      !contract.departurePending &&
      present(r).alive &&
      !present(r).captured &&
      present(r).hp === present(r).maxHp &&
      !present(r).bleeding &&
      !present(r).unconscious &&
      !present(r).routed &&
      !present(r).surrendered &&
      !present(r).asleep &&
      present(r).energy > 10 &&
      canReassignOperative(c, op.id) &&
      !operativeInTransit(c, op.id) &&
      operativeLocation(c, op.id) === sector &&
      worldOwner(c, sector) === 'patriot' &&
      !threatened() &&
      !c.militiaTraining.some((course) => course.trainerId === op.id) &&
      freeMountainDuty(c, op) &&
      !(op.medical >= 20 && patients())
    );
  };
  const candidates = roster
    .filter(eligible)
    .sort(
      (a, b) =>
        contractRenewalQuote(c, b, 'day').price - contractRenewalQuote(c, a, 'day').price ||
        a.id - b.id,
    );
  for (const op of candidates) {
    const current = budget();
    if (current.available || !current.shortfall || current.entries.some((row) => row.reason)) {
      break;
    }
    if (!eligible(op)) {
      continue;
    }
    const collector = fieldIds.find(
      (id: number) =>
        id !== op.id &&
        operativeLocation(c, id) === sector &&
        present(c.operativeState[id]).hp >= 15 &&
        !present(c.operativeState[id]).asleep,
    );
    assert.notEqual(
      collector,
      undefined,
      'An actual continuing local soldier must retain access to returned property.',
    );
    const model = sectorInventoryModel(c, sector, rosterFor(c), op.id);
    if (model.operativeId !== op.id || model.reason) {
      continue;
    }
    const kit = model.carried.map(
        (row) => extractItemQuantity(model.personal, row.item, row.count).stack,
      ),
      oldKeys = new Set(
        sectorInventoryModel(c, sector, rosterFor(c), collector).entries.map((row) => row.key),
      );
    retained.retain();
    if (c.pendingEncounter || c.pendingBattle) {
      throw Error('A real encounter interrupts completed mountain duty.');
    }
    const before = structuredClone(c),
      cash = c.resources.treasury,
      at = c.hour * 3600 + (c.secondOfHour ?? 0);
    retained.order({ type: 'dismiss', id: op.id });
    assert.equal(c.resources.treasury, cash);
    assert.equal(c.hour * 3600 + (c.secondOfHour ?? 0), at);
    assert.equal(c.recruited.includes(op.id), false);
    assert.equal(c.contracts[op.id], undefined);
    for (const key of [
      'hp',
      'maxHp',
      'bleeding',
      'bandaged',
      'alive',
      'energy',
      'fatigue',
      'morale',
      'location',
    ]) {
      assert.deepEqual(
        present(c.operativeState[op.id])[key],
        present(before.operativeState[op.id])[key],
        `Completed service preserves ${op.id}'s ${key}.`,
      );
    }
    for (const [id, r] of Object.entries(before.operativeState)) {
      if (!r.alive) {
        assert.equal(c.operativeState[id].alive, false);
      }
    }
    const returned = sectorInventoryModel(c, sector, rosterFor(c), collector)
      .entries.filter((row) => !oldKeys.has(row.key))
      .map((row) => JSON.parse(row.expected));
    const ordered = (rows) => rows.map((row) => JSON.stringify(row)).sort();
    assert.deepEqual(
      ordered(returned),
      ordered(kit),
      'Every exact carried stack remains in the local service return once.',
    );
    const receipt = {
      id: op.id,
      kit: structuredClone(kit),
      hour: c.hour,
      second: c.secondOfHour ?? 0,
      treasury: c.resources.treasury,
    };
    completed.push(receipt);
    report({
      event: 'mountainPaidDutyCompleted',
      ...receipt,
      field: [...fieldIds],
      doctors: [...doctorIds],
      campaign: c,
    });
  }
  return { campaign: c, completed, orders, budget: budget() };
}

// Forecast the complete existing parallel route from public world geometry.
// Future-origin squad drafts are quotations only and are never adopted.
export function mountainLosPatosDeparturePlan(
  c: CampaignSnapshot,
  {
    columns,
    batteryIds = null,
    stage = 'mendoza',
    sleepApproaches = false,
    plannedFieldIds = null,
    notBeforeSeconds = c.hour * 3600 + (c.secondOfHour ?? 0),
  } = {},
) {
  assert.ok(['mendoza', 'uspallata', 'flanks', 'assault'].includes(stage));
  assert.ok(
    Number.isSafeInteger(notBeforeSeconds) &&
      notBeforeSeconds >= c.hour * 3600 + (c.secondOfHour ?? 0),
  );
  // Before rehiring, these are public geometry copies only. They neither
  // insert a body into service nor replace the final actual column quote.
  const groups = plannedFieldIds
      ? Array.from({ length: Math.ceil(plannedFieldIds.length / 6) }, (_, i) => ({
          location: 'mendoza',
          members: plannedFieldIds.slice(i * 6, i * 6 + 6),
        }))
      : columns.map((id: string) => {
          const q = c.squads.find((group) => group.id === id);
          assert.ok(q);
          return q;
        }),
    destination = worldCell('los_patos', c);
  if (plannedFieldIds) {
    assert.ok(plannedFieldIds.length && new Set(plannedFieldIds).size === plannedFieldIds.length);
  }
  const origins = [
    'uspallata',
    `cell-${present(destination).col}-${present(destination).row - 1}`,
    `cell-${present(destination).col}-${present(destination).row + 1}`,
    `cell-${present(destination).col - 1}-${present(destination).row}`,
  ];
  let fixedCost = 0,
    hours = 0;
  const route = (q, from, to, mode, intent = 'travel') => {
    if (from === to) {
      return 0;
    }
    if (plannedFieldIds) {
      const path =
        intent === 'attack'
          ? (assert.ok(assaultNeighbor(from, to, c)), [from, to])
          : mode === 'march'
            ? cellTravelPlan(
                {
                  location: from,
                  hour: Math.floor(notBeforeSeconds / 3600),
                  sectors: c.sectors,
                  ...(c.contentCampaign ? { contentCampaign: c.contentCampaign } : {}),
                },
                to,
                mode,
              ).path
            : transportPath(c, from, to);
      assert.ok(present(path?.length) > 1, 'A prospective column needs a complete current public route.');
      if (mode === 'posta') {
        assert.equal(c.routes.posta, true);
        fixedCost += 10 * (present(path).length - 1);
      }
      return present(path).slice(1).reduce((sum, to, i) => sum + travelLegHours(present(path)[i], to, mode, c), 0);
    }
    const draft = { ...q, location: from, members: [...q.members] };
    delete draft.journey;
    queueSquadTravel(c, draft, { sector: to, mode, intent });
    const quote = squadTravelStatus(draft, c);
    if (mode === 'posta') {
      fixedCost += 10 * (present(quote).path.length - 1);
    }
    return present(quote).remaining;
  };
  if (stage === 'mendoza') {
    // Recovery has already stored these exact guns at the real arrival depot.
    // Unknown transport/rest work cannot be priced as a zero-hour delivery.
    const stored = present(c.artilleryDepots).uspallata ?? [],
      ids =
        batteryIds ??
        stored
          .filter((gun) => gun.side === 'player' && gun.type === 'bronze4')
          .slice(0, 2)
          .map((gun) => gun.id);
    assert.ok(
      ids.length && ids.every((id) => stored.some((gun) => gun.id === id)),
      'Finish the actual mountain battery delivery before quoting departure.',
    );
    hours += Math.max(...groups.map((q) => route(q, q.location, 'uspallata', 'posta')));
  }
  if (['mendoza', 'uspallata'].includes(stage)) {
    hours += Math.max(...groups.map((q, index) => route(q, 'uspallata', origins[index], 'march')));
  }
  if (stage !== 'assault') {
    hours += Math.max(
      ...groups.map((q, index) =>
        route(q, origins[index], 'los_patos', index ? 'march' : 'posta', 'attack'),
      ),
    );
  }
  const sleepHours =
    sleepApproaches && stage !== 'assault'
      ? mountainSleepHoursForIds(
          c,
          groups.flatMap((q) => q.members),
        )
      : 0;
  hours += sleepHours;
  let horizonSeconds = notBeforeSeconds + hours * 3600,
    daylightHours = 0;
  while (
    Math.floor(horizonSeconds / 3600) % 24 < 6 ||
    Math.floor(horizonSeconds / 3600) % 24 > 10
  ) {
    horizonSeconds += 3600;
    daylightHours++;
    assert.ok(daylightHours < 24);
  }
  const assaultSeconds = horizonSeconds,
    retentionBufferSeconds = 3600;
  // Even the final zero-time select/begin orders retain one actual route hour.
  horizonSeconds += retentionBufferSeconds;
  return {
    stage,
    hours,
    sleepHours,
    daylightHours,
    assaultSeconds,
    retentionBufferSeconds,
    horizonSeconds,
    fixedCost,
    ...(plannedFieldIds
      ? { prospectiveGeometryOnly: true, plannedFieldIds: [...plannedFieldIds] }
      : {}),
  };
}

// Quote the actual actor's Native rate against the full 0..100 capacity and
// one fractional-clock boundary. This forecast does not perform recovery.
export function mountainApproachSleepHours(c: CampaignSnapshot, columns) {
  const ids = columns.flatMap((id: string) => {
    const q = c.squads.find((q) => q.id === id);
    assert.ok(q);
    return q.members;
  });
  return mountainSleepHoursForIds(c, ids);
}
function mountainSleepHoursForIds(c: CampaignSnapshot, ids) {
  const roster = rosterFor(c);
  assert.ok(ids.length && new Set(ids).size === ids.length);
  const hours = Math.max(
    ...ids.map((id: number) => {
      const op = roster.find((op) => op.id === id),
        r = c.operativeState[id];
      assert.ok(op && r);
      const rate = sleepRecovery({ ...op, ...r });
      return Math.max(Math.ceil(100 / rate.fatigue), Math.ceil(100 / rate.energy)) + 1;
    }),
  );
  assert.ok(hours <= NATIVE_MOUNTAIN_RESERVE_BOUNDS.preMarchRestHours);
  return hours;
}

export function prepareMountainApproachSleep(start: CampaignSnapshot, { columns, report = () => {} } = {}) {
  assert.ok(
    !start.pendingBattle && !start.pendingEncounter,
    'Resolve the actual battle or encounter before approach sleep.',
  );
  let c = decodeSave(encodeSave(start)).campaign;
  const groups = columns.map((id: string) => {
    const q = c.squads.find((q) => q.id === id);
    assert.ok(q && !q.journey, 'The actual flank must arrive before sleep.');
    return q;
  });
  const ids = groups.flatMap((q) => q.members),
    before = Object.fromEntries(ids.map((id: string|number) => [id, structuredClone(c.operativeState[id])])),
    selected = c.activeSquadId;
  assert.ok(ids.length && new Set(ids).size === ids.length);
  const ready = (id: string|number) => {
    const r = c.operativeState[id];
    return r.energy === 100 && !r.fatigue && !r.asleep;
  };
  for (const id of ids) {
    const r = c.operativeState[id];
    assert.ok(
      c.recruited.includes(id) &&
        present(r).alive &&
        !present(r).captured &&
        present(r).hp === present(r).maxHp &&
        !present(r).bleeding &&
        !present(r).routed &&
        !present(r).unconscious &&
        present(r).assignment === 'active',
      'Sleep staging preserves actual fit active field roles.',
    );
    const location = operativeLocation(c, id),
      locality = worldCell(location, c)?.locality;
    assert.ok(
      ['patriot', 'neutral'].includes(worldOwner(c, location)) &&
        !c.enemyGroups.some(
          (g) =>
            ['waiting', 'engaged', 'stationed'].includes(g.status) &&
            (g.target === location || g.target === locality),
        ),
      'An actual stopped approach must remain safe for sleep.',
    );
    if (!ready(id) && !present(r).asleep) {
      assert.equal(
        sleepOrderReason(c, id, true),
        '',
        'Every actual approach needs a safe Native sleep order.',
      );
    }
  }
  if (ids.every(ready)) {
    return c;
  }
  const began = c.hour * 3600 + (c.secondOfHour ?? 0),
    hours = mountainApproachSleepHours(c, columns),
    deadline = began + hours * 3600;
  const retained = createFreshRouteOrders(
    () => c,
    (next) => {
      c = next;
    },
    { report },
  );
  const budget = quoteMountainServiceBudget(c, {
    keepIds: retained.keepIds(),
    horizonSeconds: deadline + 3600,
  });
  assert.ok(
    budget.available,
    budget.reason ?? 'All actual sleep staging service must be funded before waiting.',
  );
  report({
    event: 'mountainApproachSleepStarted',
    columns: [...columns],
    ids: [...ids],
    hours,
    budget,
    hour: c.hour,
    second: c.secondOfHour ?? 0,
  });
  for (const id of ids) {
    if (!ready(id) && !present(c.operativeState[id]).asleep) {
      retained.order({ type: 'setSleep', operativeId: id, asleep: true });
    }
  }
  let notices = 0;
  while (ids.some((id) => !ready(id))) {
    assert.ok(
      c.hour * 3600 + (c.secondOfHour ?? 0) < deadline,
      'Approach sleep reached its quoted Native bound.',
    );
    const at = c.hour * 3600 + (c.secondOfHour ?? 0);
    retained.order({ type: 'wait', hours: 1 });
    const elapsed = c.hour * 3600 + (c.secondOfHour ?? 0) - at;
    assert.ok(elapsed >= 0 && elapsed <= 3600);
    notices = elapsed === 0 ? notices + 1 : 0;
    assert.ok(notices < 3, 'Actual sleep must advance after its attention notices.');
    for (const id of ids) {
      const r = c.operativeState[id];
      assert.ok(
        present(r).hp === before[id].hp && present(r).medkits === before[id].medkits && present(r).assignment === 'active',
      );
    }
  }
  assert.equal(c.activeSquadId, selected);
  assert.deepEqual(c.squads, start.squads);
  for (const id of ids) {
    for (const key of [
      'hp',
      'maxHp',
      'bleeding',
      'bandaged',
      'medkits',
      'weapon',
      'blade',
      'inventory',
      'location',
    ]) {
      assert.deepEqual(present(c.operativeState[id])[key], before[id][key]);
    }
  }
  report({
    event: 'mountainApproachSleepComplete',
    columns: [...columns],
    ids: [...ids],
    elapsedSeconds: c.hour * 3600 + (c.secondOfHour ?? 0) - began,
    hour: c.hour,
    second: c.secondOfHour ?? 0,
  });
  return c;
}
export const mountainFieldPool = (c: CampaignSnapshot, sector: string, exclude = []) =>
  rosterFor(c).filter((op) => {
    const r = c.operativeState[op.id],
      local = c.recruited.includes(op.id) && operativeLocation(c, op.id) === sector;
    return (
      !exclude.includes(op.id) &&
      present(r).alive &&
      !present(r).captured &&
      present(r).hp === present(r).maxHp &&
      !present(r).bleeding &&
      present(r).morale >= 50 &&
      ((local && capableMountainActor(c, op.id) && !operativeInTransit(c, op.id)) ||
        (!c.recruited.includes(op.id) &&
          op.id >= 100 &&
          op.id < 1000 &&
          contractQuote(c, op, 'day').available))
    );
  });

// Use actual serving reserves before long local rest. Extract only the fit
// reserve from a mixed home group; its stable patient stays at the real source.
// Fit reserves queue their ordinary routes before native time advances.
export function prepareMountainServingReserves(
  start: CampaignSnapshot,
  {
    sector = start.location,
    fieldCount = 8,
    doctorCount = 2,
    exclude = [],
    deadlineSeconds = null,
    report = () => {},
  } = {},
) {
  assert.ok(
    Number.isSafeInteger(fieldCount) &&
      fieldCount >= 1 &&
      fieldCount <= 24 &&
      Number.isSafeInteger(doctorCount) &&
      doctorCount >= 1 &&
      doctorCount <= 4,
    'Use the existing bounded mountain force and doctor counts.',
  );
  let c = decodeSave(encodeSave(start)).campaign;
  assert.equal(c.pendingBattle, null);
  assert.equal(c.pendingEncounter, null);
  const local = mountainFieldPool(c, sector, exclude),
    doctors = local.filter((op) => op.medical >= 60);
  const needed = Math.max(0, fieldCount - local.length, doctorCount - doctors.length);
  if (!needed) {
    return c;
  }
  const chosen = rosterFor(c)
    .filter((op) => {
      const r = c.operativeState[op.id];
      return (
        !exclude.includes(op.id) &&
        c.recruited.includes(op.id) &&
        present(r).alive &&
        !present(r).captured &&
        present(r).hp === present(r).maxHp &&
        !present(r).bleeding &&
        !present(r).unconscious &&
        !present(r).routed &&
        !present(r).surrendered &&
        operativeLocation(c, op.id) !== sector &&
        !operativeInTransit(c, op.id) &&
        freeMountainDuty(c, op) &&
        !careAssignmentReason(c, op, 'active')
      );
    })
    .sort(
      (a, b) =>
        Number(doctors.length < doctorCount && b.medical >= 60) -
          Number(doctors.length < doctorCount && a.medical >= 60) ||
        Number(c.contracts[b.id]?.expiresAt === null) -
          Number(c.contracts[a.id]?.expiresAt === null) ||
        b.marksmanship - a.marksmanship ||
        b.medical - a.medical ||
        a.id - b.id,
    )
    .slice(0, Math.min(needed, NATIVE_MOUNTAIN_RESERVE_BOUNDS.count))
    .map((op) => op.id);
  if (!chosen.length) {
    return c;
  }
  assert.equal(
    worldOwner(c, sector),
    'patriot',
    'Serving reserves need a controlled assembly locality.',
  );
  const original = c.activeSquadId,
    events = [],
    emit = (event) => {
      const { campaign, battle, ...record } = event;
      events.push(record);
    },
    retained = createFreshRouteOrders(
      () => c,
      (next) => {
        c = next;
      },
      { report: emit },
    ),
    groups = [];
  const clock = (s: CampaignSnapshot) => s.hour * 3600 + (s.secondOfHour ?? 0),
    started = clock(c),
    resting = new Set();
  let notices = 0;
  const order = (action) => {
    if (deadlineSeconds !== null) {
      assert.ok(
        clock(c) + (action.type === 'wait' ? action.hours * 3600 : 0) <= deadlineSeconds,
        'Serving reserve preparation shares the original mountain readiness deadline.',
      );
    }
    return retained.order(action);
  };
  try {
    report({
      event: 'mountainServingReservesStarted',
      sector,
      ids: chosen,
      hour: c.hour,
      second: c.secondOfHour ?? 0,
      treasury: c.resources.treasury,
      campaign: c,
    });
    for (const op of rosterFor(c).filter(
      (op) =>
        c.recruited.includes(op.id) &&
        operativeLocation(c, op.id) === sector &&
        present(c.operativeState[op.id]).hp === present(c.operativeState[op.id]).maxHp &&
        !present(c.operativeState[op.id]).bleeding &&
        freeMountainDuty(c, op) &&
        !careAssignmentReason(c, op, 'rest'),
    )) {
      order({ type: 'assignCare', operativeId: op.id, assignment: 'rest' });
    }
    for (const id of chosen) {
      const from = operativeLocation(c, id),
        home = c.squads.find((q) => q.members.includes(id));
      assert.ok(
        home && !home.journey,
        'A serving reserve needs its actual uncommitted home group.',
      );
      if (home.members.length === 1) {
        order({ type: 'selectSquad', id: home.id });
      } else {
        assert.ok(
          canCreateSquad(c),
          'An actual vacant squad slot must remain for reserve extraction.',
        );
        order({ type: 'createSquad', name: 'Reserva de la cordillera', ids: [id], sector: from });
      }
      const group = c.activeSquadId;
      order({ type: 'assignCare', operativeId: id, assignment: 'active' });
      const needsRest = () => {
        const r = c.operativeState[id];
        return present(r).asleep || present(r).energy < 100 || present(r).fatigue > 0;
      };
      for (
        let hour = 0;
        needsRest() && hour < NATIVE_MOUNTAIN_RESERVE_BOUNDS.preMarchRestHours;
        hour++
      ) {
        assert.equal(
          careAssignmentReason(
            c,
            rosterFor(c).find((op) => op.id === id),
            'rest',
          ),
          '',
          'An exhausted reserve needs actual safe rest before travelling.',
        );
        order({ type: 'assignCare', operativeId: id, assignment: 'rest' });
        order({ type: 'wait', hours: 1 });
        order({ type: 'assignCare', operativeId: id, assignment: 'active' });
      }
      assert.ok(!needsRest(), 'Actual reserve rest must finish before booking its route.');
      const quote = ['posta', 'march']
        .map((mode) => previewStrategicRoute(c, group, sector, mode))
        .filter((q) => q.valid)
        .sort((a, b) => a.hours - b.hours)[0];
      assert.ok(
        quote,
        'A reserve needs a current admitted ordinary route, not a remote roster insertion.',
      );
      order(quote.action);
      groups.push({ id: group, operativeId: id });
      emit({
        event: 'mountainServingReserveQueued',
        operativeId: id,
        source: from,
        squadId: group,
        quote,
        hour: c.hour,
        second: c.secondOfHour ?? 0,
      });
    }
    while (groups.some(({ id }) => c.squads.find((q) => q.id === id)?.journey)) {
      assert.ok(
        clock(c) - started < NATIVE_MOUNTAIN_RESERVE_BOUNDS.travelHours * 3600,
        'Actual reserve routes reached the existing travel bound.',
      );
      const at = clock(c);
      order({ type: 'wait', hours: 1 });
      const elapsed = clock(c) - at;
      assert.ok(elapsed >= 0 && elapsed <= 3600);
      notices = elapsed === 0 ? notices + 1 : 0;
      assert.ok(notices < 3, 'Reserve travel stopped after repeated zero-time notices.');
      for (const group of groups) {
        const q = c.squads.find((q) => q.id === group.id);
        assert.ok(q);
        assert.ok(
          !q.journey || q.journey.status === 'moving',
          'Resolve an actual paused reserve route before more preparation time.',
        );
        if (!q.journey) {
          assert.equal(q.location, sector, 'The actual reserve must arrive at its destination.');
          if (!resting.has(group.operativeId)) {
            order({ type: 'assignCare', operativeId: group.operativeId, assignment: 'rest' });
            resting.add(group.operativeId);
          }
        }
      }
    }
    for (const id of chosen) {
      assert.equal(operativeLocation(c, id), sector);
      order({ type: 'assignCare', operativeId: id, assignment: 'rest' });
    }
    order({ type: 'selectSquad', id: original });
    retained.check();
    assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
    for (const event of events) {
      report(event);
    }
    report({
      event: 'mountainServingReservesArrived',
      ids: chosen,
      groups,
      hour: c.hour,
      second: c.secondOfHour ?? 0,
      elapsedSeconds: clock(c) - started,
      treasury: c.resources.treasury,
      campaign: c,
    });
    return c;
  } catch (error) {
    if (deadlineSeconds !== null) {
      if (error.campaign) {
        c = error.campaign;
      }
      error.campaign = c;
      error.mountainReadiness = { deadlineSeconds };
    }
    report({
      event: 'mountainServingReservesStopped',
      reason: error.message,
      ids: chosen,
      attemptedReports: events,
      campaign: c,
    });
    throw error;
  }
}

// A serving physician can be healthy but not ready after the last real battle.
// Recover only local free physicians through paid ordinary rest. Existing
// patients and working clinic duties keep their current finite care policy.
export function prepareMountainDoctorReadiness(
  start: CampaignSnapshot,
  {
    sector = start.location,
    count = 2,
    exclude = [],
    fieldCount = null,
    reservedIds = [],
    requireCommander = false,
    deadlineSeconds = null,
    budgetBeforeWait = null,
    report = () => {},
  } = {},
) {
  assert.ok(
    Number.isSafeInteger(count) && count > 0 && count <= 4,
    'The actual mountain columns need a bounded doctor count.',
  );
  assert.equal(typeof requireCommander, 'boolean');
  assert.ok(
    fieldCount === null ||
      (Number.isSafeInteger(fieldCount) && fieldCount >= 1 && fieldCount <= 24),
    'Actual field readiness must keep the original force bound.',
  );
  let c = decodeSave(encodeSave(start)).campaign;
  assert.equal(
    c.pendingBattle,
    null,
    'Return the actual tactical report before preparing physicians.',
  );
  assert.equal(
    c.pendingEncounter,
    null,
    'Resolve the actual encounter before preparing physicians.',
  );
  const ready = (op: CampaignOperative) => {
    const r = c.operativeState[op.id];
    return (
      !exclude.includes(op.id) &&
      op.medical >= 60 &&
      present(r).alive &&
      !present(r).captured &&
      present(r).hp === present(r).maxHp &&
      !present(r).bleeding &&
      present(r).morale >= 50 &&
      ((c.recruited.includes(op.id) &&
        operativeLocation(c, op.id) === sector &&
        capableMountainActor(c, op.id) &&
        !operativeInTransit(c, op.id)) ||
        (!c.recruited.includes(op.id) &&
          op.id >= 100 &&
          op.id < 1000 &&
          contractQuote(c, op, 'day').available))
    );
  };
  const available = () => rosterFor(c).filter(ready);
  const fieldReady = () =>
    fieldCount === null || mountainFieldPool(c, sector, reservedIds).length >= fieldCount;
  const rolesReady = () =>
    !requireCommander ||
    mountainCommandRolePlan({
      commanders: mountainFieldPool(c, sector, [...exclude, ...reservedIds]).filter(
        (op) =>
          op.leadership >= 80 &&
          (!c.recruited.includes(op.id) ||
            (freeMountainDuty(c, op) && canReassignOperative(c, op.id))),
      ),
      physicians: available(),
      count,
    }) !== null;
  if (available().length >= count && fieldReady() && rolesReady()) {
    return c;
  }
  assert.equal(
    worldOwner(c, sector),
    'patriot',
    'Physician readiness needs a safe controlled locality.',
  );
  const candidates = rosterFor(c)
    .filter((op) => {
      const r = c.operativeState[op.id];
      if (
        exclude.includes(op.id) ||
        reservedIds.includes(op.id) ||
        (fieldCount === null && op.medical < 60) ||
        ready(op) ||
        !c.recruited.includes(op.id) ||
        !present(r).alive ||
        present(r).captured ||
        present(r).routed ||
        present(r).unconscious ||
        present(r).surrendered ||
        present(r).hp !== present(r).maxHp ||
        present(r).bleeding ||
        operativeLocation(c, op.id) !== sector ||
        operativeInTransit(c, op.id) ||
        careAssignmentReason(c, op, 'rest')
      ) {
        return false;
      }
      return freeMountainDuty(c, op);
    })
    .sort(
      (a, b) =>
        present(c.operativeState[b.id]).morale - present(c.operativeState[a.id]).morale ||
        b.medical - a.medical ||
        a.id - b.id,
    )
    .slice(0, fieldCount === null ? count - available().length : undefined)
    .map((op) => op.id);
  assert.ok(
    candidates.filter((id) => present(rosterFor(c).find((op) => op.id === id)).medical >= 60).length >=
      Math.max(0, count - available().length),
    'Enough actual free local physicians must remain for ordinary readiness.',
  );
  assert.ok(
    fieldReady() || candidates.length,
    'Actual serving field bodies must remain for ordinary readiness.',
  );
  assert.ok(
    rolesReady() ||
      candidates.some((id) => {
        const op = rosterFor(c).find((op) => op.id === id);
        return present(op).medical >= 60 || present(op).leadership >= 80;
      }),
    'A free local commander or additional physician must remain for distinct role readiness.',
  );
  const events = [],
    emit = (event) => {
      const { campaign, battle, ...record } = event;
      events.push(record);
    };
  const retained = createFreshRouteOrders(
      () => c,
      (next) => {
        c = next;
      },
      { report: emit },
    ),
    order = retained.order;
  const clock = (s: CampaignSnapshot) => s.hour * 3600 + (s.secondOfHour ?? 0),
    started = clock(c),
    before = candidates.map((id) => ({
      id,
      morale: present(c.operativeState[id]).morale,
      energy: present(c.operativeState[id]).energy,
      fatigue: present(c.operativeState[id]).fatigue,
      medkits: present(c.operativeState[id]).medkits,
    }));
  const until =
    deadlineSeconds ?? started + NATIVE_MOUNTAIN_RESERVE_BOUNDS.readinessRestHours * 3600;
  assert.ok(
    Number.isSafeInteger(until) &&
      until <= started + NATIVE_MOUNTAIN_RESERVE_BOUNDS.readinessRestHours * 3600,
  );
  let lastBudget = null;
  let notices = 0;
  try {
    report({
      event: 'mountainDoctorReadinessStarted',
      sector,
      count,
      ids: candidates,
      before,
      hour: c.hour,
      second: c.secondOfHour ?? 0,
      treasury: c.resources.treasury,
      campaign: c,
    });
    for (const operativeId of candidates) {
      order({ type: 'assignCare', operativeId, assignment: 'rest' });
    }
    while (available().length < count || !fieldReady() || !rolesReady()) {
      assert.ok(
        clock(c) - started < NATIVE_MOUNTAIN_RESERVE_BOUNDS.readinessRestHours * 3600,
        'Physician readiness reached the existing ordinary-rest bound.',
      );
      assert.ok(
        clock(c) + 3600 <= until,
        'Physician readiness shares the original mountain readiness deadline.',
      );
      if (budgetBeforeWait) {
        lastBudget = budgetBeforeWait(c, 3600);
        assert.equal(lastBudget.budget.available, true, lastBudget.budget.reason);
      }
      const at = clock(c);
      order({ type: 'wait', hours: 1 });
      const elapsed = clock(c) - at;
      assert.equal(c.defeated, false, 'Physician readiness cannot adopt a defeated campaign.');
      assert.ok(
        elapsed >= 0 && elapsed <= 3600,
        'Ordinary physician rest cannot exceed its requested hour.',
      );
      notices = elapsed === 0 ? notices + 1 : 0;
      assert.ok(notices < 3, 'Physician readiness stopped after repeated zero-time notices.');
      emit({
        event: 'mountainDoctorReadinessTick',
        hour: c.hour,
        second: c.secondOfHour ?? 0,
        elapsedSeconds: elapsed,
        doctors: candidates.map((id) => ({
          id,
          morale: present(c.operativeState[id]).morale,
          energy: present(c.operativeState[id]).energy,
          fatigue: present(c.operativeState[id]).fatigue,
        })),
      });
    }
    retained.check();
    assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
    for (const event of events) {
      report(event);
    }
    report({
      event: 'mountainDoctorReadinessPrepared',
      sector,
      count,
      ids: candidates,
      before,
      after: candidates.map((id) => ({
        id,
        morale: present(c.operativeState[id]).morale,
        energy: present(c.operativeState[id]).energy,
        fatigue: present(c.operativeState[id]).fatigue,
        medkits: present(c.operativeState[id]).medkits,
      })),
      elapsedSeconds: clock(c) - started,
      hour: c.hour,
      second: c.secondOfHour ?? 0,
      treasury: c.resources.treasury,
      campaign: c,
    });
    return c;
  } catch (error) {
    if (deadlineSeconds !== null) {
      if (error.campaign) {
        c = error.campaign;
      }
      error.campaign = c;
      error.mountainReadiness = { deadlineSeconds: until, lastBudget };
    }
    report({
      event: 'mountainDoctorReadinessStopped',
      reason: error.message,
      sector,
      count,
      ids: candidates,
      attemptedReports: events,
      campaign: c,
    });
    throw error;
  }
}

// Bank actual port income before signing contracts and reuse finite mountain guns.
export function prepareFreshLosPatosAssault(
  start: CampaignSnapshot,
  { batteryIds = null, fieldCount = 8, report = () => {} } = {},
) {
  assert.ok(
    Number.isSafeInteger(fieldCount) && fieldCount >= 8 && fieldCount <= 24,
    'The paid mountain force must fit ordinary six-person columns.',
  );
  let c = decodeSave(encodeSave(start)).campaign;
  let retained = createFreshRouteOrders(
    () => c,
    (next) => {
      c = next;
    },
    { report },
  );
  const readinessDeadline =
    fieldCount > 8
      ? c.hour * 3600 +
        (c.secondOfHour ?? 0) +
        NATIVE_MOUNTAIN_RESERVE_BOUNDS.readinessRestHours * 3600
      : null;
  let preparing = true;
  const order = (action: CampaignAction) => {
    if (preparing && readinessDeadline !== null) {
      assert.ok(
        c.hour * 3600 +
          (c.secondOfHour ?? 0) +
          (action.type === 'wait' ? action.hours * 3600 : 0) <=
          readinessDeadline,
        'Los Patos preparation shares one original readiness allowance.',
      );
    }
    return retained.order(action);
  };
  const protectedDuties =
    fieldCount > 8
      ? rosterFor(start)
          .filter(
            (op) =>
              start.recruited.includes(op.id) &&
              (!freeMountainDuty(start, op) ||
                start.militiaTraining.some((course) => course.trainerId === op.id)),
          )
          .map((op) => op.id)
      : [];
  if (fieldCount <= 8) {
    c = restorePaidMountainVeterans(c, { report });
  }
  const doctorCount = fieldCount > 8 ? Math.ceil(fieldCount / 6) : 2;
  const reservedIds =
    fieldCount > 8 && c.flags.foundry
      ? [campaignRole(c, 'foundryEngineer')?.id].filter((id) => id !== undefined)
      : [];
  c = prepareMountainServingReserves(c, {
    sector: 'mendoza',
    fieldCount,
    doctorCount,
    exclude: [...reservedIds, ...protectedDuties],
    deadlineSeconds: readinessDeadline,
    report,
  });
  const permanent = rosterFor(c).filter((op) => {
    const r = c.operativeState[op.id];
    return (
      c.recruited.includes(op.id) &&
      present(r).alive &&
      !present(r).captured &&
      present(r).location === 'mendoza' &&
      c.contracts[op.id]?.expiresAt === null
    );
  });
  assert.ok(permanent.length, 'the real permanent survivors retain the assembly squad');
  order({ type: 'squad', ids: permanent.map((op) => op.id).slice(0, 6) });
  for (const operativeId of c.recruited.filter((id) => {
    const r = c.operativeState[id];
    return present(r).alive && !present(r).captured && present(r).location === 'mendoza' && !protectedDuties.includes(id);
  })) {
    order({ type: 'assignCare', operativeId, assignment: 'rest' });
  }
  const admission = {
    sector: 'mendoza',
    fieldCount,
    doctorCount,
    exclude: [...reservedIds, ...protectedDuties],
    fieldPool: (state: CampaignSnapshot) => mountainFieldPool(state, 'mendoza', [...reservedIds, ...protectedDuties]),
    departurePlan: (state, ids, notBeforeSeconds) =>
      mountainLosPatosDeparturePlan(state, {
        batteryIds,
        plannedFieldIds: ids,
        notBeforeSeconds,
        sleepApproaches: true,
      }),
  };
  if (fieldCount > 8) {
    const kept = retained.keepIds(),
      preparation = prepareReturnedMountainService(c, {
        ...admission,
        deadlineSeconds: readinessDeadline,
        report,
      });
    c = preparation.campaign;
    assert.deepEqual(
      kept.filter((id) => !c.recruited.includes(id)).sort((a, b) => a - b),
      preparation.receipt.completedDuties.map((row) => row.id).sort((a, b) => a - b),
      'Only actual completed-duty receipts change the retained service ledger.',
    );
    retained = createFreshRouteOrders(
      () => c,
      (next) => {
        c = next;
      },
      { report },
    );
  }
  const requiredFunds = () => {
    const prices = rosterFor(c)
      .filter((op) => {
        const r = c.operativeState[op.id],
          q = contractQuote(c, op, 'day');
        return (
          op.id >= 100 &&
          op.id < 1000 &&
          present(r).alive &&
          !present(r).captured &&
          present(r).hp === present(r).maxHp &&
          present(r).morale >= 50 &&
          ((c.recruited.includes(op.id) && present(r).location === 'mendoza') || q.available)
        );
      })
      .map((op) =>
        c.recruited.includes(op.id) && present(c.operativeState[op.id]).location === 'mendoza'
          ? 0
          : contractQuote(c, op, 'day').price,
      )
      .sort((a, b) => a - b);
    return Math.max(
      14000,
      2000 +
        2 *
          prices
            .slice(0, Math.max(0, fieldCount - permanent.length))
            .reduce((sum, price) => sum + price, 0),
    );
  };
  if (fieldCount <= 8) {
    c = bankRouteIncome(c, requiredFunds(), { keepIds: retained.keepIds(), report });
  }
  for (let i = 0; i < 24 && (c.hour % 24 < 6 || c.hour % 24 > 10); i++) {
    order({ type: 'wait', hours: 1 });
  }
  const readyLocal = (op: CampaignOperative) => {
    const r = c.operativeState[op.id];
    return (
      present(r).alive &&
      !present(r).captured &&
      present(r).hp === present(r).maxHp &&
      present(r).morale >= 50 &&
      (fieldCount <= 8 ||
        (!protectedDuties.includes(op.id) &&
          !reservedIds.includes(op.id) &&
          (!c.recruited.includes(op.id) ||
            (freeMountainDuty(c, op) && canReassignOperative(c, op.id)))))
    );
  };
  // Finish the existing single readiness interval before choosing roles. A
  // ready physician must not become commander while another actual commander
  // is still earning ordinary local morale rest.
  c = prepareMountainDoctorReadiness(c, {
    sector: 'mendoza',
    count: doctorCount,
    exclude: protectedDuties,
    fieldCount,
    reservedIds: [...reservedIds, ...protectedDuties],
    requireCommander: true,
    ...(fieldCount > 8
      ? {
          deadlineSeconds: readinessDeadline,
          budgetBeforeWait: (state, nextSeconds) =>
            quoteReturnedMountainAdmission(state, { ...admission, nextSeconds }),
        }
      : {}),
    report,
  });
  const commanders = rosterFor(c)
    .filter(
      (op) =>
        readyLocal(op) &&
        op.leadership >= 80 &&
        (permanent.some((p) => p.id === op.id) ||
          (op.id >= 100 &&
            op.id < 1000 &&
            ((c.recruited.includes(op.id) && present(c.operativeState[op.id]).location === 'mendoza') ||
              contractQuote(c, op, 'day').available))),
    )
    .sort(
      (a, b) =>
        Number(permanent.some((op) => op.id === b.id)) -
          Number(permanent.some((op) => op.id === a.id)) ||
        contractQuote(c, a, 'day').price - contractQuote(c, b, 'day').price ||
        b.marksmanship - a.marksmanship,
    );
  const physicians = rosterFor(c)
    .filter(
      (op) =>
        op.medical >= 60 &&
        ((c.recruited.includes(op.id) &&
          present(c.operativeState[op.id]).location === 'mendoza' &&
          capableMountainActor(c, op.id) &&
          readyLocal(op)) ||
          (!c.recruited.includes(op.id) &&
            op.id >= 100 &&
            op.id < 1000 &&
            readyLocal(op) &&
            contractQuote(c, op, 'day').available)),
    )
    .sort((a, b) =>
      fieldCount > 8
        ? contractQuote(c, a, 'day').price - contractQuote(c, b, 'day').price ||
          b.medical - a.medical ||
          a.id - b.id
        : Number(c.recruited.includes(b.id)) - Number(c.recruited.includes(a.id)) ||
          b.medical - a.medical ||
          contractQuote(c, a, 'day').price - contractQuote(c, b, 'day').price ||
          a.id - b.id,
    );
  const roles = mountainCommandRolePlan({ commanders, physicians, count: doctorCount });
  recordRouteStrategicEvidence({
    helper: 'prepareFreshLosPatosAssault',
    stage: 'role-admission',
    campaign: c,
    context: {
      fieldCount,
      doctorCount,
      protectedDuties,
      reservedIds,
      commanders,
      physicians,
      roles,
      scope:
        'Current already-computed role candidates after the original paid readiness interval; no extra Native queries or orders.',
    },
  });
  assert.ok(
    roles,
    'The second column needs a real ready commander distinct from every required physician.',
  );
  const { commander, doctors } = roles;
  assert.equal(
    doctors.length,
    doctorCount,
    'actual capable medical>=60 doctors must serve each dispersed column',
  );
  const engineer =
    fieldCount > 8 && c.flags.foundry ? campaignRole(c, 'foundryEngineer')?.id : null;
  const base = [
    ...new Set([
      commander.id,
      ...doctors.map((op) => op.id),
      ...permanent
        .filter((op) => op.id !== engineer && capableMountainActor(c, op.id) && readyLocal(op))
        .map((op) => op.id),
    ]),
  ].slice(0, fieldCount);
  if (engineer !== null) {
    report({
      event: 'mountainFoundryRear',
      operativeId: engineer,
      location: c.operativeState[engineer].location,
      alive: c.operativeState[engineer].alive,
    });
  }
  const rolePrice = base.reduce(
    (sum, id) =>
      sum +
      (c.recruited.includes(id)
        ? 0
        : contractQuote(
            c,
            rosterFor(c).find((op) => op.id === id),
            'day',
          ).price),
    0,
  );
  const column = affordableMountainColumn(c, fieldCount - base.length, {
      reserve: 2000 + 2 * rolePrice,
      paidDays: 2,
      exclude: [...base, ...protectedDuties],
      preferRetention: fieldCount > 8,
    }),
    recruits = column.ids;
  assert.equal(
    recruits.length,
    fieldCount - base.length,
    'available survivors or replacements accept actual contracts',
  );
  report({
    event: 'mountainPaidColumn',
    sector: 'los_patos',
    ids: recruits,
    price: column.price,
    hour: c.hour,
    treasury: c.resources.treasury,
  });
  for (const id of recruits) {
    report({
      event: 'mountainLocalReplacement',
      operativeId: id,
      hour: c.hour,
      treasury: c.resources.treasury,
      quote: contractQuote(
        c,
        rosterFor(c).find((op) => op.id === id),
        'day',
      ),
    });
  }
  const hiringIds = [...new Set([...base, ...recruits])],
    field = [];
  if (fieldCount > 8) {
    const remaining = hiringIds.filter(
      (id) => !doctors.some((op) => op.id === id) && id !== commander.id,
    );
    for (let columnIndex = 0; field.length < fieldCount; columnIndex++) {
      const members =
        columnIndex === 0 ? [commander.id, doctors[columnIndex].id] : [doctors[columnIndex].id];
      members.push(
        ...remaining.splice(
          0,
          Math.min(6 - members.length, fieldCount - field.length - members.length),
        ),
      );
      field.push(...members);
    }
    assert.equal(field.length, fieldCount);
    assert.equal(new Set(field).size, fieldCount);
  } else {
    field.push(...hiringIds);
  }
  const rearm = field.filter(
    (id) =>
      present(c.operativeState[id]).weaponDropped ||
      ![1800, 1801, 1802].includes(present(rosterFor(c).find((o) => o.id === id)).weapon),
  );
  for (let h = 0; h < 24 && (c.hour % 24 < 6 || c.hour % 24 > 10); h++) {
    order({ type: 'wait', hours: 1 });
  }
  for (const id of hiringIds) {
    if (c.recruited.includes(id)) {
      continue;
    }
    const quote = contractQuote(
        c,
        rosterFor(c).find((op) => op.id === id),
        'day',
      ),
      cash = c.resources.treasury;
    order({ type: 'recruitCivic', id, term: 'day', destination: 'mendoza' });
    assert.equal(c.resources.treasury, cash - quote.total);
  }
  for (let h = 0; h < 24 && hiringIds.some((id) => !c.recruited.includes(id)); h++) {
    order({ type: 'wait', hours: 1 });
  }
  assert.ok(
    hiringIds.every((id) => c.recruited.includes(id)),
    'paid replacements must arrive before receiving equipment',
  );
  for (const operativeId of rearm) {
    c = recoverRoutePrimary(c, operativeId, { preferredWeapon: 1801, replace: true, report });
  }
  // Rehiring does not issue the returned kit again. Recover missing paid kit
  // from real stock while keeping permanent encounter recruits' empty slots.
  c = collectReturnedMountainKit(c, hiringIds, { report });
  order({ type: 'squad', ids: field.slice(0, 6) });
  const main = c.activeSquadId,
    columns = [main];
  for (let offset = 6; offset < field.length; offset += 6) {
    order({
      type: 'createSquad',
      name: 'Apoyo de Los Patos',
      ids: field.slice(offset, offset + 6),
      sector: 'mendoza',
    });
    columns.push(c.activeSquadId);
  }
  const donor = field.find(
    (id) => !doctors.some((op) => op.id === id) && capableMountainActor(c, id),
  );
  assert.notEqual(
    donor,
    undefined,
    'a distinct capable issued donor must carry the actual doctor reserve',
  );
  const deficits = doctors.map((op) => ({
    id: op.id,
    medical: op.medical,
    carried: present(c.operativeState[op.id]).medkits,
    needed: Math.max(0, 5 - present(c.operativeState[op.id]).medkits),
  }));
  const medicalReserves = Object.fromEntries(
      doctors.map((op: { id: string|number; }) => [op.id, c.operativeState[op.id].medkits]),
    ),
    neededReserve = deficits.reduce((sum, row) => sum + row.needed, 0);
  if (fieldCount > 8) {
    const reserves = Object.fromEntries(
      doctors.map((op: { id: string|number; }) => [op.id, Math.max(5, c.operativeState[op.id].medkits)]),
    );
    for (const doctor of doctors) {
      c = prepareMountainDressings(c, doctor.id, 5, { reserves, report });
      c = supplyRouteDressings(c, doctor.id, 5, { reserves, report });
      assert.ok(
        present(c.operativeState[doctor.id]).medkits >= 5,
        'each actual flank physician carries their own finite reserve',
      );
    }
    report({
      event: 'mountainDistributedClinicRoles',
      sector: 'los_patos',
      commanderId: commander.id,
      doctors: doctors.map((op) => ({
        id: op.id,
        medical: op.medical,
        medkits: present(c.operativeState[op.id]).medkits,
      })),
      field: [...field],
      columns: [...columns],
      campaign: c,
    });
  } else {
    c = prepareMountainDressings(c, donor, neededReserve, { reserves: medicalReserves, report });
    c = supplyRouteDressings(c, donor, neededReserve, { reserves: medicalReserves, report });
    report({
      event: 'mountainClinicalRoles',
      sector: 'los_patos',
      commanderId: commander.id,
      donorId: donor,
      donorKits: present(c.operativeState[donor]).medkits,
      doctors: deficits,
      field: [...field],
      campaign: c,
    });
  }
  c = supplyFreshMountainAmmunition(c, field, { target: 12, report });
  order({ type: 'configureArtillery', types: [] });
  for (const id of columns) {
    order({ type: 'selectSquad', id });
    for (const operativeId of c.squad) {
      order({ type: 'assignCare', operativeId, assignment: 'active' });
    }
    c = finishReloadsBeforeMarch(c);
  }
  if (readinessDeadline !== null) {
    assert.ok(
      c.hour * 3600 + (c.secondOfHour ?? 0) <= readinessDeadline,
      'All actual arrival, equipment and readiness work consumes the original allowance.',
    );
  }
  preparing = false;
  const parallel = fieldCount > 8 && columns.length > 1;
  const departureBudget = (stage: string, { sleepApproaches = parallel } = {}) => {
    const plan = mountainLosPatosDeparturePlan(c, { columns, batteryIds, stage, sleepApproaches }),
      budget = quoteMountainServiceBudget(c, {
        keepIds: retained.keepIds(),
        horizonSeconds: plan.horizonSeconds,
        fixedCost: plan.fixedCost,
      });
    report({
      event: 'mountainDepartureBudget',
      plan,
      budget,
      hour: c.hour,
      second: c.secondOfHour ?? 0,
    });
    return { plan, budget };
  };
  if (parallel) {
    const plan = mountainLosPatosDeparturePlan(c, { columns, batteryIds, sleepApproaches: true });
    const beforeServing = retained.keepIds();
    const duties = completeMountainPaidDuties(c, {
      fieldIds: field,
      doctorIds: doctors.map((op) => op.id),
      protectedIds: protectedDuties,
      horizonSeconds: plan.horizonSeconds,
      fixedCost: plan.fixedCost,
      report,
    });
    c = duties.campaign;
    assert.deepEqual(
      beforeServing.filter((id) => !c.recruited.includes(id)).sort((a, b) => a - b),
      duties.completed.map((row) => row.id).sort((a, b) => a - b),
      'Only the actual completed-duty receipts can leave continuing service.',
    );
    retained = createFreshRouteOrders(
      () => c,
      (next) => {
        c = next;
      },
      { report },
    );
    let funding = departureBudget('mendoza');
    if (!funding.budget.available) {
      assert.ok(
        funding.budget.entries.every((row) => !row.reason),
        funding.budget.reason,
      );
      const payroll = retained.keepIds().reduce(
        (sum, id) =>
          sum +
          contractRenewalQuote(
            c,
            rosterFor(c).find((op) => op.id === id),
            'day',
          ).daily,
        0,
      );
      assert.ok(
        dailyIncome(c) > payroll,
        'Actual port income must exceed continuing service before banking the departure reserve.',
      );
      c = bankRouteIncome(c, funding.budget.totalCost, { keepIds: retained.keepIds(), report });
      funding = departureBudget('mendoza');
    }
    assert.ok(
      funding.budget.available,
      funding.budget.reason ?? 'The complete current mountain departure must be funded.',
    );
  }
  if (parallel) {
    for (const id of columns) {
      order({ type: 'selectSquad', id });
      order({ type: 'travel', sector: 'uspallata', mode: 'posta', queue: true });
    }
    const began = c.hour * 3600 + (c.secondOfHour ?? 0);
    let notices = 0;
    while (columns.some((id) => c.squads.find((q) => q.id === id)?.journey)) {
      assert.ok(
        c.hour * 3600 + (c.secondOfHour ?? 0) - began <
          NATIVE_MOUNTAIN_RESERVE_BOUNDS.travelHours * 3600,
      );
      const at = c.hour * 3600 + (c.secondOfHour ?? 0);
      order({ type: 'wait', hours: 1 });
      notices = c.hour * 3600 + (c.secondOfHour ?? 0) === at ? notices + 1 : 0;
      assert.ok(notices < 3, 'Parallel mountain routes stop after repeated zero-time notices.');
      for (const id of columns) {
        const q = c.squads.find((q) => q.id === id);
        assert.ok(q);
        assert.ok(
          !q.journey || q.journey.status === 'moving',
          'Resolve the actual paused mountain route.',
        );
        if (!q.journey) {
          assert.equal(q.location, 'uspallata');
        }
      }
    }
    for (const id of columns) {
      assert.equal(
        present(c.squads.find((q) => q.id === id)).location,
        'uspallata',
        'Every real column arrives before the guns are dispatched.',
      );
    }
    report({
      event: 'mountainColumnsArrived',
      columns: [...columns],
      elapsedSeconds: c.hour * 3600 + (c.secondOfHour ?? 0) - began,
      hour: c.hour,
      second: c.secondOfHour ?? 0,
      campaign: c,
    });
  } else {
    for (const id of columns) {
      order({ type: 'selectSquad', id });
      order({ type: 'travel', sector: 'uspallata', mode: 'posta' });
    }
  }
  order({ type: 'selectSquad', id: main });
  if (batteryIds) {
    assert.ok(
      mountainBatteryRecords(c, batteryIds).some((gun) => gun.loaded || gun.ammo > 0),
      'Los Patos support needs real remaining rounds from the same finite battery.',
    );
  }
  const battery = prepareMountainBattery(c, ['bronze4', 'bronze4'], {
    batteryIds,
    destination: 'uspallata',
    keepServing: retained.keepIds(),
    report,
  });
  c = battery.campaign;
  order({ type: 'configureArtillery', types: battery.selections });
  if (parallel) {
    const { budget } = departureBudget('uspallata');
    assert.ok(
      budget.available,
      budget.reason ?? 'Requote the actual remaining flank service before departure.',
    );
  }
  const destination = worldCell('los_patos', c),
    flanks = [
      'uspallata',
      `cell-${present(destination).col}-${present(destination).row - 1}`,
      `cell-${present(destination).col}-${present(destination).row + 1}`,
      `cell-${present(destination).col - 1}-${present(destination).row}`,
    ];
  const approaches = columns.map((id, index) => ({
    id,
    origin: fieldCount > 8 ? flanks[index] : 'uspallata',
    mode: fieldCount > 8 && index ? 'march' : 'posta',
  }));
  const queued = [];
  for (const approach of approaches) {
    order({ type: 'selectSquad', id: approach.id });
    if (c.location !== approach.origin) {
      const before = { hour: c.hour, second: c.secondOfHour ?? 0, treasury: c.resources.treasury };
      order({
        type: 'travel',
        sector: approach.origin,
        mode: 'march',
        ...(parallel ? { queue: true } : {}),
      });
      if (parallel) {
        queued.push({ ...approach, before });
        continue;
      }
      assert.equal(
        c.location,
        approach.origin,
        'the flank must reach its actual neighboring rural cell',
      );
      assert.equal(
        present(c.squads.find((q) => q.id === approach.id)).journey,
        undefined,
        'finish the real flank journey before queuing its assault',
      );
      report({
        event: 'mountainFlankApproach',
        squadId: approach.id,
        origin: approach.origin,
        entry: entryFromSector(approach.origin, 'los_patos', null, c),
        before,
        after: { hour: c.hour, second: c.secondOfHour ?? 0, treasury: c.resources.treasury },
        members: [...c.squad],
      });
    }
  }
  if (queued.length) {
    const began = c.hour * 3600 + (c.secondOfHour ?? 0);
    let notices = 0;
    while (queued.some((approach) => c.squads.find((q) => q.id === approach.id)?.journey)) {
      assert.ok(
        c.hour * 3600 + (c.secondOfHour ?? 0) - began <
          NATIVE_MOUNTAIN_RESERVE_BOUNDS.travelHours * 3600,
      );
      const at = c.hour * 3600 + (c.secondOfHour ?? 0);
      order({ type: 'wait', hours: 1 });
      notices = c.hour * 3600 + (c.secondOfHour ?? 0) === at ? notices + 1 : 0;
      assert.ok(notices < 3, 'Parallel flank routes stop after repeated zero-time notices.');
      for (const approach of queued) {
        const q = c.squads.find((q) => q.id === approach.id);
        assert.ok(q);
        assert.ok(
          !q.journey || q.journey.status === 'moving',
          'Resolve the actual paused flank route.',
        );
        if (!q.journey && !approach.reported) {
          assert.equal(q.location, approach.origin);
          report({
            event: 'mountainFlankApproach',
            squadId: approach.id,
            origin: approach.origin,
            entry: entryFromSector(approach.origin, 'los_patos', null, c),
            before: approach.before,
            after: { hour: c.hour, second: c.secondOfHour ?? 0, treasury: c.resources.treasury },
            members: [...q.members],
          });
          approach.reported = true;
        }
      }
    }
    report({
      event: 'mountainFlanksArrived',
      columns: queued.map((q) => q.id),
      elapsedSeconds: c.hour * 3600 + (c.secondOfHour ?? 0) - began,
      hour: c.hour,
      second: c.secondOfHour ?? 0,
      campaign: c,
    });
  }
  if (parallel) {
    c = prepareMountainApproachSleep(c, { columns, report });
    const { budget } = departureBudget('flanks', { sleepApproaches: false });
    assert.ok(
      budget.available,
      budget.reason ?? 'Requote actual service after paid approach sleep.',
    );
  }
  if (parallel) {
    const { budget } = departureBudget('assault');
    assert.ok(budget.available, budget.reason);
  }
  c = stageAssaultDeparture(c, approaches, 'los_patos', {
    execute: (request) => {
      order(request);
      return c;
    },
  });
  for (const { id, mode } of approaches) {
    order({ type: 'selectSquad', id });
    order({ type: 'attack', sector: 'los_patos', queue: true, mode });
  }
  c = completeQueuedAssault(c, columns, 'los_patos', {
    execute: (request) => {
      order(request);
      return c;
    },
  });
  assert.equal(present(c.pendingBattle).squad.length, field.length);
  for (const approach of approaches) {
    const group = present(c.pendingBattle).assaultSquads.find((q) => q.id === approach.id),
      entry = entryFromSector(approach.origin, 'los_patos', null, c);
    assert.ok(group);
    assert.equal(group.origin, approach.origin);
    assert.ok(
      group.members.every(
        (id) => present(c.pendingBattle).squad.find((u) => u.id === id).entryEdge === present(entry).entryEdge,
      ),
      'each actual force keeps its physical approach edge',
    );
  }
  for (const [id, r] of Object.entries(start.operativeState)) {
    if (!r.alive) {
      assert.equal(c.operativeState[id].alive, false);
    }
  }
  return c;
}

export function completeFreshAndesPreparation(start: CampaignSnapshot, { report = () => {} } = {}) {
  let c = decodeSave(encodeSave(start)).campaign;
  const localIds = c.recruited.filter(
    (id) =>
      present(c.operativeState[id]).alive &&
      !present(c.operativeState[id]).captured &&
      present(c.operativeState[id]).location === 'los_patos',
  );
  const retained = createFreshRouteOrders(
    () => c,
    (next) => {
      c = next;
    },
    { report },
  );
  const order = retained.order;
  if (localIds.length > 6) {
    c = performFreshMountainLocalFirstAid(c, { report });
  } else {
    // A settled battle can leave a critical survivor in another physical squad.
    // Assemble up to six actual locals before using their carried first aid.
    if (localIds.length <= 6) {
      order({ type: 'squad', ids: localIds });
    }
    if (localIds.some((id) => present(c.operativeState[id]).hp < 15 || present(c.operativeState[id]).bleeding)) {
      const scene = c.sectorStates.los_patos,
        patients = present(scene).units.filter(
          (unit) => localIds.includes(Number(unit.id)) && (unit.hp < 15 || unit.bleeding),
        );
      const doctors = rosterFor(c)
        .filter(
          (op) =>
            localIds.includes(op.id) &&
            op.medical > 0 &&
            present(c.operativeState[op.id]).hp >= 15 &&
            !present(c.operativeState[op.id]).bleeding,
        )
        .sort((a, b) => {
          const distance = (id: number) => {
            const unit = present(scene).units.find((unit) => unit.id === String(id));
            return Math.min(
              ...patients.map((patient: TacticalPoint) => Math.hypot(present(unit).x - patient.x, present(unit).y - patient.y)),
            );
          };
          return distance(a.id) - distance(b.id) || b.medical - a.medical;
        });
      // Recover only real, reachable field dressings. The nearest conscious
      // physician can then start aid without a fatal cross-sector approach.
      for (const doctor of doctors) {
        const model = sectorInventoryModel(c, 'los_patos', rosterFor(c), doctor.id);
        for (const source of model.entries.filter(
          (row) => row.reachable && JSON.parse(row.expected).item === 'medkits',
        )) {
          const count = Math.min(
            source.count,
            Math.max(0, 3 - present(c.operativeState[doctor.id]).medkits),
          );
          if (!count) {
            continue;
          }
          const before = { hour: c.hour, second: c.secondOfHour, treasury: c.resources.treasury };
          order({
            type: 'sectorInventory',
            sector: 'los_patos',
            operativeId: doctor.id,
            direction: 'take',
            sourceKey: source.key,
            expected: source.expected,
            count,
          });
          const remaining =
            sectorInventoryModel(c, 'los_patos', rosterFor(c), doctor.id).entries.find(
              (row) => row.key === source.key,
            )?.count ?? 0;
          assert.equal(remaining, source.count - count);
          assert.deepEqual(
            { hour: c.hour, second: c.secondOfHour, treasury: c.resources.treasury },
            before,
          );
          report({
            event: 'andesFiniteDressingsRecovered',
            operativeId: doctor.id,
            sourceKey: source.key,
            count,
            sourceCount: source.count,
            remaining,
            ...before,
          });
        }
      }
    }
    const aidGroups = c.squads
      .filter((q) => q.members.some((id) => localIds.includes(id)))
      .sort(
        (a, b) =>
          Number(
            b.members.some((id) => present(c.operativeState[id]).hp < 15 || present(c.operativeState[id]).bleeding),
          ) -
          Number(
            a.members.some((id) => present(c.operativeState[id]).hp < 15 || present(c.operativeState[id]).bleeding),
          ),
      );
    for (const group of aidGroups) {
      order({ type: 'selectSquad', id: group.id });
      c = performFreshMountainFirstAid(visit(c), { stage: 'los-patos-first-aid', report });
    }
  }
  report({
    event: 'andesFirstAid',
    hour: c.hour,
    second: c.secondOfHour,
    units: localIds.map((id) => ({
      id,
      hp: present(c.operativeState[id]).hp,
      bleeding: present(c.operativeState[id]).bleeding,
      medkits: present(c.operativeState[id]).medkits,
    })),
  });

  for (const id of c.recruited.filter(
    (id) => present(c.operativeState[id]).alive && present(c.operativeState[id]).location === 'los_patos',
  )) {
    assert.ok(present(c.operativeState[id]).hp >= 15);
    assert.equal(present(c.operativeState[id]).bleeding, 0);
  }
  order({ type: 'fortify', sector: 'los_patos' });
  assert.equal(c.phase, 4);
  const field = c.recruited.filter(
    (id) => present(c.operativeState[id]).alive && present(c.operativeState[id]).location === 'los_patos',
  );
  const returning = c.squads
    .filter((q) => q.members.some((id) => field.includes(id)))
    .map((q) => q.id);
  assert.ok(returning.length > 0);
  for (const operativeId of field) {
    order({ type: 'assignCare', operativeId, assignment: 'active' });
  }
  // Keep both surviving squads within the normal six-person limit and return
  // concurrently, paying each route rather than merging eight people into one.
  for (const id of returning) {
    order({ type: 'selectSquad', id });
    order({ type: 'travel', sector: 'mendoza', mode: 'posta', queue: true });
  }
  for (
    let hour = 0;
    hour < 80 && returning.some((id) => c.squads.find((q) => q.id === id)?.journey);
    hour++
  ) {
    assert.equal(c.pendingEncounter, null);
    order({ type: 'wait', hours: 1 });
  }
  for (const id of field) {
    assert.ok(present(c.operativeState[id]).alive);
    assert.equal(present(c.operativeState[id]).location, 'mendoza');
  }
  let envoy = rosterFor(c).find(
    (op) =>
      c.recruited.includes(op.id) &&
      present(c.operativeState[op.id]).alive &&
      !present(c.operativeState[op.id]).captured &&
      present(c.operativeState[op.id]).location === 'mendoza' &&
      present(c.operativeState[op.id]).hp >= 15 &&
      !present(c.operativeState[op.id]).bleeding &&
      op.leadership >= 80,
  )?.id;
  if (envoy === undefined) {
    const candidate = rosterFor(c)
      .filter((op) => {
        const unit = c.operativeState[op.id],
          quote = contractQuote(c, op, 'day');
        return (
          op.id >= 100 &&
          op.id < 1000 &&
          present(unit).alive &&
          !present(unit).captured &&
          present(unit).hp >= 15 &&
          !present(unit).bleeding &&
          !present(unit).serviceEquipmentReturn &&
          op.leadership >= 80 &&
          quote.available &&
          quote.price <= c.resources.treasury - 200
        );
      })
      .sort(
        (a, b) =>
          contractQuote(c, a, 'day').price - contractQuote(c, b, 'day').price ||
          b.leadership - a.leadership,
      )[0];
    assert.ok(
      candidate,
      'the actual treasury must fund a living qualified envoy and the onward journey',
    );
    const quote = contractQuote(c, candidate, 'day'),
      cash = c.resources.treasury,
      hiredHour = c.hour;
    order({ type: 'recruitCivic', id: candidate.id, term: 'day', destination: 'mendoza' });
    assert.equal(c.resources.treasury, cash - quote.price);
    for (let hour = 0; hour < 24 && !c.recruited.includes(candidate.id); hour++) {
      assert.equal(c.pendingEncounter, null);
      order({ type: 'wait', hours: 1 });
    }
    envoy = candidate.id;
    assert.ok(c.recruited.includes(envoy));
    assert.equal(present(c.operativeState[envoy]).location, 'mendoza');
    report({
      event: 'andesPaidEnvoy',
      id: envoy,
      price: quote.price,
      hiredHour,
      arrivalHour: c.hour,
      contractExpiresAt: present(c.contracts[envoy]).expiresAt,
    });
  }
  // Leave a legal place for San Martín without discarding actual survivors.
  const companions = field.filter((id) => id !== envoy && c.recruited.includes(id)).slice(0, 4);
  order({ type: 'squad', ids: [envoy, ...companions] });
  for (const operativeId of c.squad) {
    order({ type: 'assignCare', operativeId, assignment: 'active' });
  }
  c = meetRecruits(c, ['san-martin'], envoy);
  assert.ok(c.recruited.includes(57));
  for (const [id, record] of Object.entries(start.operativeState)) {
    if (!record.alive) {
      assert.equal(c.operativeState[id].alive, false);
    }
  }
  report({
    event: 'andesCommandHandover',
    envoy,
    hour: c.hour,
    second: c.secondOfHour,
    treasury: c.resources.treasury,
    returned: field.map((id) => ({
      id,
      hp: present(c.operativeState[id]).hp,
      alive: present(c.operativeState[id]).alive,
      recruited: c.recruited.includes(id),
    })),
  });
  assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
  return c;
}
