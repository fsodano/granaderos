import { Box3, Mesh, Matrix4, Object3D, Quaternion, Ray, SkinnedMesh, Triangle, Vector3 } from 'three';
import type { ActorCue } from './presentation';
import type { ContactActorResolver } from './melee-contact-fit';
import { TILE_METRES } from './projection';
const faceBone = (bone: Object3D) => /^thigh_[lr]$/.test(bone.name);
const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const visible = (n: Object3D) => {
    for (let p: Object3D | null = n; p; p = p.parent)
        if (!p.visible)
            return false;
    return true;
};
type Face = {
    mesh: SkinnedMesh;
    ids: [
        number,
        number,
        number
    ];
    bone: Object3D;
};
type Point = {
    mesh: SkinnedMesh;
    index: number;
};
type Influence = {
    bone: Object3D;
    point: Vector3;
    weight: number;
};
const finite = (v: Vector3) => v.toArray().every(Number.isFinite);
const frame = (long: Vector3, normal: Vector3) => {
    if (!finite(long) || !finite(normal) || long.lengthSq() < 1e-10)
        return;
    const y = long.clone().normalize(), z = normal.clone().addScaledVector(y, -normal.dot(y));
    if (z.lengthSq() < 1e-10)
        return;
    z.normalize();
    const x = y.clone().cross(z).normalize();
    return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
};
/** Fits one supported current-patient prone care path; native self-care is unchanged. */
export class NativePatientContactFit {
    private native: {
        node: Object3D;
        quaternion: Quaternion;
    }[] = [];
    private attemptedKey = "";
    private attemptedModel?: Object3D;
    private armBinding = "";
    private lastApplied?: {
        id: string;
        pose: {
            node: Object3D;
            quaternion: Quaternion;
        }[];
        wrist: Vector3;
        rotation: Quaternion;
        elbow: Vector3;
        workWrist: Vector3;
        workRotation: Quaternion;
        weight: number;
        elbowUp: number;
    };
    private returning?: {
        id: string;
        start: number;
        duration: number;
        pose: {
            node: Object3D;
            quaternion: Quaternion;
        }[];
        wrist: Vector3;
        rotation: Quaternion;
        elbow: Vector3;
        workWrist: Vector3;
        workRotation: Quaternion;
        weight: number;
        elbowUp: number;
    };
    private cancelled = "";
    private supplyOffsets = new WeakMap<Object3D, {
        id: string;
        lift: number;
    }>();
    private limb?: {
        upper: Object3D;
        lower: Object3D;
        hand: Object3D;
        a: number;
        b: number;
    };
    private fingers: Object3D[] = [];
    private fingerRest: Quaternion[] = [];
    private arm: Point[] = [];
    private long = new Vector3();
    private normal = new Vector3();
    private palm = new Vector3();
    private palms: {
        point: Point;
        local: Vector3;
    }[] = [];
    private influences = new WeakMap<Point, Influence[]>();
    private skinScratch = new Vector3();
    private faces = new WeakMap<Object3D, Face[]>();
    private plan?: {
        id: string;
        model: Object3D;
        face: Face;
        bary: Vector3;
        palm: Vector3;
        turn: number;
        tilt: number;
        axis?: Vector3;
        offset?: number;
        elbowUp?: number;
    };
    suppliesStowed = false;
    tilt = .15;
    pitch = .3;
    debug: any[] = [];
    contactError = Infinity;
    reachError = 0;
    floor = Infinity;
    rejected = 0;
    contactWeight = 0;
    surface?: Vector3;
    constructor(private model: Object3D, private root: Object3D) {
        const [upper, lower, hand] = ['upperarm_r', 'lowerarm_r', 'hand_r'].map(n => model.getObjectByName(n));
        if (!upper || !lower || !hand)
            return;
        const required = ['middle_01_r', 'index_01_r', 'pinky_01_r', ...['thumb', 'index', 'middle', 'ring', 'pinky'].flatMap(f => [1, 2, 3].map(i => `${f}_0${i}_r`))];
        if (required.some(n => !model.getObjectByName(n)))
            return;
        root.updateMatrixWorld(true);
        this.limb = { upper, lower, hand, a: upper.getWorldPosition(new Vector3()).distanceTo(lower.getWorldPosition(new Vector3())), b: lower.getWorldPosition(new Vector3()).distanceTo(hand.getWorldPosition(new Vector3())) };
        const inverse = new Matrix4().copy(hand.matrixWorld).invert(), wrist = hand.getWorldPosition(new Vector3()), middle = model.getObjectByName('middle_01_r')!.getWorldPosition(new Vector3()), across = model.getObjectByName('index_01_r')!.getWorldPosition(new Vector3()).sub(model.getObjectByName('pinky_01_r')!.getWorldPosition(new Vector3()));
        this.long.copy(middle).sub(wrist).normalize();
        this.normal.copy(across).cross(this.long).normalize();
        if (!finite(this.long) || !finite(this.normal) || this.long.lengthSq() < .5 || this.normal.lengthSq() < .5 || !Number.isFinite(this.limb.a) || !Number.isFinite(this.limb.b) || this.limb.a < 1e-5 || this.limb.b < 1e-5) {
            this.limb = undefined;
            return;
        }
        const invRotation = hand.getWorldQuaternion(new Quaternion()).invert();
        this.long.applyQuaternion(invRotation);
        this.normal.applyQuaternion(invRotation);
        this.fingers = ['thumb', 'index', 'middle', 'ring', 'pinky'].flatMap(f => [1, 2, 3].map(i => model.getObjectByName(`${f}_0${i}_r`)!));
        const fingerAxis = this.long.clone().cross(this.normal).applyQuaternion(hand.getWorldQuaternion(new Quaternion()));
        this.fingerRest = this.fingers.map(n => new Quaternion().setFromAxisAngle(fingerAxis.clone().applyQuaternion(n.parent!.getWorldQuaternion(new Quaternion()).invert()), n.name.includes('_01_') ? (n.name.startsWith('thumb_') ? -.45 : -.18) : n.name.includes('_02_') ? -.08 : -.05).multiply(n.quaternion));
    }
    restore() {
        for (const p of this.native)
            p.node.quaternion.copy(p.quaternion);
        this.native = [];
    }
    dispose() { this.restore(); }
    private bindCompleteArm() {
        const meshes: SkinnedMesh[] = [];
        this.model.traverse(n => {
            if (n instanceof SkinnedMesh)
                meshes.push(n);
        });
        const signature = meshes.map(n => n.uuid + ':' + n.geometry.uuid).join('|');
        if (signature === this.armBinding)
            return this.arm.length > 0 && this.palm.lengthSq() > 1e-10;
        this.armBinding = signature;
        this.arm = [];
        const palms: Vector3[] = [];
        for (const n of meshes) {
            const ix = n.geometry.attributes.skinIndex, w = n.geometry.attributes.skinWeight;
            for (let i = 0; i < ix.count; i++) {
                let total = 0, handWeight = 0, handIndex = -1;
                for (let j = 0; j < 4; j++) {
                    const bone = n.skeleton.bones[ix.getComponent(i, j)].name;
                    if (/^(upperarm|lowerarm|hand)_r$|^(thumb|index|middle|ring|pinky)_0[123]_r$/.test(bone))
                        total += w.getComponent(i, j);
                    if (bone === 'hand_r') {
                        handWeight += w.getComponent(i, j);
                        handIndex = ix.getComponent(i, j);
                    }
                }
                if (total > .7)
                    this.arm.push({ mesh: n, index: i });
                if (handWeight > .999999) {
                    const local = new Vector3().fromBufferAttribute(n.geometry.attributes.position, i).applyMatrix4(n.bindMatrix).applyMatrix4(n.skeleton.boneInverses[handIndex]);
                    palms.push(local);
                }
            }
        }
        if (palms.length)
            this.palm.copy(palms.reduce((a, b) => a.dot(this.normal) > b.dot(this.normal) ? a : b));
        return this.arm.length > 0 && palms.length > 0;
    }
    private signature(cue: ActorCue, target: Object3D) {
        const meshes: string[] = [];
        target.traverse(n => {
            if (n instanceof SkinnedMesh)
                meshes.push(n.uuid + ':' + n.geometry.uuid + ':' + visible(n) + ':' + (n.morphTargetInfluences ?? []).map(x => Math.round(x * 1e6)).join(','));
        });
        return JSON.stringify([cue.id, cue.care, meshes]);
    }
    private targetFaces(model: Object3D) {
        let faces = this.faces.get(model);
        if (faces)
            return faces;
        faces = [];
        model.traverse(n => {
            if (!(n instanceof SkinnedMesh) || !n.geometry.index)
                return;
            const ix = n.geometry.attributes.skinIndex, w = n.geometry.attributes.skinWeight, selected = new Map<number, Object3D>();
            for (let i = 0; i < ix.count; i++) {
                let total = 0, best = 0, bone: Object3D | undefined;
                for (let j = 0; j < 4; j++) {
                    const b = n.skeleton.bones[ix.getComponent(i, j)], v = w.getComponent(i, j);
                    if (/^(pelvis|spine_|thigh_)/.test(b.name)) {
                        total += v;
                        if (v > best) {
                            best = v;
                            bone = b;
                        }
                    }
                }
                if (total > .7 && bone)
                    selected.set(i, bone);
            }
            for (let i = 0; i < n.geometry.index.count; i += 3) {
                const ids = [0, 1, 2].map(j => n.geometry.index!.getX(i + j)) as [
                    number,
                    number,
                    number
                ];
                if (ids.every(id => selected.has(id)))
                    faces!.push({ mesh: n, ids, bone: selected.get(ids[0])! });
            }
        });
        this.faces.set(model, faces);
        return faces;
    }
    private triangle(face: Face) {
        return new Triangle(...face.ids.map(i => face.mesh.getVertexPosition(i, new Vector3()).applyMatrix4(face.mesh.matrixWorld)) as [
            Vector3,
            Vector3,
            Vector3
        ]);
    }
    private outward(face: Face, triangle: Triangle) { return triangle.getNormal(new Vector3()); }
    private handRotation(face: Face, turn = 0, tilt = 0) { const normal = this.outward(face, this.triangle(face)), axis = this.plan?.axis ?? new Vector3(0, -1, 0), long = axis.clone().addScaledVector(normal, -axis.dot(normal)).normalize().addScaledVector(normal, this.pitch).normalize(); const target = frame(long, normal.clone().negate().applyAxisAngle(long, tilt)), native = frame(this.long, this.normal); return target && native ? target.multiply(native.invert()) : undefined; }
    private select(cue: ActorCue, target: Object3D) {
        const shoulder = this.limb!.upper.getWorldPosition(new Vector3());
        let best = Infinity, face: Face | undefined, point: Vector3 | undefined;
        for (const f of this.targetFaces(target)) {
            if (!visible(f.mesh) || !/^thigh_[lr]$/.test(f.bone.name))
                continue;
            const triangle = this.triangle(f);
            if (triangle.getArea() < 1e-10)
                continue;
            const normal = this.outward(f, triangle);
            if (normal.y < .4)
                continue;
            const p = triangle.closestPointToPoint(shoulder, new Vector3()), hip = f.bone.getWorldPosition(new Vector3()), knee = f.bone.children.find(n => n.name.startsWith('calf_'))?.getWorldPosition(new Vector3());
            if (!knee)
                continue;
            const along = knee.sub(hip), fraction = p.clone().sub(hip).dot(along) / along.lengthSq();
            if (fraction < .35 || fraction > .78)
                continue;
            const distance = p.distanceTo(shoulder);
            if (distance >= best || normal.dot(shoulder.clone().sub(p)) < .05)
                continue;
            best = distance;
            face = f;
            point = p;
        }
        if (!face || !point)
            return;
        const bary = this.triangle(face).getBarycoord(point, new Vector3());
        if (!bary)
            return;
        return { id: cue.id, model: target, face, bary, palm: this.palm.clone(), turn: 0, tilt: this.tilt, axis: point.clone().sub(shoulder), offset: .002, elbowUp: .5 };
    }
    private calibrate(plan: NonNullable<NativePatientContactFit['plan']>) {
        const tri = this.triangle(plan.face), point = tri.a.clone().multiplyScalar(plan.bary.x).addScaledVector(tri.b, plan.bary.y).addScaledVector(tri.c, plan.bary.z), normal = tri.getNormal(new Vector3()), near: Triangle[] = [];
        plan.model.traverse(node => {
            if (!(node instanceof SkinnedMesh) || !visible(node) || !node.geometry.index)
                return;
            const positions = Array.from({ length: node.geometry.attributes.position.count }, (_, index) => node.getVertexPosition(index, new Vector3()).applyMatrix4(node.matrixWorld));
            for (let i = 0; i < node.geometry.index.count; i += 3) {
                const face = new Triangle(...[0, 1, 2].map(j => positions[node.geometry.index!.getX(i + j)]) as [
                    Vector3,
                    Vector3,
                    Vector3
                ]);
                if (face.getArea() > 1e-10 && face.closestPointToPoint(point, new Vector3()).distanceToSquared(point) < .13 * .13)
                    near.push(face);
            }
        });
        const across = normal.clone().cross(new Vector3(0, 1, 0));
        if (across.lengthSq() < 1e-8)
            across.crossVectors(normal, new Vector3(1, 0, 0));
        across.normalize();
        const along = normal.clone().cross(across).normalize(), cell = .025, grid = new Map<string, Triangle[]>();
        for (const face of near) {
            const xs = [face.a, face.b, face.c].map(v => v.dot(across)), ys = [face.a, face.b, face.c].map(v => v.dot(along));
            for (let x = Math.floor(Math.min(...xs) / cell); x <= Math.floor(Math.max(...xs) / cell); x++)
                for (let y = Math.floor(Math.min(...ys) / cell); y <= Math.floor(Math.max(...ys) / cell); y++) {
                    const key = x + ',' + y;
                    if (!grid.has(key))
                        grid.set(key, []);
                    grid.get(key)!.push(face);
                }
        }
        const limb = this.limb!, modified = [limb.upper, limb.lower, limb.hand, ...this.fingers], before = modified.map(node => ({ node, quaternion: node.quaternion.clone() })), reset = () => {
            for (const p of before)
                p.node.quaternion.copy(p.quaternion);
            limb.upper.updateWorldMatrix(false, true);
        }, direction = normal.clone().negate();
        let result = false;
        const previous = this.plan;
        this.plan = plan;
        try {
            for (let pass = 0; pass < 4; pass++) {
                reset();
                for (let i = 0; i < this.fingers.length; i++)
                    this.fingers[i].quaternion.copy(this.fingerRest[i]);
                const rotation = this.handRotation(plan.face, plan.turn, plan.tilt);
                if (!rotation)
                    break;
                const wrist = point.clone().addScaledVector(normal, plan.offset ?? .002).sub(plan.palm.clone().applyQuaternion(rotation));
                if (!this.solve(wrist, rotation, .5))
                    break;
                let gap = Infinity, contacts = 0;
                for (const p of this.arm) {
                    if (!visible(p.mesh))
                        continue;
                    const v = p.mesh.getVertexPosition(p.index, new Vector3()).applyMatrix4(p.mesh.matrixWorld), origin = v.clone().addScaledVector(normal, .16), ray = new Ray(origin, direction);
                    if (v.distanceToSquared(point) > .13 * .13)
                        continue;
                    let distance = Infinity;
                    for (const face of grid.get(Math.floor(v.dot(across) / cell) + ',' + Math.floor(v.dot(along) / cell)) ?? []) {
                        const hit = ray.intersectTriangle(face.a, face.b, face.c, false, new Vector3());
                        if (hit && hit.distanceToSquared(point) < .13 * .13)
                            distance = Math.min(distance, origin.distanceTo(hit));
                    }
                    if (Number.isFinite(distance) && distance < .32) {
                        gap = Math.min(gap, distance - .16);
                        contacts++;
                    }
                }
                this.debug.push({ pass, gap, offset: plan.offset, contacts, near: near.length });
                if (!contacts || !Number.isFinite(gap))
                    break;
                if (gap >= .0025 - 1e-6) {
                    result = true;
                    break;
                }
                plan.offset = (plan.offset ?? .002) + (.0025 - gap) + .0001;
                if (plan.offset > .025)
                    break;
            }
        }
        finally {
            reset();
            this.plan = previous;
        }
        return result;
    }
    private looseGarment(model: Object3D) {
        let loose = false;
        model.traverse(n => {
            if (n instanceof Mesh && visible(n) && n.morphTargetDictionary?.cloth_prone !== undefined)
                loose = true;
        });
        return loose;
    }
    private supportedPose(cue: ActorCue, target: {
        model: Object3D;
        root: Object3D;
    }) {
        if (cue.care?.mode !== 'patient' || cue.care.target.mounted || cue.care.target.action !== 'idle' || this.looseGarment(this.model) || this.looseGarment(target.model))
            return false;
        const own = this.root.getWorldQuaternion(new Quaternion()), forward = new Vector3(0, 0, 1).applyQuaternion(own), right = new Vector3(1, 0, 0).applyQuaternion(own), delta = target.root.getWorldPosition(new Vector3()).sub(this.root.getWorldPosition(new Vector3())), relative = own.invert().multiply(target.root.getWorldQuaternion(new Quaternion())), expected = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 4);
        return delta.toArray().every(Number.isFinite) && Math.abs(delta.dot(forward) - TILE_METRES) < 1e-5 && Math.abs(delta.dot(right)) < 1e-5 && Math.abs(delta.y) < 1e-5 && relative.angleTo(expected) < 1e-5;
    }
    private solve(target: Vector3, rotation: Quaternion, elbowUp: number, poleOverride?: Vector3) {
        if (!finite(target) || !rotation.toArray().every(Number.isFinite) || !Number.isFinite(elbowUp))
            return false;
        const { upper: u, lower: l, hand: h, a, b } = this.limb!, s = u.getWorldPosition(new Vector3()), e = l.getWorldPosition(new Vector3()), w = h.getWorldPosition(new Vector3()), direction = target.clone().sub(s), distance = direction.length();
        if (!Number.isFinite(distance) || distance > a + b - .002 || distance < Math.abs(a - b) + .002)
            return false;
        direction.normalize();
        const pole = poleOverride ? poleOverride.clone().sub(s) : e.clone().sub(s).add(new Vector3(0, elbowUp, 0));
        pole.addScaledVector(direction, -pole.dot(direction)).normalize();
        if (pole.lengthSq() < 1e-8)
            return false;
        const along = (a * a - b * b + distance * distance) / (2 * distance), joint = s.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
        const uq = new Quaternion().setFromUnitVectors(e.clone().sub(s).normalize(), joint.clone().sub(s).normalize()).multiply(u.getWorldQuaternion(new Quaternion()));
        u.quaternion.copy(u.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(uq));
        u.updateWorldMatrix(false, true);
        const nowE = l.getWorldPosition(new Vector3()), nowW = h.getWorldPosition(new Vector3()), lq = new Quaternion().setFromUnitVectors(nowW.clone().sub(nowE).normalize(), target.clone().sub(joint).normalize()).multiply(l.getWorldQuaternion(new Quaternion()));
        l.quaternion.copy(l.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(lq));
        l.updateWorldMatrix(false, true);
        h.quaternion.copy(h.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(rotation));
        h.updateWorldMatrix(false, true);
        return true;
    }
    private skinPoint(p: Point, target: Vector3) {
        const mesh = p.mesh;
        if (mesh.bindMode !== 'attached' || mesh.geometry.morphAttributes.position?.length)
            return mesh.localToWorld(mesh.getVertexPosition(p.index, target));
        let influences = this.influences.get(p);
        if (!influences) {
            const native = new Vector3().fromBufferAttribute(mesh.geometry.attributes.position, p.index).applyMatrix4(mesh.bindMatrix), ix = mesh.geometry.attributes.skinIndex, w = mesh.geometry.attributes.skinWeight;
            influences = [];
            for (let j = 0; j < 4; j++) {
                const weight = w.getComponent(p.index, j), index = ix.getComponent(p.index, j);
                if (weight > 0)
                    influences.push({ bone: mesh.skeleton.bones[index], point: native.clone().applyMatrix4(mesh.skeleton.boneInverses[index]), weight });
            }
            this.influences.set(p, influences);
        }
        let x = 0, y = 0, z = 0;
        for (const i of influences) {
            const p = i.point, e = i.bone.matrixWorld.elements, div = 1 / (e[3] * p.x + e[7] * p.y + e[11] * p.z + e[15]);
            x += ((e[0] * p.x + e[4] * p.y + e[8] * p.z + e[12]) * div) * i.weight;
            y += ((e[1] * p.x + e[5] * p.y + e[9] * p.z + e[13]) * div) * i.weight;
            z += ((e[2] * p.x + e[6] * p.y + e[10] * p.z + e[14]) * div) * i.weight;
        }
        return target.set(x, y, z);
    }
    private lowest() {
        let min = Infinity;
        for (const p of this.arm) {
            if (!visible(p.mesh))
                continue;
            min = Math.min(min, this.skinPoint(p, this.skinScratch).y);
        }
        return min - this.root.getWorldPosition(new Vector3()).y;
    }
    calibration() { return { long: this.long.toArray(), normal: this.normal.toArray(), fingerRest: this.fingerRest.map(q => q.toArray()), a: this.limb?.a, b: this.limb?.b }; }
    useCalibration(data: any) {
        if (!this.limb || !data)
            return;
        this.long.fromArray(data.long);
        this.normal.fromArray(data.normal);
        this.fingerRest = data.fingerRest.map((q: number[]) => new Quaternion().fromArray(q));
        this.limb.a = data.a;
        this.limb.b = data.b;
    }
    prepare(cue: ActorCue, target: {
        model: Object3D;
        root: Object3D;
    }) {
        if (!this.limb || !this.supportedPose(cue, target) || !this.bindCompleteArm())
            return;
        const plan = this.select(cue, target.model);
        if (!plan || !this.calibrate(plan))
            return;
        this.plan = plan;
        const groups = new Map<string, number[]>();
        for (const p of this.arm) {
            if (!groups.has(p.mesh.uuid))
                groups.set(p.mesh.uuid, []);
            groups.get(p.mesh.uuid)!.push(p.index);
        }
        return { face: { mesh: plan.face.mesh.uuid, ids: plan.face.ids, bone: plan.face.bone.name }, bary: plan.bary.toArray(), palm: plan.palm.toArray(), axis: plan.axis?.toArray(), offset: plan.offset, turn: plan.turn, tilt: plan.tilt, elbowUp: plan.elbowUp, arm: [...groups].map(([mesh, indices]) => ({ mesh, indices })) };
    }
    adopt(data: any, cue: ActorCue, target: {
        model: Object3D;
        root: Object3D;
    }, supply?: Object3D, lift?: number) {
        const mesh = target.model.getObjectByProperty('uuid', data.face.mesh), bone = target.model.getObjectByName(data.face.bone);
        if (!(mesh instanceof SkinnedMesh) || !bone)
            return false;
        const arm: Point[] = [];
        for (const group of data.arm) {
            const mesh = this.model.getObjectByProperty('uuid', group.mesh);
            if (!(mesh instanceof SkinnedMesh))
                return false;
            for (const index of group.indices)
                arm.push({ mesh, index });
        }
        this.arm = arm;
        this.plan = { id: cue.id, model: target.model, face: { mesh, bone, ids: data.face.ids }, bary: new Vector3().fromArray(data.bary), palm: new Vector3().fromArray(data.palm), axis: new Vector3().fromArray(data.axis), offset: data.offset, turn: data.turn, tilt: data.tilt, elbowUp: data.elbowUp };
        this.attemptedKey = this.signature(cue, target.model);
        this.attemptedModel = target.model;
        this.palm.fromArray(data.palm);
        if (supply && Number.isFinite(lift))
            this.supplyOffsets.set(supply, { id: cue.id, lift: lift! });
        return true;
    }
    stowSupply(object: Object3D) {
        if (!this.suppliesStowed || !object.parent)
            return;
        const id = this.plan?.id ?? this.returning?.id;
        if (!id)
            return;
        let saved = this.supplyOffsets.get(object);
        if (!saved || saved.id !== id) {
            object.updateWorldMatrix(true, true);
            const box = new Box3().setFromObject(object), footprint = box.clone().expandByScalar(.012);
            let top = -Infinity;
            this.model.traverse(node => {
                if (!(node instanceof SkinnedMesh) || !visible(node))
                    return;
                for (let i = 0; i < node.geometry.attributes.position.count; i++) {
                    const p = node.getVertexPosition(i, new Vector3()).applyMatrix4(node.matrixWorld);
                    if (p.x >= footprint.min.x && p.x <= footprint.max.x && p.z >= footprint.min.z && p.z <= footprint.max.z)
                        top = Math.max(top, p.y);
                }
            });
            const lift = Number.isFinite(top) ? Math.max(0, top + .0025 - box.min.y) : 0;
            saved = { id, lift };
            this.supplyOffsets.set(object, saved);
        }
        const offset = new Vector3(0, saved.lift, 0).applyQuaternion(object.parent.getWorldQuaternion(new Quaternion()).invert());
        object.position.add(offset);
    }
    private cancel(cue: ActorCue | undefined, now: number, remaining = .56) {
        this.plan = undefined;
        if (cue?.action !== 'heal' || !Number.isFinite(now)) {
            this.lastApplied = undefined;
            this.returning = undefined;
            return;
        }
        if (!this.returning && this.lastApplied?.id === cue.id) {
            this.cancelled = cue.id;
            this.returning = { ...this.lastApplied, start: now, duration: Math.min(.56, Math.max(1 / 240, remaining)) };
            this.lastApplied = undefined;
        }
        const back = this.returning;
        if (!back || back.id !== cue.id)
            return;
        this.root.updateMatrixWorld(true);
        const weight = back.weight * (1 - smooth((now - back.start) / back.duration));
        if (weight <= 1e-8) {
            this.returning = undefined;
            return;
        }
        this.native = back.pose.map(({ node }) => ({ node, quaternion: node.quaternion.clone() }));
        const limb = this.limb!, wrist = limb.hand.getWorldPosition(new Vector3()).lerp(back.workWrist, weight).add(new Vector3(0, .225 * Math.sin(Math.PI * weight), 0)), rotation = limb.hand.getWorldQuaternion(new Quaternion()).slerp(back.workRotation, weight), pole = limb.lower.getWorldPosition(new Vector3()).add(new Vector3(0, back.elbowUp * weight, 0));
        for (let i = 0; i < this.fingers.length; i++)
            this.fingers[i].quaternion.slerp(this.fingerRest[i], weight);
        if (!this.solve(wrist, rotation, 0, pole)) {
            this.restore();
            this.returning = undefined;
            this.rejected++;
            return;
        }
        this.floor = this.lowest();
        if (this.floor < .0015) {
            this.restore();
            this.returning = undefined;
            this.rejected++;
            return;
        }
        this.suppliesStowed = true;
    }
    apply(cue: ActorCue | undefined, time: number, duration: number, resolver?: ContactActorResolver, now = time) {
        this.contactError = Infinity;
        this.reachError = 0;
        this.contactWeight = 0;
        this.floor = Infinity;
        this.rejected = 0;
        this.surface = undefined;
        this.suppliesStowed = false;
        if (!this.limb || cue?.care?.mode !== 'patient' || cue.care.target.posture !== 'prone' || !cue.healInterval || !resolver || !Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0) {
            this.cancel(cue, now, Number.isFinite(duration - time) ? duration - time : .56);
            this.attemptedKey = "";
            this.attemptedModel = undefined;
            return;
        }
        const target = resolver(cue.care.target);
        if (!target || target.model === this.model) {
            this.cancel(cue, now, Number.isFinite(duration - time) ? duration - time : .56);
            return;
        }
        this.root.updateMatrixWorld(true);
        target.root.updateMatrixWorld(true);
        if (!this.supportedPose(cue, target)) {
            this.cancel(cue, now, Number.isFinite(duration - time) ? duration - time : .56);
            return;
        }
        if (this.cancelled === cue.id) {
            this.cancel(cue, now, Number.isFinite(duration - time) ? duration - time : .56);
            return;
        }
        const signature = this.signature(cue, target.model);
        if (signature !== this.attemptedKey || this.attemptedModel !== target.model) {
            if (this.lastApplied?.id === cue.id) {
                this.cancel(cue, now, Number.isFinite(duration - time) ? duration - time : .56);
                return;
            }
            if (!this.bindCompleteArm()) {
                this.cancel(cue, now, Number.isFinite(duration - time) ? duration - time : .56);
                return;
            }
            this.attemptedKey = signature;
            this.attemptedModel = target.model;
            const plan = this.select(cue, target.model);
            this.plan = plan && this.calibrate(plan) ? plan : undefined;
        }
        if (!this.plan || !visible(this.plan.face.mesh)) {
            this.cancel(cue, now, Number.isFinite(duration - time) ? duration - time : .56);
            this.rejected++;
            return;
        }
        const phase = time / duration;
        this.suppliesStowed = phase < .94;
        const weight = Math.min(smooth((phase - .08) / .32), smooth((.94 - phase) / .24));
        this.contactWeight = weight;
        if (weight <= 1e-8) {
            this.lastApplied = undefined;
            this.returning = undefined;
            return;
        }
        const tri = this.triangle(this.plan.face), bary = this.plan.bary, point = tri.a.clone().multiplyScalar(bary.x).addScaledVector(tri.b, bary.y).addScaledVector(tri.c, bary.z), desired = this.handRotation(this.plan.face, this.plan.turn, this.plan.tilt);
        if (!desired)
            return;
        const wrist = point.clone().addScaledVector(this.outward(this.plan.face, tri), this.plan.offset ?? .002).sub(this.plan.palm.clone().applyQuaternion(desired)), limb = this.limb, nativeWrist = limb.hand.getWorldPosition(new Vector3()), nativeRotation = limb.hand.getWorldQuaternion(new Quaternion()), targetWrist = nativeWrist.lerp(wrist, weight).add(new Vector3(0, .225 * Math.sin(Math.PI * weight), 0)), targetRotation = nativeRotation.slerp(desired, weight);
        this.surface = point;
        this.reachError = Math.max(0, targetWrist.distanceTo(limb.upper.getWorldPosition(new Vector3())) - (limb.a + limb.b - .002));
        if (this.reachError > 1e-7) {
            this.rejected++;
            return;
        }
        const modified = [limb.upper, limb.lower, limb.hand, ...this.fingers];
        this.native = modified.map(node => ({ node, quaternion: node.quaternion.clone() }));
        const reset = () => {
            for (const p of this.native)
                p.node.quaternion.copy(p.quaternion);
            limb.upper.updateWorldMatrix(false, true);
        };
        let safe = false;
        for (const lift of [0]) {
            reset();
            for (let i = 0; i < this.fingers.length; i++)
                this.fingers[i].quaternion.slerp(this.fingerRest[i], weight);
            if (!this.solve(targetWrist, targetRotation, (this.plan.elbowUp ?? .35) * weight))
                continue;
            this.floor = this.lowest();
            if (this.floor >= .0015) {
                safe = true;
                break;
            }
        }
        if (!safe) {
            this.restore();
            this.rejected++;
            this.cancel(cue, now, Number.isFinite(duration - time) ? duration - time : .56);
            return;
        }
        this.lastApplied = { id: cue.id, pose: modified.map(node => ({ node, quaternion: node.quaternion.clone() })), wrist: limb.hand.getWorldPosition(new Vector3()), rotation: limb.hand.getWorldQuaternion(new Quaternion()), elbow: limb.lower.getWorldPosition(new Vector3()), workWrist: wrist.clone(), workRotation: desired.clone(), weight, elbowUp: this.plan.elbowUp ?? .35 };
        this.contactError = limb.hand.localToWorld(this.plan.palm.clone()).distanceTo(point.clone().addScaledVector(this.outward(this.plan.face, tri), this.plan.offset ?? .002));
    }
}
