import { present } from '../../../tests/assert-present.ts';
import type {
  CampaignContent,
  CharacterDefinition,
  CharacterEncounter,
  Dialogue,
  PlacementDefinition,
} from '../types.ts';
import { definitionWorld, definitionMaps } from './definition-fixtures.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CampaignContentSchema } from '../content-schema.js';
import { CampaignDefinition } from '../campaign-definition.ts';

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
function documents(): {
  content: CampaignContent;
  world: ReturnType<typeof definitionWorld>;
  maps: ReturnType<typeof definitionMaps>;
  presentation: { version: number; title: string };
  assets: { version: number; assets: never[] };
} {
  const character = (id: string): CharacterDefinition => ({
    id,
    name: id,
    nickname: id,
    role: '',
    biography: '',
    portrait: 'data:image/png;base64,AA==',
    monthlyPay: 0,
    weapon: null,
    attributes: {
      maxHp: 60,
      agility: 40,
      dexterity: 40,
      strength: 40,
      leadership: 40,
      wisdom: 40,
      marksmanship: 40,
      mechanical: 40,
      explosives: 40,
      medical: 40,
    },
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
    } satisfies CampaignContent,
    world: definitionWorld(),
    maps: definitionMaps(),
    presentation: { version: 1, title: 'Format test' },
    assets: { version: 1, assets: [] },
  };
}
function encounter(): CharacterEncounter {
  return {
    recruitable: false,
    greeting: '',
    requiredLeadership: 0,
    requiredLiberated: 0,
    requiredSector: null,
    dialogue: dialogue(),
  };
}
function dialogue(): Dialogue {
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

void test('the shared schema admits file references without importing runtime or issuing gameplay state', () => {
  const source = documents();
  present(source.content.characters[0]).weapon = 'carbine';
  present(source.content.characters[0]).encounter = encounter();
  const before = structuredClone(source);
  assert.deepEqual(new CampaignContentSchema().validate(source.content, source.world), []);
  const definition = new CampaignDefinition(manifest, source);
  assert.equal(present(definition.documents.content.characters[0]).weapon, 'carbine');
  assert.deepEqual(source, before);
  assert.equal(Object.hasOwn(definition.documents.content, 'operativeState'), false);
});

void test('campaign admission refuses missing catalogues, duplicate identities and dangling equipment references', () => {
  const missing = documents();
  Reflect.deleteProperty(missing.content, 'characters');
  assert.throws(() => new CampaignDefinition(manifest, missing), /characters/);
  const duplicate = documents();
  present(duplicate.content.characters[1]).id = 'guide';
  assert.throws(
    () => new CampaignDefinition(manifest, duplicate),
    /identificador inválido o repetido/,
  );
  const dangling = documents();
  present(dangling.content.characters[0]).weapon = 'absent-weapon';
  assert.throws(
    () => new CampaignDefinition(manifest, dangling),
    /guide.weapon: el arma no existe/,
  );
  const malformed = documents();
  Reflect.set(present(malformed.content.weapons[0]), 'alternativeLoads', [
    { family: 'ammo', damage: 'twenty', range: 3, pattern: 'single' },
  ]);
  assert.throws(() => new CampaignDefinition(manifest, malformed), /cargas alternativas/);
});

void test('quest and dialogue definitions own character, quest, node and sector reference validation', () => {
  const cases: readonly [(source: ReturnType<typeof documents>) => void, RegExp][] = [
    [
      (source) => (present(source.content.quests?.[0]).requiredAlive = ['missing']),
      /personajes existentes/,
    ],
    [(source) => (firstChoice(source).next = 'missing'), /destino del diálogo/],
    [
      (source) => Reflect.set(present(firstChoice(source).conditions?.[0]), 'character', 'missing'),
      /personaje y un estado/,
    ],
    [
      (source) => Reflect.set(present(firstChoice(source).effects?.[0]), 'quest', 'missing'),
      /encargo y un estado/,
    ],
    [
      (source) => Reflect.set(present(firstChoice(source).conditions?.[2]), 'sector', 'missing'),
      /localidad y un control/,
    ],
  ];
  for (const [change, message] of cases) {
    const source = documents();
    present(source.content.characters[0]).encounter = encounter();
    change(source);
    assert.throws(() => new CampaignDefinition(manifest, source), message);
  }
});

void test('placement references reject duplicate cell aliases and dependency cycles', () => {
  const source = documents();
  const placement = (
    id: string,
    character: string,
    afterDeath: string | null,
  ): PlacementDefinition => ({
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
  present(source.content.placements[0]).afterDeath = null;
  present(source.content.placements[1]).sectors = ['retiro', 'cell-27-28'];
  assert.throws(() => new CampaignDefinition(manifest, source), /seleccioná sectores válidos/);
});

void test('service relationship references and starting condition are admitted by the shared schema', () => {
  const source = documents();
  present(source.content.characters[0]).serviceRefusals = [
    { character: 'missing', reason: 'Not available' },
  ];
  assert.throws(() => new CampaignDefinition(manifest, source), /otro personaje existente/);
  delete present(source.content.characters[0]).serviceRefusals;
  present(source.content.characters[0]).startingCondition = {
    hp: 60,
    energy: 100,
    fatigue: 0,
    bleeding: 1,
    bandaged: 0,
  };
  assert.throws(() => new CampaignDefinition(manifest, source), /sangrado necesita una herida/);
});

function firstChoice(source: ReturnType<typeof documents>) {
  return present(
    present(present(present(source.content.characters[0]).encounter).dialogue).nodes[0]?.choices[0],
  );
}
