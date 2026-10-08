import { Object3D, Vector3, Quaternion, AnimationClip } from 'three';
import { NativePatientContactFit } from './heal-patient-contact-fit';
import { snapshotActor, clipSnapshot, type ActorSnapshot } from './melee-worker-snapshot';
import { geometrySame, clipSame } from './melee-ready-contact-fit';
import type { ActorCue, ContactTarget, ContactSupport } from './presentation';
import type { ContactActorResolver } from './melee-contact-fit';
import workerUrl from './heal-patient-fit-worker?worker&url';
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
    pose: string;
    stamp: string;
    native?: {
        clip: AnimationClip;
        data: any;
        rows?: {
            node: Object3D;
            property: string;
            sample: any;
        }[];
    };
};
let worker: Worker | undefined, owner: NativeReadyPatientContactFit | undefined, sequence = 0, references = 0, watchdog: ReturnType<typeof setTimeout> | undefined;
function shown(node: Object3D) {
    for (let n: Object3D | null = node; n; n = n.parent)
        if (!n.visible)
            return false;
    return true;
}
function prop(model: Object3D) {
    let found: Object3D | undefined;
    model.traverse(n => {
        if (!found && typeof n.userData.itemId === 'string' && shown(n))
            found = n;
    });
    return found;
}
function pose(model: Object3D) { return JSON.stringify(['Root', 'pelvis', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r'].map(name => { const n = model.getObjectByName(name); return n ? [n.name, n.position.toArray(), n.quaternion.toArray(), n.scale.toArray()] : null; })); }
function patientPose(model: Object3D) { const rows: any[] = []; model.traverse((n: any) => { if (n.isBone)
    rows.push([n.name, n.position.toArray(), n.quaternion.toArray(), n.scale.toArray()]); }); return JSON.stringify(rows.sort((a, b) => a[0].localeCompare(b[0]))); }
function poseSame(a: string, b: string) {
    const left = a.split('|').flatMap(part => JSON.parse(part)), right = b.split('|').flatMap(part => JSON.parse(part));
    if (left.length !== right.length)
        return false;
    return left.every((entry: any, i: number) => {
        const other = right[i];
        if (!entry || !other)
            return entry === other;
        if (entry[0] !== other[0] || entry[1].some((n: number, j: number) => !Number.isFinite(n) || !Number.isFinite(other[1][j]) || Math.abs(n - other[1][j]) > 1e-6) || entry[3].some((n: number, j: number) => !Number.isFinite(n) || !Number.isFinite(other[3][j]) || Math.abs(n - other[3][j]) > 1e-6))
            return false;
        const distance = (sign: number) => Math.hypot(...entry[2].map((n: number, j: number) => n - sign * other[2][j]));
        return entry[2].every(Number.isFinite) && other[2].every(Number.isFinite) && Math.min(distance(1), distance(-1)) <= .000002;
    });
}
function stamp(model: Object3D, supply?: Object3D) {
    const records: any[] = [], skins = new Set<any>();
    model.traverse((n: any) => {
        if (!n.isBone && n !== supply)
            records.push([n.uuid, n.parent?.uuid, n.visible, n.position.toArray(), n.quaternion.toArray(), n.scale.toArray(), n.userData.itemId]);
        if (n.isMesh) {
            records.push([n.uuid, n.geometry.uuid, shown(n), Object.entries(n.geometry.attributes).map(([name, a]: any) => [name, a.version, a.count]), n.geometry.index?.version, n.morphTargetInfluences, n.isSkinnedMesh ? [n.skeleton.uuid, n.skeleton.bones.map((b: Object3D) => b.uuid), n.bindMatrix.toArray(), n.bindMode] : undefined]);
            if (n.isSkinnedMesh)
                skins.add(n.skeleton);
        }
    });
    records.sort((a, b) => a[0].localeCompare(b[0]));
    return JSON.stringify([records, [...skins].map(skin => [skin.uuid, skin.boneInverses.map((m: any) => m.toArray())]).sort((a, b) => a[0].localeCompare(b[0]))]);
}
/** Only current selected-patient preparation runs in the worker. A late,
 * missing or stale plan keeps native care for that entire admitted cue. */
export class NativeReadyPatientContactFit extends NativePatientContactFit {
    private stopped = false;
    private warm?: Warm;
    private lease?: Lease;
    private ready?: {
        lease: Lease;
        data: any;
    };
    private fallback = '';
    private using = '';
    private registered = false;
    private unavailable?: Lease;
    constructor(private own: Object3D, private ownRoot: Object3D) {
        super(own, ownRoot);
        this.registered = typeof Worker !== 'undefined';
        if (this.registered)
            references++;
    }
    private supplySame(lease: Lease) {
        const record = lease.own.nodes.find(n => n.id === lease.stock.uuid);
        if (!record || lease.stock.userData.itemId !== record.itemId)
            return false;
        const position = new Vector3().fromArray(record.position);
        let parent = record.parent >= 0 ? lease.own.nodes[record.parent].id : undefined;
        if (this.suppliesStowed) {
            parent = lease.hip.uuid;
            position.add(new Vector3(0, this.ready?.data.lift ?? 0, 0).applyQuaternion(lease.hip.getWorldQuaternion(new Quaternion()).invert()));
        }
        return lease.stock.parent?.uuid === parent && lease.stock.position.distanceTo(position) < 1e-6 && lease.stock.quaternion.angleTo(new Quaternion().fromArray(record.quaternion)) < 1e-6 && lease.stock.scale.distanceTo(new Vector3().fromArray(record.scale)) < 1e-6;
    }
    private poseMatches(lease: Lease, other: any) {
        if (!poseSame(pose(this.own), lease.pose.split('|')[0]))
            return false;
        const source = lease.native;
        if (!source)
            return poseSame(patientPose(other.model), lease.pose.split('|')[1]);
        const native = other.nativePose;
        if (!native || native.clip !== source.clip || native.clip.name !== 'prone.idle.long-gun' || !Number.isFinite(native.time) || !Number.isFinite(native.weight) || native.weight < 1 - 1e-6 || native.weight > 1 + 1e-6 || native.time < 0 || native.time > native.clip.duration + 1e-6 || !clipSame(native.clip, source.data))
            return false;
        if (!source.rows) {
            const copy = AnimationClip.parse(source.data);
            source.rows = copy.tracks.map(track => { const [name, property] = track.name.split('.'); return { node: other.model.getObjectByName(name), property, sample: (track as any).createInterpolant() }; });
        }
        return source.rows.every(row => { if (!row.node)
            return false; const actual = (row.node as any)[row.property]?.toArray(), expected = row.sample.evaluate(native.time); if (!actual || actual.length !== expected.length || !actual.every(Number.isFinite))
            return false; if (row.property === 'quaternion') {
            const distance = (sign: number) => Math.hypot(...actual.map((n: number, i: number) => n - sign * expected[i]));
            return Math.min(distance(1), distance(-1)) <= 2e-6;
        } return actual.every((n: number, i: number) => Number.isFinite(expected[i]) && Math.abs(n - expected[i]) <= 1e-6); });
    }
    private key(target: ContactTarget, support: ContactSupport) { return JSON.stringify([this.ownRoot.uuid, this.own.uuid, this.ownRoot.position.toArray(), this.ownRoot.quaternion.toArray(), this.ownRoot.scale.toArray(), this.own.position.toArray(), this.own.quaternion.toArray(), this.own.scale.toArray(), this.ownRoot.parent?.matrixWorld.toArray(), target, support]); }
    prewarm(warm: Warm | undefined, stock: Object3D | undefined, hip: Object3D | undefined, resolve?: ContactActorResolver) {
        this.warm = warm;
        if (this.stopped || typeof Worker === 'undefined' || !warm || !stock || !hip || !resolve || !shown(this.ownRoot) || !shown(stock))
            return;
        const target = warm.targets.find(target => { const other = resolve(target); const cue: ActorCue = { id: 'probe', action: 'heal', startedAt: 0, healInterval: true, care: { mode: 'patient', target, support: warm.support } }; return other && shown(other.root) && shown(other.model) && (this as any).supportedPose(cue, other); });
        if (!target)
            return;
        const other = resolve(target);
        if (!other)
            return;
        if (other.nativePose && (other.nativePose.clip.name !== 'prone.idle.long-gun' || !Number.isFinite(other.nativePose.time) || !Number.isFinite(other.nativePose.weight) || other.nativePose.weight < 1 - 1e-6 || other.nativePose.weight > 1 + 1e-6))
            return;
        const gun = prop(other.model);
        if (!gun)
            return;
        const key = this.key(target, warm.support), bodyPose = pose(this.own) + '|' + patientPose(other.model), geometryStamp = stamp(this.own, stock) + '|' + stamp(other.model), ready = this.ready;
        if (ready && ready.lease.key === key && ready.lease.model === other.model && ready.lease.stock === stock && this.poseMatches(ready.lease, other) && ready.lease.stamp === geometryStamp)
            return;
        const unavailable = this.unavailable;
        if (unavailable && unavailable.key === key && unavailable.model === other.model && unavailable.stock === stock && this.poseMatches(unavailable, other) && unavailable.stamp === geometryStamp)
            return;
        if (owner)
            return;
        this.ready = undefined;
        const at = performance.now(), id = ++sequence, own = snapshotActor(this.ownRoot, this.own, stock), packet = snapshotActor(other.root, other.model, gun), cue: ActorCue = { id: 'warm:' + id, action: 'heal', startedAt: 0, healInterval: true, care: { mode: 'patient', target, support: warm.support } };
        this.lease = { id, key, own, other: packet, target, model: other.model, root: other.root, stock, gun, hip, resolve, pose: bodyPose, stamp: geometryStamp, native: other.nativePose ? { clip: other.nativePose.clip, data: clipSnapshot(other.nativePose.clip) } : undefined };
        owner = this;
        if (!worker) {
            try {
                worker = new Worker(workerUrl, { type: 'module' });
            }
            catch {
                owner = undefined;
                this.stopped = true;
                return;
            }
            worker.onmessage = event => {
                const current = owner;
                if (!current || current.lease?.id !== event.data.id)
                    return;
                owner = undefined;
                if (watchdog)
                    clearTimeout(watchdog);
                watchdog = undefined;
                if (event.data.error !== undefined) {
                    current.stopped = true;
                    return;
                }
                current.receive(event.data);
            };
            worker.onerror = () => {
                if (watchdog)
                    clearTimeout(watchdog);
                watchdog = undefined;
                if (owner)
                    owner.stopped = true;
                owner = undefined;
                worker?.terminate();
                worker = undefined;
            };
        }
        try {
            worker.postMessage({ id, own, target: packet, calibration: this.calibration(), cue, hip: hip.uuid });
            watchdog = setTimeout(() => {
                if (owner === this && this.lease?.id === id) {
                    owner = undefined;
                    this.stopped = true;
                    worker?.terminate();
                    worker = undefined;
                }
                watchdog = undefined;
            }, 5000);
        }
        catch {
            owner = undefined;
            this.stopped = true;
            worker?.terminate();
            worker = undefined;
        }
        performance.measure('granaderos-patient-ready-snapshot', { start: at, duration: performance.now() - at });
    }
    private receive(data: any) {
        const at = performance.now(), lease = this.lease;
        if (this.stopped || !lease || lease.id !== data.id || !this.warm || !shown(this.ownRoot) || !shown(this.own)) {
            performance.measure('granaderos-patient-ready-rejected', { start: performance.now(), duration: 0, detail: { plan: Boolean(data.plan), warm: Boolean(this.warm), stopped: this.stopped } });
            return;
        }
        const target = this.warm.targets.find(target => target.key === lease.target.key), other = target && lease.resolve(target);
        if (!target || !other || !shown(other.root) || !shown(other.model) || this.key(target, this.warm.support) !== lease.key || other.model !== lease.model || other.root !== lease.root || !this.poseMatches(lease, other) || stamp(this.own, lease.stock) + '|' + stamp(other.model) !== lease.stamp)
            return;
        if (!geometrySame(lease.own, this.ownRoot, this.own, lease.stock) || !geometrySame(lease.other, other.root, other.model, lease.gun))
            return;
        if (!data.plan) {
            this.unavailable = lease;
            return;
        }
        this.unavailable = undefined;
        this.ready = { lease, data };
        performance.measure('granaderos-patient-ready-delivery', { start: at, duration: performance.now() - at, detail: { workerMs: data.workerMs, ready: true } });
    }
    override apply(cue: ActorCue | undefined, time: number, duration: number, resolve?: ContactActorResolver, now = time) {
        const at = performance.now(), native = () => super.apply(cue ? { ...cue, care: undefined } : undefined, time, duration, resolve, now);
        if (typeof Worker === 'undefined') {
            if (cue?.care?.mode === 'patient') this.fallback = cue.id;
            return native();
        }
        if (cue?.care?.mode !== 'patient' || !cue.healInterval || !resolve)
            return native();
        if (this.fallback === cue.id)
            return native();
        const other = resolve(cue.care.target), ready = this.ready;
        if (!ready || !shown(this.ownRoot) || !shown(this.own) || !other || !shown(other.root) || !shown(other.model) || !shown(ready.lease.stock) || !shown(ready.lease.gun) || !this.supplySame(ready.lease) || ready.lease.gun.userData.itemId !== ready.lease.other.nodes.find(n => n.id === ready.lease.gun.uuid)?.itemId || other.model !== ready.lease.model || other.root !== ready.lease.root || this.key(cue.care.target, cue.care.support) !== ready.lease.key || !this.poseMatches(ready.lease, other) || stamp(this.own, ready.lease.stock) + '|' + stamp(other.model) !== ready.lease.stamp) {
            this.fallback = cue.id;
            return native();
        }
        if (this.using !== cue.id) {
            if (cue.phase && cue.phase !== 'prepare' || time / duration > .08 || !geometrySame(ready.lease.own, this.ownRoot, this.own, ready.lease.stock) || !geometrySame(ready.lease.other, other.root, other.model, ready.lease.gun) || !this.adopt(ready.data.plan, cue, other, ready.lease.stock, ready.data.lift)) {
                this.fallback = cue.id;
                return native();
            }
            this.using = cue.id;
        }
        super.apply(cue, time, duration, resolve, now);
        performance.measure('granaderos-patient-ready-apply', { start: at, duration: performance.now() - at, detail: { ready: true, weight: this.contactWeight, phase: cue.phase, time, duration, using: this.using } });
    }
    override dispose() {
        this.stopped = true;
        if (this.registered) {
            references--;
            this.registered = false;
        }
        if (owner === this || references === 0) {
            if (watchdog)
                clearTimeout(watchdog);
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
