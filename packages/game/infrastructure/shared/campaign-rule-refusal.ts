import { DomainRefusal } from '../../domain/shared/domain-refusal.ts';
import type { DomainRefusalCodeValue } from '../../domain/shared/domain-refusal.ts';

export class CampaignRuleRefusal extends DomainRefusal {
  readonly #playerMessage: string;

  constructor(code: DomainRefusalCodeValue, playerMessage: string) {
    super(code);
    this.name = 'CampaignRuleRefusal';
    this.#playerMessage = playerMessage;
  }

  messageForPlayer(): string {
    return this.#playerMessage;
  }
}
