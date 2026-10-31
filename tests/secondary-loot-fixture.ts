import { present } from './assert-present.ts';
import type { ActiveGame } from './local-contract-fixture.ts';
import type { TacticalAction, TacticalPoint } from '../packages/game/public/compatibility-types.ts';
import { fightOnArrival } from './assault-fixture.ts';
import assert from 'node:assert/strict';
import { defaultContentPackage } from '../packages/game/content-package.js';
import { initialCampaign } from '../packages/game/campaign.js';
import { enterSector } from '../packages/game/world.js';
import { createBattle, actBattle, getReachable } from '../packages/game/tactical.js';
import { order, saved, sync } from './local-contract-fixture.ts';
export const secondaryName = 'Sable del Regimiento';
export function secondaryLootField({ companion = false, sameFirearm = false } = {}) {
  const d = defaultContentPackage(),
    source = present(d.weapons.find((w) => w.id === 'blade-1809'));
  Object.assign(source, {
    name: secondaryName,
    art: '/art/weapon-1810.png',
    damage: 23,
    ap: 18,
    reach: 1.7,
    weight: 2.5,
  });
  const own = present(d.weapons.find((w) => w.id === 'blade-1812'));
  Object.assign(own, { damage: 100, ap: 8, reach: 3 });
  d.oppositionBlades = { officer: 'blade-1809', line: 'blade-1809', veteran: 'blade-1809' };
  const c = present(d.characters.find((c) => c.id === 'person-110'));
  c.arrivalHours = 0;
  c.blade = 'blade-1812';
  if (companion) {
    const second = present(d.characters.find((c) => c.id === 'person-111'));
    second.arrivalHours = 0;
    if (sameFirearm) {
      second.weapon = c.weapon;
    }
  }
  let s = order(initialCampaign(45, d), { type: 'recruitCivic', id: 110, term: 'week' });
  if (companion) {
    s = order(s, { type: 'recruitCivic', id: 111, term: 'week' });
  }
  s = fightOnArrival(order(s, { type: 'attack', sector: 'buenos_aires' }));
  const request = present(s.pendingBattle),
    field = enterSector(request),
    enemies = field.units.filter((u) => u.side === 'enemy');
  // Actual paid attack and issued troop equipment, in declared compact geometry.
  // Keep one distant opponent so looting spends combat AP after the real kill.
  const tiles = Array.from({ length: 400 }, (_, i) => ({
    x: i % 20,
    y: Math.floor(i / 20),
    type: 'grass',
    blocked: false,
    cover: 0,
  }));
  let battle = createBattle(
    request.squad.map((u, i) => ({ ...u, x: 1, y: i ? 0 : 1, activeSlot: 'blade' })),
    {
      ...request,
      width: 20,
      height: 20,
      tiles,
      enemies: enemies.map((u, i) => ({
        ...u,
        x: i ? 19 : 2,
        y: i ? 19 - i : 1,
        patrolOrigin: { x: i ? 19 : 2, y: i ? 19 - i : 1 },
        overwatch: false,
      })),
      seed: 45,
    },
  );
  const target = present(battle.units.find((u) => u.side === 'enemy')).id;
  for (let i = 0; i < 3 && present(battle.units.find((u) => u.id === target)).hp > 0; i++) {
    battle = actBattle(battle, { type: 'melee', unitId: '110', targetId: target });
    assert.equal(battle.lastError, null);
  }
  assert.equal(present(battle.units.find((u) => u.id === target)).hp, 0);
  return { ...saved(sync({ campaign: s, battle })), target };
}
export function secondaryOrder(
  pair: ActiveGame & { target?: string | undefined },
  action: TacticalAction,
) {
  const order: TacticalAction = action.type === 'groupMove' ? action : { unitId: '110', ...action };
  const battle = actBattle(pair.battle, order);
  assert.equal(battle.lastError, null, battle.lastError ?? undefined);
  return { ...sync({ campaign: pair.campaign, battle }), target: pair.target };
}

// Complete a real boundary withdrawal before submitting a campaign report.
export function secondaryRetreat(pair: ActiveGame & { target?: string | undefined }) {
  let p = pair;
  const exit = p.battle.exits.find(
    (e) => e.destination === present(p.campaign.pendingBattle).origin,
  );
  assert.ok(exit);
  const onEdge = (u: TacticalPoint) =>
    exit.edge === 'N'
      ? u.y === 0
      : exit.edge === 'S'
        ? u.y === p.battle.height - 1
        : exit.edge === 'W'
          ? u.x === 0
          : u.x === p.battle.width - 1;
  for (const id of p.battle.units
    .filter((u) => u.side === 'player' && u.hp > 0 && !u.departure)
    .map((u) => u.id)) {
    for (
      let step = 0;
      !onEdge(present(p.battle.units.find((u) => u.id === id))) && step < 30;
      step++
    ) {
      const u = present(p.battle.units.find((u) => u.id === id)),
        before = { x: u.x, y: u.y };
      const destination = getReachable(p.battle, u)
        .filter(
          (q) =>
            onEdge(q) &&
            !p.battle.units.some(
              (v) => v.id !== id && v.hp > 0 && !v.departure && v.x === q.x && v.y === q.y,
            ),
        )
        .sort((a, b) => a.cost - b.cost)[0];
      assert.ok(destination);
      p = secondaryOrder(p, { type: 'move', unitId: id, x: destination.x, y: destination.y });
      const after = present(p.battle.units.find((u) => u.id === id));
      assert.notDeepEqual(
        { x: after.x, y: after.y },
        before,
        'withdrawal must make a real paid step after contact interrupts a route',
      );
    }
    assert.ok(onEdge(present(p.battle.units.find((u) => u.id === id))));
    // A reaction can interrupt the exit without spending its final AP. Retry
    // the same ordinary exit after each opponent's finite reaction is used.
    const attempts = p.battle.units.filter((u) => u.side === 'enemy' && u.hp > 0).length + 1;
    for (
      let attempt = 0;
      attempt < attempts && !present(p.battle.units.find((u) => u.id === id)).departure;
      attempt++
    ) {
      p = secondaryOrder(p, { type: 'exit', unitIds: [id], exitId: exit.id });
    }
    assert.ok(
      present(p.battle.units.find((u) => u.id === id)).departure,
      'the soldier must actually leave at the boundary',
    );
  }
  assert.equal(
    p.battle.status,
    'retreat',
    JSON.stringify({
      units: p.battle.units.map((u) => ({
        id: u.id,
        side: u.side,
        hp: u.hp,
        departure: u.departure,
        x: u.x,
        y: u.y,
        missionAlly: u.missionAlly,
      })),
      exits: p.battle.exits,
      log: p.battle.log.slice(-5),
    }),
  );
  return p;
}
