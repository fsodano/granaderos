import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainIdentityMap } from '../game/infrastructure/persistence/domain-identity-map.ts';
import { CanonicalSectorMapper } from '../game/infrastructure/persistence/canonical-sector-mapper.js';

function field(id, residents = [], participants = []) {
  return {
    sectorId: id,
    width: 10,
    height: 10,
    npcs: residents,
    units: participants,
    groundItems: [],
  };
}

test('restored sectors share identity and transfer the existing resident without copying inventory ownership', () => {
  const resident = {
    id: 'resident-1',
    operativeId: 2100,
    hp: 80,
    x: 1,
    y: 2,
    inventory: { rations: 3 },
  };
  const source = field('source', [resident]);
  const destination = field('destination');
  const identities = new DomainIdentityMap();
  const mapper = new CanonicalSectorMapper(identities);
  mapper.restoreField(source, 'sector:source');
  mapper.restoreField(destination, 'sector:destination');
  const origin = mapper.object('source');
  assert.equal(
    identities.obtain('Sector', 'source', () => assert.fail('duplicate sector')),
    origin,
  );
  origin.transferResidentTo(
    mapper.object('destination'),
    'character:2100',
    { x: 4, y: 5, level: 0 },
    'character:2100',
  );
  mapper.apply();
  assert.equal(source.npcs.length, 0);
  assert.equal(destination.npcs[0], resident);
  assert.equal(resident.x, 4);
  assert.equal(resident.y, 5);
  assert.equal(resident.hp, 80);
  assert.deepEqual(resident.inventory, { rations: 3 });
});

test('sector projection preserves local participant identities when another sector reuses an enemy label', () => {
  const resident = { id: 'resident', hp: 100, x: 1, y: 1 };
  const firstEnemy = { id: 'enemy-1', hp: 50, x: 4, y: 4 };
  const secondEnemy = { id: 'enemy-1', hp: 90, x: 6, y: 6 };
  const first = field('first', [resident], [firstEnemy]);
  const second = field('second', [], [secondEnemy]);
  const mapper = new CanonicalSectorMapper(new DomainIdentityMap());
  mapper.restoreField(first, 'sector:first');
  mapper.restoreField(second, 'sector:second');
  mapper
    .object('first')
    .moveResident('character:resident', { x: 2, y: 1, level: 0 }, 'character:resident');
  mapper.apply();
  assert.equal(first.units[0], firstEnemy);
  assert.equal(first.units[0].hp, 50);
  assert.equal(second.units[0], secondEnemy);
});

test('sector reference projection refuses a body removal until world settlement materializes its receipt', () => {
  const corpse = {
    id: 'corpse-1',
    characterId: 'resident',
    diedAtSeconds: 0,
    removalAtSeconds: 172800,
  };
  const actor = { id: 'resident', hp: 0, x: 1, y: 1, corpse };
  const source = field('source', [actor]);
  const mapper = new CanonicalSectorMapper(new DomainIdentityMap());
  mapper.restoreField(source, 'sector:source');
  mapper.object('source').removeCorpse(corpse.id, [], []);
  assert.throws(() => mapper.apply(), /registro/);
  assert.equal(source.npcs[0], actor);
  source.deathHistory = [{ corpse, actor: structuredClone(actor), kind: 'resident' }];
  mapper.apply();
  assert.equal(source.npcs.length, 0);
  assert.equal(source.deathHistory.length, 1);
});
