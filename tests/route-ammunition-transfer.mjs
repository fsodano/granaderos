import assert from 'node:assert/strict';
import { rosterFor } from '../packages/game/campaign.js';
import { sectorInventoryModel } from '../packages/game/sector-inventory.js';
import { AMMUNITION_FAMILIES } from '../packages/game/ammunition-families.js';
import { order } from './local-contract-fixture.ts';

// Share existing carried reserve through visible drop and pickup controls.
// Chamber contents stay with each weapon; no ammunition is issued here.
export function transferRouteSupply(
  start,
  {
    sector = start.location,
    recipientId,
    donorIds,
    item,
    count,
    execute = order,
    report = () => {},
  },
) {
  assert.ok(
    (item === 'medkits' ||
      Object.values(AMMUNITION_FAMILIES).some(
        (family) => item === `inventory:ammo:${family.type}`,
      )) &&
      Number.isSafeInteger(count) &&
      count > 0,
  );
  const before = structuredClone(start),
    transactions = [];
  let s = start,
    remaining = count;
  const model = (id) => sectorInventoryModel(s, sector, rosterFor(s), id);
  const quantity = (inventory) =>
    inventory.carried.filter((row) => row.item === item).reduce((sum, row) => sum + row.count, 0);
  for (const donorId of donorIds) {
    if (!remaining) {
      break;
    }
    if (donorId === recipientId) {
      continue;
    }
    const donor = model(donorId),
      recipient = model(recipientId);
    const carried = donor.carried.find((row) => row.count > 0 && row.item === item);
    if (!carried) {
      continue;
    }
    const amount = Math.min(remaining, carried.count),
      donorReserve = quantity(donor),
      recipientReserve = quantity(recipient),
      known = new Set(recipient.entries.map((row) => row.key)),
      cash = s.resources.treasury,
      hour = s.hour,
      second = s.secondOfHour;
    const drop = {
      type: 'sectorInventory',
      sector,
      operativeId: donorId,
      direction: 'drop',
      item: carried.item,
      count: amount,
    };
    s = execute(s, drop);
    const row = model(recipientId).entries.find(
      (row) =>
        !known.has(row.key) &&
        row.reachable &&
        (item === 'medkits'
          ? JSON.parse(row.expected).item === 'medkits'
          : item === `inventory:ammo:${JSON.parse(row.expected).ammoType}`),
    );
    assert.ok(row, 'The actual shared reserve must remain a reachable finite ground stack.');
    assert.equal(row.count, amount);
    const take = {
      type: 'sectorInventory',
      sector,
      operativeId: recipientId,
      direction: 'take',
      sourceKey: row.key,
      expected: row.expected,
      count: amount,
    };
    s = execute(s, take);
    assert.equal(quantity(model(donorId)), donorReserve - amount);
    assert.equal(quantity(model(recipientId)), recipientReserve + amount);
    assert.equal(model(donorId).personal.loaded, donor.personal.loaded);
    assert.equal(model(recipientId).personal.loaded, recipient.personal.loaded);
    assert.equal(s.resources.treasury, cash);
    assert.equal(s.hour, hour);
    assert.equal(s.secondOfHour, second);
    const transaction = {
      donorId,
      recipientId,
      item,
      count: amount,
      sourceKey: row.key,
      source: JSON.parse(row.expected),
      actions: [drop, take],
    };
    transactions.push(transaction);
    report({ event: 'routeFiniteSupplyShared', ...transaction });
    remaining -= amount;
  }
  assert.equal(remaining, 0, 'Actual donor reserve must cover the requested finite transfer.');
  assert.deepEqual(start, before);
  return { campaign: s, transactions, transferred: count };
}

export function transferRouteAmmunition(start, options) {
  assert.ok(AMMUNITION_FAMILIES[options.family]);
  return transferRouteSupply(start, {
    ...options,
    item: `inventory:ammo:${AMMUNITION_FAMILIES[options.family].type}`,
    report: (event) =>
      options.report?.({ ...event, event: 'routeFiniteAmmoShared', family: options.family }),
  });
}
