import type { BattleSnapshot, BattleUnit, TacticalAction } from '../packages/game/public/compatibility-types.ts';
import { northernClinicDefenseOrder } from './northern-route.ts';
import { firearmShotOptions, teamCanSee, hasLineOfSight, actionCosts } from '../packages/game/tactical.js';
import { knownRouteShotSafety } from './route-fire-safety.ts';
// A guarded roof can have a valid low-probability lane while the ordinary
// infantry policy wants to advance. Pay for the real previewed shot first.
export function northernHospitalCoverOrder(
  battle: BattleSnapshot,
  unit: BattleUnit,
  { shotSafety = knownRouteShotSafety }: { shotSafety?: typeof knownRouteShotSafety } = {},
): TacticalAction | null {
  const action = northernClinicDefenseOrder(battle, unit);
  if (
    (action && action.type !== 'fire') ||
    unit.knockedDown ||
    unit.entangled ||
    unit.routed ||
    unit.unconscious ||
    unit.hp < 15 ||
    !unit.loaded ||
    unit.jammed ||
    !['primary', 'secondary'].includes(unit.activeSlot)
  ) {
    return action;
  }
  if (action?.type === 'fire') {
    const target = battle.units.find((target) => target.id === action.targetId),
      option =
        target &&
        firearmShotOptions(battle, unit, target, action.aim ?? 0).find(
          (option) =>
            option.aim === (action.aim ?? 0) &&
            option.hitLocation === (action.hitLocation ?? 'torso'),
        );
    if (target && shotSafety(battle, unit, target)(option)) {
      return action;
    }
  }
  const shots: { score: number; action: TacticalAction }[] = [];
  for (const target of battle.units.filter(
    (target) =>
      target.side === 'enemy' &&
      target.hp >= 15 &&
      !target.departure &&
      !target.unconscious &&
      !target.routed &&
      !target.surrendered &&
      teamCanSee(battle, unit.side, target) &&
      hasLineOfSight(battle, unit, target),
  )) {
    const cost = actionCosts(battle, unit, target);
    if (unit.ap < cost.fire) {
      continue;
    }
    const safe = shotSafety(battle, unit, target);
    for (const option of firearmShotOptions(
      battle,
      unit,
      target,
      Math.min(4, Math.floor((unit.ap - cost.fire) / cost.aim)),
    )) {
      if (option.chance >= 5 && option.damageFactor > 0 && safe(option)) {
        shots.push({
          score: option.chance * option.damageFactor,
          action: {
            type: 'fire',
            unitId: unit.id,
            targetId: target.id,
            aim: option.aim,
            hitLocation: option.hitLocation,
          },
        });
      }
    }
  }
  return shots.sort((a, b) => b.score - a.score)[0]?.action ?? null;
}

