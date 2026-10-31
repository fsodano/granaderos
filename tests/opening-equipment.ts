import { present } from './assert-present.ts';
import type {
  BattleSnapshot,
  BattleUnit,
  TacticalPoint,
  TacticalAction,
  EquipmentItem,
} from '../packages/game/public/compatibility-types.ts';
import { sameSurface, spacePoint } from '../packages/game/tactical-space.js';
import assert from 'node:assert/strict';
import {
  actBattle,
  getReachable,
  canSee,
  hasLineOfSight,
  equipLootPreview,
  lookPreview,
} from '../packages/game/tactical.js';
import { handRecord } from '../packages/game/tactical-inventory.js';
import { ammunitionByType } from '../packages/game/ammunition-types.js';

const rifles = new Set<BattleUnit['weapon']>([1800, 1801, 1802]);
const contact = (a: TacticalPoint, b: TacticalPoint) =>
  sameSurface(a, b) && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

// Prepare the current field squad from equipment left by the actual battle.
// A surviving rifleman keeps his gun; his survival must not fail a route that
// previously depended on that character dying. Enemy remains are valid sources.
export function equipOpeningRifles(
  battle: BattleSnapshot,
  receiverIds: readonly (string | number)[],
) {
  let next = structuredClone(battle);
  const transfers = [],
    unfilled = [];
  const order = (action: TacticalAction) => {
    const result = actBattle(next, action);
    assert.equal(result.lastError, null, JSON.stringify(action) + ': ' + result.lastError);
    next = result;
  };
  for (const id of receiverIds) {
    let receiver = next.units.find(
      (unit: BattleUnit) =>
        unit.id === String(id) &&
        unit.side === 'player' &&
        unit.hp >= 15 &&
        !unit.unconscious &&
        !unit.routed &&
        !unit.departure,
    );
    if (!receiver || (!receiver.weaponDropped && rifles.has(receiver.weapon))) {
      continue;
    }
    const reachable = getReachable(next, receiver);
    const sources = next.units
      .filter(
        (unit: BattleUnit) =>
          unit.hp === 0 && !unit.departure && !unit.weaponDropped && rifles.has(unit.weapon),
      )
      .flatMap((source) => {
        const approach = reachable
          .filter(
            (point) =>
              contact(point, source) && hasLineOfSight(next, { ...receiver, ...point }, source),
          )
          .sort((a, b) => a.cost - b.cost)[0];
        return approach ? [{ source, approach }] : [];
      })
      .sort(
        (a, b) =>
          Number(a.source.side !== 'player') - Number(b.source.side !== 'player') ||
          a.approach.cost - b.approach.cost ||
          a.source.id.localeCompare(b.source.id),
      );
    const choice = sources[0];
    if (!choice) {
      unfilled.push(receiver.id);
      continue;
    }
    const { source } = choice,
      incoming = handRecord(source, 'primary'),
      outgoing =
        receiver.weaponDropped || !receiver.weapon ? null : handRecord(receiver, 'primary');
    const previousKeys = new Set(Object.keys(receiver.inventory));
    // Exploration can stop a long walk when new surroundings are admitted.
    // Continue from the actual saved position instead of assuming arrival.
    for (
      let leg = 0;
      !contact(
        present(next.units.find((unit: BattleUnit) => unit.id === present(receiver).id)),
        source,
      ) && leg < 64;
      leg++
    ) {
      receiver = present(next.units.find((unit: BattleUnit) => unit.id === present(receiver).id));
      const point = getReachable(next, receiver)
        .filter(
          (point) =>
            contact(point, source) && hasLineOfSight(next, { ...receiver, ...point }, source),
        )
        .sort((a, b) => a.cost - b.cost)[0];
      assert.ok(point, 'the actual remains need a reachable visible contact');
      const before = spacePoint(receiver);
      order({ type: 'move', unitId: present(receiver).id, ...spacePoint(point) });
      assert.notDeepEqual(
        spacePoint(next.units.find((unit: BattleUnit) => unit.id === present(receiver).id)),
        before,
        'each ordinary recovery walk must make actual progress',
      );
    }
    assert.ok(
      contact(
        present(next.units.find((unit: BattleUnit) => unit.id === present(receiver).id)),
        source,
      ),
      'the carrier must actually reach the remains',
    );
    if (
      lookPreview(
        next,
        next.units.find((unit: BattleUnit) => unit.id === present(receiver).id),
        source,
      ).valid
    ) {
      order({ type: 'look', unitId: present(receiver).id, ...spacePoint(source) });
    }
    assert.ok(
      canSee(
        next,
        next.units.find((unit: BattleUnit) => unit.id === present(receiver).id),
        next.units.find((unit: BattleUnit) => unit.id === source.id),
      ),
      'the carrier must actually see the remains before pickup',
    );
    const sourceReserves = ammunitionByType(
      next.units.find((unit: BattleUnit) => unit.id === source.id),
    );
    order({
      type: 'loot',
      unitId: present(receiver).id,
      targetId: source.id,
      item: 'primary',
      count: 1,
    });
    receiver = present(next.units.find((unit: BattleUnit) => unit.id === present(receiver).id));
    const entry = Object.entries(present(receiver).inventory).find(
      ([key, item]) =>
        typeof item === 'object' &&
        !previousKeys.has(key) &&
        item.weapon === incoming.weapon &&
        item.instanceId === incoming.instanceId,
    );
    assert.ok(
      entry && typeof entry[1] === 'object',
      'the recovered rifle has its own inventory record',
    );
    assert.equal(entry[1].count, 1, 'one actual rifle was recovered');
    let leftOnGround = false;
    if (outgoing && !equipLootPreview(next, receiver, entry[0]).valid) {
      order({ type: 'drop', unitId: present(receiver).id, item: 'primary', count: 1 });
      leftOnGround = true;
    }
    order({ type: 'equipLoot', unitId: present(receiver).id, inventoryKey: entry[0] });
    const equipped = present(
        next.units.find((unit: BattleUnit) => unit.id === present(receiver).id),
      ),
      looted = present(next.units.find((unit: BattleUnit) => unit.id === source.id));
    assert.deepEqual(
      handRecord(equipped, 'primary'),
      incoming,
      'the rifle keeps its loading, condition, fittings and identity',
    );
    if (outgoing) {
      const stored = (
        leftOnGround ? next.groundItems : Object.values(present(equipped).inventory)
      ).find(
        (item): item is EquipmentItem =>
          typeof item === 'object' &&
          item.weapon === outgoing.weapon &&
          item.instanceId === outgoing.instanceId,
      );
      assert.ok(stored, 'the replaced gun remains in the pack or on the ground');
      for (const [key, value] of Object.entries(outgoing)) {
        assert.deepEqual(
          Object.entries(stored).find(([name]) => name === key)?.[1],
          value,
          `the replaced gun preserves ${key}`,
        );
      }
    }
    assert.equal(present(looted).hp, 0);
    assert.equal(present(looted).weaponDropped, true);
    assert.equal(present(looted).loaded, 0);
    assert.deepEqual(
      ammunitionByType(looted),
      sourceReserves,
      'recovering the gun preserves every loose ammunition family',
    );
    transfers.push({
      receiverId: present(receiver).id,
      sourceId: source.id,
      sourceSide: source.side,
      weapon: incoming.weapon,
      instanceId: incoming.instanceId,
      leftOnGround,
      outgoing,
    });
  }
  return { battle: next, transfers, unfilled };
}
