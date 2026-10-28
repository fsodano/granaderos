import { DomainRefusal, DomainRefusalCode } from './domain-refusal.ts';

export const TimeUnits = Object.freeze({ secondsPerHour: 3600, hoursPerDay: 24 });

export class GameTime {
  readonly #seconds: number;

  private constructor(seconds: number) {
    if (!Number.isSafeInteger(seconds) || seconds < 0) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    this.#seconds = seconds;
  }

  static atSeconds(seconds: number): GameTime {
    return new GameTime(seconds);
  }

  static fromCampaignClock(hour: number, secondOfHour: number): GameTime {
    if (
      !Number.isSafeInteger(hour) ||
      !Number.isSafeInteger(secondOfHour) ||
      secondOfHour < 0 ||
      secondOfHour >= TimeUnits.secondsPerHour
    ) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    return new GameTime(hour * TimeUnits.secondsPerHour + secondOfHour);
  }

  afterSeconds(duration: number): GameTime {
    if (!Number.isSafeInteger(duration) || duration < 0) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    return new GameTime(this.#seconds + duration);
  }

  get seconds(): number {
    return this.#seconds;
  }
  get hour(): number {
    return Math.floor(this.#seconds / TimeUnits.secondsPerHour);
  }
  get secondOfHour(): number {
    return this.#seconds % TimeUnits.secondsPerHour;
  }
}
