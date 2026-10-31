import { parseJsonObject, isJsonObject } from '../packages/campaign-format/json-value.ts';
import type { BattleSnapshot } from '../packages/game/public/compatibility-types.ts';
import type { CampaignSnapshot, CampaignAction } from '../packages/game/public/campaign-types.ts';
import { present } from './assert-present.ts';
import { enterAssault } from './assault-fixture.ts';
import { totalReserveAmmunition } from '../packages/game/ammunition-types.js';
import { stockAndCarriedAmmo, stockAmmo } from './ammunition-balance.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign } from './legacy-campaign-fixture.ts';
import { dispatchCampaign, serializeCampaign, restoreCampaign } from '../packages/game/campaign.js';
import { enterSector } from '../packages/game/world.js';
import { actBattle, createBattle, initializeBattlePerception } from '../packages/game/tactical.js';
import { autoBandageBattle } from '../packages/game/auto-bandage.js';
import { encodeSave, decodeSave } from '../packages/game/save.ts';
import { scriptedBattleReport, scriptedWithdrawal } from './scripted-battle-report.ts';
const order = (s: CampaignSnapshot, a: CampaignAction) => {
  const next = dispatchCampaign(s, a);
  assert.equal(next.lastError, null, next.lastError ?? undefined);
  return next;
};
const deployed = () =>
  enterAssault(order(initialCampaign(), { type: 'travel', sector: 'buenos_aires' }), 'san_nicolas');
type BattleReport = Extract<CampaignAction, { type: 'finishMission' | 'battleResult' }>;
const receipt = (s: CampaignSnapshot, b: BattleSnapshot, outcome = 'retreat'): BattleReport => ({
  type: 'battleResult',
  battleId: present(s.pendingBattle).id,
  outcome,
  sectorState: b,
  survivors: b.units.filter((u) => u.side === 'player'),
});
function rejected(s: CampaignSnapshot, a: CampaignAction) {
  const before = serializeCampaign(s),
    next = dispatchCampaign(s, a);
  assert.ok(next.lastError);
  assert.equal(serializeCampaign(s), before);
  assert.deepEqual({ ...next, lastError: null }, JSON.parse(before));
}

void test('ordinary battle reports require a full snapshot and all deployed participants, including casualties', () => {
  const s = deployed(),
    b = enterSector(s.pendingBattle),
    base = receipt(s, b);
  for (const alter of [
    (a: BattleReport) => Reflect.deleteProperty(a, 'sectorState'),
    (a: BattleReport) => Reflect.deleteProperty(a, 'survivors'),
    (a: BattleReport) => (a.survivors = []),
    (a: BattleReport) => a.survivors.pop(),
    (a: BattleReport) => a.survivors.push(present(a.survivors[0])),
    (a: BattleReport) => Reflect.set(a.survivors, 0, { id: 999 }),
    (a: BattleReport) => (a.sectorState.units = a.sectorState.units.filter((u) => u.id !== '3')),
    (a: BattleReport) =>
      (a.sectorState.units = a.sectorState.units.filter((u) => u.id !== 'enemy-0')),
    (a: BattleReport) =>
      Reflect.deleteProperty(present(a.sectorState.units.find((u) => u.id === '3')), 'weapon'),
    (a: BattleReport) =>
      Reflect.deleteProperty(present(a.sectorState.units.find((u) => u.id === '3')), 'ammo'),
    (a: BattleReport) =>
      Reflect.deleteProperty(present(a.sectorState.units.find((u) => u.id === '3')), 'medkits'),
  ]) {
    const a = structuredClone(base);
    alter(a);
    rejected(s, a);
  }
  const won = scriptedBattleReport(s, {
    units: [
      { id: 4, hp: 0 },
      { id: 3, hp: 30, bandaged: 70 },
    ],
  });
  const next = order(s, won);
  assert.equal(present(next.operativeState[4]).alive, false);
  assert.equal(present(next.operativeState[3]).hp, 30);
  assert.ok(!next.squad.includes(4));
});
void test('snapshot battle and sector identities must match the pending deployment atomically', () => {
  const s = deployed(),
    base = receipt(s, enterSector(s.pendingBattle));
  for (const alter of [
    (a: BattleReport) => (a.battleId = 'old'),
    (a: BattleReport) => (a.sectorState.battleId = 'old'),
    (a: BattleReport) => Reflect.deleteProperty(a.sectorState, 'battleId'),
    (a: BattleReport) => (a.sectorState.sectorId = 'retiro'),
    (a: BattleReport) => (a.sectorState.sceneId = 'yatasto'),
  ]) {
    const a = structuredClone(base);
    alter(a);
    rejected(s, a);
  }
});
void test('outcome labels cannot turn an active field into victory or a capable squad into defeat', () => {
  const s = deployed(),
    base = receipt(s, enterSector(s.pendingBattle));
  rejected(s, { ...base, outcome: 'victory' });
  rejected(s, { ...base, outcome: 'defeat' });
  const forged = structuredClone(base);
  forged.outcome = 'victory';
  forged.sectorState.status = 'victory';
  forged.sectorState.sectorCleared = true;
  rejected(s, forged);
  forged.outcome = 'defeat';
  forged.sectorState.status = 'defeat';
  rejected(s, forged);
});
void test('real dropped equipment and snapshot supplies defeat contradictory caller overrides', () => {
  const s = deployed();
  let b = enterSector(s.pendingBattle);
  b = actBattle(b, { type: 'drop', unitId: 4, item: 'primary' });
  assert.equal(b.lastError, null);
  b = scriptedWithdrawal(b);
  const actual = b.units.find((u) => u.id === '4'),
    ammo = b.units
      .filter((u) => u.side === 'player' && u.hp > 0)
      .reduce((sum, u) => sum + u.loaded + totalReserveAmmunition(u), 0),
    a = receipt(s, b);
  a.survivors = a.survivors.map((u) => ({
    ...u,
    hp: 100,
    weapon: 1801,
    condition: 100,
    loaded: 999,
    ammo: 999,
    medkits: 999,
    inventory: { invented: { count: 100, weight: 0 } },
  }));
  const next = order(s, a);
  assert.equal(present(next.operativeState[4]).weaponDropped, true);
  assert.equal(present(next.operativeState[4]).hp, present(actual).hp);
  assert.deepEqual(present(next.operativeState[4]).inventory, present(actual).inventory);
  assert.equal(present(next.operativeState[4]).medkits, present(actual).medkits);
  assert.equal(stockAndCarriedAmmo(next), stockAmmo(s) + ammo);
  assert.deepEqual(restoreCampaign(serializeCampaign(next)), next);
  rejected(next, a);
});
void test('ordinary retreat retains authoritative injuries and cannot refill finite personal supplies', () => {
  const s = deployed(),
    a = scriptedBattleReport(s, {
      outcome: 'retreat',
      units: [
        {
          id: 3,
          hp: 24,
          bandaged: 76,
          energy: 22,
          medkits: 0,
          priming: 0,
          flints: 0,
          rations: 0,
          torches: 0,
          boleadoras: 0,
          condition: 31,
        },
      ],
    });
  a.survivors = a.survivors.map((u) => ({
    ...u,
    hp: 100,
    energy: 100,
    medkits: 20,
    priming: 50,
    flints: 4,
    rations: 2,
    torches: 2,
    condition: 100,
  }));
  const next = order(s, a),
    u = next.operativeState[3];
  assert.equal(present(u).hp, 24);
  assert.equal(present(u).energy, present(a.sectorState.units.find((u) => u.id === '3')).energy);
  assert.ok(present(u).energy < 22, 'The actual outward step spends energy.');
  assert.equal(present(u).medkits, 0);
  assert.equal(Object.hasOwn(present(u), 'priming'), false);
  assert.equal(Object.hasOwn(present(u), 'flints'), false);
  assert.equal(present(u).rations, 0);
  assert.equal(present(u).torches, 0);
  assert.equal(present(u).condition, 31);
});
void test('validated legacy saves gain a missing battle identity without gaining movement or departure', () => {
  const s = deployed(),
    b = enterSector(s.pendingBattle),
    raw = parseJsonObject(encodeSave(s, b));
  const rawBattle = raw['battle'];
  assert.ok(isJsonObject(rawBattle));
  delete rawBattle['battleId'];
  const loaded = decodeSave(JSON.stringify(raw));
  assert.equal(present(loaded.battle).battleId, present(s.pendingBattle).id);
  assert.equal(loaded.campaign.location, s.location);
  assert.deepEqual(present(loaded.battle).units, b.units);
  assert.equal(present(loaded.battle).elapsedSeconds, b.elapsedSeconds);
  assert.equal(present(loaded.campaign.pendingBattle).id, present(s.pendingBattle).id);
  rejected(loaded.campaign, receipt(loaded.campaign, present(loaded.battle)));
  assert.equal(loaded.campaign.location, s.location);
  const wrong = structuredClone(raw),
    wrongBattle = wrong['battle'];
  assert.ok(isJsonObject(wrongBattle));
  wrongBattle['sectorId'] = 'retiro';
  assert.throws(() => decodeSave(JSON.stringify(wrong)));
  wrongBattle['sectorId'] = b.sectorId;
  const units = wrongBattle['units'];
  assert.ok(Array.isArray(units));
  wrongBattle['units'] = units.filter((u) => isJsonObject(u) && u['id'] !== '3');
  assert.throws(() => decodeSave(JSON.stringify(wrong)));
});

void test('enemy breath collapse remains active and cannot award a fabricated sector victory', () => {
  const s = deployed(),
    b = enterSector(s.pendingBattle);
  for (const u of b.units.filter((u) => u.side === 'enemy')) {
    Object.assign(u, { energy: 0, unconscious: true, ap: 0 });
  }
  initializeBattlePerception(b);
  assert.equal(b.status, 'active');
  assert.ok(b.units.filter((u) => u.side === 'enemy').every((u) => u.hp >= 15));
  rejected(s, receipt(s, b, 'victory'));
  const forged = structuredClone(b);
  forged.status = 'victory';
  forged.sectorCleared = true;
  rejected(s, receipt(s, forged, 'victory'));
  rejected(s, receipt(s, b));
  assert.equal(present(s.sectors['san_nicolas']).owner, 'royalist');
  assert.ok(
    b.units
      .filter((u) => u.side === 'enemy')
      .every((u) => u.hp >= 15 && u.energy === 0 && u.unconscious),
  );
});
void test('player breath collapse remains active and preserves living exhausted troops', () => {
  const s = deployed(),
    b = enterSector(s.pendingBattle);
  for (const u of b.units.filter((u) => u.side === 'player')) {
    Object.assign(u, { energy: 0, unconscious: true, ap: 0 });
  }
  initializeBattlePerception(b);
  assert.equal(b.status, 'active');
  rejected(s, receipt(s, b, 'defeat'));
  const forged = structuredClone(b);
  forged.status = 'defeat';
  rejected(s, receipt(s, forged, 'defeat'));
  rejected(s, receipt(s, b));
  const saved = decodeSave(encodeSave(s, b));
  assert.ok(saved.campaign.pendingBattle);
  for (const u of present(saved.battle).units.filter((u) => u.side === 'player')) {
    assert.ok(u.hp > 0);
    assert.equal(u.energy, 0);
    assert.equal(u.departure, undefined);
  }
  assert.equal(saved.campaign.defeated, false);
});

// A prepared last-opponent fixture isolates post-battle treatment and campaign
// reconciliation. The finishing blow, equipment switch and care all use orders.
function bandagedVictory(s: CampaignSnapshot) {
  const r = present(s.pendingBattle);
  let b = createBattle(
    [...r.squad, ...(r.missionAllies ?? [])].map((u, i) => ({
      ...u,
      x: 2 + i * 2,
      y: 2,
      ...(u.id === 10 ? { hp: u.maxHp - 12, bleeding: 1, bandaged: 0 } : {}),
    })),
    {
      ...r,
      width: 20,
      height: 16,
      tiles: Array.from({ length: 320 }, (_, i) => ({
        x: i % 20,
        y: Math.floor(i / 20),
        type: 'grass',
        blocked: false,
        cover: 0,
      })),
      props: [],
      npcs: present(r.npcs).map((npc, i) => ({ ...npc, x: 18 - i, y: 14 })),
      enemies: present(r.enemies).map((u, i) => ({
        ...u,
        x: 2 + i,
        y: 3,
        hp: i ? 0 : 20,
        bleeding: 0,
        bandaged: 0,
        ap: 0,
      })),
    },
  );
  b = actBattle(b, { type: 'weapon', unitId: '3', slot: 'blade' });
  assert.equal(b.lastError, null);
  b = actBattle(b, { type: 'melee', unitId: '3', targetId: present(present(r.enemies)[0]).id });
  assert.equal(b.lastError, null);
  assert.equal(b.status, 'victory');
  const before = b.units.find((u) => u.id === '10'),
    care = autoBandageBattle(b);
  assert.equal(care.stoppedReason, null);
  assert.deepEqual(care.treatedIds, ['10']);
  assert.ok(care.steps.some((a) => a.type === 'useItem'));
  assert.equal(care.battle.status, 'active');
  assert.equal(care.battle.mode, 'exploration');
  assert.equal(care.battle.sectorCleared, true);
  assert.ok(care.elapsedSeconds > 0);
  assert.equal(
    present(care.battle.units.find((u) => u.id === '10')).medkits,
    present(before).medkits - 1,
  );
  assert.ok(present(care.battle.units.find((u) => u.id === '10')).hp <= present(before).hp);
  return care.battle;
}
void test('an actual finishing blow and paid auto-bandage return an ordinary cleared conquest once', () => {
  const s = deployed(),
    b = bandagedVictory(s),
    a = receipt(s, b, 'victory'),
    next = order(s, a),
    doctor = b.units.find((u) => u.id === '10');
  assert.equal(next.pendingBattle, null);
  assert.equal(present(next.sectors['san_nicolas']).owner, 'patriot');
  assert.equal(present(next.operativeState[10]).bleeding, 0);
  assert.equal(present(next.operativeState[10]).hp, present(doctor).hp);
  assert.equal(present(next.operativeState[10]).medkits, present(doctor).medkits);
  assert.equal(next.secondOfHour, b.elapsedSeconds);
  assert.deepEqual(restoreCampaign(serializeCampaign(next)), next);
  rejected(next, a);
});
void test('post-victory treatment also completes San Lorenzo with the living commander', () => {
  let s = initialCampaign();
  s.phase = 1;
  s.flags['academy'] = true;
  present(s.sectors['san_nicolas']).owner = 'patriot';
  s = order(s, { type: 'travel', sector: 'san_nicolas' });
  s = order(s, { type: 'attack', sector: 'san_lorenzo' });
  const b = bandagedVictory(s);
  s = order(s, receipt(s, b, 'victory'));
  assert.equal(s.flags['sanLorenzo'], true);
  assert.equal(present(s.missions['san_lorenzo']).completed, true);
  assert.ok(present(s.missionAllies['san_lorenzo']).hp > 0);
  assert.equal(
    present(s.operativeState[10]).medkits,
    present(b.units.find((u) => u.id === '10')).medkits,
  );
  assert.deepEqual(restoreCampaign(serializeCampaign(s)), s);
});
void test('a cleared flag cannot report active combat, an unfinished reaction or a capable enemy as victory', () => {
  const s = deployed(),
    b = bandagedVictory(s),
    base = receipt(s, b, 'victory');
  for (const alter of [
    (a: BattleReport) => (a.sectorState.sectorCleared = false),
    (a: BattleReport) => (a.sectorState.mode = 'combat'),
    (a: BattleReport) => (a.sectorState.phase = 'enemy'),
    (a: BattleReport) => (a.sectorState.phase = 'interrupt'),
    (a: BattleReport) => Reflect.set(a.sectorState, 'enemyTurn', {}),
    (a: BattleReport) => Reflect.set(a.sectorState, 'interrupt', {}),
    (a: BattleReport) => (a.sectorState.reactionStack = []),
    (a: BattleReport) => {
      const enemy = a.sectorState.units.find((u) => u.side === 'enemy');
      Object.assign(present(enemy), {
        hp: 30,
        bleeding: 0,
        bandaged: 0,
        energy: 100,
        unconscious: false,
        routed: false,
        surrendered: false,
      });
    },
    (a: BattleReport) => {
      for (const u of a.sectorState.units.filter((u) => u.side === 'player')) {
        Object.assign(u, { hp: 10, bandaged: u.maxHp - 10, unconscious: true });
      }
    },
  ]) {
    const a = structuredClone(base);
    alter(a);
    rejected(s, a);
  }
});
