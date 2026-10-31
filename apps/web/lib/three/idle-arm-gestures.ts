import { required } from './required';
import { Bone } from 'three';
import {
  AnimationClip,
  AnimationMixer,
  LoopOnce,
  Object3D,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
} from 'three';
type HandRole = 'handLeft' | 'handRight';
export type IdleFreeHands = Readonly<Partial<Record<HandRole, boolean>>>;
type Arm = {
  shoulder: Object3D;
  upper: Object3D;
  elbow: Object3D;
  hand: Object3D;
  side: number;
};
const cache = new WeakMap<Object3D, WeakMap<AnimationClip, Map<string, AnimationClip>>>();
const point = (node: Object3D) => node.getWorldPosition(new Vector3());
const rotation = (node: Object3D) => node.getWorldQuaternion(new Quaternion());
function skeletonCopy(node: Object3D): Object3D {
  const hasBone = (part: Object3D): boolean =>
    Boolean(part instanceof Bone) || part.children.some(hasBone);
  const copy = node.clone(false);
  for (const child of node.children) {
    if (hasBone(child)) {
      copy.add(skeletonCopy(child));
    }
  }
  return copy;
}
function worldRotation(node: Object3D, value: Quaternion) {
  node.quaternion.copy(rotation(required(node.parent)).invert().multiply(value));
  node.updateWorldMatrix(false, true);
}
function turn(node: Object3D, before: Vector3, after: Vector3) {
  worldRotation(
    node,
    new Quaternion()
      .setFromUnitVectors(before.normalize(), after.normalize())
      .multiply(rotation(node)),
  );
}
function solve(arm: Arm, target: Vector3, pole: Vector3, handRotation: Quaternion) {
  const start = point(arm.upper),
    middle = point(arm.elbow),
    end = point(arm.hand),
    a = start.distanceTo(middle),
    b = middle.distanceTo(end),
    direction = target.clone().sub(start),
    distance = direction.length();
  if (
    !Number.isFinite(distance) ||
    distance >= a + b - 1e-7 ||
    distance <= Math.abs(a - b) + 1e-7
  ) {
    return false;
  }
  direction.normalize();
  pole.sub(start);
  pole.addScaledVector(direction, -pole.dot(direction));
  if (pole.lengthSq() < 1e-10) {
    return false;
  }
  const along = (a * a - b * b + distance * distance) / (2 * distance),
    rise = Math.sqrt(Math.max(0, a * a - along * along)),
    bend = start.clone().addScaledVector(direction, along).addScaledVector(pole.normalize(), rise);
  turn(arm.upper, middle.sub(start), bend.clone().sub(start));
  turn(arm.elbow, point(arm.hand).sub(point(arm.elbow)), target.clone().sub(point(arm.elbow)));
  worldRotation(arm.hand, handRotation);
  return true;
}
/** Add one restrained, staggered free-arm stretch to the existing breathing
 * cycle. The caller admits noncombat standing rest and supplies actual free
 * hands. Held arms, torso, feet, source duration and the actor clock stay exact. */
export function idleArmGesturesClip(
  source: AnimationClip,
  body: Object3D,
  bones: Record<string, string>,
  freeHands: IdleFreeHands,
) {
  const roles = (['handLeft', 'handRight'] as const).filter((role) => freeHands[role] === true);
  if (
    !roles.length ||
    !source.name.startsWith('stand.idle.') ||
    !Number.isFinite(source.duration) ||
    source.duration <= 0
  ) {
    return source;
  }
  let clips = cache.get(body);
  if (!clips) {
    clips = new WeakMap();
    cache.set(body, clips);
  }
  let variants = clips.get(source);
  if (!variants) {
    variants = new Map();
    clips.set(source, variants);
  }
  const key = roles.join(':'),
    cached = variants.get(key);
  if (cached) {
    return cached;
  }
  const model = skeletonCopy(body),
    chest = model.getObjectByName(required(bones['chest']));
  const arms = roles.map((role) => {
    const hand = model.getObjectByName(required(bones[role])),
      elbow = hand?.parent,
      upper = elbow?.parent,
      shoulder = upper?.parent;
    return [hand, elbow, upper, shoulder].every((node) => node instanceof Bone) &&
      required(shoulder).parent === chest
      ? {
          hand: required(hand),
          elbow: required(elbow),
          upper: required(upper),
          shoulder: required(shoulder),
          side: role === 'handLeft' ? 1 : -1,
        }
      : undefined;
  });
  // A replacement rig must not borrow a shared spine node as an arm joint.
  if (!chest || chest instanceof Bone !== true || arms.some((arm) => !arm)) {
    variants.set(key, source);
    return source;
  }
  const freeArms = arms.filter((arm): arm is Arm => arm !== undefined),
    modified = freeArms.flatMap((arm) => [arm.shoulder, arm.upper, arm.elbow, arm.hand]);
  if (new Set(modified).size !== modified.length) {
    variants.set(key, source);
    return source;
  }
  const count = Math.max(1, Math.ceil(source.duration * 60)),
    times = [
      ...new Set(
        [
          ...Array.from({ length: count + 1 }, (_, i) => (source.duration * i) / count),
          ...source.tracks.flatMap((track) => Array.from(track.times)),
        ].map(Math.fround),
      ),
    ].sort((a, b) => a - b);
  const native = new Map(modified.map((node) => [node, node.quaternion.clone()])),
    values = new Map(modified.map((node) => [node, [] as number[]]));
  const mixer = new AnimationMixer(model),
    playing = mixer.clipAction(source).setLoop(LoopOnce, 1);
  playing.clampWhenFinished = true;
  playing.timeScale = 0;
  playing.play();
  let valid = true;
  for (const time of times) {
    for (const [node, value] of native) {
      node.quaternion.copy(value);
    }
    playing.enabled = true;
    playing.paused = false;
    playing.time = Math.min(time, source.duration);
    mixer.update(0);
    model.updateMatrixWorld(true);
    for (const [node, value] of native) {
      value.copy(node.quaternion);
    }
    for (const arm of freeArms) {
      // One short gesture per full cycle. The two shoulders lead at different
      // times, then both return to the accepted breathing pose for a long rest.
      const startPhase = arm.side > 0 ? 0.12 : 0.26,
        t = (time / source.duration - startPhase) / 0.22;
      if (t <= 0 || t >= 1) {
        continue;
      }
      const stretch = Math.sin(Math.PI * t) ** 2,
        roll = Math.sin(2 * Math.PI * t) * stretch;
      const start = point(arm.upper),
        middle = point(arm.elbow),
        end = point(arm.hand),
        handRotation = rotation(arm.hand),
        direction = end.clone().sub(start),
        distance = direction.length(),
        reach = start.distanceTo(middle) + middle.distanceTo(end);
      if (!Number.isFinite(reach) || distance < 1e-7) {
        valid = false;
        break;
      }
      const shoulderTurn = new Quaternion()
        .setFromAxisAngle(new Vector3(0, 0, 1), arm.side * 0.03 * stretch)
        .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), arm.side * 0.045 * roll));
      worldRotation(arm.shoulder, shoulderTurn.multiply(rotation(arm.shoulder)));
      // Extend only into the existing elbow bend; never lock or lengthen an
      // arm. A sixteen-degree outward arc stays readable at tactical scale.
      const extension = Math.min(0.035, Math.max(0, reach * 0.985 - distance)) * 0.65 * stretch;
      direction
        .normalize()
        .applyAxisAngle(new Vector3(0, 0, 1), arm.side * 0.28 * stretch)
        .applyAxisAngle(new Vector3(1, 0, 0), 0.08 * roll);
      const newStart = point(arm.upper),
        target = newStart.clone().addScaledVector(direction, distance + extension),
        pole = middle
          .add(newStart.clone().sub(start))
          .add(new Vector3(arm.side * 0.025 * stretch, 0, 0.01 * roll));
      if (!solve(arm, target, pole, handRotation)) {
        valid = false;
        break;
      }
    }
    if (!valid) {
      break;
    }
    for (const node of modified) {
      const row = required(values.get(node)),
        q = node.quaternion,
        sign =
          row.length &&
          row
            .slice(-4)
            .reduce((sum, value, index) => sum + value * required(q.toArray()[index]), 0) < 0
            ? -1
            : 1;
      row.push(q.x * sign, q.y * sign, q.z * sign, q.w * sign);
    }
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(model);
  if (!valid) {
    variants.set(key, source);
    return source;
  }
  const replacements = new Map(
    modified.map((node) => [
      node.name + '.quaternion',
      new QuaternionKeyframeTrack(node.name + '.quaternion', times, required(values.get(node))),
    ]),
  );
  const result = new AnimationClip(
    source.name,
    source.duration,
    [...source.tracks.filter((track) => !replacements.has(track.name)), ...replacements.values()],
    source.blendMode,
  );
  variants.set(key, result);
  return result;
}
