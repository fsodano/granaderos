import { DomainRefusal, DomainRefusalCode } from '../../domain/shared/domain-refusal.ts';
import { DomainIdentityMap } from './domain-identity-map.ts';
import {
  advanceRevision,
  gameRevisionDomain,
  readRevision,
  revisionRefusal,
} from '../shared/revision-policy.ts';
import type { RevisionDomain } from '../shared/revision-policy.ts';

export type RevisionedGameSnapshot = { gameRevision?: number };

export type GameUnitOfWorkOptions<T> = {
  /** The revision field this transaction guards. Defaults to `gameRevision`. */
  domain?: RevisionDomain<NoInfer<T>>;
  /** The revision the caller expects to be current. Defaults to the loaded one. */
  expectedRevision?: number;
};

export class GameUnitOfWork<T extends RevisionedGameSnapshot> {
  readonly #source: T;
  readonly #revision: number;
  readonly #draft: T;
  readonly #domain: RevisionDomain<T>;
  readonly identities = new DomainIdentityMap();
  #closed = false;

  constructor(source: T, copy: (source: T) => T, options: GameUnitOfWorkOptions<T> = {}) {
    this.#domain = options.domain ?? (gameRevisionDomain as RevisionDomain<T>);
    this.#source = source;
    this.#revision = readRevision(this.#domain, source);
    if (options.expectedRevision !== undefined && options.expectedRevision !== this.#revision) {
      throw new DomainRefusal(DomainRefusalCode.RevisionConflict);
    }
    this.#draft = copy(source);
  }

  get draft(): T {
    this.#assertOpen();
    return this.#draft;
  }

  /** The revision this transaction loaded and will advance on commit. */
  get revision(): number {
    return this.#revision;
  }

  commit(validate: (draft: T) => void = () => {}): T {
    this.#assertOpen();
    if (readRevision(this.#domain, this.#source) !== this.#revision) {
      this.#closed = true;
      throw new DomainRefusal(DomainRefusalCode.RevisionConflict);
    }
    let acceptedRevision: number;
    try {
      acceptedRevision = advanceRevision(
        this.#revision,
        revisionRefusal(DomainRefusalCode.InvalidValue),
      );
    } catch (error) {
      this.#closed = true;
      throw error;
    }
    try {
      validate(this.#draft);
      this.#domain.write(this.#draft, acceptedRevision);
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
