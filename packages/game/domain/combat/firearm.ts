export const FirearmDischarge = Object.freeze({ Fired: 'fired', Misfire: 'misfire' } as const);
export const FirearmRefusalCode = Object.freeze({
  InvalidState: 'invalid-firearm-state',
  Unloaded: 'firearm-unloaded',
  Jammed: 'firearm-jammed',
  InvalidWork: 'invalid-firearm-work',
} as const);
export class FirearmRefusal extends Error {
  readonly code: (typeof FirearmRefusalCode)[keyof typeof FirearmRefusalCode];
  constructor(code: (typeof FirearmRefusalCode)[keyof typeof FirearmRefusalCode]) {
    super(code);
    this.name = 'FirearmRefusal';
    this.code = code;
  }
}
export const IgnitionRules = Object.freeze({
  BaseMisfirePercent: 2,
  ConditionPenalty: 0.2,
  RainPenalty: 0.5,
  MaximumMisfirePercent: 95,
  FullCondition: 100,
  DischargeWear: 1,
});
export type FirearmSnapshot = Readonly<{ loaded: number; condition: number; jammed: boolean }>;
export class Firearm {
  #loaded: number;
  #condition: number;
  #jammed: boolean;
  constructor(snapshot: FirearmSnapshot) {
    if (
      !Number.isSafeInteger(snapshot.loaded) ||
      snapshot.loaded < 0 ||
      !Number.isFinite(snapshot.condition) ||
      snapshot.condition < 0 ||
      snapshot.condition > IgnitionRules.FullCondition ||
      typeof snapshot.jammed !== 'boolean'
    ) {
      throw new FirearmRefusal(FirearmRefusalCode.InvalidState);
    }
    this.#loaded = snapshot.loaded;
    this.#condition = snapshot.condition;
    this.#jammed = snapshot.jammed;
  }
  tryDischarge(
    misfirePercent: number,
    roll: number,
  ): (typeof FirearmDischarge)[keyof typeof FirearmDischarge] {
    if (this.#jammed) {
      throw new FirearmRefusal(FirearmRefusalCode.Jammed);
    }
    if (this.#loaded < 1) {
      throw new FirearmRefusal(FirearmRefusalCode.Unloaded);
    }
    if (
      !Number.isFinite(misfirePercent) ||
      misfirePercent < 0 ||
      misfirePercent > 100 ||
      !Number.isFinite(roll) ||
      roll < 0 ||
      roll >= 1
    ) {
      throw new FirearmRefusal(FirearmRefusalCode.InvalidState);
    }
    if (roll * 100 < misfirePercent) {
      this.#jammed = true;
      return FirearmDischarge.Misfire;
    }
    this.#loaded--;
    this.#condition = Math.max(0, this.#condition - IgnitionRules.DischargeWear);
    return FirearmDischarge.Fired;
  }
  reprime(): void {
    if (!this.#jammed) {
      throw new FirearmRefusal(FirearmRefusalCode.InvalidWork);
    }
    this.#jammed = false;
  }
  snapshot(): FirearmSnapshot {
    return { loaded: this.#loaded, condition: this.#condition, jammed: this.#jammed };
  }
}
export class IgnitionPolicy {
  baseRisk(condition: number, rain: number, humidity: number): number {
    const bounded = (value: number) => Math.max(0, Math.min(100, value));
    return Math.max(
      0,
      Math.min(
        IgnitionRules.MaximumMisfirePercent,
        Math.round(
          IgnitionRules.BaseMisfirePercent +
            (100 - bounded(condition)) * IgnitionRules.ConditionPenalty +
            bounded(rain) * IgnitionRules.RainPenalty +
            bounded(humidity),
        ),
      ),
    );
  }
  risk(
    condition: number,
    rain: number,
    humidity: number,
    weaponReliability: number,
    trainedReliability: number,
    flatReduction: number,
  ): number {
    return Math.max(
      0,
      Math.min(
        IgnitionRules.MaximumMisfirePercent,
        this.baseRisk(condition, rain, humidity) * weaponReliability * trainedReliability -
          flatReduction,
      ),
    );
  }
}
