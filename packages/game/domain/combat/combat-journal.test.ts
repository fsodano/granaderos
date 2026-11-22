import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMBAT_JOURNAL_LIMIT,
  publicCombatJournal,
  recordPublicCombatMessage,
  storedCombatJournal,
  validCombatJournal,
} from './combat-journal.ts';

const entries = (count: number): { turn: number; text: string }[] =>
  Array.from({ length: count }, (_, index) => ({ turn: 1, text: `line ${index}` }));

void test('the journal keeps eighty entries', () => {
  assert.equal(COMBAT_JOURNAL_LIMIT, 80);
});

void test('a valid journal is accepted', () => {
  assert.equal(validCombatJournal(undefined, 1), true);
  assert.equal(validCombatJournal({ version: 1, entries: entries(80) }, 1), true);
});

void test('an entry that names no turn, or carries an empty text, is refused', () => {
  assert.equal(validCombatJournal({ version: 1, entries: [{ text: 'line' }] }, 1), false);
  assert.equal(validCombatJournal({ version: 1, entries: [{ turn: 1, text: '' }] }, 1), false);
});

void test('a text of one thousand characters is accepted and one more is refused', () => {
  assert.equal(
    validCombatJournal({ version: 1, entries: [{ turn: 1, text: 'x'.repeat(1000) }] }, 1),
    true,
  );
  assert.equal(
    validCombatJournal({ version: 1, entries: [{ turn: 1, text: 'x'.repeat(1001) }] }, 1),
    false,
  );
});

void test('an entry from a turn later than the current one is refused', () => {
  assert.equal(validCombatJournal({ version: 1, entries: [{ turn: 1, text: 'line' }] }, 1), true);
  assert.equal(validCombatJournal({ version: 1, entries: [{ turn: 2, text: 'line' }] }, 1), false);
});

void test('a journal with more than eighty entries is refused', () => {
  assert.equal(validCombatJournal({ version: 1, entries: entries(80) }, 1), true);
  assert.equal(validCombatJournal({ version: 1, entries: entries(81) }, 1), false);
});

void test('an invalid stored journal reads as empty', () => {
  assert.deepEqual(
    storedCombatJournal({
      turn: 1,
      publicJournal: { version: 1, entries: [{ turn: 2, text: 'line' }] },
    }),
    [],
  );
});

void test('the false bleeding report stays hidden while stored entries remain intact', () => {
  const state = { turn: 2 };
  recordPublicCombatMessage(state, 'Marta pierde 3 de salud por hemorragia.');
  recordPublicCombatMessage(state, 'Marta pierde 0 de salud por hemorragia.');
  assert.deepEqual(storedCombatJournal(state), [
    { turn: 2, text: 'Marta pierde 3 de salud por hemorragia.' },
    { turn: 2, text: 'Marta pierde 0 de salud por hemorragia.' },
  ]);
  assert.deepEqual(publicCombatJournal(state), [
    { turn: 2, text: 'Marta pierde 3 de salud por hemorragia.' },
  ]);
});

void test('recording an entry that is not admitted changes nothing', () => {
  const state = {
    turn: 5,
    publicJournal: { version: 1, entries: [{ turn: 5, text: 'kept' }] },
  };
  recordPublicCombatMessage(state, '');
  assert.deepEqual(state.publicJournal, { version: 1, entries: [{ turn: 5, text: 'kept' }] });
});
