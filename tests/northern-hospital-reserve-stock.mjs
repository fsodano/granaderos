import assert from 'node:assert/strict';
import { dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import { operativeLocation, operativeInTransit } from '../packages/game/squads.js';
import { careAssignmentIssue } from '../packages/game/medical-care.js';
import { contractExpiresSeconds, contractRenewalQuote } from '../packages/game/contracts.js';
import { sectorInventoryModel } from '../packages/game/sector-inventory.js';
import { applyItemQuantity } from '../packages/game/tactical-inventory.js';
import { enterSector } from '../packages/game/world.js';
import {
  actBattle,
  getReachable,
  climbPreview,
  containerLootPreview,
  lookPreview,
  stanceCost,
  actionCosts,
  transferPreview,
} from '../packages/game/tactical.js';
import { sameCell, sameSurface, spacePoint } from '../packages/game/tactical-space.js';
import { syncBattleTime } from '../packages/game/time.js';
import { publicRouteView } from './route-infantry-progress.mjs';

const clock = (c) => c.hour * 3600 + (c.secondOfHour ?? 0);

// Use only linen already disclosed in an open local container. This is a
// finite pool, not a minimum stock requirement or a new medical allowance.
// A real doctor collects from and returns to its actual paid roof post.
export function prepareNorthernHospitalReserveStock(
  start,
  { sector, ids, deadlineSeconds, report = () => {} },
) {
  assert.ok(
    Array.isArray(ids) &&
      ids.length &&
      new Set(ids).size === ids.length &&
      Number.isSafeInteger(deadlineSeconds),
  );
  const before = structuredClone(start),
    selected = start.activeSquadId,
    orders = [],
    renewals = [],
    collections = [],
    transfers = [],
    visits = [],
    capacity = [];
  let c = start,
    battle = null;
  const local = (id) =>
    c.recruited.includes(id) &&
    c.operativeState[id]?.alive &&
    !c.operativeState[id].captured &&
    !operativeInTransit(c, id) &&
    operativeLocation(c, id) === sector;
  const check = () => {
    assert.equal(c.defeated, false);
    assert.equal(c.sectors[sector]?.owner, 'patriot');
    assert.ok(
      clock(c) <= deadlineSeconds,
      'Finite reserve collection must stay inside the original hospital deadline.',
    );
    assert.equal(c.pendingEncounter, null, 'A real encounter stops finite reserve collection.');
    assert.ok(
      ids.every(
        (id) =>
          local(id) &&
          c.operativeState[id].hp === c.operativeState[id].maxHp &&
          !c.operativeState[id].bleeding,
      ),
      'Keep every actual recovered reserve alive, serving and fully healed.',
    );
  };
  const order = (action) => {
    assert.equal(battle, null);
    check();
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
  };
  const retain = (until) => {
    for (const id of c.recruited) {
      if (!c.operativeState[id].alive || c.operativeState[id].captured) {
        continue;
      }
      let expiry = contractExpiresSeconds(c.contracts[id]);
      assert.ok(
        expiry === null || expiry > clock(c),
        'Reserve collection cannot revive expired service.',
      );
      for (let n = 0; expiry !== null && expiry <= until; n++) {
        assert.ok(n < 2);
        const contract = c.contracts[id],
          quote = contractRenewalQuote(
            c,
            rosterFor(c).find((op) => op.id === id),
            'day',
          );
        assert.equal(quote.available, true, quote.reason);
        order({
          type: 'renewContract',
          id,
          term: 'day',
          expectedExpiresAt: contract.expiresAt,
          expectedExpiresSecond: contract.expiresSecond ?? 0,
        });
        assert.equal(contractExpiresSeconds(c.contracts[id]), expiry + quote.hours * 3600);
        renewals.push({ id, quote: structuredClone(quote) });
        expiry = contractExpiresSeconds(c.contracts[id]);
      }
    }
  };
  try {
    check();
    assert.equal(c.pendingBattle, null);
    assert.ok(ids.every((id) => !c.operativeState[id].asleep && c.operativeState[id].energy > 10));
    const posts = ids.map((id) => ({
      id,
      position: structuredClone(c.operativeState[id].residentPosition),
    }));
    assert.ok(
      posts.every((row) => row.position?.tacticalLevel > 0),
      'Finite reserve collection follows actual paid roof preparation.',
    );
    const doctors = rosterFor(c)
      .filter(
        (op) =>
          ids.includes(op.id) &&
          [undefined, 'no_medkits'].includes(careAssignmentIssue(c, op, 'doctor')?.code),
      )
      .sort((a, b) => b.medical - a.medical || a.id - b.id)
      .slice(0, 2)
      .map((op) => op.id);
    const models = new Map(
      doctors.map((id) => [id, sectorInventoryModel(c, sector, rosterFor(c), id)]),
    );
    const rows = new Map();
    for (const id of doctors) {
      const model = models.get(id);
      assert.equal(model.operativeId, id);
      assert.equal(model.reason, null, model.reason);
      for (const row of model.entries.filter(
        (row) =>
          row.kind === 'container' && row.reachable && JSON.parse(row.expected).item === 'medkits',
      )) {
        const chest = c.sectorStates[sector].props.find((prop) =>
          row.key.startsWith(`container:${prop.id}:`),
        );
        assert.ok(chest?.knownToPlayer && chest.open && !chest.locked);
        rows.set(row.key, {
          key: row.key,
          chestId: chest.id,
          count: row.count,
          stack: JSON.parse(row.expected),
        });
      }
    }
    const projected = new Map(doctors.map((id) => [id, models.get(id).personal])),
      plan = new Map(doctors.map((id) => [id, []]));
    for (const row of rows.values()) {
      for (let n = 0; n < row.count; n++) {
        const candidates = doctors
          .filter((id) =>
            models.get(id).entries.some((entry) => entry.key === row.key && entry.reachable),
          )
          .sort(
            (a, b) =>
              projected.get(a).medkits - projected.get(b).medkits ||
              doctors.indexOf(a) - doctors.indexOf(b),
          );
        let recipient;
        for (const id of candidates) {
          try {
            const next = applyItemQuantity(projected.get(id), { ...row.stack, count: 1 });
            projected.set(id, next);
            recipient = id;
            break;
          } catch (error) {
            if (!capacity.some((entry) => entry.id === id)) {
              capacity.push({ id, reason: error.message });
            }
          }
        }
        if (recipient === undefined) {
          break;
        }
        const prior = plan.get(recipient).find((entry) => entry.key === row.key);
        if (prior) {
          prior.count++;
        } else {
          plan.get(recipient).push({ ...row, count: 1 });
        }
      }
    }
    for (const id of doctors) {
      if (!plan.get(id).length) {
        continue;
      }
      check();
      const home = c.squads.find(
        (q) => q.location === sector && !q.journey && q.members.includes(id),
      );
      assert.ok(
        home && home.members.length <= 6 && home.members.every((member) => ids.includes(member)),
        'A reserve physician keeps an existing local reserve squad without interrupting other duties.',
      );
      const assignments = home.members.map((id) => ({
        id,
        assignment: c.operativeState[id].assignment,
      }));
      const until = Math.min(deadlineSeconds, clock(c) + 3600);
      retain(until);
      if (c.activeSquadId !== home.id) {
        order({ type: 'selectSquad', id: home.id });
      }
      for (const row of assignments) {
        order({ type: 'assignCare', operativeId: row.id, assignment: 'active' });
      }
      order({ type: 'visitSector' });
      battle = enterSector(c.pendingBattle, c.sectorStates[sector]);
      const synced = syncBattleTime(c, battle);
      assert.equal(synced.error, null);
      c = synced.campaign;
      battle = synced.battle;
      const initial = structuredClone(battle),
        beneficiary = battle.units.find((u) => u.id === String(id)),
        allocation = plan.get(id),
        count = allocation.reduce((n, row) => n + row.count, 0),
        steps = [];
      assert.ok(
        beneficiary && !beneficiary.mounted,
        'The actual physician must be admitted at its real local roof post.',
      );
      const pickupGoal = (view, unit, row) => {
        const chest = view.props.find((prop) => prop.id === row.chestId);
        return (
          chest &&
          getReachable(view, unit)
            .filter((p) => sameSurface(p, chest) && Math.hypot(p.x - chest.x, p.y - chest.y) <= 1.5)
            .sort((a, b) => a.cost - b.cost || a.y - b.y || a.x - b.x)[0]
        );
      };
      const pickupRoute = (unit) => {
        const walking = { ...unit, stance: 'standing', movementMode: 'walk', stealthMode: false },
          view = publicRouteView(
            {
              ...battle,
              units: battle.units.map((other) => (other.id === unit.id ? walking : other)),
            },
            walking,
          );
        return allocation.every((row) => pickupGoal(view, walking, row));
      };
      let collector = beneficiary;
      if (!pickupRoute(collector)) {
        collector = doctors
          .filter((other) => other !== id && home.members.includes(other))
          .map((other) => battle.units.find((u) => u.id === String(other)))
          .find((unit) => {
            if (
              !unit ||
              unit.hp < 15 ||
              unit.unconscious ||
              unit.routed ||
              unit.departure ||
              unit.fled ||
              unit.surrendered ||
              unit.asleep ||
              unit.mounted ||
              unit.energy <= 10 ||
              !pickupRoute(unit)
            ) {
              return false;
            }
            let carried = unit;
            try {
              for (const row of allocation) {
                carried = applyItemQuantity(carried, { ...row.stack, count: row.count });
              }
            } catch {
              return false;
            }
            const quote = transferPreview(battle, carried, beneficiary, 'medkits', count);
            return (
              quote.valid &&
              quote.kind === 'give' &&
              quote.chance === 100 &&
              quote.route.length === 2
            );
          });
      }
      assert.ok(
        collector,
        'An actual qualified reserve doctor needs a paid pickup path and direct roof handoff for this finite allocation.',
      );
      const unitId = collector.id,
        post = posts.find((row) => String(row.id) === unitId).position,
        actor = () => battle.units.find((u) => u.id === unitId);
      assert.ok(actor() && !actor().mounted);
      assert.ok(
        sameCell(actor(), post),
        'The Native visit must admit the actual saved physician post.',
      );
      const original = {
        stance: actor().stance,
        movement: actor().movementMode,
        slot: actor().activeSlot,
        stealth: actor().stealthMode,
      };
      const act = (action, seconds = 6) => {
        check();
        assert.equal(battle.status, 'active');
        assert.equal(battle.mode, 'exploration');
        assert.equal(battle.phase, 'player');
        assert.ok(
          clock(c) + seconds <= until,
          'The next paid reserve order exceeds the original hospital deadline or visit bound.',
        );
        battle = actBattle(battle, action);
        orders.push({ kind: 'battle', action: structuredClone(action) });
        steps.push(structuredClone(action));
        assert.equal(battle.lastError, null, JSON.stringify(action) + ': ' + battle.lastError);
        const pair = syncBattleTime(c, battle);
        assert.equal(pair.error, null);
        c = pair.campaign;
        battle = pair.battle;
        check();
        assert.equal(battle.status, 'active');
        assert.equal(
          battle.mode,
          'exploration',
          'A real contact stops the actual collection visit.',
        );
        assert.equal(battle.phase, 'player');
      };
      const moveTo = (goal) => {
        for (let n = 0; !sameCell(actor(), goal) && n < 64; n++) {
          const view = publicRouteView(battle, actor()),
            route = getReachable(view, actor(), { stopAt: (p) => sameCell(p, goal) })[0];
          assert.ok(
            route?.path.length,
            'The physician needs a real open path to and from the finite container.',
          );
          const step = route.path[0],
            from = spacePoint(actor());
          if (!sameSurface(actor(), step)) {
            const quote = climbPreview(view, actor(), { linkId: step.linkId });
            assert.equal(quote.valid, true, quote.reason);
            act({ type: 'climb', unitId, linkId: step.linkId }, quote.seconds);
          } else {
            act({ type: 'move', unitId, ...spacePoint(step) }, 5);
          }
          assert.notDeepEqual(
            spacePoint(actor()),
            from,
            'A paid collection step must make actual progress.',
          );
        }
        assert.ok(
          sameCell(actor(), goal),
          'A bounded paid path must finish before claiming the old roof post.',
        );
      };
      if (actor().stealthMode) {
        act({ type: 'stealth', unitId, enabled: false }, 0);
      }
      if (actor().movementMode !== 'walk' || actor().stance !== 'standing') {
        act(
          { type: 'movement', unitId, movement: 'walk' },
          Math.max(6, Math.ceil(stanceCost(actor(), 'standing') * 0.06)),
        );
      }
      for (const row of allocation) {
        const chest = () => battle.props.find((prop) => prop.id === row.chestId);
        assert.ok(chest()?.knownToPlayer && chest().open && !chest().locked);
        const view = publicRouteView(battle, actor()),
          goal = pickupGoal(view, actor(), row);
        assert.ok(goal, 'A known container still needs an actual reachable pickup cell.');
        moveTo(spacePoint(goal));
        const look = lookPreview(battle, actor(), chest());
        if (look.valid) {
          act(
            { type: 'look', unitId, ...spacePoint(chest()) },
            Math.max(6, Math.ceil(look.pa * 0.06)),
          );
        }
        const index = chest().contents.findIndex(
            (stack) => stack.item === 'medkits' && stack.count > 0,
          ),
          quote = containerLootPreview(battle, actor(), { id: chest().id }, index, row.count);
        assert.equal(quote.valid, true, quote.reason);
        const stock = chest()
            .contents.filter((stack) => stack.item === 'medkits')
            .reduce((n, stack) => n + stack.count, 0),
          carried = actor().medkits;
        act(quote.action, Math.max(6, Math.ceil(quote.pa * 0.06)));
        assert.equal(actor().medkits, carried + row.count);
        assert.equal(
          chest()
            .contents.filter((stack) => stack.item === 'medkits')
            .reduce((n, stack) => n + stack.count, 0),
          stock - row.count,
        );
        collections.push({
          id: Number(unitId),
          beneficiaryId: id,
          chestId: row.chestId,
          count: row.count,
        });
      }
      moveTo(post);
      if (unitId !== String(id)) {
        const target = battle.units.find((unit) => unit.id === String(id)),
          quote = transferPreview(battle, actor(), target, 'medkits', count);
        assert.ok(
          quote.valid && quote.kind === 'give' && quote.chance === 100 && quote.route.length === 2,
          'The actual returned collector must admit a deterministic adjacent handoff.',
        );
        const carried = actor().medkits,
          received = target.medkits;
        act(
          {
            type: 'transfer',
            unitId,
            targetId: target.id,
            item: 'medkits',
            count,
            transferKind: quote.kind,
            transferRoute: quote.route.map((row) => row.id),
          },
          Math.max(6, Math.ceil(quote.pa * 0.06)),
        );
        assert.equal(actor().medkits, carried - count);
        assert.equal(battle.units.find((unit) => unit.id === target.id).medkits, received + count);
        transfers.push({ id: Number(unitId), targetId: id, count, quote: structuredClone(quote) });
      }
      if (actor().activeSlot !== original.slot) {
        act(
          { type: 'weapon', unitId, slot: original.slot },
          Math.max(6, Math.ceil(actionCosts(battle, actor()).weapon * 0.06)),
        );
      }
      if (actor().movementMode !== original.movement) {
        act(
          { type: 'movement', unitId, movement: original.movement },
          Math.max(6, Math.ceil(stanceCost(actor(), original.stance) * 0.06)),
        );
      }
      if (actor().stance !== original.stance) {
        act(
          { type: 'stance', unitId, stance: original.stance },
          Math.max(6, Math.ceil(stanceCost(actor(), original.stance) * 0.06)),
        );
      }
      if (original.stealth) {
        act({ type: 'stealth', unitId, enabled: true }, 0);
      }
      const returned = structuredClone(battle),
        action = {
          type: 'leaveSector',
          battleId: c.pendingBattle.id,
          sectorState: battle,
          survivors: battle.units.filter((u) => u.side === 'player'),
        };
      battle = null;
      order(action);
      for (const row of assignments) {
        if (row.assignment !== 'active') {
          order({ type: 'assignCare', operativeId: row.id, assignment: row.assignment });
        }
      }
      for (const row of posts) {
        assert.deepEqual(
          c.operativeState[row.id].residentPosition,
          row.position,
          'Collection must return the physician and retain every other real roof post.',
        );
      }
      visits.push({
        id: Number(unitId),
        beneficiaryId: id,
        initial,
        steps,
        returned,
        restoredPost: structuredClone(post),
      });
    }
    if (c.activeSquadId !== selected) {
      order({ type: 'selectSquad', id: selected });
    }
    assert.deepEqual(
      c.squads.map((q) => q.id),
      start.squads.map((q) => q.id),
    );
    for (const prior of start.squads) {
      const current = c.squads.find((q) => q.id === prior.id);
      assert.deepEqual(current.members, prior.members);
      if (!prior.journey) {
        assert.equal(current.location, prior.location);
      }
    }
    for (const row of posts) {
      assert.deepEqual(c.operativeState[row.id].residentPosition, row.position);
    }
    check();
    for (const [id, r] of Object.entries(start.operativeState)) {
      if (!r.alive) {
        assert.equal(c.operativeState[id].alive, false);
      }
    }
    assert.deepEqual(start, before);
    const receipt = {
      sector,
      ids: [...ids],
      doctors,
      deadlineSeconds,
      startSeconds: clock(start),
      endSeconds: clock(c),
      knownContainers: [...rows.values()],
      planned: doctors.map((id) => ({
        id,
        count: plan.get(id).reduce((n, row) => n + row.count, 0),
      })),
      orders,
      renewals,
      collections,
      transfers,
      capacity,
      visits,
      restored: true,
    };
    report({ event: 'northernHospitalFiniteReserveStock', receipt });
    return { campaign: c, receipt };
  } catch (error) {
    if (error?.campaign) {
      c = error.campaign;
    }
    if (error && typeof error === 'object') {
      error.campaign = c;
      error.hospitalReserveStock = {
        sector,
        ids,
        deadlineSeconds,
        orders,
        renewals,
        collections,
        transfers,
        visits,
        restored: false,
        ...(battle ? { battle } : {}),
      };
    }
    throw error;
  }
}
