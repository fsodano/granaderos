import { DomainRefusal, DomainRefusalCode } from '../../domain/shared/domain-refusal.ts';
import { CampaignRuleRefusal } from '../shared/campaign-rule-refusal.ts';
import { CanonicalPersonnelMapper } from '../persistence/canonical-personnel-mapper.ts';
import { Money } from '../../domain/finance/money.ts';
import { GameTime, TimeUnits } from '../../domain/shared/game-time.ts';
import { contractQuote } from '../../contracts.js';
import { fundServiceGuarantee } from '../../service-guarantees.js';
import { issueStartingCartridges } from '../../campaign-ammunition.js';
import { issueInitialOutfit } from '../../outfits.ts';
import { CampaignCharacterEquipmentMapper } from './campaign-character-equipment-mapper.ts';

export const RecruitmentEquipmentSource = Object.freeze({
  InitialIssue: 'initial-issue',
  ResidentInventory: 'resident-inventory',
});

export class CampaignRecruitmentMapper {
  #transaction;

  constructor(transaction) {
    this.#transaction = transaction;
  }

  restore(candidate, term, allowedLocations) {
    const campaign = this.#transaction.draft;
    const quote = contractQuote(campaign, candidate, term);
    if (!quote.available) {
      throw new CampaignRuleRefusal(DomainRefusalCode.ServiceTermsUnavailable, quote.reason);
    }
    const personnel = new CanonicalPersonnelMapper(campaign, this.#transaction.identities);
    const character = personnel.restoreCharacter(candidate);
    const { roster, treasury } = personnel;
    return {
      character,
      roster,
      treasury,
      allowedLocations: [...allowedLocations],
      now: GameTime.fromCampaignClock(campaign.hour, campaign.secondOfHour ?? 0),
      terms: {
        term,
        durationSeconds: quote.permanent ? null : quote.hours * TimeUnits.secondsPerHour,
        payment: Money.pesos(quote.price),
        guarantee: Money.pesos(quote.guarantee),
      },
    };
  }

  apply(candidate, context, outcome, equipmentSource) {
    const campaign = this.#transaction.draft;
    const contract = outcome.contract;
    const guarantee = fundServiceGuarantee(campaign, candidate, context.terms.guarantee.pesos);
    campaign.resources.treasury = context.treasury.balance.pesos;
    campaign.contracts[candidate.id] = {
      ...guarantee,
      kind: contract.permanent ? 'patriot' : 'paid',
      term: contract.term,
      started: contract.startedAt.hour,
      ...(contract.startedAt.secondOfHour
        ? { startedSecond: contract.startedAt.secondOfHour }
        : {}),
      expiresAt: contract.expiresAt?.hour ?? null,
      ...(contract.expiresAt?.secondOfHour
        ? { expiresSecond: contract.expiresAt.secondOfHour }
        : {}),
      paid: contract.payment.pesos,
    };
    campaign.recruited = context.roster.members.map(Number);
    campaign.squad = context.roster.squadMembers.map(Number);
    if (equipmentSource === RecruitmentEquipmentSource.InitialIssue) {
      const equippedCandidate = new CampaignCharacterEquipmentMapper(campaign).project(candidate);
      issueStartingCartridges(campaign, equippedCandidate);
      issueInitialOutfit(campaign, candidate.id);
    } else if (equipmentSource === RecruitmentEquipmentSource.ResidentInventory) {
      campaign.operativeState[candidate.id].startingCartridgesIssued = true;
    } else {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    Object.assign(campaign.operativeState[candidate.id], {
      location: outcome.locationId,
      arrival: null,
      residentSector: null,
      residentScene: null,
    });
    delete campaign.operativeState[candidate.id].residentPosition;
  }
}
