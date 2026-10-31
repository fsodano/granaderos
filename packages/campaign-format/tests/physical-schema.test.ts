import { present } from '../../../tests/assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCampaignPhysical } from '../physical-schema.js';
import { validateEnvironmentRecord } from '../environment-record-schema.js';

const world = { sectors: [{ id: 'camp' }], cells: [{ location: 'road' }] };
const physical = () => ({
  version: 1,
  caches: { camp: { chest: 'camp-chest', contents: [{ item: 'rations', count: 3 }] } },
  arsenals: {
    camp: {
      version: 1,
      sector: 'camp',
      chest: 'arsenal-chest',
      pieces: [{ id: 'arsenal:camp:1', type: 'cannon', side: 'player', loaded: false, ammo: 4 }],
    },
  },
  environment: {
    chapel: {
      doors: [{ id: 'door-1', type: 'door', open: false, locked: true, lockDifficulty: 40 }],
      containers: [
        {
          selector: { type: 'chest', buildingId: 'chapel', purpose: 'storage' },
          configuration: {
            type: 'chest',
            contents: [{ item: 'inventory:letter', count: 1, instanceId: 'letter-1' }],
          },
        },
      ],
    },
  },
});

void test('physical format admits finite sources and separate scenes without changing source records', () => {
  const value = physical();
  const before = structuredClone(value);
  assert.deepEqual(validateCampaignPhysical(value, world), []);
  assert.deepEqual(value, before);
  assert.deepEqual(validateCampaignPhysical(undefined, world), []);
});

void test('physical format rejects invalid places, selectors, finite quantities and duplicate item identities', () => {
  for (const change of [
    (value: ReturnType<typeof physical>) => {
      Reflect.set(value.caches, 'missing', value.caches.camp);
    },
    (value: ReturnType<typeof physical>) => {
      present(value.caches.camp.contents[0]).count = 0;
    },
    (value: ReturnType<typeof physical>) => {
      const duplicate = { item: 'inventory:letter', count: 1, instanceId: 'letter-1' };
      value.caches.camp.contents.push(duplicate);
    },
    (value: ReturnType<typeof physical>) => {
      present(value.arsenals.camp.pieces[0]).ammo = -1;
    },
    (value: ReturnType<typeof physical>) => {
      value.arsenals.camp.pieces.push(present(structuredClone(value.arsenals.camp.pieces[0])));
    },
    (value: ReturnType<typeof physical>) => {
      Reflect.deleteProperty(present(value.environment.chapel.containers[0]).selector, 'purpose');
    },
    (value: ReturnType<typeof physical>) => {
      present(value.environment.chapel.doors[0]).open = true;
    },
    (value: ReturnType<typeof physical>) => {
      Reflect.set(present(value.environment.chapel.doors[0]), 'trap', {
        type: 'injury',
        difficulty: 120,
      });
    },
  ]) {
    const value = physical();
    change(value);
    assert.ok(validateCampaignPhysical(value, world).length);
  }
});

void test('environment records reject malformed state and preserve independent item capability admission', () => {
  assert.throws(() => validateEnvironmentRecord({ type: 'chest', locked: 'yes' }), /cierre/);
  assert.throws(
    () => validateEnvironmentRecord({ type: 'chest', contents: [{ item: 'rations', count: 1.5 }] }),
    /cantidad/,
  );
  assert.throws(
    () =>
      validateEnvironmentRecord({
        type: 'chest',
        contents: [{ item: 'inventory:letter', count: 2, instanceId: 'letter-1' }],
      }),
    /separado/,
  );
  const futureTool = {
    item: 'inventory:future-tool',
    count: 1,
    itemType: 'tool',
    toolKey: 'future-tool',
  };
  assert.equal(validateEnvironmentRecord({ type: 'chest', contents: [futureTool] }), true);
  const value = physical();
  present(value.arsenals.camp.pieces[0]).type = 'future-artillery';
  assert.deepEqual(validateCampaignPhysical(value, world), []);
});
