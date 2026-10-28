import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from '../web/node_modules/typescript/lib/typescript.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const failures = [];
const publicGameEntries = new Set([
  'game/public/campaign-editor-api.js',
  'game/public/campaign-playtest-api.js',
  'game/public/game-persistence-api.js',
]);
const publicPreviewEntries = new Set(['web/game-preview.ts', 'web/game-preview-assets.js']);
const sourceExtension = /\.(?:ts|tsx|js|mjs)$/;
const excludedDirectories = new Set(['node_modules', 'dist', '.next', 'out']);

function sourceFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return excludedDirectories.has(entry.name) ? [] : sourceFiles(path);
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
  'game/domain',
  'game/application',
  'campaign-editor/domain',
  'campaign-editor/application',
].flatMap((directory) => sourceFiles(resolve(root, directory)));
const boundaryProgram = ts.createProgram(browserBoundaryFiles, {
  allowJs: true,
  noResolve: true,
  noEmit: true,
});
const boundaryTypes = boundaryProgram.getTypeChecker();

let checked = 0;
for (const directory of ['game', 'campaign-editor', 'campaign-format', 'web']) {
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
      if (file.startsWith('game/') && pathWithin(target, 'campaign-editor')) {
        fail(file, dependency, 'Game runtime cannot import campaign-editor.');
      }
      if (file.startsWith('game/domain/') && !isTest && !pathWithin(target, 'game/domain')) {
        fail(file, dependency, 'Domain code depends only on domain code.');
      }
      if (
        file.startsWith('game/application/') &&
        !isTest &&
        !pathWithin(target, 'game/application') &&
        !pathWithin(target, 'game/domain')
      ) {
        fail(file, dependency, 'Application code depends on its contracts and the domain.');
      }
      if (
        file.startsWith('campaign-editor/domain/') &&
        !isTest &&
        !pathWithin(target, 'campaign-editor/domain') &&
        !pathWithin(target, 'campaign-format')
      ) {
        fail(file, dependency, 'Editor domain depends only on its domain and the shared format.');
      }
      if (
        file.startsWith('campaign-editor/application/') &&
        !isTest &&
        !pathWithin(target, 'campaign-editor/application') &&
        !pathWithin(target, 'campaign-editor/domain') &&
        !pathWithin(target, 'campaign-format')
      ) {
        fail(
          file,
          dependency,
          'Editor application depends on its contracts, domain, and shared format.',
        );
      }
      if (
        file.startsWith('campaign-format/') &&
        (pathWithin(target, 'game') ||
          pathWithin(target, 'web') ||
          pathWithin(target, 'campaign-editor'))
      ) {
        fail(file, dependency, 'Campaign format must remain independent of its consumers.');
      }
      if (
        file.startsWith('campaign-editor/') &&
        !file.includes('/tools/') &&
        pathWithin(target, 'game') &&
        !publicGameEntries.has(target)
      ) {
        fail(file, dependency, 'Editor integration must use a declared game public entry.');
      }
      if (
        file.startsWith('campaign-editor/') &&
        pathWithin(target, 'web') &&
        !publicPreviewEntries.has(target)
      ) {
        fail(file, dependency, 'Editor previews must use the declared preview entry.');
      }
    }
    const checksBrowserBoundary =
      !isTest &&
      (file.startsWith('game/domain/') ||
        file.startsWith('game/application/') ||
        file.startsWith('campaign-editor/domain/') ||
        file.startsWith('campaign-editor/application/'));
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
          if (!locallyDeclared)
            fail(
              file,
              node.expression.text,
              'Domain and application code must use ports for browser mechanisms.',
            );
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
