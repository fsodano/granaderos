import { present } from './assert-present.ts';
import type { CampaignOperativeState, CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import type { TacticalAction, TacticalPoint } from '../packages/game/public/compatibility-types.ts';
import './assault-fixture.ts';
import assert from 'node:assert/strict';
import { dispatchCampaign, rosterFor, civicStatus } from '../packages/game/campaign.js';
import { isContractOperative } from '../packages/game/content-character-ids.ts';
import {
  contractQuote,
  contractRenewalQuote,
  contractExpiresSeconds,
  contractTermsFor,
} from '../packages/game/contracts.js';
import { hiringArrivalReason } from '../packages/game/hiring-arrivals.js';
import { immediateRecruitmentExpectation } from './immediate-recruitment-fixture.ts';
import {
  operativeLocation,
  operativeInTransit,
  canReassignOperative,
} from '../packages/game/squads.js';
import { carriedAmmunition } from '../packages/game/campaign-ammunition.js';
import { ammoTypeFor, ammoCount } from '../packages/game/ammo-types.js';
import { campaignRules } from '../packages/game/campaign-rules.js';
import { supplyRoom } from '../packages/game/personal-pockets.ts';
import { weaponSpecification } from '../packages/game/weapon-definition.ts';
import { enterSector } from '../packages/game/world.js';
import { actBattle, getReachable, climbPreview } from '../packages/game/tactical.js';
import { sameCell, sameSurface, spacePoint } from '../packages/game/tactical-space.js';
import { syncBattleTime } from '../packages/game/time.js';
import { publicRouteView } from './route-infantry-progress.ts';
import { quoteMountainServiceBudget } from './mountain-service-budget.ts';
import { recordRouteStrategicEvidence } from './route-strategic-failure-evidence.ts';
import type { ContractQuote } from '../packages/game/public/personnel-query-types.ts';

const clock = (c: CampaignSnapshot) => c.hour * 3600 + (c.secondOfHour ?? 0);
const fit = (body: CampaignOperativeState|undefined) =>
  body?.alive &&
  !body.captured &&
  body.hp === body.maxHp &&
  !body.bleeding &&
  !body.asleep &&
  !body.unconscious &&
  !body.routed &&
  !body.surrendered &&
  body.energy > 10;

// Fill the single vacant slot of a recovered five-person local reserve. The
// caller supplies the actual remaining care deadline and later service horizon.
// This makes no claim about a future raid or about tactical victory.
export function prepareNorthernHospitalSixPersonReserve(
  start: CampaignSnapshot,
  { sector, ids, deadlineSeconds, horizonSeconds, reservedPesos = 0, report = () => {} },
) {
  assert.ok(
    typeof sector === 'string' &&
      Array.isArray(ids) &&
      ids.length > 0 &&
      ids.length <= 6 &&
      new Set(ids).size === ids.length,
  );
  assert.ok(Number.isSafeInteger(deadlineSeconds) && deadlineSeconds >= clock(start));
  assert.ok(Number.isSafeInteger(horizonSeconds) && horizonSeconds >= deadlineSeconds);
  assert.ok(Number.isSafeInteger(reservedPesos) && reservedPesos >= 0);
  const before = structuredClone(start),
    selected = start.activeSquadId,
    originalServing = start.recruited.filter(
      (id) => start.operativeState[id]?.alive && !start.operativeState[id].captured,
    ),
    orders = [],
    renewals: { id: number; quote: ContractQuote; }[] = [],
    quotes = [];
  let c = start,
    battle = null,
    hire = null,
    visit = null,
    homeId: string|null = null,
    restored = false;
  const interrupted = () =>
    c.pendingEncounter
      ? 'pending-encounter'
      : c.pendingBattle
        ? 'pending-battle'
        : c.defeated
          ? 'campaign-defeated'
          : null;
  const local = (id: number) =>
    c.recruited.includes(id) &&
    !operativeInTransit(c, id) &&
    operativeLocation(c, id) === sector &&
    canReassignOperative(c, id);
  const check = () => {
    assert.ok(
      clock(c) <= deadlineSeconds,
      'The reserve preparation exceeds the existing absolute hospital deadline.',
    );
    assert.equal(
      c.sectors[sector]?.owner,
      'patriot',
      'The actual reserve sector must remain controlled.',
    );
    for (const id of originalServing) {
      const body = c.operativeState[id],
        expiry = contractExpiresSeconds(c.contracts[id]);
      assert.ok(
        present(body).alive &&
          !present(body).captured &&
          c.recruited.includes(id) &&
          c.contracts[id] &&
          (expiry === null || expiry > clock(c)),
        'Keep every original serving survivor and duty during reserve preparation.',
      );
    }
  };
  const finish = (reason: string|null) => {
    assert.deepEqual(start, before);
    const receipt = {
      sector,
      ids: [...ids],
      homeId,
      deadlineSeconds,
      horizonSeconds,
      reservedPesos,
      startSeconds: clock(start),
      endSeconds: clock(c),
      quotes,
      hire,
      orders,
      renewals,
      visit,
      restored,
    };
    const result = {
      campaign: c,
      battle,
      ready: !reason,
      reason: reason ?? null,
      reliefId: hire?.id ?? null,
      receipt,
    };
    report({ event: 'northernHospitalSixPersonReserve', ...structuredClone(result) });
    return result;
  };
  const order = (action: CampaignAction) => {
    assert.equal(battle, null);
    assert.equal(
      interrupted(),
      null,
      'Return the actual reserve interruption before another order.',
    );
    check();
    if (action.type === 'wait') {
      assert.ok(
        clock(c) + action.hours * 3600 <= deadlineSeconds,
        'The next paid arrival hour exceeds the existing hospital deadline.',
      );
    }
    const from = clock(c),
      cash = c.resources.treasury;
    c = dispatchCampaign(c, action);
    orders.push({
      kind: 'campaign',
      action: structuredClone(action),
      from,
      to: clock(c),
      cost: cash - c.resources.treasury,
    });
    assert.equal(c.lastError, null, JSON.stringify(action) + ': ' + c.lastError);
    check();
    return interrupted();
  };
  const retain = (until: number) => {
    for (const id of originalServing) {
      let expiry = contractExpiresSeconds(c.contracts[id]);
      for (let n = 0; expiry !== null && expiry <= until; n++) {
        assert.ok(n < 64, 'The explicit reserve service horizon must be finite.');
        const current = c.contracts[id],
          quote = contractRenewalQuote(
            c,
            rosterFor(c).find((op) => op.id === id),
            'day',
          );
        assert.equal(quote.available, true, quote.reason);
        const budget = quoteMountainServiceBudget(c, {
          keepIds: originalServing,
          horizonSeconds: until,
          fixedCost: reservedPesos + (hire ? 0 : plannedHireCost),
        });
        assert.equal(budget.available, true, budget.reason);
        const stop = order({
          type: 'renewContract',
          id,
          term: 'day',
          expectedExpiresAt: present(current).expiresAt,
          expectedExpiresSecond: present(current).expiresSecond ?? 0,
        });
        renewals.push({ id, quote: structuredClone(quote) });
        assert.equal(contractExpiresSeconds(c.contracts[id]), expiry + present(quote.hours) * 3600);
        if (stop) {
          return stop;
        }
        expiry = contractExpiresSeconds(c.contracts[id]);
      }
    }
    return null;
  };
  let plannedHireCost = 0;
  try {
    if (interrupted()) {
      return finish(interrupted());
    }
    check();
    assert.ok(
      ids.every(
        (id) =>
          local(id) &&
          fit(c.operativeState[id]) &&
          ['active', 'rest'].includes(present(c.operativeState[id]).assignment),
      ),
      'The original reserve must be actually local, free, fully recovered and awake.',
    );
    const home = c.squads.find(
      (q) =>
        q.location === sector &&
        !q.journey &&
        q.members.length === ids.length &&
        q.members.every((id) => ids.includes(id)),
    );
    assert.ok(home, 'Keep the actual complete local reserve in its existing home.');
    homeId = home.id;
    if (ids.length === 6) {
      restored = true;
      return finish(null);
    }
    if (ids.length !== 5) {
      return finish('single-vacancy-required');
    }
    const posts = ids.map((id) => ({
      id,
      position: structuredClone(present(c.operativeState[id]).residentPosition),
    }));
    assert.ok(
      posts.every((row) => present(row.position?.tacticalLevel) > 0),
      'The single vacancy follows actual paid preparation of the five existing roof posts.',
    );
    const admission = hiringArrivalReason(c, sector);
    if (admission) {
      return finish(admission);
    }
    const now = clock(c),
      roster = rosterFor(c),
      terms = Object.keys(contractTermsFor(c));
    const candidates = roster
      .filter(
        (op) =>
          isContractOperative(c, op) &&
          civicStatus(c, op.id).available &&
          fit(c.operativeState[op.id]),
      )
      .flatMap((op) => {
        const body = c.operativeState[op.id],
          unit = carriedAmmunition(op, body),
          family = ammoTypeFor(unit),
          weapon = weaponSpecification(unit);
        if (
          !weapon?.capacity ||
          family === 'ammoPistol' ||
          !family ||
          unit.weaponDropped ||
          present(unit.condition) <= 0
        ) {
          return [];
        }
        // This is the Native first-hire allowance quote. It does not issue stock;
        // the real hire below must later return those actual finite cartridges.
        const allowance =
          present(body).startingCartridgesIssued === false
            ? Math.min(
                campaignRules(c).deploymentCartridges,
                supplyRoom(unit, family, campaignRules(c).deploymentCartridges),
              )
            : 0;
        const cartridges = (unit.loaded ?? 0) + ammoCount(unit, family) + allowance;
        if (!cartridges) {
          return [];
        }
        const due = now;
        if (due + 3600 > deadlineSeconds) {
          return [];
        }
        const choices = terms
          .map((term) => ({ term, quote: contractQuote(c, op, term) }))
          .filter(
            ({ quote }) =>
              quote.available &&
              !quote.permanent &&
              present(quote.hours) > 0 &&
              due + present(quote.hours) * 3600 > horizonSeconds,
          )
          .sort((a, b) => a.quote.total - b.quote.total || present(a.quote.hours) - present(b.quote.hours));
        if (!choices.length) {
          return [];
        }
        const { term, quote } = choices[0],
          budget = quoteMountainServiceBudget(c, {
            keepIds: originalServing,
            horizonSeconds,
            fixedCost: reservedPesos + quote.total,
          });
        const row = {
          id: op.id,
          marksmanship: op.marksmanship,
          weapon: unit.weapon,
          family,
          cartridges,
          allowance,
          term,
          quote: structuredClone(quote),
          arrival: immediateRecruitmentExpectation(c, op, term, quote, sector),
          budget,
        };
        quotes.push(row);
        return [row];
      })
      .sort(
        (a, b) => b.marksmanship - a.marksmanship || a.quote.total - b.quote.total || a.id - b.id,
      );
    const chosen = candidates.find((row) => row.budget.available);
    if (!chosen) {
      return finish(
        candidates.length
          ? 'insufficient-joint-service-budget'
          : 'no-current-supplied-rifleman-within-deadline',
      );
    }
    plannedHireCost = chosen.quote.total;
    const stop = retain(horizonSeconds);
    if (stop) {
      return finish(stop);
    }
    const op = rosterFor(c).find((row) => row.id === chosen.id),
      currentQuote = contractQuote(c, op, chosen.term);
    assert.deepEqual(
      currentQuote,
      chosen.quote,
      'Requote the actual hire after retaining the original service.',
    );
    const budget = quoteMountainServiceBudget(c, {
      keepIds: originalServing,
      horizonSeconds,
      fixedCost: reservedPesos + currentQuote.total,
    });
    assert.equal(budget.available, true, budget.reason);
    hire = {
      id: present(op).id,
      term: chosen.term,
      quote: structuredClone(currentQuote),
      arrival: immediateRecruitmentExpectation(c, op, chosen.term, currentQuote, sector),
    };
    if (order({ type: 'recruitCivic', id: present(op).id, term: chosen.term, destination: sector })) {
      return finish(interrupted());
    }
    assert.equal(orders.at(-1).cost, currentQuote.total);
    assert.ok(c.recruited.includes(present(op).id));
    assert.equal(
      c.hiringArrivals.some((row) => row.operativeId === present(op).id),
      false,
    );
    assert.ok(local(present(op).id) && fit(c.operativeState[present(op).id]));
    assert.ok(present(contractExpiresSeconds(c.contracts[op.id])) > horizonSeconds);
    const issued = carriedAmmunition(
      rosterFor(c).find((row) => row.id === present(op).id),
      c.operativeState[present(op).id],
    );
    hire.issued = {
      cartridges: (issued.loaded ?? 0) + ammoCount(issued, ammoTypeFor(issued)),
      medkits: present(c.operativeState[op.id]).medkits,
    };
    assert.ok(
      hire.issued.cartridges > 0,
      'The paid arrival must actually own its finite compatible cartridges.',
    );
    const until = Math.min(deadlineSeconds, clock(c) + 3600),
      assignments = Object.fromEntries(ids.map((id) => [id, present(c.operativeState[id]).assignment]));
    if (c.activeSquadId !== homeId && order({ type: 'selectSquad', id: homeId })) {
      return finish(interrupted());
    }
    // Reuse this home at the eight-squad cap. The existing five stay at their
    // real posts and duties while only the new paid body takes its own visit.
    if (order({ type: 'squad', ids: [present(op).id] })) {
      return finish(interrupted());
    }
    if (order({ type: 'assignCare', operativeId: present(op).id, assignment: 'active' })) {
      return finish(interrupted());
    }
    if (order({ type: 'visitSector' })) {
      if (c.pendingBattle && !c.pendingEncounter) {
        /* This is the intended new visit. */
      } else {
        return finish(interrupted());
      }
    }
    battle = enterSector(c.pendingBattle, c.sectorStates[sector]);
    let pair = syncBattleTime(c, battle);
    assert.equal(pair.error, null);
    c = pair.campaign;
    battle = pair.battle;
    const initial = structuredClone(battle),
      unitId = String(present(op).id),
      steps = [],
      actor = () => battle.units.find((unit: { id: string; }) => unit.id === unitId);
    visit = { initial, steps, approach: null, returned: null, post: null };
    // Native retains earlier casualties in the scene. They are not new arrivals.
    assert.deepEqual(
      present(c.pendingBattle).squad.map((unit) => String(unit.id)),
      [unitId],
      'Only the paid relief body is issued this roof staging visit.',
    );
    assert.deepEqual(
      battle.units.filter((unit) => unit.side === 'player' && unit.hp > 0).map((unit) => unit.id),
      [unitId],
      'Only the paid relief body is a living player in this solo visit.',
    );
    const act = (action: TacticalAction, seconds: number|undefined) => {
      check();
      assert.equal(c.pendingEncounter, null);
      assert.equal(battle.mode, 'exploration');
      assert.equal(battle.phase, 'player');
      assert.equal(battle.status, 'active');
      assert.ok(
        clock(c) + present(seconds) <= until,
        'The next real staging action exceeds its paid hour or original deadline.',
      );
      const from = clock(c);
      battle = actBattle(battle, action);
      orders.push({ kind: 'battle', action: structuredClone(action), from });
      steps.push(structuredClone(action));
      assert.equal(battle.lastError, null, JSON.stringify(action) + ': ' + battle.lastError);
      pair = syncBattleTime(c, battle);
      assert.equal(pair.error, null);
      c = pair.campaign;
      battle = pair.battle;
      Object.assign(orders.at(-1), { to: clock(c), cost: 0 });
      check();
      assert.ok(
        clock(c) <= until,
        'The actual synchronized staging clock must remain inside its paid hour.',
      );
      return c.pendingEncounter
        ? 'pending-encounter'
        : battle.mode !== 'exploration' || battle.phase !== 'player' || battle.status !== 'active'
          ? 'tactical-interruption'
          : null;
    };
    if (actor().stance !== 'standing' || actor().movementMode !== 'walk') {
      if (act({ type: 'movement', unitId, movement: 'walk' }, 6)) {
        return finish('tactical-interruption');
      }
    }
    let movementSteps = 0;
    const moveTo = (goal: TacticalPoint, { groundOnly = false } = {}) => {
      for (; !sameCell(actor(), goal) && movementSteps < 128; movementSteps++) {
        const current = publicRouteView(battle, actor()),
          route = getReachable(current, actor(), { stopAt: (point) => sameCell(point, goal) })[0];
        assert.ok(
          route?.path.length &&
            route.path.every((step) => !posts.some((post) => sameCell(post.position, step))),
          'The actual paid path must not cross an old reserved post.',
        );
        if (groundOnly) {
          assert.ok(
            route.path.every((step) => (step.tacticalLevel ?? 0) === 0),
            'The alternative public access needs an actual ground approach.',
          );
        }
        const step = route.path[0],
          from = spacePoint(actor());
        if (!sameSurface(actor(), step)) {
          const quote = climbPreview(current, actor(), { linkId: present(step).linkId });
          assert.equal(quote.valid, true, quote.reason);
          if (act({ type: 'climb', unitId, linkId: present(step).linkId }, quote.seconds)) {
            return 'tactical-interruption';
          }
        }
        // Native tactical.js uses ceil(3 * stealth<=1.25 * diagonal<=1.4)
        // seconds for one ordinary forward WALK step: at most six real seconds.
        else if (act({ type: 'move', unitId, ...spacePoint(step) }, 6)) {
          return 'tactical-interruption';
        }
        assert.notDeepEqual(
          spacePoint(actor()),
          from,
          'Every actual roof step must make physical progress.',
        );
      }
      assert.ok(
        sameCell(actor(), goal),
        'The original 128-step bound covers the complete approach and roof path.',
      );
      return null;
    };
    const chooseRoof = (points) =>
      points
        .filter(
          (point) =>
            point.tacticalLevel > 0 &&
            !posts.some((post) => sameCell(post.position, point)) &&
            point.path.every((step) => !posts.some((post) => sameCell(post.position, step))),
        )
        .map((point: TacticalPoint) => ({
          ...point,
          near: posts.filter(
            (post) =>
              sameSurface(post.position, point) &&
              Math.hypot(present(post.position).x - point.x, present(post.position).y - point.y) <= 1.5,
          ).length,
        }))
        .filter((point: { near: number; }) => point.near > 0)
        .sort((a: { near: number; cost: number; y: number; x: number; }, b: { near: number; cost: number; y: number; x: number; }) => b.near - a.near || a.cost - b.cost || a.y - b.y || a.x - b.x)[0];
    let reachable = getReachable(publicRouteView(battle, actor()), actor()),
      destination = chooseRoof(reachable);
    if (!destination && (actor().tacticalLevel ?? 0) === 0) {
      // A shortest roof path can cross an old saved post. Pay one alternative
      // public ground approach, then quote the climb only from actual arrival.
      const access = (battle.climbLinks ?? [])
        .filter(
          (link) =>
            (link.from.tacticalLevel ?? 0) === 0 &&
            present(link.to.tacticalLevel) > 0 &&
            !posts.some((post) => sameCell(post.position, link.to)),
        )
        .map((link) => ({
          link,
          route: reachable.find((point) => sameCell(point, link.from)),
          landing: reachable.find((point) => sameCell(point, link.to)),
        }))
        .filter(
          (row) =>
            row.route &&
            row.landing &&
            row.route.path.every(
              (step) =>
                (step.tacticalLevel ?? 0) === 0 &&
                !posts.some((post) => sameCell(post.position, step)),
            ),
        )
        .sort((a, b) => present(a.route).cost - present(b.route).cost || a.link.id.localeCompare(b.link.id))[0];
      if (access) {
        visit.approach = {
          link: structuredClone(access.link),
          groundQuote: structuredClone(access.route),
          arrivedAt: null,
          climbQuote: null,
          completed: false,
        };
        const stop = moveTo(access.link.from, { groundOnly: true });
        if (stop) {
          return finish(stop);
        }
        present(visit.approach).arrivedAt = spacePoint(actor());
        const quote = climbPreview(publicRouteView(battle, actor()), actor(), {
          linkId: access.link.id,
        });
        present(visit.approach).climbQuote = structuredClone(quote);
        assert.ok(
          quote.valid && sameCell(quote.destination, access.link.to),
          'The alternative access needs a fresh Native climb quote from actual arrival.',
        );
        assert.ok(movementSteps < 128);
        movementSteps++;
        if (act({ type: 'climb', unitId, linkId: access.link.id }, quote.seconds)) {
          return finish('tactical-interruption');
        }
        assert.ok(sameCell(actor(), access.link.to));
        present(visit.approach).completed = true;
        reachable = getReachable(publicRouteView(battle, actor()), actor());
        destination = chooseRoof(reachable);
      }
    }
    if (!destination) {
      recordRouteStrategicEvidence({
        helper: 'prepareNorthernHospitalSixPersonReserve',
        stage: 'roof-admission-refusal',
        campaign: c,
        context: {
          battle,
          oldPosts: posts,
          currentActor: actor(),
          reachableCandidates: reachable,
          filterReasons: reachable.map((point) => ({
            point: spacePoint(point),
            cost: point.cost,
            belowRoof: !(present(point.tacticalLevel) > 0),
            occupiedSavedPost: posts.some((post) => sameCell(post.position, point)),
            crossesSavedPost: point.path.some((step) =>
              posts.some((post) => sameCell(post.position, step)),
            ),
            noAdjacentSavedPost: !posts.some(
              (post) =>
                sameSurface(post.position, point) &&
                Math.hypot(present(post.position).x - point.x, present(post.position).y - point.y) <= 1.5,
            ),
          })),
          homeId,
          ids,
          deadlineSeconds,
          horizonSeconds,
          until,
          hire,
          orders,
          renewals,
          visit,
          scope:
            'Actual current campaign and battle before the unchanged admission assertion; the existing reachable result is observed once, with no additional Native query, order or synchronization.',
        },
      });
    }
    assert.ok(
      destination,
      'The new rifleman needs a real vacant reachable roof post beside the existing reserve.',
    );
    const roofStop = moveTo(destination);
    if (roofStop) {
      return finish(roofStop);
    }
    if (actor().stance !== 'crouched') {
      if (act({ type: 'stance', unitId, stance: 'crouched' }, 6)) {
        return finish('tactical-interruption');
      }
    }
    const returned = structuredClone(battle),
      action = {
        type: 'leaveSector',
        battleId: present(c.pendingBattle).id,
        sectorState: battle,
        survivors: battle.units.filter((unit) => unit.side === 'player'),
      },
      from = clock(c),
      cash = c.resources.treasury;
    c = dispatchCampaign(c, action);
    orders.push({
      kind: 'campaign',
      action: structuredClone(action),
      from,
      to: clock(c),
      cost: cash - c.resources.treasury,
    });
    assert.equal(c.lastError, null, JSON.stringify(action) + ': ' + c.lastError);
    battle = null;
    check();
    if (interrupted()) {
      return finish(interrupted());
    }
    visit = { ...visit, returned, post: structuredClone(present(c.operativeState[op.id]).residentPosition) };
    if (order({ type: 'squad', ids: [...ids, present(op).id] })) {
      return finish(interrupted());
    }
    if (order({ type: 'assignCare', operativeId: present(op).id, assignment: 'rest' })) {
      return finish(interrupted());
    }
    if (c.activeSquadId !== selected && order({ type: 'selectSquad', id: selected })) {
      return finish(interrupted());
    }
    for (const post of posts) {
      assert.deepEqual(
        present(c.operativeState[post.id]).residentPosition,
        post.position,
        'Each original reserve member keeps its exact actual paid roof post.',
      );
      assert.equal(present(c.operativeState[post.id]).assignment, assignments[post.id]);
      assert.ok(fit(c.operativeState[post.id]));
    }
    for (const group of start.squads) {
      const current = c.squads.find((row) => row.id === group.id);
      assert.ok(current);
      assert.deepEqual(
        current.members,
        group.id === homeId ? [...ids, present(op).id] : group.members,
        'Keep the original return and rear duties in their actual groups.',
      );
      assert.equal(current.location, group.location);
      assert.deepEqual(current.journey, group.journey);
    }
    assert.equal(c.squads.length, start.squads.length);
    assert.equal(c.activeSquadId, selected);
    assert.ok(c.squads.every((group) => group.members.length <= 6));
    for (const [id, body] of Object.entries(start.operativeState)) {
      if (!body.alive) {
        assert.equal(c.operativeState[id].alive, false);
        assert.equal(c.operativeState[id].deathMinute, body.deathMinute);
      }
    }
    const final = carriedAmmunition(
      rosterFor(c).find((row) => row.id === present(op).id),
      c.operativeState[present(op).id],
    );
    assert.ok(
      local(present(op).id) && fit(c.operativeState[present(op).id]),
      'The sixth actual reserve member must remain local, living and fully ready after its paid visit.',
    );
    assert.equal(
      (final.loaded ?? 0) + ammoCount(final, ammoTypeFor(final)),
      hire.issued.cartridges,
    );
    assert.equal(present(c.operativeState[op.id]).medkits, hire.issued.medkits);
    check();
    restored = true;
    return finish(null);
  } catch (error) {
    if (error?.campaign) {
      c = error.campaign;
    }
    if (error && typeof error === 'object') {
      error.campaign = c;
      error.battle = battle;
      error.pair = { campaign: c, battle };
      error.hospitalSixPersonReserve = {
        sector,
        ids,
        homeId,
        deadlineSeconds,
        horizonSeconds,
        quotes,
        hire,
        orders,
        renewals,
        visit,
        restored: false,
        battle,
      };
      recordRouteStrategicEvidence({
        helper: 'prepareNorthernHospitalSixPersonReserve',
        stage: 'preparation-failure',
        campaign: c,
        context: error.hospitalSixPersonReserve,
        error,
      });
    }
    throw error;
  }
}
