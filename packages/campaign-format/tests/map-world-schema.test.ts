import { present } from '../../../tests/assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMapDocument } from '../map-schema.js';
import { validateWorldData } from '../world-schema.js';
import { definitionMaps, definitionWorld } from './definition-fixtures.ts';

void test('published world and map documents pass neutral admission without mutation', () => {
  const world = definitionWorld();
  const maps = definitionMaps();
  const before = structuredClone({ world, maps });
  assert.deepEqual(validateWorldData(world), []);
  for (const map of Object.values(maps)) {
    assert.deepEqual(validateMapDocument(map).errors, []);
  }
  assert.deepEqual({ world, maps }, before);
});

void test('world schema rejects dangling locality, district, route and strategy references', () => {
  const cases: readonly [(world: ReturnType<typeof definitionWorld>) => void, RegExp][] = [
    [(world) => present(world.sectors[0]).neighbors.push('missing'), /localidad inválida|conexión/],
    [
      (world) => {
        present(world.cells.find((cell) => cell.district)).locality = 'missing';
      },
      /localidad inexistente|distrito/,
    ],
    [
      (world) => {
        present(world.districts.retiro[0]).sectorId = 'missing';
      },
      /distrito inválido/,
    ],
    [
      (world) => {
        Reflect.set(world, 'enemyStrategy', {
          version: 1,
          theaters: { missing: { legHours: 1, reserve: 0, raidEveryHours: 1, axis: ['retiro'] } },
        });
      },
      /política inválida/,
    ],
  ];
  for (const [change, message] of cases) {
    const world = definitionWorld();
    change(world);
    assert.match(validateWorldData(world).join('\n'), message);
  }
});

void test('map schema rejects invalid record identities and local container, room and surface references', () => {
  const map = present(definitionMaps()['retiro']);
  const original = structuredClone(map);
  map.items.push({
    id: 'invalid-item',
    type: 'ammo',
    count: 1,
    x: 1,
    y: 1,
    containerId: 'missing',
  });
  assert.match(validateMapDocument(map).errors.join('\n'), /Objeto o contenedor/);
  const duplicate = structuredClone(original);
  duplicate.spawns.push({ id: present(duplicate.buildings[0]).id, side: 'player', x: 1, y: 1 });
  assert.match(validateMapDocument(duplicate).errors.join('\n'), /ID duplicado/);
  const upper = structuredClone(original);
  upper.upperSurfaces = [
    {
      id: 'upper',
      type: 'floor',
      kind: 'platform',
      x: 1,
      y: 1,
      tacticalLevel: 1,
      elevation: 3,
      blocked: false,
      cover: 0,
      roomId: 'missing',
    },
  ];
  assert.match(validateMapDocument(upper).errors.join('\n'), /pertenencia a la habitación/);
  Reflect.deleteProperty(present(upper.upperSurfaces[0]), 'roomId');
  Reflect.set(upper, 'climbLinks', [
    { id: 'access', kind: 'climb', from: { x: 1, y: 1 }, to: { x: 2, y: 1, tacticalLevel: 1 } },
  ]);
  assert.match(validateMapDocument(upper).errors.join('\n'), /extremos de accesos/);
});
