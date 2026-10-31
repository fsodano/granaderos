import { AnimationClip, Vector3 } from 'three';
import type { AnimationClipJSON } from 'three';
import { NativeMeleeContactFit } from './melee-contact-fit';
import {
  restoreActor,
  restoreCalibration,
  type ActorSnapshot,
  type Calibration,
} from './melee-worker-snapshot';
import type { ActorCue } from './presentation';
import type { ClipSpec } from './actor-assets';
import type { LowerPathCache } from './melee-lower-path-cache';
import { required } from './required';

export type FitJob = {
  id: number;
  own: ActorSnapshot;
  target: ActorSnapshot;
  calibration: Calibration;
  footwear: string;
  clip: AnimationClipJSON;
  gait?: { clip: AnimationClipJSON; speed: number };
  cue: ActorCue;
  spec: ClipSpec;
  time: number;
  lowerCache?: boolean;
  existingGait?: LowerPathCache['gait'];
};
export function runFitJob(job: FitJob) {
  const started = performance.now(),
    own = restoreActor(job.own),
    other = restoreActor(job.target),
    clip = AnimationClip.parse(job.clip),
    gait = job.gait
      ? { clip: AnimationClip.parse(job.gait.clip), speed: job.gait.speed }
      : undefined,
    fit = new NativeMeleeContactFit(
      own.model,
      own.root,
      job.footwear,
      false,
      gait,
    );
  try {
    restoreCalibration(fit, job.calibration);
    if (
      job.existingGait &&
      Object.values(job.existingGait).every(
        (value) => Number.isFinite(value) && value > 0,
      )
    ) {
      fit.admitGait(job.existingGait);
    }
    const apply = () =>
      fit.apply(job.cue, clip, job.spec, own.weapon, job.time, () => ({
        model: other.model,
        root: other.root,
      }));
    const pairs = job.lowerCache
      ? fit.sampleRejectedSpeedPairs(apply)
      : (apply(), []);
    const cache = job.lowerCache ? fit.warmCacheMetadata() : undefined;
    const contact =
      job.lowerCache && fit.hasSamplingContext
        ? required(job.spec.markers?.['contact'], 'native contact marker')
        : 0;
    const native =
      job.lowerCache && fit.hasSamplingContext
        ? fit.nativePoseCacheFor(clip, contact)
        : undefined;
    const seed = {
      body: new Vector3(),
      hand: new Vector3(),
      step: new Vector3(),
      rearStep: new Vector3(),
      twoHands: true,
      contact,
      duration: clip.duration,
      ...(job.cue.contactTurn
        ? {
            turn: {
              ...job.cue.contactTurn,
              until: clip.duration * 0.1,
              footDistance: 0,
            },
          }
        : {}),
    };
    const settled =
      job.lowerCache && fit.hasSamplingContext
        ? fit.settledPoseCacheFor(clip, seed)
        : undefined;
    return {
      id: job.id,
      plan: fit.fittedPlanSnapshot(),
      cache,
      native,
      settled,
      pairs,
      workerMs: performance.now() - started,
      gait: fit.gaitCalibration(),
      rejectedFits: fit.rejectedFits,
    };
  } finally {
    fit.dispose();
  }
}
export type FitResult = ReturnType<typeof runFitJob>;
if (typeof self !== 'undefined') {
  self.onmessage = (event: MessageEvent<FitJob>) => {
    try {
      const result = runFitJob(event.data),
        transfer = [
          ...(result.native?.rows.map((row) => row.values.buffer) ?? []),
          ...(result.settled?.rows.map((row) => row.values.buffer) ?? []),
        ];
      self.postMessage(result, { transfer });
    } catch (error) {
      self.postMessage({
        id: event.data.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
