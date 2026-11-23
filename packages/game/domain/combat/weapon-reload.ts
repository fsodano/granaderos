import { COMBAT_BALANCE } from './combat-balance.ts';
import { ReloadWork, ReloadRules } from './reload-work.ts';
import type { ReloadPlan } from './reload-work.ts';

export type ReloadWeapon = Readonly<{
  reloadAP: number;
  capacity: number;
}>;

// A combatant as the reload rules read it: the stance sets how much work a
// round takes, and the traits may carry the gunsmith training.
export type ReloadCombatant = Readonly<{
  stance?: 'standing' | 'crouched' | 'prone';
  traits?: readonly string[];
}>;

export type ReloadWorkCombatant = ReloadCombatant &
  Readonly<{
    loaded: number;
    ammo: number;
    reloadProgress?: number;
    ap?: number;
  }>;

// A round costs the weapon's reload work spread over its capacity; prone work
// is slower, while an assistant or the gunsmith training speeds it up.
export function reloadRoundCost(
  unit: ReloadCombatant,
  weapon: ReloadWeapon,
  assisted = false,
): number {
  return (
    ((weapon.reloadAP * COMBAT_BALANCE.reloadAPMultiplier) / weapon.capacity) *
    (unit.stance === 'prone' ? ReloadRules.ProneMultiplier : 1) *
    (assisted ? ReloadRules.AssistedMultiplier : 1) *
    (unit.traits?.includes('gunsmith_artillerist') ? ReloadRules.TrainedMultiplier : 1)
  );
}

// A stored progress is a fraction of one round, so it must stay inside the
// open range and cannot exist for a weapon that is full or no longer held.
export function validateReloadProgress(
  value: unknown,
  capacity: number,
  loaded = 0,
  dropped = false,
): void {
  if (value === undefined) {
    return;
  }
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value >= 1 ||
    !(capacity > loaded) ||
    dropped
  ) {
    throw Error('El avance de recarga no es válido.');
  }
}

export function planReload(
  unit: ReloadWorkCombatant,
  roundCost: number,
  capacity: number,
  exploring = false,
): ReloadPlan {
  const work =
    capacity > 0 && roundCost > 0
      ? {
          loaded: unit.loaded,
          reserve: unit.ammo,
          capacity,
          progress: unit.reloadProgress ?? 0,
          roundCost,
        }
      : { loaded: 0, reserve: 0, capacity: 0, roundCost: 0 };
  return new ReloadWork(work).plan(exploring ? Infinity : Math.max(0, unit.ap ?? 0));
}
