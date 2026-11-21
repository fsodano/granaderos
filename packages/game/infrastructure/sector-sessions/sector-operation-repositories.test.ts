import test from 'node:test';
import assert from 'node:assert/strict';
import { SectorOperationTransaction } from './sector-operation-repositories.js';
import { DomainRefusalCode } from '../../domain/shared/domain-refusal.ts';

type SectorSnapshot = {
  sectorRevision: number;
  units: { id: string }[];
  lastError?: string;
};

type SectorTransaction = {
  load(): { snapshot: SectorSnapshot; revision: number };
  commit(snapshot: SectorSnapshot, expectedRevision: number): void;
};

function sectorSnapshot(): SectorSnapshot {
  return { sectorRevision: 2, units: [{ id: 'ana' }] };
}

function openTransaction(): SectorTransaction {
  return new SectorOperationTransaction(sectorSnapshot()) as SectorTransaction;
}

void test('a sector transaction loads the current revision and a copy of the sector', () => {
  const source = sectorSnapshot();
  const transaction = new SectorOperationTransaction(source) as SectorTransaction;
  const loaded = transaction.load();
  assert.equal(loaded.revision, 2);
  assert.deepEqual(loaded.snapshot, source);
  assert.notEqual(loaded.snapshot, source);
});

void test('a sector transaction refuses a revision that is not the loaded one', () => {
  const transaction = openTransaction();
  const loaded = transaction.load();
  assert.throws(() => transaction.commit(loaded.snapshot, 1), {
    code: DomainRefusalCode.RevisionConflict,
  });
});

void test('a refused sector order leaves the sector revision untouched', () => {
  const transaction = openTransaction();
  const loaded = transaction.load();
  const refused: SectorSnapshot = { ...loaded.snapshot, lastError: 'La orden no es válida.' };
  transaction.commit(refused, loaded.revision);
  assert.equal(refused.sectorRevision, 2);
});

void test('a sector order that changes nothing leaves the sector revision untouched', () => {
  const transaction = openTransaction();
  const loaded = transaction.load();
  const unchanged: SectorSnapshot = structuredClone(loaded.snapshot);
  transaction.commit(unchanged, loaded.revision);
  assert.equal(unchanged.sectorRevision, 2);
});

void test('a sector order that changes the sector advances the sector revision once', () => {
  const transaction = openTransaction();
  const loaded = transaction.load();
  const changed: SectorSnapshot = structuredClone(loaded.snapshot);
  changed.units.push({ id: 'juan' });
  transaction.commit(changed, loaded.revision);
  assert.equal(changed.sectorRevision, 3);
});
