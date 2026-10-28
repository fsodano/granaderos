import { Character } from './character.ts';
import { ServiceContract } from './service-contract.ts';
import { Money } from '../finance/money.ts';
import { Treasury } from '../finance/treasury.ts';
import { GameTime } from '../shared/game-time.ts';
import { DomainRefusal, DomainRefusalCode } from '../shared/domain-refusal.ts';

export type ServiceRenewalContext = Readonly<{
  character: Character;
  treasury: Treasury;
  now: GameTime;
  term: string;
  durationSeconds: number;
  payment: Money;
}>;

export class ServiceRenewalService {
  renew(context: ServiceRenewalContext): ServiceContract {
    const current = context.character.service;
    if (!current) throw new DomainRefusal(DomainRefusalCode.NotServing);
    if (!context.character.health.alive)
      throw new DomainRefusal(DomainRefusalCode.CharacterUnavailable);
    if (!context.treasury.canPay(context.payment))
      throw new DomainRefusal(DomainRefusalCode.InsufficientFunds);
    const renewed = current.renew(
      context.now,
      context.term,
      context.durationSeconds,
      context.payment,
    );
    context.character.renewService(renewed);
    context.treasury.pay(context.payment);
    return renewed;
  }
}
