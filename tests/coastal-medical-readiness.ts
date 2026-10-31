import { present } from './assert-present.ts';
import { equipmentReceipt } from './equipment-receipt.ts';
import type { MedicalCourierReporter, FieldAidReadiness } from './medical-courier-types.ts';
import type { SectorInventoryEntry } from '../packages/game/public/sector-inventory-types.ts';
import type { CampaignSnapshot, CampaignAction } from '../packages/game/public/campaign-types.ts';
import assert from 'node:assert/strict';
import { rosterFor } from '../packages/game/campaign.js';
import { operativeLocation } from '../packages/game/squads.js';
import { contractExpiresSeconds } from '../packages/game/contracts.js';
import { sectorInventoryModel } from '../packages/game/sector-inventory.js';
import { collectRouteMedicalSupplies } from './finite-route-equipment.ts';
import { order, saved } from './local-contract-fixture.ts';

const clock = (c: CampaignSnapshot) => c.hour * 3600 + (c.secondOfHour ?? 0);
const medicalRows = (c: CampaignSnapshot, sector: string, id: number) =>
  sectorInventoryModel(c, sector, rosterFor(c), id).entries.filter(
    (row) => equipmentReceipt(row.expected).item === 'medkits',
  );

// Before the next march, one current conscious field medic retains two real
// dressings. A local paid caregiver may carry the deficit from finite stock.
export function prepareCoastalFieldAid(
  start: CampaignSnapshot,
  {
    caregiverIds = [],
    report = () => {},
  }: { caregiverIds?: number[]; report?: MedicalCourierReporter } = {},
) {
  let c = start;
  const field = [...c.squad],
    clinic = c.location,
    selection = c.activeSquadId,
    target = 2,
    started = clock(c),
    serving = c.recruited.filter(
      (id) => present(c.operativeState[id]).alive && !present(c.operativeState[id]).captured,
    ),
    dead = Object.entries(c.operativeState)
      .filter(([, r]) => !r.alive)
      .map(([id]) => Number(id));
  const safe = () => {
    assert.equal(
      c.pendingBattle,
      null,
      'finish the actual battle before collecting the field reserve',
    );
    assert.equal(
      c.pendingEncounter,
      null,
      'resolve the real medical courier contact before leaving the clinic',
    );
    for (const id of field) {
      const r = present(c.operativeState[id]);
      assert.ok(
        c.recruited.includes(id) && r.alive && !r.captured && r.hp >= 15 && !r.bleeding,
        'stabilize every actual field survivor before the dressing journey',
      );
    }
    for (const id of serving) {
      const expiry = contractExpiresSeconds(c.contracts[id]);
      assert.ok(
        c.recruited.includes(id) &&
          present(c.operativeState[id]).alive &&
          !present(c.operativeState[id]).captured,
        'retain the actual serving cohort',
      );
      assert.ok(
        expiry === null || expiry > clock(c),
        'the actual medical courier and clinic must remain under paid service',
      );
    }
    for (const id of dead) {
      assert.equal(
        present(c.operativeState[id]).alive,
        false,
        'finite medical collection cannot restore a casualty',
      );
    }
  };
  safe();
  const admitted = (id: number) => {
    const r = present(c.operativeState[id]);
    return (
      c.recruited.includes(id) &&
      r.alive &&
      !r.captured &&
      r.hp >= 15 &&
      !r.bleeding &&
      !r.unconscious &&
      !r.routed &&
      !r.asleep &&
      r.energy > 10 &&
      operativeLocation(c, id) === clinic &&
      !sectorInventoryModel(c, clinic, rosterFor(c), id).reason
    );
  };
  const medic = rosterFor(c)
    .filter((op) => field.includes(op.id) && op.medical > 0 && admitted(op.id))
    .sort((a, b) => b.medical - a.medical || a.id - b.id)[0];
  assert.ok(medic, 'a conscious local field medic must actually admit inventory before departure');
  const initial = present(c.operativeState[medic.id]).medkits ?? 0,
    proof: FieldAidReadiness = {
      medicId: medic.id,
      target,
      initialDressings: initial,
      collected: 0,
      courierId: null,
      elapsedSeconds: 0,
    };
  if (initial >= target) {
    return { campaign: c, readiness: proof };
  }
  const issue = (action: CampaignAction) => {
    c = order(c, action);
    safe();
    report({
      event: 'coastalFieldAidOrder',
      action: structuredClone(action),
      hour: c.hour,
      secondOfHour: c.secondOfHour ?? 0,
    });
  };
  const take = (row: SectorInventoryEntry) => {
    const count = Math.min(row.count, target - present(c.operativeState[medic.id]).medkits),
      before = present(c.operativeState[medic.id]).medkits,
      pool = medicalRows(c, clinic, medic.id).reduce((sum, row) => sum + row.count, 0),
      cash = c.resources.treasury,
      time = clock(c);
    issue({
      type: 'sectorInventory',
      sector: clinic,
      operativeId: medic.id,
      direction: 'take',
      sourceKey: row.key,
      expected: row.expected,
      count,
    });
    assert.equal(present(c.operativeState[medic.id]).medkits, before + count);
    assert.equal(
      medicalRows(c, clinic, medic.id).reduce((sum, row) => sum + row.count, 0),
      pool - count,
      'the real known medical pool must lose every taken piece',
    );
    assert.equal(c.resources.treasury, cash);
    assert.equal(clock(c), time);
    proof.collected += count;
  };
  while (present(c.operativeState[medic.id]).medkits < target) {
    const row = medicalRows(c, clinic, medic.id).find((row) => row.reachable && row.count > 0);
    if (!row) {
      break;
    }
    take(row);
  }
  if (present(c.operativeState[medic.id]).medkits < target) {
    const needed = target - present(c.operativeState[medic.id]).medkits,
      courierId = caregiverIds.find(admitted) ?? medic.id,
      carried = present(c.operativeState[courierId]).medkits;
    const found = collectRouteMedicalSupplies(c, courierId, needed, { report });
    c = found.campaign;
    safe();
    assert.equal(
      found.collected,
      needed,
      'the finite source must supply the declared two-piece reserve',
    );
    assert.equal(present(c.operativeState[courierId]).medkits, carried + needed);
    assert.equal(
      operativeLocation(c, courierId),
      clinic,
      'the actual courier must finish the return march',
    );
    assert.ok(
      !present(c.squads.find((q) => q.members.includes(courierId))).journey,
      'the actual courier must arrive before unloading',
    );
    assert.ok(
      admitted(courierId),
      'the returned courier must be awake and admit the real unloading order',
    );
    proof.courierId = courierId;
    if (courierId !== medic.id) {
      const keys = new Set(medicalRows(c, clinic, medic.id).map((row) => row.key));
      issue({
        type: 'sectorInventory',
        sector: clinic,
        operativeId: courierId,
        direction: 'drop',
        item: 'medkits',
        count: needed,
      });
      assert.equal(
        present(c.operativeState[courierId]).medkits,
        carried,
        'the courier retains every dressing carried before the collection',
      );
      const row = medicalRows(c, clinic, medic.id).find(
        (row) => !keys.has(row.key) && row.reachable && row.count === needed,
      );
      assert.ok(row, 'the field medic must reach the actual delivered parcel');
      take(row);
    } else {
      proof.collected += needed;
    }
  }
  if (c.activeSquadId !== selection) {
    issue({ type: 'selectSquad', id: selection });
  }
  assert.deepEqual(
    [...c.squad].sort((a, b) => a - b),
    [...field].sort((a, b) => a - b),
    'the real courier must return to the same field cohort',
  );
  if (c.squad.some((id, index) => id !== field[index])) {
    issue({ type: 'squad', ids: field });
  }
  assert.deepEqual(c.squad, field);
  assert.equal(c.location, clinic);
  assert.equal(present(c.operativeState[medic.id]).medkits, target);
  safe();
  proof.elapsedSeconds = clock(c) - started;
  report({ event: 'coastalFieldAidReady', ...proof, clinic });
  return { campaign: saved({ campaign: c }).campaign, readiness: proof };
}
