import { DomainRefusal, DomainRefusalCode } from '../shared/domain-refusal.ts';

export type SectorSessionRegistration = Readonly<{
  id: string;
  sectorId: string;
  characterIds: readonly string[];
}>;

export type GameSessionSnapshot = Readonly<{
  id: string;
  revision: number;
  activeSectorSessionId: string | null;
  suspendedSectorSessionIds: readonly string[];
  sectorSessions: readonly SectorSessionRegistration[];
}>;

export class GameSession {
  readonly #id: string;
  #revision: number;
  #activeSectorSessionId: string | null;
  readonly #suspendedSectorSessionIds: Set<string>;
  readonly #sectorSessions: Map<string, SectorSessionRegistration>;

  private constructor(snapshot: GameSessionSnapshot) {
    if (!snapshot.id || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    this.#id = snapshot.id;
    this.#revision = snapshot.revision;
    this.#activeSectorSessionId = snapshot.activeSectorSessionId;
    this.#suspendedSectorSessionIds = new Set(snapshot.suspendedSectorSessionIds);
    this.#sectorSessions = new Map();
    if (
      this.#suspendedSectorSessionIds.size !== snapshot.suspendedSectorSessionIds.length ||
      (this.#activeSectorSessionId !== null &&
        this.#suspendedSectorSessionIds.has(this.#activeSectorSessionId))
    ) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    for (const registration of snapshot.sectorSessions) this.#register(registration);
    const registeredIds = [...this.#sectorSessions.keys()];
    const expectedIds = [
      ...this.#suspendedSectorSessionIds,
      ...(this.#activeSectorSessionId === null ? [] : [this.#activeSectorSessionId]),
    ];
    if (
      registeredIds.length !== expectedIds.length ||
      expectedIds.some((id) => !this.#sectorSessions.has(id))
    ) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
  }

  static create(id: string): GameSession {
    return new GameSession({
      id,
      revision: 0,
      activeSectorSessionId: null,
      suspendedSectorSessionIds: [],
      sectorSessions: [],
    });
  }

  static restore(snapshot: GameSessionSnapshot): GameSession {
    return new GameSession(snapshot);
  }

  get id(): string {
    return this.#id;
  }
  get revision(): number {
    return this.#revision;
  }
  get activeSectorSessionId(): string | null {
    return this.#activeSectorSessionId;
  }
  get suspendedSectorSessionIds(): readonly string[] {
    return [...this.#suspendedSectorSessionIds];
  }

  activateSectorSession(registration: SectorSessionRegistration): void {
    const existing = this.#sectorSessions.get(registration.id);
    if (existing) {
      if (
        existing.sectorId !== registration.sectorId ||
        !this.#sameCharacters(existing.characterIds, registration.characterIds)
      ) {
        throw new DomainRefusal(DomainRefusalCode.InvalidValue);
      }
    } else {
      this.#register(registration);
    }
    if (this.#activeSectorSessionId && this.#activeSectorSessionId !== registration.id) {
      this.#suspendedSectorSessionIds.add(this.#activeSectorSessionId);
    }
    this.#suspendedSectorSessionIds.delete(registration.id);
    this.#activeSectorSessionId = registration.id;
  }

  closeSectorSession(id: string): void {
    if (!this.#sectorSessions.has(id)) throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    if (this.#activeSectorSessionId === id) this.#activeSectorSessionId = null;
    this.#suspendedSectorSessionIds.delete(id);
    this.#sectorSessions.delete(id);
  }

  acceptRevision(expectedRevision: number): void {
    if (this.#revision !== expectedRevision)
      throw new DomainRefusal(DomainRefusalCode.RevisionConflict);
    if (!Number.isSafeInteger(this.#revision + 1))
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    this.#revision++;
  }

  snapshot(): GameSessionSnapshot {
    return {
      id: this.#id,
      revision: this.#revision,
      activeSectorSessionId: this.#activeSectorSessionId,
      suspendedSectorSessionIds: [...this.#suspendedSectorSessionIds],
      sectorSessions: [...this.#sectorSessions.values()].map((registration) => ({
        ...registration,
        characterIds: [...registration.characterIds],
      })),
    };
  }

  #register(registration: SectorSessionRegistration): void {
    if (
      !registration.id ||
      !registration.sectorId ||
      this.#sectorSessions.has(registration.id) ||
      registration.characterIds.some((id) => !id) ||
      new Set(registration.characterIds).size !== registration.characterIds.length
    ) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    const occupants = new Set(registration.characterIds);
    for (const existing of this.#sectorSessions.values()) {
      if (
        existing.sectorId === registration.sectorId ||
        existing.characterIds.some((id) => occupants.has(id))
      ) {
        throw new DomainRefusal(DomainRefusalCode.DuplicateSectorParticipation);
      }
    }
    this.#sectorSessions.set(registration.id, {
      ...registration,
      characterIds: [...registration.characterIds],
    });
  }

  #sameCharacters(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((id) => right.includes(id));
  }
}
