import { DomainRefusal, DomainRefusalCode } from '../../domain/shared/domain-refusal.ts';
import type { DomainRefusalCodeValue } from '../../domain/shared/domain-refusal.ts';

/**
 * A revision domain names the field that one transaction guards. Adapters
 * state which revision they protect instead of repeating the revision rules.
 */
export interface RevisionDomain<T> {
  readonly name: string;
  read(state: T): number;
  write(state: T, revision: number): void;
}

export type RevisionedCampaignState = { gameRevision?: number };
export type RevisionedSectorState = { sectorRevision?: number };
export type RevisionedSquadState = { journeyRevision?: number };

export const gameRevisionDomain: RevisionDomain<RevisionedCampaignState> = {
  name: 'game-revision',
  read: (state) => state.gameRevision ?? 0,
  write: (state, revision) => {
    state.gameRevision = revision;
  },
};

export const sectorRevisionDomain: RevisionDomain<RevisionedSectorState> = {
  name: 'sector-revision',
  read: (state) => state.sectorRevision ?? 0,
  write: (state, revision) => {
    state.sectorRevision = revision;
  },
};

export const journeyRevisionDomain: RevisionDomain<RevisionedSquadState> = {
  name: 'journey-revision',
  read: (state) => state.journeyRevision ?? 0,
  write: (state, revision) => {
    state.journeyRevision = revision;
  },
};

/**
 * Reads the revision a domain owns and refuses a value that is not a
 * revision.
 */
export function readRevision<T>(domain: RevisionDomain<T>, state: T): number {
  const revision = domain.read(state);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new DomainRefusal(DomainRefusalCode.RevisionConflict);
  }
  return revision;
}

/**
 * Refuses an expectation that does not match the revision a transaction
 * loaded.
 */
export function assertExpectedRevision(current: number, expected: number): void {
  if (current !== expected) {
    throw new DomainRefusal(DomainRefusalCode.RevisionConflict);
  }
}

/**
 * Produces the revision that accepts the next accepted change. A revision
 * that cannot advance is refused with the refusal the caller names, so a
 * transaction keeps its own refusal code for that condition.
 */
export function advanceRevision(
  current: number,
  exhausted: () => Error = () => new DomainRefusal(DomainRefusalCode.RevisionConflict),
): number {
  if (!Number.isSafeInteger(current) || current < 0) {
    throw new DomainRefusal(DomainRefusalCode.RevisionConflict);
  }
  if (current === Number.MAX_SAFE_INTEGER) {
    throw exhausted();
  }
  return current + 1;
}

export function revisionRefusal(code: DomainRefusalCodeValue): () => Error {
  return () => new DomainRefusal(code);
}
