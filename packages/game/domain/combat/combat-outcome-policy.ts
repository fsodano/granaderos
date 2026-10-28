import { HealthRules } from '../personnel/health.ts';
import { CombatOutcome } from './combat-session.ts';
import type { CombatOutcomeValue, CombatSide } from './combat-session.ts';
export type CombatPresence = Readonly<{
  side: CombatSide;
  health: number;
  departed: boolean;
  fled: boolean;
  surrendered: boolean;
}>;
export class CombatOutcomePolicy {
  evaluate(participants: readonly CombatPresence[]): CombatOutcomeValue {
    const capable = (side: CombatSide) =>
      participants.some(
        (participant) =>
          participant.side === side &&
          participant.health >= HealthRules.CriticalHealth &&
          !participant.departed &&
          !participant.fled &&
          !participant.surrendered,
      );
    if (!capable('player'))
      return participants.some(
        (participant) => participant.side === 'player' && participant.departed,
      )
        ? CombatOutcome.Retreat
        : CombatOutcome.Defeat;
    return capable('enemy') ? CombatOutcome.Active : CombatOutcome.Victory;
  }
}
