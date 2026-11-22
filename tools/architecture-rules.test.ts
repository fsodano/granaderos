import assert from 'node:assert/strict';
import test from 'node:test';
import {
  gameFileMayImport,
  gameImportRule,
  interfaceFileMayImport,
  interfaceImportRule,
} from './architecture-rules.ts';

const interfaceFile = 'apps/web/app/Recruitment.tsx';
const compositionFile = 'apps/web/lib/recruitment-catalogue.ts';

void test('the interface may not import a game layer', () => {
  for (const target of [
    'packages/game/domain/journeys/journey.ts',
    'packages/game/application/get-save-status/get-save-status.repository.ts',
    'packages/game/infrastructure/shared/domain-refusal-message.js',
  ]) {
    assert.equal(interfaceFileMayImport(interfaceFile, target), false, target);
  }
  assert.match(interfaceImportRule, /public entries and browser compositions/);
});

void test('the application may not import a retained compatibility module', () => {
  for (const file of [interfaceFile, compositionFile]) {
    for (const target of [
      'packages/game/campaign.js',
      'packages/game/tactical.js',
      'packages/game/save.ts',
    ]) {
      assert.equal(interfaceFileMayImport(file, target), false, `${file} -> ${target}`);
    }
  }
});

void test('the interface may import a public entry or a composition adapter', () => {
  for (const target of [
    'packages/game/public/journey-types.ts',
    'packages/game/public/refusal-api.ts',
    'packages/game/public/save-types.ts',
    'packages/game/public/game-runtime-api.ts',
    'apps/web/lib/talk-to-character.ts',
  ]) {
    assert.equal(interfaceFileMayImport(interfaceFile, target), true, target);
  }
});

void test('the composition may import a game layer', () => {
  assert.equal(
    interfaceFileMayImport(
      compositionFile,
      'packages/game/infrastructure/personnel/campaign-get-recruitment-candidates.repository.js',
    ),
    true,
  );
});

void test('files outside the interface may import a retained compatibility module', () => {
  assert.equal(
    interfaceFileMayImport('tools/playgrounds/roster.ts', 'packages/game/campaign.js'),
    true,
  );
});

void test('the game may not import the player application', () => {
  for (const file of [
    'packages/game/ja2-hud.ts',
    'packages/game/hud-types.ts',
    'packages/game/domain/journeys/journey.ts',
  ]) {
    for (const target of ['apps/web/lib/campaign-labels.ts', 'apps/web/app/Recruitment.tsx']) {
      assert.equal(gameFileMayImport(file, target), false, `${file} -> ${target}`);
    }
  }
  assert.match(gameImportRule, /independent of the player application/);
});

void test('the game may import another game module', () => {
  for (const target of [
    'packages/game/hud-types.ts',
    'packages/game/public/game-runtime-api.ts',
    'packages/game/domain/journeys/journey.ts',
  ]) {
    assert.equal(gameFileMayImport('packages/game/ja2-hud.ts', target), true, target);
  }
});

void test('the interface may import a game public entry', () => {
  assert.equal(gameFileMayImport(interfaceFile, 'packages/game/public/game-runtime-api.ts'), true);
});

void test('the interface may import its own modules', () => {
  assert.equal(gameFileMayImport(interfaceFile, compositionFile), true);
  assert.equal(gameFileMayImport(compositionFile, 'apps/web/lib/campaign-labels.ts'), true);
});
