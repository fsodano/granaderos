import { present } from './assert-present.ts';
import type { CampaignAction, CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import type { TacticalAction, TacticalPoint } from '../packages/game/public/compatibility-types.ts';
import assert from 'node:assert/strict';
import { dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import { contractExpiresSeconds, contractRenewalQuote } from '../packages/game/contracts.js';
import {
  operativeLocation,
  operativeInTransit,
  canReassignOperative,
} from '../packages/game/squads.js';
import { campaignRole } from '../packages/game/campaign-roles.js';
import { sectorInventoryModel, sectorInventorySites } from '../packages/game/sector-inventory.js';
import {
  carriedAmmunition,
  ammunitionOrderQuote,
  AMMUNITION_ORDER_LIMIT,
} from '../packages/game/campaign-ammunition.js';
import { ammoTypeFor, ammoCount, AMMO_KEYS } from '../packages/game/ammo-types.js';
import { AMMUNITION_FAMILIES } from '../packages/game/ammunition-families.js';
import { AMMUNITION_TYPES } from '../packages/game/ammunition-types.js';
import { applyItemQuantity, handRecord } from '../packages/game/tactical-inventory.js';
import { previewStrategicRoute } from '../packages/game/strategic-route.js';
import { tooTiredToMarch } from '../packages/game/march-fatigue.js';
import { enterSector } from '../packages/game/world.js';
import {
  actBattle,
  getReachable,
  movementStepCost,
  climbPreview,
  lookPreview,
} from '../packages/game/tactical.js';
import { sameCell, sameSurface, spacePoint, surfaceAt } from '../packages/game/tactical-space.js';
import { boundaryPassable } from '../packages/game/tactical-exits.js';
import { directionTo } from '../packages/game/tactical-awareness.js';
import { syncBattleTime } from '../packages/game/time.js';
import { publicRouteView } from './route-infantry-progress.ts';
import { quoteMountainServiceBudget } from './mountain-service-budget.ts';
import { recordRouteStrategicEvidence } from './route-strategic-failure-evidence.ts';
import { recoverRoutePrimary } from './route-owned-equipment.ts';

const clock = (c: CampaignSnapshot) => c.hour * 3600 + (c.secondOfHour ?? 0),
  sector = 'cordoba',
  target = 10;
const carried = (c: CampaignSnapshot, id: number) =>
  carriedAmmunition(
    rosterFor(c).find((op) => op.id === id),
    c.operativeState[id],
  );
const familyOf = (c: CampaignSnapshot, id: number) => ammoTypeFor({ ...carried(c, id), activeSlot: 'primary' });
const amount = (c: CampaignSnapshot, id: number, family: string|null|undefined) => ammoCount(carried(c, id), family);
const stack = (family: string, count: number) => ({
  item: `inventory:ammo:${AMMUNITION_FAMILIES[family].type}`,
  kind: 'ammunition',
  ammoType: AMMUNITION_FAMILIES[family].type,
  name: AMMUNITION_FAMILIES[family].name,
  weight: present(AMMUNITION_TYPES[AMMUNITION_FAMILIES[family].type]).weight,
  count,
});
const rows = (c: CampaignSnapshot, at: string, id: number, family: string) => {
  const unique = new Map();
  for (const site of sectorInventorySites(c, at)) {
    for (const row of sectorInventoryModel(c, site.id, rosterFor(c), id).entries) {
      const value = JSON.parse(row.expected);
      if (
        row.count > 0 &&
        value.kind === 'ammunition' &&
        value.ammoType === AMMUNITION_FAMILIES[family].type
      ) {
        unique.set(site.id + '\0' + row.key, { ...row, siteId: site.id });
      }
    }
  }
  return [...unique.values()];
};
const known = (c: CampaignSnapshot, at: string, id: number, family: string) =>
  (c.ammunitionStores[at]?.[family] ?? 0) +
  rows(c, at, id, family).reduce((n, row) => n + row.count, 0);

// Match the existing rear's <2 admission and target10. Count each accessible
// source once. Only a currently admitted donor's off-primary loose family can
// cover a local deficit; its primary cartridges and chambers are never surplus.
export function stockCuyoReserveAmmoPlan(c: CampaignSnapshot, posts) {
  const ids = posts.map((post) => post.id),
    short = ids.filter((id) => {
      const unit = carried(c, id),
        family = familyOf(c, id);
      return family && unit.loaded + ammoCount(unit, family) < 2;
    }),
    families = {};
  for (const family of AMMO_KEYS) {
    const recipients = short.filter((id) => familyOf(c, id) === family);
    if (!recipients.length) {
      continue;
    }
    const needed = recipients.reduce(
        (n, id) => n + Math.max(0, target - carried(c, id).loaded - amount(c, id, family)),
        0,
      ),
      physical = new Map();
    for (const id of recipients) {
      for (const row of rows(c, sector, id, family)) {
        if (row.reachable) {
          physical.set(row.siteId + '\0' + row.key, row);
        }
      }
    }
    const depot = c.ammunitionStores[sector]?.[family] ?? 0,
      local = depot + [...physical.values()].reduce((n, row) => n + row.count, 0),
      donors = [];
    let missing = Math.max(0, needed - local);
    for (const id of c.recruited) {
      if (!missing) {
        break;
      }
      const r = c.operativeState[id];
      if (!present(r).alive || present(r).captured || operativeLocation(c, id) !== sector) {
        continue;
      }
      const model = sectorInventoryModel(c, sector, rosterFor(c), id),
        primary = familyOf(c, id);
      if (model.operativeId !== id || model.reason || !primary || primary === family) {
        continue;
      }
      const row = model.carried.find(
        (row) =>
          row.item.startsWith('inventory:') &&
          present(model.personal).inventory[row.item.slice(10)]?.kind === 'ammunition' &&
          present(model.personal).inventory[row.item.slice(10)].ammoType ===
            AMMUNITION_FAMILIES[family].type,
      );
      if (row?.count) {
        const count = Math.min(missing, row.count);
        donors.push({ id, count, item: row.item });
        missing -= count;
      }
    }
    families[family] = {
      recipients,
      needed,
      depot,
      physical: [...physical.values()],
      local,
      donors,
      missing,
    };
  }
  return {
    target,
    ids,
    short,
    families,
    deficit: Object.fromEntries(
      Object.entries(families).map(([family, row]) => [family, row.missing]),
    ),
  };
}

// Fetch only the measured rear deficit BEFORE the unchanged zero-time reserve
// preparer takes its new input. This is the same known-source posta/pick/store
// route used by the later field allocator; field target12 and reform stay there.
// A remembered row is a source candidate, never an admitted remote pickup.
export function prefetchStockCuyoReserveAmmunition(start: CampaignSnapshot, posts, { report = () => {} } = {}) {
  const before = structuredClone(start),
    groups = structuredClone(start.squads),
    selected = start.activeSquadId,
    intended = start.recruited.filter(
      (id) => present(start.operativeState[id]).alive && !present(start.operativeState[id]).captured,
    ),
    orders = [],
    renewals = [],
    journeys = [],
    pickups = [],
    deposits: { family: string; count: number; }[] = [],
    rearms = [],
    admissions = [];
  let campaign = start,
    battle = null,
    plan = null,
    carrierId: number|null = null,
    home = null,
    courier = null,
    funding = null,
    itinerary = [],
    feesRemaining = 0,
    steps = 0,
    visitUntil: number|null = null,
    postSeconds = 0,
    rearmFailed = false;
  const until = clock(start) + 72 * 3600,
    receipt = () => ({
      target,
      startSeconds: clock(start),
      endSeconds: clock(campaign),
      deadlineSeconds: until,
      plan,
      carrierId,
      homeId: home?.id,
      courierId: courier?.id,
      funding,
      itinerary,
      orders,
      renewals,
      journeys,
      pickups,
      deposits,
      rearms,
      admissions,
      postSeconds,
    });
  recordRouteStrategicEvidence({
    helper: 'prefetchStockCuyoReserveAmmunition',
    stage: 'preparation-input',
    campaign: start,
    context: { posts },
  });
  const check = () => {
    assert.equal(campaign.defeated, false);
    assert.ok(
      clock(campaign) <= until,
      'The actual reserve courier exceeds its existing 72-hour bound.',
    );
    for (const id of intended) {
      const r = campaign.operativeState[id],
        expiry = contractExpiresSeconds(campaign.contracts[id]);
      assert.ok(
        campaign.recruited.includes(id) &&
          present(r).alive &&
          !present(r).captured &&
          campaign.contracts[id] &&
          (expiry === null || expiry > clock(campaign)),
        `Retain actual serving soldier ${id}.`,
      );
      assert.ok(
        present(r).hp >= 15 && !present(r).bleeding,
        'Actual acute patients need care before a reserve supply journey.',
      );
      if (id !== carrierId) {
        assert.equal(present(r).assignment, present(start.operativeState[id]).assignment);
        assert.deepEqual(present(r).residentPosition, present(start.operativeState[id]).residentPosition);
      }
    }
    for (const [id, r] of Object.entries(start.operativeState)) {
      if (!r.alive) {
        assert.equal(campaign.operativeState[id].alive, false);
      }
    }
  };
  const dispatch = (action: CampaignAction) => {
    const old = campaign,
      j = old.squads.find((q) => q.id === courier?.id)?.journey;
    campaign = dispatchCampaign(old, action);
    orders.push({
      kind: 'campaign',
      action: structuredClone(action),
      from: clock(old),
      to: clock(campaign),
      cost: old.resources.treasury - campaign.resources.treasury,
      accepted: campaign.lastError === null,
    });
    if (
      action.type === 'wait' &&
      j?.status === 'moving' &&
      !j.returning &&
      !j.elapsed &&
      !j.elapsedSecond &&
      clock(campaign) > clock(old)
    ) {
      feesRemaining -= 10;
    }
    assert.equal(campaign.lastError, null, JSON.stringify(action) + ': ' + campaign.lastError);
    assert.equal(
      campaign.pendingEncounter,
      null,
      'A real encounter stops the reserve ammunition courier.',
    );
    if (action.type !== 'visitSector') {
      assert.equal(
        campaign.pendingBattle,
        null,
        'A real tactical interruption stops the reserve ammunition courier.',
      );
    }
    check();
  };
  const retain = (seconds: number) => {
    check();
    assert.ok(
      clock(campaign) + seconds <= until,
      'The next actual courier step must fit the same bound.',
    );
    const horizonSeconds = clock(campaign) + seconds,
      quote = quoteMountainServiceBudget(campaign, {
        keepIds: intended,
        horizonSeconds,
        fixedCost: feesRemaining,
      });
    assert.equal(quote.available, true, quote.reason);
    for (const row of quote.entries) {
      for (let n = 0; n < row.renewals; n++) {
        const contract = campaign.contracts[row.id],
          current = contractRenewalQuote(
            campaign,
            rosterFor(campaign).find((op) => op.id === row.id),
            'day',
          );
        assert.equal(current.available, true, current.reason);
        dispatch({
          type: 'renewContract',
          id: row.id,
          term: 'day',
          expectedExpiresAt: present(contract).expiresAt,
          expectedExpiresSecond: present(contract).expiresSecond ?? 0,
        });
        renewals.push({ id: row.id, quote: current });
      }
    }
  };
  const order = (action) => {
    assert.equal(battle, null);
    assert.equal(campaign.pendingEncounter, null);
    assert.equal(campaign.pendingBattle, null);
    retain(Math.max(3600, action.type === 'wait' ? action.hours * 3600 : 0));
    dispatch(action);
  };
  const freshPair = () => {
    const pair = syncBattleTime(campaign, battle);
    if (pair.error) {
      campaign = pair.campaign;
      battle = pair.battle;
      throw Error(pair.error);
    }
    campaign = pair.campaign;
    battle = pair.battle;
    check();
  };
  const act = (action: TacticalAction, seconds = 6) => {
    assert.ok(++steps <= 128, 'Carrier admission and post return share one 128-step bound.');
    assert.ok(
      clock(campaign) + seconds <= until &&
        clock(campaign) + seconds <= present(visitUntil) &&
        postSeconds + seconds <= 3600,
    );
    const old = campaign;
    battle = actBattle(battle, action);
    orders.push({
      kind: 'battle',
      action: structuredClone(action),
      from: clock(old),
      to: null,
      cost: 0,
      accepted: battle.lastError === null,
    });
    assert.equal(battle.lastError, null, JSON.stringify(action) + ': ' + battle.lastError);
    freshPair();
    postSeconds += clock(campaign) - clock(old);
    orders.at(-1).to = clock(campaign);
    orders.at(-1).cost = old.resources.treasury - campaign.resources.treasury;
    assert.ok(clock(campaign) <= present(visitUntil) && postSeconds <= 3600);
    assert.equal(campaign.pendingEncounter, null);
    assert.equal(battle.mode, 'exploration');
    assert.equal(battle.phase, 'player');
    assert.equal(battle.status, 'active');
  };
  const actor = () => battle.units.find((unit: { id: string; }) => unit.id === String(carrierId));
  const reservedView = () => {
    const current = actor(),
      view = publicRouteView(battle, current),
      reserved = intended
        .filter((id) => id !== carrierId)
        .flatMap((id) => {
          const r = campaign.operativeState[id];
          if (
            present(r).residentSector !== sector ||
            (present(r).residentScene ?? null) !== (present(campaign.pendingBattle).sceneId ?? null) ||
            !present(r).residentPosition ||
            operativeLocation(campaign, id) !== sector ||
            operativeInTransit(campaign, id)
          ) {
            return [];
          }
          const point = present(r).residentPosition;
          assert.ok(
            surfaceAt(view, point) && !present(surfaceAt(view, point)).blocked,
            'A reservation belongs to a real current own post.',
          );
          return [{ id, ...spacePoint(point) }];
        });
    // These copied public surfaces are conservative planning obstacles only.
    // Do not add occupants, change the real field or adopt this quote view.
    const reserve = (point: BattleTile) => reserved.some((post) => sameCell(post, point));
    return {
      reserved,
      view: {
        ...view,
        tiles: view.tiles.map((point) => (reserve(point) ? { ...point, blocked: true } : point)),
        upperSurfaces: (view.upperSurfaces ?? []).map((point) =>
          reserve(point) ? { ...point, blocked: true } : point,
        ),
      },
    };
  };
  const restoreCondition = (condition) => {
    if (
      condition.activeSlot !== undefined &&
      ['activeSlot', 'activeTool', 'activeSupply', 'activeItem'].some(
        (key) => actor()[key] !== condition[key],
      )
    ) {
      act({
        type: 'weapon',
        unitId: String(carrierId),
        slot: condition.activeSlot,
        ...(condition.activeTool !== undefined ? { toolKey: condition.activeTool } : {}),
        ...(condition.activeSupply !== undefined ? { supplyKey: condition.activeSupply } : {}),
        ...(condition.activeItem !== undefined ? { item: condition.activeItem } : {}),
      });
    }
    if (condition.movementMode !== undefined && actor().movementMode !== condition.movementMode) {
      act({ type: 'movement', unitId: String(carrierId), movement: condition.movementMode });
    }
    if (condition.stance !== undefined && actor().stance !== condition.stance) {
      act({ type: 'stance', unitId: String(carrierId), stance: condition.stance });
    }
    if (condition.facing !== undefined && actor().facing !== condition.facing) {
      const view = publicRouteView(battle, actor()),
        point = [...(view.upperSurfaces ?? []), ...view.tiles].find(
          (point) =>
            !sameCell(actor(), point) &&
            directionTo(actor(), point) === condition.facing &&
            lookPreview(view, actor(), point).valid,
        );
      assert.ok(point, 'Restore the recorded facing through a real look.');
      act({ type: 'look', unitId: String(carrierId), ...spacePoint(point) });
    }
    if (condition.stealthMode !== undefined && actor().stealthMode !== condition.stealthMode) {
      act({ type: 'stealth', unitId: String(carrierId), enabled: condition.stealthMode }, 0);
    }
    for (const [key, value] of Object.entries(condition)) {
      assert.deepEqual(actor()[key], value);
    }
  };
  const leaveVisit = () => {
    dispatch({
      type: 'leaveSector',
      battleId: present(campaign.pendingBattle).id,
      sectorState: battle,
      survivors: battle.units.filter((unit: { side: string; }) => unit.side === 'player'),
    });
    battle = null;
  };
  const restoreHome = (old: CampaignOperativeState|undefined) => {
    order({ type: 'assignToSquad', operativeId: carrierId, squadId: home.id });
    order({ type: 'selectSquad', id: home.id });
    order({ type: 'squad', ids: home.members });
    if (old.assignment !== 'active') {
      order({ type: 'assignCare', operativeId: carrierId, assignment: old.assignment });
    }
    if (campaign.activeSquadId !== selected) {
      order({ type: 'selectSquad', id: selected });
    }
    assert.deepEqual(campaign.squads, groups);
    assert.deepEqual(campaign.squad, start.squad);
  };
  const travel = (destination: string) => {
    for (let h = 0; h < 72; h++) {
      const r = campaign.operativeState[carrierId];
      if (!r.asleep && r.energy >= 75 && r.fatigue <= 40 && !tooTiredToMarch(r)) {
        break;
      }
      if (r.assignment !== 'rest') {
        order({ type: 'assignCare', operativeId: carrierId, assignment: 'rest' });
      }
      if (r.asleep && r.energy === 100 && !tooTiredToMarch(r)) {
        order({ type: 'setSleep', operativeId: carrierId, asleep: false });
      } else {
        order({ type: 'wait', hours: 1 });
      }
    }
    if (campaign.operativeState[carrierId].assignment !== 'active') {
      order({ type: 'assignCare', operativeId: carrierId, assignment: 'active' });
    }
    const quote = previewStrategicRoute(campaign, courier.id, destination, 'posta');
    assert.equal(quote.valid, true, quote.reason);
    assert.ok(
      quote.hours > 0 && quote.hours <= 48,
      'Use a bounded current controlled posta route.',
    );
    const from = clock(campaign);
    order(quote.action);
    for (let h = 0; present(campaign.squads.find((q) => q.id === courier.id)).journey && h < 72; h++) {
      assert.equal(
        present(campaign.squads.find((q) => q.id === courier.id)).journey.status,
        'moving',
        'A paused actual route needs a new plan.',
      );
      order({ type: 'wait', hours: 1 });
    }
    assert.ok(
      !present(campaign.squads.find((q) => q.id === courier.id)).journey,
      'The real courier must arrive within 72 hourly steps.',
    );
    assert.equal(operativeLocation(campaign, carrierId), destination);
    assert.equal(campaign.location, destination);
    journeys.push({ destination, quote, from, to: clock(campaign) });
  };
  try {
    assert.equal(start.pendingBattle, null);
    assert.equal(start.pendingEncounter, null);
    assert.equal(start.location, sector);
    assert.equal(start.sectors[sector]?.owner, 'patriot');
    assert.ok(new Set(posts.map((post) => post.id)).size === posts.length);
    for (const { id } of posts) {
      assert.ok(intended.includes(id) && operativeLocation(start, id) === sector);
    }
    // Run the original ordinary rearm leaf once. Only its successful return is
    // adopted. Its external boundary is explicit; no individual order tape is
    // fabricated. A thrown nested result stays raw evidence and is never used.
    for (const { id } of posts) {
      if (present(campaign.operativeState[id]).weaponDropped) {
        const input = campaign,
          transition = {
            id,
            beforeOrderIndex: orders.length,
            before: input,
            after: null,
            completed: false,
            nativeOrderTape: null,
            scope:
              'Original recoverRoutePrimary leaf; individual internal orders are not captured.',
          };
        rearms.push(transition);
        try {
          const returned = recoverRoutePrimary(input, id, { report });
          campaign = returned;
          transition.after = returned;
          transition.completed = true;
          transition.from = clock(input);
          transition.to = clock(returned);
          transition.cost = input.resources.treasury - returned.resources.treasury;
        } catch (error) {
          rearmFailed = true;
          transition.rawFailureCampaign = error?.campaign ?? null;
          transition.rawFailureBattle = error?.battle ?? null;
          transition.failurePrefixAvailable = Boolean(error?.campaign);
          throw error;
        }
        assert.equal(campaign.pendingBattle, null);
        assert.equal(campaign.pendingEncounter, null);
        assert.deepEqual(campaign.squads, input.squads);
        assert.deepEqual(campaign.contracts, input.contracts);
        assert.equal(campaign.resources.treasury, input.resources.treasury);
        for (const [person, r] of Object.entries(input.operativeState)) {
          for (const key of ['alive', 'hp', 'bleeding', 'captured', 'morale', 'medkits']) {
            assert.deepEqual(
              campaign.operativeState[person][key],
              r[key],
              `Keep original rearm guard ${person}.${key}.`,
            );
          }
        }
      }
    }
    const supplied = campaign;
    plan = stockCuyoReserveAmmoPlan(supplied, posts);
    if (!Object.values(plan.deficit).some((n) => n > 0)) {
      return {
        campaign: supplied,
        receipt: { ...receipt(), reason: 'local-stock-covers-reserve', restored: true },
      };
    }
    check();
    assert.equal(supplied.routes.posta, true, 'Use the already available actual posta network.');
    assert.ok(
      groups.every((q) => !q.journey),
      'Finish existing journeys before this rear-supply roundtrip.',
    );
    for (const family of Object.keys(plan.families)) {
      for (const id of plan.families[family].recipients) {
        const m = sectorInventoryModel(supplied, sector, rosterFor(supplied), id);
        assert.equal(m.operativeId, id);
        assert.equal(m.reason, null, m.reason);
        applyItemQuantity(
          m.personal,
          stack(
            family,
            Math.max(0, target - carried(supplied, id).loaded - amount(supplied, id, family)),
          ),
        );
      }
    }
    const required = new Set(
        ['foundryEngineer', 'marchCommander'].map((key) => campaignRole(supplied, key)?.id),
      ),
      patients = intended.some(
        (id) =>
          operativeLocation(supplied, id) === sector &&
          (present(supplied.operativeState[id]).hp < present(supplied.operativeState[id]).maxHp ||
            present(supplied.operativeState[id]).bleeding > 0),
      );
    courier = groups.find((q) => q.location === sector && !q.journey && !q.members.length);
    assert.ok(courier, 'Reuse an actual empty Córdoba home; do not create a ninth squad.');
    const eligible = (c: CampaignSnapshot, op: CampaignOperative) => {
      const r = c.operativeState[op.id];
      if (
        !intended.includes(op.id) ||
        required.has(op.id) ||
        operativeLocation(c, op.id) !== sector ||
        operativeInTransit(c, op.id) ||
        !canReassignOperative(c, op.id) ||
        present(r).hp !== present(r).maxHp ||
        present(r).bleeding ||
        present(r).asleep ||
        present(r).routed ||
        present(r).unconscious ||
        present(r).surrendered ||
        present(r).energy < 75 ||
        present(r).fatigue > 40 ||
        tooTiredToMarch(r) ||
        !['active', 'rest'].includes(present(r).assignment) ||
        present(c.contracts[op.id]).departurePending ||
        (patients && op.medical >= 20) ||
        c.militiaTraining?.some((row) => row.trainerId === op.id) ||
        present(r).residentScene ||
        present(r).residentSector !== sector ||
        !present(r).residentPosition
      ) {
        return false;
      }
      const m = sectorInventoryModel(c, sector, rosterFor(c), op.id);
      if (m.operativeId !== op.id || m.reason) {
        return false;
      }
      try {
        let personal = m.personal;
        for (const [family, n] of Object.entries(plan.deficit)) {
          if (n) {
            personal = applyItemQuantity(personal, stack(family, n));
          }
        }
        return true;
      } catch {
        return false;
      }
    };
    const candidates = rosterFor(supplied)
      .filter((op) => eligible(supplied, op))
      .sort(
        (a, b) =>
          Number(posts.some((post: { id: number; }) => post.id === a.id)) -
            Number(posts.some((post: { id: number; }) => post.id === b.id)) ||
          present(supplied.operativeState[b.id]).energy - present(supplied.operativeState[a.id]).energy ||
          b.strength - a.strength ||
          a.id - b.id,
      );
    assert.ok(
      candidates.length,
      'An actual free fit nonclinical carrier needs room for the complete finite parcel.',
    );
    carrierId = present(candidates[0]).id;
    // Geometry/service previews describe intended zero-time membership orders.
    // The small draft is never adopted; every real departure is quoted again.
    const quoteJourneys = () => {
      const current = campaign,
        old = current.operativeState[carrierId],
        remaining = { ...plan.deficit },
        visited = new Set();
      let hours = 0;
      let draft = {
        ...current,
        operativeState: {
          ...current.operativeState,
          [carrierId]: { ...old, assignment: 'active' },
        },
        squads: groups.map((q) =>
          q.id === courier.id
            ? { ...q, members: [carrierId] }
            : { ...q, members: q.members.filter((id) => id !== carrierId) },
        ),
      };
      itinerary = [];
      feesRemaining = 0;
      while (Object.values(remaining).some((n) => n > 0)) {
        const choices = Object.keys(current.sectors)
          .filter(
            (at) => at !== sector && !visited.has(at) && present(current.sectors[at]).owner === 'patriot',
          )
          .map((at) => {
            const counts = Object.fromEntries(
                AMMO_KEYS.map((family) => [family, known(current, at, carrierId, family)]),
              ),
              quote = previewStrategicRoute(draft, courier.id, at, 'posta');
            return {
              sector: at,
              counts,
              quote,
              complete: AMMO_KEYS.every((family) => counts[family] >= (remaining[family] ?? 0)),
              quantity: AMMO_KEYS.reduce(
                (n, family) => n + Math.min(counts[family], remaining[family] ?? 0),
                0,
              ),
            };
          })
          .filter((row) => row.quote.valid && row.quantity > 0)
          .sort(
            (a, b) =>
              Number(b.complete) - Number(a.complete) ||
              a.quote.hours - b.quote.hours ||
              b.quantity - a.quantity ||
              a.sector.localeCompare(b.sector),
          );
        const source = choices[0];
        assert.ok(
          source,
          'No controlled known finite ammunition source covers the actual rear deficit.',
        );
        const parcel = Object.fromEntries(
          Object.entries(remaining).map(([family, n]) => [
            family,
            Math.min(n, source.counts[family]),
          ]),
        );
        itinerary.push({ ...source, parcel });
        visited.add(source.sector);
        for (const [family, n] of Object.entries(parcel)) {
          remaining[family] -= n;
        }
        hours += source.quote.hours;
        feesRemaining += (source.quote.path.length - 1) * 10;
        draft = {
          ...draft,
          squads: draft.squads.map((q) =>
            q.id === courier.id ? { ...q, location: source.sector } : q,
          ),
        };
      }
      const returning = previewStrategicRoute(draft, courier.id, sector, 'posta');
      assert.equal(returning.valid, true, returning.reason);
      hours += returning.hours;
      feesRemaining += (returning.path.length - 1) * 10;
      assert.ok(
        clock(current) + (hours + 2) * 3600 <= until,
        'The quoted roundtrip and bounded post return must fit the original 72 hours.',
      );
      funding = quoteMountainServiceBudget(current, {
        keepIds: intended,
        horizonSeconds: clock(current) + (hours + 2) * 3600,
        fixedCost: feesRemaining,
      });
      assert.equal(funding.available, true, funding.reason);
      return returning;
    };
    // Unknown, empty, insufficient and full-pack sources still refuse before any
    // membership/visit order. A candidate needs an actual saved post to restore.
    let returning = quoteJourneys(),
      chosen = null;
    for (const candidate of candidates) {
      if (!eligible(campaign, candidate)) {
        continue;
      }
      carrierId = candidate.id;
      home = groups.find(
        (q) => q.members.includes(carrierId) && q.location === sector && !q.journey,
      );
      assert.ok(home);
      returning = quoteJourneys();
      const old = campaign.operativeState[carrierId],
        post = structuredClone(present(old).residentPosition),
        condition = {},
        from = clock(campaign),
        cash = campaign.resources.treasury;
      order({ type: 'selectSquad', id: courier.id });
      order({ type: 'squad', ids: [carrierId] });
      if (present(old).assignment !== 'active') {
        order({ type: 'assignCare', operativeId: carrierId, assignment: 'active' });
      }
      visitUntil = Math.min(until, clock(campaign) + 3600 - postSeconds);
      order({ type: 'visitSector' });
      battle = enterSector(campaign.pendingBattle, campaign.sectorStates[sector]);
      freshPair();
      assert.ok(
        actor() && sameCell(actor(), post),
        'Quote only the actual current resident at its own saved post.',
      );
      assert.deepEqual(
        present(campaign.pendingBattle).squad.map((unit) => String(unit.id)),
        [String(carrierId)],
      );
      assert.deepEqual(
        battle.units
          .filter((unit) => unit.side === 'player' && unit.hp > 0 && !unit.departure)
          .map((unit) => unit.id),
        [String(carrierId)],
        'Never deploy a candidate clinical or working home to preflight its carrier.',
      );
      for (const key of [
        'stance',
        'movementMode',
        'activeSlot',
        'activeTool',
        'activeSupply',
        'activeItem',
        'facing',
        'stealthMode',
      ]) {
        if (actor()[key] !== undefined) {
          condition[key] = structuredClone(actor()[key]);
        }
      }
      if (actor().movementMode !== 'walk' || actor().stance !== 'standing') {
        act({ type: 'movement', unitId: String(carrierId), movement: 'walk' });
      }
      const { view, reserved } = reservedView(),
        road = battle.exits.find((exit) => exit.destination === returning.path.at(-2));
      assert.ok(road, 'The actual return road needs a public reciprocal tactical exit.');
      const options = getReachable(view, actor())
        .filter(
          (point) =>
            boundaryPassable(view, point, road.edge) &&
            point.path.length + 8 <= 128 - steps &&
            point.path.every((step) => !reserved.some((post) => sameCell(post, step))),
        )
        .sort((a: TacticalPoint, b: TacticalPoint) => a.cost - b.cost || a.y - b.y || a.x - b.x);
      let quote = null;
      for (const departure of options) {
        const path = [spacePoint(actor()), ...departure.path.slice(0, -1)].reverse();
        let previous = departure,
          cost = 0;
        // Quote every reverse edge with the actual Native actor and public step
        // API; do not project that actor into a made-up arrival position or pair.
        const valid = path.every((point) => {
          const paid = movementStepCost(view, actor(), previous, point);
          previous = point;
          cost += paid;
          return Number.isFinite(paid) && !reserved.some((post) => sameCell(post, point));
        });
        if (valid) {
          quote = {
            road: structuredClone(road),
            reserved,
            departure: structuredClone(departure),
            returning: { origin: spacePoint(departure), path, cost },
          };
          break;
        }
      }
      restoreCondition(condition);
      leaveVisit();
      assert.deepEqual(present(campaign.operativeState[carrierId]).residentPosition, post);
      restoreHome(old);
      const admitted = Boolean(quote) && eligible(campaign, candidate),
        admission = {
          id: carrierId,
          post,
          from,
          to: clock(campaign),
          cost: cash - campaign.resources.treasury,
          condition,
          quote,
          admitted,
        };
      admissions.push(admission);
      if (admitted) {
        chosen = { old: campaign.operativeState[carrierId], post, condition };
        break;
      }
    }
    assert.ok(
      chosen,
      'A free fit carrier needs a publicly quoted departure and return outside every other saved post before travel.',
    );
    const { old, post, condition } = chosen;
    returning = quoteJourneys();
    recordRouteStrategicEvidence({
      helper: 'prefetchStockCuyoReserveAmmunition',
      stage: 'known-source-plan',
      campaign,
      context: receipt(),
    });
    order({ type: 'selectSquad', id: courier.id });
    order({ type: 'squad', ids: [carrierId] });
    if (present(old).assignment !== 'active') {
      order({ type: 'assignCare', operativeId: carrierId, assignment: 'active' });
    }
    for (const source of itinerary) {
      travel(source.sector);
      for (const [family, requested] of Object.entries(source.parcel)) {
        let n = requested;
        while (n) {
          const depot = campaign.ammunitionStores[source.sector]?.[family] ?? 0;
          if (depot) {
            const count = Math.min(n, depot, AMMUNITION_ORDER_LIMIT),
              quote = ammunitionOrderQuote(
                campaign,
                rosterFor(campaign).find((op) => op.id === carrierId),
                family,
                count,
                'take',
                true,
              ),
              beforeCount = amount(campaign, carrierId, family);
            assert.equal(quote.available, true, quote.reason);
            order({
              type: 'ammunition',
              operativeId: carrierId,
              family,
              quantity: count,
              direction: 'take',
            });
            assert.equal(amount(campaign, carrierId, family), beforeCount + count);
            assert.equal(present(campaign.ammunitionStores[source.sector])[family], depot - count);
            pickups.push({ sector: source.sector, family, count, kind: 'depot' });
            n -= count;
            continue;
          }
          const row = rows(campaign, source.sector, carrierId, family)
            .filter((row) => row.reachable)
            .sort(
              (a, b) =>
                b.count - a.count || a.siteId.localeCompare(b.siteId) || a.key.localeCompare(b.key),
            )[0];
          assert.ok(row, 'The actual remote ammunition source must remain reachable at arrival.');
          const count = Math.min(n, row.count),
            m = sectorInventoryModel(campaign, row.siteId, rosterFor(campaign), carrierId),
            pool = known(campaign, source.sector, carrierId, family),
            beforeCount = amount(campaign, carrierId, family);
          assert.equal(m.operativeId, carrierId);
          assert.equal(m.reason, null, m.reason);
          applyItemQuantity(m.personal, { ...JSON.parse(row.expected), count });
          order({
            type: 'sectorInventory',
            sector: row.siteId,
            operativeId: carrierId,
            direction: 'take',
            sourceKey: row.key,
            expected: row.expected,
            count,
          });
          assert.equal(amount(campaign, carrierId, family), beforeCount + count);
          assert.equal(
            known(campaign, source.sector, carrierId, family),
            pool - count,
            'Debit the current unique family pool, including compacted rows.',
          );
          pickups.push({
            sector: source.sector,
            siteId: row.siteId,
            sourceKey: row.key,
            expected: row.expected,
            family,
            count,
            kind: row.kind,
          });
          n -= count;
        }
      }
    }
    travel(sector);
    for (const [family, requested] of Object.entries(plan.deficit)) {
      for (let n = requested; n > 0;) {
        const count = Math.min(n, AMMUNITION_ORDER_LIMIT),
          depot = campaign.ammunitionStores[sector]?.[family] ?? 0,
          beforeCount = amount(campaign, carrierId, family),
          quote = ammunitionOrderQuote(
            campaign,
            rosterFor(campaign).find((op) => op.id === carrierId),
            family,
            count,
            'store',
            true,
          );
        assert.equal(quote.available, true, quote.reason);
        order({
          type: 'ammunition',
          operativeId: carrierId,
          family,
          quantity: count,
          direction: 'store',
        });
        assert.equal(present(campaign.ammunitionStores[sector])[family], depot + count);
        assert.equal(amount(campaign, carrierId, family), beforeCount - count);
        deposits.push({ family, count });
        n -= count;
      }
    }
    if (post) {
      retain(3600 - postSeconds);
      visitUntil = Math.min(until, clock(campaign) + 3600 - postSeconds);
      order({ type: 'visitSector' });
      battle = enterSector(campaign.pendingBattle, campaign.sectorStates[sector]);
      freshPair();
      assert.ok(actor());
      if (actor().movementMode !== 'walk' || actor().stance !== 'standing') {
        act({ type: 'movement', unitId: String(carrierId), movement: 'walk' });
      }
      while (!sameCell(actor(), post)) {
        const { view, reserved } = reservedView(),
          path = getReachable(view, actor(), { stopAt: (point) => sameCell(point, post) }).find(
            (point) => sameCell(point, post),
          )?.path;
        assert.ok(
          path?.length && !path.some((step) => reserved.some((point) => sameCell(step, point))),
          'Restore the carrier through an actual path outside every other saved post.',
        );
        const step = path[0];
        assert.ok(clock(campaign) + 6 <= visitUntil);
        if (!sameSurface(actor(), step)) {
          const quote = climbPreview(publicRouteView(battle, actor()), actor(), {
            linkId: present(step).linkId,
          });
          assert.equal(quote.valid, true, quote.reason);
          assert.ok(clock(campaign) + present(quote.seconds) <= visitUntil);
          act({ type: 'climb', unitId: String(carrierId), linkId: present(step).linkId }, quote.seconds);
        } else {
          act({ type: 'move', unitId: String(carrierId), ...spacePoint(step) });
        }
      }
      restoreCondition(condition);
      assert.ok(clock(campaign) <= visitUntil);
      leaveVisit();
      assert.deepEqual(present(campaign.operativeState[carrierId]).residentPosition, post);
    }
    restoreHome(old);
    assert.deepEqual(campaign.squads, groups);
    assert.deepEqual(campaign.squad, start.squad);
    assert.equal(campaign.location, start.location);
    assert.equal(feesRemaining, 0);
    for (const id of intended) {
      for (const family of AMMO_KEYS) {
        assert.equal(
          amount(campaign, id, family),
          amount(supplied, id, family),
          'Keep every original loose primary reserve and deposit only the acquired parcel.',
        );
      }
      assert.equal(carried(campaign, id).loaded, carried(supplied, id).loaded);
      assert.deepEqual(
        handRecord(carried(campaign, id), 'primary'),
        handRecord(carried(supplied, id), 'primary'),
      );
      const otherItems = (unit: CampaignOperative&{ inventory: Record<string,import("../packages/game/public/compatibility-types.ts").EquipmentItem>; loaded: number; ammo: number; }) =>
        Object.fromEntries(
          Object.entries(unit.inventory ?? {}).filter(([, item]) => item.kind !== 'ammunition'),
        );
      assert.deepEqual(otherItems(carried(campaign, id)), otherItems(carried(supplied, id)));
    }
    for (const key of [
      'hp',
      'bleeding',
      'medkits',
      'condition',
      'weaponInstanceId',
      'bladeInstanceId',
      'headwear',
      'outfit',
      'legwear',
    ]) {
      assert.deepEqual(present(campaign.operativeState[carrierId])[key], present(old)[key]);
    }
    check();
    assert.deepEqual(start, before);
    const done = { ...receipt(), condition, restored: true };
    report({ event: 'stockCuyoReserveAmmoPrefetched', receipt: done });
    return { campaign, receipt: done };
  } catch (error) {
    const partial = {
      ...receipt(),
      restored: false,
      ...(rearmFailed
        ? {
            lastSuccessfulCampaign: campaign,
            rawFailureCampaign: error?.campaign ?? null,
            rawFailureBattle: error?.battle ?? null,
            failurePrefixAvailable: Boolean(error?.campaign),
          }
        : {}),
    };
    recordRouteStrategicEvidence({
      helper: 'prefetchStockCuyoReserveAmmunition',
      stage: 'preparation-failure',
      campaign,
      context: partial,
      error,
    });
    if (error && typeof error === 'object') {
      if (!rearmFailed) {
        error.campaign = campaign;
        error.battle = campaign.pendingBattle?.id === battle?.battleId ? battle : null;
      }
      error.reserveAmmunitionPrefetch = partial;
    }
    throw error;
  }
}
