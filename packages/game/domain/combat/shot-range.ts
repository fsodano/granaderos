// Classic range terms, converted from ten world units per tile to tiles.
// The caller maps this game's light, smoke and concealment to apparent distance.
export type ShotRangeProfile = Readonly<{
  distance: number;
  weaponRange: number;
  apparentRange?: number;
  visibleRange: number;
}>;

export type ShotRangeModifiers = Readonly<{
  distance: number;
  weaponRange: number;
  visibleRange: number;
  apparentRange: number;
  effectiveSightRange: number;
  beyondSight: boolean;
  beyondWeapon: boolean;
  weaponPenalty: number;
  sightAdjustment: number;
  chanceFactor: number;
}>;

export function shotRangeModifiers(profile: ShotRangeProfile): ShotRangeModifiers {
  const { distance, weaponRange, visibleRange } = profile;
  const apparentRange = profile.apparentRange ?? distance;
  for (const value of [distance, weaponRange, apparentRange, visibleRange]) {
    if (!Number.isFinite(value) || value < 0) {
      throw Error('Invalid shot range.');
    }
  }
  const beyondSight = apparentRange > visibleRange,
    beyondWeapon = distance > weaponRange;
  const effectiveSightRange = apparentRange + Math.max(0, apparentRange - visibleRange);
  return {
    distance,
    weaponRange,
    visibleRange,
    apparentRange,
    effectiveSightRange,
    beyondSight,
    beyondWeapon,
    weaponPenalty: Math.max(0, Math.trunc(((3 * distance - weaponRange) * 10) / 17)),
    sightAdjustment: Math.trunc(3 * (9 - effectiveSightRange)),
    chanceFactor: (beyondSight ? 0.5 : 1) * (beyondWeapon ? 0.5 : 1),
  };
}
