import type { AnimationClip } from 'three';
import type { NativeMeleeContactFit, MeleePosePlan } from './melee-contact-fit';
export type NativePoseCache = {
  names: string[];
  rows: { time: number; values: Float64Array }[];
};
/** Reuse only the exact authored native clip samples. The complete current
 * calibrated leg/hand, skin/floor/speed/body admission remains original. */
export function nativePoseCacheFor(
  fit: NativeMeleeContactFit,
  clip: AnimationClip,
  contact: number,
): NativePoseCache {
  return fit.nativePoseCacheFor(clip, contact);
}
export function replayNativeMixer(
  fit: NativeMeleeContactFit,
  cache: NativePoseCache,
  clip: AnimationClip,
) {
  return fit.replayNativeMixer(cache, clip);
}

export type SettledPoseRow = {
  time: number;
  values: Float64Array;
  right: number[];
  left: number[];
  feet: number[][];
  rotation: number[];
};
export type SettledPoseCache = { names: string[]; rows: SettledPoseRow[] };
/** Cache only the native football settling and ground baseline, which depend
 * on clip time/retained facing and owned bind support. Body/step/hand/reach
 * remain current source values and are solved again at admission. */
export function settledPoseCacheFor(
  fit: NativeMeleeContactFit,
  clip: AnimationClip,
  plan: MeleePosePlan,
): SettledPoseCache {
  return fit.settledPoseCacheFor(clip, plan);
}
export function replaySettledPose(fit: NativeMeleeContactFit, cache: SettledPoseCache) {
  return fit.replaySettledPose(cache);
}
