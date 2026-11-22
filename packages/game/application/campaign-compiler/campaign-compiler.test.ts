import assert from 'node:assert/strict';
import test from 'node:test';
import type { CampaignAssets, PhysicalMap } from '../../../campaign-format/types.ts';
import { blankMap } from '../../map-schema.js';
import { createCampaignCompiler } from '../../public/campaign-compiler-api.ts';
import {
  alternateCampaignDocuments,
  campaignDocuments,
  fixtureManifest,
  fixtureMapIndex,
} from '../../../../tests/campaign-library-fixture.ts';
import { present } from '../../../../tests/assert-present.ts';

type FixtureDocuments = Map<string, unknown>;

function cloneDocuments(documents: FixtureDocuments): FixtureDocuments {
  return new Map([...documents].map(([path, value]) => [path, structuredClone(value)]));
}

function packageFor(documents: FixtureDocuments, id: string) {
  const root = `/campaigns/${id}/`;
  const manifest = fixtureManifest(present(documents.get(`${root}manifest.json`)));
  const index = fixtureMapIndex(present(documents.get(root + manifest.maps)));
  const mapRoot = root + manifest.maps.slice(0, manifest.maps.lastIndexOf('/') + 1);
  return {
    manifest,
    documents: {
      content: present(documents.get(root + manifest.content)),
      world: present(documents.get(root + manifest.world)),
      maps: Object.fromEntries(
        index.maps.map((map) => [map.id, present(documents.get(mapRoot + map.path))]),
      ),
      presentation: present(documents.get(root + manifest.presentation)),
      assets: present(documents.get(root + manifest.assets)),
    },
  };
}

function compile(documents: FixtureDocuments, id: string) {
  return createCampaignCompiler().execute(packageFor(documents, id));
}

function mapPath(documents: FixtureDocuments, id: string): string {
  const path = [...documents.keys()].find((key) =>
    new RegExp(`^/campaigns/${id}/maps/(?!index\\.json$)[^/]+\\.json$`).test(key),
  );
  return present(path, `Expected a map document for ${id}.`);
}

function isPhysicalMap(value: unknown): value is PhysicalMap {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'metadata' in value &&
    'spawns' in value &&
    'buildings' in value
  );
}

function isCampaignAssets(value: unknown): value is CampaignAssets {
  return typeof value === 'object' && value !== null && 'version' in value && 'assets' in value;
}

void test('the campaign compiler admits a valid campaign package', () => {
  const content = compile(campaignDocuments, 'granaderos');
  assert.equal(content.id, 'granaderos');
  assert.ok(content.world);
  assert.ok(content.presentation);
  assert.ok(content.assets);
  assert.equal(content.scenario, 'granaderos-historical-v1');
});

void test('the campaign compiler refuses a map that is not 20 by 16', () => {
  const documents = cloneDocuments(campaignDocuments);
  const path = mapPath(documents, 'granaderos');
  const original = documents.get(path);
  assert.ok(isPhysicalMap(original));
  documents.set(
    path,
    blankMap({ id: original.id, title: original.metadata.title, width: 19, height: 16 }),
  );
  assert.throws(
    () => compile(documents, 'granaderos'),
    new RegExp(`Mapa ${original.id}: se necesitan 20 columnas y 16 filas\\.`),
  );
});

void test('the campaign compiler refuses a generic campaign without an adversary spawn', () => {
  const documents = alternateCampaignDocuments().docs;
  for (const [path, value] of documents) {
    if (/^\/campaigns\/another\/maps\/(?!index\.json$)[^/]+\.json$/.test(path)) {
      assert.ok(isPhysicalMap(value));
      value.spawns = value.spawns.filter((spawn) => spawn.side !== 'enemy');
    }
  }
  assert.throws(() => compile(documents, 'another'), /falta una aparición adversaria\./);
});

void test('the campaign compiler refuses assets that do not match the catalog', () => {
  const documents = cloneDocuments(campaignDocuments);
  const assets = documents.get('/campaigns/granaderos/assets.json');
  assert.ok(isCampaignAssets(assets));
  assets.version = 2;
  assert.throws(
    () => compile(documents, 'granaderos'),
    /Recursos de campaña: catálogo o versión inválida\./,
  );
});
