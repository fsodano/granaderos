// JA2 separates unarmed injury from loss of breath (Patusco pp. 27–29, 64–66).
// These values adapt that choice to Granaderos' 100-point breath/AP scale.
export const FISTS = Object.freeze({ id: 0, name: 'Puños', ap: 12, damage: 6, reach: 1.5 });
export const BUTTSTOCK = Object.freeze({ id: -1, name: 'Culata', ap: 16, damage: 18, reach: 1.5 });
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export function unarmedChance(attacker, target, { aware = true } = {}) {
  if (target.unconscious) {
    return 95;
  }
  const attack =
    (attacker.dexterity ?? 50) * 0.45 +
    (attacker.agility ?? 50) * 0.25 +
    (attacker.strength ?? 50) * 0.3;
  const defense = (target.agility ?? 50) * 0.6 + (target.dexterity ?? 50) * 0.4;
  return Math.round(
    clamp(
      60 +
        (attack - defense) * 0.6 +
        ((attacker.experienceLevel ?? 4) - (target.experienceLevel ?? 4)) * 3 +
        (aware ? 0 : 20) -
        (100 - (attacker.energy ?? 100)) * 0.2 +
        (100 - (target.energy ?? 100)) * 0.1,
      5,
      95,
    ),
  );
}
export function unarmedImpact(attacker) {
  const strength = clamp(attacker.strength ?? 50, 0, 100),
    energy = clamp(attacker.energy ?? 100, 0, 100);
  return {
    damage: Math.max(1, Math.round((2 + strength * 0.06) * (0.5 + energy / 200))),
    breathLoss: Math.round((12 + strength * 0.28) * (0.5 + energy / 200)),
  };
}

// A contested grab, not an injury roll. The chance is not exposed as an exact
// HUD percentage because the defender's breath and attributes are private.
export const STEAL_MIN_AP = 28;
export function weaponStealChance(attacker, target, { aware = true } = {}) {
  const attack =
    (attacker.strength ?? 50) * 0.4 +
    (attacker.dexterity ?? 50) * 0.4 +
    (attacker.agility ?? 50) * 0.2;
  const defense =
    (target.strength ?? 50) * 0.5 + (target.dexterity ?? 50) * 0.3 + (target.agility ?? 50) * 0.2;
  return Math.round(
    clamp(
      50 +
        (attack - defense) * 0.6 +
        ((attacker.experienceLevel ?? 4) - (target.experienceLevel ?? 4)) * 3 +
        (aware ? 0 : 15) -
        (100 - (attacker.energy ?? 100)) * 0.25 +
        (100 - (target.energy ?? 100)) * 0.2 +
        (target.knockedDown ? 15 : 0),
      5,
      95,
    ),
  );
}
