import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.argv.length > 2) {
  throw new Error('Usage: npm run audit:dependencies');
}

const root = fileURLToPath(new URL('../', import.meta.url));
let status = 0;
for (const directory of ['apps/web', 'apps/campaign-editor', 'tools/playgrounds/granadero-3d']) {
  console.log(`\nAuditing ${directory}…`);
  const result = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['audit', '--prefix', directory, '--audit-level=info'],
    { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && status === 0) {
    status = result.status ?? 1;
  }
}
process.exitCode = status;
