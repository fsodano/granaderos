import {isUnconscious} from './tactical-condition.js';
// Classic JA2 offers torso/head/leg shots with range-sensitive accuracy costs
// (Patusco's guide 1.3, p. 47). Damage, breath, and balance values below are
// explicit Granaderos tuning for period weapons, not claimed JA2 formulas.
export const HIT_LOCATIONS = Object.freeze(['torso', 'head', 'legs']);
export const canChooseShotLocation=target=>Boolean(target&&!(target.hp<=0)&&!isUnconscious(target)&&!target.unconscious&&!target.knockedDown&&target.stance!=='prone');
export const shotLocationsFor=target=>canChooseShotLocation(target)?HIT_LOCATIONS:['torso'];

const profiles = Object.freeze({
  torso: Object.freeze({id: 'torso', label: 'Torso', chancePenaltyPerTile: 0, damageMultiplier: 1, breathMultiplier: .5, balanceMultiplier: 0}),
  head: Object.freeze({id: 'head', label: 'Cabeza', chancePenaltyPerTile: 3, damageMultiplier: 1.5, breathMultiplier: .5, balanceMultiplier: 0}),
  legs: Object.freeze({id: 'legs', label: 'Piernas', chancePenaltyPerTile: 1, damageMultiplier: .65, breathMultiplier: 1.2, balanceMultiplier: .5}),
});

export function getHitLocationProfile(location = 'torso') {
  if (!Object.hasOwn(profiles, location)) throw new RangeError(`Unknown hit location: ${String(location)}`);
  return profiles[location];
}

function nonnegative(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be a finite nonnegative number.`);
  return value;
}

// Range is the caller's sight range in tiles. Return a positive deduction;
// the combat reducer owns chance clamping, visibility, and lighting rules.
export function shotLocationPenalty(location, range) {
  const profile = getHitLocationProfile(location);
  return Math.round(nonnegative(range, 'Range') * profile.chancePenaltyPerTile);
}

// Pure impact description. The caller applies HP, breath, and posture changes.
// Damage is the rounded impact before HP capping. Breath uses the actual HP
// loss when target.hp is supplied, preserving the existing torso/overkill rule.
// The caller clamps breath to the target's available energy.
export function shotLocationEffects(location, baseDamage, target = {}) {
  const profile = getHitLocationProfile(location);
  nonnegative(baseDamage, 'Damage');
  const hp = target.hp === undefined ? Infinity : nonnegative(target.hp, 'Target health');
  const damage = Math.round(baseDamage * profile.damageMultiplier);
  if (!Number.isFinite(damage)) throw new RangeError('Scaled damage must be finite.');
  const actualDamage = Math.min(hp, damage);
  const breathLoss = Math.ceil(actualDamage * profile.breathMultiplier);
  // Balance is separate from lethal injury. A sufficiently strong leg impact
  // can topple a surviving upright soldier, including one on horseback.
  const balanceLoss = actualDamage > 0 ? Math.round(baseDamage * profile.balanceMultiplier) : 0;
  const knockedDown = hp > damage && balanceLoss >= 20 && target.stance !== 'prone';
  return {damage, breathLoss, balanceLoss, knockedDown, unhorse: knockedDown && Boolean(target.mounted)};
}
