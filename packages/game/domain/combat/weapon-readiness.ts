import { HealthRules } from '../personnel/health.ts';

export type WeaponStance = 'standing' | 'crouched' | 'prone';

export type WeaponReadyCombatant = {
  stance?: WeaponStance;
  weaponReady?: boolean;
  weaponDropped?: boolean;
  activeSlot?: string | null;
  hp: number;
  energy?: number;
  unconscious?: boolean;
  knockedDown?: boolean;
  routed?: boolean;
  surrendered?: boolean;
  departure?: unknown;
};

export type WeaponReadyCost = Readonly<{ id: string | number; readyAP?: number }>;

export type FirearmPreparation = Readonly<{
  ready: number;
  raise: number;
  turn: number;
  setup: number;
  discharge: number;
  total: number;
}>;

// Period AP tuning: preserve existing first-shot totals and separate the work
// of bringing the held firearm into firing position from its discharge.
export const WEAPON_READY_AP: Readonly<Record<string, number>> = Object.freeze({
  1800: 6,
  1801: 6,
  1802: 8,
  1803: 4,
  1804: 4,
  1805: 2,
  1806: 2,
  1807: 6,
  1808: 2,
});

// v1.13 allows small standing/crouched turns with a raised gun. Larger
// turns and every prone turn require raising it again. turnAP uses the
// existing 2 AP (standing/crouched), 4 AP (prone) per compass step.
export const turnLowersWeapon = (
  unit: Pick<WeaponReadyCombatant, 'stance'>,
  turnAP: number,
): boolean =>
  turnAP > 0 && (unit.stance === 'prone' || turnAP / 2 > (unit.stance === 'crouched' ? 1 : 3));

export function firearmPreparation(
  unit: Pick<WeaponReadyCombatant, 'stance' | 'weaponReady'>,
  weapon: WeaponReadyCost,
  firstShotAP: number,
  turnAP = 0,
): FirearmPreparation {
  const raiseCost = weapon.readyAP ?? WEAPON_READY_AP[weapon.id] ?? 0;
  const raise = Math.min(Math.max(0, firstShotAP - 1), raiseCost);
  const discharge = firstShotAP - raise;
  const ready = unit.weaponReady && !turnLowersWeapon(unit, turnAP) ? 0 : raise;
  // Raising and turning overlap above ground; prone work is sequential.
  const setup = unit.stance === 'prone' ? turnAP + ready : Math.max(turnAP, ready);
  return { ready, raise: ready, turn: turnAP, setup, discharge, total: discharge + setup };
}

export function lowerWeapon(unit: Pick<WeaponReadyCombatant, 'weaponReady'>): void {
  delete unit.weaponReady;
}

export function validateWeaponReadiness(unit: WeaponReadyCombatant, hasFirearm: boolean): void {
  if (unit.weaponReady === undefined) {
    return;
  }
  if (
    typeof unit.weaponReady !== 'boolean' ||
    (unit.weaponReady &&
      (!hasFirearm ||
        unit.weaponDropped ||
        (unit.activeSlot ?? 'primary') !== 'primary' ||
        unit.hp < HealthRules.CriticalHealth ||
        (unit.energy ?? 100) <= 0 ||
        unit.unconscious ||
        unit.knockedDown ||
        unit.routed ||
        unit.surrendered ||
        unit.departure))
  ) {
    throw Error('La posición de tiro del arma no es válida.');
  }
}

// Free cursor/stealth/overwatch changes do not prepare or lower a weapon.
// A paid look can retain a raised weapon while standing or crouching.
export const lowersWeapon = (type: string): boolean =>
  !['fire', 'firePoint', 'look', 'overwatch', 'stealth'].includes(type);
