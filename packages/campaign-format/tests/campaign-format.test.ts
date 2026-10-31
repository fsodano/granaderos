import { present } from '../../../tests/assert-present.ts';
import { definitionWorld, definitionMaps } from './definition-fixtures.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CampaignDefinition } from '../campaign-definition.ts';
import { validateCampaignManifest } from '../campaign-manifest.js';
import { validateCampaignData } from '../campaign-data-validation.ts';

const manifest = {
  format: 'granaderos-campaign',
  version: 1,
  id: 'format-test',
  name: 'Format test',
  revision: '1',
  scenario: 'generic-v1',
  content: 'content.json',
  world: 'world.json',
  maps: 'maps/index.json',
  presentation: 'presentation.json',
  assets: 'assets.json',
};
const documents = () => ({
  content: {
    id: manifest.id,
    format: 'granaderos-content',
    version: 1,
    name: manifest.name,
    characters: [],
    weapons: [],
    placements: [],
  },
  world: definitionWorld(),
  maps: definitionMaps(),
  presentation: { version: 1, title: 'Format test' },
  assets: { version: 1, assets: [] },
});

void test('published definitions own immutable documents and stable identity', () => {
  const source = documents();
  const definition = new CampaignDefinition(manifest, source);
  present(source.world.sectors[0]).id = 'changed';
  assert.equal(present(definition.documents.world.sectors[0]).id, 'buenos_aires');
  assert.equal(Reflect.set(present(definition.documents.world.sectors[0]), 'id', 'changed'), false);
  assert.equal(present(definition.documents.world.sectors[0]).id, 'buenos_aires');
  assert.equal(
    definition.identity.hash,
    new CampaignDefinition(manifest, documents()).identity.hash,
  );
});

void test('campaign file references cannot escape the package', () => {
  assert.throws(() => validateCampaignManifest({ ...manifest, content: '../content.json' }));
  assert.throws(() => new CampaignDefinition(manifest, { ...documents(), maps: {} }));
  assert.throws(
    () => new CampaignDefinition(manifest, { ...documents(), content: { id: 'another-campaign' } }),
  );
});

void test('format admission rejects cycles and prototype keys', () => {
  const cyclic: { child?: object } = {};
  cyclic.child = cyclic;
  assert.ok(validateCampaignData(cyclic).length);
  assert.ok(validateCampaignData(JSON.parse('{"__proto__":{}}')).length);
});
