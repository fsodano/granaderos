import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const web = resolve(root, 'apps/web');
const sourceRoots = [
  'packages/game',
  'packages/campaign-format',
  'apps/web',
  'apps/campaign-editor',
  'content/campaigns',
  'tools',
  'tests',
];
const ignoredDirectories = new Set([
  'node_modules',
  '.next',
  '.vinext',
  'out',
  'build',
  'dist',
  'coverage',
  '.output',
]);
// Vinext regenerates this file during builds using its own formatting.
const generatedFiles = new Set([resolve(root, 'apps/web/next-env.d.ts')]);
const sourceExtension = /\.(?:[cm]?[jt]sx?|css)$/;
const sourceConfig = /^(?:package|tsconfig(?:\.[\w-]+)?)\.json$/;
function collect(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name) ? [] : collect(path);
    }
    return entry.isFile() &&
      !generatedFiles.has(path) &&
      (sourceExtension.test(entry.name) || sourceConfig.test(entry.name))
      ? [path]
      : [];
  });
}
const mode = process.argv[2];
const lint = mode === 'lint' || mode === 'lint:audit';

if (!lint && mode !== 'format' && mode !== 'format:check') {
  throw new Error('Choose lint, lint:audit, format, or format:check.');
}

const executable = resolve(web, `node_modules/${lint ? 'oxlint/bin/oxlint' : 'oxfmt/bin/oxfmt'}`);
const paths = sourceRoots.flatMap((path) => collect(resolve(root, path)));
if (!lint) {
  paths.push(
    ...[
      'package.json',
      '.oxlintrc.json',
      '.oxfmtrc.json',
      '.dependency-cruiser.json',
      'tsconfig.strict.json',
      'tsconfig.json',
    ].map((path) => resolve(root, path)),
  );
}
const options = lint
  ? ['--config', resolve(root, '.oxlintrc.json'), '--deny-warnings']
  : [
      '--config',
      resolve(root, '.oxfmtrc.json'),
      '--disable-nested-config',
      ...(mode === 'format:check' ? ['--check'] : []),
    ];
const result = spawnSync(
  process.execPath,
  [executable, ...options, ...paths, ...process.argv.slice(3)],
  { cwd: lint ? web : root, stdio: 'inherit' },
);

if (result.error) {
  throw result.error;
}
process.exitCode = result.status ?? 1;
