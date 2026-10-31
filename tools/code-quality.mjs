import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const web = resolve(root, 'apps/web');
const architecture = [
  'packages/game/domain',
  'packages/game/application',
  'packages/game/infrastructure',
  'packages/game/public',
  'apps/campaign-editor/domain',
  'apps/campaign-editor/application',
  'apps/campaign-editor/infrastructure',
  'apps/campaign-editor/public',
  'packages/campaign-format',
];
const browserBoundaries = [
  'apps/web/lib/battle-worker-transport.ts',
  'apps/web/lib/battle-executor.ts',
  'apps/web/lib/battle-worker.ts',
  'apps/web/lib/battle-preview.ts',
  'apps/web/lib/latest-preview.ts',
  'apps/web/lib/useBattlePreview.ts',
  'apps/web/lib/useGroupMovePreview.ts',
];
const checkedSource = [...architecture, ...browserBoundaries, 'tools/code-quality.mjs'];
const auditedSource = [
  'packages/game',
  'packages/campaign-format',
  'apps/web',
  'apps/campaign-editor',
];
const mode = process.argv[2];
const lint = mode === 'lint' || mode === 'lint:audit';

if (!lint && mode !== 'format' && mode !== 'format:check') {
  throw new Error('Choose lint, lint:audit, format, or format:check.');
}

const executable = resolve(web, `node_modules/${lint ? 'oxlint/bin/oxlint' : 'oxfmt/bin/oxfmt'}`);
const paths = mode === 'lint:audit' ? auditedSource : checkedSource;
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
  [executable, ...options, ...paths.map((path) => resolve(root, path)), ...process.argv.slice(3)],
  { cwd: lint ? web : root, stdio: 'inherit' },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
