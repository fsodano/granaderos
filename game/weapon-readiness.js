// The authored first-shot cost already includes raising the firearm. Keeping
// that position removes only this part from a later discharge, never the charge.
export function firearmPreparation(unit, weapon, firstShotAP) {
  const raise = Math.min(Math.max(0, firstShotAP - 1), weapon.readyAP ?? 0);
  const discharge = firstShotAP - raise;
  const ready = unit.weaponReady ? 0 : raise;
  return {ready, discharge, total: discharge + ready};
}
export function lowerWeapon(unit) { delete unit.weaponReady; }
export function validateWeaponReadiness(unit, firearm) {
  if (unit.weaponReady === undefined) return;
  if (typeof unit.weaponReady !== 'boolean' || unit.weaponReady && (!firearm || unit.weaponDropped ||
      (unit.activeSlot ?? 'primary') !== 'primary' || unit.hp < 15 || (unit.energy ?? 100) <= 0 ||
      unit.unconscious || unit.knockedDown || unit.routed || unit.surrendered || unit.departure))
    throw Error('La posición de tiro del arma no es válida.');
}
