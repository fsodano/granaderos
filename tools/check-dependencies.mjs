import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const executable = fileURLToPath(
  new URL(
    '../apps/web/node_modules/dependency-cruiser/bin/dependency-cruiser.mjs',
    import.meta.url,
  ),
);
const result = spawnSync(
  process.execPath,
  [
    executable,
    '--config',
    '.dependency-cruiser.json',
    '--output-type',
    'err-long',
    'packages/game',
    'packages/campaign-format',
    'apps/web',
    'apps/campaign-editor',
    'content/campaigns',
    'tools',
    'tests',
  ],
  {
    cwd: root,
    stdio: 'inherit',
  },
);
if (result.error) {
  throw result.error;
}
process.exitCode = result.status ?? 1;
