import { isUnconscious } from '../personnel/actor-condition.ts';
import { BodyRegion, BodyRegionId } from './body-region.ts';
import type { BodyImpact, BodyRegionIdValue, BodyRegionProfile } from './body-region.ts';

// The rules of an aimed shot: whether a target may be aimed at a body region,
// which regions are offered, and how a region affects the shot and its injury.

export type ShotTarget = {
  hp?: number;
  energy?: number;
  unconscious?: boolean;
  knockedDown?: boolean;
  stance?: string;
  mounted?: boolean;
};

export type HitLocationProfile = Readonly<BodyRegionProfile & { label: string }>;

export const HIT_LOCATIONS: readonly BodyRegionIdValue[] = Object.freeze(
  Object.values(BodyRegionId),
);

const labels: Readonly<Record<BodyRegionIdValue, string>> = Object.freeze({
  torso: 'Torso',
  head: 'Cabeza',
  legs: 'Piernas',
});

export function canChooseShotLocation(target: ShotTarget | null | undefined): boolean {
  if (!target) {
    return false;
  }
  const depleted = target.hp !== undefined && target.hp <= 0;
  const unconscious =
    target.hp !== undefined && isUnconscious({ hp: target.hp, energy: target.energy ?? 100 });
  return (
    !depleted &&
    !unconscious &&
    !target.unconscious &&
    !target.knockedDown &&
    target.stance !== 'prone'
  );
}

export function shotLocationsFor(
  target: ShotTarget | null | undefined,
): readonly BodyRegionIdValue[] {
  return canChooseShotLocation(target) ? HIT_LOCATIONS : [BodyRegionId.Torso];
}

export function getHitLocationProfile(
  location: BodyRegionIdValue = BodyRegionId.Torso,
): HitLocationProfile {
  return { ...BodyRegion.named(location).profile(), label: labels[location] };
}

export function shotLocationPenalty(location: BodyRegionIdValue, range: number): number {
  return BodyRegion.named(location).aimingPenalty(range);
}

export function shotLocationEffects(
  location: BodyRegionIdValue,
  baseDamage: number,
  target: ShotTarget = {},
): BodyImpact {
  return BodyRegion.named(location).impact(baseDamage, injuryTarget(target));
}

function injuryTarget(target: ShotTarget): {
  health?: number;
  stance?: string;
  mounted?: boolean;
} {
  const injury: { health?: number; stance?: string; mounted?: boolean } = {};
  if (target.hp !== undefined) {
    injury.health = target.hp;
  }
  if (target.stance !== undefined) {
    injury.stance = target.stance;
  }
  if (target.mounted !== undefined) {
    injury.mounted = target.mounted;
  }
  return injury;
}
