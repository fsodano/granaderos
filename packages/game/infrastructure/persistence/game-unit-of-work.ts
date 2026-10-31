import { DomainRefusal, DomainRefusalCode } from '../../domain/shared/domain-refusal.ts';
import { DomainIdentityMap } from './domain-identity-map.ts';

export type RevisionedGameSnapshot = { gameRevision?: number };

export class GameUnitOfWork<T extends RevisionedGameSnapshot> {
  readonly #source: T;
  readonly #revision: number;
  readonly #draft: T;
  readonly identities = new DomainIdentityMap();
  #closed = false;

  constructor(source: T, copy: (source: T) => T, expectedRevision = source.gameRevision ?? 0) {
    this.#source = source;
    this.#revision = source.gameRevision ?? 0;
    if (
      !Number.isSafeInteger(this.#revision) ||
      this.#revision < 0 ||
      expectedRevision !== this.#revision
    ) {
      throw new DomainRefusal(DomainRefusalCode.RevisionConflict);
    }
    this.#draft = copy(source);
  }

  get draft(): T {
    this.#assertOpen();
    return this.#draft;
  }

  commit(validate: (draft: T) => void = () => {}): T {
    this.#assertOpen();
    if ((this.#source.gameRevision ?? 0) !== this.#revision) {
      this.#closed = true;
      throw new DomainRefusal(DomainRefusalCode.RevisionConflict);
    }
    if (!Number.isSafeInteger(this.#revision + 1)) {
      this.#closed = true;
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    try {
      validate(this.#draft);
      this.#draft.gameRevision = this.#revision + 1;
      return this.#draft;
    } finally {
      this.#closed = true;
    }
  }

  abort(): void {
    this.#closed = true;
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw new DomainRefusal(DomainRefusalCode.TransactionClosed);
    }
  }
}
