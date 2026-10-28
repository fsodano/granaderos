import {
  RecruitmentCandidate,
  RecruitmentAvailability,
} from '../../domain/personnel/recruitment-candidate.ts';
import { RecruitmentCatalogue } from '../../domain/personnel/recruitment-catalogue.ts';
import { contractQuote } from '../../contracts.js';
import { pendingHire } from '../../hiring-arrivals.js';
import { civicStatus } from '../../recruitment.js';
import { CanonicalPersonnelMapper } from '../persistence/canonical-personnel-mapper.ts';
import { DomainIdentityMap } from '../persistence/domain-identity-map.ts';
export class CampaignGetRecruitmentCandidatesRepository {
  #campaign;
  #roster;
  constructor(campaign, roster) {
    this.#campaign = campaign;
    this.#roster = roster;
  }
  loadCatalogue() {
    const personnel = new CanonicalPersonnelMapper(this.#campaign, new DomainIdentityMap());
    return new RecruitmentCatalogue(
      this.#roster.map((character) => {
        const condition = this.#campaign.operativeState[character.id];
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

  candidateAvailability(characterId, condition, quote) {
    if (condition?.alive === false) return RecruitmentAvailability.Fallen;
    if (this.#campaign.recruited.includes(characterId)) return RecruitmentAvailability.Serving;
    if (pendingHire(this.#campaign, characterId)) return RecruitmentAvailability.Pending;
    if (condition?.captured) return RecruitmentAvailability.Captured;
    if (!quote.available || !civicStatus(this.#campaign, characterId).available) {
      return RecruitmentAvailability.Unavailable;
    }
    return RecruitmentAvailability.Available;
  }
}
