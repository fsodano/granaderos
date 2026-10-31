import { assertCampaignContent } from '../web/lib/editor-documents.ts';
import { projectMap } from './project-fixtures.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCampaignProject } from '../infrastructure/create-project.js';
import { projectContent } from '../infrastructure/project-operations.js';
import { validateCampaignProject } from '../infrastructure/project-validation.js';
import { exportCampaignArchive, importCampaignArchive } from '../web/lib/campaign-studio-files.ts';
import {
  createCampaignSandbox,
  dispatchCampaignSandbox,
  encodeCampaignSandbox,
  decodeCampaignSandbox,
} from '../../../packages/game/public/campaign-playtest-api.ts';

await test('published archive retains documents and resource bytes and excludes editor metadata', async () => {
  const project = await createCampaignProject('archive-test', 'Archive');
  project.editor = { selectedPanel: 'world', buildingTemplates: [] };
  const imported = await importCampaignArchive(await exportCampaignArchive(project));
  for (const field of [
    'manifest',
    'content',
    'world',
    'maps',
    'presentation',
    'resources',
    'assets',
  ] as const) {
    assert.deepEqual(imported[field], project[field]);
  }
  assert.equal(imported.editor, undefined);
  assert.equal((await validateCampaignProject(imported)).valid, true);
  projectMap(project, 'camp').id = 'mismatched-map';
  await assert.rejects(exportCampaignArchive(project));
});

await test('public playtest API keeps progress separate and restores the active sector', async () => {
  const project = await createCampaignProject('playtest-isolation', 'Playtest');
  const before = structuredClone(project);
  const content = projectContent(project);
  assertCampaignContent(content);
  let playtest = createCampaignSandbox(content, 42);
  playtest = dispatchCampaignSandbox(playtest, {
    type: 'recruitCombatant',
    characterId: '2000',
    term: 'day',
  });
  assert.equal(playtest.lastError, null);
  assert.equal(playtest.campaign.resources.treasury, 940);
  playtest = dispatchCampaignSandbox(playtest, { type: 'enter' });
  assert.equal(playtest.lastError, null);
  assert.equal(playtest.battle?.mode, 'exploration');
  const restored = decodeCampaignSandbox(encodeCampaignSandbox(playtest), content);
  assert.equal(restored.battle?.units.filter((unit) => unit.side === 'player').length, 1);
  assert.equal(restored.campaign.resources.treasury, 940);
  assert.deepEqual(project, before);
  const changed = structuredClone(content);
  changed['name'] = 'Different definition';
  assert.throws(() => decodeCampaignSandbox(encodeCampaignSandbox(playtest), changed));
});

await test('package boundaries exclude editor code from runtime and keep format independent', () => {
  const output = execFileSync(
    process.execPath,
    [fileURLToPath(new URL('../tools/check-boundaries.mjs', import.meta.url))],
    { encoding: 'utf8' },
  );
  assert.match(output, /contain no editor implementation/);
});

await test('public composition stays outside the strict application layers', () => {
  const output = execFileSync(
    process.execPath,
    [fileURLToPath(new URL('../../../tools/check-architecture.mjs', import.meta.url))],
    { encoding: 'utf8' },
  );
  assert.match(output, /Architecture boundaries passed/);
});
