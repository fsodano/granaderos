import type { SleepSubject } from './sleep-needs.ts';
import type { CampaignContext } from './public/compatibility-types.ts';
export interface RestingCharacter extends SleepSubject {
  hp: number;
  bleeding?: number;
  bandaged?: number;
  recoveryHours?: number;
  energy?: number;
  fatigue?: number;
  sleepCollapsed?: boolean;
}
type RestOptions = { heal?: boolean; state?: CampaignContext; recover?: boolean };
import { sleepNeed } from './sleep-needs.ts';
import { recoverFatigue } from './fatigue.js';
import { careRules, DEFAULT_CARE_RULES } from './campaign-care-rules.js';
// Explicit strategic rest. Automatic sleep and the global fatigue/energy-capacity
// model are separate integrations; the existing daily recovery is unchanged.
export const REST_HEALING_HOURS = DEFAULT_CARE_RULES.restHealingHours;
export function restRecovery(op: SleepSubject, record: SleepSubject, state?: CampaignContext) {
  const { hours } = sleepNeed({ ...op, ...record });
  return {
    hours,
    energy: Math.floor((careRules(state).restEnergy * 8) / hours),
    fatigue: Math.floor((careRules(state).restFatigue * 8) / hours),
  };
}
export function recoverAtRest(
  record: RestingCharacter,
  op: SleepSubject & { maxHp: number },
  { heal = false, state, recover = true }: RestOptions = {},
) {
  const rate = restRecovery(op, record, state),
    maxHp = record.maxHp ?? op.maxHp;
  if (recover) {
    recoverFatigue(record, rate.fatigue, rate.energy);
  }
  if (heal && !record.bleeding && record.hp >= 15 && record.hp < maxHp) {
    record.recoveryHours = (record.recoveryHours ?? 0) + 1;
    if (record.recoveryHours >= careRules(state).restHealingHours) {
      record.hp++;
      record.recoveryHours = 0;
      if (record.bandaged !== undefined) {
        record.bandaged = Math.min(record.bandaged, maxHp - record.hp);
      }
    }
  } else if (record.recoveryHours !== undefined || heal) {
    record.recoveryHours = 0;
  }
}
