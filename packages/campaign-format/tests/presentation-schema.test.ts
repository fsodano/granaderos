import { present } from '../../../tests/assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCampaignPresentation } from '../presentation-schema.js';
import { validateOfficerCreation } from '../officer-creation-schema.js';

const content = {
  scenario: 'generic-v1',
  characters: [{ id: 'ana' }],
  weapons: [
    { id: 'rifle', template: 1802 },
    { id: 'blade', template: 1811 },
  ],
  maps: { camp: { id: 'camp' } },
  world: { sectors: [{ id: 'camp' }] },
};
const presentation = () => ({
  version: 1,
  title: 'Campaña de prueba',
  characterPortraits: [
    {
      id: 'ana',
      name: 'Ana',
      gender: 'woman',
      role: 'scout',
      skinTone: 'brown',
      src: '/art/ana.png',
      spriteAppearance: 'woman-scout',
    },
  ],
  officerCreation: {
    classes: [
      {
        id: 'soldado',
        name: 'Soldado',
        description: 'Equipo de campaña.',
        weapon: 'rifle',
        blade: 'blade',
      },
    ],
    defaults: { classId: 'soldado', portraitId: 'ana' },
  },
  introduction: {
    scenes: [
      {
        id: 'start',
        title: 'Comienzo',
        text: 'La escuadra recibe sus órdenes.',
        visual: 'map',
        durationMs: 1000,
      },
    ],
  },
  atlas: { sites: [{ id: 'camp', label: 'Campamento', lon: -60, lat: -34 }] },
  skirmish: {
    label: 'Combate de prueba',
    operativeIds: [2000],
    horse: false,
    request: { id: 'camp', name: 'Campamento', biome: 'plains', seed: 1, enemyCount: 1 },
  },
});

void test('presentation format admits safe text, portraits, local equipment and campaign references without mutation', () => {
  const source = presentation();
  const before = structuredClone(source);
  assert.deepEqual(validateCampaignPresentation(source, content), []);
  assert.deepEqual(validateOfficerCreation(source.officerCreation, content), []);
  assert.deepEqual(source, before);
});

void test('presentation format rejects malformed records and missing published references', () => {
  for (const change of [
    (value: ReturnType<typeof presentation>) => {
      value.title = '';
    },
    (value: ReturnType<typeof presentation>) => {
      value.characterPortraits.push(present(structuredClone(value.characterPortraits[0])));
    },
    (value: ReturnType<typeof presentation>) => {
      present(value.characterPortraits[0]).src = 'javascript:alert(1)';
    },
    (value: ReturnType<typeof presentation>) => {
      present(value.introduction.scenes[0]).durationMs = -1;
    },
    (value: ReturnType<typeof presentation>) => {
      Reflect.set(value.introduction, 'chart', { route: '<script>' });
    },
    (value: ReturnType<typeof presentation>) => {
      present(value.officerCreation.classes[0]).weapon = 'missing-weapon';
    },
    (value: ReturnType<typeof presentation>) => {
      value.officerCreation.defaults.portraitId = 'missing-portrait';
    },
    (value: ReturnType<typeof presentation>) => {
      present(value.atlas.sites[0]).id = 'missing-sector';
    },
    (value: ReturnType<typeof presentation>) => {
      value.skirmish.request.id = 'missing-map';
    },
  ]) {
    const invalid = presentation();
    change(invalid);
    assert.ok(validateCampaignPresentation(invalid, content).length);
  }
});

void test('presentation format treats executable catalogue support as a game admission rule', () => {
  const source = presentation();
  present(source.characterPortraits[0]).spriteAppearance = 'new-renderer-archetype';
  Reflect.set(present(source.officerCreation.classes[0]), 'bladeFittingPattern', 'new-fitting');
  source.skirmish.operativeIds = [9999];
  assert.deepEqual(validateCampaignPresentation(source, content), []);
});
