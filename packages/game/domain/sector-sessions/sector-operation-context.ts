export type SectorOperationContextSnapshot = Readonly<{
  sessionId: string;
  sectorSessionId: string;
  revision: number;
  sectorRevision: number;
  requestId: string;
}>;

export const SectorOperationContextRefusal = Object.freeze({
  Invalid: 'invalid-sector-operation-context',
  StaleResult: 'stale-sector-operation-result',
} as const);

export class SectorOperationContext {
  readonly #snapshot: SectorOperationContextSnapshot;

  constructor(snapshot: SectorOperationContextSnapshot) {
    if (
      !snapshot ||
      ![snapshot.sessionId, snapshot.sectorSessionId, snapshot.requestId].every(
        (value) => typeof value === 'string' && value.length > 0,
      ) ||
      ![snapshot.revision, snapshot.sectorRevision].every(
        (value) => Number.isSafeInteger(value) && value >= 0,
      )
    ) {
      throw new Error(SectorOperationContextRefusal.Invalid);
    }
    this.#snapshot = { ...snapshot };
  }

  matches(other: SectorOperationContextSnapshot): boolean {
    return (
      other?.sessionId === this.#snapshot.sessionId &&
      other.sectorSessionId === this.#snapshot.sectorSessionId &&
      other.revision === this.#snapshot.revision &&
      other.sectorRevision === this.#snapshot.sectorRevision &&
      other.requestId === this.#snapshot.requestId
    );
  }

  assertMatches(other: SectorOperationContextSnapshot): void {
    if (!this.matches(other)) {
      throw new Error(SectorOperationContextRefusal.StaleResult);
    }
  }

  snapshot(): SectorOperationContextSnapshot {
    return { ...this.#snapshot };
  }
}
