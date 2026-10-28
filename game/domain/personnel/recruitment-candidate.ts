export const RecruitmentAvailability = Object.freeze({
  Available: 'available',
  Unavailable: 'unavailable',
  Pending: 'pending',
  Serving: 'hired',
  Fallen: 'fallen',
  Captured: 'captured',
} as const);
export type RecruitmentAvailabilityValue =
  (typeof RecruitmentAvailability)[keyof typeof RecruitmentAvailability];
export const RecruitmentSpecialty = Object.freeze({
  Marksman: 'marksman',
  Medic: 'medic',
  Mechanic: 'mechanic',
  Artillery: 'artillery',
  Leader: 'leader',
  Scout: 'scout',
  Rider: 'rider',
} as const);
export const RecruitmentExpertiseThreshold = 70;
export type RecruitmentCandidateSnapshot = Readonly<{
  characterId: string;
  name: string;
  nickname: string;
  role: string;
  availability: RecruitmentAvailabilityValue;
  dailyPay: number;
  abilities: CharacterAbilities;
}>;

export class RecruitmentCandidate {
  readonly #snapshot: RecruitmentCandidateSnapshot;
  constructor(snapshot: RecruitmentCandidateSnapshot) {
    this.#snapshot = { ...snapshot };
  }
  get characterId(): string {
    return this.#snapshot.characterId;
  }
  get name(): string {
    return this.#snapshot.name;
  }
  get dailyPay(): number {
    return this.#snapshot.dailyPay;
  }
  get availability(): RecruitmentAvailabilityValue {
    return this.#snapshot.availability;
  }
  get abilities(): CharacterAbilities {
    return this.#snapshot.abilities;
  }
  skill(name: string): number {
    return this.#snapshot.abilities.rating(name);
  }
  matchesText(query: string): boolean {
    return RecruitmentCandidate.normalize(
      `${this.#snapshot.name} ${this.#snapshot.nickname} ${this.#snapshot.role}`,
    ).includes(RecruitmentCandidate.normalize(query.trim()));
  }
  hasSpecialty(specialty: string): boolean {
    const fields: Readonly<Record<string, CharacterRatingName>> = {
      [RecruitmentSpecialty.Marksman]: CharacterRating.Marksmanship,
      [RecruitmentSpecialty.Medic]: CharacterRating.Medical,
      [RecruitmentSpecialty.Mechanic]: CharacterRating.Mechanical,
      [RecruitmentSpecialty.Artillery]: CharacterRating.Explosives,
      [RecruitmentSpecialty.Leader]: CharacterRating.Leadership,
    };
    if (specialty in fields)
      return this.#snapshot.abilities.meetsRating(fields[specialty], RecruitmentExpertiseThreshold);
    if (specialty === RecruitmentSpecialty.Scout)
      return this.#snapshot.abilities.hasTrait(CharacterTrait.GuerrillaTactician);
    if (specialty === RecruitmentSpecialty.Rider)
      return [CharacterTrait.ExpertRider, CharacterTrait.CavalryCommander].some((trait) =>
        this.#snapshot.abilities.hasTrait(trait),
      );
    return true;
  }
  static normalize(value: string): string {
    return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es');
  }
}
import {
  CharacterAbilities,
  CharacterRating,
  CharacterTrait,
  type CharacterRatingName,
} from './character-abilities.ts';
