import { CampaignRuleRefusal } from '../shared/campaign-rule-refusal.ts';
import { DomainRefusal, DomainRefusalCode } from '../../domain/shared/domain-refusal.ts';
import { rosterFor, civicStatus } from '../../recruitment.js';
import { hiringArrivalOptions } from '../../hiring-arrivals.js';
import {
  CampaignRecruitmentMapper,
  RecruitmentEquipmentSource,
} from './campaign-recruitment-mapper.js';

export class CampaignRecruitCombatantRepository {
  #transaction;
  #mapper;
  #loadedContext = null;
  #candidate = null;
  #committed = false;

  constructor(transaction) {
    this.#transaction = transaction;
    this.#mapper = new CampaignRecruitmentMapper(transaction);
  }

  load(request) {
    const campaign = this.#transaction.draft;
    const candidateId = Number(request.characterId);
    const eligibility = civicStatus(campaign, candidateId);
    if (!eligibility.available)
      throw new CampaignRuleRefusal(DomainRefusalCode.CandidateIneligible, eligibility.reason);
    const locations = hiringArrivalOptions(campaign).map((site) => site.id);
    const allowedLocations = locations.includes(campaign.location)
      ? [campaign.location, ...locations.filter((id) => id !== campaign.location)]
      : locations;
    this.#candidate = rosterFor(campaign).find((character) => character.id === candidateId);
    this.#loadedContext = this.#mapper.restore(this.#candidate, request.term, allowedLocations);
    return this.#loadedContext;
  }

  commit(context, outcome) {
    if (
      this.#committed ||
      context !== this.#loadedContext ||
      outcome.characterId !== String(this.#candidate?.id)
    ) {
      throw new DomainRefusal(DomainRefusalCode.TransactionClosed);
    }
    this.#mapper.apply(this.#candidate, context, outcome, RecruitmentEquipmentSource.InitialIssue);
    this.#committed = true;
  }
}
