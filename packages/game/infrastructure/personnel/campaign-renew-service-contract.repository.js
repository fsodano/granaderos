import { CampaignRuleRefusal } from '../shared/campaign-rule-refusal.ts';
import { CanonicalPersonnelMapper } from '../persistence/canonical-personnel-mapper.ts';
import { Money } from '../../domain/finance/money.ts';
import { GameTime, TimeUnits } from '../../domain/shared/game-time.ts';
import { DomainRefusal, DomainRefusalCode } from '../../domain/shared/domain-refusal.ts';
import { rosterFor } from '../../recruitment.ts';
import { contractRenewalQuote, contractExpiresSeconds } from '../../contracts.js';

export class CampaignRenewServiceContractRepository {
  #transaction;
  #personnel;
  #context = null;
  #closed = false;

  constructor(transaction) {
    this.#transaction = transaction;
    this.#personnel = new CanonicalPersonnelMapper(transaction.draft, transaction.identities);
  }

  load(request) {
    if (this.#closed || this.#context) {
      throw new DomainRefusal(DomainRefusalCode.TransactionClosed);
    }
    const campaign = this.#transaction.draft;
    const id = Number(request.characterId);
    const candidate = rosterFor(campaign).find((character) => character.id === id);
    const record = campaign.contracts[id];
    if (!candidate || !record || !campaign.recruited.includes(id)) {
      throw new DomainRefusal(DomainRefusalCode.NotServing);
    }
    if (
      (request.expectedExpiresAtSeconds !== undefined &&
        request.expectedExpiresAtSeconds !== contractExpiresSeconds(record)) ||
      (request.expectedGuaranteeId !== undefined &&
        request.expectedGuaranteeId !== record.guaranteeId)
    ) {
      throw new DomainRefusal(DomainRefusalCode.ContractChanged);
    }
    const quote = contractRenewalQuote(campaign, candidate, request.term);
    if (!quote.available) {
      throw new CampaignRuleRefusal(DomainRefusalCode.ServiceTermsUnavailable, quote.reason);
    }
    this.#context = {
      character: this.#personnel.restoreCharacter(candidate),
      treasury: this.#personnel.treasury,
      now: GameTime.fromCampaignClock(campaign.hour, campaign.secondOfHour ?? 0),
      term: request.term,
      durationSeconds: quote.hours * TimeUnits.secondsPerHour,
      payment: Money.pesos(quote.price),
    };
    return this.#context;
  }

  commit(context, contract) {
    if (this.#closed || context !== this.#context || contract !== context.character.service) {
      throw new DomainRefusal(DomainRefusalCode.TransactionClosed);
    }
    this.#personnel.apply(this.#transaction.draft);
    this.#closed = true;
  }
}
