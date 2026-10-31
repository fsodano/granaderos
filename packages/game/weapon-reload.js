import { COMBAT_BALANCE } from './combat-balance.js';
import { ReloadWork, ReloadRules } from './domain/combat/reload-work.ts';
export function reloadRoundCost(unit, weapon, assisted = false) {
  return (
    ((weapon.reloadAP * COMBAT_BALANCE.reloadAPMultiplier) / weapon.capacity) *
    (unit.stance === 'prone' ? ReloadRules.ProneMultiplier : 1) *
    (assisted ? ReloadRules.AssistedMultiplier : 1) *
    (unit.traits?.includes('gunsmith_artillerist') ? ReloadRules.TrainedMultiplier : 1)
  );
}
export function validateReloadProgress(value, capacity, loaded = 0, dropped = false) {
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
export function planReload(unit, roundCost, capacity, exploring = false) {
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
