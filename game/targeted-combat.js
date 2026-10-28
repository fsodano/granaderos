import { isUnconscious } from './tactical-condition.js';
import { BodyRegion, BodyRegionId } from './domain/combat/body-region.ts';
export const HIT_LOCATIONS = Object.freeze(Object.values(BodyRegionId));
const labels = Object.freeze({ torso: 'Torso', head: 'Cabeza', legs: 'Piernas' });
export const canChooseShotLocation = (target) =>
  Boolean(
    target &&
    !(target.hp <= 0) &&
    !isUnconscious(target) &&
    !target.unconscious &&
    !target.knockedDown &&
    target.stance !== 'prone',
  );
export const shotLocationsFor = (target) =>
  canChooseShotLocation(target) ? HIT_LOCATIONS : [BodyRegionId.Torso];
export function getHitLocationProfile(location = BodyRegionId.Torso) {
  return { ...BodyRegion.named(location).profile(), label: labels[location] };
}
export function shotLocationPenalty(location, range) {
  return BodyRegion.named(location).aimingPenalty(range);
}
export function shotLocationEffects(location, baseDamage, target = {}) {
  return BodyRegion.named(location).impact(baseDamage, {
    health: target.hp,
    stance: target.stance,
    mounted: target.mounted,
  });
}
