import { jsonRoundTrip } from './json-round-trip.ts';
import type { BattleSnapshot, BattleUnit } from '../packages/game/public/compatibility-types.ts';
import { present } from './assert-present.ts';
import { setTestAmmunition } from './typed-ammunition-fixture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBattle,
  actBattle,
  endTurn,
  getReachable,
  reloadCost,
  shotChance,
  misfireChance,
  actionCosts,
  canSee,
} from '../packages/game/tactical.js';
import { automaticOrder, searchOrder } from '../packages/game/autonomous-orders.js';
import { chooseEnemyAction } from '../packages/game/tactical-ai.js';
const flat = () =>
  Array.from({ length: 80 }, (_, i) => ({
    x: i % 10,
    y: Math.floor(i / 10),
    type: 'grass',
    blocked: false,
    cover: 0,
  }));
const battle = () =>
  createBattle([{ id: 0, name: 'Cabral', x: 1, y: 1 }], {
    width: 10,
    height: 8,
    tiles: flat(),
    enemies: [{ id: 'e', x: 6, y: 1 }],
    seed: 45,
  });
void test('movement spends AP and never mutates source', () => {
  const s = battle();
  present(s.units[1]).overwatch = false;
  const n = actBattle(s, { type: 'move', unitId: 0, x: 3, y: 1 });
  assert.equal(present(n.units[0]).ap, 84);
  assert.equal(present(s.units[0]).x, 1);
  assert.equal(present(n.units[0]).momentum, 2);
});
void test('walls and occupied squares cannot be traversed', () => {
  const s = battle();
  present(s.tiles.find((t) => t.x === 2 && t.y === 1)).blocked = true;
  const p = getReachable(s, '0').find((p) => p.x === 3 && p.y === 1);
  assert.equal(present(p).cost, 32);
  assert.ok(!getReachable(s, '0').some((p) => p.x === 6 && p.y === 1));
});
void test('prone reload multiplier and double-barrel partial reload', () => {
  const u = present(battle().units[0]);
  present(u).loaded = 0;
  assert.equal(reloadCost(u), 45);
  present(u).stance = 'prone';
  assert.equal(reloadCost(u), 68);
  present(u).weapon = 1808;
  setTestAmmunition(present(u), 12);
  present(u).loaded = 1;
  present(u).stance = 'standing';
  assert.equal(reloadCost(u), 28);
});
void test('reload transfers rounds and enforces available AP', () => {
  const s = battle();
  present(s.units[0]).loaded = 0;
  present(s.units[0]).ap = 44;
  let n = actBattle(s, { type: 'reload', unitId: 0 });
  assert.equal(n.lastError, null);
  assert.equal(present(n.units[0]).loaded, 0);
  assert.equal(present(n.units[0]).ammo, 12);
  assert.equal(present(n.units[0]).ap, 0);
  assert.equal(reloadCost(present(n.units[0]), n), 1);
  present(s.units[0]).ap = 100;
  n = actBattle(s, { type: 'reload', unitId: 0 });
  assert.equal(present(n.units[0]).loaded, 1);
  assert.equal(present(n.units[0]).ammo, 11);
  assert.equal(present(n.units[0]).ap, 55);
});
void test('weather misfire preserves charge and repriming costs 15', () => {
  const s = battle();
  s.weather = { rain: 100, humidity: 100 };
  s.seed = 1;
  const n = actBattle(s, { type: 'fire', unitId: 0, targetId: 'e' });
  assert.equal(present(n.units[0]).jammed, true);
  assert.equal(present(n.units[0]).loaded, 1);
  const p = actBattle(n, { type: 'reprime', unitId: 0 });
  assert.equal(present(p.units[0]).jammed, false);
  assert.equal(present(p.units[0]).ap, present(n.units[0]).ap - 15);
  assert.equal(present(p.units[0]).loaded, 1);
  assert.ok(misfireChance(40, 80, 15) > misfireChance(100, 0, 0));
});
void test('powder smoke reduces accuracy and walls block shooting', () => {
  const s = battle(),
    a = present(s.units[0]),
    b = present(s.units[1]),
    base = shotChance(s, a, b);
  s.smoke.push({ x: 3, y: 1, radius: 1, turns: 3 });
  assert.ok(shotChance(s, a, b) < base);
  present(s.tiles.find((t) => t.x === 3 && t.y === 1)).blocked = true;
  assert.equal(shotChance(s, a, b), 0);
  assert.ok(actBattle(s, { type: 'fire', unitId: 0, targetId: 'e' }).lastError);
});
void test('healing pays for holding the kit, stops bleeding and consumes field supplies', () => {
  const s = battle();
  present(s.units[0]).hp = 50;
  present(s.units[0]).bleeding = 4;
  const held = actBattle(s, { type: 'weapon', unitId: 0, slot: 'medical' });
  assert.equal(held.lastError, null);
  assert.equal(present(held.units[0]).ap, present(s.units[0]).ap - 4);
  const n = actBattle(held, { type: 'useItem', unitId: 0, targetId: 0 });
  assert.equal(n.lastError, null);
  assert.equal(present(n.units[0]).ap, present(held.units[0]).ap - 25);
  assert.equal(present(n.units[0]).bleeding, 0);
  assert.equal(present(held.units[0]).hp, 46);
  assert.equal(present(n.units[0]).hp, present(held.units[0]).hp);
  assert.equal(present(n.units[0]).medkits, 1);
});
void test('straight movement increases melee damage and wins battle', () => {
  let s = battle();
  present(s.units[0]).blade = 1811;
  s = actBattle(s, { type: 'weapon', unitId: 0, slot: 'blade' });
  present(s.units[1]).x = 4;
  present(s.units[1]).hp = 20;
  present(s.units[1]).overwatch = false;
  s = actBattle(s, { type: 'move', unitId: 0, x: 3, y: 1 });
  s = actBattle(s, { type: 'melee', unitId: 0, targetId: 'e' });
  assert.equal(s.status, 'victory');
  assert.equal(present(s.units[1]).hp, 0);
});
void test('enemy turn is deterministic and serializable', () => {
  const s = battle();
  present(s.units[1]).weapon = 1806;
  present(s.units[1]).ap = actionCosts(s, present(s.units[1])).fire;
  const a = endTurn(s),
    b = endTurn(jsonRoundTrip(s));
  assert.deepEqual(a, b);
  assert.equal(a.turn, 2);
  assert.equal(a.phase, 'player');
  assert.ok(a.log.length > s.log.length);
  assert.equal(s.turn, 1);
});
void test('militia investigate current allied sightings without gaining personal sight or bypassing guards', () => {
  const width = 14,
    height = 9,
    tiles = Array.from({ length: width * height }, (_, i) => {
      const x = i % width,
        y = Math.floor(i / width),
        wall = x === 4 && y > 0 && y < 7;
      return {
        x,
        y,
        type: wall ? 'wall' : 'grass',
        blocked: wall,
        blocksSight: wall,
        cover: wall ? 40 : 0,
      };
    });
  const s = createBattle(
      [
        { id: 'm', militia: true, x: 2, y: 4, facing: 2, morale: 100 },
        { id: 'observer', x: 7, y: 3, facing: 2, morale: 100 },
      ],
      {
        width,
        height,
        tiles,
        hour: 12,
        seed: 45,
        enemies: [{ id: 'enemy', x: 10, y: 3, facing: 2, morale: 100, patrol: false }],
      },
    ),
    m = present(s.units[0]),
    observer = present(s.units[1]),
    enemy = present(s.units[2]),
    before = structuredClone(s);
  assert.equal(canSee(s, m, enemy), false);
  assert.equal(canSee(s, observer, enemy), true);
  assert.equal(chooseEnemyAction(s, m), null);
  assert.equal(searchOrder(s, m), null);
  const order = present(automaticOrder(s, m));
  assert.equal(order.type, 'move');
  assert.ok(order.type === 'move');
  assert.ok(!('targetId' in present(order)));
  const route = getReachable(s, m).find((p) => p.x === order.x && p.y === order.y);
  assert.ok(
    present(route).cost > 0 && present(route).cost <= 24 && present(route).path.length <= 3,
  );
  assert.equal(present(m).lastKnownEnemy, undefined);
  assert.equal(present(m).lastHeardNoise, undefined);
  assert.deepEqual(s, before);
  const next = endTurn(s);
  assert.equal(next.lastError, null);
  assert.notDeepEqual(
    [present(next.units[0]).x, present(next.units[0]).y],
    [present(m).x, present(m).y],
  );
  assert.deepEqual(s, before);
  const originalFallback = (b: BattleSnapshot, u: BattleUnit) =>
    chooseEnemyAction(b, u) ?? searchOrder(b, u);
  for (const change of [
    (b: BattleSnapshot) => {
      present(b.units[0]).militia = false;
    },
    (b: BattleSnapshot) => {
      b.phase = 'interrupt';
    },
    (b: BattleSnapshot) => {
      b.reactionStack = [{}];
    },
    (b: BattleSnapshot) => {
      b.mode = 'exploration';
    },
    (b: BattleSnapshot) => {
      present(b.units[0]).routed = true;
    },
    (b: BattleSnapshot) => {
      present(b.units[0]).unconscious = true;
    },
    (b: BattleSnapshot) => {
      present(b.units[0]).knockedDown = true;
    },
    (b: BattleSnapshot) => {
      present(b.units[0]).entangled = true;
    },
    (b: BattleSnapshot) => {
      present(b.units[0]).hp = 14;
    },
    (b: BattleSnapshot) => {
      present(b.units[0]).energy = 0;
    },
    (b: BattleSnapshot) => {
      present(b.units[2]).side = 'player';
    },
    (b: BattleSnapshot) => {
      Reflect.set(present(b.units[2]), 'side', 'neutral');
    },
    (b: BattleSnapshot) => {
      present(b.units[2]).routed = true;
    },
    (b: BattleSnapshot) => {
      b.units.push({ ...structuredClone(present(b.units[0])), id: 'crew', x: 3, y: 4 });
      b.artillery = [
        { id: 'post', type: 'bronze4', side: 'player', x: 2, y: 5, loaded: true, ammo: 3 },
      ];
    },
  ]) {
    const guarded = structuredClone(s);
    change(guarded);
    const snapshot = structuredClone(guarded);
    assert.deepEqual(
      automaticOrder(guarded, present(guarded.units[0])),
      originalFallback(guarded, present(guarded.units[0])),
    );
    assert.deepEqual(guarded, snapshot);
  }
  const unseen = structuredClone(s);
  present(unseen.units[1]).facing = 6;
  assert.equal(canSee(unseen, present(unseen.units[1]), present(unseen.units[2])), false);
  const sweep = automaticOrder(unseen, present(unseen.units[0]));
  assert.deepEqual(sweep, searchOrder(unseen, present(unseen.units[0])));
  present(unseen.units[2]).x = 11;
  present(unseen.units[2]).y = 7;
  assert.deepEqual(
    automaticOrder(unseen, present(unseen.units[0])),
    sweep,
    'hidden enemy position does not guide the search',
  );
  const personal = structuredClone(s);
  present(personal.units[0]).x = 6;
  present(personal.units[0]).y = 3;
  assert.equal(canSee(personal, present(personal.units[0]), present(personal.units[2])), true);
  const own = chooseEnemyAction(personal, present(personal.units[0]));
  assert.ok(own);
  assert.deepEqual(automaticOrder(personal, present(personal.units[0])), own);
  const blocked = structuredClone(s);
  for (const tile of blocked.tiles) {
    if (Math.max(Math.abs(tile.x - present(m).x), Math.abs(tile.y - present(m).y)) === 1) {
      tile.blocked = true;
    }
  }
  assert.equal(automaticOrder(blocked, present(blocked.units[0])), null);
});
void test('outnumbered depleted player can lose to enemy melee', () => {
  const s = battle();
  present(s.units[0]).hp = 1;
  present(s.units[1]).x = 2;
  assert.equal(endTurn(s).status, 'defeat');
});
void test('lance units cannot fire an imaginary musket', () => {
  const s = battle();
  present(s.units[0]).weapon = 1812;
  assert.ok(actBattle(s, { type: 'fire', unitId: 0, targetId: 'e' }).lastError);
  assert.ok(actBattle(s, { type: 'reload', unitId: 0 }).lastError);
});
void test('charge consumes remaining AP and requires a clear straight approach', () => {
  let s = battle();
  present(s.units[1]).overwatch = false;
  present(s.units[0]).blade = 1809;
  present(s.units[1]).hp = 100;
  s = actBattle(s, { type: 'weapon', unitId: 0, slot: 'blade' });
  const n = actBattle(s, { type: 'charge', unitId: 0, targetId: 'e' });
  assert.equal(present(n.units[0]).ap, 0);
  assert.equal(present(n.units[0]).x, 5);
  assert.ok(present(n.units[1]).hp < 54);
  present(s.units[1]).y = 3;
  assert.ok(actBattle(s, { type: 'charge', unitId: 0, targetId: 'e' }).lastError);
});
void test('mounting requires assigned horse and reduces movement AP', () => {
  const s = battle();
  assert.ok(actBattle(s, { type: 'mount', unitId: 0 }).lastError);
  present(s.units[0]).horse = true;
  const n = actBattle(s, { type: 'mount', unitId: 0 });
  assert.equal(present(n.units[0]).mounted, true);
  assert.equal(present(getReachable(n, '0').find((p) => p.x === 2 && p.y === 1)).cost, 4);
  assert.ok(actBattle(n, { type: 'stance', unitId: 0, stance: 'prone' }).lastError);
});
void test('artillery requires actual crew AP and breaches walls', () => {
  const s = battle();
  s.artillery = [{ id: 'g', type: 'bronze4', side: 'player', x: 1, y: 2, loaded: true, ammo: 3 }];
  assert.ok(actBattle(s, { type: 'artillery', unitId: 0, artilleryId: 'g', x: 4, y: 2 }).lastError);
  s.units.push({ ...present(s.units[0]), id: 'crew', x: 0, y: 2 });
  present(s.tiles.find((t) => t.x === 4 && t.y === 2)).blocked = true;
  const n = actBattle(s, { type: 'artillery', unitId: 0, artilleryId: 'g', x: 4, y: 2 });
  assert.equal(n.lastError, null);
  assert.equal(present(n.artillery[0]).loaded, false);
  assert.equal(present(n.units[0]).ap, 70);
  assert.equal(present(n.units[2]).ap, 70);
  assert.equal(present(n.tiles.find((t) => t.x === 4 && t.y === 2)).blocked, false);
  const r = actBattle(n, { type: 'artilleryReload', unitId: 0, artilleryId: 'g' });
  assert.equal(present(r.artillery[0]).loaded, true);
  assert.equal(present(r.artillery[0]).ammo, 2);
  assert.equal(present(r.units[0]).ap, 10);
});
void test('authored firearm and blade values retain explicit loose-bayonet tuning', async () => {
  const { WEAPONS, BLADES, bladeFor } = await import('../packages/game/tactical.js');
  for (const [id, damage, fireAP, aimAP, reloadAP, range] of [
    [1804, 48, 10, 4, 35, 10],
    [1805, 42, 7, 3, 32, 8],
    [1806, 38, 6, 2, 28, 12],
    [1807, 75, 12, 5, 40, 6],
    [1808, 40, 8, 3, 55, 9],
  ] as const) {
    assert.deepEqual(
      [
        WEAPONS[id].damage,
        WEAPONS[id].fireAP,
        WEAPONS[id].aimAP,
        WEAPONS[id].reloadAP,
        WEAPONS[id].range,
      ],
      [damage, fireAP, aimAP, reloadAP, range],
    );
  }
  for (const [id, ap, damage] of [
    [1809, 12, 46],
    [1810, 14, 42],
    [1811, 16, 50],
    [1812, 18, 56],
    [1813, 8, 32],
  ] as const) {
    assert.deepEqual([BLADES[id].ap, BLADES[id].damage], [ap, damage]);
  }
  assert.equal(bladeFor({ activeSlot: 'blade', blade: 1811 }).damage, 24);
});
void test('enemy reaction interrupts an exposed charge and death prevents melee damage', () => {
  const s = battle();
  Object.assign(present(s.units[0]), { hp: 20, blade: 1809, activeSlot: 'blade' });
  present(s.units[1]).marksmanship = 100;
  s.seed = 45;
  const n = actBattle(s, { type: 'charge', unitId: 0, targetId: 'e' });
  assert.equal(present(n.units[0]).hp, 0);
  assert.equal(present(n.units[1]).hp, 100);
  assert.equal(present(n.units[1]).loaded, 0);
  assert.ok(n.log.includes(`${present(s.units[1]).name} interrumpe con sus PA restantes.`));
  assert.equal(n.status, 'defeat');
});
void test('smoke and quiet movement prevent reaction; enemy AP is not replenished twice', () => {
  const s = battle();
  present(s.units[0]).stealthMode = true;
  present(s.units[0]).stealth = 100;
  present(s.units[0]).movementMode = 'prone';
  present(s.units[0]).stance = 'prone';
  present(s.units[1]).x = 8;
  s.smoke = [{ x: 4, y: 1, radius: 4, turns: 3 }];
  const n = actBattle(s, { type: 'move', unitId: 0, x: 2, y: 1 });
  assert.equal(present(n.units[1]).loaded, 1);
  assert.ok(!n.log.some((t) => /interrumpe(?:n)? con sus PA restantes/.test(t)));
  const e = endTurn(battle());
  assert.ok(present(e.units.find((u) => u.side === 'enemy')).ap < 100);
});
void test('exploration rests a ready firearm visually while deliberate aiming and combat stay ready', async () => {
  const { register } = await import('node:module');
  register('../tools/test-render-loader.ts', import.meta.url);
  const { presentActors } = await import('../apps/web/lib/three/presentation.ts');
  const s = battle(),
    actor = present(s.units[0]),
    key = `unit:${present(actor).id}`;
  s.mode = 'exploration';
  present(actor).weaponReady = true;
  const renderActor = (options: Parameters<typeof presentActors>[4] = {}) => {
    const before = structuredClone(s),
      visual = presentActors(s, [{ key, kind: 'unit', actor }], {}, new Set(), options)[0];
    assert.deepEqual(s, before);
    return visual;
  };
  assert.equal(present(renderActor()).action, 'idle');
  assert.equal(present(renderActor()).idleAction, 'idle');
  assert.equal(present(renderActor()).relaxedIdle, true);
  assert.equal(present(actor).weaponReady, true);
  assert.equal(present(renderActor({ selected: present(actor).id, mode: 'fire' })).action, 'aim');
  assert.equal(
    present(renderActor({ selected: present(actor).id, mode: 'fire' })).relaxedIdle,
    false,
  );
  assert.equal(
    present(renderActor({ cues: { [key]: { id: 'deliberate-aim', action: 'aim', startedAt: 0 } } }))
      .action,
    'aim',
  );
  s.mode = 'combat';
  assert.equal(present(renderActor()).action, 'aim');
  assert.equal(present(renderActor()).idleAction, 'aim');
  assert.equal(present(renderActor()).relaxedIdle, false);
  s.status = 'victory';
  assert.equal(present(renderActor()).action, 'idle');
  assert.equal(present(renderActor({ selected: present(actor).id, mode: 'fire' })).action, 'aim');
  Reflect.deleteProperty(s, 'status');
  assert.equal(present(renderActor()).action, 'aim');
  s.mode = 'exploration';
  present(actor).activeSlot = 'blade';
  assert.equal(
    present(renderActor({ selected: present(actor).id, mode: 'move' })).relaxedIdle,
    true,
  );
  assert.equal(
    present(renderActor({ selected: present(actor).id, mode: 'melee' })).relaxedIdle,
    true,
    'selecting a blade alone is not an attack',
  );
  assert.equal(
    present(
      renderActor({ cues: { [key]: { id: 'deliberate-strike', action: 'strike', startedAt: 0 } } }),
    ).relaxedIdle,
    false,
  );
  const motion = {
    x: present(actor).x,
    y: present(actor).y,
    direction: 3,
    frame: 2,
    moving: true,
    elapsedDistance: 0.8,
    speed: 1,
  };
  const moving = presentActors(s, [{ key, kind: 'unit', actor }], { [key]: motion }, new Set(), {
    mode: 'move',
  })[0];
  assert.equal(present(moving).relaxedIdle, false);
  assert.notEqual(present(moving).action, 'idle');
  const stopped = presentActors(
    s,
    [{ key, kind: 'unit', actor }],
    { [key]: { ...motion, moving: false, settled: true } },
    new Set(),
    { mode: 'move' },
  )[0];
  assert.equal(present(stopped).action, 'idle');
  assert.equal(present(stopped).relaxedIdle, true);
  s.mode = 'combat';
  assert.equal(present(renderActor()).relaxedIdle, false);
});
