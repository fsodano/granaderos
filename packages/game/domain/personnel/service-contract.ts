import { Money } from '../finance/money.ts';
import { GameTime } from '../shared/game-time.ts';
import { DomainRefusal, DomainRefusalCode } from '../shared/domain-refusal.ts';

export type ServiceContractSnapshot = Readonly<{
  characterId: string;
  term: string;
  startedAtSeconds: number;
  expiresAtSeconds: number | null;
  paidPesos: number;
}>;

export class ServiceContract {
  readonly #characterId: string;
  readonly #term: string;
  readonly #startedAt: GameTime;
  readonly #expiresAt: GameTime | null;
  readonly #payment: Money;

  private constructor(snapshot: ServiceContractSnapshot) {
    if (
      !snapshot.characterId ||
      !snapshot.term ||
      (snapshot.expiresAtSeconds !== null && snapshot.expiresAtSeconds < snapshot.startedAtSeconds)
    ) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    this.#characterId = snapshot.characterId;
    this.#term = snapshot.term;
    this.#startedAt = GameTime.atSeconds(snapshot.startedAtSeconds);
    this.#expiresAt =
      snapshot.expiresAtSeconds === null ? null : GameTime.atSeconds(snapshot.expiresAtSeconds);
    this.#payment = Money.pesos(snapshot.paidPesos);
  }

  static start(
    characterId: string,
    term: string,
    now: GameTime,
    durationSeconds: number | null,
    payment: Money,
  ): ServiceContract {
    if (durationSeconds !== null && durationSeconds <= 0) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    return new ServiceContract({
      characterId,
      term,
      startedAtSeconds: now.seconds,
      expiresAtSeconds: durationSeconds === null ? null : now.afterSeconds(durationSeconds).seconds,
      paidPesos: payment.pesos,
    });
  }

  static restore(snapshot: ServiceContractSnapshot): ServiceContract {
    return new ServiceContract(snapshot);
  }

  get characterId(): string {
    return this.#characterId;
  }
  get term(): string {
    return this.#term;
  }
  get startedAt(): GameTime {
    return this.#startedAt;
  }
  get expiresAt(): GameTime | null {
    return this.#expiresAt;
  }
  get payment(): Money {
    return this.#payment;
  }
  get permanent(): boolean {
    return this.#expiresAt === null;
  }

  isActiveAt(now: GameTime): boolean {
    return (
      now.seconds >= this.#startedAt.seconds &&
      (this.#expiresAt === null || now.seconds < this.#expiresAt.seconds)
    );
  }

  renew(now: GameTime, term: string, durationSeconds: number, payment: Money): ServiceContract {
    if (this.#expiresAt === null) {
      throw new DomainRefusal(DomainRefusalCode.PermanentService);
    }
    if (
      now.seconds < this.#startedAt.seconds ||
      !Number.isSafeInteger(durationSeconds) ||
      durationSeconds <= 0
    ) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    const remainingUntil = Math.max(now.seconds, this.#expiresAt.seconds);
    return ServiceContract.restore({
      characterId: this.#characterId,
      term,
      startedAtSeconds: now.seconds,
      expiresAtSeconds: GameTime.atSeconds(remainingUntil).afterSeconds(durationSeconds).seconds,
      paidPesos: payment.pesos,
    });
  }

  snapshot(): ServiceContractSnapshot {
    return {
      characterId: this.#characterId,
      term: this.#term,
      startedAtSeconds: this.#startedAt.seconds,
      expiresAtSeconds: this.#expiresAt?.seconds ?? null,
      paidPesos: this.#payment.pesos,
    };
  }
}
