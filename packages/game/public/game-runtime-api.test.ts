import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import * as campaignEditorEntry from './campaign-editor-api.ts';
import * as gameRuntimeEntry from './game-runtime-api.ts';

interface ImportedSymbol {
  readonly name: string;
  readonly typeOnly: boolean;
}

interface ApplicationImport {
  readonly file: string;
  readonly target: string;
  readonly symbols: readonly ImportedSymbol[];
}

interface EntryExport {
  readonly name: string;
  readonly typeOnly: boolean;
}

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const repositoryRoot = resolve(packageRoot, '..', '..');
const entryFile = resolve(packageRoot, 'public', 'game-runtime-api.ts');
const applicationDirectories = ['apps/web/app', 'apps/web/lib'];
const excludedDirectories = new Set(['dist', 'node_modules', '.next']);
const sourceExtension = /\.(?:ts|tsx|js)$/;
const namedImport = /(?:import|export)\s+(type\s+)?\{([^}]*)\}\s+from\s+'(\.{1,2}\/[^']+)'/g;
const namedExport = /export\s+(type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g;

function sourceFiles(directory: string): readonly string[] {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return excludedDirectories.has(entry.name) ? [] : sourceFiles(path);
    }
    return sourceExtension.test(entry.name) ? [path] : [];
  });
}

function importedSymbols(names: string, clauseTypeOnly: boolean): readonly ImportedSymbol[] {
  return names
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => {
      const typeOnly = clauseTypeOnly || item.startsWith('type ');
      const withoutType = typeOnly ? item.slice('type '.length) : item;
      const [name = ''] = withoutType.split(' as ');
      return { name: name.trim(), typeOnly };
    });
}

function repositoryPath(filename: string, specifier: string): string {
  return resolve(dirname(filename), specifier)
    .slice(repositoryRoot.length + 1)
    .split(sep)
    .join('/');
}

function applicationImports(): readonly ApplicationImport[] {
  const imports: ApplicationImport[] = [];
  for (const directory of applicationDirectories) {
    for (const filename of sourceFiles(resolve(repositoryRoot, directory))) {
      const source = readFileSync(filename, 'utf8');
      for (const match of source.matchAll(namedImport)) {
        const [, clauseType = '', names = '', specifier = ''] = match;
        imports.push({
          file: filename
            .slice(repositoryRoot.length + 1)
            .split(sep)
            .join('/'),
          target: repositoryPath(filename, specifier),
          symbols: importedSymbols(names, clauseType.trim() === 'type'),
        });
      }
    }
  }
  return imports;
}

function entryExports(): readonly EntryExport[] {
  const source = readFileSync(entryFile, 'utf8');
  const exports: EntryExport[] = [];
  for (const match of source.matchAll(namedExport)) {
    const [, clauseType = '', names = ''] = match;
    for (const item of names.split(',')) {
      const name = item.trim();
      if (name) {
        exports.push({ name, typeOnly: clauseType.trim() === 'type' });
      }
    }
  }
  return exports;
}

const entryPath = 'packages/game/public/game-runtime-api.ts';
const imports = applicationImports();
const exports = entryExports();

function entryExportsSymbol(symbol: ImportedSymbol, file: string): void {
  const exported = exports.filter((item) => item.name === symbol.name);
  assert.ok(
    exported.length > 0,
    `${file} imports ${symbol.name}, which the public entry does not export.`,
  );
  assert.equal(
    exported.every((item) => item.typeOnly === symbol.typeOnly),
    true,
    `${file} imports ${symbol.name} as ${symbol.typeOnly ? 'a type' : 'a value'}, but the entry exports it differently.`,
  );
}

function isRetainedRootModule(target: string): boolean {
  return (
    target.startsWith('packages/game/') && !target.slice('packages/game/'.length).includes('/')
  );
}

void test('the entry exports every game symbol the application imports or re-exports', () => {
  const gameImports = imports.filter(
    (item) => item.target === entryPath || isRetainedRootModule(item.target),
  );
  assert.ok(gameImports.length > 0, 'The application does not use the game public entry.');
  for (const item of gameImports) {
    for (const symbol of item.symbols) {
      entryExportsSymbol(symbol, item.file);
    }
  }
});

void test('the application reaches the game only through the public entry', () => {
  const retained = imports.filter((item) => isRetainedRootModule(item.target));
  assert.deepEqual(
    retained.map((item) => `${item.file} -> ${item.target}`),
    [],
    'These imports still take symbols from a retained module at the root of the game package.',
  );
});

void test('the entry exports no name twice', () => {
  const seen = new Map<string, number>();
  for (const item of exports) {
    seen.set(item.name, (seen.get(item.name) ?? 0) + 1);
  }
  const duplicates = [...seen].filter(([, count]) => count > 1).map(([name]) => name);
  assert.deepEqual(duplicates, []);
});

void test('the public entries no longer export the retained compile adapter', () => {
  const retainedName = 'compileCampaignPackage';
  for (const [entry, module] of [
    ['packages/game/public/game-runtime-api.ts', gameRuntimeEntry],
    ['packages/game/public/campaign-editor-api.ts', campaignEditorEntry],
  ] as const) {
    assert.equal(
      Object.hasOwn(module, retainedName),
      false,
      `${entry} still exports the retained ${retainedName}.`,
    );
  }
});
