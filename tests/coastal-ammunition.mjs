import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import { carriedAmmunition } from '../packages/game/campaign-ammunition.js';
import { ammoTypeFor, ammoCount } from '../packages/game/ammo-types.js';
import { AMMUNITION_FAMILIES } from '../packages/game/ammunition-families.js';
import { WEAPONS } from '../packages/game/data.js';
import { sectorInventoryModel } from '../packages/game/sector-inventory.js';
import { handRecord, applyItemQuantity } from '../packages/game/tactical-inventory.js';
import { decodeSave, encodeSave } from '../packages/game/save.ts';
import { supplyRouteAmmunition } from './route-ammunition.ts';

// Keep the existing firearm when its actual finite family can meet the target.
// Otherwise equip a real pocket or reachable local firearm with usable stock.
// The replaced hand stays in the person's own pockets; no stock is created.
export function supplyCoastalAmmunition(start, ids, { target = 16, report = () => {} } = {}) {
  assert.ok(Number.isSafeInteger(target) && target >= 0 && target <= 1_000_000);
  let c = structuredClone(start);
  const before = structuredClone(start),
    changes = [];
  const order = (action) => {
    const next = dispatchCampaign(c, action);
    assert.equal(next.lastError, null, JSON.stringify(action) + ': ' + next.lastError);
    c = next;
  };
  for (const id of ids) {
    const op = rosterFor(c).find((actor) => actor.id === id),
      unit = carriedAmmunition(op, c.operativeState[id]);
    if (unit.weaponDropped || !ammoTypeFor(unit)) {
      continue;
    }
    const model = sectorInventoryModel(c, c.location, rosterFor(c), id),
      known = (family) =>
        model.entries
          .filter(
            (row) =>
              row.reachable &&
              JSON.parse(row.expected).kind === 'ammunition' &&
              JSON.parse(row.expected).ammoType === AMMUNITION_FAMILIES[family].type,
          )
          .reduce((sum, row) => sum + row.count, 0) +
        (c.ammunitionStores[c.location]?.[family] ?? 0);
    const available = (record) => {
      const family = ammoTypeFor(record);
      return family ? ammoCount(unit, family) + (record.loaded ?? 0) + known(family) : 0;
    };
    if (available(unit) >= target) {
      continue;
    }
    const pockets = model.carried
      .filter(
        (row) =>
          row.inventoryKey &&
          row.expected &&
          row.equip?.some((option) => option.slot === 'primary' && option.valid),
      )
      .map((row) => ({ ...row, record: JSON.parse(row.expected), pocket: true }));
    const local = model.entries
      .filter((row) => row.reachable && row.count > 0)
      .map((row) => ({ ...row, record: JSON.parse(row.expected), pocket: false }));
    const choices = [...pockets, ...local]
      .filter(
        (row) =>
          WEAPONS[row.record.weapon]?.capacity > 0 &&
          available(row.record) >= target &&
          (() => {
            try {
              if (!row.pocket) {
                applyItemQuantity(model.personal, { ...row.record, count: 1 });
              }
              return true;
            } catch {
              return false;
            }
          })(),
      )
      .sort(
        (a, b) =>
          Number(b.pocket) - Number(a.pocket) ||
          (b.record.contentWeapon?.range ?? WEAPONS[b.record.weapon].range) -
            (a.record.contentWeapon?.range ?? WEAPONS[a.record.weapon].range) ||
          String(a.inventoryKey ?? a.key).localeCompare(String(b.inventoryKey ?? b.key)),
      );
    const choice = choices[0];
    if (!choice) {
      continue;
    } // The unchanged supplier reports a genuine finite shortage.
    const oldHand = handRecord(model.personal, 'primary'),
      cash = c.resources.treasury,
      seconds = c.hour * 3600 + (c.secondOfHour ?? 0);
    let carried = choice;
    if (!choice.pocket) {
      const keys = new Set(model.carried.map((row) => row.inventoryKey));
      order({
        type: 'sectorInventory',
        sector: c.location,
        operativeId: id,
        direction: 'take',
        sourceKey: choice.key,
        expected: choice.expected,
        count: 1,
      });
      const next = sectorInventoryModel(c, c.location, rosterFor(c), id);
      carried = next.carried.find(
        (row) =>
          row.inventoryKey &&
          !keys.has(row.inventoryKey) &&
          JSON.parse(row.expected).weapon === choice.record.weapon,
      );
      assert.ok(carried);
      const identity = (record) => {
          const { count, ...rest } = record;
          return rest;
        },
        sourceIdentity = identity(choice.record);
      const count = (entries) =>
        entries
          .filter((row) => isDeepStrictEqual(identity(JSON.parse(row.expected)), sourceIdentity))
          .reduce((sum, row) => sum + row.count, 0);
      assert.equal(
        count(next.entries),
        count(model.entries) - 1,
        'The exact source record is consumed once even when container indexes move.',
      );
    }
    order({
      type: 'sectorInventory',
      sector: c.location,
      operativeId: id,
      direction: 'equip',
      inventoryKey: carried.inventoryKey,
      expected: carried.expected,
      slot: 'primary',
    });
    const next = sectorInventoryModel(c, c.location, rosterFor(c), id),
      incoming = JSON.parse(carried.expected),
      equipped = handRecord(next.personal, 'primary');
    for (const [key, value] of Object.entries(incoming)) {
      if (key !== 'item') {
        assert.deepEqual(equipped[key], value);
      }
    }
    assert.ok(
      next.carried.some(
        (row) =>
          row.inventoryKey && row.expected && isDeepStrictEqual(JSON.parse(row.expected), oldHand),
      ),
      "The exact previous firearm stays in this person's pockets.",
    );
    assert.equal(c.resources.treasury, cash);
    assert.equal(c.hour * 3600 + (c.secondOfHour ?? 0), seconds);
    const receipt = {
      event: 'coastalCompatiblePrimary',
      operativeId: id,
      oldWeapon: oldHand.weapon,
      weapon: equipped.weapon,
      instanceId: equipped.instanceId,
      sourceKey: choice.pocket ? choice.inventoryKey : choice.key,
      fromPocket: choice.pocket,
      target,
    };
    changes.push(receipt);
    report(receipt);
  }
  const supplied = supplyRouteAmmunition(c, ids, { target, report });
  c = decodeSave(encodeSave(supplied.campaign)).campaign;
  assert.deepEqual(start, before);
  return { campaign: c, changes, transactions: supplied.transactions };
}
