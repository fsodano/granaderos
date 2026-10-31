import { DomainRefusal, DomainRefusalCode } from '../../domain/shared/domain-refusal.ts';

export function nextRevision(revision: number): number {
  if (!Number.isSafeInteger(revision) || revision < 0 || revision === Number.MAX_SAFE_INTEGER) {
    throw new DomainRefusal(DomainRefusalCode.RevisionConflict);
  }
  return revision + 1;
}
