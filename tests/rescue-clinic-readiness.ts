import { present } from './assert-present.ts';
import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import type { BattleSnapshot, BattleUnit, TacticalPoint } from '../packages/game/public/compatibility-types.ts';
import type { ActiveGame } from './local-contract-fixture.ts';
import assert from 'node:assert/strict';
import { dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import { decodeSave, encodeSave } from '../packages/game/save.ts';
import { sectorInventoryModel } from '../packages/game/sector-inventory.js';
import { applyItemQuantity } from '../packages/game/tactical-inventory.js';
import { supplyRouteAmmunition } from './route-ammunition.ts';
import { stageRouteRoofDefenders } from './route-roof-defenders.ts';
import { playerKnownCampaign } from '../packages/game/player-known-state.ts';
import { previewStrategicRoute } from '../packages/game/strategic-route.js';
import { FINITE_SECTOR_CACHES } from '../packages/game/finite-sector-caches.js';
import { SUPPLY_ITEMS } from '../packages/game/tactical-inventory.js';
import { careRules } from '../packages/game/campaign-care-rules.js';
import { contractExpiresSeconds } from '../packages/game/contracts.js';
import { fight } from './opening-driver.ts';
import { northernClinicDefenseOrder } from './northern-route.ts';
import {
  coordinatedHospitalBattery,
  paidHospitalRoofWalkPreview,
} from './coordinated-hospital-battery.ts';
import { northernReliefDefenseController } from './northern-relief-defense.ts';
import {
  publicRouteView,
  usefulRouteRifleShot,
  usefulRouteFiringPosture,
} from './route-infantry-progress.ts';
import { knownRouteBystanderShotSafety } from './route-fire-safety.ts';
import { enterSector } from '../packages/game/world.js';
import {
  actBattle,
  endTurn,
  stanceCost,
  lookPreview,
  hasFirearm,
  getReachable,
  artilleryContact,
  environmentUsePreview,
  actionCosts,
  canSee,
} from '../packages/game/tactical.js';
import { wallEdgeId, wallEdgeCells, wallEdgeCenter } from '../packages/game/wall-geometry.js';
import { environmentTargetSummary } from '../packages/game/environment-interactions.ts';
import { firearmServiceable } from '../packages/game/firearm-serviceability.js';
import { lowerWeapon } from '../packages/game/weapon-readiness.js';
import { propBlocksAt } from '../packages/game/props.js';
import { sameCell, sameSurface, spacePoint, surfaceAt } from '../packages/game/tactical-space.js';
import { syncBattleTime } from '../packages/game/time.js';
import { dailyTownIncome, townIncomeSources } from '../packages/game/town-income.js';
import { recordRouteStrategicEvidence } from './route-strategic-failure-evidence.ts';

export function prepareRescueClinicGuards(start: CampaignSnapshot, { courier, report = () => {} } = {}) {
  let campaign = decodeSave(encodeSave(start)).campaign;
  const sector = 'tucuman',
    previous = campaign.activeSquadId,
    startSeconds = campaign.hour * 3600 + (campaign.secondOfHour ?? 0),
    cash = campaign.resources.treasury,
    medical = new Map(campaign.recruited.map((id) => [id, present(campaign.operativeState[id]).medkits]));
  const income = dailyTownIncome(campaign),
    incomeSources = structuredClone(townIncomeSources(campaign)),
    incomeActivations = structuredClone(campaign.townIncome.activations),
    paidDay = campaign.townIncome.lastPaidDay;
  assert.equal(campaign.pendingBattle, null);
  assert.equal(campaign.pendingEncounter, null);
  assert.equal(present(campaign.sectors[sector]).owner, 'patriot');
  const ids = campaign.recruited.filter((id) => {
    const r = campaign.operativeState[id];
    return id !== courier && present(r).alive && !present(r).captured && present(r).location === sector;
  });
  assert.ok(ids.length);
  assert.ok(
    ids.every((id) => {
      const r = campaign.operativeState[id];
      return present(r).hp >= 15 && !present(r).bleeding && !present(r).asleep && present(r).energy > 10;
    }),
    'actual local guards must be stable, awake and fit before roof preparation',
  );
  const assignments = ids.map((id) => ({ id, assignment: present(campaign.operativeState[id]).assignment })),
    armament = [];
  const order = (action) => {
    campaign = dispatchCampaign(campaign, action);
    assert.equal(campaign.lastError, null, JSON.stringify(action) + ': ' + campaign.lastError);
  };
  const ungrouped = ids.filter(
    (id) =>
      !campaign.squads.some((q) => q.location === sector && !q.journey && q.members.includes(id)),
  );
  for (let offset = 0; offset < ungrouped.length; offset += 6) {
    order({
      type: 'createSquad',
      name: 'Guardia de la clínica',
      sector,
      ids: ungrouped.slice(offset, offset + 6),
    });
  }
  const localSquad = campaign.squads.find(
    (q) => q.location === sector && !q.journey && q.members.some((id) => ids.includes(id)),
  );
  order({ type: 'selectSquad', id: present(localSquad).id });
  for (const id of ids) {
    order({ type: 'assignCare', operativeId: id, assignment: 'active' });
  }
  // Apply the established clinic's long-gun policy to an actually dropped or
  // short primary. Take only the first currently known and reachable long gun.
  for (const id of ids) {
    const op = rosterFor(campaign).find((op) => op.id === id),
      record = campaign.operativeState[id];
    if (!present(record).weaponDropped && ![1804, 1805, 1806, 1807, 1808].includes(present(op).weapon)) {
      continue;
    }
    const inventory = sectorInventoryModel(campaign, sector, rosterFor(campaign), id),
      source = inventory.entries.find(
        (row) =>
          row.reachable &&
          [1800, 1801, 1803].includes(JSON.parse(row.expected).weapon) &&
          (() => {
            try {
              applyItemQuantity(inventory.personal, { ...JSON.parse(row.expected), count: 1 });
              return true;
            } catch {
              return false;
            }
          })(),
      );
    assert.ok(
      source,
      'a clinic guard needs an actual known reachable finite long gun and carrying room',
    );
    const incoming = JSON.parse(source.expected),
      before = inventory.entries
        .filter((row) => [1800, 1801, 1803].includes(JSON.parse(row.expected).weapon))
        .reduce((sum, row) => sum + row.count, 0);
    order({
      type: 'sectorInventory',
      sector,
      operativeId: id,
      direction: 'take',
      sourceKey: source.key,
      expected: source.expected,
      count: 1,
    });
    const after = sectorInventoryModel(campaign, sector, rosterFor(campaign), id);
    assert.equal(
      after.entries
        .filter((row) => [1800, 1801, 1803].includes(JSON.parse(row.expected).weapon))
        .reduce((sum, row) => sum + row.count, 0),
      before - 1,
    );
    const item = after.carried.find(
      (row) =>
        row.equip?.some((e) => e.slot === 'primary' && e.valid) &&
        JSON.parse(row.expected).weapon === incoming.weapon &&
        JSON.parse(row.expected).instanceId === incoming.instanceId,
    );
    assert.ok(item);
    order({
      type: 'sectorInventory',
      sector,
      operativeId: id,
      direction: 'equip',
      inventoryKey: item.inventoryKey,
      expected: item.expected,
      slot: 'primary',
    });
    assert.equal(present(campaign.operativeState[id]).weaponDropped, false);
    armament.push({
      id,
      oldWeapon: present(op).weapon,
      weapon: incoming.weapon,
      sourceKey: source.key,
      sourceExpected: source.expected,
      loaded: incoming.loaded,
    });
  }
  const ammunition = supplyRouteAmmunition(campaign, ids, { target: 14, report });
  campaign = ammunition.campaign;
  const landingGuardIds = rosterFor(campaign)
    .filter((op) => {
      const r = campaign.operativeState[op.id];
      return (
        ids.includes(op.id) &&
        op.medical < 60 &&
        ['active', 'rest'].includes(present(assignments.find((row) => row.id === op.id)).assignment) &&
        hasFirearm({ ...op, ...r }) &&
        !present(r).weaponDropped &&
        present(r).hp >= 15 &&
        !present(r).bleeding &&
        !present(r).routed &&
        !present(r).surrendered
      );
    })
    .sort(
      (a, b) =>
        present(campaign.operativeState[b.id]).hp - present(campaign.operativeState[a.id]).hp ||
        b.marksmanship - a.marksmanship ||
        a.id - b.id,
    )
    .map((op) => op.id);
  let roofEvidence;
  campaign = stageRouteRoofDefenders(campaign, ids, {
    landingGuardIds,
    report: (event) => {
      if (event.event === 'routeRoofDefenders') {
        roofEvidence = event;
      }
      report(event);
    },
  });
  for (const { id, assignment } of assignments) {
    if (assignment !== 'active') {
      order({
        type: 'assignCare',
        operativeId: id,
        assignment:
          assignment === 'doctor' && !present(campaign.operativeState[id]).medkits ? 'rest' : assignment,
      });
    }
  }
  if (campaign.activeSquadId !== previous) {
    order({ type: 'selectSquad', id: previous });
  }
  const incomeDays = Math.floor(campaign.hour / 24) - Math.floor(start.hour / 24),
    incomeReceived = incomeDays * income;
  assert.deepEqual(townIncomeSources(campaign), incomeSources);
  assert.deepEqual(campaign.townIncome.activations, incomeActivations);
  assert.equal(dailyTownIncome(campaign), income);
  assert.equal(
    campaign.townIncome.lastPaidDay,
    incomeDays ? Math.floor(campaign.hour / 24) : paidDay,
  );
  assert.equal(
    campaign.resources.treasury,
    cash + incomeReceived,
    'Only the existing earned midnight income can change treasury during guard preparation.',
  );
  assert.deepEqual(campaign.contracts, start.contracts);
  assert.deepEqual(campaign.recruited, start.recruited);
  for (const [id, r] of Object.entries(start.operativeState)) {
    if (!r.alive) {
      assert.equal(campaign.operativeState[id].alive, false);
    }
    assert.equal(campaign.operativeState[id].captured, r.captured);
  }
  for (const [id, count] of medical) {
    assert.equal(
      present(campaign.operativeState[id]).medkits,
      count,
      'preparation must not consume or grant medical supplies',
    );
  }
  assert.deepEqual(decodeSave(encodeSave(campaign)).campaign, campaign);
  const evidence = {
    event: 'rescueClinicPrepared',
    sector,
    ids,
    courier,
    ungrouped,
    armament,
    ammunitionTransactions: ammunition.transactions,
    roofEvidence,
    elapsedSeconds: campaign.hour * 3600 + (campaign.secondOfHour ?? 0) - startSeconds,
    cost: 0,
    incomeDays,
    incomeReceived,
    netCashChange: campaign.resources.treasury - cash,
  };
  report(evidence);
  return { campaign, evidence };
}

// A prior real collection can establish an empty known cache. Other authored
// caches remain candidates until a public route admits their ordinary discovery.
export function rescueMedicalRouteOptions(campaign: CampaignSnapshot, courier, { exhaustedSources = [] } = {}) {
  const publicState = playerKnownCampaign(campaign),
    actor = present(publicState).operatives.find((op) => op.id === courier),
    squad = campaign.squads.find((q) => q.members.includes(courier) && !q.journey);
  assert.ok(
    actor?.alive && !actor.captured && squad,
    'the actual serving courier must have a local squad',
  );
  return present(publicState).sectors
    .filter(
      (sector) =>
        sector.id !== actor.location &&
        sector.owner === 'patriot' &&
        FINITE_SECTOR_CACHES[sector.id],
    )
    .map((sector) => {
      const knownMedical = sector.equipment
          .filter((row) => row.label === present(SUPPLY_ITEMS.medkits).label)
          .reduce((sum, row) => sum + row.count, 0),
        quote = previewStrategicRoute(campaign, squad.id, sector.id, 'march');
      const witnessedEmpty = exhaustedSources.includes(sector.id) && knownMedical === 0;
      return {
        sector: sector.id,
        knownMedical,
        witnessedEmpty,
        quote,
        admitted: quote.valid && !witnessedEmpty,
      };
    });
}

// Keep the initial physician, contact crew and ground courier on their existing
// orders. Roof rifles may pay for the established short, covered firing lane.
export function rescueClinicDefenseController(initial: BattleSnapshot, { onDecision = () => {} } = {}) {
  const coordinated = coordinatedHospitalBattery(initial),
    held = new Set([
      coordinated.roles.physicianId,
      ...coordinated.roles.crews.flatMap((crew) => crew.ids),
    ]);
  const investigators = new Set(
    initial.units
      .filter(
        (unit) =>
          unit.side === 'player' &&
          !unit.militia &&
          !unit.missionAlly &&
          (unit.tacticalLevel ?? 0) === 0 &&
          !held.has(unit.id) &&
          unit.hp === unit.maxHp &&
          !unit.bleeding &&
          !unit.routed &&
          !unit.unconscious &&
          !unit.departure &&
          !unit.fled &&
          !unit.surrendered &&
          !unit.asleep &&
          !unit.captured &&
          unit.loaded > 0 &&
          !unit.jammed &&
          !unit.weaponDropped &&
          hasFirearm(unit) &&
          !(unit.medical > 0 && unit.medkits > 0) &&
          !['doctor', 'patient', 'militia_doctor'].includes(unit.assignment) &&
          !initial.artillery.some(
            (gun) =>
              gun.side === unit.side &&
              (gun.loaded || gun.ammo > 0) &&
              artilleryContact(initial, unit, gun),
          ),
      )
      .map((unit) => unit.id),
  );
  const investigation = northernReliefDefenseController(
    initial.units.filter((unit) => !investigators.has(unit.id)).map((unit) => unit.id),
  );
  // Observation only: one latest row per stage and initial eligible actor. No
  // diagnostic value enters a choice, and callbacks receive detached scalars.
  const decisions = new Map(
    [...investigators].map((id) => [
      id,
      { id, calls: { ordinary: 0, shared: 0, paidWalking: 0 }, latest: {} },
    ]),
  );
  const actionContext = (action) =>
    action
      ? Object.fromEntries(
          [
            'type',
            'unitId',
            'targetId',
            'x',
            'y',
            'tacticalLevel',
            'movement',
            'movementIntent',
            'stance',
            'slot',
            'aim',
            'hitLocation',
          ]
            .filter((key) => action[key] !== undefined)
            .map((key) => [key, action[key]]),
        )
      : null;
  const routeContext = (route) =>
    route
      ? {
          cost: route.cost,
          pathLength: route.path.length,
          path: route.path.slice(0, 3).map((point) => ({
            x: point.x,
            y: point.y,
            tacticalLevel: point.tacticalLevel ?? 0,
            ...(point.kind === undefined ? {} : { kind: point.kind }),
            ...(point.linkId === undefined ? {} : { linkId: point.linkId }),
          })),
        }
      : null;
  const observe = (stage, battle, unit, detail) => {
    const row = decisions.get(unit?.id);
    if (!row) {
      return;
    }
    const actor = {
      ...Object.fromEntries(
        [
          'id',
          'x',
          'y',
          'tacticalLevel',
          'hp',
          'maxHp',
          'bleeding',
          'energy',
          'stance',
          'movementMode',
          'facing',
          'ap',
          'activeSlot',
          'weapon',
          'loaded',
          'ammo',
          'condition',
          'weaponReady',
          'medical',
          'medkits',
          'assignment',
          'asleep',
          'captured',
          'fled',
          'routed',
          'unconscious',
          'surrendered',
          'mounted',
          'knockedDown',
          'entangled',
          'jammed',
          'weaponDropped',
        ]
          .filter(
            (key) =>
              unit[key] === null || ['string', 'number', 'boolean'].includes(typeof unit[key]),
          )
          .map((key) => [key, unit[key]]),
      ),
      departure: Boolean(unit.departure),
    };
    const retainedProbe =
      stage === 'shared' && !detail.coverProbe ? row.latest.shared?.coverProbe : null;
    row.calls[stage]++;
    row.latest[stage] = structuredClone({
      turn: battle.turn,
      elapsedSeconds: battle.elapsedSeconds,
      actor,
      ...detail,
    });
    if (retainedProbe) {
      row.latest[stage].coverProbe = structuredClone(retainedProbe);
    } // Latest move observation only; no choice reads it.
    try {
      onDecision(
        structuredClone({ id: row.id, stage, calls: row.calls[stage], ...row.latest[stage] }),
      );
    } catch {} // An observer cannot replace an existing decision or gameplay error.
  };
  const diagnosticContext = () => ({
    eligibleIds: [...investigators],
    actors: [...decisions.values()].map((row) => structuredClone(row)),
  });
  const rifles = new Set(
    initial.units
      .filter(
        (unit) =>
          unit.side === 'player' &&
          !unit.militia &&
          unit.hp >= 15 &&
          !unit.routed &&
          !unit.unconscious &&
          !unit.departure &&
          !unit.fled &&
          !unit.surrendered &&
          !unit.asleep &&
          !unit.captured &&
          (unit.tacticalLevel ?? 0) > 0 &&
          !held.has(unit.id),
      )
      .map((unit) => unit.id),
  );
  // A restored post supplies coordinates, not the old facing. Watch its public
  // authored access before contact; no private invader position enters this plan.
  const lookouts = new Map(
    [...rifles].flatMap((id) => {
      const unit = initial.units.find((unit) => unit.id === id),
        access = (initial.climbLinks ?? [])
          .flatMap((link) => {
            const [roof, ground] = sameSurface(unit, link.to)
              ? [link.to, link.from]
              : sameSurface(unit, link.from)
                ? [link.from, link.to]
                : [];
            return roof &&
              (roof.tacticalLevel ?? 0) > (present(ground).tacticalLevel ?? 0) &&
              Math.hypot(roof.x - present(unit).x, roof.y - present(unit).y) <= 4
              ? [{ roof, ground }]
              : [];
          })
          .sort(
            (a, b) =>
              Math.hypot(a.roof.x - present(unit).x, a.roof.y - present(unit).y) -
                Math.hypot(b.roof.x - present(unit).x, b.roof.y - present(unit).y) ||
              present(a.ground).y - present(b.ground).y ||
              present(a.ground).x - present(b.ground).x,
          )[0];
      return access ? [[id, spacePoint(access.ground)]] : [];
    }),
  );
  // An ordinary search cannot cross a closed leaf. Only the original healthy
  // scout may approach and open a presently visible public exit toward a current
  // squad sighting. Recheck an opened leaf's two sides before general search;
  // only the component analysis closes that edge, never the actual movement quote.
  // Every Native approach/crossing keeps the same firing reserve.
  const doorAccessPlan = (battle, unit: BattleUnit) => {
    if (
      !unit ||
      !investigators.has(unit.id) ||
      battle.status !== 'active' ||
      battle.mode !== 'combat' ||
      battle.phase !== 'player' ||
      battle.reactionStack?.length ||
      battle.turn < 20 ||
      (unit.tacticalLevel ?? 0) !== 0 ||
      unit.hp < 15 ||
      unit.hp !== unit.maxHp ||
      unit.bleeding ||
      unit.energy <= 0 ||
      unit.asleep ||
      unit.captured ||
      unit.fled ||
      unit.unconscious ||
      unit.routed ||
      unit.departure ||
      unit.surrendered ||
      unit.mounted ||
      unit.knockedDown ||
      unit.entangled ||
      unit.jammed ||
      unit.weaponDropped ||
      (unit.activeSlot ?? 'primary') !== 'primary' ||
      !hasFirearm(unit) ||
      !firearmServiceable(unit) ||
      !(unit.loaded > 0) ||
      (unit.medical > 0 && unit.medkits > 0) ||
      ['doctor', 'patient', 'militia_doctor'].includes(unit.assignment)
    ) {
      return null;
    }
    const view = publicRouteView(battle, unit);
    if (
      view.artillery.some(
        (gun) =>
          gun.side === unit.side &&
          (gun.loaded || gun.ammo > 0) &&
          artilleryContact(view, unit, gun),
      )
    ) {
      return null;
    }
    const contacts = view.units.filter(
      (other) =>
        other.side !== unit.side &&
        other.hp >= 15 &&
        !other.unconscious &&
        !other.routed &&
        !other.departure &&
        !other.fled &&
        !other.surrendered &&
        sameSurface(other, unit),
    );
    if (!contacts.length) {
      return null;
    }
    const key = (point: TacticalPoint) => `${point.x},${point.y}`,
      groundPath = (path) =>
        path.every(
          (step) => (step.kind === undefined || step.kind === 'move') && sameSurface(step, unit),
        );
    const costs = actionCosts(view, unit),
      budget = Math.min(24, unit.ap - costs.fire - 2 * costs.aim);
    if (!(budget > 0)) {
      return null;
    }
    const plans = [];
    for (const door of view.wallEdges ?? []) {
      if (
        door.type !== 'door' ||
        door.locked ||
        door.destroyed ||
        !sameSurface(door, unit) ||
        !canSee(view, unit, door) ||
        environmentTargetSummary(unit, door).trap?.armed
      ) {
        continue;
      }
      const partition = door.open
        ? {
            ...view,
            wallEdges: present(view.wallEdges).map((edge) =>
              edge === door ? { ...edge, open: false } : edge,
            ),
          }
        : view;
      const component = new Set(
        getReachable(partition, unit, { previewBudget: true })
          .filter((point) => sameSurface(point, unit) && groundPath(point.path))
          .map(key),
      );
      const cells = wallEdgeCells(door),
        near = cells.find((point) => component.has(key(point))),
        far = cells.find((point) => !component.has(key(point)));
      if (
        !near ||
        !far ||
        !surfaceAt(view, far) ||
        present(surfaceAt(view, far)).blocked ||
        propBlocksAt(view, far.x, far.y, 0) ||
        [...view.units, ...view.npcs, ...view.artillery].some(
          (other) =>
            sameCell(other, far) &&
            !other.departure &&
            !other.fled &&
            (other.hp === undefined || other.hp > 0),
        )
      ) {
        continue;
      }
      const target = contacts
        .filter(
          (other: TacticalPoint) =>
            Math.hypot(other.x - far.x, other.y - far.y) <
            Math.hypot(other.x - near.x, other.y - near.y),
        )
        .sort(
          (a: TacticalPoint, b: TacticalPoint) =>
            Math.hypot(a.x - far.x, a.y - far.y) - Math.hypot(b.x - far.x, b.y - far.y) ||
            String(a.id).localeCompare(String(b.id)),
        )[0];
      if (!target) {
        continue;
      }
      if (door.open) {
        const quote = getReachable(view, unit, { stopAt: (point) => sameCell(point, far) })[0];
        if (
          !quote ||
          !(quote.cost > 0 && quote.cost <= budget) ||
          quote.path.length > 3 ||
          !groundPath(quote.path) ||
          !sameCell(quote.path.at(-2) ?? unit, near)
        ) {
          continue;
        }
        plans.push({
          action: { type: 'move', unitId: unit.id, ...spacePoint(far) },
          quote: { ...quote, pa: quote.cost },
          door,
          component,
          distance: Math.hypot(target.x - far.x, target.y - far.y),
          key,
        });
        continue;
      }
      const ref = {
          kind: 'door',
          id: door.doorId ?? wallEdgeId(door),
          wallEdgeId: wallEdgeId(door),
          x: door.x,
          y: door.y,
          axis: door.axis,
          tacticalLevel: door.tacticalLevel ?? 0,
        },
        quote = environmentUsePreview(view, unit, ref, 'open');
      if (
        !quote.valid ||
        quote.action.verb !== 'open' ||
        !(quote.pa > 0 && quote.pa <= budget) ||
        quote.path.length > 3 ||
        !groundPath(quote.path) ||
        (quote.path.length && !sameCell(quote.destination, near))
      ) {
        continue;
      }
      const action = quote.path.length
        ? { type: 'move', unitId: unit.id, ...spacePoint(quote.destination) }
        : quote.action;
      plans.push({
        action,
        quote,
        door,
        component,
        distance: Math.hypot(target.x - far.x, target.y - far.y),
        key,
      });
    }
    return (
      plans.sort(
        (a, b) =>
          Number(Boolean(b.door.open)) - Number(Boolean(a.door.open)) ||
          a.quote.pa - b.quote.pa ||
          a.distance - b.distance ||
          wallEdgeId(a.door).localeCompare(wallEdgeId(b.door)),
      )[0] ?? null
    );
  };
  const retreatsFromDoor = (unit: TacticalPoint, action: TacticalPoint, plan) => {
    if (
      action?.type !== 'move' ||
      !plan ||
      !sameSurface(action, unit) ||
      !plan.component.has(plan.key(action))
    ) {
      return false;
    }
    if (plan.door.open) {
      return true;
    } // Finish the short public crossing before optional cover search inside.
    const door = wallEdgeCenter(plan.door);
    return (
      Math.hypot(action.x - door.x, action.y - door.y) >
      Math.hypot(unit.x - door.x, unit.y - door.y)
    );
  };
  // Quote the same public investigator after the real rise and preserve any
  // selected path. Only its null can admit a distinct safe firing lane. Native
  // pays posture and walking together; neither branch adds a stance loop.
  const paidWalkingInvestigation = (view: BattleSnapshot, unit: BattleUnit, regressiveProposal = null) => {
    const finish = (reason, action, detail = {}) => {
      observe('paidWalking', view, unit, { reason, ...detail, action: actionContext(action) });
      return action;
    };
    if (
      !['standing', 'crouched', 'prone'].includes(unit.stance) ||
      unit.hp !== unit.maxHp ||
      unit.hp < 15 ||
      unit.bleeding ||
      unit.energy <= 0 ||
      unit.unconscious ||
      unit.routed ||
      unit.departure ||
      unit.surrendered ||
      unit.mounted ||
      unit.knockedDown ||
      unit.entangled ||
      unit.jammed ||
      unit.weaponDropped ||
      (unit.activeSlot ?? 'primary') !== 'primary' ||
      !hasFirearm(unit) ||
      !firearmServiceable(unit) ||
      !(unit.loaded > 0)
    ) {
      return finish('actor-admission', null);
    }
    const standing = unit.stance === 'standing',
      paid = stanceCost(unit, 'standing');
    if (!(standing ? paid === 0 && unit.ap > 0 : paid > 0 && paid < 24 && unit.ap > paid)) {
      return finish('stance-budget', null, { paid });
    }
    const walking = {
      ...unit,
      stance: 'standing',
      movementMode: 'walk',
      ap: unit.ap - paid,
      braced: false,
      overwatch: false,
    };
    if (paid > 0) {
      lowerWeapon(walking);
    }
    const planning = {
        ...view,
        units: view.units.map((other) => (other.id === unit.id ? walking : other)),
      },
      costs = actionCosts(planning, walking),
      selected = investigation.sharedFallback(planning, walking);
    // Only this call's already rejected shared move can waive its proposal.
    // Re-quote that same move under the real paid standing budget; no intent is
    // stored and a different Native proposal keeps its existing priority.
    const revalidatedRegression =
      regressiveProposal &&
      selected?.type === 'move' &&
      sameCell(selected, regressiveProposal) &&
      (selected.movementIntent ?? 'forward') === (regressiveProposal.movementIntent ?? 'forward')
        ? retreatsFromFiringRoute(planning, walking, selected)
        : null;
    const detail = {
      paid,
      postStanceAP: walking.ap,
      fire: costs.fire,
      aim: costs.aim,
      fireReserve: costs.fire + 2 * costs.aim,
      weaponReady: walking.weaponReady === true,
      proposal: actionContext(selected),
      ...(revalidatedRegression ? { rejectedSharedMove: actionContext(selected) } : {}),
    };
    if (selected === null || revalidatedRegression) {
      // The Native search score may correctly hold behind strong cover. Only a
      // presently useful public rifle lane can justify this separate short bound;
      // do not change that score, manufacture memory or apply the planning pose.
      const contacts = new Set(
        planning.units
          .filter(
            (other) =>
              other.side !== unit.side &&
              other.hp >= 15 &&
              !other.unconscious &&
              !other.routed &&
              !other.departure &&
              !other.fled &&
              !other.surrendered &&
              sameSurface(other, walking),
          )
          .map((other) => other.id),
      );
      if (!contacts.size) {
        return finish('standing-null-no-current-contact', null, detail);
      }
      const points = getReachable(planning, walking)
        .filter(
          (point) =>
            point.cost > 0 &&
            paid + point.cost <= 24 &&
            point.path?.length > 0 &&
            point.path.length <= 3 &&
            sameSurface(point, walking) &&
            point.path.every(
              (step) =>
                (step.kind === undefined || step.kind === 'move') && sameSurface(step, walking),
            ),
        )
        .sort((a: TacticalPoint, b: TacticalPoint) => a.cost - b.cost || a.y - b.y || a.x - b.x);
      for (const point of points) {
        const preview = paidHospitalRoofWalkPreview(planning, walking, point);
        if (!preview) {
          continue;
        }
        const shot = usefulRouteRifleShot(preview.view, preview.actor, {
          shotSafety: knownRouteBystanderShotSafety,
        });
        if (!shot || !contacts.has(shot.targetId)) {
          continue;
        }
        const target = preview.view.units.find((other) => other.id === shot.targetId),
          afterCosts = actionCosts(preview.view, preview.actor, target),
          reserve = afterCosts.fire + 2 * afterCosts.aim;
        if (present(preview.actor).ap < reserve) {
          continue;
        }
        return finish(
          'accepted-safe-firing-lane',
          { type: 'move', unitId: unit.id, ...spacePoint(point), movement: 'walk' },
          {
            ...detail,
            route: routeContext(point),
            shot: actionContext(shot),
            afterMove: {
              ap: present(preview.actor).ap,
              energy: present(preview.actor).energy,
              facing: present(preview.actor).facing,
              fireReserve: reserve,
              elapsedSeconds: preview.view.elapsedSeconds,
            },
          },
        );
      }
      // An obstacle may put every useful public firing position beyond one
      // short bound. Quote the complete affordable Native route, then pay only
      // an exact short prefix. Future callbacks must earn a fresh route again.
      const routes = getReachable(planning, walking)
        .filter(
          (point) =>
            point.cost > 0 &&
            point.path?.length > 3 &&
            sameSurface(point, walking) &&
            point.path.every(
              (step) =>
                (step.kind === undefined || step.kind === 'move') && sameSurface(step, walking),
            ),
        )
        .sort((a: TacticalPoint, b: TacticalPoint) => a.cost - b.cost || a.y - b.y || a.x - b.x);
      for (const route of routes) {
        const goal = paidHospitalRoofWalkPreview(planning, walking, route);
        if (!goal) {
          continue;
        }
        const shot = usefulRouteRifleShot(goal.view, goal.actor, {
          shotSafety: knownRouteBystanderShotSafety,
        });
        if (!shot || !contacts.has(shot.targetId)) {
          continue;
        }
        const target = goal.view.units.find((other) => other.id === shot.targetId),
          goalCosts = actionCosts(goal.view, goal.actor, target),
          goalReserve = goalCosts.fire + 2 * goalCosts.aim;
        if (present(goal.actor).ap < goalReserve) {
          continue;
        }
        const prefixes = [];
        for (let length = Math.min(3, route.path.length); length > 0; length--) {
          const point = route.path[length - 1],
            quote = getReachable(planning, walking, { stopAt: (cell) => sameCell(cell, point) })[0];
          const reason = !quote
            ? 'no-route'
            : !(quote.cost > 0 && paid + quote.cost <= 24)
              ? 'total-ap'
              : quote.path.length !== length
                ? 'prefix-length'
                : !quote.path.every((cell, index) => sameCell(cell, route.path[index]))
                  ? 'different-path'
                  : null;
          if (reason) {
            prefixes.push({ length, quote: routeContext(quote), reason });
            continue;
          }
          const preview = paidHospitalRoofWalkPreview(planning, walking, quote),
            currentTarget = preview?.view.units.find((other) => other.id === shot.targetId),
            afterCosts = currentTarget && actionCosts(present(preview).view, present(preview).actor, currentTarget),
            reserve = afterCosts && afterCosts.fire + 2 * afterCosts.aim;
          if (!preview || !Number.isFinite(reserve) || present(preview.actor).ap < present(reserve)) {
            prefixes.push({
              length,
              quote: routeContext(quote),
              reason: preview ? 'fire-reserve' : 'paid-preview',
            });
            continue;
          }
          prefixes.push({ length, quote: routeContext(quote), reason: null });
          return finish(
            'accepted-safe-firing-route-prefix',
            { type: 'move', unitId: unit.id, ...spacePoint(point), movement: 'walk' },
            {
              ...detail,
              route: routeContext(route),
              prefixes,
              shot: actionContext(shot),
              goal: {
                ...spacePoint(route),
                ap: present(goal.actor).ap,
                energy: present(goal.actor).energy,
                fireReserve: goalReserve,
              },
              afterMove: {
                ap: present(preview.actor).ap,
                energy: present(preview.actor).energy,
                facing: present(preview.actor).facing,
                fireReserve: reserve,
                elapsedSeconds: preview.view.elapsedSeconds,
              },
            },
          );
        }
      }
      return finish('standing-null-no-safe-firing-lane', null, detail);
    }
    if (standing) {
      return finish('standing-continuation-native-proposal', null, detail);
    }
    if (selected?.type !== 'move' || !sameSurface(selected, walking)) {
      return finish('standing-proposal-not-ground-move', null, detail);
    }
    const route = getReachable(planning, walking, {
      stopAt: (point) => sameCell(point, selected),
    })[0];
    detail.route = routeContext(route);
    detail.prefixes = [];
    if (
      !route?.path.length ||
      route.path.length > 3 ||
      !route.path.every(
        (point) =>
          (point.kind === undefined || point.kind === 'move') && sameSurface(point, walking),
      )
    ) {
      return finish('standing-route', null, detail);
    }
    for (let length = route.path.length; length > 0; length--) {
      const point = route.path[length - 1],
        quote = getReachable(planning, walking, { stopAt: (cell) => sameCell(cell, point) })[0];
      const reason = !quote
        ? 'no-route'
        : !(quote.cost > 0 && paid + quote.cost <= 24)
          ? 'total-ap'
          : walking.ap - quote.cost < costs.fire + 2 * costs.aim
            ? 'fire-reserve'
            : quote.path.length !== length
              ? 'prefix-length'
              : !quote.path.every((cell, index) => sameCell(cell, route.path[index]))
                ? 'different-path'
                : null;
      detail.prefixes.push({ length, quote: routeContext(quote), reason });
      if (reason) {
        continue;
      }
      return finish(
        'accepted-prefix',
        { ...selected, ...spacePoint(point), movement: 'walk' },
        detail,
      );
    }
    return finish('no-admitted-prefix', null, detail);
  };
  // A fresh safe route does not become stored intent. Only reject an ordinary
  // short return to stronger cover when paying that exact move would lengthen
  // the Native route to the same currently affordable public firing position.
  const retreatsFromFiringRoute = (battle, unit: BattleUnit, action, onProbe = () => {}) => {
    if (action?.type !== 'move') {
      return null;
    }
    const finish = (reason, result, detail = {}) => {
      try {
        onProbe(
          structuredClone({
            turn: battle.turn,
            elapsedSeconds: battle.elapsedSeconds,
            actor: Object.fromEntries(
              [
                'id',
                'x',
                'y',
                'tacticalLevel',
                'hp',
                'maxHp',
                'bleeding',
                'ap',
                'energy',
                'stance',
                'movementMode',
                'activeSlot',
                'weapon',
                'loaded',
                'ammo',
                'condition',
                'medical',
                'medkits',
                'asleep',
                'captured',
                'fled',
                'unconscious',
                'routed',
                'departure',
                'surrendered',
                'mounted',
                'knockedDown',
                'entangled',
                'jammed',
                'weaponDropped',
              ]
                .filter(
                  (key) =>
                    unit[key] === null ||
                    ['string', 'number', 'boolean'].includes(typeof unit[key]),
                )
                .map((key) => [key, unit[key]]),
            ),
            proposal: actionContext(action),
            movementPresent: action.movement !== undefined,
            movementIntentPresent: action.movementIntent !== undefined,
            reason,
            ...detail,
          }),
        );
      } catch {}
      return result;
    };
    if (
      action.movement !== undefined ||
      (action.movementIntent !== undefined && action.movementIntent !== 'forward') ||
      !investigators.has(unit.id) ||
      battle.status !== 'active' ||
      battle.mode !== 'combat' ||
      battle.phase !== 'player' ||
      battle.reactionStack?.length ||
      battle.turn < 20 ||
      !sameSurface(action, unit) ||
      (unit.tacticalLevel ?? 0) !== 0 ||
      unit.hp !== unit.maxHp ||
      unit.hp < 15 ||
      unit.bleeding ||
      unit.energy <= 0 ||
      unit.asleep ||
      unit.captured ||
      unit.fled ||
      unit.unconscious ||
      unit.routed ||
      unit.departure ||
      unit.surrendered ||
      unit.mounted ||
      unit.knockedDown ||
      unit.entangled ||
      unit.jammed ||
      unit.weaponDropped ||
      (unit.activeSlot ?? 'primary') !== 'primary' ||
      !hasFirearm(unit) ||
      !firearmServiceable(unit) ||
      !(unit.loaded > 0) ||
      (unit.medical > 0 && unit.medkits > 0) ||
      ['doctor', 'patient', 'militia_doctor'].includes(unit.assignment)
    ) {
      return finish('actor-or-order-admission', null);
    }
    const view = publicRouteView(battle, unit),
      ground = (path) =>
        path.every(
          (step) => (step.kind === undefined || step.kind === 'move') && sameSurface(step, unit),
        ),
      destinationCover = surfaceAt(view, action)?.cover ?? 0,
      currentCover = surfaceAt(view, unit)?.cover ?? 0;
    if (destinationCover <= currentCover) {
      return finish('not-stronger-cover', null, { destinationCover, currentCover });
    }
    if (
      view.artillery.some(
        (gun) =>
          gun.side === unit.side &&
          (gun.loaded || gun.ammo > 0) &&
          artilleryContact(view, unit, gun),
      )
    ) {
      return finish('charged-gun-contact', null, { destinationCover, currentCover });
    }
    const ordinary = getReachable(view, unit, { stopAt: (point) => sameCell(point, action) })[0];
    if (
      !ordinary ||
      !(ordinary.cost > 0 && ordinary.cost <= 24) ||
      ordinary.path.length > 3 ||
      !ground(ordinary.path)
    ) {
      return finish('ordinary-route-admission', null, {
        destinationCover,
        currentCover,
        ordinaryRoute: routeContext(ordinary),
      });
    }
    const after = paidHospitalRoofWalkPreview(view, unit, ordinary);
    if (!after) {
      return finish('ordinary-paid-preview', null, {
        destinationCover,
        currentCover,
        ordinaryRoute: routeContext(ordinary),
      });
    }
    const ordinaryShot = usefulRouteRifleShot(after.view, after.actor, {
      shotSafety: knownRouteBystanderShotSafety,
    });
    if (ordinaryShot) {
      return finish('ordinary-endpoint-useful-shot', null, {
        destinationCover,
        currentCover,
        ordinaryRoute: routeContext(ordinary),
        shot: actionContext(ordinaryShot),
      });
    }
    const paid = stanceCost(unit, 'standing'),
      walking = {
        ...unit,
        stance: 'standing',
        movementMode: 'walk',
        ap: unit.ap - paid,
        braced: false,
        overwatch: false,
      };
    if (paid > 0) {
      lowerWeapon(walking);
    }
    if (!(paid >= 0 && paid < 24 && walking.ap > 0)) {
      return finish('standing-budget', null, { paid, postStanceAP: walking.ap });
    }
    const planning = {
        ...view,
        units: view.units.map((other) => (other.id === unit.id ? walking : other)),
      },
      contacts = new Set(
        planning.units
          .filter(
            (other) =>
              other.side !== unit.side &&
              other.hp >= 15 &&
              !other.unconscious &&
              !other.routed &&
              !other.departure &&
              !other.fled &&
              !other.surrendered &&
              sameSurface(other, walking),
          )
          .map((other) => other.id),
      );
    if (!contacts.size) {
      return finish('no-current-public-contact', null);
    }
    const routes = getReachable(planning, walking)
        .filter(
          (point) =>
            point.cost > 0 &&
            point.path?.length > 0 &&
            sameSurface(point, walking) &&
            ground(point.path),
        )
        .sort((a: TacticalPoint, b: TacticalPoint) => a.cost - b.cost || a.y - b.y || a.x - b.x),
      counts = { routes: routes.length, visited: 0, paid: 0, useful: 0 };
    for (const route of routes) {
      counts.visited++;
      const goal = paidHospitalRoofWalkPreview(planning, walking, route);
      if (!goal) {
        continue;
      }
      counts.paid++;
      const shot = usefulRouteRifleShot(goal.view, goal.actor, {
        shotSafety: knownRouteBystanderShotSafety,
      });
      if (!shot || !contacts.has(shot.targetId)) {
        continue;
      }
      counts.useful++;
      const target = goal.view.units.find((other) => other.id === shot.targetId),
        costs = actionCosts(goal.view, goal.actor, target),
        reserve = costs.fire + 2 * costs.aim;
      if (present(goal.actor).ap < reserve) {
        continue;
      }
      const rise = stanceCost(after.actor, 'standing'),
        returned = {
          ...after.actor,
          stance: 'standing',
          movementMode: 'walk',
          ap: present(after.actor).ap - rise,
          braced: false,
          overwatch: false,
        };
      if (rise > 0) {
        lowerWeapon(returned);
      }
      const afterView = {
          ...after.view,
          units: after.view.units.map((other) => (other.id === unit.id ? returned : other)),
        },
        remaining = getReachable(afterView, returned, {
          stopAt: (point) => sameCell(point, route),
        })[0];
      // Preserve the first-safe-goal return exactly. Record its existing refusal
      // rather than testing other goals or changing any current policy choice.
      const remainingGround = remaining && ground(remaining.path),
        regressive = remainingGround && remaining.path.length > route.path.length,
        result = regressive
          ? {
              ordinaryRoute: routeContext(ordinary),
              route: routeContext(route),
              remainingRoute: routeContext(remaining),
              goal: {
                ...spacePoint(route),
                ap: present(goal.actor).ap,
                energy: present(goal.actor).energy,
                fireReserve: reserve,
              },
              shot: actionContext(shot),
            }
          : null;
      return finish(
        !remaining
          ? 'first-safe-goal-no-remaining-route'
          : !remainingGround
            ? 'first-safe-goal-not-ground'
            : !regressive
              ? 'first-safe-goal-not-regressive'
              : 'accepted-regression',
        result,
        {
          counts,
          paid,
          postStanceAP: walking.ap,
          destinationCover,
          currentCover,
          ordinaryRoute: routeContext(ordinary),
          afterOrdinary: {
            x: present(after.actor).x,
            y: present(after.actor).y,
            ap: present(after.actor).ap,
            energy: present(after.actor).energy,
          },
          route: routeContext(route),
          remainingRoute: routeContext(remaining),
          goal: {
            x: route.x,
            y: route.y,
            tacticalLevel: route.tacticalLevel ?? 0,
            ap: present(goal.actor).ap,
            energy: present(goal.actor).energy,
            fireReserve: reserve,
          },
          shot: actionContext(shot),
        },
      );
    }
    return finish('no-payable-safe-goal', null, {
      counts,
      paid,
      postStanceAP: walking.ap,
      destinationCover,
      currentCover,
      ordinaryRoute: routeContext(ordinary),
    });
  };
  const controller = (battle, unit: BattleUnit) => {
    const ordinary = northernClinicDefenseOrder(battle, unit);
    if (!rifles.has(unit.id)) {
      const door = ordinary?.type === 'move' ? doorAccessPlan(battle, unit) : null,
        retreat = door ? null : retreatsFromFiringRoute(battle, unit, ordinary),
        action = retreatsFromDoor(unit, ordinary, door) || retreat ? null : ordinary;
      observe('ordinary', battle, unit, {
        ...(retreat ? { reason: 'ordinary-cover-route-regression', retreat } : {}),
        proposal: actionContext(ordinary),
        action: actionContext(action),
      });
      return action;
    }
    if (
      ['reload', 'reprime', 'weapon', 'useItem'].includes(ordinary?.type) ||
      unit.knockedDown ||
      unit.entangled
    ) {
      return ordinary;
    }
    const view = publicRouteView(battle, unit),
      contact = view.units.some(
        (other) =>
          other.side === 'enemy' &&
          other.hp >= 15 &&
          !other.departure &&
          !other.fled &&
          !other.unconscious &&
          !other.routed &&
          !other.surrendered,
      );
    if (battle.turn >= 20 && !contact) {
      return ordinary;
    }
    const lookout = lookouts.get(unit.id);
    if (
      !contact &&
      lookout &&
      battle.status === 'active' &&
      battle.phase === 'player' &&
      !battle.reactionStack?.length
    ) {
      const quote = lookPreview(view, unit, lookout);
      return quote.valid && !quote.prepare ? { type: 'look', unitId: unit.id, ...lookout } : null;
    }
    if (
      ordinary?.type === 'stance' &&
      usefulRouteFiringPosture(view, unit, ordinary, { shotSafety: knownRouteBystanderShotSafety })
    ) {
      return ordinary;
    }
    // Revalidate ordinary fire and let the existing covered rifle lane precede
    // an admitted melee/other posture. Actual finite care and loading stay first.
    const action = coordinated.controller(battle, unit);
    if (action) {
      return action;
    }
    if (
      battle.status !== 'active' ||
      battle.mode !== 'combat' ||
      battle.phase !== 'player' ||
      battle.reactionStack?.length ||
      !(present(unit.tacticalLevel) > 0) ||
      unit.stance === 'standing' ||
      unit.mounted ||
      unit.knockedDown ||
      unit.entangled
    ) {
      return null;
    }
    // The old hold already removed its standing proposal. Admit only a current
    // useful shot after paying the real rise; the next call reads Native anew.
    const paid = stanceCost(unit, 'standing');
    if (!(paid > 0 && unit.ap > paid)) {
      return null;
    }
    const posed = {
      ...unit,
      stance: 'standing',
      movementMode: 'walk',
      weaponReady: false,
      momentum: 0,
      ap: unit.ap - paid,
    };
    const after = {
      ...view,
      units: view.units.map((other) => (other.id === unit.id ? posed : other)),
    };
    return usefulRouteRifleShot(after, posed, { shotSafety: knownRouteBystanderShotSafety })
      ? { type: 'stance', unitId: unit.id, stance: 'standing' }
      : null;
  };
  // Only the original healthy ground scout can investigate a current squad
  // sighting after a complete ordinary pass holds. Roof access owners stay put.
  const sharedFallback = (battle, unit) => {
    const finish = (reason, action, detail = {}) => {
      observe('shared', battle, unit, { reason, ...detail, action: actionContext(action) });
      return action;
    };
    if (
      !unit ||
      !investigators.has(unit.id) ||
      battle.status !== 'active' ||
      battle.mode !== 'combat' ||
      battle.phase !== 'player' ||
      battle.reactionStack?.length ||
      battle.turn < 20 ||
      (unit.tacticalLevel ?? 0) !== 0 ||
      unit.asleep ||
      unit.captured ||
      unit.fled ||
      (unit.medical > 0 && unit.medkits > 0) ||
      ['doctor', 'patient', 'militia_doctor'].includes(unit.assignment)
    ) {
      return finish('actor-or-window-admission', null, { admitted: false });
    }
    const view = publicRouteView(battle, unit);
    if (
      view.artillery.some(
        (gun) =>
          gun.side === unit.side &&
          (gun.loaded || gun.ammo > 0) &&
          artilleryContact(view, unit, gun),
      )
    ) {
      return finish('charged-gun-contact', null, { admitted: false });
    }
    const publicContacts = view.units.filter(
        (other) =>
          other.side !== unit.side &&
          other.hp > 0 &&
          !other.unconscious &&
          !other.routed &&
          !other.departure &&
          !other.surrendered &&
          (other.tacticalLevel ?? 0) === (unit.tacticalLevel ?? 0),
      ),
      contacts = publicContacts.slice(0, 3).map((other) => ({
        id: other.id,
        x: other.x,
        y: other.y,
        tacticalLevel: other.tacticalLevel ?? 0,
        hp: other.hp,
      })),
      contactCount = publicContacts.length;
    const access = doorAccessPlan(battle, unit);
    if (access) {
      return finish('public-door', access.action, { admitted: true });
    }
    const action = investigation.sharedFallback(view, unit);
    if (!action) {
      return finish('action-null-paid-walking', paidWalkingInvestigation(view, unit), {
        admitted: true,
        proposal: null,
        contacts,
        contactCount,
      });
    }
    if (action.type === 'look') {
      const quote = lookPreview(view, unit, action),
        accepted = quote.valid && !quote.prepare && quote.pa > 0;
      return finish(
        accepted ? 'shared-look-accepted' : 'shared-look-rejected',
        accepted ? action : null,
        {
          admitted: true,
          proposal: actionContext(action),
          contacts,
          contactCount,
          look: { valid: quote.valid, prepare: quote.prepare, pa: quote.pa, reason: quote.reason },
        },
      );
    }
    if (action.type !== 'move') {
      return finish('shared-other-action', null, {
        admitted: true,
        proposal: actionContext(action),
        contacts,
        contactCount,
      });
    }
    const route = getReachable(view, unit, { stopAt: (point) => sameCell(point, action) })[0];
    const accepted =
      present(route?.cost) > 0 &&
      present(route).cost <= 24 &&
      present(route).path.length <= 3 &&
      present(route).path.every(
        (step) => (step.kind === undefined || step.kind === 'move') && sameSurface(step, unit),
      );
    // A public shared search can also select a return to old cover. Keep its
    // exact accepted move unless the existing paid predicate proves a longer
    // route to the same safe public goal, then let the paid walk revalidate it.
    let coverProbe;
    const regression = accepted
        ? retreatsFromFiringRoute(battle, unit, action, (probe) => {
            coverProbe = probe;
          })
        : null,
      next = regression ? paidWalkingInvestigation(view, unit, action) : accepted ? action : null;
    return finish(
      regression
        ? 'shared-regression-paid-walking'
        : accepted
          ? 'shared-move-accepted'
          : 'shared-move-rejected',
      next,
      {
        admitted: true,
        proposal: actionContext(action),
        contacts,
        contactCount,
        route: routeContext(route),
        ...(coverProbe ? { coverProbe } : {}),
      },
    );
  };
  return {
    controller,
    sharedFallback,
    diagnosticContext,
    roles: {
      ...coordinated.roles,
      rifleIds: [...rifles],
      lookouts: [...lookouts].map(([id, point]) => ({ id, ...point })),
    },
  };
}

// Execute the fixed clinic policy once. A real loss is retained as raw evidence
// and stops before replay or settlement; the route still requires victory.
export function resolveRescueClinicEncounter(
  start: CampaignSnapshot,
  { report = () => {}, onCheckpoint = () => {}, executeBattle = fight } = {},
) {
  const inputCapture = recordRouteStrategicEvidence({
    helper: 'resolveRescueClinicEncounter',
    stage: 'preparation-input',
    campaign: start,
  });
  const before = structuredClone(start),
    encounter = structuredClone(start.pendingEncounter);
  assert.equal(encounter?.sector, 'tucuman');
  const prepared = dispatchCampaign(start, {
    type: 'respondToEncounter',
    groupId: encounter.groupId,
    choice: 'tactical',
  });
  assert.equal(prepared.lastError, null);
  const request = prepared.pendingBattle,
    snapshot = prepared.sectorStates[encounter.sector],
    policy = rescueClinicDefenseController(enterSector(request, snapshot)),
    result = executeBattle(request, snapshot, {
      controller: policy.controller,
      sharedFallback: policy.sharedFallback,
    });
  if (result.battle.status !== 'victory') {
    recordRouteStrategicEvidence({
      helper: 'resolveRescueClinicEncounter',
      stage: 'battle-outcome-failure',
      campaign: prepared,
      inputCapture,
      context: {
        encounter,
        request,
        previous: snapshot,
        result,
        investigationDecisions: policy.diagnosticContext(),
      },
      error: 'the real clinic defense must win before full-health recovery can continue',
    });
  }
  assert.ok(
    ['victory', 'defeat', 'retreat'].includes(result.battle.status),
    'keep an unresolved native defense as a failure',
  );
  assert.equal(
    result.battle.status,
    'victory',
    'the real clinic defense must win before full-health recovery can continue',
  );
  let replay = { campaign: prepared, battle: enterSector(request, snapshot) };
  const midpoint = Math.floor(result.orders.length / 2);
  const observeReplay = Boolean(process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR);
  let replayMidpoint = null;
  for (let index = 0; index < result.orders.length; index++) {
    const action = result.orders[index],
      priorReplay = observeReplay ? structuredClone(replay) : null;
    replay.battle =
      present(action).type === 'endTurn' ? endTurn(replay.battle) : actBattle(replay.battle, action);
    if (observeReplay && replay.battle.lastError !== null) {
      recordRouteStrategicEvidence({
        helper: 'resolveRescueClinicEncounter',
        stage: 'replay-order-refusal',
        campaign: replay.campaign,
        action,
        inputCapture,
        context: {
          encounter,
          request,
          previous: snapshot,
          index,
          midpoint,
          priorReplay,
          postReplay: replay,
          replayMidpoint,
          result,
          orders: result.orders,
          investigationDecisions: policy.diagnosticContext(),
        },
        error: replay.battle.lastError,
      });
    }
    assert.equal(replay.battle.lastError, null);
    if (index === midpoint) {
      const beforeSync = observeReplay ? structuredClone(replay) : null;
      const synced = syncBattleTime(replay.campaign, replay.battle),
        rawSynced = observeReplay ? structuredClone(synced) : null;
      assert.equal(synced.error, null);
      replay = decodeSave(encodeSave(synced.campaign, synced.battle));
      if (observeReplay) {
        replayMidpoint = {
          index,
          beforeSync,
          synced: rawSynced,
          restored: structuredClone(replay),
        };
      }
    }
  }
  const expected = syncBattleTime(prepared, result.battle),
    actual = syncBattleTime(replay.campaign, replay.battle);
  assert.equal(expected.error, null);
  assert.equal(actual.error, null);
  assert.deepEqual(
    decodeSave(encodeSave(actual.campaign, actual.battle)),
    decodeSave(encodeSave(expected.campaign, expected.battle)),
  );
  const settle = (pair: ActiveGame) =>
    dispatchCampaign(pair.campaign, {
      type: 'battleResult',
      battleId: present(request).id,
      outcome: pair.battle.status,
      survivors: pair.battle.units.filter((unit) => unit.side === 'player'),
      sectorState: pair.battle,
    });
  const campaign = settle(decodeSave(encodeSave(expected.campaign, expected.battle))),
    replayed = settle(decodeSave(encodeSave(actual.campaign, actual.battle)));
  assert.equal(campaign.lastError, null);
  assert.equal(replayed.lastError, null);
  assert.deepEqual(campaign, replayed);
  for (const [id, record] of Object.entries(start.operativeState)) {
    if (!record.alive) {
      assert.equal(campaign.operativeState[id].alive, false);
    }
  }
  assert.deepEqual(start, before);
  const evidence = {
    event: 'rescueClinicDefense',
    sector: encounter.sector,
    groupId: encounter.groupId,
    status: result.battle.status,
    turns: result.battle.turn,
    actions: result.actions,
    orders: result.orders,
    elapsedSeconds: result.battle.elapsedSeconds,
    midpoint,
    exactNativeReplay: true,
    units: result.battle.units.map((unit) => ({
      id: unit.id,
      side: unit.side,
      hp: unit.hp,
      routed: unit.routed,
    })),
  };
  report(evidence);
  onCheckpoint('rescue-clinic-defense', campaign, evidence);
  assert.equal(campaign.defeated, false);
  assert.equal(present(campaign.sectors[encounter.sector]).owner, 'patriot');
  return { campaign, evidence };
}

// Stable patients can heal without dressings through the native rest rule.
// The elapsed bound comes from their actual wounds, not a fixed clock target.
export function restRescuePatients(
  start: CampaignSnapshot,
  {
    patients,
    doctors,
    courier,
    exhaustedSources = [],
    report = () => {},
    onCheckpoint = () => {},
    resolveEncounter = resolveRescueClinicEncounter,
  } = {},
) {
  let campaign = decodeSave(encodeSave(start)).campaign;
  const startSeconds = campaign.hour * 3600 + (campaign.secondOfHour ?? 0),
    cash = campaign.resources.treasury,
    restHealingHours = careRules(campaign).restHealingHours;
  const medical = () =>
    present(playerKnownCampaign(campaign))
      .sectors.find((sector) => sector.id === 'tucuman')
      .equipment.filter((row) => row.label === present(SUPPLY_ITEMS.medkits).label)
      .reduce((sum, row) => sum + row.count, 0);
  const routes = rescueMedicalRouteOptions(campaign, courier, { exhaustedSources });
  assert.equal(
    routes.some((route) => route.admitted),
    false,
    'a remaining source with a valid public route needs ordinary finite collection',
  );
  assert.equal(
    medical(),
    0,
    'an inaccessible or uncollected local dressing is not exhausted stock',
  );
  assert.ok(
    campaign.recruited
      .filter(
        (id) =>
          present(campaign.operativeState[id]).alive && present(campaign.operativeState[id]).location === 'tucuman',
      )
      .every((id) => present(campaign.operativeState[id]).medkits === 0),
    'use the actual local carried dressings before resting without supplies',
  );
  const stable = () =>
    patients.every((id) => {
      const record = campaign.operativeState[id];
      return (
        campaign.recruited.includes(id) &&
        present(record).alive &&
        !present(record).captured &&
        present(record).location === 'tucuman' &&
        !present(record).bleeding &&
        present(record).hp >= 15
      );
    });
  assert.ok(stable(), 'bleeding or critical wounds still need real medical care');
  const boundHours =
    Math.max(
      ...patients.map((id) => present(campaign.operativeState[id]).maxHp - present(campaign.operativeState[id]).hp),
    ) * restHealingHours;
  const seconds = () => campaign.hour * 3600 + (campaign.secondOfHour ?? 0),
    order = (action) => {
      campaign = dispatchCampaign(campaign, action);
      assert.equal(campaign.lastError, null, JSON.stringify(action) + ': ' + campaign.lastError);
    };
  for (const operativeId of new Set([...patients, ...doctors])) {
    order({ type: 'assignCare', operativeId, assignment: 'rest' });
  }
  const defenses = [];
  let requests = 0;
  while (
    patients.some((id) => present(campaign.operativeState[id]).hp < present(campaign.operativeState[id]).maxHp) &&
    seconds() - startSeconds < boundHours * 3600 &&
    requests < boundHours * 8
  ) {
    if (campaign.pendingEncounter) {
      onCheckpoint('rescue-rest-encounter', campaign, { routes, boundHours, requests });
      const resolved = resolveEncounter(campaign, { report, onCheckpoint });
      campaign = resolved.campaign;
      defenses.push(resolved.evidence);
      assert.equal(campaign.pendingEncounter, null);
      assert.equal(campaign.pendingBattle, null);
    }
    assert.ok(stable(), 'native rest cannot bypass an actual critical wound, capture or death');
    for (const id of campaign.recruited.filter(
      (id) => present(campaign.operativeState[id]).alive && !present(campaign.operativeState[id]).captured,
    )) {
      let contract = campaign.contracts[id];
      while (
        contractExpiresSeconds(contract) !== null &&
        present(contractExpiresSeconds(contract)) <= seconds() + 2 * 3600
      ) {
        order({
          type: 'renewContract',
          id,
          term: 'day',
          expectedExpiresAt: present(contract).expiresAt,
          expectedExpiresSecond: present(contract).expiresSecond ?? 0,
        });
        contract = campaign.contracts[id];
      }
    }
    order({ type: 'wait', hours: 1 });
    requests++;
  }
  // An arrival on the final healing tick is still an actual unresolved encounter.
  if (campaign.pendingEncounter) {
    onCheckpoint('rescue-rest-encounter', campaign, { routes, boundHours, requests });
    const resolved = resolveEncounter(campaign, { report, onCheckpoint });
    campaign = resolved.campaign;
    defenses.push(resolved.evidence);
  }
  assert.ok(stable());
  for (const id of patients) {
    assert.equal(
      present(campaign.operativeState[id]).hp,
      present(campaign.operativeState[id]).maxHp,
      'the native elapsed rest bound must restore the actual surviving patient',
    );
  }
  for (const [id, record] of Object.entries(start.operativeState)) {
    if (!record.alive) {
      assert.equal(campaign.operativeState[id].alive, false);
    }
  }
  const evidence = {
    event: 'rescueStableRest',
    patients,
    doctors,
    courier,
    routes,
    restHealingHours,
    boundHours,
    requests,
    elapsedSeconds: seconds() - startSeconds,
    paidRenewalCost: cash - campaign.resources.treasury,
    defenses,
  };
  report(evidence);
  onCheckpoint('rescue-stable-rest', campaign, evidence);
  return { campaign, evidence };
}
