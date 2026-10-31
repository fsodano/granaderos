import type { AnimationClip } from 'three';
import type { NativeMeleeContactFit, MeleePosePlan } from './melee-contact-fit';
import type { ContactSupport } from './presentation';
export type LowerPoseRow = {
  time: number;
  values: Float64Array;
  nativeRight: number[];
  nativeLeft: number[];
  rotation: number[];
  handWeight: number;
  footError: number;
  maximumError: number;
  solves: boolean;
  bodyCheck: boolean;
};
export type LowerRecipe = {
  key: string;
  accepted: boolean;
  rows: LowerPoseRow[];
};
export type LowerPathCache = {
  core: { name: string; low: number[]; high: number[] }[];
  recipes: LowerRecipe[];
  names: string[];
  previewLegs: { name: string; first: number; second: number }[];
  gait: { step: number; foot: number; sole: number; boot: number };
};
const recipeKey = (plan: MeleePosePlan) =>
  JSON.stringify([
    plan.body.toArray(),
    plan.step.toArray(),
    plan.rearStep.toArray(),
    plan.contact,
    plan.duration,
    plan.twoHands,
    plan.sabre,
    plan.pistol,
    plan.handRecovery,
    plan.turn,
    plan.yaw,
  ]);

/** Compute the unchanged full chronological lower-body gate off-thread.
 * All source candidates are retained in their source search order. The hand
 * correction is not part of this proof and is always rechecked at admission. */
export function lowerCacheFor(
  fit: NativeMeleeContactFit,
  plans: MeleePosePlan[],
  clip: AnimationClip,
  support: ContactSupport,
): LowerPathCache {
  return fit.lowerCacheFor(plans, clip, support);
}

/** Recheck both current intended wrists and every original body-bound sample.
 * Lower geometry comes only from a matching, complete source proof. Missing
 * source candidates reject the entire fit, never skip to a later candidate. */
export function cachedPathAllowed(
  fit: NativeMeleeContactFit,
  cache: LowerPathCache,
  plan: MeleePosePlan,
  support: ContactSupport,
) {
  return fit.cachedPathAllowed(cache, plan, support);
}
export { recipeKey };

/** Preallocate only owned geometry. No paid pose or target plan is retained. */
export function initializeCachedSample(fit: NativeMeleeContactFit, cache: LowerPathCache) {
  return fit.initializeCachedSample(cache);
}
/** Match the original first constructor's actual mixed native inputs. The
 * cached geometry remains fixed; all53 native bones are copied immediately
 * after the paid consumer's mixer/cloth/gait work, before source admission. */
export function finalizeCachedSample(fit: NativeMeleeContactFit) {
  return fit.finalizeCachedSample();
}
