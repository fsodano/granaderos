// Unfinished loading is weapon work, measured as a fraction of one charge.
// No cartridge becomes loaded or leaves reserve until that charge is complete.
import {COMBAT_BALANCE} from './combat-balance.js';
export function reloadRoundCost(unit, weapon, assisted = false) {
  return weapon.reloadAP * COMBAT_BALANCE.reloadAPMultiplier / weapon.capacity * (unit.stance === 'prone' ? 1.5 : 1) *
    (assisted ? .8 : 1) * (unit.traits?.includes('gunsmith_artillerist') ? .85 : 1);
}
export function validateReloadProgress(value, capacity, loaded = 0, dropped = false) {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value >= 1 ||
      !(capacity > loaded) || dropped) throw Error('El avance de recarga no es válido.');
}

export function planReload(unit, roundCost, capacity, exploring = false) {
  const available = Math.max(0, Math.min(capacity - unit.loaded, unit.ammo));
  const progress = unit.reloadProgress ?? 0;
  if (!available || !(roundCost > 0)) return {pa: 0, totalPA: 0, rounds: 0, available: 0, progress, partial: false, remainingPA: 0};
  const totalPA = Math.ceil((available - progress) * roundCost - 1e-9);
  const pa = exploring ? totalPA : Math.min(totalPA, Math.max(0, unit.ap));
  const work = pa >= totalPA ? available : progress + pa / roundCost;
  const rounds = Math.min(available, Math.floor(work + 1e-9));
  const rest = rounds === available ? 0 : Math.max(0, work - rounds);
  return {pa, totalPA, rounds, available, progress: rest, partial: pa < totalPA,
    remainingPA: Math.ceil((available - rounds - rest) * roundCost - 1e-9)};
}
