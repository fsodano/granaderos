import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// The interior visibility rule reads the space rules the domain owns. A local
// copy would drift from them, so this module may only import these names.
const source = readFileSync(new URL('./interior-visibility.ts', import.meta.url), 'utf8');

// Drop comments so prose that names a rule cannot read as a declaration.
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const domainOwnedRules = ['tacticalLevel', 'validTacticalLevel', 'spaceKey', 'sameCell'] as const;

void test('the interior visibility module declares no local copy of a space rule', () => {
  for (const rule of domainOwnedRules) {
    const declaration = new RegExp(`\\b(?:const|let|var|function)\\s+${rule}\\b`);
    assert.doesNotMatch(
      code,
      declaration,
      `${rule} must come from tactical-space.ts, not a local copy`,
    );
  }
});
