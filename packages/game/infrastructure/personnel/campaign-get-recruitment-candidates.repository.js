import {
  RecruitmentCandidate,
  RecruitmentAvailability,
} from '../../domain/personnel/recruitment-candidate.ts';
import { RecruitmentCatalogue } from '../../domain/personnel/recruitment-catalogue.ts';
import { contractQuote } from '../../contracts.js';
import { pendingRecruitmentClaim } from '../../recruitment-claims.js';
import { candidateAdmission } from '../../recruitment.ts';
import { CanonicalPersonnelMapper } from '../persistence/canonical-personnel-mapper.ts';
import { DomainIdentityMap } from '../persistence/domain-identity-map.ts';
export class CampaignGetRecruitmentCandidatesRepository {
  /** @type {import('../../public/campaign-types.ts').CampaignSnapshot} */
  #campaign;
  /** @type {import('../../public/campaign-types.ts').CampaignOperative[]} */
  #roster;
  /** @param {import('../../public/campaign-types.ts').CampaignSnapshot} campaign
   * @param {import('../../public/campaign-types.ts').CampaignOperative[]} roster */
  constructor(campaign, roster) {
    this.#campaign = campaign;
    this.#roster = roster;
  }
  /** @returns {import('../../domain/personnel/recruitment-catalogue.ts').RecruitmentCatalogue} */
  loadCatalogue() {
    const personnel = new CanonicalPersonnelMapper(this.#campaign, new DomainIdentityMap());
    return new RecruitmentCatalogue(
      this.#roster.map((character) => {
        const condition = this.#campaign.characters[character.id];
        const quote = contractQuote(this.#campaign, character, 'day');
        const availability = this.candidateAvailability(character.id, condition, quote);
        return new RecruitmentCandidate({
          characterId: String(character.id),
          name: character.name,
          nickname: character.nickname ?? character.name,
          role: character.role ?? '',
          availability,
          dailyPay: quote.daily,
          abilities: personnel.restoreCharacter(character).abilities,
        });
      }),
    );
  }

  /** @param {number} characterId
   * @param {import('../../public/campaign-types.ts').CampaignOperativeState | undefined} condition
   * @param {import('../../public/personnel-query-types.ts').ContractQuote} quote
   * @returns {import('../../domain/personnel/recruitment-candidate.ts').RecruitmentAvailabilityValue} */
  candidateAvailability(characterId, condition, quote) {
    if (condition?.alive === false) {
      return RecruitmentAvailability.Fallen;
    }
    if (this.#campaign.forceRoster.includes(characterId)) {
      return RecruitmentAvailability.Serving;
    }
    if (pendingRecruitmentClaim(this.#campaign, characterId)) {
      return RecruitmentAvailability.Pending;
    }
    if (condition?.captured) {
      return RecruitmentAvailability.Captured;
    }
    if (!quote.available || !candidateAdmission(this.#campaign, characterId).available) {
      return RecruitmentAvailability.Unavailable;
    }
    return RecruitmentAvailability.Available;
  }
}
