import { DomainRefusal, DomainRefusalCode } from './domain-refusal.ts';

export type RandomSourceSnapshot = Readonly<{ seed: number }>;

const MAXIMUM_SEED = 4294967295;
const SEED_RANGE = 4294967296;
const MULTIPLIER = 1664525;
const INCREMENT = 1013904223;

function isSeed(seed: number): boolean {
  return Number.isInteger(seed) && seed >= 0 && seed <= MAXIMUM_SEED;
}

export class RandomSource {
  #seed: number;

  private constructor(seed: number) {
    if (!isSeed(seed)) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    this.#seed = seed;
  }

  static create(seed: number): RandomSource {
    return new RandomSource(seed);
  }

  static restore(snapshot: RandomSourceSnapshot): RandomSource {
    return new RandomSource(snapshot.seed);
  }

  next(): number {
    this.#seed = (Math.imul(MULTIPLIER, this.#seed) + INCREMENT) >>> 0;
    return this.#seed / SEED_RANGE;
  }

  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    return Math.floor(this.next() * maxExclusive);
  }

  nextIntBetween(minInclusive: number, maxInclusive: number): number {
    if (
      !Number.isInteger(minInclusive) ||
      !Number.isInteger(maxInclusive) ||
      minInclusive > maxInclusive
    ) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    return minInclusive + this.nextInt(maxInclusive - minInclusive + 1);
  }

  snapshot(): RandomSourceSnapshot {
    return { seed: this.#seed };
  }
}
