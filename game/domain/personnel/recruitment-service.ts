import { Character } from './character.ts';
import { ForceRoster } from './force-roster.ts';
import type { RecruitmentAssignmentValue } from './force-roster.ts';
import { ServiceContract } from './service-contract.ts';
import { Treasury } from '../finance/treasury.ts';
import { Money } from '../finance/money.ts';
import { GameTime } from '../shared/game-time.ts';
import { DomainRefusal, DomainRefusalCode } from '../shared/domain-refusal.ts';

export type RecruitmentTerms = Readonly<{
  term: string;
  durationSeconds: number | null;
  payment: Money;
  guarantee: Money;
}>;

export type RecruitmentContext = Readonly<{
  character: Character;
  roster: ForceRoster;
  treasury: Treasury;
  now: GameTime;
  terms: RecruitmentTerms;
  allowedLocations: readonly string[];
}>;

export type RecruitmentOutcome = Readonly<{
  characterId: string;
  locationId: string;
  assignment: RecruitmentAssignmentValue;
  contract: ServiceContract;
  paid: Money;
}>;

export class RecruitmentService {
  recruit(context: RecruitmentContext, locationId: string): RecruitmentOutcome {
    context.character.assertAvailableForService();
    context.roster.assertCanAdmit(context.character.id);
    if (!context.allowedLocations.includes(locationId)) {
      throw new DomainRefusal(DomainRefusalCode.InvalidPlacement);
    }
    const total = context.terms.payment.plus(context.terms.guarantee);
    if (!context.treasury.canPay(total))
      throw new DomainRefusal(DomainRefusalCode.InsufficientFunds);
    const contract = ServiceContract.start(
      context.character.id,
      context.terms.term,
      context.now,
      context.terms.durationSeconds,
      context.terms.payment,
    );
    context.character.beginService(contract, locationId);
    const assignment = context.roster.admit(context.character.id, locationId);
    context.treasury.pay(total);
    return { characterId: context.character.id, locationId, assignment, contract, paid: total };
  }
}
