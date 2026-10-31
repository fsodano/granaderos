export const ActionPointRules = Object.freeze({
  CarryLimit: 20,
  MaximumBase: 100,
  MinimumCapableBase: 15,
  MinimumStatBase: 40,
  CriticalHealth: 15,
  BaseStatOffset: 5,
  HealthStatDivisor: 20,
  AgilityStatDivisor: 10,
  DexterityStatDivisor: 20,
  StoredUnitsPerPoint: 4,
  HighAltitudeMetres: 2500,
  AltitudePenalty: 15,
  ExposurePenalty: 10,
  NormalFatiguePenalty: 0.4,
  AdaptedFatiguePenalty: 0.25,
  BandagedWoundFactor: 0.5,
} as const);

export const CombatRefusalCode = Object.freeze({
  InvalidActionPoints: 'invalid-action-points',
  InsufficientActionPoints: 'insufficient-action-points',
  InvalidParticipant: 'invalid-sector-participant',
  InvalidCombatSession: 'invalid-combat-session',
  CombatAlreadyCompleted: 'combat-already-completed',
  InvalidCombatPhase: 'invalid-combat-phase',
  ContactPreventsExploration: 'contact-prevents-exploration',
} as const);
export type CombatRefusalCodeValue = (typeof CombatRefusalCode)[keyof typeof CombatRefusalCode];

export class CombatRefusal extends Error {
  readonly code: CombatRefusalCodeValue;
  constructor(code: CombatRefusalCodeValue) {
    super(code);
    this.name = 'CombatRefusal';
    this.code = code;
  }
}

export class ActionPoints {
  readonly #amount: number;
  private constructor(amount: number) {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new CombatRefusal(CombatRefusalCode.InvalidActionPoints);
    }
    this.#amount = amount;
  }
  static of(amount: number): ActionPoints {
    return new ActionPoints(amount);
  }
  get amount(): number {
    return this.#amount;
  }
  canSpend(cost: number): boolean {
    return Number.isSafeInteger(cost) && cost >= 0 && cost <= this.#amount;
  }
  spend(cost: number): ActionPoints {
    if (!this.canSpend(cost)) {
      throw new CombatRefusal(CombatRefusalCode.InsufficientActionPoints);
    }
    return ActionPoints.of(this.#amount - cost);
  }
  lose(amount: number): ActionPoints {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new CombatRefusal(CombatRefusalCode.InvalidActionPoints);
    }
    return ActionPoints.of(Math.max(0, this.#amount - amount));
  }
  carryToNextTurn(): number {
    return Math.min(this.#amount, ActionPointRules.CarryLimit);
  }
}

export type ActionPointCondition = Readonly<{
  health: number;
  maximumHealth: number;
  bandagedWounds: number;
  energy: number;
  fatigue: number;
  agility: number;
  dexterity: number;
  experienceLevel: number;
  departed: boolean;
  surrendered: boolean;
  routed: boolean;
  adaptedToFatigue: boolean;
  protectedFromWeather: boolean;
}>;

export type ActionPointEnvironment = Readonly<{ highAltitude: boolean; raining: boolean }>;
export type ActionPointBalance = Readonly<{
  woundMaximumPenalty: number;
  energyPenaltyPerPoint: number;
}>;

export class ActionPointPolicy {
  readonly #balance: ActionPointBalance;
  constructor(balance: ActionPointBalance) {
    this.#balance = balance;
  }

  maximum(condition: ActionPointCondition, environment: ActionPointEnvironment): number {
    if (
      condition.health < ActionPointRules.CriticalHealth ||
      condition.departed ||
      condition.surrendered ||
      condition.routed ||
      condition.energy <= 0
    ) {
      return 0;
    }
    const statBase = Math.round(
      ActionPointRules.StoredUnitsPerPoint *
        (ActionPointRules.BaseStatOffset +
          condition.maximumHealth / ActionPointRules.HealthStatDivisor +
          condition.agility / ActionPointRules.AgilityStatDivisor +
          condition.dexterity / ActionPointRules.DexterityStatDivisor +
          condition.experienceLevel),
    );
    const boundedBase = Math.max(
      ActionPointRules.MinimumStatBase,
      Math.min(ActionPointRules.MaximumBase, statBase),
    );
    const wounds = Math.max(0, condition.maximumHealth - condition.health);
    const bandaged = Math.max(0, Math.min(wounds, condition.bandagedWounds));
    const effectiveWounds = wounds - bandaged * ActionPointRules.BandagedWoundFactor;
    const injuryPenalty =
      (effectiveWounds / condition.maximumHealth) * this.#balance.woundMaximumPenalty;
    const energyPenalty =
      (ActionPointRules.MaximumBase - condition.energy) * this.#balance.energyPenaltyPerPoint;
    const fatiguePenalty =
      condition.fatigue *
      (condition.adaptedToFatigue
        ? ActionPointRules.AdaptedFatiguePenalty
        : ActionPointRules.NormalFatiguePenalty);
    const altitudePenalty = environment.highAltitude ? ActionPointRules.AltitudePenalty : 0;
    const exposurePenalty =
      (environment.highAltitude || environment.raining) && !condition.protectedFromWeather
        ? ActionPointRules.ExposurePenalty
        : 0;
    return Math.round(
      Math.max(
        ActionPointRules.MinimumCapableBase,
        Math.min(
          ActionPointRules.MaximumBase,
          boundedBase -
            injuryPenalty -
            energyPenalty -
            fatiguePenalty -
            altitudePenalty -
            exposurePenalty,
        ),
      ),
    );
  }
}
