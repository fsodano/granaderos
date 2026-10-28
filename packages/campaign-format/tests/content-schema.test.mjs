import { definitionWorld, definitionMaps } from './definition-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CampaignContentSchema, ATTRIBUTE_FIELDS } from '../content-schema.js';
import { CampaignDefinition } from '../campaign-definition.js';

const manifest = {
  format: 'granaderos-campaign',
  version: 1,
  id: 'reference-test',
  name: 'Reference test',
  revision: '1',
  scenario: 'generic-v1',
  content: 'content.json',
  world: 'world.json',
  maps: 'maps/index.json',
  presentation: 'presentation.json',
  assets: 'assets.json',
};
function documents() {
  const character = (id) => ({
    id,
    name: id,
    nickname: id,
    role: '',
    biography: '',
    portrait: 'data:image/png;base64,AA==',
    monthlyPay: 0,
    weapon: null,
    attributes: Object.fromEntries(
      ATTRIBUTE_FIELDS.map((field) => [field, field === 'maxHp' ? 60 : 40]),
    ),
  });
  return {
    content: {
      format: 'granaderos-content',
      version: 1,
      id: manifest.id,
      name: manifest.name,
      characters: [character('guide'), character('resident')],
      weapons: [{ id: 'carbine', template: 1801, name: 'Carbine', damage: 20 }],
      placements: [],
      quests: [
        {
          id: 'report',
          title: 'Report',
          description: 'Speak to the resident',
          requiredAlive: ['resident'],
        },
      ],
    },
    world: definitionWorld(),
    maps: definitionMaps(),
    presentation: { version: 1, title: 'Format test' },
    assets: { version: 1, assets: [] },
  };
}
function encounter() {
  return {
    recruitable: false,
    greeting: '',
    requiredLeadership: 0,
    requiredLiberated: 0,
    requiredSector: null,
    dialogue: dialogue(),
  };
}
function dialogue() {
  return {
    entry: 'first',
    nodes: [
      {
        id: 'first',
        title: 'First',
        text: 'A message',
        choices: [
          {
            id: 'reply',
            label: 'Reply',
            next: 'first',
            conditions: [
              { type: 'character', character: 'resident', state: 'alive' },
              { type: 'quest', quest: 'report', status: 'not-started' },
              { type: 'sector', sector: 'retiro', owner: 'patriot' },
            ],
            effects: [
              { type: 'quest', quest: 'report', status: 'active' },
              { type: 'movement', character: 'resident', destination: 'speaker' },
            ],
          },
        ],
      },
    ],
  };
}

test('the shared schema admits file references without importing runtime or issuing gameplay state', () => {
  const source = documents();
  source.content.characters[0].weapon = 'carbine';
  source.content.characters[0].encounter = encounter();
  const before = structuredClone(source);
  assert.deepEqual(new CampaignContentSchema().validate(source.content, source.world), []);
  const definition = new CampaignDefinition(manifest, source);
  assert.equal(definition.documents.content.characters[0].weapon, 'carbine');
  assert.deepEqual(source, before);
  assert.equal(Object.hasOwn(definition.documents.content, 'operativeState'), false);
});

test('campaign admission refuses missing catalogues, duplicate identities and dangling equipment references', () => {
  const missing = documents();
  delete missing.content.characters;
  assert.throws(() => new CampaignDefinition(manifest, missing), /characters/);
  const duplicate = documents();
  duplicate.content.characters[1].id = 'guide';
  assert.throws(
    () => new CampaignDefinition(manifest, duplicate),
    /identificador inválido o repetido/,
  );
  const dangling = documents();
  dangling.content.characters[0].weapon = 'absent-weapon';
  assert.throws(
    () => new CampaignDefinition(manifest, dangling),
    /guide.weapon: el arma no existe/,
  );
  const malformed = documents();
  malformed.content.weapons[0].alternativeLoads = [
    { family: 'ammo', damage: 'twenty', range: 3, pattern: 'single' },
  ];
  assert.throws(() => new CampaignDefinition(manifest, malformed), /cargas alternativas/);
});

test('quest and dialogue definitions own character, quest, node and sector reference validation', () => {
  const cases = [
    [(source) => (source.content.quests[0].requiredAlive = ['missing']), /personajes existentes/],
    [
      (source) =>
        (source.content.characters[0].encounter.dialogue.nodes[0].choices[0].next = 'missing'),
      /destino del diálogo/,
    ],
    [
      (source) =>
        (source.content.characters[0].encounter.dialogue.nodes[0].choices[0].conditions[0].character =
          'missing'),
      /personaje y un estado/,
    ],
    [
      (source) =>
        (source.content.characters[0].encounter.dialogue.nodes[0].choices[0].effects[0].quest =
          'missing'),
      /encargo y un estado/,
    ],
    [
      (source) =>
        (source.content.characters[0].encounter.dialogue.nodes[0].choices[0].conditions[2].sector =
          'missing'),
      /localidad y un control/,
    ],
  ];
  for (const [change, message] of cases) {
    const source = documents();
    source.content.characters[0].encounter = encounter();
    change(source);
    assert.throws(() => new CampaignDefinition(manifest, source), message);
  }
});

test('placement references reject duplicate cell aliases and dependency cycles', () => {
  const source = documents();
  const placement = (id, character, afterDeath) => ({
    id,
    character,
    mode: 'daily',
    sectors: ['retiro'],
    moveChance: 50,
    afterDeath,
    delayMin: 0,
    delayMax: 10,
  });
  source.content.placements = [
    placement('guide-placement', 'guide', 'resident'),
    placement('resident-placement', 'resident', 'guide'),
  ];
  assert.throws(
    () => new CampaignDefinition(manifest, source),
    /ciclo en las condiciones de muerte/,
  );
  source.content.placements[0].afterDeath = null;
  source.content.placements[1].sectors = ['retiro', 'cell-27-28'];
  assert.throws(() => new CampaignDefinition(manifest, source), /seleccioná sectores válidos/);
});

test('service relationship references and starting condition are admitted by the shared schema', () => {
  const source = documents();
  source.content.characters[0].serviceRefusals = [
    { character: 'missing', reason: 'Not available' },
  ];
  assert.throws(() => new CampaignDefinition(manifest, source), /otro personaje existente/);
  delete source.content.characters[0].serviceRefusals;
  source.content.characters[0].startingCondition = {
    hp: 60,
    energy: 100,
    fatigue: 0,
    bleeding: 1,
    bandaged: 0,
  };
  assert.throws(() => new CampaignDefinition(manifest, source), /sangrado necesita una herida/);
});
