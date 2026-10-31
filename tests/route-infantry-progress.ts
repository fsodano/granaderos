export type RouteRifleShot={type:'fire';unitId:string;targetId:string;aim:number;hitLocation:string};
import type { BattleSnapshot, BattleUnit } from '../packages/game/public/compatibility-types.ts';
import type { TacticalOrder } from '../packages/game/public/hud-types.ts';
type ShotOptions = { shotSafety?: typeof knownRouteShotSafety };
import {
  teamCanSee,
  hasLineOfSight,
  hasFirearm,
  actionCosts,
  knownArtillery,
  stanceCost,
  firearmShotOptions,
} from '../packages/game/tactical.js';
import { firearmServiceable } from '../packages/game/firearm-serviceability.js';
import { knownRouteShotSafety } from './route-fire-safety.ts';

const fit = (unit: BattleUnit) =>
  unit.hp >= 15 &&
  !unit.departure &&
  !unit.routed &&
  !unit.unconscious &&
  !unit.surrendered &&
  !unit.fled &&
  !unit.asleep;
const rifleReady = (unit: BattleUnit) =>
  fit(unit) &&
  (unit.activeSlot ?? 'primary') === 'primary' &&
  unit.loaded > 0 &&
  !unit.jammed &&
  !unit.weaponDropped &&
  hasFirearm(unit) &&
  firearmServiceable(unit);

// Shared opt-in route predicates. Keep the accepted coastal policy's native
// safety, 25-percent threshold and paid stance costs; no generic AI changes.
export const publicRouteView = (battle: BattleSnapshot, unit: BattleUnit): BattleSnapshot => ({
  ...battle,
  units: battle.units.filter(
    (other) => other.side === unit.side || teamCanSee(battle, unit.side, other),
  ),
  npcs: (battle.npcs ?? []).filter((other) => teamCanSee(battle, unit.side, other)),
  artillery: knownArtillery(battle, unit),
});

export function usefulRouteRifleShot(
  battle: BattleSnapshot,
  unit: BattleUnit,
  { shotSafety = knownRouteShotSafety }: ShotOptions = {},
) {
  if (!rifleReady(unit)) {
    return null;
  }
  const shots: {score:number;action:RouteRifleShot}[] = [];
  for (const target of battle.units.filter(
    (target) =>
      target.side !== unit.side &&
      fit(target) &&
      teamCanSee(battle, unit.side, target) &&
      hasLineOfSight(battle, unit, target),
  )) {
    const cost = actionCosts(battle, unit, target);
    if (unit.ap < cost.fire) {
      continue;
    }
    const aim = Math.min(4, Math.floor((unit.ap - cost.fire) / cost.aim)),
      safe = shotSafety(battle, unit, target);
    for (const option of firearmShotOptions(battle, unit, target, aim)) {
      if (option.chance >= 25 && option.damageFactor > 0 && safe(option)) {
        shots.push({
          score: option.chance * option.damageFactor - (cost.fire + option.aim * cost.aim) * 0.2,
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

export function usefulRouteFiringPosture(
  battle: BattleSnapshot,
  unit: BattleUnit,
  action: TacticalOrder | null | undefined,
  { shotSafety = knownRouteShotSafety }: ShotOptions = {},
) {
  if (
    action?.type !== 'stance' ||
    (action.stance !== 'crouched' && action.stance !== 'prone') ||
    !rifleReady(unit) ||
    unit.knockedDown ||
    unit.entangled ||
    unit.mounted
  ) {
    return true;
  }
  const paid = stanceCost(unit, action.stance),
    position: BattleUnit = {
      ...unit,
      stance: action.stance,
      movementMode: action.stance === 'prone' ? 'prone' : 'crouch',
      weaponReady: false,
      momentum: 0,
      ap: unit.ap - paid,
    };
  const view = publicRouteView(battle, unit),
    posed = {
      ...view,
      units: view.units.map((other) => (other.id === unit.id ? position : other)),
    };
  return (
    paid > 0 && position.ap > 0 && Boolean(usefulRouteRifleShot(posed, position, { shotSafety }))
  );
}
