import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCampaignPhysical as validatePhysicalSchema } from '../campaign-format/physical-schema.js';
import { validateCampaignPhysical } from '../game/campaign-physical-validation.js';
import { validateEnvironmentRecord } from '../campaign-format/environment-record-schema.js';
import { validateEnvironment } from '../game/environment-interactions.js';
import { DEFAULT_WORLD } from '../campaigns/default.js';

const source = () => ({ version: 1, caches: {}, arsenals: {}, environment: {} });

test('shared physical admission preserves the default campaign and game capability checks', () => {
  assert.deepEqual(validatePhysicalSchema(DEFAULT_WORLD.physical, DEFAULT_WORLD), []);
  assert.deepEqual(validateCampaignPhysical(DEFAULT_WORLD.physical, DEFAULT_WORLD), []);
  const physical = source();
  physical.arsenals.retiro = {
    version: 1,
    sector: 'retiro',
    chest: 'arsenal-chest',
    pieces: [
      {
        id: 'arsenal:retiro:future',
        type: 'future-artillery',
        side: 'player',
        loaded: false,
        ammo: 4,
      },
    ],
  };
  assert.deepEqual(validatePhysicalSchema(physical, DEFAULT_WORLD), []);
  assert.match(validateCampaignPhysical(physical, DEFAULT_WORLD).join('\n'), /pieza inválida/);
});

test('runtime environment checks retain item support after shared record admission', () => {
  const environment = { type: 'chest', open: true, contents: [{ item: 'rations', count: 3 }] };
  assert.equal(validateEnvironmentRecord(environment), true);
  assert.equal(validateEnvironment(environment), true);
  const unsupported = {
    type: 'chest',
    contents: [
      { item: 'inventory:future-tool', count: 1, itemType: 'tool', toolKey: 'future-tool' },
    ],
  };
  assert.equal(validateEnvironmentRecord(unsupported), true);
  assert.throws(() => validateEnvironment(unsupported), /herramienta/);
  const physical = source();
  physical.caches.retiro = { chest: 'supply-chest', contents: unsupported.contents };
  assert.deepEqual(validatePhysicalSchema(physical, DEFAULT_WORLD), []);
  assert.match(validateCampaignPhysical(physical, DEFAULT_WORLD).join('\n'), /herramienta/);
});
