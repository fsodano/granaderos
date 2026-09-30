import {hasPoncho} from './outfits.js';
import {lowerWeapon} from './weapon-readiness.js';
// JA2-inspired condition rules on Granaderos' existing 100-point AP scale.
export const AP_CARRY_LIMIT = 20;
export const CRITICAL_HEALTH = 15;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
export const isUnconscious = u => u.hp > 0 && (u.hp < CRITICAL_HEALTH || (u.energy ?? 100) <= 0);
export function effectiveWounds(u) {
  const wounds = Math.max(0, (u.maxHp ?? 100) - u.hp);
  const bandaged = clamp(u.bandaged ?? (u.bleeding ? 0 : wounds), 0, wounds);
  return wounds - bandaged / 2;
}
export function maxActionPoints(s, u) {
  if (u.hp <= 0 || u.departure || u.surrendered || u.routed || isUnconscious(u)) return 0;
  const traits = u.traits ?? [];
  const stats = clamp(Math.round(4 * (5 + (u.maxHp ?? 100) / 20 + (u.agility ?? 75) / 10 + (u.dexterity ?? 75) / 20 + (u.experienceLevel ?? 4))), 40, 100);
  const high = s.altitude >= 2500 || s.biome === 'mountain';
  const injury = effectiveWounds(u) / (u.maxHp ?? 100) * 50;
  const breath = (100 - (u.energy ?? 100)) * .25;
  const fatigue = (u.fatigue ?? 0) * (traits.includes('guerrilla_tactician') ? .25 : .4);
  return Math.round(clamp(stats - injury - breath - fatigue - (high ? 15 : 0) - ((high || s.weather?.rain > 0) && !hasPoncho(u) ? 10 : 0), 15, 100));
}
// A forecast for the unit's NEXT turn; carryover is taken after any reactions.
export function actionPointBudget(s, u) {
  const base = maxActionPoints(s, u);
  const carryover = base ? clamp(Math.floor(u.ap ?? 0), 0, AP_CARRY_LIMIT) : 0;
  return {base, carryover, total: base + carryover};
}
export const STANCES = ['standing', 'crouched', 'prone'];
export function stanceCost(u, stance) {
  if (!STANCES.includes(stance)) return 0;
  if (u.knockedDown && stance === 'standing') return 12;
  return Math.abs(STANCES.indexOf(u.stance ?? 'standing') - STANCES.indexOf(stance)) * 3;
}
export const movementStance = mode => mode === 'prone' ? 'prone' : mode === 'crouch' ? 'crouched' : 'standing';
export function refreshCondition(u) {
  u.bandaged = clamp(u.bandaged ?? 0, 0, Math.max(0, u.maxHp - u.hp));
  u.unconscious = isUnconscious(u);
  if (u.hp <= 0 || u.unconscious || u.knockedDown) lowerWeapon(u);
  if (u.hp <= 0 || u.unconscious) {
    u.ap = 0;
    u.maxAP = 0;
    u.overwatch = false;
    u.mounted = false;
    u.braced = false;
  }
  if (u.hp <= 0) u.bleeding = 0;
}
