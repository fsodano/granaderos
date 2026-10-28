import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const editor = fileURLToPath(new URL('..', import.meta.url));
const repository = resolve(editor, '../..');
const sourceExtensions = new Set(['.js', '.ts', '.tsx', '.mjs']);
const publicGameApis = new Set([
  resolve(repository, 'packages/game/public/campaign-editor-api.js'),
  resolve(repository, 'packages/game/public/campaign-playtest-api.js'),
]);
const failures = [];

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', 'dist', 'tests', 'tools'].includes(entry.name)) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : sourceExtensions.has(extname(path)) ? [path] : [];
  });
}

function imports(file) {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)]
    .map((match) => match[1])
    .filter((path) => path.startsWith('.'))
    .map((path) => resolve(dirname(file), path));
}

for (const file of files(editor)) {
  for (const target of imports(file)) {
    if (
      target.startsWith(resolve(repository, 'packages/game') + '/') &&
      !publicGameApis.has(target)
    ) {
      failures.push(
        `${relative(repository, file)} imports game internals: ${relative(repository, target)}`,
      );
    }
    if (
      /^(domain|application)\//.test(relative(editor, file)) &&
      target.startsWith(resolve(editor, 'infrastructure') + '/')
    ) {
      failures.push(`${relative(repository, file)} imports infrastructure.`);
    }
  }
}

for (const file of files(resolve(repository, 'packages/campaign-format'))) {
  for (const target of imports(file)) {
    if (!target.startsWith(resolve(repository, 'packages/campaign-format') + '/')) {
      failures.push(`${relative(repository, file)} imports outside campaign-format.`);
    }
  }
}

const visited = new Set();
function checkGameClosure(file) {
  if (!existsSync(file) || visited.has(file)) return;
  visited.add(file);
  if (file.startsWith(editor + '/')) {
    failures.push(`Game runtime depends on editor: ${relative(repository, file)}`);
    return;
  }
  if (['.js', '.ts', '.mjs'].includes(extname(file)))
    for (const target of imports(file)) checkGameClosure(target);
}
for (const entry of ['campaign.js', 'tactical.js', 'world.js', 'save.js']) {
  const path = resolve(repository, 'packages/game', entry);
  if (!existsSync(path)) throw new Error(`Game runtime entry is missing: ${path}`);
  checkGameClosure(path);
}

if (failures.length) throw new Error(failures.join('\n'));
console.log(
  `Editor boundaries pass. ${visited.size} game dependencies contain no editor implementation.`,
);
