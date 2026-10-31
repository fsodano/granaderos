import assert from 'node:assert/strict';
import { present } from './assert-present.ts';
import { readFile, readdir } from 'node:fs/promises';
import { blankMap, validateMap } from '../packages/game/map-schema.js';
import { validateContentPackage } from '../packages/game/content-package.js';
import { validateCampaignAssets } from '../packages/campaign-format/campaign-assets.js';
import {
  validateCampaignManifest,
  validateCampaignRegistry,
} from '../packages/campaign-format/campaign-manifest.js';
import { discoverCampaigns } from '../tools/campaign-export.mjs';
import type {
  CampaignAssets,
  CampaignContent,
  CampaignManifest,
  PhysicalMap,
} from '../packages/campaign-format/types.ts';
import type { CampaignEntry } from '../apps/web/lib/campaign-library.ts';

type Registry = { format: string; version: number; campaigns: CampaignEntry[] };
export type CampaignFixtureDocuments = Map<string, unknown>;
function assertRegistry(value: unknown): asserts value is Registry {
  validateCampaignRegistry(value);
}
function assertAssets(value: unknown): asserts value is CampaignAssets {
  assert.deepEqual(validateCampaignAssets(value), []);
}
function assertMap(value: unknown): asserts value is PhysicalMap {
  assert.equal(validateMap(value).valid, true);
}
function assertContent(value: unknown): asserts value is CampaignContent {
  assert.deepEqual(validateContentPackage(value), []);
}
export function fixtureManifest(value: unknown): CampaignManifest {
  assertManifest(value);
  return value;
}
function assertManifest(value: unknown): asserts value is CampaignManifest {
  validateCampaignManifest(value);
}
export function fixtureMapIndex(value: unknown): { maps: { id: string; path: string }[] } {
  assert.ok(
    typeof value === 'object' && value !== null && 'maps' in value && Array.isArray(value.maps),
  );
  const maps: { id: string; path: string }[] = [];
  for (const entry of value.maps) {
    const item: unknown = entry;
    assert.ok(
      typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        typeof item.id === 'string' &&
        'path' in item &&
        typeof item.path === 'string',
    );
    maps.push({ id: item.id, path: item.path });
  }
  return { maps };
}
const root = new URL('..', import.meta.url),
  contentRoot = new URL('content/', root);
const registry: unknown = await discoverCampaigns(root.pathname);
assertRegistry(registry);
const documents: CampaignFixtureDocuments = new Map([['/campaigns/index.json', registry]]);
async function collect(directory: URL): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) {
      await collect(path);
    } else if (entry.name.endsWith('.json')) {
      const value: unknown = JSON.parse(await readFile(path, 'utf8'));
      documents.set(path.pathname.slice(contentRoot.pathname.length - 1), value);
    }
  }
}
for (const entry of registry.campaigns) {
  await collect(new URL(`campaigns/${entry.id}/`, contentRoot));
}
const resourceBytes = new Map<string, Buffer>();
for (const entry of registry.campaigns) {
  const catalog = documents.get(`/campaigns/${entry.id}/assets.json`);
  assertAssets(catalog);
  for (const asset of catalog.assets) {
    resourceBytes.set(
      `/campaigns/${entry.id}/${asset.path}`,
      await readFile(new URL(`campaigns/${entry.id}/${asset.path}`, contentRoot)),
    );
  }
}
export function campaignResponse(
  docs: CampaignFixtureDocuments,
  path: string,
  overrides: ReadonlyMap<string, Uint8Array> = new Map(),
) {
  const key = path.replace(/^https?:\/\/[^/]+/, '').replace(/^\/granaderos(?=\/campaigns\/)/, ''),
    value = docs.get(key),
    bytes =
      overrides.get(key) ??
      resourceBytes.get(key) ??
      resourceBytes.get(key.replace(/^\/campaigns\/[^/]+\//, '/campaigns/granaderos/')),
    ok = value !== undefined || bytes !== undefined;
  const body = bytes ? Uint8Array.from(bytes) : (JSON.stringify(value) ?? '');
  return new Response(body, { status: ok ? 200 : 404 });
}
export function campaignFetch(path: string) {
  return Promise.resolve(campaignResponse(documents, path));
}
export const stockPresentation = documents.get('/campaigns/granaderos/presentation.json');
export const campaignDocuments = documents;
export function alternateCampaignDocuments() {
  const docs: CampaignFixtureDocuments = new Map(
      [...documents].map(([path, value]) => [path, structuredClone(value)]),
    ),
    entry = {
      id: 'another',
      name: 'Otra campaña',
      revision: '1',
      manifest: 'another/manifest.json',
    };
  for (const [path, value] of documents) {
    if (path.startsWith('/campaigns/granaderos/')) {
      const copied: unknown = JSON.parse(
        JSON.stringify(value).replaceAll('/campaigns/granaderos/', '/campaigns/another/'),
      );
      docs.set(path.replace('/granaderos/', '/another/'), copied);
    }
  }
  for (const [path, map] of docs) {
    if (/^\/campaigns\/another\/maps\/(?!index\.json$)[^/]+\.json$/.test(path)) {
      assertMap(map);
      const next = blankMap({ id: map.id, title: map.metadata.title });
      next.spawns = [
        { id: 'player-entry', side: 'player', x: 3, y: 8 },
        { id: 'enemy-entry', side: 'enemy', x: 16, y: 8 },
      ];
      docs.set(path, next);
    }
  }
  const manifest = fixtureManifest(docs.get('/campaigns/another/manifest.json'));
  Object.assign(manifest, {
    id: entry.id,
    name: entry.name,
    revision: entry.revision,
    scenario: 'generic-v1',
  });
  const content = docs.get('/campaigns/another/content.json');
  assertContent(content);
  content.id = entry.id;
  content.name = entry.name;
  content.characters = [
    present(content.characters.find((character) => character.id === 'person-100')),
  ];
  content.placements = [];
  content.errands = [];
  content.quests = [];
  content.includeOriginalResidents = false;
  content.campaignRoles = { foundryEngineer: null, marchCommander: null };
  docs.set('/campaigns/another/presentation.json', {
    version: 1,
    title: entry.name,
    caption: 'Una campaña diferente.',
  });
  const catalog = docs.get('/campaigns/index.json');
  assertRegistry(catalog);
  catalog.campaigns.push(entry);
  return { docs, entry, reader: (path: string) => Promise.resolve(campaignResponse(docs, path)) };
}
