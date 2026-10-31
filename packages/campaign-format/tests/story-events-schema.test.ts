import { present } from '../../../tests/assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCampaignStory } from '../story-schema.js';
import { validateCampaignEvents } from '../event-schema.js';

const context = {
  characters: [{ id: 'guide' }],
  quests: [{ id: 'report' }],
  rules: { startingHour: 5 },
  world: { sectors: [{ id: 'camp' }] },
};
const characters = new Set(['guide']);
const quests = new Set(['report']);
const sectors = new Set(['camp']);
const story = () => ({
  introduction: 'La escuadra recibe sus órdenes.',
  victory: 'La misión está cumplida.',
  defeat: 'La campaña termina.',
  chapters: [
    {
      id: 'report',
      name: 'Informe',
      objective: 'Completá el informe.',
      conditions: [
        { type: 'quest', quest: 'report', status: 'completed' },
        { type: 'sector', sector: 'camp', owner: 'patriot' },
      ],
    },
  ],
  failureConditions: [{ type: 'character', character: 'guide', state: 'dead' }],
});
const events = () => [
  {
    id: 'funding',
    atHour: 12,
    text: 'Llegan recursos para la escuadra.',
    conditions: [{ type: 'character', character: 'guide', state: 'alive' }],
    effects: [
      { type: 'treasury', operation: 'receive', amount: 20 },
      { type: 'quest', quest: 'report', status: 'active' },
    ],
  },
];

void test('chapter and event definitions validate published references without mutation', () => {
  const chapterRecords = story(),
    eventRecords = events();
  const before = structuredClone({ chapterRecords, eventRecords });
  assert.equal(validateCampaignStory(chapterRecords, characters, quests, sectors), undefined);
  assert.deepEqual(validateCampaignEvents(eventRecords, context), []);
  assert.deepEqual({ chapterRecords, eventRecords }, before);
});

void test('chapter admission rejects duplicate chapters, missing identities and encounter conditions', () => {
  for (const change of [
    (value: ReturnType<typeof story>) => {
      value.chapters.push(present(structuredClone(value.chapters[0])));
    },
    (value: ReturnType<typeof story>) => {
      present(present(value.chapters[0]).conditions[0]).quest = 'missing';
    },
    (value: ReturnType<typeof story>) => {
      present(present(value.chapters[0]).conditions[1]).sector = 'missing';
    },
    (value: ReturnType<typeof story>) => {
      present(value.failureConditions[0]).character = 'missing';
    },
    (value: ReturnType<typeof story>) => {
      Reflect.set(present(value.chapters[0]), 'conditions', [
        { type: 'meeting', character: 'guide' },
      ]);
    },
  ]) {
    const value = story();
    change(value);
    assert.throws(() => validateCampaignStory(value, characters, quests, sectors));
  }
});

void test('event admission rejects invalid times, duplicate operations and missing quest references', () => {
  for (const change of [
    (value: ReturnType<typeof events>) => {
      present(value[0]).atHour = 4;
    },
    (value: ReturnType<typeof events>) => {
      value.push(present(structuredClone(value[0])));
    },
    (value: ReturnType<typeof events>) => {
      present(present(value[0]).effects[1]).quest = 'missing';
    },
    (value: ReturnType<typeof events>) => {
      present(value[0]).effects[1] = structuredClone(present(present(value[0]).effects[0]));
    },
    (value: ReturnType<typeof events>) => {
      Reflect.set(present(value[0]), 'conditions', [
        { type: 'sector', sector: 'missing', owner: 'patriot' },
      ]);
    },
    (value: ReturnType<typeof events>) => {
      Reflect.set(present(value[0]), 'conditions', [{ type: 'meeting', character: 'guide' }]);
    },
    (value: ReturnType<typeof events>) => {
      Reflect.set(present(value[0]), 'effects', [
        { type: 'movement', character: 'guide', destination: 'routine' },
      ]);
    },
  ]) {
    const value = events();
    change(value);
    assert.ok(validateCampaignEvents(value, context).length);
  }
});
