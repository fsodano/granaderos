import { isMesh, isSkinnedMesh } from './scene-node-types';
import type { AnimationClipJSON, BufferAttribute } from 'three';
import type { Attribute, Calibration } from './melee-worker-snapshot';
import { isWorkerRecord } from '../battle-worker-values';
import { readReadyMeleeSamples, type ReadyMeleeSamples } from './melee-worker-values';
import { required } from './required';
// eslint-disable-next-line import/default -- Vite supplies this virtual worker URL; native URL workers break the static export.
import workerUrl from './melee-fit-worker?worker&url';
import { AnimationClip, Object3D, InterleavedBufferAttribute } from 'three';
import { NativeMeleeContactFit, type ContactActorResolver } from './melee-contact-fit';
import {
  snapshotActor,
  snapshotCalibration,
  restoreCalibration,
  clipSnapshot,
  type ActorSnapshot,
} from './melee-worker-snapshot';
import {
  initializeCachedSample,
  finalizeCachedSample,
  type LowerPathCache,
} from './melee-lower-path-cache';
import type { ActorCue, ContactTarget, ContactSupport } from './presentation';
import type { ClipSpec } from './actor-assets';
import {
  replayNativeMixer,
  replaySettledPose,
  type NativePoseCache,
  type SettledPoseCache,
} from './melee-native-pose-cache';
import { scalarRiflePathGate } from './melee-scalar-path-gate';
import { prunePreviewUpdates } from './melee-preview-hierarchy';
type Warm = {
  targets: ContactTarget[];
  support: ContactSupport;
};
type Lease = {
  id: number;
  key: string;
  own: ActorSnapshot;
  target: Object3D;
  targetRoot: Object3D;
  cue: ActorCue;
  clip: AnimationClip;
  spec: ClipSpec;
  weapon: Object3D;
  gait: {
    clip: AnimationClip;
    speed: number;
  };
  clipData: AnimationClipJSON;
  gaitData: AnimationClipJSON;
  calibration: Calibration;
  gaitSpeed: number;
  resolve: ContactActorResolver;
};
let worker: Worker | undefined,
  owner: NativeReadyMeleeContactFit | undefined,
  jobId = 0,
  references = 0,
  watchdog: ReturnType<typeof setTimeout> | undefined;
function registerOwner(fit: NativeReadyMeleeContactFit) {
  owner = fit;
}
function shown(node: Object3D) {
  for (let current: Object3D | null = node; current; current = current.parent) {
    if (!current.visible) {
      return false;
    }
  }
  return true;
}
function equal(a: ArrayLike<number>, b: ArrayLike<number>) {
  return a.length === b.length && Array.from(a).every((value, index) => value === b[index]);
}
function attributeSame(
  source: BufferAttribute | InterleavedBufferAttribute | undefined | null,
  record: Attribute | undefined,
) {
  if (
    !source ||
    !record ||
    source.itemSize !== record.itemSize ||
    source.normalized !== record.normalized ||
    source.count * source.itemSize !== record.array.length
  ) {
    return false;
  }
  for (let i = 0; i < source.count; i++) {
    for (let j = 0; j < source.itemSize; j++) {
      const value =
        source instanceof InterleavedBufferAttribute
          ? source.data.array[i * source.data.stride + source.offset + j]
          : source.array[i * source.itemSize + j];
      if (value !== record.array[i * source.itemSize + j]) {
        return false;
      }
    }
  }
  return true;
}
export function geometrySame(
  snapshot: ActorSnapshot,
  root: Object3D,
  model: Object3D,
  gun: Object3D,
) {
  root.updateWorldMatrix(true, false);
  if (
    snapshot.root !== root.uuid ||
    snapshot.model !== model.uuid ||
    snapshot.weapon !== gun.uuid ||
    !equal(
      root.parent?.matrixWorld.elements ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      snapshot.parent,
    )
  ) {
    return false;
  }
  const visibleSkins = new Set<string>();
  model.traverse((node) => {
    if (isSkinnedMesh(node) && shown(node)) {
      visibleSkins.add(node.uuid);
    }
  });
  for (const record of snapshot.nodes) {
    const node = root.getObjectByProperty('uuid', record.id);
    if (
      !node ||
      node.visible !== record.visible ||
      node.matrixAutoUpdate !== record.auto ||
      (record.parent >= 0 && node.parent?.uuid !== snapshot.nodes[record.parent]?.id)
    ) {
      return false;
    }
    // Both native clips author position/quaternion/scale for all53 bones.
    // Current mixed arm input is finalized and rechecked separately.
    if (!record.auto && !equal(node.matrix.elements, record.matrix)) {
      return false;
    }
    if (!record.bone) {
      if (
        !equal(node.position.toArray(), record.position) ||
        !equal(node.scale.toArray(), record.scale) ||
        (node !== root && !equal(node.quaternion.toArray(), record.quaternion))
      ) {
        return false;
      }
    } else if (!node.matrixAutoUpdate) {
      return false;
    }
    if (record.geometry) {
      if (!isMesh(node) || !shown(node)) {
        return false;
      }
      const geometry = node.geometry;
      if (!geometry) {
        return false;
      }
      for (const [name, data] of Object.entries(record.geometry.attributes)) {
        if (!attributeSame(geometry.attributes[name], data)) {
          return false;
        }
      }
      if (
        Boolean(geometry.index) !== Boolean(record.geometry.index) ||
        (record.geometry.index && !attributeSame(geometry.index, record.geometry.index))
      ) {
        return false;
      }
      const morph = geometry.morphAttributes.position ?? [];
      if (
        morph.length !== record.geometry.morph.length ||
        geometry.morphTargetsRelative !== record.geometry.relative ||
        morph.some(
          (attribute, index) => !attributeSame(attribute, required(record.geometry).morph[index]),
        )
      ) {
        return false;
      }
      if (!equal(node.morphTargetInfluences ?? [], record.morph ?? [])) {
        return false;
      }
      if (record.skin) {
        visibleSkins.delete(node.uuid);
        if (!isSkinnedMesh(node)) {
          return false;
        }
        const skin = node.skeleton;
        if (
          node.bindMode !== record.skin.mode ||
          !equal(node.bindMatrix.elements, record.skin.bind) ||
          (record.skin.mode !== 'attached' &&
            !equal(node.bindMatrixInverse.elements, record.skin.bindInverse)) ||
          skin.bones.length !== record.skin.bones.length ||
          skin.bones.some(
            (bone: Object3D, index: number) =>
              bone.uuid !== required(record.skin).bones[index] ||
              !equal(
                required(skin.boneInverses[index]).elements,
                required(required(record.skin).inverse[index]),
              ),
          )
        ) {
          return false;
        }
      }
    }
  }
  return visibleSkins.size === 0;
}
export function clipSame(clip: AnimationClip, data: AnimationClipJSON) {
  return (
    clip.name === data.name &&
    clip.duration === data.duration &&
    clip.tracks.length === data.tracks.length &&
    clip.tracks.every((track, index) => {
      const saved = data.tracks[index];
      return (
        saved !== undefined &&
        track.name === saved.name &&
        track.getInterpolation() === (saved.interpolation ?? track.DefaultInterpolation) &&
        equal(track.times, saved.times) &&
        equal(track.values, saved.values)
      );
    })
  );
}

/** Prepare known native rows off-thread. Every ready strike still checks the
 * complete current physical gate. An unavailable cache retains original
 * synchronous admission for the whole cue and cannot join a late plan. */
export class NativeReadyMeleeContactFit extends NativeMeleeContactFit {
  private registered = false;
  private stopped = false;
  private warm: Warm | undefined;
  private lease: Lease | undefined;
  private ready:
    | {
        lease: Lease;
        cache: LowerPathCache;
        prepared: NativeMeleeContactFit;
        native: NativePoseCache;
        settled: SettledPoseCache;
        pairs: number[][];
      }
    | undefined;
  private fallbackCue = '';
  private usingCue = '';
  private finalized = false;
  constructor(
    private ownModel: Object3D,
    private ownRoot: Object3D,
    private footwear?: string,
    preview = false,
    private nativeGait?: {
      clip: AnimationClip;
      speed: number;
    },
  ) {
    super(ownModel, ownRoot, footwear, preview, nativeGait);
    this.registered = typeof Worker !== 'undefined';
    if (this.registered) {
      references++;
    }
  }
  private key(
    target: ContactTarget,
    support: ContactSupport,
    turn?: {
      fromYaw: number;
      toYaw: number;
    },
  ) {
    return JSON.stringify([
      this.ownRoot.position.toArray(),
      this.ownRoot.scale.toArray(),
      [this.ownRoot.rotation.x, this.ownRoot.rotation.z],
      this.ownModel.position.toArray(),
      this.ownModel.quaternion.toArray(),
      this.ownModel.scale.toArray(),
      turn ?? {
        fromYaw: this.ownRoot.rotation.y,
        toYaw: this.ownRoot.rotation.y,
      },
      target.key,
      target.appearance,
      target.position,
      target.yaw,
      target.posture,
      target.mounted,
      support,
    ]);
  }
  prewarm(
    warm: Warm | undefined,
    clip: AnimationClip,
    spec: ClipSpec,
    gun: Object3D | undefined,
    resolve?: ContactActorResolver,
  ) {
    this.warm = warm;

    if (!this.canFitPairedStrike) {
      return;
    }
    if (
      this.stopped ||
      !warm ||
      typeof Worker === 'undefined' ||
      !gun ||
      !resolve ||
      !this.nativeGait ||
      !this.footwear ||
      spec.name !== 'stand.butt.long-gun' ||
      !shown(this.ownRoot) ||
      !shown(this.ownModel) ||
      !shown(gun)
    ) {
      return;
    }
    const target = warm.targets[0];
    if (!target || target.mounted || !['standing', 'crouched'].includes(target.posture)) {
      return;
    }
    const toYaw = Math.atan2(
        target.position[0] - this.ownRoot.position.x,
        target.position[2] - this.ownRoot.position.z,
      ),
      fromYaw = this.ownRoot.rotation.y,
      delta = Math.atan2(Math.sin(toYaw - fromYaw), Math.cos(toYaw - fromYaw));
    if (Math.abs(delta) > Math.PI / 4 + 1e-7) {
      return;
    }
    const contactTurn = Math.abs(delta) > 1e-7 ? { fromYaw, toYaw } : undefined,
      key = this.key(target, warm.support, contactTurn);
    if (owner) {
      return;
    }
    const other = resolve(target);
    if (!other || !shown(other.root) || !shown(other.model)) {
      return;
    }
    const ready = this.ready;
    if (
      ready &&
      ready.lease.key === key &&
      other.root === ready.lease.targetRoot &&
      other.model === ready.lease.target &&
      gun === ready.lease.weapon &&
      geometrySame(ready.lease.own, this.ownRoot, this.ownModel, gun) &&
      clipSame(clip, ready.lease.clipData) &&
      clipSame(this.nativeGait.clip, ready.lease.gaitData) &&
      this.nativeGait.speed === ready.lease.gaitSpeed
    ) {
      return;
    }
    if (ready) {
      ready.prepared.dispose();
      this.ready = undefined;
    }
    const start = performance.now(),
      own = snapshotActor(this.ownRoot, this.ownModel, gun),
      otherPacket = snapshotActor(other.root, other.model),
      calibration = snapshotCalibration(this),
      clipData = clipSnapshot(clip),
      gaitData = clipSnapshot(this.nativeGait.clip),
      id = ++jobId,
      cue: ActorCue = {
        id: 'warm:' + id,
        action: 'strike',
        phase: 'prepare',
        phaseStartedAt: 0,
        startedAt: 0,
        durationMs: clip.duration * 1000,
        ...(contactTurn ? { contactTurn } : {}),
        contactTarget: target,
        contactSupport: warm.support,
      };
    this.lease = {
      id,
      key,
      own,
      target: other.model,
      targetRoot: other.root,
      cue,
      clip,
      spec,
      weapon: gun,
      gait: this.nativeGait,
      clipData,
      gaitData,
      calibration,
      gaitSpeed: this.nativeGait.speed,
      resolve,
    };
    registerOwner(this);
    if (!worker) {
      try {
        worker = new Worker(workerUrl, { type: 'module' });
      } catch {
        owner = undefined;
        this.stopped = true;
        return;
      }
      worker.onmessage = (event: MessageEvent<unknown>) => {
        const current = owner;
        if (!current || !isWorkerRecord(event.data) || current.lease?.id !== event.data['id']) {
          return;
        }
        owner = undefined;
        if (watchdog) {
          clearTimeout(watchdog);
        }
        watchdog = undefined;
        if (event.data['error'] !== undefined) {
          current.stopped = true;
          return;
        }
        try {
          current.receive(readReadyMeleeSamples(event.data));
        } catch {
          current.stopped = true;
        }
      };
      worker.onerror = () => {
        if (watchdog) {
          clearTimeout(watchdog);
        }
        watchdog = undefined;
        if (owner) {
          owner.stopped = true;
        }
        owner = undefined;
        worker?.terminate();
        worker = undefined;
      };
    }
    try {
      worker.postMessage({
        id,
        own,
        target: otherPacket,
        calibration,
        footwear: this.footwear,
        clip: clipData,
        gait: { clip: gaitData, speed: this.nativeGait.speed },
        cue,
        spec,
        time: 0,
        lowerCache: true,
        existingGait: this.gaitCalibration(),
      });
      watchdog = setTimeout(() => {
        if (owner === this && this.lease?.id === id) {
          owner = undefined;
          this.stopped = true;
          worker?.terminate();
          worker = undefined;
        }
        watchdog = undefined;
      }, 5000);
    } catch {
      owner = undefined;
      this.stopped = true;
      worker?.terminate();
      worker = undefined;
      return;
    }
    performance.measure('granaderos-melee-ready-snapshot', {
      start,
      duration: performance.now() - start,
    });
  }
  private receive(data: ReadyMeleeSamples) {
    const start = performance.now(),
      lease = this.lease;
    if (
      this.stopped ||
      !lease ||
      lease.id !== data.id ||
      !this.warm ||
      !shown(this.ownRoot) ||
      !shown(this.ownModel) ||
      !data.cache ||
      !data.native ||
      !data.settled
    ) {
      return;
    }
    const current = this.warm.targets.find(
        (target) => target.key === required(lease.cue.contactTarget).key,
      ),
      fromYaw = this.ownRoot.rotation.y,
      toYaw = current
        ? Math.atan2(
            current.position[0] - this.ownRoot.position.x,
            current.position[2] - this.ownRoot.position.z,
          )
        : NaN,
      delta = Math.atan2(Math.sin(toYaw - fromYaw), Math.cos(toYaw - fromYaw)),
      turn = Math.abs(delta) > 1e-7 ? { fromYaw, toYaw } : undefined;
    if (
      !current ||
      this.key(current, this.warm.support, turn) !== lease.key ||
      !geometrySame(lease.own, this.ownRoot, this.ownModel, lease.weapon) ||
      !clipSame(lease.clip, lease.clipData) ||
      !clipSame(lease.gait.clip, lease.gaitData) ||
      lease.gait.speed !== lease.gaitSpeed
    ) {
      return;
    }
    const other = lease.resolve(current);
    if (
      !other ||
      !shown(other.root) ||
      other.root !== lease.targetRoot ||
      !shown(other.model) ||
      other.model !== lease.target
    ) {
      return;
    }
    this.ready?.prepared.dispose();
    const prepared = new NativeMeleeContactFit(
      this.ownModel,
      this.ownRoot,
      this.footwear,
      false,
      this.nativeGait,
    );
    restoreCalibration(prepared, lease.calibration);
    initializeCachedSample(prepared, data.cache);
    this.ready = {
      lease,
      cache: data.cache,
      prepared,
      native: data.native,
      settled: data.settled,
      pairs: data.pairs,
    };
    performance.measure('granaderos-melee-ready-delivery', {
      start,
      duration: performance.now() - start,
      detail: {
        workerMs: data.workerMs,
        recipes: data.cache.recipes.length,
        ready: true,
      },
    });
  }
  private originalApply(
    cue: ActorCue | undefined,
    clip: AnimationClip,
    spec: ClipSpec,
    weapon: Object3D | undefined,
    time: number,
    resolve?: ContactActorResolver,
  ) {
    const started = performance.now();
    super.apply(cue, clip, spec, weapon, time, resolve);
    // Original admission may allocate the first mixed preview before a worker
    // is ready. Retain those native limb dimensions for every later cue.
    if (this.hasSamplingContext) {
      this.finalized = true;
    }
    if (cue && spec.name === 'stand.butt.long-gun') {
      try {
        performance.measure('granaderos-melee-original-apply', {
          start: started,
          duration: performance.now() - started,
          detail: {
            fitted: this.hasFittedPlan,
            advance: this.bodyAdvance,
            phase: cue.phase,
          },
        });
      } catch {}
    }
  }
  override apply(
    cue: ActorCue | undefined,
    clip: AnimationClip,
    spec: ClipSpec,
    weapon: Object3D | undefined,
    time: number,
    resolve?: ContactActorResolver,
  ) {
    if (typeof Worker === 'undefined' || spec.name !== 'stand.butt.long-gun') {
      return this.originalApply(cue, clip, spec, weapon, time, resolve);
    }
    const started = performance.now();
    if (!cue) {
      return this.originalApply(cue, clip, spec, weapon, time, resolve);
    }
    if (!weapon || !resolve || !cue.contactTarget) {
      if (this.usingCue === cue.id) {
        return this.originalApply(cue, clip, spec, weapon, time, resolve);
      }
      this.fallbackCue = cue.id;
      return this.originalApply(cue, clip, spec, weapon, time, resolve);
    }
    if (this.usingCue !== cue.id && cue.phase && cue.phase !== 'prepare') {
      this.fallbackCue = cue.id;
      return this.originalApply(cue, clip, spec, weapon, time, resolve);
    }
    if (this.fallbackCue === cue.id) {
      return this.originalApply(cue, clip, spec, weapon, time, resolve);
    }
    const ready = this.ready;
    if (
      !ready ||
      !cue.contactSupport ||
      !shown(this.ownRoot) ||
      !shown(this.ownModel) ||
      !shown(weapon) ||
      cue.contactTarget.mounted ||
      !['standing', 'crouched'].includes(cue.contactTarget.posture)
    ) {
      this.fallbackCue = cue.id;
      return this.originalApply(cue, clip, spec, weapon, time, resolve);
    }
    const retained = this.retainedTurn(cue.id),
      turn =
        cue.contactTurn ??
        (retained ? { fromYaw: retained.fromYaw, toYaw: retained.toYaw } : undefined),
      other = resolve(cue.contactTarget);
    const allow =
      ready &&
      other &&
      shown(this.ownRoot) &&
      shown(this.ownModel) &&
      shown(weapon) &&
      shown(other.root) &&
      other.root === ready.lease.targetRoot &&
      shown(other.model) &&
      other.model === ready.lease.target &&
      this.key(cue.contactTarget, required(cue.contactSupport), turn) === ready.lease.key &&
      weapon === ready.lease.weapon &&
      geometrySame(ready.lease.own, this.ownRoot, this.ownModel, weapon) &&
      clipSame(clip, ready.lease.clipData) &&
      clipSame(ready.lease.gait.clip, ready.lease.gaitData) &&
      ready.lease.gait.speed === ready.lease.gaitSpeed &&
      JSON.stringify(snapshotCalibration(this)) === JSON.stringify(ready.lease.calibration);
    if (!allow) {
      this.fallbackCue = cue.id;
      return this.originalApply(cue, clip, spec, weapon, time, resolve);
    }
    const start = started,
      createdSample = !this.hasSamplingContext,
      restoreAttempt = this.preserveAttempt(),
      originalRotation = this.ownRoot.quaternion.clone();
    let restore: (() => void) | undefined,
      restoreBoot: (() => void) | undefined,
      restoreHierarchy: (() => void) | undefined,
      restoreSettled: (() => void) | undefined;
    try {
      if (!this.hasSamplingContext) {
        this.takeSamplingFrom(ready.prepared);
        this.finalized = false;
      }
      if (!this.finalized) {
        finalizeCachedSample(this);
        this.finalized = true;
      }
      this.admitGait(ready.cache.gait);
      restore = replayNativeMixer(this, ready.native, clip);
      restoreBoot = scalarRiflePathGate(this, ready.pairs);
      restoreHierarchy = prunePreviewUpdates(this);
      restoreSettled = replaySettledPose(this, ready.settled);
      super.apply(cue, clip, spec, weapon, time, resolve);
      this.usingCue = cue.id;
      try {
        performance.measure('granaderos-melee-ready-apply', {
          start,
          duration: performance.now() - start,
          detail: {
            fitted: this.hasFittedPlan,
            advance: this.bodyAdvance,
            phase: cue.phase,
          },
        });
      } catch {}
    } catch (error) {
      // A cache failure must not leave temporary replay hooks in the original
      // synchronous path. A newly transferred sampler is rebuilt from current
      // owned inputs; an established original sampler keeps its calibration.
      restoreSettled?.();
      restoreSettled = undefined;
      restoreHierarchy?.();
      restoreHierarchy = undefined;
      restoreBoot?.();
      restoreBoot = undefined;
      restore?.();
      restore = undefined;
      super.restore();
      this.ownRoot.quaternion.copy(originalRotation);
      this.ownRoot.updateMatrixWorld(true);
      if (createdSample && this.hasSamplingContext) {
        this.releaseSampling();
        this.finalized = false;
      }
      restoreAttempt();
      this.fallbackCue = cue.id;
      this.originalApply(cue, clip, spec, weapon, time, resolve);
      try {
        performance.measure('granaderos-melee-ready-apply', {
          start,
          duration: performance.now() - start,
          detail: {
            fitted: this.hasFittedPlan,
            workerCache: false,
            reason: String(error),
            phase: cue.phase,
          },
        });
      } catch {}
    } finally {
      restoreSettled?.();
      restoreHierarchy?.();
      restoreBoot?.();
      restore?.();
    }
  }
  override dispose() {
    this.stopped = true;
    if (this.registered) {
      references--;
      this.registered = false;
    }
    if (owner === this || references === 0) {
      if (watchdog) {
        clearTimeout(watchdog);
      }
      watchdog = undefined;
      worker?.terminate();
      worker = undefined;
      owner = undefined;
    }
    this.ready?.prepared.dispose();
    this.ready = undefined;
    super.dispose();
  }
}
