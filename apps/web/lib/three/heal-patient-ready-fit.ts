import { Bone, InterleavedBufferAttribute } from 'three';
import type { AnimationClipJSON, Skeleton } from 'three';
import type { ContactActorModel } from './contact-target-model';
import { nativeInterpolant } from './native-interpolant';
import { isMesh, isSkinnedMesh } from './scene-node-types';
import { required } from './required';
import { isWorkerRecord } from '../battle-worker-values';
import { readPatientFitResult, type PatientFitResult } from './heal-patient-worker-values';
// eslint-disable-next-line import/default -- Vite supplies this virtual worker URL; native URL workers break the static export.
import workerUrl from './heal-patient-fit-worker?worker&url';
import { Object3D, Vector3, Quaternion, AnimationClip } from 'three';
import { NativePatientContactFit } from './heal-patient-contact-fit';
import { snapshotActor, clipSnapshot, type ActorSnapshot } from './melee-worker-snapshot';
import { geometrySame, clipSame } from './melee-ready-contact-fit';
import type { ActorCue, ContactTarget, ContactSupport } from './presentation';
import type { ContactActorResolver } from './melee-contact-fit';
type Warm = {
  targets: ContactTarget[];
  support: ContactSupport;
};
type Lease = {
  id: number;
  key: string;
  own: ActorSnapshot;
  other: ActorSnapshot;
  target: ContactTarget;
  model: Object3D;
  root: Object3D;
  stock: Object3D;
  gun: Object3D;
  hip: Object3D;
  resolve: ContactActorResolver;
  pose: { medic: PoseStamp; patient: PoseStamp };
  stamp: string;
  native?: {
    clip: AnimationClip;
    data: AnimationClipJSON;
    rows?: {
      node: Object3D;
      property: PoseProperty;
      sample: ReturnType<typeof nativeInterpolant>;
    }[];
  };
};
let worker: Worker | undefined,
  owner: NativeReadyPatientContactFit | undefined,
  sequence = 0,
  references = 0,
  watchdog: ReturnType<typeof setTimeout> | undefined;
function shown(node: Object3D) {
  for (let n: Object3D | null = node; n; n = n.parent) {
    if (!n.visible) {
      return false;
    }
  }
  return true;
}
function prop(model: Object3D) {
  let found: Object3D | undefined;
  model.traverse((n) => {
    if (!found && typeof n.userData['itemId'] === 'string' && shown(n)) {
      found = n;
    }
  });
  return found;
}
type PoseProperty = 'position' | 'quaternion' | 'scale';
type PoseRow = {
  name: string;
  position: number[];
  quaternion: number[];
  scale: number[];
};
type PoseStamp = (PoseRow | null)[];
function poseRow(node: Object3D): PoseRow {
  return {
    name: node.name,
    position: node.position.toArray(),
    quaternion: node.quaternion.toArray(),
    scale: node.scale.toArray(),
  };
}
function pose(model: Object3D): PoseStamp {
  return ['Root', 'pelvis', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r'].map(
    (name) => {
      const node = model.getObjectByName(name);
      return node ? poseRow(node) : null;
    },
  );
}
function patientPose(model: Object3D): PoseStamp {
  const rows: PoseRow[] = [];
  model.traverse((node) => {
    if (node instanceof Bone) {
      rows.push(poseRow(node));
    }
  });
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
function poseSame(left: PoseStamp, right: PoseStamp) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((entry, i) => {
    const other = right[i];
    if (!entry || !other) {
      return entry === other;
    }
    if (
      entry.name !== other.name ||
      entry.position.some(
        (n, j) =>
          !Number.isFinite(n) ||
          !Number.isFinite(other.position[j]) ||
          Math.abs(n - required(other.position[j])) > 1e-6,
      ) ||
      entry.scale.some(
        (n, j) =>
          !Number.isFinite(n) ||
          !Number.isFinite(other.scale[j]) ||
          Math.abs(n - required(other.scale[j])) > 1e-6,
      )
    ) {
      return false;
    }
    const distance = (sign: number) =>
      Math.hypot(...entry.quaternion.map((n, j) => n - sign * required(other.quaternion[j])));
    return (
      entry.quaternion.every(Number.isFinite) &&
      other.quaternion.every(Number.isFinite) &&
      Math.min(distance(1), distance(-1)) <= 0.000002
    );
  });
}
function stamp(model: Object3D, supply?: Object3D) {
  const records: {
      id: string;
      transform?: {
        parent: string | null;
        visible: boolean;
        pose: PoseRow;
        itemId: string | number | null;
      };
      geometry?: {
        id: string;
        visible: boolean;
        attributes: { name: string; version: number; count: number }[];
        index: number | null;
        morph: number[] | null;
        skin: {
          id: string;
          bones: string[];
          bind: number[];
          mode: string;
        } | null;
      };
    }[] = [],
    skins = new Set<Skeleton>();
  model.traverse((node) => {
    const record: (typeof records)[number] = { id: node.uuid };
    if (!(node instanceof Bone) && node !== supply) {
      const itemId: unknown = node.userData['itemId'];
      record.transform = {
        parent: node.parent?.uuid ?? null,
        visible: node.visible,
        pose: poseRow(node),
        itemId: typeof itemId === 'string' || typeof itemId === 'number' ? itemId : null,
      };
    }
    if (isMesh(node)) {
      record.geometry = {
        id: node.geometry.uuid,
        visible: shown(node),
        attributes: Object.entries(node.geometry.attributes).map(([name, attribute]) => ({
          name,
          version:
            attribute instanceof InterleavedBufferAttribute
              ? attribute.data.version
              : attribute.version,
          count: attribute.count,
        })),
        index: node.geometry.index?.version ?? null,
        morph: node.morphTargetInfluences ?? null,
        skin: isSkinnedMesh(node)
          ? {
              id: node.skeleton.uuid,
              bones: node.skeleton.bones.map((bone) => bone.uuid),
              bind: node.bindMatrix.toArray(),
              mode: node.bindMode,
            }
          : null,
      };
      if (isSkinnedMesh(node)) {
        skins.add(node.skeleton);
      }
    }
    if (record.transform || record.geometry) {
      records.push(record);
    }
  });
  records.sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify([
    records,
    [...skins]
      .map((skin) => ({
        id: skin.uuid,
        inverse: skin.boneInverses.map((matrix) => matrix.toArray()),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  ]);
}
function registerPatientOwner(fit: NativeReadyPatientContactFit) {
  owner = fit;
}
/** Only current selected-patient preparation runs in the worker. A late,
 * missing or stale plan keeps native care for that entire admitted cue. */
export class NativeReadyPatientContactFit extends NativePatientContactFit {
  private stopped = false;
  private warm: Warm | undefined;
  private lease: Lease | undefined;
  private ready:
    | {
        lease: Lease;
        data: PatientFitResult;
      }
    | undefined;
  private fallback = '';
  private using = '';
  private registered = false;
  private unavailable: Lease | undefined;
  private own: Object3D;
  private ownRoot: Object3D;
  constructor(own: Object3D, ownRoot: Object3D) {
    super(own, ownRoot);
    this.own = own;
    this.ownRoot = ownRoot;

    this.registered = typeof Worker !== 'undefined';
    if (this.registered) {
      references++;
    }
  }
  private supplySame(lease: Lease) {
    const record = lease.own.nodes.find((n) => n.id === lease.stock.uuid);
    if (!record || lease.stock.userData['itemId'] !== record.itemId) {
      return false;
    }
    const position = new Vector3().fromArray(record.position);
    let parent = record.parent >= 0 ? lease.own.nodes[record.parent]?.id : undefined;
    if (this.suppliesStowed) {
      parent = lease.hip.uuid;
      position.add(
        new Vector3(0, this.ready?.data.lift ?? 0, 0)
          .applyQuaternion(lease.hip.getWorldQuaternion(new Quaternion()).invert())
          .divide(lease.hip.getWorldScale(new Vector3())),
      );
    }
    return (
      lease.stock.parent?.uuid === parent &&
      lease.stock.position.distanceTo(position) < 1e-6 &&
      lease.stock.quaternion.angleTo(new Quaternion().fromArray(record.quaternion)) < 1e-6 &&
      lease.stock.scale.distanceTo(new Vector3().fromArray(record.scale)) < 1e-6
    );
  }
  private poseMatches(lease: Lease, other: ContactActorModel) {
    if (!poseSame(pose(this.own), lease.pose.medic)) {
      return false;
    }
    const source = lease.native;
    if (!source) {
      return poseSame(patientPose(other.model), lease.pose.patient);
    }
    const native = other.nativePose;
    if (
      !native ||
      native.clip !== source.clip ||
      native.clip.name !== 'prone.idle.long-gun' ||
      !Number.isFinite(native.time) ||
      !Number.isFinite(native.weight) ||
      native.weight < 1 - 1e-6 ||
      native.weight > 1 + 1e-6 ||
      native.time < 0 ||
      native.time > native.clip.duration + 1e-6 ||
      !clipSame(native.clip, source.data)
    ) {
      return false;
    }
    if (!source.rows) {
      const copy = AnimationClip.parse(source.data);
      source.rows = copy.tracks.map((track) => {
        const [name, property] = track.name.split('.');
        if (
          !name ||
          (property !== 'position' && property !== 'quaternion' && property !== 'scale')
        ) {
          throw new Error('Invalid patient animation track');
        }
        return {
          node: required(other.model.getObjectByName(name)),
          property,
          sample: nativeInterpolant(track),
        };
      });
    }
    return source.rows.every((row) => {
      if (!row.node) {
        return false;
      }
      const actual = row.node[row.property].toArray(),
        expected = row.sample.evaluate(native.time);
      if (!actual || actual.length !== expected.length || !actual.every(Number.isFinite)) {
        return false;
      }
      if (row.property === 'quaternion') {
        const distance = (sign: number) =>
          Math.hypot(...actual.map((n: number, i: number) => n - sign * required(expected[i])));
        return Math.min(distance(1), distance(-1)) <= 2e-6;
      }
      return actual.every(
        (n: number, i: number) =>
          Number.isFinite(expected[i]) && Math.abs(n - required(expected[i])) <= 1e-6,
      );
    });
  }
  private key(target: ContactTarget, support: ContactSupport) {
    return JSON.stringify([
      this.ownRoot.uuid,
      this.own.uuid,
      this.ownRoot.position.toArray(),
      this.ownRoot.quaternion.toArray(),
      this.ownRoot.scale.toArray(),
      this.own.position.toArray(),
      this.own.quaternion.toArray(),
      this.own.scale.toArray(),
      this.ownRoot.parent?.matrixWorld.toArray(),
      target,
      support,
    ]);
  }
  prewarm(
    warm: Warm | undefined,
    stock: Object3D | undefined,
    hip: Object3D | undefined,
    resolve?: ContactActorResolver,
  ) {
    this.warm = warm;
    if (
      this.stopped ||
      typeof Worker === 'undefined' ||
      !warm ||
      !stock ||
      !hip ||
      !resolve ||
      !shown(this.ownRoot) ||
      !shown(stock)
    ) {
      return;
    }
    const target = warm.targets.find((target) => {
      const other = resolve(target);
      const cue: ActorCue = {
        id: 'probe',
        action: 'heal',
        startedAt: 0,
        healInterval: true,
        care: { mode: 'patient', target, support: warm.support },
      };
      return other && shown(other.root) && shown(other.model) && this.supportedPose(cue, other);
    });
    if (!target) {
      return;
    }
    const other = resolve(target);
    if (!other) {
      return;
    }
    if (
      other.nativePose &&
      (other.nativePose.clip.name !== 'prone.idle.long-gun' ||
        !Number.isFinite(other.nativePose.time) ||
        !Number.isFinite(other.nativePose.weight) ||
        other.nativePose.weight < 1 - 1e-6 ||
        other.nativePose.weight > 1 + 1e-6)
    ) {
      return;
    }
    const gun = prop(other.model);
    if (!gun) {
      return;
    }
    const key = this.key(target, warm.support),
      bodyPose = { medic: pose(this.own), patient: patientPose(other.model) },
      geometryStamp = stamp(this.own, stock) + '|' + stamp(other.model),
      ready = this.ready;
    if (
      ready &&
      ready.lease.key === key &&
      ready.lease.model === other.model &&
      ready.lease.stock === stock &&
      this.poseMatches(ready.lease, other) &&
      ready.lease.stamp === geometryStamp
    ) {
      return;
    }
    const unavailable = this.unavailable;
    if (
      unavailable &&
      unavailable.key === key &&
      unavailable.model === other.model &&
      unavailable.stock === stock &&
      this.poseMatches(unavailable, other) &&
      unavailable.stamp === geometryStamp
    ) {
      return;
    }
    if (owner) {
      return;
    }
    this.ready = undefined;
    const at = performance.now(),
      id = ++sequence,
      own = snapshotActor(this.ownRoot, this.own, stock),
      packet = snapshotActor(other.root, other.model, gun),
      cue: ActorCue = {
        id: 'warm:' + id,
        action: 'heal',
        startedAt: 0,
        healInterval: true,
        care: { mode: 'patient', target, support: warm.support },
      };
    this.lease = {
      id,
      key,
      own,
      other: packet,
      target,
      model: other.model,
      root: other.root,
      stock,
      gun,
      hip,
      resolve,
      pose: bodyPose,
      stamp: geometryStamp,
      ...(other.nativePose
        ? {
            native: {
              clip: other.nativePose.clip,
              data: clipSnapshot(other.nativePose.clip),
            },
          }
        : {}),
    };
    registerPatientOwner(this);
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
          current.receive(readPatientFitResult(event.data));
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
        target: packet,
        calibration: this.calibration(),
        cue,
        hip: hip.uuid,
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
    }
    performance.measure('granaderos-patient-ready-snapshot', {
      start: at,
      duration: performance.now() - at,
    });
  }
  private receive(data: PatientFitResult) {
    const at = performance.now(),
      lease = this.lease;
    if (
      this.stopped ||
      !lease ||
      lease.id !== data.id ||
      !this.warm ||
      !shown(this.ownRoot) ||
      !shown(this.own)
    ) {
      performance.measure('granaderos-patient-ready-rejected', {
        start: performance.now(),
        duration: 0,
        detail: {
          plan: Boolean(data.plan),
          warm: Boolean(this.warm),
          stopped: this.stopped,
        },
      });
      return;
    }
    const target = this.warm.targets.find((target) => target.key === lease.target.key),
      other = target && lease.resolve(target);
    if (
      !target ||
      !other ||
      !shown(other.root) ||
      !shown(other.model) ||
      this.key(target, this.warm.support) !== lease.key ||
      other.model !== lease.model ||
      other.root !== lease.root ||
      !this.poseMatches(lease, other) ||
      stamp(this.own, lease.stock) + '|' + stamp(other.model) !== lease.stamp
    ) {
      return;
    }
    if (
      !geometrySame(lease.own, this.ownRoot, this.own, lease.stock) ||
      !geometrySame(lease.other, other.root, other.model, lease.gun)
    ) {
      return;
    }
    if (!data.plan) {
      this.unavailable = lease;
      return;
    }
    this.unavailable = undefined;
    this.ready = { lease, data };
    performance.measure('granaderos-patient-ready-delivery', {
      start: at,
      duration: performance.now() - at,
      detail: { workerMs: data.workerMs, ready: true },
    });
  }
  override apply(
    cue: ActorCue | undefined,
    time: number,
    duration: number,
    resolve?: ContactActorResolver,
    now = time,
  ) {
    const at = performance.now(),
      native = () => {
        if (!cue) {
          return super.apply(undefined, time, duration, resolve, now);
        }
        const nativeCue = { ...cue };
        delete nativeCue.care;
        return super.apply(nativeCue, time, duration, resolve, now);
      };
    if (typeof Worker === 'undefined') {
      if (cue?.care?.mode === 'patient') {
        this.fallback = cue.id;
      }
      return native();
    }
    if (cue?.care?.mode !== 'patient' || !cue.healInterval || !resolve) {
      return native();
    }
    if (this.fallback === cue.id) {
      return native();
    }
    const other = resolve(cue.care.target),
      ready = this.ready;
    if (
      !ready ||
      !shown(this.ownRoot) ||
      !shown(this.own) ||
      !other ||
      !shown(other.root) ||
      !shown(other.model) ||
      !shown(ready.lease.stock) ||
      !shown(ready.lease.gun) ||
      !this.supplySame(ready.lease) ||
      ready.lease.gun.userData['itemId'] !==
        ready.lease.other.nodes.find((n) => n.id === ready.lease.gun.uuid)?.itemId ||
      other.model !== ready.lease.model ||
      other.root !== ready.lease.root ||
      this.key(cue.care.target, cue.care.support) !== ready.lease.key ||
      !this.poseMatches(ready.lease, other) ||
      stamp(this.own, ready.lease.stock) + '|' + stamp(other.model) !== ready.lease.stamp
    ) {
      this.fallback = cue.id;
      return native();
    }
    if (this.using !== cue.id) {
      if (
        (cue.phase && cue.phase !== 'prepare') ||
        time / duration > 0.08 ||
        !geometrySame(ready.lease.own, this.ownRoot, this.own, ready.lease.stock) ||
        !geometrySame(ready.lease.other, other.root, other.model, ready.lease.gun) ||
        !ready.data.plan ||
        !this.adopt(ready.data.plan, cue, other, ready.lease.stock, ready.data.lift)
      ) {
        this.fallback = cue.id;
        return native();
      }
      this.using = cue.id;
    }
    super.apply(cue, time, duration, resolve, now);
    performance.measure('granaderos-patient-ready-apply', {
      start: at,
      duration: performance.now() - at,
      detail: {
        ready: true,
        weight: this.contactWeight,
        phase: cue.phase,
        time,
        duration,
        using: this.using,
      },
    });
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
    this.ready = undefined;
    this.unavailable = undefined;
    this.lease = undefined;
    this.warm = undefined;
    super.dispose();
  }
}
