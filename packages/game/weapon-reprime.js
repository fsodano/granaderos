import { ReprimeWork, ReprimeRules } from './domain/combat/reprime-work.ts';
import { formatAP } from './action-points.js';
import { secondHeldPistol } from './paired-fire.js';
import { firearmServiceable, BROKEN_FIREARM_REASON } from './firearm-serviceability.js';

export const reprimeCost = (unit) =>
  unit.traits?.includes('gunsmith_artillerist')
    ? ReprimeRules.TrainedCost
    : ReprimeRules.NormalCost;

// Work belongs to the physically held guns. The ignition kit is implicit.
// Each pan costs one full action; a second gun never borrows future AP.
export function planReprime(unit, { exploring = false, firearm = false } = {}) {
  const cost = reprimeCost(unit),
    other = firearm ? secondHeldPistol(unit) : null;
  const required = firearm
    ? [
        ...(unit.jammed && firearmServiceable(unit) ? ['primary'] : []),
        ...(other?.jammed && firearmServiceable(other) ? ['offhand'] : []),
      ]
    : [];
  const plan = new ReprimeWork(
    required,
    Boolean(unit.traits?.includes('gunsmith_artillerist')),
  ).plan(exploring ? Infinity : (unit.ap ?? 0));
  const { hands } = plan;
  const count = hands.length;
  const reason = !firearm
    ? 'Prepará un arma de fuego en la mano.'
    : !required.length
      ? !firearmServiceable(unit)
        ? BROKEN_FIREARM_REASON
        : 'El arma no necesita cebado.'
      : !count
        ? `Cebar requiere ${formatAP(cost)} PA.`
        : '';
  return { ...plan, reason };
}

export function reprimeLabel(plan) {
  return plan.hands.length === 2
    ? 'Cebar ambas pistolas'
    : plan.hands[0] === 'offhand'
      ? 'Cebar segunda mano'
      : 'Cebar';
}
