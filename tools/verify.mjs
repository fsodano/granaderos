import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runStages, stagesFor } from './verification-plan.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const profile = process.argv[2] ?? 'full';
if (process.argv.length > 3) {
  throw new Error('Usage: node tools/verify.mjs [commit|push|full]');
}

process.exitCode = runStages(stagesFor(profile), (stage) => {
  console.log(`\nChecking ${stage}…`);
  const started = performance.now();
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', stage], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) {
    throw result.error;
  }
  const status = result.status ?? 1;
  console.log(
    `${stage}: ${status === 0 ? 'passed' : 'failed'} (${((performance.now() - started) / 1000).toFixed(1)}s)`,
  );
  return status;
});
