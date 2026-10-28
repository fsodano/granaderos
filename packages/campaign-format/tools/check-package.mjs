import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
for (const name of readdirSync(root).filter((name) => name.endsWith('.js'))) {
  const file = resolve(root, name);
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/from\s*['"]([^'"]+)['"]/g)) {
    if (!match[1].startsWith('.') || !resolve(dirname(file), match[1]).startsWith(root)) {
      throw new Error(`campaign-format cannot import outside its package: ${name}`);
    }
  }
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Campaign format source and package boundary verified.');
