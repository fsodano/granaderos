/** The older lance carry clips keep their arms, but use the reviewed native
 * lower-body gait. Timing and clip composition must use the same reference. */
export function locomotionReference(semantic: string) {
  return /^stand\.(walk|run)\.lance$/.test(semantic)
    ? semantic.replace(/lance$/, 'blade')
    : semantic;
}

/** Display pace only. The distance-driven animation clock follows this speed;
 * paid cells, action points, energy and simulation time do not use it. */
export function footMovementPace(action: string, posture: string, mounted: boolean) {
  return !mounted && posture === 'standing'
    ? action === 'walk'
      ? 1.15
      : action === 'run'
        ? 1.4
        : 1
    : 1;
}
