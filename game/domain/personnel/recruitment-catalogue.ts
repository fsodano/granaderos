import { RecruitmentCandidate } from './recruitment-candidate.ts';
export const RecruitmentOrder = Object.freeze({
  Name: 'name',
  Price: 'price',
  Marksmanship: 'marksmanship',
  Medical: 'medical',
} as const);
export type RecruitmentCriteria = Readonly<{
  query?: string;
  specialty?: string;
  availability?: string;
  sort?: string;
}>;
export class RecruitmentCatalogue {
  readonly #candidates: readonly RecruitmentCandidate[];
  constructor(candidates: readonly RecruitmentCandidate[]) {
    this.#candidates = [...candidates];
  }
  select(criteria: RecruitmentCriteria): readonly RecruitmentCandidate[] {
    const {
      query = '',
      specialty = 'all',
      availability = 'all',
      sort = RecruitmentOrder.Name,
    } = criteria;
    return this.#candidates
      .filter(
        (candidate) =>
          candidate.matchesText(query) &&
          candidate.hasSpecialty(specialty) &&
          (availability === 'all' || candidate.availability === availability),
      )
      .sort((left, right) => this.compareCandidates(left, right, sort));
  }

  private compareCandidates(
    left: RecruitmentCandidate,
    right: RecruitmentCandidate,
    order: string,
  ): number {
    let comparison = 0;
    switch (order) {
      case RecruitmentOrder.Price:
        comparison = left.dailyPay - right.dailyPay;
        break;
      case RecruitmentOrder.Marksmanship:
      case RecruitmentOrder.Medical:
        comparison = right.skill(order) - left.skill(order);
        break;
    }
    return (
      comparison ||
      left.name.localeCompare(right.name, 'es') ||
      left.characterId.localeCompare(right.characterId)
    );
  }
}
