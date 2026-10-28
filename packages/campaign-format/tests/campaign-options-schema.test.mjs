import test from 'node:test';
import assert from 'node:assert/strict';
import publishedContent from '../../../content/campaigns/granaderos/content.json' with { type: 'json' };
import publishedWorld from '../../../content/campaigns/granaderos/world.json' with { type: 'json' };
import { CampaignContentSchema } from '../content-schema.js';
import { SPEECH_EVENTS, SPEECH_LINE_LIMIT } from '../character-presentation-schema.js';

const errorsFor = (change) => {
  const content = structuredClone(publishedContent);
  change(content);
  return new CampaignContentSchema().validate(content, publishedWorld).join('\n');
};

test('optional campaign rule documents receive shared field and cross-reference admission', () => {
  const cases = [
    [
      (content) => {
        content.contractRules = { days: {} };
      },
      /Contratos/,
    ],
    [
      (content) => {
        content.careRules = { minimumSkill: 0 };
      },
      /Atención y descanso/,
    ],
    [
      (content) => {
        content.artillerySupply = { enabled: true };
      },
      /Munición de artillería/,
    ],
    [
      (content) => {
        content.foundry = {
          sector: 'missing',
          name: 'Foundry',
          armyName: 'Army',
          setupCost: 0,
          fundingCost: 0,
        };
      },
      /Fundición/,
    ],
    [
      (content) => {
        content.campaignRoles = { foundryEngineer: 'missing', marchCommander: null };
      },
      /personaje asignado no existe/,
    ],
    [
      (content) => {
        content.oppositionEquipment = { officer: 'missing', line: null, veteran: null };
      },
      /arma no existe/,
    ],
    [
      (content) => {
        content.ammunitionMarket = { defaults: {}, locations: {} };
      },
      /Proveedores de munición/,
    ],
    [
      (content) => {
        content.weapons[0].projectileEnergy = {
          model: 'future-model',
          massGrams: 'heavy',
          muzzleVelocityMps: 100,
        };
      },
      /perfil de energía/,
    ],
  ];
  for (const [change, expected] of cases) assert.match(errorsFor(change), expected);
});

test('speech schema preserves the existing file limit and supported event fields', () => {
  const content = structuredClone(publishedContent);
  const character = content.characters[0];
  character.speech = Object.fromEntries(SPEECH_EVENTS.map((event) => [event, '']));
  character.speech.hired = 'a'.repeat(SPEECH_LINE_LIMIT);
  assert.deepEqual(new CampaignContentSchema().validate(content, publishedWorld), []);
  character.speech.hired += 'a';
  assert.match(
    new CampaignContentSchema().validate(content, publishedWorld).join('\n'),
    /máximo 800 caracteres/,
  );
  character.speech.hired = '';
  character.speech.unknown = '';
  assert.match(
    new CampaignContentSchema().validate(content, publishedWorld).join('\n'),
    /lista de frases/,
  );
});
