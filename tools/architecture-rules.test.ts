import assert from 'node:assert/strict';
import test from 'node:test';
import { interfaceFileMayImport, interfaceImportRule } from './architecture-rules.ts';

const interfaceFile = 'apps/web/app/Recruitment.tsx';

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

void test('the interface may import a public entry or a composition adapter', () => {
  for (const target of [
    'packages/game/public/journey-types.ts',
    'packages/game/public/refusal-api.ts',
    'packages/game/public/save-types.ts',
    'apps/web/lib/talk-to-character.ts',
  ]) {
    assert.equal(interfaceFileMayImport(interfaceFile, target), true, target);
  }
});

void test('the interface may import a retained compatibility module', () => {
  assert.equal(interfaceFileMayImport(interfaceFile, 'packages/game/campaign.js'), true);
});

void test('files outside the interface may import a game layer', () => {
  assert.equal(
    interfaceFileMayImport(
      'apps/web/lib/recruitment-catalogue.ts',
      'packages/game/infrastructure/personnel/campaign-get-recruitment-candidates.repository.js',
    ),
    true,
  );
});
