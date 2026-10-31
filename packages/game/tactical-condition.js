import { hasPoncho } from './outfits.ts';
import { lowerWeapon } from './weapon-readiness.js';
import { COMBAT_BALANCE } from './combat-balance.js';
import {
  ActionPointPolicy,
  ActionPoints,
  ActionPointRules,
} from './domain/combat/action-points.ts';
import {
  participantOf,
  writeParticipant,
} from './infrastructure/sector-sessions/sector-session-mapper.js';
const actionPointPolicy = new ActionPointPolicy({
  woundMaximumPenalty: COMBAT_BALANCE.woundAPMaximumPenalty,
  energyPenaltyPerPoint: COMBAT_BALANCE.energyAPPenaltyPerPoint,
});
// JA2-inspired condition rules on Granaderos' existing 100-point AP scale.
export const AP_CARRY_LIMIT = ActionPointRules.CarryLimit;
export const CRITICAL_HEALTH = ActionPointRules.CriticalHealth;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
export const isUnconscious = (u) => u.hp > 0 && (u.hp < CRITICAL_HEALTH || (u.energy ?? 100) <= 0);
export function effectiveWounds(u) {
  const wounds = Math.max(0, (u.maxHp ?? 100) - u.hp);
  const bandaged = clamp(u.bandaged ?? (u.bleeding ? 0 : wounds), 0, wounds);
  return wounds - bandaged / 2;
}
export function maxActionPoints(state, unit) {
  const wounds = Math.max(0, (unit.maxHp ?? 100) - unit.hp);
  return actionPointPolicy.maximum(
    {
      health: unit.hp,
      maximumHealth: unit.maxHp ?? 100,
      bandagedWounds: unit.bandaged ?? (unit.bleeding ? 0 : wounds),
      energy: unit.energy ?? 100,
      fatigue: unit.fatigue ?? 0,
      agility: unit.agility ?? 75,
      dexterity: unit.dexterity ?? 75,
      experienceLevel: unit.experienceLevel ?? 4,
      departed: Boolean(unit.departure),
      surrendered: Boolean(unit.surrendered),
      routed: Boolean(unit.routed),
      adaptedToFatigue: (unit.traits ?? []).includes('guerrilla_tactician'),
      protectedFromWeather: hasPoncho(unit),
    },
    {
      highAltitude:
        state.altitude >= ActionPointRules.HighAltitudeMetres || state.biome === 'mountain',
      raining: state.weather?.rain > 0,
    },
  );
}
// A forecast for the unit's NEXT turn; carryover is taken after any reactions.
export function actionPointBudget(s, u) {
  const base = maxActionPoints(s, u);
  const carryover = base
    ? ActionPoints.of(Math.max(0, Math.floor(u.ap ?? 0))).carryToNextTurn()
    : 0;
  return { base, carryover, total: base + carryover };
}
export const STANCES = ['standing', 'crouched', 'prone'];
export function stanceCost(u, stance) {
  if (!STANCES.includes(stance)) {
    return 0;
  }
  if (u.knockedDown && stance === 'standing') {
    return 12;
  }
  return Math.abs(STANCES.indexOf(u.stance ?? 'standing') - STANCES.indexOf(stance)) * 3;
}
/** @param {import('./public/compatibility-types.ts').MovementMode} mode
 * @returns {import('./public/compatibility-types.ts').BattleStance} */
export const movementStance = (mode) =>
  mode === 'prone' ? 'prone' : mode === 'crouch' ? 'crouched' : 'standing';
export function refreshCondition(u) {
  u.bandaged = clamp(u.bandaged ?? 0, 0, Math.max(0, u.maxHp - u.hp));
  u.unconscious = isUnconscious(u);
  if (u.hp <= 0 || u.unconscious || u.knockedDown) {
    lowerWeapon(u);
  }
  if (u.hp <= 0 || u.unconscious) {
    const participant = participantOf(u);
    participant.becomeUnableToAct();
    writeParticipant(u, participant);
    u.overwatch = false;
    u.mounted = false;
    u.braced = false;
  }
  if (u.hp <= 0) {
    u.bleeding = 0;
  }
}
