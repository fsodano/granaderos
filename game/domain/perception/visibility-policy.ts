import { IlluminationRules } from './illumination-policy.ts';

export type SightConditions = Readonly<{
  night: boolean;
  nightSightBonus: number;
  targetIllumination: number;
  coverPenalty: number;
  stealthTraining: number;
  concealedMovement: boolean;
  mounted: boolean;
}>;

export const VisibilityRules = Object.freeze({
  dayRange: 12,
  nightRange: 6,
  illuminatedTargetRange: 16,
  maximumConcealmentPenalty: 1,
  trainingConcealmentFactor: 0.1,
  opaqueSmokeCells: 5,
});

export class VisibilityPolicy {
  range(conditions: SightConditions): number {
    const concealment =
      conditions.concealedMovement && !conditions.mounted
        ? Math.min(
            VisibilityRules.maximumConcealmentPenalty,
            conditions.stealthTraining * VisibilityRules.trainingConcealmentFactor,
          )
        : 0;
    const naturalRange =
      (conditions.night
        ? VisibilityRules.nightRange + conditions.nightSightBonus
        : VisibilityRules.dayRange) -
      concealment -
      conditions.coverPenalty;
    const illuminatedRange =
      conditions.targetIllumination >= IlluminationRules.brightTargetThreshold
        ? VisibilityRules.illuminatedTargetRange - conditions.coverPenalty
        : 0;
    return Math.max(0, naturalRange, illuminatedRange);
  }

  smokeIsTransparent(intersectedCells: number): boolean {
    return intersectedCells < VisibilityRules.opaqueSmokeCells;
  }
}
