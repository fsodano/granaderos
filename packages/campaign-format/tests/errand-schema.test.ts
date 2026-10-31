import { present } from '../../../tests/assert-present.ts';
import type { ErrandDefinition } from '../types.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateErrandDefinitions, validateErrandContactReferences } from '../errand-schema.js';
import { validateRoadsideDiscoveries } from '../roadside-discovery-schema.js';
import { CampaignContentSchema, ATTRIBUTE_FIELDS } from '../content-schema.js';

const world = {
  sectors: [{ id: 'retiro' }, { id: 'buenos_aires' }, { id: 'rural' }],
  cities: [{ id: 'capital', sectors: ['retiro', 'buenos_aires'] }],
  cells: [
    { id: 'cell-1-1', land: true },
    { id: 'cell-1-2', land: false },
  ],
};
function errand(id = 'medical-supplies', npcId = 'authored-resident'): ErrandDefinition {
  return {
    id,
    npcId,
    sector: 'retiro',
    title: 'Medical supplies',
    offer: 'Bring two dressings.',
    delivery: 'The dressings arrived.',
    cost: {},
    requiredSectors: [],
    carried: {
      item: 'medkits',
      label: 'Dressings',
      instruction: 'Deliver to the resident.',
      count: 2,
    },
    reward: { treasury: 0, loyalty: true },
  };
}
function content() {
  return {
    format: 'granaderos-content',
    version: 1,
    id: 'errand-format',
    name: 'Errand format',
    characters: [
      {
        id: 'resident',
        name: 'Resident',
        nickname: 'Resident',
        role: '',
        biography: '',
        portrait: 'data:image/png;base64,AA==',
        monthlyPay: 0,
        weapon: null,
        attributes: Object.fromEntries(ATTRIBUTE_FIELDS.map((field) => [field, 60])),
      },
    ],
    weapons: [],
    placements: [
      {
        id: 'resident-placement',
        character: 'resident',
        mode: 'fixed',
        sectors: ['retiro'],
        moveChance: 100,
        afterDeath: null,
        delayMin: 0,
        delayMax: 0,
      },
    ],
    errands: [errand()],
  };
}
function discovery() {
  return {
    version: 1,
    id: 'tools',
    cell: 'cell-1-1',
    x: 4,
    y: 5,
    crowbarCondition: 70,
    linenShirtCondition: 80,
  };
}

void test('portable errand admission preserves documents and validates declared references', () => {
  const source = content();
  const before = structuredClone(source);
  assert.deepEqual(validateErrandDefinitions(source.errands, { world }), []);
  assert.deepEqual(validateErrandContactReferences(source), []);
  assert.deepEqual(new CampaignContentSchema().validate(source, world), []);
  assert.deepEqual(source, before);
  present(source.errands[0]).sector = 'missing';
  assert.match(
    new CampaignContentSchema().validate(source, world).join('\n'),
    /localidad inexistente/,
  );
});

void test('errand identity, recipient, reward and dependency contracts reject invalid files', () => {
  const cases = [
    (quest: ErrandDefinition) => {
      Reflect.set(quest, 'extra', true);
    },
    (quest: ErrandDefinition) => {
      present(quest.carried).count = 0;
    },
    (quest: ErrandDefinition) => {
      present(quest.carried).outfit = 'poncho';
    },
    (quest: ErrandDefinition) => {
      present(quest.reward).treasury = -1;
    },
    (quest: ErrandDefinition) => {
      quest.requiredSectors = ['missing'];
    },
    (quest: ErrandDefinition) => {
      quest.requires = ['missing'];
    },
    (quest: ErrandDefinition) => {
      quest.sector = 'rural';
    },
    (quest: ErrandDefinition) => {
      Reflect.set(quest, 'beneficiaries', [{ id: 'one', npcId: 'authored-resident' }]);
    },
  ];
  for (const change of cases) {
    const quest = errand();
    change(quest);
    assert.ok(validateErrandDefinitions([quest], { world }).length > 0);
  }
  const first = { ...errand('first', 'first-contact'), requires: ['second'] };
  const second = { ...errand('second', 'second-contact'), requires: ['first'] };
  assert.match(validateErrandDefinitions([first, second], { world }).join('\n'), /ciclo/);
});

void test('authored contacts require both a character identity and a placement reference', () => {
  const source = content();
  present(source.errands[0]).npcId = 'authored-missing';
  assert.match(validateErrandContactReferences(source).join('\n'), /contacto no existe/);
  present(source.errands[0]).npcId = 'authored-resident';
  source.placements = [];
  assert.match(
    new CampaignContentSchema().validate(source, world).join('\n'),
    /no aparece en el mapa/,
  );
});

void test('escort admission checks declared destination and edge while game owns path feasibility', () => {
  const quest = errand();
  delete quest.carried;
  quest.escort = { destination: 'buenos_aires', edge: 'N' };
  assert.deepEqual(validateErrandDefinitions([quest], { world }), []);
  Reflect.set(present(quest.escort), 'edge', 'middle');
  assert.match(validateErrandDefinitions([quest], { world }).join('\n'), /borde válido/);
});

void test('roadside discovery admission requires finite record fields and a declared land cell', () => {
  const valid = discovery();
  assert.deepEqual(validateRoadsideDiscoveries([valid], { world }), []);
  assert.deepEqual(validateRoadsideDiscoveries(undefined, { world }), []);
  for (const patch of [
    { cell: 'cell-1-2' },
    { cell: 'cell-2-2' },
    { x: 20 },
    { y: -1 },
    { crowbarCondition: 101 },
    { version: 2 },
    { extra: true },
  ]) {
    assert.ok(validateRoadsideDiscoveries([{ ...valid, ...patch }], { world }).length > 0);
  }
  const source = { ...content(), roadsideDiscoveries: [{ ...valid, cell: 'cell-2-2' }] };
  assert.match(
    new CampaignContentSchema().validate(source, world).join('\n'),
    /Hallazgo de camino/,
  );
  assert.deepEqual(valid, discovery());
});
