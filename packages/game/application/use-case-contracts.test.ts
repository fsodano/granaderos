import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const applicationRoot = fileURLToPath(new URL('.', import.meta.url));

interface UseCaseFolder {
  readonly directory: string;
  readonly relativeDirectory: string;
  readonly stem: string;
}

interface ExportedType {
  readonly name: string;
  readonly literalUnion: boolean;
}

function directFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

function collectUseCaseFolders(directory: string, folders: UseCaseFolder[]): void {
  const files = directFiles(directory);
  const useCaseFile = files.find((name) => name.endsWith('.use-case.ts'));
  if (useCaseFile) {
    folders.push({
      directory,
      relativeDirectory: relative(applicationRoot, directory).split(sep).join('/'),
      stem: useCaseFile.slice(0, -'.use-case.ts'.length),
    });
  }
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      collectUseCaseFolders(join(directory, entry.name), folders);
    }
  }
}

function isLiteralUnion(value: string): boolean {
  return /^(?:\s*'[^']*'\s*\|)*\s*'[^']*'\s*$/.test(value);
}

function exportedTypes(source: string): readonly ExportedType[] {
  const exported: ExportedType[] = [];
  const declaration = /export\s+type\s+(\w+)(?:<[^>]*>)?\s*=\s*([\s\S]*?);/g;
  for (const match of source.matchAll(declaration)) {
    const [, name = '', value = ''] = match;
    exported.push({ name, literalUnion: isLiteralUnion(value) });
  }
  const reexport = /export\s+type\s*\{([^}]*)\}/g;
  for (const match of source.matchAll(reexport)) {
    const [, names = ''] = match;
    for (const item of names.split(',')) {
      const name = item.trim();
      if (name) {
        exported.push({ name, literalUnion: false });
      }
    }
  }
  return exported;
}

const folders: UseCaseFolder[] = [];
collectUseCaseFolders(applicationRoot, folders);
folders.sort((left, right) => left.relativeDirectory.localeCompare(right.relativeDirectory));

void test('the application layer declares use-case folders', () => {
  assert.ok(folders.length > 0, 'no use-case folder was found under the application layer');
});

for (const folder of folders) {
  void test(`${folder.relativeDirectory} keeps uniform use-case contracts`, () => {
    const files = directFiles(folder.directory);
    const readme = join(folder.directory, 'README.md');
    assert.ok(files.includes('README.md'), `${folder.relativeDirectory} must contain README.md`);
    assert.ok(readFileSync(readme, 'utf8').trim().length > 0, `${readme} must not be empty`);

    assert.deepEqual(
      files.filter((name) => name.endsWith('.repository.ts')),
      [`${folder.stem}.repository.ts`],
      `${folder.relativeDirectory} must hold one repository interface named after its folder`,
    );
    assert.deepEqual(
      files.filter((name) => name.endsWith('.use-case.ts')),
      [`${folder.stem}.use-case.ts`],
      `${folder.relativeDirectory} must hold one use-case class named after its folder`,
    );

    const useCaseSource = readFileSync(
      join(folder.directory, `${folder.stem}.use-case.ts`),
      'utf8',
    );
    const execute = /execute\s*\(([^)]*)\)\s*:\s*([^{]+?)\s*\{/.exec(useCaseSource);
    assert.ok(execute, `${folder.stem}.use-case.ts must declare execute`);
    const [, parameterList = '', returnType = ''] = execute;
    const parameters = parameterList.trim();
    const parameterType = parameters.includes(':')
      ? parameters.slice(parameters.indexOf(':') + 1).trim()
      : '';
    const sharesRequestAndResponse = parameterType !== '' && parameterType === returnType.trim();
    const takesRequest = parameters !== '' && !sharesRequestAndResponse;
    const returnsResponse = returnType.trim() !== 'void';

    const requestModules = files.filter((name) => name.endsWith('.request.ts'));
    const responseModules = files.filter((name) => name.endsWith('.response.ts'));

    if (folder.relativeDirectory === 'sector-sessions/enter-sector') {
      assert.deepEqual(
        requestModules,
        ['sector-entry.request.ts'],
        'EnterSector keeps its recorded SectorEntryRequest exception',
      );
    } else if (takesRequest) {
      assert.deepEqual(
        requestModules,
        [`${folder.stem}.request.ts`],
        `${folder.relativeDirectory} must hold one request module named after its folder`,
      );
    } else {
      assert.deepEqual(
        requestModules,
        [],
        `${folder.relativeDirectory} execute() takes no request, so it must not declare a request module`,
      );
    }

    if (returnsResponse) {
      assert.deepEqual(
        responseModules,
        [`${folder.stem}.response.ts`],
        `${folder.relativeDirectory} must hold one response module named after its folder`,
      );
    } else {
      assert.deepEqual(
        responseModules,
        [],
        `${folder.relativeDirectory} execute() returns void, so it must not declare a response module`,
      );
    }

    for (const module of [...requestModules, ...responseModules]) {
      const exported = exportedTypes(readFileSync(join(folder.directory, module), 'utf8'));
      const contractTypes = exported.filter((exportedType) => !exportedType.literalUnion);
      const supportingTypes = exported.filter((exportedType) => exportedType.literalUnion);
      assert.equal(
        contractTypes.length,
        1,
        `${module} must export exactly one request or response type`,
      );
      assert.ok(
        supportingTypes.length <= 1,
        `${module} may export at most one supporting literal union next to its contract type`,
      );
    }
  });
}
