import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const executable = join(
  root,
  'apps/web/node_modules/dependency-cruiser/bin/dependency-cruiser.mjs',
);

function checkBoundary(files: Readonly<Record<string, string>>) {
  const directory = mkdtempSync(join(tmpdir(), 'granaderos-boundaries-'));
  try {
    for (const [path, source] of Object.entries(files)) {
      const target = join(directory, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, source);
    }
    const result = spawnSync(
      process.execPath,
      [
        executable,
        '--config',
        join(root, '.dependency-cruiser.json'),
        '--ts-config',
        join(root, 'tsconfig.json'),
        '--output-type',
        'err-long',
        '.',
      ],
      {
        cwd: directory,
        encoding: 'utf8',
      },
    );
    if (result.error) {
      throw result.error;
    }
    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

void test('Dependency Cruiser allows inward domain and application dependencies', () => {
  const result = checkBoundary({
    'packages/game/domain/value.js': 'export const value = 1;',
    'packages/game/application/query.js': "export { value } from '../domain/value.js';",
    'packages/campaign-format/contract.js': 'export const version = 1;',
    'apps/campaign-editor/domain/model.js':
      "export { version } from '../../../packages/campaign-format/contract.js';",
  });
  assert.equal(result.status, 0, result.output);
});

void test('Dependency Cruiser rejects outward layers and private editor integrations', () => {
  const result = checkBoundary({
    'packages/game/domain/value.js': "export { value } from '../infrastructure/storage.js';",
    'packages/game/application/query.js': "export { value } from '../infrastructure/storage.js';",
    'packages/game/infrastructure/storage.js': 'export const value = 1;',
    'apps/campaign-editor/web/view.js':
      "export { value } from '../../../packages/game/infrastructure/storage.js';",
  });
  assert.notEqual(result.status, 0, result.output);
  for (const rule of [
    'game-domain-is-independent',
    'game-application-uses-domain-and-ports',
    'editor-uses-game-public-entries',
  ]) {
    assert.ok(result.output.includes(rule), result.output);
  }
});
