// Period AP tuning: preserve existing first-shot totals and separate the work
// of bringing the held firearm into firing position from its discharge.
export const WEAPON_READY_AP = Object.freeze({1800:6,1801:6,1802:8,1803:4,1804:4,1805:2,1806:2,1807:6,1808:2});
// v1.13 allows small standing/crouched turns with a raised gun. Larger
// turns and every prone turn require raising it again. turnAP uses the
// existing 2 AP (standing/crouched), 4 AP (prone) per compass step.
export const turnLowersWeapon = (unit, turnAP) => turnAP > 0 &&
  (unit.stance === 'prone' || turnAP / 2 > (unit.stance === 'crouched' ? 1 : 3));
export function firearmPreparation(unit, weapon, firstShotAP, turnAP = 0) {
  const raise = Math.min(Math.max(0, firstShotAP - 1), weapon.readyAP ?? WEAPON_READY_AP[weapon.id] ?? 0);
  const discharge = firstShotAP - raise;
  const ready = unit.weaponReady && !turnLowersWeapon(unit, turnAP) ? 0 : raise;
  // Raising and turning overlap above ground; prone work is sequential.
  const setup = unit.stance === 'prone' ? turnAP + ready : Math.max(turnAP, ready);
  return {raise: ready, turn: turnAP, setup, discharge, total: discharge + setup};
}
export function lowerWeapon(unit) { delete unit.weaponReady; }
export function validateWeaponReadiness(unit, firearm) {
  if (unit.weaponReady === undefined) return;
  if (typeof unit.weaponReady !== 'boolean' || unit.weaponReady && (!firearm || unit.weaponDropped ||
      (unit.activeSlot ?? 'primary') !== 'primary' || unit.hp < 15 || unit.energy <= 0 || unit.unconscious ||
      unit.knockedDown || unit.routed || unit.surrendered || unit.departure)) throw Error('La posición de tiro del arma no es válida.');
}
// Free cursor/stealth/overwatch changes do not prepare or lower a weapon.
// A paid look can retain a raised weapon while standing or crouching.
export const lowersWeapon = type => !['fire','firePoint','look','overwatch','stealth'].includes(type);
