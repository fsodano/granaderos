import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from '../apps/web/node_modules/typescript/lib/typescript.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const failures = [];
const publicGameEntries = new Set([
  'packages/game/public/campaign-editor-api.ts',
  'packages/game/public/campaign-playtest-api.ts',
  'packages/game/public/game-persistence-api.ts',
]);
const publicPreviewEntries = new Set([
  'apps/web/game-preview.ts',
  'apps/web/game-preview-assets.js',
]);
const sourceExtension = /\.(?:ts|tsx|js|mjs)$/;
const excludedDirectories = new Set(['node_modules', 'dist', '.next', 'out']);
const sourceDirectories = [
  'packages/game',
  'apps/campaign-editor',
  'packages/campaign-format',
  'apps/web',
];

for (const directory of sourceDirectories) {
  if (!existsSync(resolve(root, directory))) {
    throw new Error(`Architecture source directory is missing: ${directory}`);
  }
}

function sourceFiles(directory) {
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

function pathWithin(path, directory) {
  return path === directory || path.startsWith(`${directory}/`);
}

function fail(file, dependency, rule) {
  failures.push(`${file}: ${dependency} — ${rule}`);
}

const browserBoundaryFiles = [
  'packages/game/domain',
  'packages/game/application',
  'apps/campaign-editor/domain',
  'apps/campaign-editor/application',
].flatMap((directory) => sourceFiles(resolve(root, directory)));
const boundaryProgram = ts.createProgram(browserBoundaryFiles, {
  allowJs: true,
  noResolve: true,
  noEmit: true,
});
const boundaryTypes = boundaryProgram.getTypeChecker();

let checked = 0;
for (const directory of sourceDirectories) {
  for (const filename of sourceFiles(resolve(root, directory))) {
    const file = relative(root, filename).split(sep).join('/');
    const text = readFileSync(filename, 'utf8');
    const imports = ts.preProcessFile(text, true, true).importedFiles.map((item) => item.fileName);
    const isTest = /(?:^|\/)tests\/|\.test\./.test(file);
    checked++;
    for (const dependency of imports) {
      const target = dependency.startsWith('.')
        ? relative(root, resolve(dirname(filename), dependency))
            .split(sep)
            .join('/')
        : dependency;
      if (file.startsWith('packages/game/') && pathWithin(target, 'apps/campaign-editor')) {
        fail(file, dependency, 'Game runtime cannot import campaign-editor.');
      }
      if (
        file.startsWith('packages/game/domain/') &&
        !isTest &&
        !pathWithin(target, 'packages/game/domain')
      ) {
        fail(file, dependency, 'Domain code depends only on domain code.');
      }
      if (
        file.startsWith('packages/game/application/') &&
        !isTest &&
        !pathWithin(target, 'packages/game/application') &&
        !pathWithin(target, 'packages/game/domain')
      ) {
        fail(file, dependency, 'Application code depends on its contracts and the domain.');
      }
      if (
        file.startsWith('apps/campaign-editor/domain/') &&
        !isTest &&
        !pathWithin(target, 'apps/campaign-editor/domain') &&
        !pathWithin(target, 'packages/campaign-format')
      ) {
        fail(file, dependency, 'Editor domain depends only on its domain and the shared format.');
      }
      if (
        file.startsWith('apps/campaign-editor/application/') &&
        !isTest &&
        !pathWithin(target, 'apps/campaign-editor/application') &&
        !pathWithin(target, 'apps/campaign-editor/domain') &&
        !pathWithin(target, 'packages/campaign-format')
      ) {
        fail(
          file,
          dependency,
          'Editor application depends on its contracts, domain, and shared format.',
        );
      }
      if (
        file.startsWith('packages/campaign-format/') &&
        (pathWithin(target, 'packages/game') ||
          pathWithin(target, 'apps/web') ||
          pathWithin(target, 'apps/campaign-editor'))
      ) {
        fail(file, dependency, 'Campaign format must remain independent of its consumers.');
      }
      if (
        file.startsWith('apps/campaign-editor/') &&
        !file.includes('/tools/') &&
        pathWithin(target, 'packages/game') &&
        !publicGameEntries.has(target)
      ) {
        fail(file, dependency, 'Editor integration must use a declared game public entry.');
      }
      if (
        file.startsWith('apps/campaign-editor/') &&
        pathWithin(target, 'apps/web') &&
        !publicPreviewEntries.has(target)
      ) {
        fail(file, dependency, 'Editor previews must use the declared preview entry.');
      }
    }
    const checksBrowserBoundary =
      !isTest &&
      (file.startsWith('packages/game/domain/') ||
        file.startsWith('packages/game/application/') ||
        file.startsWith('apps/campaign-editor/domain/') ||
        file.startsWith('apps/campaign-editor/application/'));
    if (checksBrowserBoundary) {
      const syntax = boundaryProgram.getSourceFile(filename);
      const browserGlobals = new Set([
        'window',
        'document',
        'localStorage',
        'sessionStorage',
        'navigator',
        'Worker',
      ]);
      function inspect(node) {
        if (
          (ts.isPropertyAccessExpression(node) ||
            ts.isElementAccessExpression(node) ||
            ts.isCallExpression(node) ||
            ts.isNewExpression(node)) &&
          ts.isIdentifier(node.expression) &&
          browserGlobals.has(node.expression.text)
        ) {
          const symbol = boundaryTypes.getSymbolAtLocation(node.expression);
          const locallyDeclared = symbol?.declarations?.some(
            (declaration) => declaration.getSourceFile().fileName === filename,
          );
          if (!locallyDeclared) {
            fail(
              file,
              node.expression.text,
              'Domain and application code must use ports for browser mechanisms.',
            );
          }
        }
        ts.forEachChild(node, inspect);
      }
      inspect(syntax);
    }
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Architecture boundaries passed for ${checked} source files.`);
}
