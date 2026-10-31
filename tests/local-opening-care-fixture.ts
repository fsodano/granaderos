import { equipmentReceipt } from './equipment-receipt.ts';
import type { CacheApproach } from './finite-cache-driver.ts';
export type OpeningCare = {
  hours: number;
  restHours: number;
  stockWaitHours: number;
  contractCost: number;
  dressingsBought: number;
  dressingCost: number;
  weaponCost: number;
  workshopCost: number;
  dressingsFound: number;
  donatedDressings: number;
  weaponsFound: number;
  repairPointsSpent: number;
  repairHours: number;
  initialDressings?: number;
  remainingDressings?: number;
  restBoundHours?: number;
  restStartedAt?: { hour: number; second: number };
  restFinishedAt?: { hour: number; second: number };
};
type OpeningOptions = {
  buyWeapons?: boolean;
  recovery?: 'doctor' | 'rest';
  caregiverIds?: number[];
  onCacheApproach?: (event: CacheApproach) => void;
};
import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import { present } from './assert-present.ts';
import { contractExpiresSeconds } from '../packages/game/contracts.js';
import { advanceCampaignHours } from './campaign-wait-fixture.ts';
import assert from 'node:assert/strict';
import { rosterFor } from '../packages/game/campaign.js';
import { doctorRate, careAssignmentReason } from '../packages/game/medical-care.js';
import { order, saved, visit, tactical } from './local-contract-fixture.ts';
import { takeFiniteCache, leaveFiniteCache, finiteCacheCarrier } from './finite-cache-driver.ts';
import { collectRouteItems, collectRouteMedicalSupplies } from './finite-route-equipment.ts';
import { FINITE_SECTOR_CACHES } from '../packages/game/finite-sector-caches.js';
import { repairMaterialPoints, REPAIR_KIT_POINTS } from '../packages/game/repair-materials.js';
import { sectorInventoryModel, sectorInventorySites } from '../packages/game/sector-inventory.js';
import { transportPath } from '../packages/game/logistics.js';
import { workAssignmentReason } from '../packages/game/assignments.js';
import { completeTestTravel } from './campaign-test-helpers.ts';
import { careRules } from '../packages/game/campaign-care-rules.js';
import { operativeLocation } from '../packages/game/squads.js';

// Actual finite found equipment and doctor/patient/repair/rest orders only.
// Select roles from current survivors; preserve all real wounds and casualties.
export function prepareLocalOpening(
  s: CampaignSnapshot,
  {
    buyWeapons = true,
    recovery = 'doctor',
    caregiverIds = [],
    onCacheApproach,
  }: OpeningOptions = {},
) {
  assert.ok(['doctor', 'rest'].includes(recovery), 'Choose actual doctor care or stable rest.');
  const earlierDeaths = Object.entries(s.operativeState)
    .filter(([, record]) => !record.alive)
    .map(([id]) => Number(id));
  const returnSector = s.location;
  const field = [...s.squad],
    careIds = [...new Set([...field, ...caregiverIds])];
  for (const id of caregiverIds) {
    assert.ok(
      s.recruited.includes(id) &&
        present(s.operativeState[id]).alive &&
        operativeLocation(s, id) === returnSector,
      'an auxiliary caregiver must actually serve at this clinic',
    );
  }
  const localMedical = sectorInventoryModel(
    s,
    s.location,
    rosterFor(s),
    s.squad.find((id) => present(s.operativeState[id]).hp >= 15),
  )
    .entries.filter((row) => row.reachable && equipmentReceipt(row.expected).item === 'medkits')
    .reduce((sum, row) => sum + row.count, 0);
  const sources = Object.entries(FINITE_SECTOR_CACHES)
    .filter(([at]) => s.sectors[at]?.owner === 'patriot' && transportPath(s, s.location, at))
    .map(([at, source]) => {
      const chest = s.sectorStates[at]?.props.find((prop) => prop.id === source.chest);
      return {
        at,
        available: chest
          ? present(chest.contents)
              .filter((item) => item.item === 'medkits')
              .reduce((sum, item) => sum + item.count, 0)
          : source.medical,
      };
    })
    .sort(
      (a, b) =>
        Number(b.at === s.location) - Number(a.at === s.location) || b.available - a.available,
    );
  let careSector =
    recovery === 'rest'
      ? returnSector
      : localMedical
        ? s.location
        : (sources.find((source) => source.available > 0)?.at ?? s.location);
  const care: OpeningCare = {
    hours: 0,
    restHours: 0,
    stockWaitHours: 0,
    contractCost: 0,
    dressingsBought: 0,
    dressingCost: 0,
    weaponCost: 0,
    workshopCost: 0,
    dressingsFound: 0,
    donatedDressings: 0,
    weaponsFound: 0,
    repairPointsSpent: 0,
    repairHours: 0,
  };
  const carriedDressings = () =>
    careIds.reduce((sum, id) => sum + present(s.operativeState[id]).medkits, 0);
  care.initialDressings = carriedDressings();
  const renewCareContracts = () => {
    for (const id of careIds) {
      const contract = s.contracts[id],
        expiry = contractExpiresSeconds(contract);
      if (expiry !== null && expiry < s.hour * 3600 + (s.secondOfHour ?? 0) + 24 * 3600) {
        const money = s.resources.treasury;
        s = order(s, {
          type: 'renewContract',
          id,
          term: 'week',
          expectedExpiresAt: present(present(contract).expiresAt),
        });
        care.contractCost += money - s.resources.treasury;
      }
    }
  };
  const restUntilReady = (id: number) => {
    s = order(s, { type: 'assignCare', id, assignment: 'rest' });
    for (
      let hour = 0;
      (present(s.operativeState[id]).asleep || present(s.operativeState[id]).energy <= 10) &&
      hour < 72;
      hour++
    ) {
      renewCareContracts();
      s = advanceCampaignHours(s, 1);
      care.stockWaitHours++;
    }
    assert.ok(
      !present(s.operativeState[id]).asleep && present(s.operativeState[id]).energy > 10,
      'The actual caregiver must finish sleep and rest before using finite stock.',
    );
  };
  renewCareContracts();
  // Treat the actual survivors at their present clinic. Stabilize their wounds
  // before any medical courier or whole-squad journey can spend strategic time.
  if (recovery === 'rest') {
    const resting = [...s.squad],
      wounded = resting.filter(
        (id) => present(s.operativeState[id]).hp < present(s.operativeState[id]).maxHp,
      ),
      restHealingHours = careRules(s).restHealingHours;
    const stable = () => {
      for (const id of resting) {
        const r = present(s.operativeState[id]);
        assert.ok(
          r.alive && !r.captured && r.hp >= 15,
          'ordinary rest requires the actual conscious uncaptured survivor',
        );
        assert.equal(r.bleeding, 0, 'stabilize every wound with actual first aid before resting');
      }
    };
    stable();
    care.restBoundHours =
      Math.max(
        0,
        ...wounded.map(
          (id) =>
            (present(s.operativeState[id]).maxHp - present(s.operativeState[id]).hp) *
            restHealingHours,
        ),
      ) + 72;
    care.restStartedAt = { hour: s.hour, second: s.secondOfHour ?? 0 };
    for (const id of resting) {
      s = order(s, { type: 'assignCare', id, assignment: 'rest' });
    }
    while (
      wounded.some((id) => present(s.operativeState[id]).hp < present(s.operativeState[id]).maxHp)
    ) {
      assert.ok(
        care.restHours < care.restBoundHours,
        'stable recovery must fit the actual wound deficit and ordinary sleep bound',
      );
      stable();
      renewCareContracts();
      const before = resting.map((id) => ({
          id,
          hp: present(s.operativeState[id]).hp,
          maxHp: present(s.operativeState[id]).maxHp,
          recoveryHours: present(s.operativeState[id]).recoveryHours,
        })),
        time = s.hour * 3600 + (s.secondOfHour ?? 0);
      s = advanceCampaignHours(s, 1);
      assert.equal(s.hour * 3600 + (s.secondOfHour ?? 0), time + 3600);
      care.restHours++;
      stable();
      for (const r of before) {
        const current = present(s.operativeState[r.id]);
        assert.ok(
          current.hp >= r.hp && current.hp <= Math.min(r.maxHp, r.hp + 1),
          'rest must earn health through ordinary hourly recovery',
        );
        if (r.hp < r.maxHp) {
          assert.ok(
            current.hp > r.hp || (current.recoveryHours ?? 0) > (r.recoveryHours ?? 0),
            'every actual rest hour must advance wound recovery',
          );
        }
      }
    }
    care.restFinishedAt = { hour: s.hour, second: s.secondOfHour ?? 0 };
  } else {
    while (true) {
      renewCareContracts();
      const roster = rosterFor(s).filter((o) => careIds.includes(o.id)),
        patient = roster
          .filter(
            (o) =>
              field.includes(o.id) &&
              (present(s.operativeState[o.id]).hp < o.maxHp ||
                present(s.operativeState[o.id]).bleeding),
          )
          .sort(
            (a, b) =>
              Number(present(s.operativeState[b.id]).bleeding > 0) -
                Number(present(s.operativeState[a.id]).bleeding > 0) || a.medical - b.medical,
          )[0];
      if (!patient) {
        break;
      }
      assert.ok(care.hours < 48, 'recovery must use bounded, paid campaign care');
      const doctor = roster
        .filter(
          (o) =>
            o.id !== patient.id &&
            o.medical >= 20 &&
            present(s.operativeState[o.id]).hp >= 15 &&
            !present(s.operativeState[o.id]).bleeding &&
            (caregiverIds.length || present(s.operativeState[o.id]).energy > 10),
        )
        .sort(
          (a, b) =>
            (caregiverIds.length
              ? 0
              : Number(present(s.operativeState[a.id]).asleep) -
                Number(present(s.operativeState[b.id]).asleep)) || b.medical - a.medical,
        )[0];
      assert.ok(doctor, 'a living local doctor is required');
      for (const o of roster) {
        s = order(s, {
          type: 'assignCare',
          id: o.id,
          assignment: caregiverIds.length ? 'rest' : 'active',
        });
      }
      // Marching and medical work can put the selected doctor to sleep. Let that
      // actual recovery finish before assigning care; do not wake an exhausted actor.
      restUntilReady(doctor.id);
      s = order(s, { type: 'assignCare', id: doctor.id, assignment: 'active' });
      if (!present(s.operativeState[doctor.id]).medkits) {
        let donor = roster.find(
          (o) =>
            o.id !== doctor.id &&
            present(s.operativeState[o.id]).medkits > 0 &&
            !sectorInventoryModel(s, s.location, rosterFor(s), o.id).reason,
        );
        if (!donor) {
          const stocked = roster.find(
            (o) =>
              o.id !== doctor.id &&
              present(s.operativeState[o.id]).hp >= 15 &&
              !present(s.operativeState[o.id]).bleeding &&
              present(s.operativeState[o.id]).medkits > 0 &&
              (present(s.operativeState[o.id]).asleep ||
                present(s.operativeState[o.id]).energy <= 10),
          );
          if (stocked) {
            restUntilReady(stocked.id);
            restUntilReady(doctor.id);
            s = order(s, { type: 'assignCare', id: doctor.id, assignment: 'active' });
            donor = roster.find(
              (o) =>
                o.id !== doctor.id &&
                present(s.operativeState[o.id]).medkits > 0 &&
                !sectorInventoryModel(s, s.location, rosterFor(s), o.id).reason,
            );
          }
        }
        if (donor) {
          s = order(s, {
            type: 'sectorInventory',
            sector: s.location,
            operativeId: donor.id,
            direction: 'drop',
            item: 'medkits',
            count: 1,
          });
          const row = sectorInventoryModel(s, s.location, rosterFor(s), doctor.id).entries.find(
            (row) => row.reachable && equipmentReceipt(row.expected).item === 'medkits',
          );
          assert.ok(row);
          s = order(s, {
            type: 'sectorInventory',
            sector: s.location,
            operativeId: doctor.id,
            direction: 'take',
            sourceKey: row.key,
            expected: row.expected,
            count: 1,
          });
          care.donatedDressings++;
        }
      }
      if (!present(s.operativeState[doctor.id]).medkits) {
        const needed = Math.max(
            1,
            Math.min(
              20,
              Math.ceil(
                (patient.maxHp - present(s.operativeState[patient.id]).hp) / doctorRate(doctor, s),
              ) + Number(present(s.operativeState[patient.id]).bleeding > 0),
            ),
          ),
          found = collectRouteMedicalSupplies(s, doctor.id, needed);
        s = found.campaign;
        care.dressingsFound += found.collected;
      }
      assert.equal(careAssignmentReason(s, doctor, 'doctor'), '');
      s = order(s, { type: 'assignCare', id: doctor.id, assignment: 'doctor' });
      s = order(s, { type: 'assignCare', id: patient.id, assignment: 'patient' });
      const stock = present(s.operativeState[doctor.id]).medkits;
      s = saved({ campaign: advanceCampaignHours(s, 1) }).campaign;
      assert.equal(present(s.operativeState[doctor.id]).medkits, stock - 1);
      care.hours++;
    }
  }
  care.remainingDressings = carriedDressings();
  assert.equal(
    care.initialDressings + care.dressingsFound - care.remainingDressings,
    care.hours,
    'every native medical work hour spends exactly one actual finite dressing',
  );
  // Worn firearms receive real mechanical work and spend carried kit points.
  for (const id of careIds) {
    s = order(s, { type: 'assignCare', id, assignment: 'active' });
  }
  for (
    let hour = 0;
    s.squad.some((id) => present(s.operativeState[id]).asleep) && hour < 72;
    hour++
  ) {
    renewCareContracts();
    s = advanceCampaignHours(s, 1);
  }
  assert.ok(
    s.squad.every((id) => !present(s.operativeState[id]).asleep),
    'real sleep must finish before local equipment recovery',
  );
  if (
    s.squad.some(
      (id) => present(s.operativeState[id]).condition < 100 || present(s.operativeState[id]).jammed,
    ) &&
    !rosterFor(s).some(
      (op) =>
        s.squad.includes(op.id) &&
        op.mechanical >= 20 &&
        repairMaterialPoints(present(s.operativeState[op.id])) > 0,
    )
  ) {
    const mechanic = rosterFor(s)
      .filter((op) => s.squad.includes(op.id) && op.mechanical >= 20)
      .sort((a, b) => b.mechanical - a.mechanical)[0];
    assert.ok(mechanic);
    const localTools = sectorInventorySites(s, s.location).some((site) =>
      sectorInventoryModel(s, site.id, rosterFor(s), mechanic.id).entries.some(
        (row) =>
          row.reachable && row.count > 0 && equipmentReceipt(row.expected).kind === 'repair-kit',
      ),
    );
    if (localTools) {
      careSector = s.location;
    } else {
      // Medical stock and tool stock have separate custody. A depleted clinic can
      // still have a finite toolkit, and a fallen mechanic may have lost its kit.
      const toolSource = Object.entries(FINITE_SECTOR_CACHES)
        .filter(([at]) => s.sectors[at]?.owner === 'patriot' && transportPath(s, s.location, at))
        .map(([at, source]) => {
          const chest = s.sectorStates[at]?.props.find((prop) => prop.id === source.chest);
          return {
            at,
            points: chest
              ? present(chest.contents)
                  .filter((item) => item.kind === 'repair-kit')
                  .reduce((sum, item) => sum + present(item.repairPoints), 0)
              : REPAIR_KIT_POINTS,
            path: transportPath(s, s.location, at),
          };
        })
        .filter((source) => source.points > 0)
        .sort((a, b) => present(a.path).length - present(b.path).length)[0];
      assert.ok(toolSource, 'equipment recovery needs an actual remaining finite toolkit source');
      careSector = toolSource.at;
    }
  }
  if (s.location !== careSector) {
    renewCareContracts();
    s = completeTestTravel(s, { sector: careSector });
  }
  assert.equal(
    s.pendingEncounter,
    null,
    'resolve the actual equipment recovery journey before visiting its depot',
  );
  assert.equal(s.pendingBattle, null);
  assert.equal(s.location, careSector);
  assert.equal(
    present(s.squads.find((q) => q.id === s.activeSquadId)).journey,
    undefined,
    'equipment recovery needs an actual depot arrival',
  );
  // Recover only the one real rifle remaining in the local cache. Earlier
  // acquisition may already have removed it; never replace a depleted weapon.
  if (buyWeapons) {
    let p = visit(s);
    if (FINITE_SECTOR_CACHES[careSector]) {
      const opener = finiteCacheCarrier(p, s.squad);
      assert.ok(
        opener !== null,
        'finite equipment recovery needs an actual carrier with a reachable chest or ordinary doorway',
      );
      p = takeFiniteCache(p, opener, [], onCacheApproach ? { onApproach: onCacheApproach } : {});
    }
    const cache = present(p.battle).props.find(
        (prop) => prop.id === FINITE_SECTOR_CACHES[careSector]?.chest,
      ),
      rifle = cache?.contents?.find(
        (item) => typeof item.weapon === 'number' && [1800, 1801, 1802].includes(item.weapon),
      );
    if (rifle && typeof rifle.weapon === 'number') {
      const carrier = present(p.battle)
        .units.filter((u) => u.side === 'player' && u.hp >= 15 && !u.unconscious && !u.routed)
        .sort((a, b) => b.marksmanship - a.marksmanship)[0];
      assert.ok(carrier);
      p = takeFiniteCache(p, carrier.id, [{ weapon: rifle.weapon, count: 1 }]);
      const key = Object.keys(
        present(present(p.battle).units.find((u) => u.id === carrier.id)).inventory,
      ).find((key) => {
        const item = present(p.battle.units.find((u) => u.id === carrier.id)).inventory[key];
        return typeof item === 'object' && item.instanceId === rifle.instanceId;
      });
      p = tactical(p, { type: 'equipLoot', unitId: carrier.id, inventoryKey: present(key) });
      care.weaponsFound++;
    }
    s = leaveFiniteCache(p);
  }
  // Both wear and a retained ignition failure need finite material work. The
  // carried-equipment queue admits a full-condition jam without a fake wound.
  while (
    s.squad.some(
      (id) => present(s.operativeState[id]).condition < 100 || present(s.operativeState[id]).jammed,
    )
  ) {
    assert.ok(
      care.repairHours < 48,
      'finite weapon repair must finish through bounded hourly work',
    );
    renewCareContracts();
    let roster = rosterFor(s).filter((o) => s.squad.includes(o.id)),
      target = roster.find(
        (o) =>
          present(s.operativeState[o.id]).condition < 100 || present(s.operativeState[o.id]).jammed,
      ),
      mechanic = roster
        .filter(
          (o) =>
            o.mechanical >= 20 &&
            present(s.operativeState[o.id]).hp >= 15 &&
            !present(s.operativeState[o.id]).bleeding &&
            (present(s.operativeState[o.id]).energy ?? 100) > 10 &&
            !present(s.operativeState[o.id]).asleep,
        )
        .sort(
          (a, b) =>
            Number(repairMaterialPoints(present(s.operativeState[b.id])) > 0) -
              Number(repairMaterialPoints(present(s.operativeState[a.id])) > 0) ||
            b.mechanical - a.mechanical,
        )[0];
    assert.ok(mechanic, 'a living qualified mechanic with actual energy is required');
    if (!repairMaterialPoints(present(s.operativeState[mechanic.id]))) {
      s = collectRouteItems(s, mechanic.id, { kind: 'repair-kit' }, 1).campaign;
    }
    // Collection can advance real time and complete work or put an actor to
    // sleep. Select the current target and validate the current worker again.
    roster = rosterFor(s).filter((o) => s.squad.includes(o.id));
    target = roster.find(
      (o) =>
        present(s.operativeState[o.id]).condition < 100 || present(s.operativeState[o.id]).jammed,
    );
    if (!target) {
      continue;
    }
    const repairScope = present(s.operativeState[target.id]).jammed ? 'equipment' : 'primary';
    mechanic = roster
      .filter(
        (o) =>
          o.mechanical >= 20 &&
          !workAssignmentReason(s, o, 'repair', { targetId: target.id, repairScope }, roster),
      )
      .sort((a, b) => b.mechanical - a.mechanical)[0];
    assert.ok(
      mechanic,
      'repair must use a current target and an available mechanic with finite materials',
    );
    s = order(s, {
      type: 'assignWork',
      operativeId: mechanic.id,
      assignment: 'repair',
      targetId: target.id,
      repairScope,
    });
    const points = repairMaterialPoints(present(s.operativeState[mechanic.id]));
    s = advanceCampaignHours(s, 1);
    const spent = points - repairMaterialPoints(present(s.operativeState[mechanic.id]));
    assert.ok(spent > 0, 'actual repair must spend finite materials');
    care.repairPointsSpent += spent;
    care.repairHours++;
    s = order(s, { type: 'assignCare', id: mechanic.id, assignment: 'active' });
  }
  for (const id of s.squad) {
    s = order(s, { type: 'assignCare', id, assignment: 'rest' });
  }
  renewCareContracts();
  s = order(s, { type: 'wait', hours: 6 });
  for (const id of s.squad) {
    s = order(s, { type: 'assignCare', id, assignment: 'active' });
  }
  for (
    let hour = 0;
    s.squad.some((id) => present(s.operativeState[id]).asleep) && hour < 72;
    hour++
  ) {
    renewCareContracts();
    s = advanceCampaignHours(s, 1);
  }
  assert.ok(
    s.squad.every((id) => !present(s.operativeState[id]).asleep),
    'The squad must finish sleep before its return march.',
  );
  renewCareContracts();
  if (s.location !== returnSector) {
    s = completeTestTravel(s, { sector: returnSector });
  }
  assert.equal(
    s.pendingEncounter,
    null,
    'resolve the actual return journey before the next operation',
  );
  assert.equal(s.pendingBattle, null);
  assert.equal(s.location, returnSector);
  assert.equal(
    present(s.squads.find((q) => q.id === s.activeSquadId)).journey,
    undefined,
    'the squad must finish its real return march',
  );
  // Recover at the actual destination; the return march spends fatigue and energy.
  for (const id of s.squad) {
    if (
      !present(s.operativeState[id]).asleep &&
      (present(s.operativeState[id]).fatigue > 0 || present(s.operativeState[id]).energy < 100)
    ) {
      s = order(s, { type: 'setSleep', operativeId: id, asleep: true });
    }
  }
  for (
    let hour = 0;
    s.squad.some((id) => present(s.operativeState[id]).asleep) && hour < 72;
    hour++
  ) {
    renewCareContracts();
    s = advanceCampaignHours(s, 1);
  }
  assert.ok(
    s.squad.every((id) => !present(s.operativeState[id]).asleep),
    'The squad must complete actual sleep before the next operation.',
  );
  assert.equal(care.dressingCost, care.dressingsBought * 10);
  assert.equal(care.weaponCost, 0);
  assert.equal(care.workshopCost, 0);
  for (const o of rosterFor(s).filter((o) => s.squad.includes(o.id))) {
    assert.equal(present(s.operativeState[o.id]).hp, o.maxHp);
    assert.equal(present(s.operativeState[o.id]).energy, 100);
  }
  for (const id of earlierDeaths) {
    assert.equal(
      present(s.operativeState[id]).alive,
      false,
      'rest or care cannot restore an actual casualty',
    );
  }
  assert.deepEqual(
    [...s.squad].sort((a, b) => a - b),
    [...field].sort((a, b) => a - b),
    'local recovery must retain the same actual living field cohort before restoring its order',
  );
  if (s.squad.some((id, index) => id !== field[index])) {
    // A doctor rejoins at the end of a squad after a real finite courier trip.
    // Restore only the issued formation order through the ordinary squad action.
    const expected = structuredClone(s);
    expected.squad = [...field];
    present(expected.squads.find((q) => q.id === s.activeSquadId)).members = [...field];
    s = order(s, { type: 'squad', ids: field });
    assert.deepEqual(
      s,
      expected,
      'restoring field order must leave time, cash, health, contracts, supplies and every other campaign record unchanged',
    );
  }
  assert.deepEqual(
    s.squad,
    field,
    'auxiliary local care must preserve the actual living field cohort',
  );
  return { campaign: saved({ campaign: s }).campaign, care };
}
