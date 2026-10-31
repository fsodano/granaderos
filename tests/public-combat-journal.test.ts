import type { BattleSnapshot } from '../packages/game/public/compatibility-types.ts';
import { present } from './assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, actBattle, endTurn, teamCanSee } from '../packages/game/tactical.js';
import { publicCombatJournal, COMBAT_JOURNAL_LIMIT } from '../packages/game/combat-journal.js';
import { playerKnownBattle } from '../packages/game/player-known-state.ts';
import { validateBattleSnapshot } from '../packages/game/validate-battle.js';
import { validateSectorSnapshot } from '../packages/game/squads.js';
import { setTestAmmunition } from './typed-ammunition-fixture.ts';
import { movementStep } from '../packages/game/movement-step.ts';

const tiles = (width = 20, height = 8) =>
  Array.from({ length: width * height }, (_, i) => ({
    x: i % width,
    y: Math.floor(i / width),
    type: 'grass',
    blocked: false,
    blocksSight: false,
    cover: 0,
  }));
const journal = (state: BattleSnapshot) => publicCombatJournal(state).map((entry) => entry.text);
function rearAttack({ visible = false, hp = 100 } = {}) {
  const s = createBattle(
    [{ id: 'p', name: 'Centinela', x: 10, y: 3, facing: visible ? 6 : 2, hp, maxHp: 100 }],
    {
      width: 20,
      height: 8,
      seed: 45,
      tiles: tiles(),
      enemies: [
        {
          id: 'e',
          name: 'Atacante',
          x: 5,
          y: 3,
          facing: 2,
          weapon: 1800,
          marksmanship: 100,
          loaded: 1,
          condition: 100,
          patrol: false,
          medical: 0,
        },
      ],
    },
  );
  present(s.units[0]).ap = 0;
  present(s.units[1]).ap = 12;
  return s;
}

void test('legacy saves start empty and never reconstruct private log text', () => {
  const legacy = rearAttack();
  delete legacy.publicJournal;
  legacy.log = ['PRIVATE old reload: 99 cartuchos, 45 PA, 95%.'];
  for (const validate of [validateBattleSnapshot, validateSectorSnapshot]) {
    const restored = validate(structuredClone(legacy));
    assert.deepEqual(publicCombatJournal(restored), []);
    assert.deepEqual(present(playerKnownBattle(restored)).journal, []);
    assert.deepEqual(restored.log, legacy.log);
    assert.equal(restored.publicJournal, undefined);
    present(restored.units[0]).ap = 100;
    const next = actBattle(restored, { type: 'stance', unitId: 'p', stance: 'crouched' });
    assert.equal(next.lastError, null);
    assert.ok(journal(next).some((text) => text === 'Centinela se agacha.'));
    assert.ok(next.log.includes(present(legacy.log[0])));
    assert.ok(!JSON.stringify(publicCombatJournal(next)).includes('PRIVATE'));
  }
});

void test('partial exploration wound steps omit zero-loss reports without changing ticks or stored history', () => {
  const state = createBattle(
    [{ id: 'p', name: 'Herido', x: 1, y: 3, hp: 50, maxHp: 100, bleeding: 3 }],
    { width: 8, height: 8, seed: 45, tiles: tiles(8, 8), exploration: true, enemies: [] },
  );
  const zero = 'Herido pierde 0 de salud por hemorragia.',
    loss = 'Herido pierde 3 de salud por hemorragia.';
  // Declare a historical false entry; reading and later journal writes must
  // preserve it in storage while the public view omits it.
  state.publicJournal = { version: 1, entries: [{ turn: state.turn, text: zero }] };
  state.log.push(zero);
  const before = structuredClone(state);
  assert.deepEqual(journal(state), []);
  assert.deepEqual(present(playerKnownBattle(state)).journal, []);
  assert.deepEqual(state, before);
  let next = state,
    continuation;
  for (const [index, hp] of [50, 47, 47].entries()) {
    const result = movementStep(next, { type: 'move', unitId: 'p', x: 4, y: 3 }, continuation);
    next = result.state;
    continuation = result.continuation;
    assert.equal(next.lastError, null);
    assert.equal(result.status, index === 2 ? 'completed' : 'moving');
    assert.equal(next.elapsedSeconds, 3 * (index + 1));
    assert.equal(next.bleedSeconds, index === 1 ? 0 : 3);
    assert.equal(present(next.units[0]).hp, hp);
    assert.equal(present(next.units[0]).bleeding, 3);
    assert.equal(next.log.filter((text) => text === zero).length, 1);
    assert.equal(
      present(next.publicJournal).entries.filter((entry) => entry.text === zero).length,
      1,
    );
    assert.ok(!journal(next).includes(zero));
    assert.equal(journal(next).filter((text) => text === loss).length, index === 0 ? 0 : 1);
  }
  assert.ok(
    journal(next).includes('Herido avanza 2 casillas.'),
    'movement message consolidation retains stored history too',
  );
  const restored = validateBattleSnapshot(structuredClone(next));
  assert.deepEqual(restored.publicJournal, next.publicJournal);
  assert.deepEqual(present(playerKnownBattle(restored)).journal, publicCombatJournal(next));
  assert.deepEqual(state, before);
});

void test('the observed last casualty and attacker remain readable after defeat and save', () => {
  const before = rearAttack({ visible: true, hp: 16 });
  assert.equal(teamCanSee(before, 'player', before.units[1]), true);
  const next = endTurn(before);
  assert.equal(present(next.units[0]).hp, 0);
  assert.equal(next.status, 'defeat');
  assert.ok(journal(next).some((text) => text.includes('Atacante hiere a Centinela')));
  assert.ok(journal(next).includes('Centinela cayó en combate.'));
  const restored = validateBattleSnapshot(structuredClone(next));
  assert.deepEqual(publicCombatJournal(restored), publicCombatJournal(next));
  assert.deepEqual(present(playerKnownBattle(restored)).journal, publicCombatJournal(next));
  assert.ok(!present(playerKnownBattle(restored)).units.some((unit) => unit.id === 'e'));
});

void test('an unseen attacker reports the own injury without revealing its identity', () => {
  const before = rearAttack();
  assert.equal(teamCanSee(before, 'player', before.units[1]), false);
  const next = endTurn(before);
  assert.ok(present(next.units[0]).hp < present(before.units[0]).hp);
  assert.ok(journal(next).some((text) => text.includes('Un ataque alcanza a Centinela')));
  assert.ok(!journal(next).some((text) => text.includes('Atacante')));
  const remembered = publicCombatJournal(next);
  present(next.units[0]).facing = 6;
  assert.deepEqual(
    publicCombatJournal(next),
    remembered,
    'later sight cannot name the earlier attacker',
  );
});

void test('visible enemy reload and missed shot summaries omit ammunition, AP and chance', () => {
  const before = rearAttack({ visible: true });
  Object.assign(present(before.units[1]), { x: 7, loaded: 0, ap: 45 });
  setTestAmmunition(present(before.units[1]), 1);
  const next = endTurn(before);
  assert.equal(present(next.units[1]).loaded, 1);
  assert.equal(present(next.units[1]).ammo, 0);
  assert.ok(next.log.some((text) => text.includes('Atacante recarga') && text.includes('PA')));
  const reload = journal(next).filter((text) => text.includes('Atacante'));
  assert.ok(reload.includes('Atacante recarga su arma.'));
  assert.ok(reload.every((text) => !/%|\bPA\b|cartuchos|faltan|\d/.test(text)));
  // This declared seed and viable aim make the real AI spend its 12 AP on a
  // shot. A zero-skill actor may decline to shoot, so it cannot prove redaction.
  const firing = rearAttack({ visible: true });
  firing.seed = 6;
  present(firing.units[1]).marksmanship = 85;
  assert.equal(teamCanSee(firing, 'player', firing.units[1]), true);
  const missed = endTurn(firing);
  assert.equal(present(firing.units[1]).loaded, 1);
  assert.equal(present(missed.units[1]).loaded, 0);
  assert.equal(present(missed.units[1]).ap, 0);
  assert.equal(present(missed.units[1]).ammo, present(firing.units[1]).ammo);
  assert.equal(present(missed.units[0]).hp, present(firing.units[0]).hp);
  assert.ok(missed.log.includes('Atacante dispara sin acertar al punto elegido (82%).'));
  assert.ok(journal(missed).includes('Atacante dispara sin acertar al punto elegido.'));
  assert.ok(
    journal(missed)
      .filter((text) => text.includes('Atacante'))
      .every((text) => !/%|\bPA\b|cartuchos/.test(text)),
  );
});

void test('hidden civilian activity and injuries do not enter the public stream', () => {
  const s = createBattle([{ id: 'p', name: 'Observador', x: 1, y: 3, facing: 2 }], {
    width: 20,
    height: 8,
    seed: 45,
    tiles: tiles(),
    enemies: [{ id: 'e', x: 3, y: 3, patrol: false }],
    npcs: [{ id: 'secret', name: 'CIVILIAN_SECRET', x: 18, y: 6, hp: 20, bleeding: 3 }],
  });
  for (const tile of s.tiles.filter((tile) => tile.x === 8)) {
    Object.assign(tile, { type: 'wall', blocked: true, blocksSight: true });
  }
  for (const unit of s.units) {
    unit.ap = 0;
  }
  assert.equal(teamCanSee(s, 'player', s.npcs[0]), false);
  const next = endTurn(s);
  assert.ok(next.log.some((text) => text.includes('actúan los civiles')));
  assert.ok(!journal(next).some((text) => /CIVILIAN_SECRET|actúan los civiles/.test(text)));
  const remembered = publicCombatJournal(next);
  present(next.npcs[0]).x = 2;
  present(next.npcs[0]).y = 3;
  assert.deepEqual(publicCombatJournal(next), remembered);
});

void test('artillery reports observed breaches but not hidden structures or civilian casualties', () => {
  for (const visible of [true, false]) {
    const s = createBattle(
      [
        { id: 20, x: 1, y: 2, facing: 2 },
        { id: 21, x: 2, y: 2, facing: 2 },
      ],
      {
        width: 32,
        height: 9,
        seed: 45,
        night: !visible,
        tiles: tiles(32, 9),
        enemies: [{ id: 'reserve', x: 30, y: 7, patrol: false, overwatch: false }],
        npcs: visible ? [] : [{ id: 'secret', name: 'CANNON_SECRET', x: 19, y: 3, hp: 20 }],
        artillery: [
          {
            id: 'gun',
            type: 'bronze4',
            side: 'player',
            x: 2,
            y: 3,
            facing: 0,
            loaded: true,
            ammo: 0,
          },
        ],
      },
    );
    const wall = present(s.tiles.find((tile) => tile.x === (visible ? 4 : 18) && tile.y === 3));
    Object.assign(wall, { type: 'wall', blocked: true, blocksSight: true, material: 'adobe' });
    assert.equal(teamCanSee(s, 'player', wall), visible);
    const next = actBattle(s, {
      type: 'artillery',
      unitId: 20,
      artilleryId: 'gun',
      x: 22,
      y: 3,
      mode: 'solid',
    });
    assert.equal(next.lastError, null);
    assert.ok(next.log.some((text) => text.includes('abre una brecha')));
    assert.equal(
      journal(next).some((text) => text.includes('abre una brecha')),
      visible,
    );
    assert.ok(!journal(next).some((text) => text.includes('CANNON_SECRET')));
    if (!visible) {
      assert.equal(present(next.npcs[0]).hp, 0);
      assert.equal(
        present(next.tiles.find((tile) => tile.x === 18 && tile.y === 3)).blocked,
        false,
      );
    }
  }
});

void test('journal metadata cannot alter the next simulation result and is bounded', () => {
  const before = rearAttack({ visible: true }),
    legacy = structuredClone(before);
  delete legacy.publicJournal;
  const a = endTurn(before),
    b = endTurn(legacy);
  delete a.publicJournal;
  delete b.publicJournal;
  assert.deepEqual(a, b);
  let s = createBattle([{ id: 'p', x: 1, y: 1 }], {
    width: 8,
    height: 8,
    tiles: tiles(8, 8),
    exploration: true,
    enemies: [],
  });
  for (let i = 0; i < COMBAT_JOURNAL_LIMIT + 5; i++) {
    s = actBattle(s, { type: 'stance', unitId: 'p', stance: i % 2 ? 'standing' : 'crouched' });
  }
  assert.equal(publicCombatJournal(s).length, COMBAT_JOURNAL_LIMIT);
  const view = present(playerKnownBattle(s)).journal;
  present(view[0]).text = 'changed';
  assert.notEqual(present(publicCombatJournal(s)[0]).text, 'changed');
});

void test('malformed public history is rejected at both save boundaries', () => {
  const s = rearAttack();
  for (const publicJournal of [
    null,
    { version: 2, entries: [] },
    { version: 1, entries: [{ turn: 2, text: 'future' }] },
    { version: 1, entries: [{ turn: 1, text: '', secret: 'PRIVATE' }] },
    { version: 1, entries: Array.from({ length: 81 }, () => ({ turn: 1, text: 'over limit' })) },
  ]) {
    for (const validate of [validateBattleSnapshot, validateSectorSnapshot]) {
      assert.throws(() => validate({ ...s, publicJournal }), /diario público/);
    }
    assert.deepEqual(publicCombatJournal({ ...s, publicJournal }), []);
  }
});
