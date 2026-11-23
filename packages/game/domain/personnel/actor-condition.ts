import { lowerWeapon } from '../combat/weapon-readiness.ts';
import { HealthRules } from './health.ts';

export const CRITICAL_HEALTH = HealthRules.CriticalHealth;

export type ConditionCombatant = {
  hp: number;
  energy?: number;
  unconscious?: boolean;
  knockedDown?: boolean;
  routed?: boolean;
  weaponDropped?: boolean;
  departure?: unknown;
  fled?: boolean;
  surrendered?: boolean;
  ap?: number;
  maxAP?: number;
  mounted?: boolean;
  braced?: boolean;
  overwatch?: boolean;
  bleeding?: number;
  weaponReady?: boolean;
};

export const isUnconscious = (unit: Pick<ConditionCombatant, 'hp' | 'energy'>): boolean =>
  unit.hp > 0 && (unit.hp < CRITICAL_HEALTH || (unit.energy ?? 100) <= 0);

// Exhaustion can recover. Routed troops still occupy the field until they leave.
export const fieldCapable = (
  unit: Pick<ConditionCombatant, 'hp' | 'departure' | 'fled' | 'surrendered'>,
): boolean =>
  Boolean(unit.hp >= CRITICAL_HEALTH && !unit.departure && !unit.fled && !unit.surrendered);

export function refreshMilitaryCondition(unit: ConditionCombatant): ConditionCombatant {
  unit.unconscious = isUnconscious(unit);
  if (unit.hp <= 0 || unit.unconscious || unit.knockedDown || unit.routed || unit.weaponDropped) {
    lowerWeapon(unit);
  }
  if (unit.hp <= 0 || unit.unconscious) {
    unit.ap = 0;
    unit.maxAP = 0;
    unit.mounted = false;
    unit.braced = false;
    unit.overwatch = false;
  }
  if (unit.hp <= 0) {
    unit.bleeding = 0;
  }
  return unit;
}
