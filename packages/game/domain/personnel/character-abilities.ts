import { isArrayValue } from '../shared/array-value.ts';
import { DomainRefusal, DomainRefusalCode } from '../shared/domain-refusal.ts';

export const CharacterRating = Object.freeze({
  Agility: 'agility',
  Dexterity: 'dexterity',
  Strength: 'strength',
  Leadership: 'leadership',
  Wisdom: 'wisdom',
  Marksmanship: 'marksmanship',
  Mechanical: 'mechanical',
  Explosives: 'explosives',
  Medical: 'medical',
  Stealth: 'stealth',
  Riding: 'ridingSkill',
} as const);
export type CharacterRatingName = (typeof CharacterRating)[keyof typeof CharacterRating];
function isCharacterRating(name: string): name is CharacterRatingName {
  return Object.values(CharacterRating).some((rating) => rating === name);
}
export const TrainableCharacterRatings = Object.freeze(
  Object.values(CharacterRating).filter((name) => name !== CharacterRating.Wisdom),
);
export const CharacterAbilityRules = Object.freeze({
  MinimumRating: 0,
  MaximumRating: 100,
  MaximumTrainingGain: 10,
});
export const CharacterTrait = Object.freeze({
  CavalryCommander: 'cavalry_commander',
  GuerrillaTactician: 'guerrilla_tactician',
  GunsmithArtillerist: 'gunsmith_artillerist',
  LineMarksman: 'line_marksman',
  Teacher: 'teacher',
  FieldRescuer: 'field_rescuer',
  ExpertRider: 'expert_rider',
  Steadfast: 'steadfast',
  WorkshopTraining: 'workshop_training',
  NightVision: 'night_vision',
  Ambidextrous: 'ambidextrous',
} as const);
export const CharacterCapability = Object.freeze({
  MudRider: 'mud_rider',
  MilitiaCommand: 'militia_command',
  LoadingSupport: 'loading_support',
  Counterattack: 'counterattack',
  Bodyguard: 'bodyguard',
  QuickShot: 'quick_shot',
  QuickMovement: 'quick_movement',
  ArtilleryFire: 'artillery_fire',
  Breaching: 'breaching',
  NightScout: 'night_scout',
  ScatterConcealment: 'scatter_concealment',
  ArtilleryLoading: 'artillery_loading',
  FootMorale: 'foot_morale',
  MountedIntimidation: 'mounted_intimidation',
  RapidFirstAid: 'rapid_first_aid',
  CareComposure: 'care_composure',
  EnclosedRoomFear: 'enclosed_room_fear',
  NervousIsolation: 'nervous_isolation',
  CivilianConscience: 'civilian_conscience',
  LowMoraleRefusal: 'low_morale_refusal',
  TacticalCommand: 'tactical_command',
  StrategicCommand: 'strategic_command',
  ProtectedCommander: 'protected_commander',
  MountedCharge: 'mounted_charge',
} as const);

export type CharacterAbilitiesSnapshot = Readonly<{
  ratings: Readonly<Partial<Record<CharacterRatingName, number>>>;
  traits: readonly string[];
  capabilities: readonly string[];
}>;

function requireRating(value: number): void {
  if (
    !Number.isInteger(value) ||
    value < CharacterAbilityRules.MinimumRating ||
    value > CharacterAbilityRules.MaximumRating
  ) {
    throw new DomainRefusal(DomainRefusalCode.InvalidValue);
  }
}

function namedValues(values: readonly string[], supported: readonly string[]): readonly string[] {
  if (!isArrayValue(values) || !values.every((value) => supported.includes(value))) {
    throw new DomainRefusal(DomainRefusalCode.InvalidValue);
  }
  return Object.freeze([...new Set(values)]);
}

export class CharacterAbilities {
  readonly #ratings: Readonly<Partial<Record<CharacterRatingName, number>>>;
  readonly #traits: readonly string[];
  readonly #capabilities: readonly string[];

  constructor(snapshot: CharacterAbilitiesSnapshot) {
    if (
      !snapshot.ratings ||
      typeof snapshot.ratings !== 'object' ||
      isArrayValue(snapshot.ratings)
    ) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    for (const [name, value] of Object.entries(snapshot.ratings)) {
      if (!isCharacterRating(name)) {
        throw new DomainRefusal(DomainRefusalCode.InvalidValue);
      }
      requireRating(value);
    }
    this.#ratings = Object.freeze({ ...snapshot.ratings });
    this.#traits = namedValues(snapshot.traits, Object.values(CharacterTrait));
    this.#capabilities = namedValues(snapshot.capabilities, Object.values(CharacterCapability));
  }

  static empty(): CharacterAbilities {
    return new CharacterAbilities({ ratings: {}, traits: [], capabilities: [] });
  }

  withTraining(
    gains: Readonly<Partial<Record<CharacterRatingName, number>>>,
    strengthFloor?: number,
  ): CharacterAbilities {
    const ratings = { ...this.#ratings };
    for (const [name, gain] of Object.entries(gains)) {
      if (
        !isCharacterRating(name) ||
        !TrainableCharacterRatings.some((rating) => rating === name) ||
        !Number.isInteger(gain) ||
        gain < 0 ||
        gain > CharacterAbilityRules.MaximumTrainingGain
      ) {
        throw new DomainRefusal(DomainRefusalCode.InvalidValue);
      }
      ratings[name] = Math.min(CharacterAbilityRules.MaximumRating, this.rating(name) + gain);
    }
    if (strengthFloor !== undefined) {
      requireRating(strengthFloor);
      ratings.strength = Math.max(ratings.strength ?? 0, strengthFloor);
    }
    return new CharacterAbilities({
      ratings,
      traits: this.#traits,
      capabilities: this.#capabilities,
    });
  }

  rating(name: string): number {
    return isCharacterRating(name) ? (this.#ratings[name] ?? 0) : 0;
  }
  meetsRating(name: CharacterRatingName, minimum: number): boolean {
    requireRating(minimum);
    return this.rating(name) >= minimum;
  }
  hasTrait(trait: string): boolean {
    return this.#traits.includes(trait);
  }
  hasCapability(capability: string): boolean {
    return this.#capabilities.includes(capability);
  }
  toSnapshot(): CharacterAbilitiesSnapshot {
    return {
      ratings: { ...this.#ratings },
      traits: [...this.#traits],
      capabilities: [...this.#capabilities],
    };
  }
}
