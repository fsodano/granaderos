import { advanceMilitaryWoundClock } from '../game/military-health.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  Corpse,
  CorpseRemovalPolicy,
  DEFAULT_CORPSE_LIFETIME_SECONDS,
} from '../game/domain/world/corpse.ts';
import { ItemCustody, ItemCustodianKind } from '../game/domain/world/item-custody.ts';
import { WorldTimeline } from '../game/domain/world/world-timeline.ts';
import {
  advanceSectorWorld,
  advanceCampaignWorld,
  validateSectorWorld,
} from '../game/military-remains.js';
import { createBattle } from '../game/tactical.js';
import { validateBattleSnapshot } from '../game/validate-battle.js';
import { extractItemQuantity } from '../game/tactical-inventory.js';
import { makeOutfit } from '../game/outfits.js';
import { advanceResidentScavenging } from '../game/campaign-civilians.js';
import { initialCampaign } from './legacy-campaign-fixture.mjs';
import { dispatchCampaign } from '../game/campaign.js';
import { enterSector } from '../game/world.js';
import { syncBattleTime } from '../game/time.js';
import { encodeSave, decodeSave } from '../game/save.js';
import { refreshMilitaryCondition } from '../game/actor-condition.js';
import { advanceResidentRoutine } from '../game/npc-ai.js';

const START_SECOND = 8 * 3600;
const REMOVAL_SECOND = START_SECOND + DEFAULT_CORPSE_LIFETIME_SECONDS;

function sectorWithCorpse() {
  const field = createBattle(
    [
      { id: 1, name: 'Survivor', weapon: 1800 },
      {
        id: 2,
        name: 'Fallen combatant',
        hp: 0,
        weapon: 1800,
        weaponInstanceId: 'corpse-weapon',
        ammo: 7,
        loaded: 1,
        outfit: { ...makeOutfit(), instanceId: 'corpse-clothing' },
        inventory: { keepsake: { count: 1, weight: 0.1, instanceId: 'corpse-keepsake' } },
      },
    ],
    { id: 'retained-visit', sector: 'buenos_aires', hour: 8, exploration: true, enemies: [] },
  );
  field.units[1].knownToPlayer = true;
  return field;
}

test('a corpse owns its removal boundary and transfers each remaining item once', () => {
  const corpse = Corpse.recordDeath('character-1', 'sector-1', 60);
  const item = new ItemCustody('weapon-1', { kind: ItemCustodianKind.Corpse, id: corpse.id });
  assert.throws(() => corpse.removeAt(60 + DEFAULT_CORPSE_LIFETIME_SECONDS - 1, [item]));
  assert.equal(corpse.isPresent, true);
  assert.equal(item.heldBy({ kind: ItemCustodianKind.Corpse, id: corpse.id }), true);
  assert.deepEqual(corpse.removeAt(60 + DEFAULT_CORPSE_LIFETIME_SECONDS, [item]), ['weapon-1']);
  assert.equal(item.heldBy({ kind: ItemCustodianKind.Ground, id: 'sector-1' }), true);
  assert.equal(corpse.toSnapshot().characterId, 'character-1');
  assert.equal(corpse.isPresent, false);
  assert.throws(() => corpse.removeAt(60 + DEFAULT_CORPSE_LIFETIME_SECONDS, [item]));
});

test('invalid or stale item custody refuses corpse removal without a partial transfer', () => {
  const corpse = Corpse.recordDeath('character-1', 'sector-1', 0);
  const held = new ItemCustody('one', { kind: ItemCustodianKind.Corpse, id: corpse.id });
  const taken = new ItemCustody('two', { kind: ItemCustodianKind.Character, id: 'collector' });
  assert.throws(() => corpse.removeAt(DEFAULT_CORPSE_LIFETIME_SECONDS, [held, taken]));
  assert.equal(held.heldBy({ kind: ItemCustodianKind.Corpse, id: corpse.id }), true);
  assert.equal(corpse.isPresent, true);
  assert.throws(() =>
    taken.transferFrom(
      { kind: ItemCustodianKind.Corpse, id: corpse.id },
      { kind: ItemCustodianKind.Ground, id: 'sector-1' },
    ),
  );
  assert.throws(() => new CorpseRemovalPolicy(0));
});

test('world events use deterministic ordering and restoration cannot replay a completed event', () => {
  const timeline = WorldTimeline.startAt(0);
  timeline.schedule({ id: 'second', kind: 'arrival', subjectId: 'squad-2', atSecond: 60 });
  timeline.schedule({ id: 'first', kind: 'arrival', subjectId: 'squad-1', atSecond: 60 });
  timeline.schedule({ id: 'later', kind: 'arrival', subjectId: 'squad-3', atSecond: 120 });
  const receipts = [];
  timeline.advanceTo(180, (event) => {
    receipts.push(event.id);
    return 'pause';
  });
  assert.deepEqual(receipts, ['first']);
  assert.equal(timeline.currentSecond, 60);
  const restored = new WorldTimeline(JSON.parse(JSON.stringify(timeline.toSnapshot())));
  restored.advanceTo(180, (event) => {
    receipts.push(event.id);
    return 'continue';
  });
  assert.deepEqual(receipts, ['first', 'second', 'later']);
  assert.throws(() =>
    restored.schedule({ id: 'first', kind: 'arrival', subjectId: 'squad-1', atSecond: 240 }),
  );
  assert.throws(() => restored.advanceTo(179, () => 'continue'));
});

test('sector corpse removal preserves finite equipment, death identity, and valid save structure', () => {
  const field = sectorWithCorpse();
  advanceSectorWorld(field, START_SECOND);
  advanceSectorWorld(field, REMOVAL_SECOND - 1);
  assert.ok(field.units.some((actor) => actor.id === '2'));
  advanceSectorWorld(field, REMOVAL_SECOND);
  assert.equal(
    field.units.some((actor) => actor.id === '2'),
    false,
  );
  assert.equal(field.deathHistory[0].corpse.characterId, '2');
  assert.equal(field.deathHistory[0].actor.hp, 0);
  const weapon = field.groundItems.find((item) => item.instanceId === 'corpse-weapon');
  assert.equal(weapon.count, 1);
  assert.equal(weapon.loaded, 1);
  assert.equal(field.groundItems.find((item) => item.instanceId === 'corpse-clothing').count, 1);
  assert.equal(field.groundItems.find((item) => item.instanceId === 'corpse-keepsake').count, 1);
  assert.equal(field.groundItems.find((item) => item.ammoType).count, 7);
  assert.equal(
    field.groundItems.every((item) => item.knownToPlayer === true),
    true,
  );
  validateBattleSnapshot(field);
  const restored = JSON.parse(JSON.stringify(field));
  advanceSectorWorld(restored, REMOVAL_SECOND + 3600);
  assert.deepEqual(restored.groundItems, field.groundItems);
  assert.equal(restored.deathHistory.length, 1);
  validateSectorWorld(restored);
});

test('corpse removal does not duplicate equipment already collected from the body', () => {
  const field = sectorWithCorpse();
  advanceSectorWorld(field, START_SECOND);
  const extraction = extractItemQuantity(field.units[1], 'primary', 1);
  field.units[1] = extraction.unit;
  advanceSectorWorld(field, REMOVAL_SECOND);
  assert.equal(
    field.groundItems.some((item) => item.instanceId === 'corpse-weapon'),
    false,
  );
  assert.equal(extraction.stack.instanceId, 'corpse-weapon');
  assert.equal(extraction.stack.loaded, 1);
});

test('loaded, unloaded, split-step, and combined-step removal produce the same world', () => {
  const loaded = sectorWithCorpse();
  const unloaded = structuredClone(loaded);
  advanceSectorWorld(loaded, START_SECOND);
  advanceSectorWorld(unloaded, START_SECOND);
  for (let second = START_SECOND + 3600; second <= REMOVAL_SECOND; second += 3600) {
    advanceResidentRoutine(loaded, second, {
      beforeConditions: (atSecond) =>
        advanceMilitaryWoundClock(loaded, atSecond, { initialSecond: START_SECOND }),
    });
    advanceSectorWorld(loaded, second);
    advanceResidentScavenging({ recruited: [] }, loaded, second);
  }
  const campaign = {
    hour: REMOVAL_SECOND / 3600,
    secondOfHour: 0,
    sectorStates: { buenos_aires: unloaded },
    sceneStates: {},
  };
  advanceCampaignWorld(campaign);
  assert.deepEqual(unloaded, loaded);
});

test('older corpses begin their migration lifetime at the saved game time', () => {
  const field = sectorWithCorpse();
  field.savedHour = 10;
  field.savedSecond = 15;
  advanceSectorWorld(field, 10 * 3600 + 15 + DEFAULT_CORPSE_LIFETIME_SECONDS - 1);
  assert.equal(field.units[1].corpse.diedAtSecond, 10 * 3600 + 15);
  advanceSectorWorld(field, 10 * 3600 + 15 + DEFAULT_CORPSE_LIFETIME_SECONDS);
  assert.equal(
    field.units.some((actor) => actor.id === '2'),
    false,
  );
});

test('an active casualty can disappear, save, restore, and settle without losing equipment or death identity', () => {
  let campaign = dispatchCampaign(initialCampaign(), { type: 'visitSector' });
  assert.equal(campaign.lastError, null);
  let battle = enterSector(campaign.pendingBattle);
  const casualty = battle.units.find((actor) => actor.side === 'player');
  const casualtyId = casualty.id;
  Object.assign(casualty, { hp: 0, bleeding: 0, bandaged: 0 });
  refreshMilitaryCondition(casualty);
  advanceSectorWorld(battle, battle.startSeconds);
  let synchronized = syncBattleTime(campaign, battle);
  assert.equal(synchronized.error, null);
  campaign = synchronized.campaign;
  battle = synchronized.battle;
  battle.elapsedSeconds += DEFAULT_CORPSE_LIFETIME_SECONDS;
  synchronized = syncBattleTime(campaign, battle);
  assert.equal(synchronized.error, null);
  ({ campaign, battle } = decodeSave(encodeSave(synchronized.campaign, synchronized.battle)));
  assert.equal(
    battle.units.some((actor) => actor.id === casualtyId),
    false,
  );
  assert.equal(battle.deathHistory.find((death) => death.actor.id === casualtyId).actor.hp, 0);
  const ground = structuredClone(battle.groundItems);
  const returned = dispatchCampaign(campaign, {
    type: 'leaveSector',
    battleId: campaign.pendingBattle.id,
    sectorState: battle,
    survivors: [...battle.units, ...battle.deathHistory.map((death) => death.actor)].filter(
      (actor) => actor.side === 'player',
    ),
  });
  assert.equal(returned.lastError, null);
  assert.equal(returned.pendingBattle, null);
  assert.equal(returned.operativeState[Number(casualtyId)].alive, false);
  assert.equal(returned.squad.includes(Number(casualtyId)), false);
  assert.deepEqual(returned.sectorStates.retiro.groundItems, ground);
  const restored = decodeSave(encodeSave(returned));
  assert.deepEqual(restored.campaign.sectorStates.retiro.deathHistory, battle.deathHistory);
  assert.deepEqual(restored.campaign.sectorStates.retiro.groundItems, ground);
});
