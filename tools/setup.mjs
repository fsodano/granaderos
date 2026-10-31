import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const required = readFileSync(new URL('../.node-version', import.meta.url), 'utf8').trim();
if (process.versions.node !== required) {
  throw new Error(`Granaderos requires Node.js ${required}. Use the version in .node-version.`);
}
for (const directory of ['apps/web', 'apps/campaign-editor', 'tools/playgrounds/granadero-3d']) {
  const result = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['ci', '--prefix', directory],
    {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
await import('./install-hooks.mjs');
