import { present } from '../../../tests/assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import publishedContent from '../../../content/campaigns/granaderos/content.json' with { type: 'json' };
import publishedWorld from '../../../content/campaigns/granaderos/world.json' with { type: 'json' };
import { CampaignContentSchema } from '../content-schema.js';
import { SPEECH_EVENTS, SPEECH_LINE_LIMIT } from '../character-presentation-schema.js';

const errorsFor = (change: (content: typeof publishedContent) => void) => {
  const content = structuredClone(publishedContent);
  change(content);
  return new CampaignContentSchema().validate(content, publishedWorld).join('\n');
};

void test('optional campaign rule documents receive shared field and cross-reference admission', () => {
  const cases: readonly [(content: typeof publishedContent) => void, RegExp][] = [
    [
      (content) => {
        Reflect.set(content, 'contractRules', { days: {} });
      },
      /Contratos/,
    ],
    [
      (content) => {
        Reflect.set(content, 'careRules', { minimumSkill: 0 });
      },
      /Atención y descanso/,
    ],
    [
      (content) => {
        Reflect.set(content, 'artillerySupply', { enabled: true });
      },
      /Munición de artillería/,
    ],
    [
      (content) => {
        Reflect.set(content, 'foundry', {
          sector: 'missing',
          name: 'Foundry',
          armyName: 'Army',
          setupCost: 0,
          fundingCost: 0,
        });
      },
      /Fundición/,
    ],
    [
      (content) => {
        Reflect.set(content, 'campaignRoles', { foundryEngineer: 'missing', marchCommander: null });
      },
      /personaje asignado no existe/,
    ],
    [
      (content) => {
        Reflect.set(content, 'oppositionEquipment', {
          officer: 'missing',
          line: null,
          veteran: null,
        });
      },
      /arma no existe/,
    ],
    [
      (content) => {
        Reflect.set(content, 'ammunitionMarket', { defaults: {}, locations: {} });
      },
      /Proveedores de munición/,
    ],
    [
      (content) => {
        Reflect.set(present(content.weapons[0]), 'projectileEnergy', {
          model: 'future-model',
          massGrams: 'heavy',
          muzzleVelocityMps: 100,
        });
      },
      /perfil de energía/,
    ],
  ];
  for (const [change, expected] of cases) {
    assert.match(errorsFor(change), expected);
  }
});

void test('speech schema preserves the existing file limit and supported event fields', () => {
  const content = structuredClone(publishedContent);
  const character = present(content.characters[0]);
  const speech: Record<string, string> = Object.fromEntries(
    SPEECH_EVENTS.map((event) => [event, '']),
  );
  Reflect.set(character, 'speech', speech);
  speech['hired'] = 'a'.repeat(SPEECH_LINE_LIMIT);
  assert.deepEqual(new CampaignContentSchema().validate(content, publishedWorld), []);
  speech['hired'] += 'a';
  assert.match(
    new CampaignContentSchema().validate(content, publishedWorld).join('\n'),
    /máximo 800 caracteres/,
  );
  speech['hired'] = '';
  speech['unknown'] = '';
  assert.match(
    new CampaignContentSchema().validate(content, publishedWorld).join('\n'),
    /lista de frases/,
  );
});
