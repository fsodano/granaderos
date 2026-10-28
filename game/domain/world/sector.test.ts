import test from 'node:test';
import assert from 'node:assert/strict';
import { Sector } from './sector.ts';
import type { SectorCharacterReference, SectorSnapshot } from './sector.ts';
import { ItemCustody, ItemCustodianKind } from './item-custody.ts';

const resident = (characterId = 'character:1'): SectorCharacterReference => ({
  characterId,
  localId: `resident:${characterId}`,
  custodianId: characterId,
  position: { x: 1, y: 2, level: 0 },
  alive: true,
});
const empty = (id = 'retirement'): SectorSnapshot => ({
  id,
  environment: { width: 8, height: 8 },
  residents: [],
  participants: [],
  corpses: [],
  objects: [],
  removedCharacterIds: [],
});

test('sector admission protects character identity, custodian identity, and local bounds', () => {
  const sector = new Sector(empty());
  sector.admitResident(resident());
  const before = sector.toSnapshot();
  assert.throws(() => sector.admitParticipant(resident()));
  assert.throws(() =>
    sector.admitResident({ ...resident('character:2'), custodianId: 'character:3' }),
  );
  assert.throws(() =>
    sector.admitResident({ ...resident('character:2'), position: { x: 8, y: 0, level: 0 } }),
  );
  assert.deepEqual(sector.toSnapshot(), before);
  const snapshot = sector.toSnapshot();
  (snapshot.environment as { width: number }).width = 100;
  assert.equal(sector.toSnapshot().environment.width, 8);
});

test('local movement and cross-sector transfer preserve canonical custody and refuse atomically', () => {
  const origin = new Sector({ ...empty(), residents: [resident()] });
  const destination = new Sector(empty('san-lorenzo'));
  origin.moveResident('character:1', { x: 3, y: 4, level: 1 }, 'character:1');
  const before = origin.toSnapshot();
  assert.throws(() =>
    origin.transferResidentTo(destination, 'character:1', { x: 30, y: 0, level: 0 }, 'character:1'),
  );
  assert.throws(() => origin.moveResident('character:1', { x: 2, y: 1, level: 0 }, 'character:2'));
  assert.deepEqual(origin.toSnapshot(), before);
  assert.deepEqual(destination.toSnapshot().residents, []);
  origin.transferResidentTo(destination, 'character:1', { x: 2, y: 1, level: 0 }, 'character:1');
  assert.equal(origin.toSnapshot().residents.length, 0);
  assert.deepEqual(destination.toSnapshot().residents, [
    { ...resident(), position: { x: 2, y: 1, level: 0 } },
  ]);
});

test('corpse removal requires complete ground custody and permanently removes its physical reference', () => {
  const actor = { ...resident(), alive: false };
  const corpse = {
    id: 'body:1',
    characterId: actor.characterId,
    localId: actor.localId,
    position: actor.position,
    itemIds: ['musket:1', 'rations:1'],
  };
  const sector = new Sector({ ...empty(), residents: [actor], corpses: [corpse] });
  const groundObjects = corpse.itemIds.map((id) => ({
    id: `ground:${id}`,
    custodianId: `ground:${sector.id}`,
    position: actor.position,
    itemIds: [id],
  }));
  const equipment = corpse.itemIds.map(
    (id) => new ItemCustody(id, { kind: ItemCustodianKind.Ground, id: sector.id }),
  );
  const before = sector.toSnapshot();
  assert.throws(() => sector.removeCorpse(corpse.id, equipment.slice(0, 1), groundObjects));
  assert.throws(() =>
    sector.removeCorpse(corpse.id, equipment, [
      groundObjects[0],
      { ...groundObjects[1], itemIds: ['musket:1'] },
    ]),
  );
  assert.deepEqual(sector.toSnapshot(), before);
  sector.removeCorpse(corpse.id, equipment, groundObjects);
  const after = sector.toSnapshot();
  assert.deepEqual(after.corpses, []);
  assert.deepEqual(after.residents, []);
  assert.deepEqual(after.objects, groundObjects);
  assert.deepEqual(after.removedCharacterIds, ['character:1']);
  assert.throws(() => sector.admitResident(resident()));
  assert.throws(() => sector.removeCorpse(corpse.id, equipment, groundObjects));
});

test('resident reconciliation cannot drop a retained corpse or duplicate an object identity', () => {
  const actor = { ...resident(), alive: false };
  const sector = new Sector({
    ...empty(),
    residents: [actor],
    corpses: [
      {
        id: 'body:1',
        characterId: actor.characterId,
        localId: actor.localId,
        position: actor.position,
        itemIds: [],
      },
    ],
  });
  assert.throws(() => sector.replaceResidents([]));
  const object = {
    id: 'ground:1',
    custodianId: 'ground:1',
    position: actor.position,
    itemIds: ['weapon:1'],
  };
  sector.admitObject(object);
  assert.throws(() => sector.admitObject({ ...object, id: 'ground:2' }));
  assert.equal(sector.toSnapshot().objects.length, 1);
});
