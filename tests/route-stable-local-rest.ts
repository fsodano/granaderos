import type { CampaignSnapshot, CampaignAction } from '../packages/game/public/campaign-types.ts';
import type { FreshRouteOrderEvent } from './fresh-route-orders.ts';
import { present } from './assert-present.ts';
export type RouteRestRate = { hours: number; energy: number; fatigue: number };
export type RouteRestBound = {
  id: number;
  woundHours: number;
  awakeHours: number;
  rate: RouteRestRate;
};
export type RouteRestHealth = {
  id: number;
  hp: number;
  recoveryHours: number | undefined;
  energy: number;
  fatigue: number | undefined;
  asleep: boolean | undefined;
};
export type RouteRestTick = {
  elapsedSeconds: number;
  before: RouteRestHealth[];
  after: RouteRestHealth[];
};
type StableRestOptions = { requireAwake?: boolean; report?: (event: FreshRouteOrderEvent) => void };
import assert from 'node:assert/strict';
import { rosterFor } from '../packages/game/campaign.js';
import { careRules } from '../packages/game/campaign-care-rules.js';
import { contractExpiresSeconds } from '../packages/game/contracts.js';
import { restRecovery } from '../packages/game/strategic-rest.ts';
import { careAssignmentReason } from '../packages/game/medical-care.js';
import { operativeLocation, operativeInTransit } from '../packages/game/squads.js';
import { worldOwner } from '../packages/game/world-cells.ts';
import { createFreshRouteOrders, freshRouteServingIds } from './fresh-route-orders.ts';

const clock = (c: CampaignSnapshot) => c.hour * 3600 + (c.secondOfHour ?? 0);

// A separate stable-wound phase after actual finite care. This does not seek
// supplies, treat acute wounds, resolve raids or change the doctor-care cap.
export function restRouteStableLocal(
  start: CampaignSnapshot,
  ids: readonly number[],
  { requireAwake = true, report = () => {} }: StableRestOptions = {},
) {
  assert.ok(
    Boolean(Array.isArray(ids)) &&
      new Set(ids).size === ids.length &&
      ids.every(Number.isSafeInteger),
    'Rest needs explicit distinct operative IDs.',
  );
  assert.equal(typeof requireAwake, 'boolean');
  const before = structuredClone(start),
    sector = start.location,
    orders: CampaignAction[] = [],
    ticks: RouteRestTick[] = [],
    bounds: RouteRestBound[] = [];
  const dead = Object.entries(start.operativeState)
    .filter(([, r]) => !r.alive)
    .map(([id]) => Number(id));
  let campaign = structuredClone(start),
    reason: string | null = null,
    boundHours = 0,
    zeroTime = 0;
  const stopped = () =>
    campaign.pendingEncounter
      ? 'pending-encounter'
      : campaign.pendingBattle
        ? 'pending-battle'
        : campaign.defeated
          ? 'campaign-defeated'
          : null;
  const check = () => {
    if (stopped()) {
      return stopped();
    }
    for (const id of dead) {
      if (campaign.operativeState[id]?.alive) {
        return 'An earlier death changed: ' + id + '.';
      }
    }
    for (const id of freshRouteServingIds(campaign)) {
      const r = present(campaign.operativeState[id]),
        contract = campaign.contracts[id],
        expiry = contractExpiresSeconds(contract);
      if (!contract || (expiry !== null && expiry <= clock(campaign))) {
        return 'Actual survivor ' + id + ' needs a current serving term.';
      }
      if (r.hp < 15 || r.bleeding > 0) {
        return 'Actual acute survivor ' + id + ' needs finite care before stable rest.';
      }
    }
    for (const id of ids) {
      const r = campaign.operativeState[id],
        op = rosterFor(campaign).find((op) => op.id === id);
      if (
        !op ||
        !r?.alive ||
        r.captured ||
        !campaign.recruited.includes(id) ||
        !campaign.contracts[id]
      ) {
        return 'Stable rest needs actual living serving patient ' + id + '.';
      }
      if (r.hp < 15 || r.bleeding > 0 || r.unconscious || r.routed) {
        return 'Stable rest refuses acute, unconscious or routed patient ' + id + '.';
      }
      if (operativeInTransit(campaign, id) || operativeLocation(campaign, id) !== sector) {
        return 'Stable rest needs local patient ' + id + '.';
      }
      if (
        worldOwner(campaign, sector) !== 'patriot' ||
        campaign.enemyGroups.some(
          (g) => g.target === sector && ['waiting', 'engaged', 'stationed'].includes(g.status),
        )
      ) {
        return 'Stable rest needs a safe controlled locality.';
      }
      const refusal = careAssignmentReason(campaign, op, 'rest');
      if (refusal) {
        return 'Stable rest for ' + id + ': ' + refusal;
      }
    }
    return null;
  };
  const recovered = () =>
    ids.every((id) => {
      const r = present(campaign.operativeState[id]);
      return (
        r.hp === r.maxHp &&
        (!requireAwake || (!r.asleep && r.energy >= 100 && (r.fatigue ?? 0) === 0))
      );
    });
  const finish = () => {
    assert.deepEqual(start, before, 'Stable rest must not mutate its caller input.');
    return {
      campaign,
      ready: !reason && recovered(),
      reason,
      orders,
      boundHours,
      bounds,
      ticks,
      elapsedSeconds: clock(campaign) - clock(start),
    };
  };
  reason = check();
  if (reason || !ids.length) {
    return finish();
  }
  if (recovered()) {
    return finish();
  }
  for (const id of ids) {
    const r = present(campaign.operativeState[id]),
      op = rosterFor(campaign).find((op) => op.id === id),
      deficit = Math.ceil(r.maxHp - r.hp),
      rate: RouteRestRate = restRecovery(present(op), r, campaign);
    const wound = Math.max(
      0,
      deficit * careRules(campaign).restHealingHours -
        (deficit && r.assignment === 'rest' ? (r.recoveryHours ?? 0) : 0),
    );
    if (
      requireAwake &&
      (((r.fatigue ?? 0) > 0 && rate.fatigue <= 0) || (r.energy < 100 && rate.energy <= 0))
    ) {
      reason = 'Actual rest rates cannot fund finite awake departure for ' + id + '.';
      return finish();
    }
    const awake = requireAwake
      ? Math.max(
          r.asleep ? 1 : 0,
          ((r.fatigue ?? 0) > 0 ? Math.ceil((r.fatigue ?? 0) / rate.fatigue) : 0) +
            (r.energy < 100 ? Math.ceil((100 - r.energy) / rate.energy) : 0),
        )
      : 0;
    bounds.push({ id, woundHours: wound, awakeHours: awake, rate });
    boundHours = Math.max(boundHours, wound, awake);
  }
  const observe = (event: FreshRouteOrderEvent) => {
    if (event.event === 'freshRouteOrder' || event.event === 'freshRouteRenewal') {
      orders.push(structuredClone(event.action));
    }
    report(structuredClone(event));
    // A renewal can itself release a deferred encounter. Stop before the
    // retained route helper can issue another renewal or its requested action.
    if (stopped()) {
      throw Error(present(stopped()));
    }
  };
  const route = createFreshRouteOrders(
    () => campaign,
    (next) => {
      campaign = next;
    },
    { report: observe },
  );
  const apply = (action: CampaignAction) => {
    try {
      route.order(action);
      reason = check();
      return !reason;
    } catch (error) {
      reason = stopped() ?? (error instanceof Error ? error.message : String(error));
      return false;
    }
  };
  for (const operativeId of ids) {
    if (
      present(campaign.operativeState[operativeId]).assignment !== 'rest' &&
      !apply({ type: 'assignCare', operativeId, assignment: 'rest' })
    ) {
      return finish();
    }
  }
  for (let attempt = 0; !recovered(); attempt++) {
    if (attempt >= boundHours * 4 + 4 || clock(campaign) - clock(start) >= boundHours * 3600) {
      reason = 'Stable rest reached its derived finite bound.';
      return finish();
    }
    const at = clock(campaign),
      prior = ids.map((id) => {
        const r = present(campaign.operativeState[id]);
        return {
          id,
          hp: r.hp,
          recoveryHours: r.recoveryHours,
          energy: r.energy,
          fatigue: r.fatigue,
          asleep: r.asleep,
        };
      });
    if (!apply({ type: 'wait', hours: 1 })) {
      return finish();
    }
    const elapsed = clock(campaign) - at;
    assert.ok(
      elapsed >= 0 && elapsed <= 3600,
      'A real rest wait cannot exceed its requested hour.',
    );
    const after = ids.map((id) => {
      const r = present(campaign.operativeState[id]);
      return {
        id,
        hp: r.hp,
        recoveryHours: r.recoveryHours,
        energy: r.energy,
        fatigue: r.fatigue,
        asleep: r.asleep,
      };
    });
    ticks.push({ elapsedSeconds: elapsed, before: prior, after });
    zeroTime = elapsed === 0 ? zeroTime + 1 : 0;
    if (zeroTime >= 3) {
      reason = 'Stable rest stopped after three consecutive zero-time notices.';
      return finish();
    }
    if (elapsed > 0 && JSON.stringify(prior) === JSON.stringify(after)) {
      reason = 'The actual rest tick made no recovery progress.';
      return finish();
    }
  }
  for (const operativeId of ids) {
    if (!apply({ type: 'assignCare', operativeId, assignment: 'active' })) {
      return finish();
    }
  }
  return finish();
}
