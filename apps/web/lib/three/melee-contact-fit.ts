import { isMesh, isSkinnedMesh } from './scene-node-types';
import { required } from './required';
import type { LowerPathCache, LowerPoseRow, LowerRecipe } from './melee-lower-path-cache';
import type { NativePoseCache, SettledPoseCache, SettledPoseRow } from './melee-native-pose-cache';
import type { Calibration } from './melee-worker-snapshot';
import type { ContactActorModel } from './contact-target-model';
import {
  AnimationAction,
  Bone,
  AnimationClip,
  AnimationMixer,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  Skeleton,
  SkinnedMesh,
  Triangle,
  Vector3,
} from 'three';
import type { ClipSpec } from './actor-assets';
import type { ActorCue, ContactTarget, ContactSupport } from './presentation';
import { animationPhaseRange } from './animation-clock';
export type ContactActorResolver = (target: ContactTarget) => ContactActorModel | undefined;
type Limb = {
  base: Object3D;
  middle: Object3D;
  end: Object3D;
  first: number;
  second: number;
};
type Sole = {
  mesh: SkinnedMesh;
  vertices: number[];
  outline: number[];
  floor: number;
};
type SkinInfluence = {
  bone: Object3D;
  point: Vector3;
  weight: number;
};
type NativePathSample = {
  time: number;
  shoulder: Vector3;
  hand: Vector3;
  hips: Vector3[];
  feet: Vector3[];
  soleMin: number[];
};
export type MeleePosePlan = {
  hand: Vector3;
  handFrom?: Vector3;
  handHandoffBegin?: number;
  body: Vector3;
  step: Vector3;
  rearStep: Vector3;
  contact: number;
  duration: number;
  pistol?: boolean;
  sabre?: boolean;
  twoHands?: boolean;
  handRecovery?: number;
  yaw?: number;
  turn?:
    | {
        fromYaw: number;
        toYaw: number;
        until: number;
        footDistance: number;
      }
    | undefined;
};
type Plan = MeleePosePlan & {
  key: string;
  cueId: string;
  target: Object3D;
};
function samplingNodes(model: Object3D, root?: Object3D) {
  const result: Object3D[] = root ? [root] : [];
  model.traverse((node) => {
    if (!isMesh(node)) {
      result.push(node);
    }
  });
  return result;
}
const meleeRecipeKey = (plan: MeleePosePlan) =>
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
const up = new Vector3(0, 1, 0);
const angle = (value: number) => Math.atan2(Math.sin(value), Math.cos(value));
const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
function visible(node: Object3D) {
  let current: Object3D | null = node;
  while (current) {
    if (!current.visible) {
      return false;
    }
    current = current.parent;
  }
  return true;
}
function poseTree(source: Object3D): Object3D | undefined {
  if (isMesh(source)) {
    return;
  }
  const node = source instanceof Bone ? new Bone() : new Object3D();
  node.name = source.name;
  node.position.copy(source.position);
  node.quaternion.copy(source.quaternion);
  node.scale.copy(source.scale);
  for (const child of source.children) {
    const copy = poseTree(child);
    if (copy) {
      node.add(copy);
    }
  }
  return node;
}
/** A paired standing sabre or primary pistol-butt strike uses the current admitted body surface.
 * The actor's gameplay transform stays fixed. The native pelvis advances
 * between a planted rear boot and a stepping lead boot; all limb lengths,
 * the authored cut rotation and the single contact marker are preserved. */
export class NativeMeleeContactFit {
  maximumReachError = 0;
  footReachError = 0;
  handReachError = 0;
  bodyAdvance = 0;
  rejectedFits = 0;
  private limbs = new Map<string, Limb>();
  private body: Object3D;
  private soles = new Map<string, Sole>();
  private completeBoot: Sole | undefined;
  private soleVertices = new WeakMap<Sole, Map<number, SkinInfluence[]>>();
  private bootInfluences: SkinInfluence[][] | undefined;
  private bootScratch = new Vector3();
  private rifleSpeedPair: [number, number] | undefined;
  // Native attached footwear shares its bone world transform. Cache the
  // immutable inverse-bind coordinates, keeping each current bone rotation.
  // Morph or detached footwear keeps Three's full vertex deformation.
  private solePoint(sole: Sole, index: number, point: Vector3) {
    const mesh = sole.mesh;
    if (mesh.bindMode !== 'attached' || mesh.geometry.morphAttributes.position?.length) {
      return mesh.localToWorld(mesh.getVertexPosition(index, point));
    }
    let vertices = this.soleVertices.get(sole);
    if (!vertices) {
      vertices = new Map();
      this.soleVertices.set(sole, vertices);
    }
    let influences = vertices.get(index);
    if (!influences) {
      const position = new Vector3()
          .fromBufferAttribute(required(mesh.geometry.attributes['position']), index)
          .applyMatrix4(mesh.bindMatrix),
        indices = required(mesh.geometry.attributes['skinIndex']),
        weights = required(mesh.geometry.attributes['skinWeight']);
      influences = [];
      for (let slot = 0; slot < 4; slot++) {
        const weight = weights.getComponent(index, slot);
        if (weight > 0) {
          const boneIndex = indices.getComponent(index, slot);
          influences.push({
            bone: required(mesh.skeleton.bones[boneIndex]),
            point: position.clone().applyMatrix4(required(mesh.skeleton.boneInverses[boneIndex])),
            weight,
          });
        }
      }
      vertices.set(index, influences);
    }
    let x = 0,
      y = 0,
      z = 0;
    for (const influence of influences) {
      const p = influence.point,
        e = influence.bone.matrixWorld.elements,
        w = 1 / (e[3] * p.x + e[7] * p.y + e[11] * p.z + e[15]);
      x += (e[0] * p.x + e[4] * p.y + e[8] * p.z + e[12]) * w * influence.weight;
      y += (e[1] * p.x + e[5] * p.y + e[9] * p.z + e[13]) * w * influence.weight;
      z += (e[2] * p.x + e[6] * p.y + e[10] * p.z + e[14]) * w * influence.weight;
    }
    return point.set(x, y, z);
  }
  private core: {
    bone: Object3D;
    low: Vector3;
    high: Vector3;
  }[] = [];
  private sample: Object3D | undefined;
  private sampleRoot = new Object3D();
  private sampleMixer: AnimationMixer | undefined;
  private previewFit: NativeMeleeContactFit | undefined;
  private plan: Plan | undefined;
  private attemptedKey = '';
  private attemptedTarget: Object3D | undefined;
  private nativePose: {
    node: Object3D;
    position: Vector3;
    quaternion: Quaternion;
  }[] = [];
  private pathPrevious: Vector3[] | undefined;
  private nativePath: NativePathSample[] = [];
  private pathPrioritized = false;
  private walkingStep = 0;
  private walkingFootSpeed = 0;
  private walkingSoleSpeed = 0;
  private walkingBootSpeed = 0;
  private flatRest = new Map<string, Quaternion>();
  private pathFeet:
    | {
        time: number;
        points: Vector3[];
      }
    | undefined;
  private soleCenters() {
    return [...required(this.previewFit).soles.values()].map((sole) => {
      const center = new Vector3();
      for (const index of sole.outline) {
        center.add(required(this.previewFit).solePoint(sole, index, new Vector3()));
      }
      return center.divideScalar(sole.outline.length);
    });
  }
  private soleOutlinePoints() {
    return [...required(this.previewFit).soles.values()].flatMap((sole) =>
      sole.outline.map((index) => required(this.previewFit).solePoint(sole, index, new Vector3())),
    );
  }
  private completeBootPoints(target?: Float64Array) {
    const fit = required(this.previewFit),
      boot = fit.completeBoot,
      length = (boot?.vertices.length ?? 0) * 3;
    const points = target?.length === length ? target : new Float64Array(length);
    if (!boot) {
      return points;
    }
    const mesh = boot.mesh;
    // Match solePoint's native attached skin calculation without allocating
    // one Vector3 for every boot vertex at every complete-path sample.
    // Detached or morph footwear retains Three's full deformation path.
    if (mesh.bindMode !== 'attached' || mesh.geometry.morphAttributes.position?.length) {
      for (let i = 0; i < boot.vertices.length; i++) {
        fit.solePoint(boot, required(boot.vertices[i]), fit.bootScratch);
        points[i * 3] = fit.bootScratch.x;
        points[i * 3 + 1] = fit.bootScratch.y;
        points[i * 3 + 2] = fit.bootScratch.z;
      }
      return points;
    }
    if (!fit.bootInfluences) {
      fit.bootInfluences = boot.vertices.map((index) => {
        fit.solePoint(boot, index, fit.bootScratch);
        return required(required(fit.soleVertices.get(boot)).get(index));
      });
    }
    for (let i = 0; i < fit.bootInfluences.length; i++) {
      let x = 0,
        y = 0,
        z = 0;
      for (const influence of required(fit.bootInfluences[i])) {
        const p = influence.point,
          e = influence.bone.matrixWorld.elements,
          w = 1 / (e[3] * p.x + e[7] * p.y + e[11] * p.z + e[15]);
        x += (e[0] * p.x + e[4] * p.y + e[8] * p.z + e[12]) * w * influence.weight;
        y += (e[1] * p.x + e[5] * p.y + e[9] * p.z + e[13]) * w * influence.weight;
        z += (e[2] * p.x + e[6] * p.y + e[10] * p.z + e[14]) * w * influence.weight;
      }
      points[i * 3] = x;
      points[i * 3 + 1] = y;
      points[i * 3 + 2] = z;
    }
    return points;
  }
  private bootSpeed(points: Float64Array, before: Float64Array, dt: number) {
    let maximum = 0;
    for (let i = 0; i < points.length; i += 3) {
      const x = required(points[i]) - required(before[i]),
        y = required(points[i + 1]) - required(before[i + 1]),
        z = required(points[i + 2]) - required(before[i + 2]);
      maximum = Math.max(maximum, Math.sqrt(x * x + y * y + z * z) / dt);
    }
    return maximum;
  }
  private bootSpeedAllowed(points: Float64Array, before: Float64Array, dt: number) {
    for (let i = 0; i < points.length; i += 3) {
      const x = required(points[i]) - required(before[i]),
        y = required(points[i + 1]) - required(before[i + 1]),
        z = required(points[i + 2]) - required(before[i + 2]);
      if (Math.sqrt(x * x + y * y + z * z) / dt > this.walkingBootSpeed + 1e-6) {
        return false;
      }
    }
    return true;
  }
  private measureWalkingGait(rifle = false) {
    const gait = this.gait;
    if (!gait || !Number.isFinite(gait.speed) || gait.speed <= 0) {
      return;
    }
    const action = required(this.sampleMixer).clipAction(gait.clip).reset().play();
    action.timeScale = 0;
    const count = Math.ceil(gait.clip.duration * 240),
      forward = new Vector3(0, 0, 1).applyQuaternion(this.sampleRoot.quaternion);
    let previous: Vector3[] | undefined,
      previousOutline: Vector3[] | undefined,
      previousBoot: Float64Array | undefined,
      bootBuffer: Float64Array | undefined;
    for (let index = 0; index <= count; index++) {
      const time = (gait.clip.duration * index) / count;
      required(this.previewFit).restore();
      action.time = time;
      required(this.sampleMixer).update(0);
      this.sampleRoot.updateMatrixWorld(true);
      const points = this.soleCenters().map((point) =>
        point.addScaledVector(forward, time * gait.speed),
      );
      if (previous) {
        for (let side = 0; side < points.length; side++) {
          const delta = required(points[side]).clone().sub(required(previous[side]));
          this.walkingFootSpeed = Math.max(
            this.walkingFootSpeed,
            delta.length() / (gait.clip.duration / count),
          );
        }
      }
      previous = points;
      if (rifle) {
        const outline = this.soleOutlinePoints().map((point) =>
          point.addScaledVector(forward, time * gait.speed),
        );
        if (previousOutline) {
          for (let vertex = 0; vertex < outline.length; vertex++) {
            this.walkingSoleSpeed = Math.max(
              this.walkingSoleSpeed,
              required(outline[vertex]).distanceTo(required(previousOutline[vertex])) /
                (gait.clip.duration / count),
            );
          }
        }
        previousOutline = outline;
        const boot = this.completeBootPoints(bootBuffer),
          travel = time * gait.speed;
        for (let vertex = 0; vertex < boot.length; vertex += 3) {
          boot[vertex] = required(boot[vertex]) + forward.x * travel;
          boot[vertex + 1] = required(boot[vertex + 1]) + forward.y * travel;
          boot[vertex + 2] = required(boot[vertex + 2]) + forward.z * travel;
        }
        if (previousBoot) {
          this.walkingBootSpeed = Math.max(
            this.walkingBootSpeed,
            this.bootSpeed(boot, previousBoot, gait.clip.duration / count),
          );
        }
        bootBuffer = previousBoot;
        previousBoot = boot;
      }
    }
    this.walkingStep = (gait.speed * gait.clip.duration) / 2;
    required(this.sampleMixer).stopAllAction();
  }
  private target = new Vector3();
  private start = new Vector3();
  private joint = new Vector3();
  private end = new Vector3();
  private direction = new Vector3();
  private pole = new Vector3();
  private elbow = new Vector3();
  private before = new Vector3();
  private after = new Vector3();
  private rotation = new Quaternion();
  private worldRotation = new Quaternion();
  private parentRotation = new Quaternion();
  private endRotation = new Quaternion();
  constructor(
    private model: Object3D,
    private root: Object3D,
    footwearName?: string,
    private preview = false,
    private gait?: {
      clip: AnimationClip;
      speed: number;
    },
  ) {
    this.body = required(model.getObjectByName('Root'));
    model.updateWorldMatrix(true, false);
    model.updateMatrixWorld(true);
    for (const side of ['l', 'r']) {
      for (const role of ['foot', 'hand']) {
        const names =
            role === 'foot' ? ['thigh', 'calf', 'foot'] : ['upperarm', 'lowerarm', 'hand'],
          nodes = names.map((name) => model.getObjectByName(`${name}_${side}`));
        if (nodes.some((node) => !node)) {
          continue;
        }
        const base = required(nodes[0]),
          middle = required(nodes[1]),
          end = required(nodes[2]);
        this.limbs.set(`${role}_${side}`, {
          base,
          middle,
          end,
          first: required(base)
            .getWorldPosition(new Vector3())
            .distanceTo(required(middle).getWorldPosition(new Vector3())),
          second: required(middle)
            .getWorldPosition(new Vector3())
            .distanceTo(required(end).getWorldPosition(new Vector3())),
        });
      }
    }
    for (const side of ['l', 'r']) {
      for (const role of ['foot', 'ball']) {
        const node = model.getObjectByName(`${role}_${side}`);
        if (node) {
          this.flatRest.set(
            node.name,
            root
              .getWorldQuaternion(new Quaternion())
              .invert()
              .multiply(node.getWorldQuaternion(new Quaternion())),
          );
        }
      }
    }
    const footwear = footwearName ? model.getObjectByName(footwearName) : undefined;
    if (isSkinnedMesh(footwear)) {
      this.completeBoot = {
        mesh: footwear,
        vertices: Array.from(
          { length: required(footwear.geometry.attributes['position']).count },
          (_, index) => index,
        ),
        outline: [],
        floor: 0,
      };
      const indices = required(footwear.geometry.attributes['skinIndex']),
        weights = required(footwear.geometry.attributes['skinWeight']);
      for (const side of ['l', 'r']) {
        const vertices = [];
        for (let index = 0; index < indices.count; index++) {
          let weight = 0;
          for (let slot = 0; slot < 4; slot++) {
            if (
              [`foot_${side}`, `ball_${side}`].includes(
                required(footwear.skeleton.bones[indices.getComponent(index, slot)]).name,
              )
            ) {
              weight += weights.getComponent(index, slot);
            }
          }
          if (weight > 0.99) {
            vertices.push(index);
          }
        }
        if (vertices.length) {
          const points = vertices.map((index) =>
              root.worldToLocal(
                footwear.localToWorld(footwear.getVertexPosition(index, new Vector3())),
              ),
            ),
            floor = Math.min(...points.map((point) => point.y)),
            outline = vertices.filter((_, index) => required(points[index]).y <= floor + 0.003);
          this.soles.set(side, {
            mesh: footwear,
            vertices,
            outline,
            floor: floor * root.getWorldScale(new Vector3()).y,
          });
        }
      }
    }
    const bounds = new Map<
      Object3D,
      {
        bone: Object3D;
        low: Vector3;
        high: Vector3;
      }
    >();
    if (preview) {
      model.traverse((mesh) => {
        if (!isSkinnedMesh(mesh) || !visible(mesh) || mesh === footwear) {
          return;
        }
        const indices = required(mesh.geometry.attributes['skinIndex']),
          weights = required(mesh.geometry.attributes['skinWeight']),
          positions = required(mesh.geometry.attributes['position']);
        for (let index = 0; index < indices.count; index++) {
          let weight = 0;
          for (let slot = 0; slot < 4; slot++) {
            if (
              /^(pelvis|spine_0[123]|neck_01|head|thigh_[lr]|calf_[lr])$/.test(
                required(mesh.skeleton.bones[indices.getComponent(index, slot)]).name,
              )
            ) {
              weight += weights.getComponent(index, slot);
            }
          }
          if (weight <= 0.5) {
            continue;
          }
          for (let slot = 0; slot < 4; slot++) {
            if (weights.getComponent(index, slot) <= 0) {
              continue;
            }
            const boneIndex = indices.getComponent(index, slot),
              bone = required(mesh.skeleton.bones[boneIndex]),
              point = new Vector3()
                .fromBufferAttribute(positions, index)
                .applyMatrix4(mesh.bindMatrix)
                .applyMatrix4(required(mesh.skeleton.boneInverses[boneIndex]));
            const bound = bounds.get(bone);
            if (bound) {
              bound.low.min(point);
              bound.high.max(point);
            } else {
              bounds.set(bone, {
                bone,
                low: point.clone(),
                high: point.clone(),
              });
            }
          }
        }
      });
    }
    this.core = [...bounds.values()];
  }
  private worldPoint = new Vector3();
  private worldScale = new Vector3();
  private inverseParent = new Matrix4();
  private position = (node: Object3D, target: Vector3) => {
    return this.preview
      ? target.setFromMatrixPosition(node.matrixWorld)
      : node.getWorldPosition(target);
  };
  private quaternion(node: Object3D, target: Quaternion) {
    if (!this.preview) {
      return node.getWorldQuaternion(target);
    }
    node.matrixWorld.decompose(this.worldPoint, target, this.worldScale);
    return target;
  }
  private rotateToward(bone: Object3D, before: Vector3, after: Vector3) {
    this.rotation.setFromUnitVectors(before.normalize(), after.normalize());
    this.quaternion(bone, this.worldRotation);
    this.rotation.multiply(this.worldRotation);
    this.quaternion(required(bone.parent), this.parentRotation);
    bone.quaternion.copy(this.parentRotation.invert().multiply(this.rotation));
    bone.updateWorldMatrix(false, true);
  }
  private solve = (limb: Limb, target: Vector3) => {
    const { base, middle, end, first: a, second: b } = limb;
    this.position(base, this.start);
    this.position(middle, this.joint);
    this.position(end, this.end);
    this.quaternion(end, this.endRotation);
    const requested = this.direction.subVectors(target, this.start).length(),
      distance = Math.min(a + b - 0.001, Math.max(Math.abs(a - b) + 0.001, requested));
    this.direction.normalize();
    this.maximumReachError = Math.max(
      this.maximumReachError,
      Math.max(0, requested - (a + b - 0.001)),
    );
    if (end.name.startsWith('foot')) {
      this.footReachError = Math.max(this.footReachError, Math.max(0, requested - (a + b - 0.001)));
    } else {
      this.handReachError = Math.max(this.handReachError, Math.max(0, requested - (a + b - 0.001)));
    }
    this.pole
      .subVectors(this.joint, this.start)
      .addScaledVector(this.direction, -this.pole.dot(this.direction));
    if (this.pole.lengthSq() < 1e-7) {
      this.pole.set(1, 0, 0).addScaledVector(this.direction, -this.direction.x);
    }
    if (this.pole.lengthSq() < 1e-7) {
      this.pole.set(0, 0, 1).addScaledVector(this.direction, -this.direction.z);
    }
    this.pole.normalize();
    const along = (a * a - b * b + distance * distance) / (2 * distance),
      rise = Math.sqrt(Math.max(0, a * a - along * along));
    this.elbow
      .copy(this.start)
      .addScaledVector(this.direction, along)
      .addScaledVector(this.pole, rise);
    this.target.copy(this.start).addScaledVector(this.direction, distance);
    this.rotateToward(
      base,
      this.before.subVectors(this.joint, this.start),
      this.after.subVectors(this.elbow, this.start),
    );
    this.position(middle, this.joint);
    this.position(end, this.end);
    this.rotateToward(
      middle,
      this.before.subVectors(this.end, this.joint),
      this.after.subVectors(this.target, this.joint),
    );
    this.quaternion(required(end.parent), this.parentRotation);
    end.quaternion.copy(this.parentRotation.invert().multiply(this.endRotation));
    end.updateWorldMatrix(false, true);
  };
  private contactPoints(weapon: Object3D, hilt: boolean, pistol = false, rifle = false) {
    if (rifle) {
      // The packed brass mesh includes barrel bands. The actual butt face is
      // its exposed minimum-X ring in this owned gun's coordinate system.
      weapon.updateWorldMatrix(true, true);
      const inverse = new Matrix4().copy(weapon.matrixWorld).invert(),
        vertices: Vector3[] = [];
      weapon.traverse((node) => {
        if (
          !isMesh(node) ||
          !visible(node) ||
          Array.isArray(node.material) ||
          node.material.name !== 'Equipment_Aged_Brass'
        ) {
          return;
        }
        const transform = new Matrix4().multiplyMatrices(inverse, node.matrixWorld),
          position = required(node.geometry.attributes['position']);
        for (let index = 0; index < position.count; index++) {
          vertices.push(new Vector3().fromBufferAttribute(position, index).applyMatrix4(transform));
        }
      });
      if (!vertices.length) {
        return [];
      }
      const low = Math.min(...vertices.map((point) => point.x)),
        ring = new Map<string, Vector3>();
      for (const point of vertices) {
        if (Math.abs(point.x - low) < 1e-6) {
          ring.set(
            point
              .toArray()
              .map((value) => Math.round(value * 1e6))
              .join(':'),
            point,
          );
        }
      }
      return ring.size >= 3 ? [...ring.values()] : [];
    }
    const cap = pistol
      ? weapon.children.find(
          (node): node is Mesh => isMesh(node) && /Pistol_Butt_Cap/.test(node.name),
        )
      : undefined;
    if (pistol && !cap) {
      return [];
    }
    if (cap) {
      const positions = required(cap.geometry.attributes['position']);
      let bottom = Infinity;
      for (let index = 0; index < positions.count; index++) {
        bottom = Math.min(bottom, positions.getY(index));
      }
      const ring = new Map<string, Vector3>();
      for (let index = 0; index < positions.count; index++) {
        if (Math.abs(positions.getY(index) - bottom) < 1e-6) {
          const point = new Vector3().fromBufferAttribute(positions, index);
          ring.set(`${Math.round(point.x * 1e6)}:${Math.round(point.z * 1e6)}`, point);
        }
      }
      return [...ring.values()];
    }
    if (hilt) {
      const grip = weapon.children.find(
          (node): node is Mesh => isMesh(node) && /Leather_Grip/.test(node.name),
        ),
        guard = weapon.children.find(
          (node): node is Mesh => isMesh(node) && /Crossguard/.test(node.name),
        );
      if (!grip || !guard) {
        return [];
      }
      const gripPositions = required(grip.geometry.attributes['position']),
        guardPositions = required(guard.geometry.attributes['position']);
      let low = Infinity,
        high = -Infinity;
      for (let i = 0; i < gripPositions.count; i++) {
        low = Math.min(low, gripPositions.getY(i));
      }
      for (let i = 0; i < guardPositions.count; i++) {
        if (Math.abs(guardPositions.getX(i)) < 0.002) {
          high = Math.max(high, guardPositions.getY(i));
        }
      }
      return Array.from({ length: 9 }, (_, i) => new Vector3(0, low + ((high - low) * i) / 8, 0));
    }
    const blade = weapon.children.find(
      (node): node is Mesh => isMesh(node) && /Curved_Blade/.test(node.name),
    );
    if (!blade) {
      return [];
    }
    const positions = required(blade.geometry.attributes['position']),
      rings = new Map<
        number,
        {
          low: Vector3;
          high: Vector3;
        }
      >();
    for (let i = 0; i < positions.count; i++) {
      const point = new Vector3().fromBufferAttribute(positions, i),
        key = Math.round(point.y * 1e6),
        ring = rings.get(key);
      if (ring) {
        ring.low.min(point);
        ring.high.max(point);
      } else {
        rings.set(key, { low: point.clone(), high: point.clone() });
      }
    }
    return [...rings.values()]
      .sort((a, b) => a.low.y - b.low.y)
      .map((ring) => ring.low.clone().add(ring.high).multiplyScalar(0.5));
  }
  private correction(points: Vector3[], target: Object3D) {
    target.updateWorldMatrix(true, false);
    target.updateMatrixWorld(true);
    let distance = Infinity;
    const closest = new Vector3(),
      delta = new Vector3(),
      base = new Vector3(),
      triangle = new Triangle();
    target.traverse((node) => {
      if (!isSkinnedMesh(node) || !visible(node)) {
        return;
      }
      const positions = required(node.geometry.attributes['position']),
        index = node.geometry.index;
      if (!index) {
        return;
      }
      // Compose each current native palette once. Mesh's base method includes
      // all active clothing morphs; the same four exported weights then skin it.
      const indices = required(node.geometry.attributes['skinIndex']),
        weights = required(node.geometry.attributes['skinWeight']),
        meshToWorld = new Matrix4().multiplyMatrices(node.matrixWorld, node.bindMatrixInverse),
        matrices = node.skeleton.bones.map((bone, i) =>
          new Matrix4()
            .copy(meshToWorld)
            .multiply(bone.matrixWorld)
            .multiply(required(node.skeleton.boneInverses[i]))
            .multiply(node.bindMatrix),
        );
      const vertices = Array.from({ length: positions.count }, (_, i) => {
        Mesh.prototype.getVertexPosition.call(node, i, base);
        const x = base.x,
          y = base.y,
          z = base.z,
          point = new Vector3();
        for (let slot = 0; slot < 4; slot++) {
          const weight = weights.getComponent(i, slot);
          if (weight === 0) {
            continue;
          }
          const m = required(matrices[indices.getComponent(i, slot)]).elements;
          point.x += weight * (m[0] * x + m[4] * y + m[8] * z + m[12]);
          point.y += weight * (m[1] * x + m[5] * y + m[9] * z + m[13]);
          point.z += weight * (m[2] * x + m[6] * y + m[10] * z + m[14]);
        }
        return point;
      });
      for (let i = 0; i < index.count; i += 3) {
        const a = required(vertices[index.getX(i)]),
          b = required(vertices[index.getX(i + 1)]),
          c = required(vertices[index.getX(i + 2)]);
        triangle.set(a, b, c);
        if (triangle.getArea() < 1e-10) {
          continue;
        }
        const minX = Math.min(a.x, b.x, c.x),
          maxX = Math.max(a.x, b.x, c.x),
          minY = Math.min(a.y, b.y, c.y),
          maxY = Math.max(a.y, b.y, c.y),
          minZ = Math.min(a.z, b.z, c.z),
          maxZ = Math.max(a.z, b.z, c.z);
        for (const point of points) {
          const dx = Math.max(0, minX - point.x, point.x - maxX),
            dy = Math.max(0, minY - point.y, point.y - maxY),
            dz = Math.max(0, minZ - point.z, point.z - maxZ);
          if (dx * dx + dy * dy + dz * dz >= distance) {
            continue;
          }
          triangle.closestPointToPoint(point, closest);
          const squared = closest.distanceToSquared(point);
          if (squared < distance) {
            distance = squared;
            delta.subVectors(closest, point);
          }
        }
      }
    });
    return Number.isFinite(distance) ? delta : undefined;
  }
  private prepare(
    key: string,
    cue: ActorCue,
    clip: AnimationClip,
    spec: ClipSpec,
    weapon: Object3D,
    target: Object3D,
  ) {
    const previousPlan = this.plan,
      previousTurn = previousPlan?.cueId === cue.id ? previousPlan.turn : undefined;
    this.plan = undefined;
    this.bodyAdvance = 0;
    this.attemptedKey = key;
    this.attemptedTarget = target;
    this.nativePath = [];
    this.pathPrioritized = false;
    this.rifleSpeedPair = undefined;
    const support = cue.contactSupport;
    if (
      !support?.floors.some(
        (floor) => Math.abs(floor.height - this.root.getWorldPosition(new Vector3()).y) < 0.001,
      )
    ) {
      return;
    }
    const contact = spec.markers?.['contact'];
    if (!Number.isFinite(contact)) {
      return;
    }
    // Sample only this actor's known native clip. This hierarchy has no meshes
    // or second skinning palette, and is allocated only for a paired strike.
    if (!this.sample) {
      this.sample = required(poseTree(this.model));
      this.root.getWorldScale(this.sampleRoot.scale);
      this.sampleRoot.add(this.sample);
      this.sampleMixer = new AnimationMixer(this.sample);
      const meshes: SkinnedMesh[] = [];
      this.model.traverse((node) => {
        if (isSkinnedMesh(node) && visible(node)) {
          meshes.push(node);
        }
      });
      for (const mesh of meshes) {
        const copy = mesh.clone(false),
          bones = mesh.skeleton.bones.map((bone) =>
            required(required(this.sample).getObjectByName(bone.name)),
          );
        const parent =
          mesh.parent === this.model
            ? this.sample
            : (this.sample.getObjectByName(required(mesh.parent).name) ?? this.sample);
        parent.add(copy);
        copy.bind(
          new Skeleton(
            bones.map((bone) => {
              if (!(bone instanceof Bone)) {
                throw new Error('Missing sampled skeleton bone');
              }
              return bone;
            }),
            mesh.skeleton.boneInverses,
          ),
          mesh.bindMatrix,
        );
      }
      this.previewFit = new NativeMeleeContactFit(
        this.sample,
        this.sampleRoot,
        [...this.soles.values()][0]?.mesh.name,
        true,
      );
      this.previewFit.flatRest = new Map(
        [...this.flatRest].map(([name, quaternion]) => [name, quaternion.clone()]),
      );
      for (const [side, sole] of this.previewFit.soles) {
        const native = required(this.soles.get(side));
        sole.floor = native.floor;
        sole.outline = [...native.outline];
      }
    }
    this.root.getWorldPosition(this.sampleRoot.position);
    this.root.getWorldQuaternion(this.sampleRoot.quaternion);
    this.sample.position.copy(this.model.position);
    const admittedTurn =
        spec.name.startsWith('stand.slash.blade') || spec.name === 'stand.butt.long-gun'
          ? cue.phase === 'prepare'
            ? cue.contactTurn
            : cue.phase === 'contact' && previousTurn
              ? previousTurn
              : undefined
          : undefined,
      deltaYaw = admittedTurn ? angle(admittedTurn.toYaw - admittedTurn.fromYaw) : 0;
    if (
      admittedTurn &&
      (![admittedTurn.fromYaw, admittedTurn.toYaw].every(Number.isFinite) ||
        Math.abs(deltaYaw) > Math.PI / 4 + 1e-7)
    ) {
      return;
    }
    const turn =
      admittedTurn && Math.abs(deltaYaw) > 1e-7
        ? { ...admittedTurn, until: clip.duration * 0.1, footDistance: 0 }
        : undefined;
    if (turn) {
      this.sampleRoot.rotation.set(0, turn.toYaw, 0);
    }
    if (spec.name.startsWith('stand.slash.blade') && !this.walkingStep) {
      this.measureWalkingGait();
    }
    if (spec.name === 'stand.butt.long-gun' && !this.walkingSoleSpeed) {
      this.measureWalkingGait(true);
    }
    required(this.previewFit).restore();
    required(this.sampleMixer).stopAllAction();
    const action = required(this.sampleMixer).clipAction(clip).reset().play();
    action.time = required(contact);
    action.timeScale = 0;
    required(this.sampleMixer).update(0);
    this.sampleRoot.updateMatrixWorld(true);
    // A continuous rifle correction preserves the exact native endpoints.
    // Reject their raised or tilted complete soles before searching; repairing
    // the exported guard is a prerequisite, not an instantaneous foot drop.
    if (spec.name === 'stand.butt.long-gun' && !this.rifleNativeEndsFlat(clip, action)) {
      return;
    }
    if (spec.name === 'stand.butt.long-gun') {
      action.time = required(contact);
      required(this.sampleMixer).update(0);
      this.sampleRoot.updateMatrixWorld(true);
    }
    const hand = required(this.model.getObjectByName('hand_r')),
      sampleHand = required(this.sample.getObjectByName('hand_r')),
      arm = required(this.limbs.get('hand_r'));
    this.root.updateWorldMatrix(true, false);
    this.root.updateMatrixWorld(true);
    const relative = new Matrix4().copy(hand.matrixWorld).invert().multiply(weapon.matrixWorld),
      transform = new Matrix4().multiplyMatrices(sampleHand.matrixWorld, relative);
    const points = this.contactPoints(
        weapon,
        spec.name.endsWith('.hilt'),
        spec.name === 'stand.butt.short-gun',
        spec.name === 'stand.butt.long-gun',
      ).map((point) => point.applyMatrix4(transform)),
      correction = this.correction(points, target);
    if (!correction) {
      return;
    }
    const twoHands = spec.name === 'stand.butt.long-gun',
      leftArm = twoHands ? this.limbs.get('hand_l') : undefined,
      leftShoulder = twoHands
        ? required(this.sample.getObjectByName('upperarm_l')).getWorldPosition(new Vector3())
        : undefined,
      leftDesired = twoHands
        ? required(this.sample.getObjectByName('hand_l'))
            .getWorldPosition(new Vector3())
            .add(correction)
        : undefined;
    const rootRotation = this.sampleRoot.getWorldQuaternion(new Quaternion()),
      shoulder = required(this.sample.getObjectByName('upperarm_r')).getWorldPosition(
        new Vector3(),
      ),
      desired = sampleHand.getWorldPosition(new Vector3()).add(correction),
      forward = new Vector3(0, 0, 1).applyQuaternion(rootRotation),
      body = new Vector3(),
      step = new Vector3(),
      rearStep = new Vector3();
    if (turn) {
      const foot = required(this.sample.getObjectByName('foot_l'))
          .getWorldPosition(new Vector3())
          .sub(this.sampleRoot.position),
        before = foot.clone().applyAxisAngle(up, -deltaYaw);
      turn.footDistance = before.distanceTo(foot);
    }
    const hips = new Map(
        ['l', 'r'].map((side) => [
          side,
          required(required(this.sample).getObjectByName(`thigh_${side}`)).getWorldPosition(
            new Vector3(),
          ),
        ]),
      ),
      feet = new Map(
        ['l', 'r'].map((side) => [
          side,
          required(required(this.sample).getObjectByName(`foot_${side}`)).getWorldPosition(
            new Vector3(),
          ),
        ]),
      );
    // Choose the smallest supported advance that puts the contact wrist within
    // the measured native arm. Bending the knees makes room for the rear leg;
    // an exported joint translation or a stretched bone is never used.
    const yaw = Math.atan2(forward.x, forward.z);
    // Retain an already admitted wind-up's body and foot recipe when the same
    // current model/floor/cell identity reaches contact. Refit its current hand
    // surface, then admit the complete new wrist, gait and floor path again.
    if (
      (spec.name.startsWith('stand.slash.blade') || twoHands) &&
      cue.phase === 'contact' &&
      (previousPlan?.sabre || previousPlan?.twoHands) &&
      previousPlan.target === target &&
      previousPlan.key === key.replace(/:contact$/, ':prepare') &&
      Number.isFinite(previousPlan.yaw) &&
      Math.abs(angle(yaw - required(previousPlan.yaw))) < 1e-7
    ) {
      const retained = {
        ...previousPlan,
        key,
        hand: correction.clone().applyQuaternion(rootRotation.clone().invert()),
        ...(previousPlan.sabre
          ? {
              handFrom: previousPlan.hand.clone(),
              handHandoffBegin: animationPhaseRange(
                { ...spec, duration: clip.duration },
                cue.action,
                'contact',
              )[0],
            }
          : {}),
        body: previousPlan.body.clone(),
        step: previousPlan.step.clone(),
        rearStep: previousPlan.rearStep.clone(),
        turn,
        yaw,
      };
      if (this.pathAllowed(retained, clip, support, action)) {
        this.plan = retained;
        this.bodyAdvance = Math.hypot(retained.body.x, retained.body.z);
        return;
      }
    }
    let accepted = false,
      acceptedPlan: Plan | undefined;
    for (
      let advance = 0;
      advance <=
      (spec.name.startsWith('stand.slash.blade') || twoHands ? this.walkingStep : 0.8) + 0.0001;
      advance += 0.01
    ) {
      for (let drop = 0; drop <= 0.3801; drop += 0.01) {
        body.copy(forward).multiplyScalar(advance);
        body.y = -drop;
        rearStep.set(0, 0, 0);
        if (
          shoulder.clone().add(body).distanceTo(desired) > arm.first + arm.second - 0.008 ||
          (leftArm &&
            required(leftShoulder).clone().add(body).distanceTo(required(leftDesired)) >
              leftArm.first + leftArm.second - 0.008)
        ) {
          continue;
        }
        let supported = true;
        for (const side of ['l', 'r']) {
          const leg = required(this.limbs.get(`foot_${side}`)),
            hip = required(hips.get(side)).clone().add(body),
            foot = required(feet.get(side)).clone();
          if (side === 'l') {
            const relative = hip.clone().sub(foot),
              height = relative.y,
              along = relative.dot(forward),
              lateral = relative.clone().addScaledVector(forward, -along);
            lateral.y = 0;
            const available =
              (leg.first + leg.second - 0.008) ** 2 - height * height - lateral.lengthSq();
            if (available < 0) {
              supported = false;
              continue;
            }
            const gather = Math.max(0, along - Math.sqrt(available));
            if (gather > advance) {
              supported = false;
              continue;
            }
            rearStep.copy(forward).multiplyScalar(gather);
            foot.add(rearStep);
          }
          if (side === 'l' && hip.distanceTo(foot) > leg.first + leg.second - 0.0079) {
            supported = false;
          }
        }
        if (!supported) {
          continue;
        }
        for (const fraction of [1, 0.85, 0.7, 0.55, 0.4, 0.25, 0]) {
          step.copy(forward).multiplyScalar(advance * fraction);
          const leg = required(this.limbs.get('foot_r')),
            hip = required(hips.get('r')).clone().add(body),
            foot = required(feet.get('r')).clone().add(step);
          if (hip.distanceTo(foot) > leg.first + leg.second - 0.008) {
            continue;
          }
          const local = (value: Vector3) =>
              value.clone().applyQuaternion(rootRotation.clone().invert()),
            plan = {
              key,
              cueId: cue.id,
              target,
              hand: local(correction),
              body: local(body),
              step: local(step),
              rearStep: local(rearStep),
              contact: required(contact),
              duration: clip.duration,
              twoHands,
              pistol: spec.name === 'stand.butt.short-gun',
              sabre: spec.name.startsWith('stand.slash.blade'),
              ...(spec.name.startsWith('stand.slash.blade')
                ? { handRecovery: clip.duration * 0.75 }
                : {}),
              turn,
              yaw,
            };
          if (plan.turn) {
            this.sampleRoot.rotation.set(0, plan.turn.toYaw, 0);
          }
          if (plan.sabre && this.nativePath.length && !this.wristPathReachable(plan)) {
            continue;
          }
          if (!this.pathAllowed(plan, clip, support, action)) {
            // The common first fit avoids a redundant native pose pass. Build the
            // wrist cache only after an actual full-path arm rejection needs it.
            if (
              plan.sabre &&
              !this.nativePath.length &&
              required(this.previewFit).handReachError >= 1e-7
            ) {
              if (plan.turn) {
                this.sampleRoot.rotation.set(0, plan.turn.toYaw, 0);
              }
              this.cacheNativePath(clip, action);
            }
            continue;
          }
          accepted = true;
          acceptedPlan = plan;
          break;
        }
        if (accepted) {
          break;
        }
      }
      if (accepted) {
        break;
      }
    }
    if (!accepted) {
      this.rejectedFits++;
      return;
    }
    this.plan = acceptedPlan;
    this.bodyAdvance = Math.hypot(body.x, body.z);
  }
  private floorAllowed(support: ContactSupport) {
    const point = new Vector3(),
      height = this.sampleRoot.position.y,
      current: Vector3[] = [];
    for (const sole of required(this.previewFit).soles.values()) {
      let minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
      for (const index of sole.outline) {
        required(this.previewFit).solePoint(sole, index, point);
        const before = this.pathPrevious?.[current.length];
        minX = Math.min(minX, point.x, before?.x ?? point.x);
        maxX = Math.max(maxX, point.x, before?.x ?? point.x);
        minZ = Math.min(minZ, point.z, before?.z ?? point.z);
        maxZ = Math.max(maxZ, point.z, before?.z ?? point.z);
        current.push(point.clone());
      }
      // This swept rectangle encloses every exported sole vertex and its
      // segment between the native path samples. Checking its complete area is
      // stricter than testing only vertex endpoints at a blocked corner.
      minX -= 0.003;
      maxX += 0.003;
      minZ -= 0.003;
      maxZ += 0.003;
      const floors = support.floors.filter((floor) => Math.abs(floor.height - height) < 0.001),
        cuts = [
          minX,
          maxX,
          ...floors
            .flatMap((floor) => [floor.minX, floor.maxX])
            .filter((x) => x > minX && x < maxX),
        ].sort((a, b) => a - b);
      for (let index = 1; index < cuts.length; index++) {
        if (required(cuts[index]) - required(cuts[index - 1]) < 1e-10) {
          continue;
        }
        const x = (required(cuts[index]) + required(cuts[index - 1])) / 2,
          spans = floors
            .filter((floor) => x >= floor.minX && x <= floor.maxX)
            .map((floor) => [Math.max(minZ, floor.minZ), Math.min(maxZ, floor.maxZ)])
            .filter(([a, b]) => required(b) >= required(a))
            .sort((a, b) => required(a[0]) - required(b[0]));
        let covered = minZ;
        for (const [a, b] of spans) {
          if (required(a) > covered + 1e-8) {
            break;
          }
          covered = Math.max(covered, required(b));
        }
        if (covered < maxZ - 1e-8) {
          return false;
        }
      }
    }
    this.pathPrevious = current;
    return required(this.previewFit).soles.size === 2;
  }
  private bodyAllowed = (support: ContactSupport) => {
    const low = new Vector3(Infinity, Infinity, Infinity),
      high = new Vector3(-Infinity, -Infinity, -Infinity),
      point = new Vector3();
    // Skinning is a convex blend of these bone-local exported vertex bounds.
    // Transforming their eight corners encloses the actual skin and clothing
    // without running a second full-body skinning pass for every path sample.
    for (const bound of required(this.previewFit).core) {
      for (const x of [bound.low.x, bound.high.x]) {
        for (const y of [bound.low.y, bound.high.y]) {
          for (const z of [bound.low.z, bound.high.z]) {
            point.set(x, y, z).applyMatrix4(bound.bone.matrixWorld);
            low.min(point);
            high.max(point);
          }
        }
      }
    }
    if (!Number.isFinite(low.x)) {
      return false;
    }
    // A conservative rectangle encloses the actual head, trunk and legs. It
    // prevents a new lunge from putting the body through a blocked corner even
    // when its two narrower sole footprints could remain on adjacent floors.
    low.x -= 0.003;
    low.z -= 0.003;
    high.x += 0.003;
    high.z += 0.003;
    const floors = support.floors.filter(
        (floor) => Math.abs(floor.height - this.sampleRoot.position.y) < 0.001,
      ),
      cuts = [
        low.x,
        high.x,
        ...floors
          .flatMap((floor) => [floor.minX, floor.maxX])
          .filter((x) => x > low.x && x < high.x),
      ].sort((a, b) => a - b);
    for (let index = 1; index < cuts.length; index++) {
      if (required(cuts[index]) - required(cuts[index - 1]) < 1e-10) {
        continue;
      }
      const x = (required(cuts[index]) + required(cuts[index - 1])) / 2,
        spans = floors
          .filter((floor) => x >= floor.minX && x <= floor.maxX)
          .map((floor) => [Math.max(low.z, floor.minZ), Math.min(high.z, floor.maxZ)])
          .filter(([a, b]) => required(b) >= required(a))
          .sort((a, b) => required(a[0]) - required(b[0]));
      let covered = low.z;
      for (const [a, b] of spans) {
        if (required(a) > covered + 1e-8) {
          break;
        }
        covered = Math.max(covered, required(b));
      }
      if (covered < high.z - 1e-8) {
        return false;
      }
    }
    return true;
  };
  private transfer(plan: MeleePosePlan, time: number) {
    const contact = plan.contact,
      end = plan.duration,
      weight =
        time <= contact
          ? smooth(time / contact)
          : 1 - smooth((time - contact) / (end * 0.9 - contact)),
      handWeight =
        plan.handRecovery && time > contact
          ? 1 - smooth((time - contact) / (plan.handRecovery - contact))
          : weight;
    const rearDistance = plan.rearStep.length() + (plan.turn?.footDistance ?? 0),
      leadDistance = plan.step.length(),
      totalDistance = rearDistance + leadDistance,
      settleEnd = plan.sabre || plan.twoHands ? end * 0.1 : 0,
      stepEnd = plan.sabre || plan.twoHands ? contact * 0.9 : contact * 0.8;
    // The lead boot settles before the rear lifts. Serialized transfers share
    // the remaining wind-up and recovery in proportion to their travel.
    const stepStart =
        plan.sabre || plan.twoHands
          ? totalDistance > 0
            ? settleEnd + ((stepEnd - settleEnd) * rearDistance) / totalDistance
            : settleEnd
          : Math.min(0.1, contact * 0.28),
      rearReturnStart = end * 0.52,
      rearReturnEnd =
        plan.sabre || plan.twoHands
          ? totalDistance > 0
            ? rearReturnStart + ((end * 0.9 - rearReturnStart) * rearDistance) / totalDistance
            : rearReturnStart
          : end * 0.62;
    const leadWeight =
        time <= stepEnd
          ? stepEnd > stepStart
            ? smooth((time - stepStart) / (stepEnd - stepStart))
            : 0
          : time < rearReturnEnd
            ? 1
            : end * 0.9 > rearReturnEnd
              ? 1 - smooth((time - rearReturnEnd) / (end * 0.9 - rearReturnEnd))
              : 0,
      rearWeight =
        rearDistance === 0
          ? 0
          : time < stepStart
            ? smooth((time - settleEnd) / (stepStart - settleEnd))
            : time < rearReturnStart
              ? 1
              : 1 - smooth((time - rearReturnStart) / (rearReturnEnd - rearReturnStart));
    const rearAdvance =
        time > settleEnd && time < stepStart
          ? Math.sin((Math.PI * (time - settleEnd)) / (stepStart - settleEnd))
          : 0,
      rearRecovery =
        time > rearReturnStart && time < rearReturnEnd
          ? Math.sin((Math.PI * (time - rearReturnStart)) / (rearReturnEnd - rearReturnStart))
          : 0,
      leadAdvance =
        time > stepStart && time < stepEnd
          ? Math.sin((Math.PI * (time - stepStart)) / (stepEnd - stepStart))
          : 0,
      leadRecovery =
        time > rearReturnEnd && time < end * 0.9
          ? Math.sin((Math.PI * (time - rearReturnEnd)) / (end * 0.9 - rearReturnEnd))
          : 0;
    return {
      weight,
      handWeight,
      groundWeight: smooth(time / (end * 0.1)) * (1 - smooth((time - end * 0.9) / (end * 0.1))),
      rearWeight,
      leadWeight,
      rearArc: Math.max(rearAdvance, rearRecovery),
      leadArc: Math.max(leadAdvance, leadRecovery),
    };
  }
  private cacheNativePath(clip: AnimationClip, action: AnimationAction) {
    this.nativePath = [];
    this.pathPrioritized = false;
    this.rifleSpeedPair = undefined;
    const count = Math.ceil(clip.duration * 240);
    for (let index = 0; index <= count; index++) {
      const time = Math.min(clip.duration, index / 240);
      required(this.previewFit).restore();
      action.time = time;
      required(this.sampleMixer).update(0);
      this.sampleRoot.updateMatrixWorld(true);
      this.nativePath.push({
        time,
        shoulder: required(required(this.sample).getObjectByName('upperarm_r')).getWorldPosition(
          new Vector3(),
        ),
        hand: required(required(this.sample).getObjectByName('hand_r')).getWorldPosition(
          new Vector3(),
        ),
        hips: ['l', 'r'].map((side) =>
          required(required(this.sample).getObjectByName(`thigh_${side}`)).getWorldPosition(
            new Vector3(),
          ),
        ),
        feet: ['l', 'r'].map((side) =>
          required(required(this.sample).getObjectByName(`foot_${side}`)).getWorldPosition(
            new Vector3(),
          ),
        ),
        soleMin: ['l', 'r'].map((side) => {
          const sole = required(required(this.previewFit).soles.get(side));
          return Math.min(
            ...sole.vertices.map(
              (vertex) => required(this.previewFit).solePoint(sole, vertex, new Vector3()).y,
            ),
          );
        }),
      });
    }
  }
  private wristPathReachable(plan: MeleePosePlan) {
    const rotation = this.sampleRoot.quaternion,
      arm = required(this.limbs.get('hand_r')),
      hand = plan.hand.clone().applyQuaternion(rotation),
      advance = plan.body.clone().applyQuaternion(rotation),
      steps = [
        plan.rearStep.clone().applyQuaternion(rotation),
        plan.step.clone().applyQuaternion(rotation),
      ],
      lift = [
        Math.min(0.035, plan.rearStep.length() * 0.1),
        Math.min(0.045, plan.step.length() * 0.1),
      ],
      legLength = ['l', 'r'].map((side) => {
        const leg = required(this.limbs.get(`foot_${side}`));
        return (leg.first + leg.second - 0.002) ** 2;
      }),
      floor = ['l', 'r'].map(
        (side) =>
          this.sampleRoot.position.y + required(required(this.previewFit).soles.get(side)).floor,
      ),
      reachSquared = (arm.first + arm.second - 0.001 + 1e-7) ** 2;
    if (!this.pathPrioritized) {
      // Check the strongest raw wrist constraint first. The first supported
      // candidate gives a useful body estimate; priority changes rejection
      // order only, and every accepted candidate still checks every sample.
      this.nativePath = this.nativePath
        .map((sample) => {
          const transfer = this.transfer(plan, sample.time),
            dx =
              sample.shoulder.x +
              advance.x * transfer.weight -
              sample.hand.x -
              hand.x * transfer.handWeight,
            dy =
              sample.shoulder.y +
              advance.y * transfer.weight -
              sample.hand.y -
              hand.y * transfer.handWeight,
            dz =
              sample.shoulder.z +
              advance.z * transfer.weight -
              sample.hand.z -
              hand.z * transfer.handWeight;
          return { sample, score: dx * dx + dy * dy + dz * dz };
        })
        .sort((a, b) => b.score - a.score)
        .map(({ sample }) => sample);
      this.pathPrioritized = true;
    }
    // The native clip is cached once. Use scalar native coordinates to reject
    // impossible wrists without allocating millions of temporary vectors.
    // Accepted plans still receive the complete240Hz solved geometry gate.
    for (const sample of this.nativePath) {
      const transfer = this.transfer(plan, sample.time),
        bodyX = advance.x * transfer.weight,
        bodyY = advance.y * transfer.weight,
        bodyZ = advance.z * transfer.weight;
      let drop = 0;
      for (let index = 0; index < 2; index++) {
        const stepWeight = index === 0 ? transfer.rearWeight : transfer.leadWeight,
          arc = index === 0 ? transfer.rearArc : transfer.leadArc,
          foot = required(sample.feet[index]),
          hip = required(sample.hips[index]),
          dx = hip.x + bodyX - foot.x - required(steps[index]).x * stepWeight,
          dz = hip.z + bodyZ - foot.z - required(steps[index]).z * stepWeight;
        const footY =
            foot.y +
            (required(floor[index]) - required(sample.soleMin[index])) * transfer.groundWeight +
            arc * required(lift[index]),
          height = Math.sqrt(Math.max(0, required(legLength[index]) - dx * dx - dz * dz));
        drop = Math.max(drop, hip.y + bodyY - footY - height);
      }
      const dx = sample.shoulder.x + bodyX - sample.hand.x - hand.x * transfer.handWeight,
        dy =
          sample.shoulder.y +
          bodyY -
          Math.max(0, drop) -
          sample.hand.y -
          hand.y * transfer.handWeight,
        dz = sample.shoulder.z + bodyZ - sample.hand.z - hand.z * transfer.handWeight;
      if (dx * dx + dy * dy + dz * dz > reachSquared) {
        return false;
      }
    }
    return true;
  }
  private rifleFlatSupport() {
    const floor = this.sampleRoot.position.y;
    let lowest = Infinity,
      supported = false;
    for (const sole of required(this.previewFit).soles.values()) {
      const whole = sole.vertices.map(
          (index) => required(this.previewFit).solePoint(sole, index, new Vector3()).y - floor,
        ),
        outline = sole.outline.map(
          (index) => required(this.previewFit).solePoint(sole, index, new Vector3()).y - floor,
        );
      lowest = Math.min(lowest, ...whole);
      if (Math.min(...outline) >= -0.001 && Math.max(...outline) <= 0.008) {
        supported = true;
      }
    }
    return lowest >= -0.001 && supported;
  }
  private rifleNativeEndsFlat(clip: AnimationClip, action: AnimationAction) {
    for (const time of [0, clip.duration]) {
      required(this.previewFit).restore();
      action.time = time;
      required(this.sampleMixer).update(0);
      this.sampleRoot.updateMatrixWorld(true);
      if (!this.rifleFlatSupport()) {
        return false;
      }
    }
    return true;
  }
  private pathAllowed = (
    plan: MeleePosePlan,
    clip: AnimationClip,
    support: ContactSupport,
    action: AnimationAction,
  ) => {
    // A held weapon keeps its wrist socket even when the arm solver clamps.
    // Require the complete pistol and sabre wrist paths to be reachable,
    // beyond their contact and grip alone.
    if (plan.sabre || plan.twoHands) {
      // One lunge cannot exceed a same-foot half walking stride. Its serial
      // boot transfers must also fit the actual exported walking sole speed.
      // Missing native gait data retains the exact finite source strike.
      if (
        !this.walkingStep ||
        !this.walkingFootSpeed ||
        plan.step.length() > this.walkingStep ||
        plan.rearStep.length() > this.walkingStep ||
        (1.5 * (plan.step.length() + plan.rearStep.length())) /
          (plan.contact * 0.9 - plan.duration * 0.1) >
          this.walkingFootSpeed
      ) {
        return false;
      }
      if (
        plan.twoHands &&
        (!this.walkingSoleSpeed ||
          !this.walkingBootSpeed ||
          !required(this.previewFit).completeBoot)
      ) {
        return false;
      }
    }
    let previousOutline:
        | {
            time: number;
            points: Vector3[];
          }
        | undefined,
      previousBoot:
        | {
            time: number;
            points: Float64Array;
          }
        | undefined,
      bootBuffer: Float64Array | undefined;
    const sample = (time: number) => {
      if (plan.turn) {
        this.sampleRoot.rotation.set(
          0,
          plan.turn.fromYaw +
            angle(plan.turn.toYaw - plan.turn.fromYaw) * smooth(time / plan.turn.until),
          0,
        );
      }
      required(this.previewFit).restore();
      action.time = time;
      action.timeScale = 0;
      required(this.sampleMixer).update(0);
      this.sampleRoot.updateMatrixWorld(true);
      required(this.previewFit).pose(plan, time);
      if (plan.sabre || plan.twoHands) {
        const minimum =
          Math.min(
            ...[...required(this.previewFit).soles.values()].flatMap((sole) =>
              sole.vertices.map(
                (index) => required(this.previewFit).solePoint(sole, index, new Vector3()).y,
              ),
            ),
          ) - this.sampleRoot.position.y;
        if (minimum < -0.001 || minimum > 0.008 || (plan.twoHands && !this.rifleFlatSupport())) {
          return false;
        }
        const points = this.soleCenters(),
          before = this.pathFeet;
        if (before && time > before.time) {
          for (let side = 0; side < points.length; side++) {
            const delta = required(points[side]).clone().sub(required(before.points[side]));
            if (delta.length() / (time - before.time) > this.walkingFootSpeed + 1e-6) {
              return false;
            }
          }
        }
        this.pathFeet = { time, points };
        if (plan.twoHands) {
          const outline = this.soleOutlinePoints();
          if (previousOutline && time > previousOutline.time) {
            for (let vertex = 0; vertex < outline.length; vertex++) {
              if (
                required(outline[vertex]).distanceTo(required(previousOutline.points[vertex])) /
                  (time - previousOutline.time) >
                this.walkingSoleSpeed + 1e-6
              ) {
                return false;
              }
            }
          }
          previousOutline = { time, points: outline };
          const boot = this.completeBootPoints(bootBuffer);
          if (
            previousBoot &&
            time > previousBoot.time &&
            !this.bootSpeedAllowed(boot, previousBoot.points, time - previousBoot.time)
          ) {
            this.rifleSpeedPair = [previousBoot.time, time];
            return false;
          }
          bootBuffer = previousBoot?.points;
          previousBoot = { time, points: boot };
        }
      }
      return (
        this.floorAllowed(support) &&
        required(this.previewFit).footReachError < 0.001 &&
        (!(plan.pistol || plan.sabre || plan.twoHands) ||
          required(this.previewFit).handReachError < 1e-7)
      );
    };
    // Reject an obstructed contact footprint before checking its whole path.
    this.pathPrevious = undefined;
    this.pathFeet = undefined;
    if (!sample(plan.contact) || !this.bodyAllowed(support)) {
      return false;
    }
    // A previously rejected pair identifies only native sample times, not a
    // target pose or outcome. Screen those same adjacent boot samples first.
    // Every accepted candidate still passes the full chronological path below.
    const pair = plan.twoHands ? this.rifleSpeedPair : undefined;
    if (pair) {
      const bootAt = (time: number) => {
        if (plan.turn) {
          this.sampleRoot.rotation.set(
            0,
            plan.turn.fromYaw +
              angle(plan.turn.toYaw - plan.turn.fromYaw) * smooth(time / plan.turn.until),
            0,
          );
        }
        required(this.previewFit).restore();
        action.time = time;
        action.timeScale = 0;
        required(this.sampleMixer).update(0);
        this.sampleRoot.updateMatrixWorld(true);
        required(this.previewFit).pose(plan, time);
        return this.completeBootPoints();
      };
      const first = bootAt(pair[0]),
        second = bootAt(pair[1]);
      if (!this.bootSpeedAllowed(second, first, pair[1] - pair[0])) {
        return false;
      }
    }
    this.pathPrevious = undefined;
    this.pathFeet = undefined;
    previousOutline = undefined;
    previousBoot = undefined;
    const frequency = plan.sabre || plan.twoHands ? 240 : 120;
    for (let index = 0; index <= Math.ceil(clip.duration * frequency); index++) {
      if (
        !sample(Math.min(clip.duration, index / frequency)) ||
        (index % 4 === 0 && !this.bodyAllowed(support))
      ) {
        return false;
      }
    }
    return true;
  };
  apply(
    cue: ActorCue | undefined,
    clip: AnimationClip,
    spec: ClipSpec,
    weapon: Object3D | undefined,
    time: number,
    resolve?: ContactActorResolver,
  ) {
    this.maximumReachError = 0;
    this.footReachError = 0;
    this.handReachError = 0;
    if (
      !cue ||
      !weapon ||
      !this.body ||
      !['hand_r', 'foot_l', 'foot_r'].every((name) => this.limbs.has(name)) ||
      this.soles.size !== 2 ||
      !(
        spec.name.startsWith('stand.slash.blade') ||
        spec.name === 'stand.butt.short-gun' ||
        spec.name === 'stand.butt.long-gun'
      ) ||
      (spec.name === 'stand.butt.long-gun' && (!this.limbs.has('hand_l') || !this.gait)) ||
      (spec.name.startsWith('stand.slash.blade') && !this.gait) ||
      (cue.contactTarget &&
        (cue.contactTarget.mounted ||
          !['standing', 'crouched'].includes(cue.contactTarget.posture)))
    ) {
      this.plan = undefined;
      this.attemptedKey = '';
      return;
    }
    const key = cue.id;
    if (cue.contactTarget) {
      const admitted = resolve?.(cue.contactTarget);
      if (!admitted || !visible(admitted.root) || !visible(admitted.model)) {
        this.plan = undefined;
        this.attemptedKey = '';
        return;
      }
      // Contact starts from the current rendered target posture. A cached body
      // recovery can finish without reading an absent impact/result target.
      const floors = cue.contactSupport?.floors,
        floorKey =
          floors
            ?.map(
              (floor) => `${floor.minX},${floor.maxX},${floor.minZ},${floor.maxZ},${floor.height}`,
            )
            .join(';') ?? '';
      const phaseKey = `${key}:${spec.name}:${weapon.userData['itemId']}:${cue.contactTarget.key}:${cue.contactTarget.appearance}:${cue.contactTarget.posture}:${cue.contactTarget.position.join(',')}:${floorKey}:${cue.phase === 'contact' ? 'contact' : 'prepare'}`;
      if (this.attemptedKey !== phaseKey || this.attemptedTarget !== admitted.model) {
        this.prepare(phaseKey, cue, clip, spec, weapon, admitted.model);
      }
    } else if (this.plan?.cueId !== key) {
      this.plan = undefined;
      return;
    }
    const plan = this.plan;
    if (!plan) {
      return;
    }
    this.pose(plan, time);
  }
  private pose = (plan: MeleePosePlan, time: number) => {
    this.maximumReachError = 0;
    this.footReachError = 0;
    this.handReachError = 0;
    if (plan.turn) {
      this.root.rotation.set(
        0,
        plan.turn.fromYaw +
          angle(plan.turn.toYaw - plan.turn.fromYaw) * smooth(time / plan.turn.until),
        0,
      );
      this.root.updateWorldMatrix(true, false);
      this.root.updateMatrixWorld(true);
    }
    const { weight, handWeight, groundWeight, rearWeight, leadWeight, rearArc, leadArc } =
        this.transfer(plan, time),
      end = plan.duration;
    if (
      (plan.twoHands && (time <= 0 || time >= end)) ||
      (weight <= 0 && (!(plan.sabre || plan.twoHands) || time >= end))
    ) {
      return;
    }
    const modified = new Set<Object3D>([this.body]);
    for (const name of ['foot_l', 'foot_r', 'hand_r', ...(plan.twoHands ? ['hand_l'] : [])]) {
      const limb = required(this.limbs.get(name));
      modified.add(limb.base);
      modified.add(limb.middle);
      modified.add(limb.end);
    }
    if (plan.twoHands) {
      for (const side of ['l', 'r']) {
        const ball = this.model.getObjectByName(`ball_${side}`);
        if (ball) {
          modified.add(ball);
        }
      }
    }
    this.nativePose = [...modified].map((node) => ({
      node,
      position: node.position.clone(),
      quaternion: node.quaternion.clone(),
    }));
    // The preview sampler already updated the native hierarchy. Solving the
    // pelvis and limbs below updates every changed bone; its static mesh/root
    // transforms do not need another complete hierarchy traversal.
    if (!this.preview) {
      this.root.updateWorldMatrix(true, false);
      this.root.updateMatrixWorld(true);
    }
    const rootRotation = this.quaternion(this.root, new Quaternion());
    // Rifle soles retain exact source endpoints. Their native foot and ball
    // rotations approach the measured flat bind pose continuously, then return.
    if (plan.twoHands) {
      for (const side of ['l', 'r']) {
        for (const role of ['foot', 'ball']) {
          const node = required(this.model.getObjectByName(`${role}_${side}`)),
            rest = required(this.flatRest.get(node.name));
          const native = this.quaternion(node, new Quaternion()),
            desired = rootRotation.clone().multiply(rest);
          native.slerp(desired, groundWeight);
          this.quaternion(required(node.parent), this.parentRotation);
          node.quaternion.copy(this.parentRotation.invert().multiply(native));
          node.updateWorldMatrix(false, true);
        }
      }
    }
    const footTargets = new Map<string, Vector3>();
    for (const side of ['l', 'r']) {
      const target = this.position(required(this.limbs.get(`foot_${side}`)).end, new Vector3());
      if (plan.sabre || plan.twoHands) {
        // Each sabre boot starts from its complete grounded native sole. The
        // continuous transfer arcs below lift it from this same baseline. The
        // source starts its lift at10%. Settle the lead boot first while the
        // rear stays planted, then gather. The added ground baseline returns
        // continuously to the native guard over the final10% recovery.
        // A support handoff or recovery cannot toggle a raised source foot.
        const sole = required(this.soles.get(side));
        const minimum = Math.min(
          ...sole.vertices.map((index) => this.solePoint(sole, index, new Vector3()).y),
        );
        target.y +=
          (this.position(this.root, new Vector3()).y + sole.floor - minimum) * groundWeight;
      }
      footTargets.set(side, target);
    }
    // Keep the exact held contact. The added hand correction then returns
    // to its native guard before the pelvis completes its supported retreat.
    // The newly sampled target may breathe between wind-up and contact. Begin
    // from the admitted wind-up wrist correction, then reach the current target
    // correction at the original contact marker without an edge displacement.
    const handDelta = plan.hand.clone();
    if (plan.handFrom) {
      const begin = plan.handHandoffBegin ?? 0;
      handDelta
        .copy(plan.handFrom)
        .lerp(plan.hand, smooth((time - begin) / (plan.contact - begin)));
    }
    handDelta.applyQuaternion(rootRotation).multiplyScalar(handWeight);
    const handTarget = this.position(required(this.limbs.get('hand_r')).end, new Vector3()).add(
        handDelta,
      ),
      leftTarget = plan.twoHands
        ? this.position(required(this.limbs.get('hand_l')).end, new Vector3()).add(handDelta)
        : undefined,
      body = plan.body.clone().applyQuaternion(rootRotation).multiplyScalar(weight);
    const turnRear = plan.turn
      ? angle(plan.turn.fromYaw - this.root.rotation.y) * (time < plan.contact ? 1 - rearWeight : 0)
      : 0;
    const lead = required(footTargets.get('r')),
      rear = required(footTargets.get('l'));
    if (plan.turn) {
      rear
        .sub(this.position(this.root, new Vector3()))
        .applyAxisAngle(up, turnRear)
        .add(this.position(this.root, new Vector3()));
    }
    lead.add(plan.step.clone().applyQuaternion(rootRotation).multiplyScalar(leadWeight));
    rear.add(plan.rearStep.clone().applyQuaternion(rootRotation).multiplyScalar(rearWeight));
    rear.y +=
      rearArc * Math.min(0.035, (plan.rearStep.length() + (plan.turn?.footDistance ?? 0)) * 0.1);
    lead.y += leadArc * Math.min(0.045, plan.step.length() * 0.1);
    const support = plan.rearStep.length() > 0.005 && rearArc > 0 ? 'r' : 'l',
      sole = this.soles.get(support);
    if (sole && !(plan.sabre || plan.twoHands)) {
      const minimum = Math.min(
          ...sole.vertices.map((index) => this.solePoint(sole, index, new Vector3()).y),
        ),
        floor = this.position(this.root, new Vector3()).y + sole.floor;
      required(footTargets.get(support)).y += floor - minimum;
    }
    // Flex the knees by the amount the measured leg reach needs at this
    // sample, including the two recovery steps. Clamping the foot target
    // would pull a planted sole upward or make it skate along the floor.
    let kneeDrop = 0;
    for (const side of ['l', 'r']) {
      const leg = required(this.limbs.get(`foot_${side}`)),
        hip = this.position(leg.base, new Vector3()).add(body),
        foot = required(footTargets.get(side)),
        dx = hip.x - foot.x,
        dz = hip.z - foot.z;
      const height = Math.sqrt(
        Math.max(0, (leg.first + leg.second - 0.002) ** 2 - dx * dx - dz * dz),
      );
      kneeDrop = Math.max(kneeDrop, hip.y - foot.y - height);
    }
    body.y -= Math.max(0, kneeDrop);
    this.position(this.body, this.start).add(body);
    if (this.preview) {
      this.start.applyMatrix4(
        this.inverseParent.copy(required(this.body.parent).matrixWorld).invert(),
      );
    } else {
      required(this.body.parent).worldToLocal(this.start);
    }
    this.body.position.copy(this.start);
    this.body.updateWorldMatrix(false, true);
    for (const side of ['l', 'r']) {
      const foot = required(this.limbs.get(`foot_${side}`));
      this.solve(foot, required(footTargets.get(side)));
      if (side === 'l' && plan.turn) {
        this.quaternion(foot.end, this.endRotation);
        this.endRotation.premultiply(new Quaternion().setFromAxisAngle(up, turnRear));
        this.quaternion(required(foot.end.parent), this.parentRotation);
        foot.end.quaternion.copy(this.parentRotation.invert().multiply(this.endRotation));
        foot.end.updateWorldMatrix(false, true);
      }
    }
    this.solve(required(this.limbs.get('hand_r')), handTarget);
    if (leftTarget) {
      this.solve(required(this.limbs.get('hand_l')), leftTarget);
    }
  };
  /** PropertyMixer does not rewrite an unchanged track value. Restore its
   * native input before the next sample, including a held contact phase. */
  restore() {
    for (const pose of this.nativePose) {
      pose.node.position.copy(pose.position);
      pose.node.quaternion.copy(pose.quaternion);
    }
    this.nativePose = [];
  }
  dispose() {
    this.restore();
    if (this.sample && this.sampleMixer) {
      this.sampleMixer.stopAllAction();
      this.sampleMixer.uncacheRoot(this.sample);
      this.sample.traverse((node) => {
        if (isSkinnedMesh(node)) {
          node.skeleton.dispose();
        }
      });
    }
  }
  lowerCacheFor(
    plans: MeleePosePlan[],
    clip: AnimationClip,
    support: ContactSupport,
  ): LowerPathCache {
    const pf = required(this.previewFit),
      model = required(this.sample),
      root = this.sampleRoot,
      list = samplingNodes(model, root),
      names = list.map((node) => (node === root ? '@root' : node.name));
    const path = this.pathAllowed,
      pose = pf.pose,
      solve = pf.solve,
      body = this.bodyAllowed,
      recipes: LowerRecipe[] = [];
    let row: LowerPoseRow | undefined,
      rows: LowerPoseRow[] = [];
    this.bodyAllowed = () => {
      if (row) {
        row.bodyCheck = true;
      }
      return true;
    };
    pf.solve = (limb: Limb, target: Vector3) => {
      if (limb.end.name === 'hand_r' && row) {
        const values = new Float64Array(list.length * 26);
        let offset = 0;
        for (const node of list) {
          values.set(node.position.toArray(), offset);
          values.set(node.quaternion.toArray(), offset + 3);
          values.set(node.scale.toArray(), offset + 7);
          values.set(node.matrixWorld.elements, offset + 10);
          offset += 26;
        }
        row.values = values;
        row.footError = pf.footReachError;
        row.maximumError = pf.maximumReachError;
        row.solves = true;
      }
      return solve.call(pf, limb, target);
    };
    pf.pose = (plan: MeleePosePlan, time: number) => {
      const right = required(model.getObjectByName('hand_r')).getWorldPosition(new Vector3()),
        left = required(model.getObjectByName('hand_l')).getWorldPosition(new Vector3()),
        rotation = root.getWorldQuaternion(new Quaternion()),
        transfer = this.transfer(plan, time);
      row = {
        time,
        values: new Float64Array(),
        nativeRight: right.toArray(),
        nativeLeft: left.toArray(),
        rotation: rotation.toArray(),
        handWeight: transfer.handWeight,
        footError: 0,
        maximumError: 0,
        solves: false,
        bodyCheck: false,
      };
      pose.call(pf, plan, time);
      if (!row.solves) {
        const values = new Float64Array(list.length * 26);
        let offset = 0;
        for (const node of list) {
          values.set(node.position.toArray(), offset);
          values.set(node.quaternion.toArray(), offset + 3);
          values.set(node.scale.toArray(), offset + 7);
          values.set(node.matrixWorld.elements, offset + 10);
          offset += 26;
        }
        row.values = values;
        row.footError = pf.footReachError;
        row.maximumError = pf.maximumReachError;
      }
      rows.push(row);
      pf.handReachError = 0;
    };
    try {
      for (const plan of plans) {
        rows = [];
        row = undefined;
        const action = required(this.sampleMixer).clipAction(clip);
        this.rifleSpeedPair = undefined;
        const accepted = path.call(this, plan, clip, support, action);
        recipes.push({ key: meleeRecipeKey(plan), accepted, rows });
      }
    } finally {
      pf.pose = pose;
      pf.solve = solve;
      this.bodyAllowed = body;
      pf.restore();
    }
    return {
      core: pf.core.map((bound) => ({
        name: bound.bone.name,
        low: bound.low.toArray(),
        high: bound.high.toArray(),
      })),
      recipes,
      names,
      previewLegs: ['foot_l', 'foot_r'].map((name) => {
        const limb = required(pf.limbs.get(name));
        return { name, first: limb.first, second: limb.second };
      }),
      gait: {
        step: this.walkingStep,
        foot: this.walkingFootSpeed,
        sole: this.walkingSoleSpeed,
        boot: this.walkingBootSpeed,
      },
    };
  }
  cachedPathAllowed(cache: LowerPathCache, plan: MeleePosePlan, support: ContactSupport) {
    const pf = required(this.previewFit),
      model = required(this.sample),
      root = this.sampleRoot,
      recipe = cache.recipes.find((item) => item.key === meleeRecipeKey(plan));
    if (!recipe) {
      throw new Error(
        'MELEE_CACHE_MISSING_RECIPE ' +
          meleeRecipeKey(plan) +
          ' available ' +
          cache.recipes.map((item) => item.key).join('|'),
      );
    }
    if (
      !cache.previewLegs.every((value) => {
        const limb = required(pf.limbs.get(value.name));
        return limb.first === value.first && limb.second === value.second;
      })
    ) {
      throw new Error(
        'MELEE_CACHE_CHANGED_LEG ' +
          JSON.stringify(
            cache.previewLegs.map((value) => ({
              warm: value,
              current: {
                first: required(pf.limbs.get(value.name)).first,
                second: required(pf.limbs.get(value.name)).second,
              },
            })),
          ),
      );
    }
    if (!recipe.accepted) {
      return false;
    }
    const list = samplingNodes(model, root);
    if (
      list.length !== cache.names.length ||
      list.some((node, index) => (node === root ? '@root' : node.name) !== cache.names[index])
    ) {
      throw new Error('MELEE_CACHE_CHANGED_HIERARCHY');
    }
    for (const row of recipe.rows) {
      let offset = 0;
      for (const node of list) {
        node.position.fromArray(row.values, offset);
        node.quaternion.fromArray(row.values, offset + 3);
        node.scale.fromArray(row.values, offset + 7);
        node.matrixWorld.fromArray(row.values, offset + 10);
        offset += 26;
      }
      pf.maximumReachError = row.maximumError;
      pf.footReachError = row.footError;
      pf.handReachError = 0;
      if (row.solves) {
        const delta = plan.hand
            .clone()
            .applyQuaternion(new Quaternion().fromArray(row.rotation))
            .multiplyScalar(row.handWeight),
          right = new Vector3().fromArray(row.nativeRight).add(delta),
          left = new Vector3().fromArray(row.nativeLeft).add(delta);
        pf.solve(required(pf.limbs.get('hand_r')), right);
        if (plan.twoHands) {
          pf.solve(required(pf.limbs.get('hand_l')), left);
        }
      }
      if (pf.handReachError >= 1e-7 || (row.bodyCheck && !this.bodyAllowed(support))) {
        return false;
      }
    }
    return true;
  }
  initializeCachedSample(cache: LowerPathCache) {
    if (this.sample) {
      return false;
    }
    this.sample = poseTree(this.model);
    this.sampleRoot.add(required(this.sample));
    this.sampleMixer = new AnimationMixer(required(this.sample));
    const meshes: SkinnedMesh[] = [];
    this.model.traverse((node: Object3D) => {
      if (isSkinnedMesh(node) && visible(node)) {
        meshes.push(node);
      }
    });
    for (const mesh of meshes) {
      const copy = mesh.clone(false),
        bones = mesh.skeleton.bones.map((bone) => required(this.sample).getObjectByName(bone.name));
      const parent =
        mesh.parent === this.model
          ? this.sample
          : (required(this.sample).getObjectByName(required(mesh.parent).name) ?? this.sample);
      required(parent).add(copy);
      copy.bind(
        new Skeleton(
          bones.map((bone) => {
            if (!(bone instanceof Bone)) {
              throw new Error('Missing sampled skeleton bone');
            }
            return bone;
          }),
          mesh.skeleton.boneInverses,
        ),
        mesh.bindMatrix,
      );
    }
    // The core bounds were compiled from these exact owned buffers in the
    // worker. Avoid rescanning thousands of vertices in the first paid RAF.
    this.previewFit = new NativeMeleeContactFit(
      required(this.sample),
      this.sampleRoot,
      [...this.soles.values()][0]?.mesh.name,
      false,
    );
    const pf = this.previewFit;
    pf.preview = true;
    pf.core = cache.core.map((bound) => ({
      bone: required(required(this.sample).getObjectByName(bound.name)),
      low: new Vector3().fromArray(bound.low),
      high: new Vector3().fromArray(bound.high),
    }));
    pf.flatRest = new Map(
      [...this.flatRest].map(([name, quaternion]) => [name, quaternion.clone()]),
    );
    for (const [side, sole] of pf.soles) {
      const native = required(this.soles.get(side));
      sole.floor = native.floor;
      sole.outline = [...native.outline];
    }
    return true;
  }
  finalizeCachedSample() {
    const pf = required(this.previewFit);
    this.sampleRoot.position.set(0, 0, 0);
    this.sampleRoot.quaternion.identity();
    this.sampleRoot.scale.set(1, 1, 1);
    this.model.traverse((node: Object3D) => {
      if (isMesh(node)) {
        return;
      }
      const copy = required(this.sample).getObjectByName(node.name);
      if (copy) {
        copy.position.copy(node.position);
        copy.quaternion.copy(node.quaternion);
        copy.scale.copy(node.scale);
      }
    });
    this.sampleRoot.updateMatrixWorld(true);
    for (const limb of pf.limbs.values()) {
      limb.first = limb.base
        .getWorldPosition(new Vector3())
        .distanceTo(limb.middle.getWorldPosition(new Vector3()));
      limb.second = limb.middle
        .getWorldPosition(new Vector3())
        .distanceTo(limb.end.getWorldPosition(new Vector3()));
    }
  }
  nativePoseCacheFor(clip: AnimationClip, contact: number): NativePoseCache {
    const list = samplingNodes(required(this.sample)),
      action = required(this.sampleMixer).clipAction(clip);
    required(this.previewFit).restore();
    required(this.sampleMixer).stopAllAction();
    action.reset().play();
    action.timeScale = 0;
    const times = [
        contact,
        0,
        clip.duration,
        ...Array.from({ length: Math.ceil(clip.duration * 240) + 1 }, (_, i) =>
          Math.min(clip.duration, i / 240),
        ),
      ],
      rows: NativePoseCache['rows'] = [];
    for (const time of new Set(times)) {
      required(this.previewFit).restore();
      action.time = time;
      required(this.sampleMixer).update(0);
      this.sampleRoot.updateMatrixWorld(true);
      const values = new Float64Array(list.length * 10);
      let offset = 0;
      for (const node of list) {
        values.set(node.position.toArray(), offset);
        values.set(node.quaternion.toArray(), offset + 3);
        values.set(node.scale.toArray(), offset + 7);
        offset += 10;
      }
      rows.push({ time, values });
    }
    return { names: list.map((node) => node.name), rows };
  }
  replayNativeMixer(cache: NativePoseCache, clip: AnimationClip) {
    const list = samplingNodes(required(this.sample)),
      mixer = required(this.sampleMixer),
      update = mixer.update.bind(mixer),
      rows = new Map(cache.rows.map((row) => [row.time, row.values]));
    if (
      list.length !== cache.names.length ||
      list.some((node, index) => node.name !== cache.names[index])
    ) {
      throw Error('MELEE_NATIVE_CACHE_HIERARCHY');
    }
    mixer.update = (delta: number) => {
      const action = mixer.existingAction(clip),
        values =
          delta === 0 &&
          action?.enabled &&
          !action.paused &&
          action.isScheduled() &&
          rows.get(action.time);
      if (!values) {
        return update.call(mixer, delta);
      }
      let offset = 0;
      for (const node of list) {
        node.position.fromArray(values, offset);
        node.quaternion.fromArray(values, offset + 3);
        node.scale.fromArray(values, offset + 7);
        offset += 10;
      }
      return mixer;
    };
    return () => {
      mixer.update = update;
    };
  }
  settledPoseCacheFor(clip: AnimationClip, plan: MeleePosePlan): SettledPoseCache {
    const pf = required(this.previewFit),
      root: Object3D = this.sampleRoot,
      model: Object3D = required(this.sample),
      list = [root, ...samplingNodes(model)],
      position = pf.position,
      rows: SettledPoseRow[] = [],
      action = required(this.sampleMixer).clipAction(clip);
    required(this.sampleMixer).stopAllAction();
    action.reset().play();
    action.timeScale = 0;
    let row: SettledPoseRow | undefined;
    pf.position = (node: Object3D, target: Vector3) => {
      if (node === required(pf.limbs.get('hand_r')).end && !row) {
        const values = new Float64Array(list.length * 26);
        let offset = 0;
        for (const n of list) {
          values.set(n.position.toArray(), offset);
          values.set(n.quaternion.toArray(), offset + 3);
          values.set(n.scale.toArray(), offset + 7);
          values.set(n.matrixWorld.elements, offset + 10);
          offset += 26;
        }
        const transfer = this.transfer(plan, action.time),
          feet = ['l', 'r'].map((side) => {
            const sole = required(pf.soles.get(side)),
              point = position.call(pf, required(pf.limbs.get('foot_' + side)).end, new Vector3()),
              minimum = Math.min(
                ...sole.vertices.map((index: number) => pf.solePoint(sole, index, new Vector3()).y),
              );
            point.y +=
              (position.call(pf, root, new Vector3()).y + sole.floor - minimum) *
              transfer.groundWeight;
            return point.toArray();
          });
        row = {
          time: action.time,
          values,
          right: position.call(pf, required(pf.limbs.get('hand_r')).end, new Vector3()).toArray(),
          left: position.call(pf, required(pf.limbs.get('hand_l')).end, new Vector3()).toArray(),
          feet,
          rotation: root.getWorldQuaternion(new Quaternion()).toArray(),
        };
      }
      return position.call(pf, node, target);
    };
    try {
      for (const time of new Set([
        plan.contact,
        ...Array.from({ length: Math.ceil(clip.duration * 240) + 1 }, (_, i) =>
          Math.min(clip.duration, i / 240),
        ),
      ])) {
        pf.restore();
        action.time = time;
        row = undefined;
        if (plan.turn) {
          root.rotation.set(
            0,
            plan.turn.fromYaw +
              Math.atan2(
                Math.sin(plan.turn.toYaw - plan.turn.fromYaw),
                Math.cos(plan.turn.toYaw - plan.turn.fromYaw),
              ) *
                ((t: number) => {
                  t = Math.max(0, Math.min(1, t));
                  return t * t * (3 - 2 * t);
                })(time / plan.turn.until),
            0,
          );
        }
        required(this.sampleMixer).update(0);
        root.updateMatrixWorld(true);
        pf.pose(plan, time);
        if (row) {
          rows.push(row);
        }
      }
    } finally {
      pf.position = position;
      pf.restore();
    }
    return { names: list.map((n) => (n === root ? '@root' : n.name)), rows };
  }
  replaySettledPose(cache: SettledPoseCache) {
    const pf = required(this.previewFit),
      root = this.sampleRoot,
      model = required(this.sample),
      list = [root, ...samplingNodes(model)],
      pose = pf.pose,
      rows = new Map(cache.rows.map((row) => [row.time, row]));
    if (
      list.length !== cache.names.length ||
      list.some((node, index) => (node === root ? '@root' : node.name) !== cache.names[index])
    ) {
      throw Error('MELEE_SETTLED_CACHE_HIERARCHY');
    }
    pf.pose = function (plan: MeleePosePlan, time: number) {
      const row = rows.get(time);
      if (!row) {
        return pose.call(this, plan, time);
      }
      required(this).maximumReachError = 0;
      required(this).footReachError = 0;
      required(this).handReachError = 0;
      const modified = new Set<Object3D>([required(this).body]);
      for (const name of ['foot_l', 'foot_r', 'hand_r', 'hand_l']) {
        const limb = required(this.limbs.get(name));
        modified.add(limb.base);
        modified.add(limb.middle);
        modified.add(limb.end);
      }
      for (const side of ['l', 'r']) {
        const ball = model.getObjectByName('ball_' + side);
        if (ball) {
          modified.add(ball);
        }
      }
      required(this).nativePose = [...modified].map((node) => ({
        node,
        position: node.position.clone(),
        quaternion: node.quaternion.clone(),
      }));
      for (let index = 0; index < list.length; index++) {
        const node = required(list[index]);
        if (!/^(foot|ball)_[lr]$/.test(node.name)) {
          continue;
        }
        const offset = index * 26;
        node.quaternion.fromArray(row.values, offset + 3);
        node.matrixWorld.fromArray(row.values, offset + 10);
      }
      const rootRotation = new Quaternion().fromArray(row.rotation),
        { weight, handWeight, rearWeight, leadWeight, rearArc, leadArc } = this.transfer(
          plan,
          time,
        ),
        footTargets = new Map<string, Vector3>([
          ['l', new Vector3().fromArray(required(row.feet[0]))],
          ['r', new Vector3().fromArray(required(row.feet[1]))],
        ]),
        handDelta = plan.hand.clone().applyQuaternion(rootRotation).multiplyScalar(handWeight),
        handTarget = new Vector3().fromArray(row.right).add(handDelta),
        leftTarget = new Vector3().fromArray(row.left).add(handDelta),
        body = plan.body.clone().applyQuaternion(rootRotation).multiplyScalar(weight),
        turnRear = plan.turn
          ? Math.atan2(
              Math.sin(plan.turn.fromYaw - root.rotation.y),
              Math.cos(plan.turn.fromYaw - root.rotation.y),
            ) * (time < plan.contact ? 1 - rearWeight : 0)
          : 0,
        lead = required(footTargets.get('r')),
        rear = required(footTargets.get('l'));
      if (plan.turn) {
        rear
          .sub(required(this).position(root, new Vector3()))
          .applyAxisAngle(new Vector3(0, 1, 0), turnRear)
          .add(required(this).position(root, new Vector3()));
      }
      lead.add(plan.step.clone().applyQuaternion(rootRotation).multiplyScalar(leadWeight));
      rear.add(plan.rearStep.clone().applyQuaternion(rootRotation).multiplyScalar(rearWeight));
      rear.y +=
        rearArc * Math.min(0.035, (plan.rearStep.length() + (plan.turn?.footDistance ?? 0)) * 0.1);
      lead.y += leadArc * Math.min(0.045, plan.step.length() * 0.1);
      let kneeDrop = 0;
      for (const side of ['l', 'r']) {
        const leg = required(this.limbs.get('foot_' + side)),
          hip = required(this).position(leg.base, new Vector3()).add(body),
          foot = required(footTargets.get(side)),
          dx = hip.x - foot.x,
          dz = hip.z - foot.z,
          height = Math.sqrt(
            Math.max(0, (leg.first + leg.second - 0.002) ** 2 - dx * dx - dz * dz),
          );
        kneeDrop = Math.max(kneeDrop, hip.y - foot.y - height);
      }
      body.y -= Math.max(0, kneeDrop);
      required(this).position(required(this).body, required(this).start).add(body);
      required(this).start.applyMatrix4(
        required(this).inverseParent.copy(required(this.body.parent).matrixWorld).invert(),
      );
      required(this).body.position.copy(required(this).start);
      required(this).body.updateWorldMatrix(false, true);
      for (const side of ['l', 'r']) {
        const foot = required(this.limbs.get('foot_' + side));
        required(this).solve(foot, required(footTargets.get(side)));
        if (side === 'l' && plan.turn) {
          required(this).quaternion(foot.end, required(this).endRotation);
          required(this).endRotation.premultiply(
            new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), turnRear),
          );
          required(this).quaternion(required(foot.end.parent), required(this).parentRotation);
          foot.end.quaternion.copy(
            required(this).parentRotation.invert().multiply(required(this).endRotation),
          );
          foot.end.updateWorldMatrix(false, true);
        }
      }
      required(this).solve(required(this.limbs.get('hand_r')), handTarget);
      required(this).solve(required(this.limbs.get('hand_l')), leftTarget);
    };
    return () => {
      pf.pose = pose;
    };
  }
  scalarRiflePathGate(knownPairs: number[][] = []) {
    const pf = required(this.previewFit),
      original = this.pathAllowed,
      boot = pf.completeBoot;
    if (
      !boot ||
      boot.vertices.some((vertex: number, index: number) => vertex !== index) ||
      boot.mesh.bindMode !== 'attached' ||
      boot.mesh.geometry.morphAttributes.position?.length
    ) {
      return () => {};
    }
    const soles = [...pf.soles.values()],
      floorsFor = (support: ContactSupport) =>
        support.floors.filter(
          (floor) => Math.abs(floor.height - this.sampleRoot.position.y) < 0.001,
        );
    function floorAllowed(
      points: Float64Array,
      before: Float64Array | undefined,
      support: ContactSupport,
    ) {
      const floors = floorsFor(support);
      for (const sole of soles) {
        let minX = Infinity,
          maxX = -Infinity,
          minZ = Infinity,
          maxZ = -Infinity;
        for (const vertex of sole.outline) {
          const at = vertex * 3,
            x = required(points[at]),
            z = required(points[at + 2]);
          minX = Math.min(minX, x, before?.[at] ?? x);
          maxX = Math.max(maxX, x, before?.[at] ?? x);
          minZ = Math.min(minZ, z, before?.[at + 2] ?? z);
          maxZ = Math.max(maxZ, z, before?.[at + 2] ?? z);
        }
        minX -= 0.003;
        maxX += 0.003;
        minZ -= 0.003;
        maxZ += 0.003;
        const cuts = [
          minX,
          maxX,
          ...floors
            .flatMap((floor) => [floor.minX, floor.maxX])
            .filter((x: number) => x > minX && x < maxX),
        ].sort((a: number, b: number) => a - b);
        for (let index = 1; index < cuts.length; index++) {
          if (required(cuts[index]) - required(cuts[index - 1]) < 1e-10) {
            continue;
          }
          const x = (required(cuts[index]) + required(cuts[index - 1])) / 2,
            spans = floors
              .filter((floor) => x >= floor.minX && x <= floor.maxX)
              .map((floor) => [Math.max(minZ, floor.minZ), Math.min(maxZ, floor.maxZ)])
              .filter(([a, b]: number[]) => required(b) >= required(a))
              .sort((a: number[], b: number[]) => required(a[0]) - required(b[0]));
          let covered = minZ;
          for (const [a, b] of spans) {
            if (required(a) > covered + 1e-8) {
              break;
            }
            covered = Math.max(covered, required(b));
          }
          if (covered < maxZ - 1e-8) {
            return false;
          }
        }
      }
      return soles.length === 2;
    }
    this.pathAllowed = (
      plan: MeleePosePlan,
      clip: AnimationClip,
      support: ContactSupport,
      action: AnimationAction,
    ) => {
      if (!plan.twoHands) {
        return original.call(this, plan, clip, support, action);
      }
      if (
        !this.walkingStep ||
        !this.walkingFootSpeed ||
        plan.step.length() > this.walkingStep ||
        plan.rearStep.length() > this.walkingStep ||
        (1.5 * (plan.step.length() + plan.rearStep.length())) /
          (plan.contact * 0.9 - plan.duration * 0.1) >
          this.walkingFootSpeed ||
        !this.walkingSoleSpeed ||
        !this.walkingBootSpeed
      ) {
        return false;
      }
      let previous:
          | {
              time: number;
              points: Float64Array;
              centres: Vector3[];
            }
          | undefined,
        buffer: Float64Array | undefined;
      const native = (time: number) => {
        if (plan.turn) {
          this.sampleRoot.rotation.set(
            0,
            plan.turn.fromYaw +
              angle(plan.turn.toYaw - plan.turn.fromYaw) * smooth(time / plan.turn.until),
            0,
          );
        }
        pf.restore();
        action.time = time;
        action.timeScale = 0;
        required(this.sampleMixer).update(0);
        this.sampleRoot.updateMatrixWorld(true);
        pf.pose(plan, time);
      };
      const sample = (time: number) => {
        native(time);
        const points = this.completeBootPoints(buffer),
          floor = this.sampleRoot.position.y,
          centres: Vector3[] = [];
        let lowest = Infinity,
          supported = false;
        for (const sole of soles) {
          let minimum = Infinity,
            low = Infinity,
            high = -Infinity;
          for (const vertex of sole.vertices) {
            minimum = Math.min(minimum, required(points[vertex * 3 + 1]) - floor);
          }
          lowest = Math.min(lowest, minimum);
          const centre = new Vector3();
          for (const vertex of sole.outline) {
            const at = vertex * 3,
              y = required(points[at + 1]) - floor;
            low = Math.min(low, y);
            high = Math.max(high, y);
            centre.x += required(points[at]);
            centre.y += required(points[at + 1]);
            centre.z += required(points[at + 2]);
          }
          centre.divideScalar(sole.outline.length);
          centres.push(centre);
          if (low >= -0.001 && high <= 0.008) {
            supported = true;
          }
        }
        if (!(lowest >= -0.001 && lowest <= 0.008 && supported)) {
          return false;
        }
        const prior = previous;
        if (prior && time > prior.time) {
          const dt = time - prior.time;
          for (let side = 0; side < centres.length; side++) {
            const delta = required(centres[side]).clone().sub(required(prior.centres[side]));
            if (delta.length() / dt > this.walkingFootSpeed + 1e-6) {
              return false;
            }
          }
          for (const sole of soles) {
            for (const vertex of sole.outline) {
              const at = vertex * 3,
                x = required(points[at]) - required(prior.points[at]),
                y = required(points[at + 1]) - required(prior.points[at + 1]),
                z = required(points[at + 2]) - required(prior.points[at + 2]);
              if (Math.sqrt(x * x + y * y + z * z) / dt > this.walkingSoleSpeed + 1e-6) {
                return false;
              }
            }
          }
          if (!this.bootSpeedAllowed(points, prior.points, dt)) {
            this.rifleSpeedPair = [prior.time, time];
            return false;
          }
        }
        if (
          !floorAllowed(points, prior?.points, support) ||
          !(pf.footReachError < 0.001) ||
          !(pf.handReachError < 1e-7)
        ) {
          return false;
        }
        buffer = prior?.points;
        previous = { time, points, centres };
        return true;
      };
      this.pathPrevious = undefined;
      this.pathFeet = undefined;
      if (!sample(plan.contact) || !this.bodyAllowed(support)) {
        return false;
      }
      const pair = this.rifleSpeedPair,
        pairs = [
          ...(pair ? [pair] : []),
          ...knownPairs.filter((value) => !pair || value[0] !== pair[0] || value[1] !== pair[1]),
        ];
      for (const times of pairs) {
        if (
          times.length !== 2 ||
          !times.every(Number.isFinite) ||
          required(times[0]) < 0 ||
          required(times[1]) > clip.duration ||
          Math.abs(required(times[1]) - required(times[0]) - 1 / 240) > 1e-12
        ) {
          throw Error('MELEE_NATIVE_PAIR_INVALID');
        }
        native(required(times[0]));
        const first = this.completeBootPoints();
        native(required(times[1]));
        const second = this.completeBootPoints();
        if (!this.bootSpeedAllowed(second, first, required(times[1]) - required(times[0]))) {
          this.rifleSpeedPair = [required(times[0]), required(times[1])];
          return false;
        }
      }
      previous = undefined;
      buffer = undefined;
      this.pathPrevious = undefined;
      this.pathFeet = undefined;
      for (let index = 0; index <= Math.ceil(clip.duration * 240); index++) {
        if (
          !sample(Math.min(clip.duration, index / 240)) ||
          (index % 4 === 0 && !this.bodyAllowed(support))
        ) {
          return false;
        }
      }
      return true;
    };
    return () => {
      this.pathAllowed = original;
    };
  }
  prunePreviewUpdates() {
    const pf = required(this.previewFit),
      root: Object3D = this.sampleRoot,
      needed = new Set<Object3D>(),
      saved: {
        node: Object3D;
        world: Object3D['updateWorldMatrix'];
        matrix: Object3D['updateMatrixWorld'];
      }[] = [];
    const add = (node: Object3D | undefined) => {
      for (let current = node; current; current = current.parent ?? undefined) {
        needed.add(current);
      }
    };
    add(root);
    add(pf.body);
    for (const limb of pf.limbs.values()) {
      add(limb.base);
      add(limb.middle);
      add(limb.end);
    }
    for (const name of pf.flatRest.keys()) {
      add(required(this.sample).getObjectByName(name));
    }
    for (const bound of pf.core) {
      add(bound.bone);
    }
    const boot = pf.completeBoot;
    if (
      !boot ||
      boot.mesh.bindMode !== 'attached' ||
      boot.mesh.geometry.morphAttributes.position?.length
    ) {
      return () => {};
    }
    const indices = required(boot.mesh.geometry.attributes['skinIndex']),
      weights = required(boot.mesh.geometry.attributes['skinWeight']);
    for (let i = 0; i < indices.count; i++) {
      for (let slot = 0; slot < 4; slot++) {
        if (weights.getComponent(i, slot) > 0) {
          add(boot.mesh.skeleton.bones[indices.getComponent(i, slot)]);
        }
      }
    }
    root.traverse((node: Object3D) => {
      saved.push({
        node,
        world: node.updateWorldMatrix.bind(node),
        matrix: node.updateMatrixWorld.bind(node),
      });
      const children = node.children.filter((child) => needed.has(child));
      let native: number[] | undefined;
      const compose = () => {
        const p = node.position,
          q = node.quaternion,
          s = node.scale;
        if (
          !native ||
          native[0] !== p.x ||
          native[1] !== p.y ||
          native[2] !== p.z ||
          native[3] !== q.x ||
          native[4] !== q.y ||
          native[5] !== q.z ||
          native[6] !== q.w ||
          native[7] !== s.x ||
          native[8] !== s.y ||
          native[9] !== s.z
        ) {
          node.updateMatrix();
          native = [p.x, p.y, p.z, q.x, q.y, q.z, q.w, s.x, s.y, s.z];
        } else {
          node.matrixWorldNeedsUpdate = true;
        }
      };
      node.updateWorldMatrix = function (parents: boolean, descendants: boolean) {
        if (parents && this.parent) {
          this.parent.updateWorldMatrix(true, false);
        }
        if (this.matrixAutoUpdate) {
          compose();
        }
        if (this.matrixWorldAutoUpdate) {
          if (this.parent === null) {
            this.matrixWorld.copy(this.matrix);
          } else {
            this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
          }
        }
        if (descendants) {
          for (const child of children) {
            child.updateWorldMatrix(false, true);
          }
        }
      };
      node.updateMatrixWorld = function (force?: boolean) {
        if (this.matrixAutoUpdate) {
          compose();
        }
        if (this.matrixWorldNeedsUpdate || force) {
          if (this.matrixWorldAutoUpdate) {
            if (this.parent === null) {
              this.matrixWorld.copy(this.matrix);
            } else {
              this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
            }
          }
          this.matrixWorldNeedsUpdate = false;
          force = true;
        }
        for (const child of children) {
          child.updateMatrixWorld(force);
        }
      };
    });
    return () => {
      for (const record of saved) {
        record.node.updateWorldMatrix = record.world;
        record.node.updateMatrixWorld = record.matrix;
      }
    };
  }
  snapshotCalibration(): Calibration {
    return {
      limbs: [...this.limbs].map(([name, limb]) => ({
        name,
        first: limb.first,
        second: limb.second,
      })),
      flat: [...this.flatRest].map(([name, quaternion]) => ({
        name,
        quaternion: quaternion.toArray(),
      })),
      soles: [...this.soles].map(([name, sole]) => ({
        name,
        floor: sole.floor,
        outline: [...sole.outline],
      })),
    };
  }
  restoreCalibration(calibration: Calibration) {
    for (const value of calibration.limbs) {
      const limb = this.limbs.get(value.name);
      if (limb) {
        limb.first = value.first;
        limb.second = value.second;
      }
    }
    this.flatRest = new Map(
      calibration.flat.map((value) => [value.name, new Quaternion().fromArray(value.quaternion)]),
    );
    for (const value of calibration.soles) {
      const sole = this.soles.get(value.name);
      if (sole) {
        sole.floor = value.floor;
        sole.outline = [...value.outline];
      }
    }
  }

  get hasSamplingContext() {
    return this.sample !== undefined;
  }
  get hasFittedPlan() {
    return this.plan !== undefined;
  }
  get canFitPairedStrike() {
    return (
      Boolean(this.body) &&
      ['hand_r', 'hand_l', 'foot_l', 'foot_r'].every((name) => this.limbs.has(name)) &&
      this.soles.size === 2
    );
  }
  retainedTurn(cueId: string) {
    const turn = this.plan?.cueId === cueId ? this.plan.turn : undefined;
    return turn ? { ...turn } : undefined;
  }
  gaitCalibration() {
    return {
      step: this.walkingStep,
      foot: this.walkingFootSpeed,
      sole: this.walkingSoleSpeed,
      boot: this.walkingBootSpeed,
    };
  }
  admitGait(gait: LowerPathCache['gait']) {
    const before = this.gaitCalibration();
    for (const key of ['step', 'foot', 'sole', 'boot'] as const) {
      if (before[key] && before[key] !== gait[key]) {
        throw new Error('MELEE_CACHE_CHANGED_GAIT');
      }
    }
    this.walkingStep = gait.step;
    this.walkingFootSpeed = gait.foot;
    this.walkingSoleSpeed = gait.sole;
    this.walkingBootSpeed = gait.boot;
  }
  takeSamplingFrom(prepared: NativeMeleeContactFit) {
    if (this.sample) {
      throw new Error('MELEE_SAMPLE_ALREADY_OWNED');
    }
    this.sample = required(prepared.sample);
    this.sampleRoot = prepared.sampleRoot;
    this.sampleMixer = required(prepared.sampleMixer);
    this.previewFit = required(prepared.previewFit);
    prepared.sample = undefined;
    prepared.sampleMixer = undefined;
    prepared.previewFit = undefined;
  }
  releaseSampling() {
    const sample = this.sample;
    if (!sample) {
      return;
    }
    this.previewFit?.restore();
    this.sampleMixer?.stopAllAction();
    this.sampleMixer?.uncacheRoot(sample);
    sample.traverse((node) => {
      if (isSkinnedMesh(node)) {
        node.skeleton.dispose();
      }
    });
    this.sampleRoot.remove(sample);
    this.sample = undefined;
    this.sampleMixer = undefined;
    this.previewFit = undefined;
    this.sampleRoot.position.set(0, 0, 0);
    this.sampleRoot.quaternion.identity();
    this.sampleRoot.scale.set(1, 1, 1);
    this.sampleRoot.updateMatrixWorld(true);
  }
  preserveAttempt() {
    const plan = this.plan,
      gait = this.gaitCalibration();
    return () => {
      this.walkingStep = gait.step;
      this.walkingFootSpeed = gait.foot;
      this.walkingSoleSpeed = gait.sole;
      this.walkingBootSpeed = gait.boot;
      this.plan = plan;
      this.attemptedKey = '';
      this.attemptedTarget = undefined;
    };
  }
  sampleRejectedSpeedPairs(apply: () => void) {
    const pairs: [number, number][] = [],
      path = this.pathAllowed;
    this.pathAllowed = (plan, clip, support, action) => {
      const accepted = path.call(this, plan, clip, support, action),
        pair = this.rifleSpeedPair;
      if (pair && !pairs.some((value) => value[0] === pair[0] && value[1] === pair[1])) {
        pairs.push([...pair]);
      }
      return accepted;
    };
    try {
      apply();
      return pairs;
    } finally {
      this.pathAllowed = path;
    }
  }
  warmCacheMetadata(): LowerPathCache | undefined {
    const fit = this.previewFit;
    return fit
      ? {
          core: fit.core.map((bound) => ({
            name: bound.bone.name,
            low: bound.low.toArray(),
            high: bound.high.toArray(),
          })),
          recipes: [],
          names: [],
          previewLegs: [],
          gait: this.gaitCalibration(),
        }
      : undefined;
  }
  fittedPlanSnapshot() {
    const plan = this.plan;
    if (!plan) {
      return null;
    }
    const { key, cueId, contact, duration, pistol, sabre, twoHands, handRecovery, yaw, turn } =
      plan;
    return {
      key,
      cueId,
      hand: plan.hand.toArray(),
      body: plan.body.toArray(),
      step: plan.step.toArray(),
      rearStep: plan.rearStep.toArray(),
      contact,
      duration,
      pistol,
      sabre,
      twoHands,
      handRecovery,
      yaw,
      turn,
    };
  }
}
