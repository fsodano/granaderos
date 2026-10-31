import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

if (process.argv.length > 2) {
  throw Error('Usage: npm test (the repository suite always uses two workers).');
}
const inherited = (process.env.NODE_OPTIONS ?? '').replaceAll('_', '-');
if (/(?:^|[\s"'])--test-(?:name-pattern|skip-pattern|only|shard)(?=$|[\s="'])/.test(inherited)) {
  throw Error('Remove test-selection flags from NODE_OPTIONS to run the complete suite.');
}
if (process.env.NODE_TEST_CONTEXT !== undefined) {
  throw Error('Run the repository suite outside another Node test process.');
}
const root = fileURLToPath(new URL('../', import.meta.url));
const files = [];
const generated = new Set([
  'node_modules',
  '.output',
  'dist',
  'build',
  'coverage',
  '.next',
  '.vinext',
  'out',
]);
function collect(directory) {
  if (!existsSync(join(root, directory))) {
    return;
  }
  for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!generated.has(entry.name)) {
        collect(path);
      }
    } else if (/\.test\.[cm]?jsx?$/.test(entry.name)) {
      throw Error(`Automated tests must use TypeScript: ${path}`);
    } else if (/\.test\.tsx?$/.test(entry.name)) {
      files.push(path);
    }
  }
}
for (const directory of ['tests', 'packages', 'apps', 'tools']) {
  collect(directory);
}
files.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
if (!files.length) {
  throw Error('No test files found.');
}
console.log(`Repository suite: ${files.length} files, two workers.`);
const result = spawnSync(
  process.execPath,
  ['--import', './tools/register-test-loader.ts', '--test', '--test-concurrency=2', ...files],
  {
    cwd: root,
    stdio: 'inherit',
  },
);
if (result.error) {
  throw result.error;
}
process.exitCode = result.status ?? 1;
