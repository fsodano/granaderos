import { jsonRoundTrip } from './json-round-trip.ts';
import { present } from './assert-present.ts';
import { advanceMilitaryWoundClock } from '../packages/game/military-health.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ResidentPresence } from '../packages/game/domain/world/resident-presence.ts';
import {
  GroundSupply,
  ResidentSupplies,
  ScavengingPolicy,
} from '../packages/game/domain/world/resident-supplies.ts';
import {
  createContentSession,
  advancePlacementState,
  changePlacementStatus,
} from '../packages/game/content-placement.js';
import { defaultContentPackage } from '../packages/game/content-package.js';
import { initialCampaign } from '../packages/game/campaign.js';
import { encountersFor } from '../packages/game/encounters.js';
import {
  synchronizeCampaignPresence,
  reconcileSectorResidents,
} from '../packages/game/campaign-presence.js';
import {
  advanceResidentScavenging,
  acknowledgeRemovedResidents,
  advanceResidentConditions,
  acknowledgeResidentConditions,
  advanceUnloadedCivilians,
  acknowledgeCivilians,
} from '../packages/game/campaign-civilians.js';
import {
  advanceSectorWorld,
  advanceCampaignWorld,
  validateSectorWorld,
} from '../packages/game/military-remains.js';
import { advanceCivilianTime } from '../packages/game/npc-ai.js';
import { createBattle } from '../packages/game/tactical.js';
import { Corpse, DEFAULT_CORPSE_LIFETIME_SECONDS } from '../packages/game/domain/world/corpse.ts';

function movingContent() {
  const content = defaultContentPackage();
  Object.assign(present(content.placements[0]), {
    mode: 'daily',
    sectors: ['cell-27-28', 'cell-25-28'],
    selection: 'alternate',
    loadedGuard: 'range',
    moveChance: 100,
  });
  return content;
}

function residentScene() {
  const campaign = initialCampaign();
  const resident = encountersFor(campaign, 'buenos_aires').find(
    (resident) => resident.operativeId === 4,
  );
  present(campaign.operativeState[4]).rations = 0;
  present(present(resident).civilianSupplies).rations = 0;
  const scene = createBattle([], {
    id: 'resident-test',
    sector: 'buenos_aires',
    hour: 0,
    exploration: true,
    npcs: [resident],
    enemies: [],
    groundItems: [
      {
        id: 'unattended-rations',
        type: 'rations',
        count: 3,
        x: present(resident).x,
        y: present(resident).y,
      },
    ],
  });
  return { campaign, scene };
}

void test('resident presence prevents movement after death and preserves the death record', () => {
  const resident = new ResidentPresence({
    alive: true,
    recruited: false,
    suspended: false,
    appeared: true,
    revision: 1,
    sector: 'a',
    hp: 80,
  });
  resident.moveTo('b');
  assert.equal(resident.toSnapshot().revision, 2);
  assert.equal(resident.toSnapshot().hp, 80);
  resident.recordDeath();
  assert.throws(() => resident.moveTo('a'));
  assert.throws(() => resident.changeService(true));
  assert.equal(resident.toSnapshot().hp, 0);
  assert.equal(resident.sector, null);
});

void test('daily resident movement is identical in loaded and inactive sectors and across time step sizes', () => {
  const original = createContentSession(movingContent(), 9);
  const loaded = advancePlacementState(original, 1680, 'cell-27-28');
  const inactive = advancePlacementState(original, 1680);
  const split = advancePlacementState(
    advancePlacementState(original, 240, 'cell-25-28'),
    1680,
    'cell-25-28',
  );
  assert.deepEqual(loaded, inactive);
  assert.deepEqual(split, inactive);
  assert.equal(
    present(inactive.people['person-3']).revision,
    present(original.people['person-3']).revision + 2,
  );
  const dead = changePlacementStatus(original, 'person-3', 'dead');
  assert.equal(present(advancePlacementState(dead, 1680).people['person-3']).sector, null);
});

void test('campaign movement carries canonical wounds and supplies and updates both sector projections', () => {
  const campaign = initialCampaign(9, movingContent());
  const characterId = 'person-3';
  const before = present(present(present(campaign.contentPresence).people[characterId]).sector);
  const origin = createBattle([], {
    id: 'origin',
    sector: before,
    hour: campaign.hour,
    npcs: encountersFor(campaign, before),
    exploration: true,
    enemies: [],
  });
  const destinationId = before === 'cell-27-28' ? 'cell-25-28' : 'cell-27-28';
  const destination = createBattle([], {
    id: 'destination',
    sector: destinationId,
    hour: campaign.hour,
    npcs: [],
    exploration: true,
    enemies: [],
  });
  campaign.sectorStates[before] = origin;
  campaign.sectorStates[destinationId] = destination;
  present(campaign.operativeState[3]).hp = 81;
  present(campaign.operativeState[3]).rations = 1;
  campaign.hour = 28;
  synchronizeCampaignPresence(campaign);
  assert.equal(
    present(present(campaign.contentPresence).people[characterId]).sector,
    destinationId,
  );
  assert.equal(
    origin.npcs.some((resident) => resident.operativeId === 3),
    false,
  );
  const arrived = destination.npcs.find((resident) => resident.operativeId === 3);
  assert.ok(arrived);
  assert.equal(arrived.hp, 81);
  assert.equal(present(arrived.civilianSupplies).rations, 1);
  const point = { x: arrived.x, y: arrived.y };
  reconcileSectorResidents(campaign, destination);
  assert.deepEqual(
    {
      x: present(destination.npcs.find((resident) => resident.operativeId === 3)).x,
      y: present(destination.npcs.find((resident) => resident.operativeId === 3)).y,
    },
    point,
  );
});

void test('resident scavenging conserves one finite unit and refuses empty, distant, or already supplied choices', () => {
  const resident = new ResidentSupplies('person', 1, 1, {
    rations: 0,
    medkits: 1,
    torches: 1,
    boleadoras: 1,
  });
  const source = new GroundSupply('source', 'rations', 2, 2, 1);
  const policy = new ScavengingPolicy();
  assert.equal(
    policy.selectSupply(resident, [new GroundSupply('far', 'rations', 1, 4, 1), source]),
    source,
  );
  const custody = source.transferOneTo(resident);
  assert.equal(custody.toSnapshot().custodian.id, 'person');
  assert.equal(source.quantity, 1);
  assert.equal(resident.quantityOf('rations'), 1);
  assert.equal(policy.selectSupply(resident, [source]), null);
  assert.throws(() => new GroundSupply('empty', 'rations', 0, 1, 1).transferOneTo(resident));
});

void test('hourly scavenging updates canonical supplies and cannot repeat after saved restoration', () => {
  const { campaign, scene } = residentScene();
  advanceResidentScavenging(campaign, scene, 3599);
  assert.equal(present(campaign.operativeState[4]).rations, 0);
  advanceResidentScavenging(campaign, scene, 3600);
  assert.equal(present(campaign.operativeState[4]).rations, 1);
  assert.equal(present(present(scene.npcs[0]).civilianSupplies).rations, 1);
  assert.equal(present(scene.groundItems[0]).count, 2);
  assert.equal(present(scene.residentScavengingReceipts).length, 1);
  const restored = jsonRoundTrip({ campaign, scene });
  advanceResidentScavenging(restored.campaign, restored.scene, 3600);
  advanceResidentScavenging(restored.campaign, restored.scene, 7200);
  assert.equal(present(restored.scene.groundItems[0]).count, 2);
  assert.equal(present(restored.scene.residentScavengingReceipts).length, 1);
});

void test('scavenging preserves held and quest supplies and respects equipment appearance time', () => {
  const { campaign, scene } = residentScene();
  present(scene.groundItems[0]).heldBy = 'player';
  advanceResidentScavenging(campaign, scene, 3600);
  assert.equal(present(scene.groundItems[0]).count, 3);
  delete present(scene.groundItems[0]).heldBy;
  present(scene.groundItems[0]).questDelivery = true;
  advanceResidentScavenging(campaign, scene, 7200);
  assert.equal(present(scene.groundItems[0]).count, 3);
  delete present(scene.groundItems[0]).questDelivery;
  scene.worldItemAvailability = { 'unattended-rations': 14400 };
  advanceResidentScavenging(campaign, scene, 10800);
  assert.equal(present(scene.groundItems[0]).count, 3);
  advanceResidentScavenging(campaign, scene, 14400);
  assert.equal(present(scene.groundItems[0]).count, 2);
  assert.equal(present(present(scene.residentScavengingReceipts)[0]).second, 14400);
});

void test('resident corpse removal retains death facts and finite civilian supplies and weapons', () => {
  const { campaign, scene } = residentScene();
  const resident = scene.npcs[0];
  present(resident).hp = 0;
  present(resident).unconscious = false;
  present(campaign.operativeState[4]).alive = false;
  present(campaign.operativeState[4]).hp = 0;
  campaign.civilianState = {
    version: 2,
    people: {
      'person-4': {
        npcId: present(resident).id,
        sector: scene.sectorId,
        sceneId: null,
        health: { hp: 0 },
      },
    },
  };
  const weapons = Object.values(present(present(resident).civilianWeapons)).filter(
    (value) => value && typeof value === 'object',
  ).length;
  const medkits = present(present(resident).civilianSupplies).medkits;
  advanceSectorWorld(scene, 0);
  advanceSectorWorld(scene, DEFAULT_CORPSE_LIFETIME_SECONDS);
  acknowledgeRemovedResidents(campaign, scene);
  assert.equal(scene.npcs.length, 0);
  assert.equal(present(present(scene.deathHistory)[0]).kind, 'resident');
  assert.equal(scene.groundItems.filter((item) => item.item === 'weapon').length, weapons);
  assert.equal(present(scene.groundItems.find((item) => item.item === 'medkits')).count, medkits);
  assert.equal(present(campaign.operativeState[4]).medkits, 0);
  assert.equal(present(campaign.civilianState.people['person-4']).health.hp, 0);
  assert.equal(
    present(campaign.civilianState.people['person-4']).corpseRemovedAtSecond,
    DEFAULT_CORPSE_LIFETIME_SECONDS,
  );
  validateSectorWorld(scene);
});

void test('local resident routines and collection share the same events in loaded and inactive sectors', () => {
  const loaded = residentScene();
  const inactive = structuredClone(loaded);
  const split = structuredClone(loaded);
  const originalPosition = {
    x: present(loaded.scene.npcs[0]).x,
    y: present(loaded.scene.npcs[0]).y,
  };
  for (let second = 6; second <= 7200; second += 6) {
    loaded.scene.elapsedSeconds = second;
    advanceCivilianTime(loaded.scene, 6);
    advanceSectorWorld(loaded.scene, second);
    advanceResidentScavenging(loaded.campaign, loaded.scene, second);
  }
  inactive.campaign.sectorStates[inactive.scene.sectorId] = inactive.scene;
  inactive.campaign.hour = 2;
  advanceCampaignWorld(inactive.campaign);
  split.campaign.sectorStates[split.scene.sectorId] = split.scene;
  for (let hour = 1; hour <= 2; hour++) {
    split.campaign.hour = hour;
    advanceCampaignWorld(split.campaign);
  }
  for (const scene of [inactive.scene, split.scene]) {
    assert.deepEqual(scene.npcs, loaded.scene.npcs);
    assert.deepEqual(scene.groundItems, loaded.scene.groundItems);
    assert.deepEqual(scene.residentRoutine, loaded.scene.residentRoutine);
    assert.deepEqual(scene.residentScavengingReceipts, loaded.scene.residentScavengingReceipts);
    assert.equal(scene.civilianTurns, loaded.scene.civilianTurns);
  }
  assert.notDeepEqual(
    { x: present(loaded.scene.npcs[0]).x, y: present(loaded.scene.npcs[0]).y },
    originalPosition,
  );
  assert.equal(
    present(inactive.campaign.operativeState[4]).rations,
    present(loaded.campaign.operativeState[4]).rations,
  );
});

void test('resident wounds and death time are identical through loaded, retained, and suspended routines', () => {
  const loaded = residentScene();
  Object.assign(present(loaded.scene.npcs[0]), {
    hp: 19,
    bleeding: 2,
    bandaged: 0,
    civilianWoundVersion: 1,
    bleedSource: { attackerId: null, side: 'unknown', militia: false, intentional: false },
  });
  acknowledgeResidentConditions(loaded.campaign, loaded.scene, 0);
  advanceSectorWorld(loaded.scene, 0);
  const retained = structuredClone(loaded);
  const suspended = structuredClone(loaded);
  for (let second = 6; second <= 120; second += 6) {
    loaded.scene.elapsedSeconds = second;
    advanceResidentConditions(loaded.campaign, loaded.scene, 6, second);
    advanceSectorWorld(loaded.scene, second);
    advanceCivilianTime(loaded.scene, 6);
    acknowledgeResidentConditions(loaded.campaign, loaded.scene, second);
  }
  retained.campaign.sectorStates[retained.scene.sectorId] = retained.scene;
  retained.campaign.hour = 0;
  retained.campaign.secondOfHour = 120;
  advanceUnloadedCivilians(retained.campaign, 120);
  advanceCampaignWorld(retained.campaign);
  suspended.campaign.suspendedSectorSessions = [
    {
      request: {
        id: 'resident-suspended',
        sector: suspended.scene.sectorId,
        squad: [],
        npcs: suspended.scene.npcs,
      },
      snapshot: suspended.scene,
    },
  ];
  suspended.campaign.hour = 0;
  suspended.campaign.secondOfHour = 120;
  advanceUnloadedCivilians(suspended.campaign, 120);
  advanceCampaignWorld(suspended.campaign);
  for (const value of [retained, suspended]) {
    assert.deepEqual(value.scene.npcs, loaded.scene.npcs);
    assert.deepEqual(value.campaign.civilianState, loaded.campaign.civilianState);
    assert.equal(present(present(value.scene.npcs[0]).corpse).diedAtSecond, 60);
    assert.equal(present(value.campaign.operativeState[4]).alive, false);
  }
});

void test('one long loaded interval and split inactive intervals collect the same finite hourly supplies', () => {
  const loaded = residentScene();
  present(loaded.scene.npcs[0]).ai = { cycle: 0, homeId: null, activity: 'roaming', wait: 10000 };
  present(present(loaded.scene.npcs[0]).civilianSupplies).medkits = 0;
  present(loaded.campaign.operativeState[4]).medkits = 0;
  loaded.scene.groundItems.push({
    id: 'z-dressings',
    type: 'medkits',
    count: 2,
    x: present(loaded.scene.npcs[0]).x,
    y: present(loaded.scene.npcs[0]).y,
  });
  const inactive = structuredClone(loaded);
  loaded.scene.elapsedSeconds = 7200;
  advanceCivilianTime(loaded.scene, 7200);
  advanceSectorWorld(loaded.scene, 7200);
  advanceResidentScavenging(loaded.campaign, loaded.scene, 7200);
  inactive.campaign.sectorStates[inactive.scene.sectorId] = inactive.scene;
  for (let hour = 1; hour <= 2; hour++) {
    inactive.campaign.hour = hour;
    advanceCampaignWorld(inactive.campaign);
  }
  assert.deepEqual(inactive.scene.groundItems, loaded.scene.groundItems);
  assert.deepEqual(inactive.scene.npcs, loaded.scene.npcs);
  assert.deepEqual(
    inactive.scene.residentScavengingReceipts,
    loaded.scene.residentScavengingReceipts,
  );
  assert.deepEqual(
    present(loaded.scene.residentScavengingReceipts).map((receipt) => [
      receipt.second,
      receipt.kind,
    ]),
    [
      [3600, 'rations'],
      [7200, 'medkits'],
    ],
  );
  assert.equal(present(loaded.campaign.operativeState[4]).rations, 1);
  assert.equal(present(loaded.campaign.operativeState[4]).medkits, 1);
  assert.deepEqual(loaded.campaign.civilianState, inactive.campaign.civilianState);
});

void test('a loaded collection receipt is acknowledged once by the civilian report', () => {
  const { campaign, scene } = residentScene();
  present(scene.npcs[0]).ai = { cycle: 0, homeId: null, activity: 'roaming', wait: 10000 };
  campaign.pendingBattle = {
    id: present(scene.battleId),
    sector: scene.sectorId,
    npcs: structuredClone(scene.npcs),
    squad: [],
  };
  scene.elapsedSeconds = 3600;
  advanceCivilianTime(scene, 3600);
  assert.equal(present(present(scene.npcs[0]).civilianSupplies).rations, 1);
  assert.equal(present(campaign.operativeState[4]).rations, 0);
  acknowledgeCivilians(campaign, scene);
  assert.equal(present(campaign.operativeState[4]).rations, 1);
  assert.equal(
    present(present(present(campaign.civilianState).people['person-4']).scavengingReceiptIds)
      .length,
    1,
  );
  acknowledgeCivilians(campaign, scene);
  assert.equal(present(campaign.operativeState[4]).rations, 1);
  assert.equal(present(scene.groundItems[0]).count, 2);
});

void test('collection before a fatal wound occurs in the same order for loaded, split, retained, and suspended time', () => {
  const loaded = residentScene();
  loaded.scene.startSeconds = 3590;
  Object.assign(present(loaded.scene.npcs[0]), {
    hp: 19,
    bleeding: 2,
    bandaged: 0,
    civilianWoundVersion: 1,
    bleedSource: { attackerId: null, side: 'unknown', militia: false, intentional: false },
    ai: { cycle: 0, homeId: null, activity: 'roaming', wait: 10000 },
  });
  acknowledgeResidentConditions(loaded.campaign, loaded.scene, 3590);
  advanceSectorWorld(loaded.scene, 3590);
  const split = structuredClone(loaded);
  const retained = structuredClone(loaded);
  const suspended = structuredClone(loaded);
  loaded.scene.elapsedSeconds = 120;
  advanceCivilianTime(loaded.scene, 120);
  advanceSectorWorld(loaded.scene, 3710);
  acknowledgeResidentConditions(loaded.campaign, loaded.scene, 3710);
  advanceResidentScavenging(loaded.campaign, loaded.scene, 3710);
  for (let elapsed = 5; elapsed <= 120; elapsed += 5) {
    split.scene.elapsedSeconds = elapsed;
    advanceCivilianTime(split.scene, 5);
    advanceSectorWorld(split.scene, 3590 + elapsed);
    acknowledgeResidentConditions(split.campaign, split.scene, 3590 + elapsed);
    advanceResidentScavenging(split.campaign, split.scene, 3590 + elapsed);
  }
  retained.campaign.sectorStates[retained.scene.sectorId] = retained.scene;
  suspended.campaign.suspendedSectorSessions = [
    {
      request: {
        id: 'resident-suspended',
        sector: suspended.scene.sectorId,
        squad: [],
        npcs: suspended.scene.npcs,
      },
      snapshot: suspended.scene,
    },
  ];
  for (const state of [retained, suspended]) {
    state.campaign.hour = 1;
    state.campaign.secondOfHour = 110;
    advanceCampaignWorld(state.campaign);
  }
  assert.equal(present(present(loaded.scene.npcs[0]).corpse).diedAtSecond, 3650);
  assert.equal(present(present(loaded.scene.npcs[0]).civilianSupplies).rations, 1);
  assert.deepEqual(
    present(loaded.scene.residentScavengingReceipts).map((receipt) => receipt.second),
    [3600],
  );
  for (const state of [split, retained, suspended]) {
    assert.deepEqual(state.scene.npcs, loaded.scene.npcs);
    assert.deepEqual(state.scene.groundItems, loaded.scene.groundItems);
    assert.deepEqual(
      state.scene.residentScavengingReceipts,
      loaded.scene.residentScavengingReceipts,
    );
    assert.equal(state.scene.residentConditionSecond, 3710);
    assert.deepEqual(state.campaign.civilianState, loaded.campaign.civilianState);
  }
});

void test('a corpse that expires at an hourly event releases supplies before collection in every sector mode', () => {
  const loaded = residentScene();
  const startsAt = DEFAULT_CORPSE_LIFETIME_SECONDS - 10;
  loaded.scene.startSeconds = startsAt;
  present(loaded.scene.npcs[0]).ai = { cycle: 0, homeId: null, activity: 'roaming', wait: 10000 };
  loaded.scene.groundItems = [];
  const body = createBattle([{ id: 99, hp: 0, rations: 1 }], { exploration: true, enemies: [] })
    .units[0];
  Object.assign(present(body), {
    x: present(loaded.scene.npcs[0]).x,
    y: present(loaded.scene.npcs[0]).y,
  });
  present(body).corpse = Corpse.recordDeath('99', loaded.scene.sectorId, 0).toSnapshot();
  loaded.scene.units.push(present(body));
  advanceSectorWorld(loaded.scene, startsAt);
  const retained = structuredClone(loaded);
  const suspended = structuredClone(loaded);
  loaded.scene.elapsedSeconds = 20;
  advanceCivilianTime(loaded.scene, 20);
  advanceSectorWorld(loaded.scene, startsAt + 20);
  advanceResidentScavenging(loaded.campaign, loaded.scene, startsAt + 20);
  retained.campaign.sectorStates[retained.scene.sectorId] = retained.scene;
  suspended.campaign.suspendedSectorSessions = [
    {
      request: {
        id: 'resident-suspended',
        sector: suspended.scene.sectorId,
        squad: [],
        npcs: suspended.scene.npcs,
      },
      snapshot: suspended.scene,
    },
  ];
  for (const state of [retained, suspended]) {
    state.campaign.hour = 72;
    state.campaign.secondOfHour = 10;
    advanceCampaignWorld(state.campaign);
    assert.deepEqual(state.scene.groundItems, loaded.scene.groundItems);
    assert.deepEqual(state.scene.npcs, loaded.scene.npcs);
    assert.deepEqual(state.scene.deathHistory, loaded.scene.deathHistory);
    assert.deepEqual(
      state.scene.residentScavengingReceipts,
      loaded.scene.residentScavengingReceipts,
    );
  }
  assert.equal(
    present(present(loaded.scene.residentScavengingReceipts)[0]).second,
    DEFAULT_CORPSE_LIFETIME_SECONDS,
  );
  assert.equal(present(present(loaded.scene.npcs[0]).civilianSupplies).rations, 1);
  assert.equal(loaded.scene.units.length, 0);
});

void test('military bleeding and resident movement share the same accepted event sequence outside service caches', () => {
  const loaded = residentScene();
  const enemy = createBattle([], {
    enemies: [{ id: 'injured-guard', hp: 19, bleeding: 2, x: 6, y: 7 }],
    exploration: true,
  }).units[0];
  loaded.scene.units.push(present(enemy));
  advanceSectorWorld(loaded.scene, 0);
  const retained = structuredClone(loaded);
  const suspended = structuredClone(loaded);
  loaded.scene.elapsedSeconds = 120;
  advanceCivilianTime(loaded.scene, 120, () => true, {
    beforeConditions: (atSecond: number) =>
      advanceMilitaryWoundClock(loaded.scene, atSecond, { initialSecond: 0 }),
  });
  advanceSectorWorld(loaded.scene, 120);
  retained.campaign.sectorStates[retained.scene.sectorId] = retained.scene;
  suspended.campaign.suspendedSectorSessions = [
    {
      request: {
        id: 'resident-suspended',
        sector: suspended.scene.sectorId,
        squad: [],
        npcs: suspended.scene.npcs,
      },
      snapshot: suspended.scene,
    },
  ];
  for (const state of [retained, suspended]) {
    state.campaign.hour = 0;
    state.campaign.secondOfHour = 120;
    advanceCampaignWorld(state.campaign);
    assert.deepEqual(state.scene.npcs, loaded.scene.npcs);
    assert.equal(present(state.scene.units[0]).hp, present(loaded.scene.units[0]).hp);
    assert.deepEqual(present(state.scene.units[0]).corpse, present(loaded.scene.units[0]).corpse);
    assert.equal(state.scene.militaryConditionSecond, 120);
  }
  assert.equal(present(present(loaded.scene.units[0]).corpse).diedAtSecond, 60);
});

void test('daily movement reconciles suspended sector references while retaining canonical personal supplies', () => {
  const campaign = initialCampaign(9, movingContent());
  const before = present(present(present(campaign.contentPresence).people['person-3']).sector);
  const origin = createBattle([], {
    id: 'suspended-origin',
    sector: before,
    hour: campaign.hour,
    npcs: encountersFor(campaign, before),
    exploration: true,
    enemies: [],
  });
  const destinationId = before === 'cell-27-28' ? 'cell-25-28' : 'cell-27-28';
  const destination = createBattle([], {
    id: 'retained-destination',
    sector: destinationId,
    hour: campaign.hour,
    npcs: [],
    exploration: true,
    enemies: [],
  });
  const request = {
    id: 'resident-retained',
    sector: present(before),
    squad: [],
    npcs: structuredClone(origin.npcs),
  };
  campaign.suspendedSectorSessions = [{ request, snapshot: origin }];
  campaign.sectorStates[destinationId] = destination;
  present(campaign.operativeState[3]).rations = 1;
  campaign.hour = 28;
  synchronizeCampaignPresence(campaign);
  assert.equal(
    origin.npcs.some((resident) => resident.operativeId === 3),
    false,
  );
  assert.equal(
    request.npcs.some((resident) => resident.operativeId === 3),
    false,
  );
  assert.equal(
    present(
      present(destination.npcs.find((resident) => resident.operativeId === 3)).civilianSupplies,
    ).rations,
    1,
  );
});
