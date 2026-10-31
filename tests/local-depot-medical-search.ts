import assert from 'node:assert/strict';
import { dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import {
  operativeLocation,
  operativeInTransit,
  canReassignOperative,
} from '../packages/game/squads.js';
import { contractExpiresSeconds, contractRenewalQuote } from '../packages/game/contracts.js';
import { enterSector } from '../packages/game/world.js';
import {
  actBattle,
  canSee,
  getReachable,
  lootSearchPreview,
  lootPreview,
  lookPreview,
  climbPreview,
  stanceCost,
  movementStepCost,
} from '../packages/game/tactical.js';
import { nearbyLootOptions } from '../packages/game/ja2-hud.ts';
import { spacePoint, sameCell, sameSurface } from '../packages/game/tactical-space.js';
import { directionTo } from '../packages/game/tactical-awareness.js';
import { syncBattleTime } from '../packages/game/time.js';
import { publicRouteView } from './route-infantry-progress.ts';
import { visibleMedicalPatrolStep } from './route-visible-medical-remains.ts';

const clock = (c) => c.hour * 3600 + (c.secondOfHour ?? 0);
const fit = (r) =>
  r?.alive &&
  !r.captured &&
  r.hp === r.maxHp &&
  !r.bleeding &&
  !r.unconscious &&
  !r.routed &&
  !r.surrendered &&
  !r.asleep &&
  r.energy > 15;

// A local guard searches public map bounds, then returns to its real post.
// Unknown remains never select a waypoint, and only the hand UI reveals stock.
// This does not hire, travel, add a squad, or resolve an interrupted encounter.
export function searchLocalDepotDressings(
  start,
  { sector, operativeId, requested, deadlineSeconds, report = () => {} },
) {
  assert.ok(typeof sector === 'string' && Number.isSafeInteger(operativeId));
  assert.ok(
    Number.isSafeInteger(requested) && requested > 0 && Number.isSafeInteger(deadlineSeconds),
  );
  const before = structuredClone(start),
    selected = start.activeSquadId,
    cohort = start.recruited.filter(
      (id) => start.operativeState[id].alive && !start.operativeState[id].captured,
    );
  const startSeconds = clock(start),
    until = Math.min(deadlineSeconds, startSeconds + 3600),
    orders = [],
    renewals = [],
    collections = [],
    care = [],
    inspected = new Set();
  let campaign = start,
    battle = null,
    collected = 0,
    initial = null,
    returned = null,
    post = null,
    original = null,
    restored = false;
  const receipt = (reason) => ({
    sector,
    operativeId,
    requested,
    collected,
    reason,
    startSeconds,
    endSeconds: clock(campaign),
    deadlineSeconds,
    until,
    bounds: { seconds: 3600, actions: 600 },
    orders,
    renewals,
    collections,
    care,
    initial,
    returned,
    post,
    original,
    restored,
  });
  const result = (reason) => {
    assert.deepEqual(start, before);
    const evidence = receipt(reason);
    report({ event: 'localDepotMedicalSearch', receipt: evidence });
    return { campaign, battle, collected, reason, receipt: evidence };
  };
  const rememberCare = (old, next) => {
    const changes = cohort.flatMap((id) => {
      const a = old.operativeState[id],
        b = next.operativeState[id];
      return ['hp', 'bleeding', 'medkits'].some((key) => a[key] !== b[key])
        ? [
            {
              id,
              before: { hp: a.hp, bleeding: a.bleeding, medkits: a.medkits },
              after: { hp: b.hp, bleeding: b.bleeding, medkits: b.medkits },
            },
          ]
        : [];
    });
    if (clock(next) > clock(old)) {
      care.push({ from: clock(old), to: clock(next), changes });
    }
  };
  const check = () => {
    assert.equal(campaign.defeated, false, 'A local depot search stops on an actual defeat.');
    assert.ok(
      clock(campaign) <= until,
      'The actual depot search exceeds its retained hour or original clinical deadline.',
    );
    for (const id of cohort) {
      const r = campaign.operativeState[id],
        expiry = contractExpiresSeconds(campaign.contracts[id]);
      assert.ok(
        campaign.recruited.includes(id) && r.alive && !r.captured,
        'Keep every actual serving survivor during depot search.',
      );
      assert.ok(
        campaign.contracts[id] && (expiry === null || expiry > clock(campaign)),
        'Depot search cannot revive or lose actual service.',
      );
    }
    for (const [id, r] of Object.entries(before.operativeState)) {
      if (!r.alive) {
        assert.equal(
          campaign.operativeState[id].alive,
          false,
          'Depot search cannot restore a death.',
        );
      }
    }
  };
  const interrupted = () =>
    Boolean(
      campaign.pendingEncounter ||
      (battle &&
        (battle.mode !== 'exploration' || battle.status !== 'active' || battle.phase !== 'player')),
    );
  const order = (action, leaving = false) => {
    assert.ok(battle === null || (leaving && action.type === 'leaveSector'));
    check();
    const old = campaign,
      cash = campaign.resources.treasury;
    campaign = dispatchCampaign(campaign, action);
    orders.push({
      kind: 'campaign',
      action: structuredClone(action),
      from: clock(old),
      to: clock(campaign),
      cost: cash - campaign.resources.treasury,
    });
    rememberCare(old, campaign);
    if (leaving && campaign.pendingBattle === null) {
      battle = null;
    }
    assert.equal(campaign.lastError, null, JSON.stringify(action) + ': ' + campaign.lastError);
    check();
    return !campaign.pendingEncounter;
  };
  try {
    assert.equal(start.pendingBattle, null);
    assert.equal(start.pendingEncounter, null);
    assert.ok(until > startSeconds, 'The actual clinic has no search time left.');
    assert.equal(start.sectors[sector]?.owner, 'patriot');
    assert.equal(
      start.sectorStates[sector]?.sectorCleared,
      true,
      'Search only an actually secured depot.',
    );
    assert.ok(
      fit(start.operativeState[operativeId]) &&
        canReassignOperative(start, operativeId) &&
        !operativeInTransit(start, operativeId) &&
        operativeLocation(start, operativeId) === sector,
      'The depot search needs an actual fit free local guard.',
    );
    assert.ok(
      ['active', 'rest'].includes(start.operativeState[operativeId].assignment ?? 'active'),
      'Do not interrupt an actual medical or working duty to search.',
    );
    assert.ok(
      !start.militiaTraining?.some((row) => row.trainerId === operativeId),
      'Do not interrupt an actual militia course.',
    );
    const home = start.squads.find(
      (q) => q.location === sector && !q.journey && q.members.includes(operativeId),
    );
    assert.ok(home && home.members.length <= 6, "Use the guard's existing stationary local home.");
    assert.ok(
      home.members.every(
        (id) =>
          canReassignOperative(start, id) &&
          ['active', 'rest'].includes(start.operativeState[id].assignment ?? 'active'),
      ),
      'The existing home cannot deploy another actual medical or working duty.',
    );
    for (const id of cohort) {
      let expiry = contractExpiresSeconds(campaign.contracts[id]);
      for (let n = 0; expiry !== null && expiry <= until; n++) {
        assert.ok(n < 2);
        const contract = campaign.contracts[id],
          term = contract.term,
          quote = contractRenewalQuote(
            campaign,
            rosterFor(campaign).find((op) => op.id === id),
            term,
          );
        assert.equal(quote.available, true, quote.reason);
        const continued = order({
          type: 'renewContract',
          id,
          term,
          expectedExpiresAt: contract.expiresAt,
          expectedExpiresSecond: contract.expiresSecond ?? 0,
        });
        assert.equal(contractExpiresSeconds(campaign.contracts[id]), expiry + quote.hours * 3600);
        renewals.push({ id, quote: structuredClone(quote) });
        expiry = contractExpiresSeconds(campaign.contracts[id]);
        if (!continued) {
          return result('interrupted');
        }
      }
    }
    if (campaign.activeSquadId !== home.id && !order({ type: 'selectSquad', id: home.id })) {
      return result('interrupted');
    }
    if (home.members.length > 1 && !order({ type: 'squad', ids: [operativeId] })) {
      return result('interrupted');
    }
    const assignment = campaign.operativeState[operativeId].assignment ?? 'active';
    if (
      assignment !== 'active' &&
      !order({ type: 'assignCare', operativeId, assignment: 'active' })
    ) {
      return result('interrupted');
    }
    if (!order({ type: 'visitSector' })) {
      return result('interrupted');
    }
    battle = enterSector(campaign.pendingBattle, campaign.sectorStates[sector]);
    const synced = syncBattleTime(campaign, battle);
    assert.equal(synced.error, null);
    campaign = synced.campaign;
    battle = synced.battle;
    initial = structuredClone(battle);
    const unitId = String(operativeId),
      actor = () => battle.units.find((u) => u.id === unitId);
    assert.ok(
      actor() && !actor().mounted && fit({ ...actor(), alive: actor().hp > 0 }),
      'The actual depot visit needs the same fit unmounted guard.',
    );
    post = spacePoint(actor());
    const stored = start.operativeState[operativeId].residentPosition;
    if (stored) {
      assert.ok(sameCell(post, stored), "The actual entry must preserve the guard's stored post.");
    }
    original = {
      stance: actor().stance,
      movement: actor().movementMode,
      slot: actor().activeSlot,
      stealth: Boolean(actor().stealthMode),
      facing: actor().facing,
    };
    if (interrupted()) {
      return result('interrupted');
    }
    const battleActions = () => orders.filter((row) => row.kind === 'battle').length;
    // Quotes use copied public actors only. No forecast becomes the actual pair.
    const returnPlan = (point) => {
      const unit = { ...actor(), ...spacePoint(point) },
        view = publicRouteView(
          { ...battle, units: battle.units.map((other) => (other.id === unitId ? unit : other)) },
          unit,
        );
      if (sameCell(unit, post)) {
        return { path: [], seconds: 0 };
      }
      const route = getReachable(view, unit, { stopAt: (p) => sameCell(p, post) })[0];
      if (!route?.path.length) {
        return null;
      }
      let from = unit,
        seconds = 0;
      for (const step of route.path) {
        if (!sameSurface(from, step)) {
          const placed = { ...unit, ...spacePoint(from) },
            v = {
              ...view,
              units: view.units.map((other) => (other.id === unitId ? placed : other)),
            },
            q = climbPreview(v, placed, { linkId: step.linkId });
          if (!q.valid) {
            return null;
          }
          seconds += q.seconds;
        } else {
          seconds += 6;
        }
        from = step;
      }
      return { path: route.path, seconds };
    };
    const restorationSeconds = () =>
      Math.max(6, Math.ceil(stanceCost(actor(), original.stance) * 0.06)) + 12;
    const affordable = (seconds, point = actor()) => {
      const back = returnPlan(point);
      return Boolean(
        back &&
        clock(campaign) + seconds + back.seconds + restorationSeconds() <= until &&
        battleActions() + 1 + back.path.length + 5 <= 600,
      );
    };
    const perform = (action, seconds = 6) => {
      check();
      assert.ok(
        clock(campaign) + seconds <= until,
        'The next actual depot action exceeds its retained search/return time.',
      );
      assert.ok(battleActions() < 600, 'The actual depot search exhausted its action bound.');
      const old = campaign;
      battle = actBattle(battle, action);
      orders.push({ kind: 'battle', action: structuredClone(action), from: clock(old), cost: 0 });
      const pair = syncBattleTime(campaign, battle);
      assert.equal(pair.error, null, pair.error);
      campaign = pair.campaign;
      battle = pair.battle;
      orders.at(-1).to = clock(campaign);
      rememberCare(old, campaign);
      assert.equal(battle.lastError, null, JSON.stringify(action) + ': ' + battle.lastError);
      check();
      return !interrupted();
    };
    if (original.stealth && !perform({ type: 'stealth', unitId, enabled: false }, 0)) {
      return result('interrupted');
    }
    if (actor().movementMode !== 'walk' || actor().stance !== 'standing') {
      const seconds = Math.max(6, Math.ceil(stanceCost(actor(), 'standing') * 0.06));
      if (!affordable(seconds)) {
        return result('return-time-unavailable');
      }
      if (!perform({ type: 'movement', unitId, movement: 'walk' }, seconds)) {
        return result('interrupted');
      }
    }
    const xs = Array.from({ length: Math.ceil((battle.width - 6) / 6) }, (_, i) =>
        Math.min(battle.width - 2, 6 + i * 6),
      ),
      ys = Array.from({ length: Math.ceil((battle.height - 6) / 6) }, (_, i) =>
        Math.max(1, battle.height - 6 - i * 6),
      ),
      grid = ys.flatMap((y, row) =>
        (row % 2 ? [...xs].reverse() : xs).map((x) => ({ x, y, tacticalLevel: 0 })),
      ),
      directions = [
        [0, -2],
        [2, 0],
        [0, 2],
        [-2, 0],
      ];
    const nearest = grid.reduce(
        (best, p, index) =>
          Math.hypot(p.x - post.x, p.y - post.y) <
          Math.hypot(grid[best].x - post.x, grid[best].y - post.y)
            ? index
            : best,
        0,
      ),
      waypoints = [...grid.slice(nearest), ...grid.slice(0, nearest)];
    let waypoint = 0,
      looking = 0,
      stop = 'bounded-shortage';
    const moveStep = (step) => {
      const from = spacePoint(actor());
      let action, seconds;
      if (!sameSurface(actor(), step)) {
        const q = climbPreview(publicRouteView(battle, actor()), actor(), { linkId: step.linkId });
        if (!q.valid || q.pa > 20) {
          return 'blocked';
        }
        action = { type: 'climb', unitId, linkId: step.linkId };
        seconds = q.seconds;
      } else {
        if (movementStepCost(publicRouteView(battle, actor()), actor(), actor(), step) > 20) {
          return 'blocked';
        }
        action = { type: 'move', unitId, ...spacePoint(step) };
        seconds = 6;
      }
      if (!affordable(seconds, step)) {
        return 'return-reserve';
      }
      if (!perform(action, seconds)) {
        return 'interrupted';
      }
      if (sameCell(actor(), from)) {
        return 'blocked';
      }
      return 'moved';
    };
    for (let attempt = 0; collected < requested && attempt < 600; attempt++) {
      if (
        actor().hp < 15 ||
        actor().unconscious ||
        actor().routed ||
        actor().asleep ||
        actor().energy <= 20
      ) {
        stop = 'guard-needs-rest';
        break;
      }
      // Do not read a body's kit count until it is visible and actually at hand.
      const visible = [
        ...battle.units
          .filter(
            (body) =>
              body.id !== unitId &&
              canSee(battle, actor(), body) &&
              body.hp <= 0 &&
              !body.departure &&
              !body.fled,
          )
          .map((body) => ({ key: 'body:' + body.id, point: spacePoint(body) })),
        ...battle.groundItems
          .filter(
            (item) =>
              canSee(battle, actor(), item) && item.count > 0 && !item.heldBy && !item.containerId,
          )
          .map((item) => ({ key: 'ground:' + item.id, point: spacePoint(item) })),
      ]
        .filter((source) => !inspected.has(source.key))
        .map((source) => ({ ...source, quote: lootSearchPreview(battle, actor(), source.point) }))
        .filter((source) => source.quote.valid)
        .sort((a, b) => a.quote.movePa - b.quote.movePa || a.key.localeCompare(b.key));
      const source = visible[0];
      if (source) {
        if (source.quote.path.length) {
          const progress = moveStep(source.quote.path[0]);
          if (progress === 'interrupted') {
            return result(progress);
          }
          if (progress === 'return-reserve') {
            stop = progress;
            break;
          }
          if (progress === 'blocked') {
            inspected.add(source.key);
          }
          continue;
        }
        const option = nearbyLootOptions(battle, actor(), source.point).find(
          (row) =>
            row.action.item === 'medkits' || row.item === 'medkits' || row.type === 'medkits',
        );
        if (!option) {
          inspected.add(source.key);
          continue;
        }
        let count = Math.min(requested - collected, option.count);
        while (count && !lootPreview(battle, actor(), { ...option.action, count }).valid) {
          count--;
        }
        if (!count) {
          stop = 'carrying-capacity';
          break;
        }
        if (!affordable(6)) {
          stop = 'return-reserve';
          break;
        }
        const carried = actor().medkits,
          body =
            option.action.targetId && battle.units.find((u) => u.id === option.action.targetId),
          ground =
            option.action.groundId &&
            battle.groundItems.find((item) => item.id === option.action.groundId),
          stock = body?.medkits ?? ground?.count;
        const continuing = perform({ ...option.action, unitId, count });
        assert.equal(actor().medkits, carried + count);
        const remaining = body
          ? battle.units.find((u) => u.id === body.id)?.medkits
          : (battle.groundItems.find((item) => item.id === ground.id)?.count ?? 0);
        assert.equal(remaining, stock - count);
        const sourceKey =
          option.action.targetId !== undefined
            ? 'body:' + String(option.action.targetId)
            : 'ground:' + option.action.groundId;
        collected += count;
        collections.push({
          source: sourceKey,
          action: structuredClone(option.action),
          count,
          before: stock,
          after: remaining,
        });
        if (!continuing) {
          return result('interrupted');
        }
        continue;
      }
      if (looking < directions.length) {
        const [dx, dy] = directions[looking++],
          point = {
            x: Math.max(0, Math.min(battle.width - 1, actor().x + dx)),
            y: Math.max(0, Math.min(battle.height - 1, actor().y + dy)),
            tacticalLevel: actor().tacticalLevel ?? 0,
          };
        if (lookPreview(battle, actor(), point).valid) {
          if (!affordable(6)) {
            stop = 'return-reserve';
            break;
          }
          if (!perform({ type: 'look', unitId, ...point })) {
            return result('interrupted');
          }
        }
        continue;
      }
      if (waypoint >= waypoints.length) {
        break;
      }
      const target = waypoints[waypoint];
      // Sweep all directions at each public waypoint or new floor. Movement
      // already updates sight; four paid looks after every cell waste the bound.
      if (
        sameSurface(actor(), target) &&
        Math.hypot(actor().x - target.x, actor().y - target.y) <= 1
      ) {
        waypoint++;
        looking = 0;
        continue;
      }
      const step = visibleMedicalPatrolStep(battle, actor(), target)?.path[0];
      if (!step) {
        waypoint++;
        continue;
      }
      const from = spacePoint(actor()),
        progress = moveStep(step);
      if (progress === 'interrupted') {
        return result(progress);
      }
      if (progress === 'return-reserve') {
        stop = progress;
        break;
      }
      if (progress === 'blocked') {
        waypoint++;
      } else if (!sameSurface(from, actor())) {
        looking = 0;
      }
    }
    for (let n = 0; !sameCell(actor(), post) && n < 600; n++) {
      const back = returnPlan(actor());
      if (!back?.path.length) {
        return result('return-blocked');
      }
      const step = back.path[0],
        from = spacePoint(actor());
      const vertical = !sameSurface(actor(), step),
        q = vertical
          ? climbPreview(publicRouteView(battle, actor()), actor(), { linkId: step.linkId })
          : null;
      if (vertical && !q.valid) {
        return result('return-blocked');
      }
      if (
        !perform(
          vertical
            ? { type: 'climb', unitId, linkId: step.linkId }
            : { type: 'move', unitId, ...spacePoint(step) },
          vertical ? q.seconds : 6,
        )
      ) {
        return result('interrupted');
      }
      if (sameCell(actor(), from)) {
        return result('return-blocked');
      }
    }
    if (!sameCell(actor(), post)) {
      return result('return-blocked');
    }
    if (
      actor().movementMode !== original.movement &&
      !perform({ type: 'movement', unitId, movement: original.movement }, 6)
    ) {
      return result('interrupted');
    }
    if (
      actor().stance !== original.stance &&
      !perform(
        { type: 'stance', unitId, stance: original.stance },
        Math.max(6, Math.ceil(stanceCost(actor(), original.stance) * 0.06)),
      )
    ) {
      return result('interrupted');
    }
    if (original.stealth && !perform({ type: 'stealth', unitId, enabled: true }, 0)) {
      return result('interrupted');
    }
    if (actor().facing !== original.facing) {
      const target = [...battle.tiles, ...(battle.upperSurfaces ?? [])]
        .filter(
          (point) =>
            sameSurface(actor(), point) &&
            !sameCell(actor(), point) &&
            directionTo(actor(), point) === original.facing &&
            lookPreview(battle, actor(), point).valid,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - post.x, a.y - post.y) - Math.hypot(b.x - post.x, b.y - post.y) ||
            a.y - b.y ||
            a.x - b.x,
        )[0];
      if (!target) {
        return result('facing-restore-blocked');
      }
      if (!perform({ type: 'look', unitId, ...spacePoint(target) })) {
        return result('interrupted');
      }
    }
    assert.equal(
      actor().activeSlot,
      original.slot,
      "Searching must not replace the guard's actual hand.",
    );
    assert.equal(actor().movementMode, original.movement);
    assert.equal(actor().stance, original.stance);
    assert.equal(actor().facing, original.facing);
    returned = structuredClone(battle);
    const leave = {
      type: 'leaveSector',
      battleId: campaign.pendingBattle.id,
      sectorState: battle,
      survivors: battle.units.filter((u) => u.side === 'player'),
    };
    if (!order(leave, true)) {
      return result('interrupted');
    }
    if (home.members.length > 1 && !order({ type: 'squad', ids: [...home.members] })) {
      return result('interrupted');
    }
    if (assignment !== 'active' && !order({ type: 'assignCare', operativeId, assignment })) {
      return result('interrupted');
    }
    if (campaign.activeSquadId !== selected && !order({ type: 'selectSquad', id: selected })) {
      return result('interrupted');
    }
    assert.deepEqual(
      campaign.squads,
      start.squads,
      'The local search preserves every actual home and its members.',
    );
    assert.deepEqual(campaign.squad, start.squad);
    for (const id of cohort) {
      const old = start.operativeState[id],
        now = campaign.operativeState[id];
      assert.equal(now.assignment ?? 'active', old.assignment ?? 'active');
      if (old.residentPosition) {
        assert.deepEqual(
          now.residentPosition,
          old.residentPosition,
          'Every actual old post is retained.',
        );
      }
    }
    assert.ok(sameCell(campaign.operativeState[operativeId].residentPosition, post));
    restored = true;
    check();
    return result(collected >= requested ? 'fulfilled' : stop);
  } catch (error) {
    if (error?.campaign) {
      campaign = error.campaign;
    }
    if (error && typeof error === 'object') {
      error.campaign = campaign;
      error.battle = battle;
      error.localDepotMedicalSearch = { ...receipt('refused'), ...(battle ? { battle } : {}) };
      error.pair = { campaign, battle };
    }
    throw error;
  }
}
