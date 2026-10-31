import test from 'node:test';
import assert from 'node:assert/strict';
import { GameUnitOfWork } from './game-unit-of-work.ts';
import { Character } from '../../domain/personnel/character.ts';
import { DomainRefusalCode } from '../../domain/shared/domain-refusal.ts';

void test('a transaction publishes its owned draft once and keeps source state unchanged', () => {
  const source = { gameRevision: 4, funds: 100, members: ['ana'] };
  const transaction = new GameUnitOfWork(source, structuredClone);
  transaction.draft.funds -= 20;
  transaction.draft.members.push('juan');
  assert.deepEqual(source, { gameRevision: 4, funds: 100, members: ['ana'] });
  const result = transaction.commit();
  assert.deepEqual(result, { gameRevision: 5, funds: 80, members: ['ana', 'juan'] });
  assert.throws(() => transaction.commit(), { code: DomainRefusalCode.TransactionClosed });
});

void test('a failed validation or stale source never publishes transaction changes', () => {
  const source = { gameRevision: 4, funds: 100 };
  const invalid = new GameUnitOfWork(source, structuredClone);
  invalid.draft.funds = -10;
  assert.throws(() =>
    invalid.commit(() => {
      throw new Error('negative treasury');
    }),
  );
  assert.equal(source.funds, 100);
  assert.throws(() => invalid.commit(), { code: DomainRefusalCode.TransactionClosed });
  const stale = new GameUnitOfWork(source, structuredClone);
  source.gameRevision++;
  assert.throws(() => stale.commit(), { code: DomainRefusalCode.RevisionConflict });
  assert.equal(source.funds, 100);
});

void test('all repositories in a transaction obtain the same identified domain object', () => {
  const transaction = new GameUnitOfWork({ gameRevision: 0 }, structuredClone);
  let restored = 0;
  const restore = () => {
    restored++;
    return Character.restore({
      id: 'ana',
      health: 70,
      maximumHealth: 80,
      alive: true,
      captured: false,
      locationId: 'retiro',
    });
  };
  const first = transaction.identities.obtain('Character', 'ana', restore);
  const second = transaction.identities.obtain('Character', 'ana', restore);
  assert.equal(first, second);
  assert.equal(restored, 1);
});

void test('revision exhaustion refuses before validation or publication and closes the transaction', () => {
  const source = { gameRevision: Number.MAX_SAFE_INTEGER, funds: 100 };
  const transaction = new GameUnitOfWork(source, structuredClone);
  transaction.draft.funds = 20;
  let validated = false;
  assert.throws(
    () =>
      transaction.commit(() => {
        validated = true;
      }),
    { code: DomainRefusalCode.InvalidValue },
  );
  assert.equal(validated, false);
  assert.deepEqual(source, { gameRevision: Number.MAX_SAFE_INTEGER, funds: 100 });
  assert.throws(() => transaction.commit(), { code: DomainRefusalCode.TransactionClosed });
});
