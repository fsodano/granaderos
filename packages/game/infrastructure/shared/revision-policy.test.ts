import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceRevision,
  assertExpectedRevision,
  gameRevisionDomain,
  journeyRevisionDomain,
  readRevision,
  revisionRefusal,
  sectorRevisionDomain,
} from './revision-policy.ts';
import { DomainRefusalCode } from '../../domain/shared/domain-refusal.ts';

void test('a revision domain reads and writes the field it names', () => {
  const campaign = { gameRevision: 4 };
  assert.equal(readRevision(gameRevisionDomain, campaign), 4);
  gameRevisionDomain.write(campaign, 5);
  assert.equal(campaign.gameRevision, 5);

  const sector = { sectorRevision: 2 };
  assert.equal(readRevision(sectorRevisionDomain, sector), 2);
  sectorRevisionDomain.write(sector, 3);
  assert.equal(sector.sectorRevision, 3);

  const squad = { journeyRevision: 7 };
  assert.equal(readRevision(journeyRevisionDomain, squad), 7);
  journeyRevisionDomain.write(squad, 8);
  assert.equal(squad.journeyRevision, 8);
});

void test('an absent revision reads as the first revision', () => {
  assert.equal(readRevision(gameRevisionDomain, {}), 0);
  assert.equal(readRevision(sectorRevisionDomain, {}), 0);
  assert.equal(readRevision(journeyRevisionDomain, {}), 0);
});

void test('a revision that is not a revision is refused', () => {
  assert.throws(() => readRevision(gameRevisionDomain, { gameRevision: -1 }), {
    code: DomainRefusalCode.RevisionConflict,
  });
  assert.throws(() => readRevision(gameRevisionDomain, { gameRevision: 1.5 }), {
    code: DomainRefusalCode.RevisionConflict,
  });
  assert.throws(() => readRevision(sectorRevisionDomain, { sectorRevision: Number.NaN }), {
    code: DomainRefusalCode.RevisionConflict,
  });
});

void test('an expectation that does not match the loaded revision is refused', () => {
  assert.doesNotThrow(() => assertExpectedRevision(4, 4));
  assert.throws(() => assertExpectedRevision(4, 3), {
    code: DomainRefusalCode.RevisionConflict,
  });
});

void test('advancing a revision produces exactly the next revision', () => {
  assert.equal(advanceRevision(0), 1);
  assert.equal(advanceRevision(41), 42);
});

void test('advancing refuses an invalid revision and an exhausted one', () => {
  assert.throws(() => advanceRevision(-1), { code: DomainRefusalCode.RevisionConflict });
  assert.throws(() => advanceRevision(1.5), { code: DomainRefusalCode.RevisionConflict });
  assert.throws(() => advanceRevision(Number.MAX_SAFE_INTEGER), {
    code: DomainRefusalCode.RevisionConflict,
  });
  assert.throws(
    () => advanceRevision(Number.MAX_SAFE_INTEGER, revisionRefusal(DomainRefusalCode.InvalidValue)),
    { code: DomainRefusalCode.InvalidValue },
  );
});
