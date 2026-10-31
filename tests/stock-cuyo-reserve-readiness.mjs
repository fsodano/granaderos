import assert from 'node:assert/strict';
import { dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import { decodeSave, encodeSave } from '../packages/game/save.ts';
import { enterSector } from '../packages/game/world.js';
import { actBattle, getReachable } from '../packages/game/tactical.js';
import { syncBattleTime } from '../packages/game/time.js';
import { sameCell, spaceKey, spacePoint } from '../packages/game/tactical-space.js';
import { operativeLocation } from '../packages/game/squads.js';
import { carriedAmmunition } from '../packages/game/campaign-ammunition.js';
import { ammoTypeFor, ammoCount } from '../packages/game/ammo-types.js';
import { AMMUNITION_FAMILIES } from '../packages/game/ammunition-families.js';
import { sectorInventoryModel } from '../packages/game/sector-inventory.js';
import { handRecord } from '../packages/game/tactical-inventory.js';
import { recoverRoutePrimary } from './route-owned-equipment.mjs';
import { supplyRouteAmmunition } from './route-ammunition.ts';
import { expandCellScene } from '../packages/game/cell-scene-storage.js';
import { careAssignmentIssue } from '../packages/game/medical-care.js';

// Allocate the existing roof residents' real authored cells before departure.
// Keep the clinical patients and reserved physician behind the firing edge;
// dead, captured, offsite and travelling soldiers never receive a post.
export function stockCuyoBatteryReservePosts(state) {
  const scene = expandCellScene(state.sectorStates.cordoba, state),
    priority = [108, 104, 102, 146, 119, 133, 101, 121, 117, 116, 107, 130, 9],
    groups = new Map();
  for (const id of state.recruited) {
    const record = state.operativeState[id],
      home = state.squads.find((squad) => squad.members.includes(id)),
      point = record.residentPosition;
    if (
      !record.alive ||
      record.captured ||
      state.squad.includes(id) ||
      operativeLocation(state, id) !== 'cordoba' ||
      !home ||
      home.journey ||
      !point ||
      (point.tacticalLevel ?? 0) === 0
    ) {
      continue;
    }
    const roof = scene?.upperSurfaces?.find((cell) => sameCell(cell, point));
    if (!roof?.buildingId) {
      continue;
    }
    if (!groups.has(roof.buildingId)) {
      groups.set(roof.buildingId, []);
    }
    groups.get(roof.buildingId).push(id);
  }
  const rank = (id) =>
      priority.includes(id) ? priority.indexOf(id) : priority.length + state.recruited.indexOf(id),
    assigned = new Map(),
    claimed = new Set(),
    overflow = [];
  for (const [buildingId, ids] of groups) {
    ids.sort((a, b) => rank(a) - rank(b));
    const cells = scene.upperSurfaces
      .filter((cell) => cell.buildingId === buildingId && !cell.blocked && cell.kind === 'roof')
      .sort((a, b) => b.x - a.x || b.y - a.y);
    // Keep the established priority posts when that building has room. Separate
    // quiet squad visits can leave more residents than one actual roof holds.
    // Reserve every group's own cells before moving only its excess elsewhere.
    for (const id of ids) {
      const cell = cells.find((point) => !claimed.has(spaceKey(point)));
      if (cell) {
        claimed.add(spaceKey(cell));
        assigned.set(id, cell);
      } else {
        overflow.push(id);
      }
    }
  }
  const roofs = scene?.upperSurfaces?.filter((cell) => !cell.blocked && cell.kind === 'roof') ?? [];
  for (const id of overflow) {
    const origin = state.operativeState[id].residentPosition,
      cell = roofs
        .filter((point) => !claimed.has(spaceKey(point)))
        .sort(
          (a, b) =>
            Math.hypot(a.x - origin.x, a.y - origin.y) -
              Math.hypot(b.x - origin.x, b.y - origin.y) ||
            b.x - a.x ||
            b.y - a.y,
        )[0];
    assert.ok(cell, 'The actual reserve needs enough distinct authored roof cells.');
    claimed.add(spaceKey(cell));
    assigned.set(id, cell);
  }
  return [...groups.values()].flatMap((ids) =>
    ids.map((id) => ({ id, ...spacePoint(assigned.get(id)) })),
  );
}

// Prepare the actual reserve before the crew leaves. Each supplied post is
// public map geometry, checked through the present soldier's legal movement.
// Single-person visits reuse that soldier's home slot: other squad members
// cannot block a narrow roof, and no extra squad capacity is required.
export function prepareStockCuyoBatteryReserve(start, posts, { report = () => {} } = {}) {
  const before = structuredClone(start),
    ids = posts.map((post) => post.id),
    journal = [],
    positions = [],
    enteredPostures = [],
    careRestorations = [],
    medicalAllocations = [];
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(
    new Set(posts.map(spaceKey)).size,
    posts.length,
    'Every actual reserve needs a distinct post.',
  );
  assert.equal(start.pendingBattle, null);
  assert.equal(start.pendingEncounter, null);
  let c = decodeSave(encodeSave(start)).campaign;
  const active = c.activeSquadId;
  const issue = (action) => {
    c = dispatchCampaign(c, action);
    assert.equal(c.lastError, null, JSON.stringify(action) + ': ' + c.lastError);
    journal.push({ kind: 'campaign', action: structuredClone(action) });
  };
  for (const id of ids) {
    assert.ok(
      c.recruited.includes(id) && c.operativeState[id].alive && !c.operativeState[id].captured,
    );
    assert.equal(operativeLocation(c, id), 'cordoba');
    assert.ok(!start.squad.includes(id), 'The gun crew keeps its original soldiers.');
    if (c.operativeState[id].weaponDropped) {
      c = recoverRoutePrimary(c, id, { report });
    }
  }
  const short = ids.filter((id) => {
    const unit = carriedAmmunition(
        rosterFor(c).find((op) => op.id === id),
        c.operativeState[id],
      ),
      family = ammoTypeFor({ ...unit, activeSlot: 'primary' });
    return family && unit.loaded + ammoCount(unit, family) < 2;
  });
  const equipmentStart = decodeSave(encodeSave(c)).campaign,
    supplyOrders = [],
    donations = [],
    needs = new Map();
  for (const id of short) {
    const u = carriedAmmunition(
        rosterFor(c).find((op) => op.id === id),
        c.operativeState[id],
      ),
      family = ammoTypeFor({ ...u, activeSlot: 'primary' });
    if (!needs.has(family)) {
      needs.set(family, []);
    }
    needs.get(family).push(id);
  }
  // Share only a measured local shortage. An accessible living carrier can
  // leave off-primary-family cartridges through the ordinary inventory order;
  // its loaded primary and all compatible primary cartridges stay intact.
  // The established thirteen-person preparation needs no donation orders.
  for (const [family, recipients] of needs) {
    const wanted = recipients.reduce((n, id) => {
      const u = carriedAmmunition(
        rosterFor(c).find((op) => op.id === id),
        c.operativeState[id],
      );
      return n + Math.max(0, 10 - u.loaded - ammoCount(u, family));
    }, 0);
    const pool = () => {
      const rows = new Map();
      for (const id of recipients) {
        for (const row of sectorInventoryModel(c, 'cordoba', rosterFor(c), id).entries) {
          const stack = JSON.parse(row.expected);
          if (
            row.reachable &&
            stack.kind === 'ammunition' &&
            stack.ammoType === AMMUNITION_FAMILIES[family].type
          ) {
            rows.set(row.key, row.count);
          }
        }
      }
      return (
        (c.ammunitionStores.cordoba?.[family] ?? 0) +
        [...rows.values()].reduce((n, count) => n + count, 0)
      );
    };
    let missing = Math.max(0, wanted - pool());
    for (const donor of c.recruited) {
      if (!missing) {
        break;
      }
      const r = c.operativeState[donor];
      if (!r.alive || r.captured || operativeLocation(c, donor) !== 'cordoba') {
        continue;
      }
      const model = sectorInventoryModel(c, 'cordoba', rosterFor(c), donor);
      if (model.operativeId !== donor || model.reason) {
        continue;
      }
      const unit = carriedAmmunition(
          rosterFor(c).find((op) => op.id === donor),
          r,
        ),
        primaryFamily = ammoTypeFor({ ...unit, activeSlot: 'primary' }),
        row = model.carried.find((row) => {
          const stack = row.item.startsWith('inventory:')
            ? model.personal.inventory[row.item.slice(10)]
            : null;
          return (
            stack?.kind === 'ammunition' && stack.ammoType === AMMUNITION_FAMILIES[family].type
          );
        });
      if (!primaryFamily || primaryFamily === family || !row?.count) {
        continue;
      }
      const count = Math.min(missing, row.count),
        primary = structuredClone(handRecord(model.personal, 'primary')),
        compatible = unit.loaded + ammoCount(unit, primaryFamily),
        stock = ammoCount(unit, family),
        poolBefore = pool(),
        cash = c.resources.treasury,
        time = [c.hour, c.secondOfHour ?? 0],
        contracts = structuredClone(c.contracts);
      const action = {
        type: 'sectorInventory',
        sector: 'cordoba',
        operativeId: donor,
        direction: 'drop',
        item: row.item,
        count,
      };
      c = dispatchCampaign(c, action);
      assert.equal(c.lastError, null);
      supplyOrders.push(structuredClone(action));
      const after = carriedAmmunition(
        rosterFor(c).find((op) => op.id === donor),
        c.operativeState[donor],
      );
      assert.equal(ammoCount(after, family), stock - count);
      assert.equal(after.loaded + ammoCount(after, primaryFamily), compatible);
      assert.deepEqual(
        handRecord(sectorInventoryModel(c, 'cordoba', rosterFor(c), donor).personal, 'primary'),
        primary,
      );
      assert.equal(pool(), poolBefore + count);
      assert.equal(c.resources.treasury, cash);
      assert.deepEqual([c.hour, c.secondOfHour ?? 0], time);
      assert.deepEqual(c.contracts, contracts);
      const donation = {
        event: 'stockCuyoReserveDonation',
        donor,
        family,
        count,
        poolBefore,
        poolAfter: pool(),
        action: structuredClone(action),
      };
      donations.push(donation);
      report(donation);
      missing -= count;
    }
  }
  const ammunition = supplyRouteAmmunition(c, short, { target: 10, report });
  c = ammunition.campaign;
  supplyOrders.push(
    ...ammunition.transactions.map((transaction) => structuredClone(transaction.action)),
  );
  const equipmentReady = decodeSave(encodeSave(c)).campaign;
  for (const post of posts) {
    const { id } = post,
      home = c.squads.find((squad) => squad.members.includes(id)),
      assignment = c.operativeState[id].assignment;
    assert.ok(home && !home.journey && home.location === 'cordoba');
    const members = [...home.members];
    issue({ type: 'selectSquad', id: home.id });
    issue({ type: 'squad', ids: [id] });
    if (c.operativeState[id].asleep) {
      issue({ type: 'setSleep', operativeId: id, asleep: false });
    }
    issue({ type: 'assignCare', operativeId: id, assignment: 'active' });
    issue({ type: 'visitSector' });
    let battle = enterSector(c.pendingBattle, c.sectorStates.cordoba);
    journal.push({ kind: 'enter' });
    const unit = battle.units.find((unit) => unit.id === String(id)),
      destination = { x: post.x, y: post.y, tacticalLevel: post.tacticalLevel },
      posture = unit?.stance,
      reach = () =>
        getReachable(battle, unit, { stopAt: (point) => sameCell(point, destination) }).find(
          (point) => sameCell(point, destination),
        );
    // Check the actual entered unit, not an older scene's posture. A second
    // roof still requires its legal native descent and ascent with real costs.
    enteredPostures.push({ id, stance: posture });
    assert.ok(unit && reach(), 'The actual reserve post must be reachable.');
    if (!sameCell(unit, destination)) {
      const action = { type: 'move', unitId: String(id), ...destination };
      battle = actBattle(battle, action);
      assert.equal(battle.lastError, null);
      journal.push({ kind: 'battle', action });
    }
    if (battle.units.find((other) => other.id === String(id)).stance !== posture) {
      const action = { type: 'stance', unitId: String(id), stance: posture };
      battle = actBattle(battle, action);
      assert.equal(battle.lastError, null);
      journal.push({ kind: 'battle', action });
    }
    const pair = syncBattleTime(c, battle);
    assert.equal(pair.error, null);
    c = pair.campaign;
    battle = pair.battle;
    journal.push({ kind: 'sync' });
    const action = {
      type: 'leaveSector',
      battleId: c.pendingBattle.id,
      sectorState: battle,
      survivors: battle.units.filter((unit) => unit.side === 'player'),
    };
    c = dispatchCampaign(c, action);
    assert.equal(c.lastError, null);
    journal.push({ kind: 'leave', battleId: action.battleId });
    issue({ type: 'squad', ids: members });
    report({ event: 'stockCuyoCareRestoreInput', id, assignment, campaign: structuredClone(c) });
    let restoredAssignment = assignment;
    const medicalIssue =
      assignment === 'doctor'
        ? careAssignmentIssue(
            c,
            rosterFor(c).find((op) => op.id === id),
            assignment,
          )
        : null;
    if (medicalIssue?.code === 'no_medkits') {
      const patients = c.recruited.filter((operativeId) => {
        const record = c.operativeState[operativeId];
        return (
          record.alive &&
          !record.captured &&
          operativeLocation(c, operativeId) === 'cordoba' &&
          (record.hp < record.maxHp || record.bleeding > 0)
        );
      });
      if (!patients.length) {
        // The real clinic has finished. An exhausted former doctor cannot be
        // assigned that unavailable job again merely to restore an old label.
        restoredAssignment = 'rest';
      } else {
        const model = () => sectorInventoryModel(c, 'cordoba', rosterFor(c), id),
          pool = () =>
            model()
              .entries.filter((row) => JSON.parse(row.expected).item === 'medkits')
              .reduce((sum, row) => sum + row.count, 0);
        const source = model().entries.find(
          (row) => row.reachable && row.count > 0 && JSON.parse(row.expected).item === 'medkits',
        );
        assert.ok(
          source,
          'The actual unfinished clinic needs a reachable finite dressing before restoring its doctor.',
        );
        const stock = c.operativeState[id].medkits,
          known = pool(),
          cash = c.resources.treasury,
          time = [c.hour, c.secondOfHour ?? 0];
        const action = {
          type: 'sectorInventory',
          sector: 'cordoba',
          operativeId: id,
          direction: 'take',
          sourceKey: source.key,
          expected: source.expected,
          count: 1,
        };
        issue(action);
        assert.equal(c.operativeState[id].medkits, stock + 1);
        assert.equal(pool(), known - 1);
        assert.equal(c.resources.treasury, cash);
        assert.deepEqual([c.hour, c.secondOfHour ?? 0], time);
        medicalAllocations.push({ id, count: 1, patients, action });
      }
      const restoration = {
        event: 'stockCuyoClinicalDutyRestored',
        id,
        previousAssignment: assignment,
        assignment: restoredAssignment,
        eligibility: medicalIssue.code,
        patients,
        medkits: c.operativeState[id].medkits,
        hour: c.hour,
        second: c.secondOfHour ?? 0,
      };
      careRestorations.push(restoration);
      report(restoration);
    }
    issue({ type: 'assignCare', operativeId: id, assignment: restoredAssignment });
    assert.deepEqual(c.operativeState[id].residentPosition, destination);
    positions.push({ id, ...destination });
  }
  issue({ type: 'selectSquad', id: active });
  assert.equal(c.squads.length, start.squads.length);
  assert.deepEqual(c.squads, start.squads);
  assert.equal(c.resources.treasury, start.resources.treasury);
  assert.deepEqual(c.contracts, start.contracts);
  for (const [id, record] of Object.entries(start.operativeState)) {
    for (const key of ['alive', 'hp', 'bleeding', 'captured', 'morale']) {
      assert.deepEqual(
        c.operativeState[id][key],
        record[key],
        `${id}.${key} only changes through later native combat/care.`,
      );
    }
    assert.equal(
      c.operativeState[id].medkits,
      record.medkits +
        medicalAllocations
          .filter((row) => String(row.id) === id)
          .reduce((sum, row) => sum + row.count, 0),
      'Only an actual finite local pickup can add a dressing.',
    );
  }
  assert.deepEqual(start, before);
  c = decodeSave(encodeSave(c)).campaign;
  assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
  const preparation = {
    event: 'stockCuyoReserveReady',
    ids,
    positions,
    enteredPostures,
    journal,
    equipmentStart,
    supplyOrders,
    donations,
    equipmentReady,
    medicalAllocations,
    careRestorations,
    ammunition: ammunition.transactions,
    startClock: [start.hour, start.secondOfHour ?? 0],
    endClock: [c.hour, c.secondOfHour ?? 0],
    elapsedSeconds:
      (c.hour - start.hour) * 3600 + (c.secondOfHour ?? 0) - (start.secondOfHour ?? 0),
  };
  report(preparation);
  return { campaign: c, preparation };
}
