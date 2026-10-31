import type { ErrandDefinition } from '../packages/campaign-format/types.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateErrandDefinitions } from '../packages/campaign-format/errand-schema.js';
import { validateRoadsideDiscoveries as validateRoadsideFormat } from '../packages/campaign-format/roadside-discovery-schema.js';
import {
  validateQuestDefinitions,
  freshDefaultErrands,
} from '../packages/game/quest-definitions.js';
import {
  validateRoadsideDiscoveries,
  freshDefaultRoadsideDiscoveries,
} from '../packages/game/roadside-discoveries.js';
import { DEFAULT_WORLD } from '../content/campaigns/default.js';

void test('published errands and roadside discoveries share format validation without changing their documents', () => {
  const errands = freshDefaultErrands();
  const discoveries = freshDefaultRoadsideDiscoveries();
  const before = structuredClone({ errands, discoveries });
  assert.deepEqual(validateErrandDefinitions(errands, { world: DEFAULT_WORLD }), []);
  assert.deepEqual(validateQuestDefinitions(errands), []);
  assert.deepEqual(validateRoadsideFormat(discoveries, { world: DEFAULT_WORLD }), []);
  assert.deepEqual(validateRoadsideDiscoveries(discoveries), []);
  assert.deepEqual({ errands, discoveries }, before);
});

void test('game admission retains equipment capabilities and real escort route validation', () => {
  const quest: ErrandDefinition = {
    id: 'supply',
    npcId: 'contact',
    sector: 'retiro',
    title: 'Supply',
    offer: 'Bring supplies.',
    delivery: 'Supplies received.',
    cost: {},
    requiredSectors: [],
    carried: { item: 'unsupported-supply', count: 1, label: 'Supply', instruction: 'Deliver it.' },
  };
  assert.deepEqual(validateErrandDefinitions([quest], { world: DEFAULT_WORLD }), []);
  assert.match(validateQuestDefinitions([quest]).join('\n'), /objeto de entrega inválido/);
  delete quest.carried;
  quest.escort = { destination: 'mendoza', edge: 'N' };
  assert.deepEqual(validateErrandDefinitions([quest], { world: DEFAULT_WORLD }), []);
  assert.match(validateQuestDefinitions([quest]).join('\n'), /salida existente/);
});
