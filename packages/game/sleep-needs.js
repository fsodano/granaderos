import { DEFAULT_CATALOGUE } from '../../content/campaigns/default.js';
import {
  sleepNeed as sleepNeedForProfiles,
  sleepRecovery as sleepRecoveryForProfiles,
} from './domain/personnel/sleep-need.ts';

// The profile hours stay authored balance data; the domain receives them and
// owns the rule, because domain code does not read campaign content.
export const SLEEP_PROFILES = Object.freeze({ ...DEFAULT_CATALOGUE.sleepProfiles });

/** @param {import('./domain/personnel/sleep-need.ts').SleepingCombatant} unit */
export const sleepNeed = (unit) => sleepNeedForProfiles(unit, SLEEP_PROFILES);

/** @param {import('./domain/personnel/sleep-need.ts').SleepingCombatant} unit */
export const sleepRecovery = (unit) => sleepRecoveryForProfiles(unit, SLEEP_PROFILES);
