import assert from 'node:assert/strict';
import { dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import { operativeLocation, operativeInTransit } from '../packages/game/squads.js';
import { sectorInventoryModel } from '../packages/game/sector-inventory.js';
import { applyItemQuantity } from '../packages/game/tactical-inventory.js';

const clock = (c) => c.hour * 3600 + (c.secondOfHour ?? 0);
const stable = (c, id) =>
  c.recruited.includes(id) &&
  c.operativeState[id]?.alive &&
  !c.operativeState[id].captured &&
  !operativeInTransit(c, id) &&
  c.operativeState[id].hp === c.operativeState[id].maxHp &&
  !c.operativeState[id].bleeding &&
  !c.operativeState[id].asleep &&
  c.operativeState[id].energy > 0;

// The existing trip collects six dressings for its physician. Add only the
// actual local deficit; an uncollected parcel is never credited as supply.
export function blockedCoastDressingPlan(c, { localDoctorId, physicianId }) {
  assert.notEqual(localDoctorId, physicianId);
  assert.ok(
    stable(c, localDoctorId) && stable(c, physicianId),
    'The actual blockade parties must be fully healed and stable before their existing supply trip.',
  );
  assert.equal(operativeLocation(c, localDoctorId), 'cordoba');
  const localCarried = c.operativeState[localDoctorId].medkits,
    physicianCarried = c.operativeState[physicianId].medkits;
  assert.ok(
    Number.isSafeInteger(localCarried) &&
      localCarried >= 0 &&
      Number.isSafeInteger(physicianCarried) &&
      physicianCarried >= 0,
  );
  const localTarget = 2,
    physicianReserve = 6,
    localDeficit = Math.max(0, localTarget - localCarried);
  return {
    localDoctorId,
    physicianId,
    localTarget,
    physicianReserve,
    localCarried,
    physicianCarried,
    localDeficit,
    requested: physicianReserve + localDeficit,
  };
}

// Both real parties have arrived in Córdoba. The courier gives only the
// local deficit and keeps its six collected dressings. Native inventory
// authority owns the debit, capacity, source placement and recipient access.
export function distributeBlockedCoastDressings(start, plan, { report = () => {} } = {}) {
  let c = start;
  const orders = [],
    receipt = { plan: structuredClone(plan), orders, completed: false };
  const fail = (message) => {
    throw Error(message);
  };
  const order = (action) => {
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
    assert.equal(c.lastError, null, c.lastError);
    assert.equal(clock(c), from);
    assert.equal(c.resources.treasury, cash);
  };
  try {
    const { localDoctorId, physicianId, localTarget, physicianReserve } = plan;
    assert.equal(localTarget, 2);
    assert.equal(physicianReserve, 6);
    assert.equal(c.pendingBattle, null);
    assert.equal(c.pendingEncounter, null);
    assert.ok(
      stable(c, localDoctorId) && stable(c, physicianId),
      'Actual supply travel must preserve both stable serving recipients.',
    );
    assert.equal(operativeLocation(c, localDoctorId), 'cordoba');
    assert.equal(operativeLocation(c, physicianId), 'cordoba');
    const deficit = Math.max(0, localTarget - c.operativeState[localDoctorId].medkits);
    receipt.before = {
      local: c.operativeState[localDoctorId].medkits,
      physician: c.operativeState[physicianId].medkits,
    };
    if (c.operativeState[physicianId].medkits < physicianReserve + deficit) {
      fail(`No actual reachable finite dressings remain for ${localDoctorId} at cordoba.`);
    }
    if (deficit) {
      const recipient = sectorInventoryModel(c, 'cordoba', rosterFor(c), localDoctorId),
        donor = sectorInventoryModel(c, 'cordoba', rosterFor(c), physicianId);
      assert.equal(recipient.operativeId, localDoctorId);
      assert.equal(donor.operativeId, physicianId);
      assert.equal(recipient.carriedReason, null, recipient.carriedReason);
      assert.equal(donor.carriedReason, null, donor.carriedReason);
      // Capacity is a copied quotation. The actual take below still enforces it.
      applyItemQuantity(recipient.personal, { item: 'medkits', count: deficit });
      const beforeRows = new Map(recipient.entries.map((row) => [row.key, row.count]));
      order({
        type: 'sectorInventory',
        sector: 'cordoba',
        operativeId: physicianId,
        direction: 'drop',
        item: 'medkits',
        count: deficit,
      });
      assert.equal(c.operativeState[physicianId].medkits, receipt.before.physician - deficit);
      const current = sectorInventoryModel(c, 'cordoba', rosterFor(c), localDoctorId),
        source = current.entries.find(
          (row) =>
            row.reachable &&
            JSON.parse(row.expected).item === 'medkits' &&
            row.count - (beforeRows.get(row.key) ?? 0) === deficit,
        );
      assert.ok(
        source,
        "The local doctor needs actual Native access to the courier's newly dropped finite parcel.",
      );
      receipt.source = { key: source.key, expected: source.expected, countBefore: source.count };
      order({
        type: 'sectorInventory',
        sector: 'cordoba',
        operativeId: localDoctorId,
        direction: 'take',
        sourceKey: source.key,
        expected: source.expected,
        count: deficit,
      });
      assert.equal(
        sectorInventoryModel(c, 'cordoba', rosterFor(c), localDoctorId).entries.find(
          (row) => row.key === source.key,
        )?.count ?? 0,
        source.count - deficit,
      );
    }
    assert.ok(c.operativeState[localDoctorId].medkits >= localTarget);
    assert.ok(c.operativeState[physicianId].medkits >= physicianReserve);
    receipt.after = {
      local: c.operativeState[localDoctorId].medkits,
      physician: c.operativeState[physicianId].medkits,
    };
    assert.equal(
      receipt.before.local + receipt.before.physician,
      receipt.after.local + receipt.after.physician,
    );
    assert.deepEqual(c.squads, start.squads);
    assert.equal(c.activeSquadId, start.activeSquadId);
    for (const id of [localDoctorId, physicianId]) {
      for (const key of ['hp', 'bleeding', 'bandaged', 'assignment', 'location']) {
        assert.deepEqual(c.operativeState[id][key], start.operativeState[id][key]);
      }
    }
    receipt.completed = true;
    report({ event: 'blockedCoastMedicalReserve', ...receipt, campaign: c });
    return { campaign: c, receipt };
  } catch (error) {
    error.campaign = c;
    error.blockedCoastMedicalReserve = receipt;
    report({
      event: 'blockedCoastMedicalReserveStopped',
      reason: error.message,
      ...receipt,
      campaign: c,
    });
    throw error;
  }
}
