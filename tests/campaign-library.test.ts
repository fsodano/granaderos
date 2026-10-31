import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadCampaignRegistry,
  loadInstalledCampaign,
  verifyCampaignResources,
} from '../apps/web/lib/campaign-library.ts';
import {
  campaignDocuments,
  campaignFetch,
  campaignResponse,
  stockPresentation,
} from './campaign-library-fixture.ts';
import { present } from './assert-present.ts';

void test('installed campaign admission reads published JSON and verifies its resource bytes', async () => {
  const entries = await loadCampaignRegistry({ reader: campaignFetch });
  const entry = present(entries.find((candidate) => candidate.id === 'granaderos'));
  const loaded = await loadInstalledCampaign(entry, { reader: campaignFetch });
  assert.equal(loaded.manifest.id, entry.id);
  assert.equal(loaded.content.campaignOrigin?.revision, entry.revision);
  assert.deepEqual(loaded.presentation, stockPresentation);
  assert.ok(loaded.content.characters.length > 0);
  assert.ok(present(loaded.content.assets).assets.length > 0);
});

void test('campaign JSON admission rejects malformed, non-object, and non-finite documents', async () => {
  for (const text of ['{', '[]', 'null', '{"version":1e400}']) {
    await assert.rejects(
      loadCampaignRegistry({ reader: () => Promise.resolve(new Response(text)) }),
    );
  }
  await assert.rejects(
    loadCampaignRegistry({ reader: () => Promise.resolve(new Response('{}')) }),
    /índice|campañas/i,
  );
});

void test('campaign loading reports missing documents and refuses mismatched identities', async () => {
  await assert.rejects(
    loadCampaignRegistry({
      reader: () => Promise.resolve(new Response('', { status: 404 })),
    }),
    /404/,
  );
  const entry = present((await loadCampaignRegistry({ reader: campaignFetch }))[0]);
  await assert.rejects(
    loadInstalledCampaign(
      { ...entry, revision: `${entry.revision}-other` },
      { reader: campaignFetch },
    ),
    /índice y la campaña no coinciden/,
  );
});

void test('resource validation rejects changed bytes, retries failures, and caches admitted bytes', async () => {
  const entry = present((await loadCampaignRegistry({ reader: campaignFetch }))[0]);
  const loaded = await loadInstalledCampaign(entry, { reader: campaignFetch });
  const asset = present(present(loaded.content.assets).assets[0]);
  const overrides = new Map([[`/campaigns/${entry.id}/${asset.path}`, Uint8Array.of(0)]]);
  let reads = 0;
  const reader = (path: string) => {
    reads += 1;
    return Promise.resolve(campaignResponse(campaignDocuments, path, overrides));
  };
  await assert.rejects(verifyCampaignResources(loaded.content, { reader }), /recurso cambió/);
  overrides.clear();
  await verifyCampaignResources(loaded.content, { reader });
  const admittedReads = reads;
  await verifyCampaignResources(loaded.content, { reader });
  assert.equal(reads, admittedReads);
  await verifyCampaignResources(loaded.content, { reader, refresh: true });
  assert.ok(reads > admittedReads);
});
