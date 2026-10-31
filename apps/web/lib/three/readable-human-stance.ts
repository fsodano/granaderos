import { required } from './required';
import { isSkinnedMesh } from './scene-node-types';
import { Bone } from 'three';
import {
  AnimationClip,
  AnimationMixer,
  LoopOnce,
  Object3D,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
} from 'three';
type Limb = {
  upper: Object3D;
  joint: Object3D;
  end: Object3D;
  side: number;
};
type Sole = {
  points: Vector3[];
  normal: Vector3;
  forward: Vector3;
};
type RestOptions = {
  plantFeet?: boolean;
  footwearName?: string;
};
const cache = new WeakMap<Object3D, WeakMap<AnimationClip, Map<string, AnimationClip>>>();
const world = (node: Object3D) => node.getWorldPosition(new Vector3());
const finite = (point: Vector3) =>
  Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z);
/** Read the native sole in foot-bone space. An ankle height cannot describe
 * both boots: their bind offsets and native idle pitch are different. */
function nativeSoles(body: Object3D, legs: Limb[], footwearName?: string): Sole[] | undefined {
  const mesh = footwearName ? body.getObjectByName(footwearName) : undefined;
  if (
    !isSkinnedMesh(mesh) ||
    mesh.bindMode !== 'attached' ||
    mesh.geometry.morphAttributes.position?.length
  ) {
    return;
  }
  const p = mesh.geometry.attributes['position'],
    indices = mesh.geometry.attributes['skinIndex'],
    weights = mesh.geometry.attributes['skinWeight'];
  if (
    !p ||
    !indices ||
    !weights ||
    p.itemSize < 3 ||
    indices.itemSize < 4 ||
    weights.itemSize < 4 ||
    indices.count !== p.count ||
    weights.count !== p.count
  ) {
    return;
  }
  const index = mesh.geometry.index,
    used = index
      ? [...new Set<number>(Array.from({ length: index.count }, (_, i) => index.getX(i)))]
      : Array.from({ length: p.count }, (_, i) => i),
    soles: Sole[] = [];
  for (const leg of legs) {
    const foot = mesh.skeleton.bones.find((bone) => bone.name === leg.end.name),
      inverse = foot && mesh.skeleton.boneInverses[mesh.skeleton.bones.indexOf(foot)];
    if (!foot || !inverse) {
      return;
    }
    const belongs = (bone: Object3D) => {
      for (let node: Object3D | null = bone; node; node = node.parent) {
        if (node.name === leg.upper.name) {
          return true;
        }
      }
      return false;
    };
    const side: number[] = [];
    for (const i of used) {
      if (i < 0 || i >= p.count) {
        return;
      }
      let total = 0,
        own = 0;
      for (let slot = 0; slot < 4; slot++) {
        const weight = weights.getComponent(i, slot);
        if (!Number.isFinite(weight) || weight < 0) {
          return;
        }
        if (weight === 0) {
          continue;
        }
        const bone = mesh.skeleton.bones[indices.getComponent(i, slot)];
        if (!bone) {
          return;
        }
        total += weight;
        if (belongs(bone)) {
          own += weight;
        }
      }
      if (Math.abs(total - 1) > 1e-5) {
        return;
      }
      if (own > 1 - 1e-5) {
        side.push(i);
      }
    }
    if (!side.length) {
      return;
    }
    const minimum = Math.min(...side.map((i) => p.getY(i))),
      ring = side.filter((i) => p.getY(i) < minimum + 0.003);
    if (ring.length < 3) {
      return;
    }
    const front = Math.max(...ring.map((i) => p.getZ(i))),
      back = Math.min(...ring.map((i) => p.getZ(i)));
    if (!Number.isFinite(minimum + front + back) || front - back < 0.02) {
      return;
    }
    const points: Vector3[] = [],
      toe = new Vector3(),
      heel = new Vector3();
    let toes = 0,
      heels = 0;
    for (const i of ring) {
      // A deformed or mixed-weight sole needs its own fitter; do not guess.
      for (let slot = 0; slot < 4; slot++) {
        if (
          weights.getComponent(i, slot) > 1e-6 &&
          (mesh.skeleton.bones[indices.getComponent(i, slot)] !== foot ||
            Math.abs(weights.getComponent(i, slot) - 1) > 1e-6)
        ) {
          return;
        }
      }
      const point = new Vector3()
        .fromBufferAttribute(p, i)
        .applyMatrix4(mesh.bindMatrix)
        .applyMatrix4(inverse);
      if (!finite(point)) {
        return;
      }
      points.push(point);
      if (p.getZ(i) > front - 0.001) {
        toe.add(point);
        toes++;
      }
      if (p.getZ(i) < back + 0.001) {
        heel.add(point);
        heels++;
      }
    }
    if (!toes || !heels) {
      return;
    }
    const normal = new Vector3(0, 1, 0)
        .transformDirection(mesh.bindMatrix)
        .transformDirection(inverse),
      forward = toe.divideScalar(toes).sub(heel.divideScalar(heels));
    if (!finite(normal) || !finite(forward) || forward.lengthSq() < 1e-8) {
      return;
    }
    forward.normalize();
    soles.push({ points, normal, forward });
  }
  return soles;
}
function skeletonCopy(node: Object3D): Object3D {
  const containsBone = (part: Object3D): boolean =>
    Boolean(part instanceof Bone) || part.children.some(containsBone);
  const copy = node.clone(false);
  for (const child of node.children) {
    if (containsBone(child)) {
      copy.add(skeletonCopy(child));
    }
  }
  return copy;
}
function turn(bone: Object3D, before: Vector3, after: Vector3) {
  const rotation = new Quaternion()
    .setFromUnitVectors(before.normalize(), after.normalize())
    .multiply(bone.getWorldQuaternion(new Quaternion()));
  bone.quaternion.copy(
    required(bone.parent).getWorldQuaternion(new Quaternion()).invert().multiply(rotation),
  );
  bone.updateWorldMatrix(false, true);
}
function solve(limb: Limb, target: Vector3, pole: Vector3, orientation: Quaternion) {
  const { upper, joint, end } = limb,
    start = world(upper),
    middle = world(joint),
    finish = world(end),
    a = start.distanceTo(middle),
    b = middle.distanceTo(finish);
  const direction = target.clone().sub(start),
    distance = direction.length();
  if (distance >= a + b - 1e-7 || distance <= Math.abs(a - b) + 1e-7) {
    return false;
  }
  direction.normalize();
  pole.sub(start);
  pole.addScaledVector(direction, -pole.dot(direction));
  if (pole.lengthSq() < 1e-10) {
    return false;
  }
  const along = (a * a - b * b + distance * distance) / (2 * distance),
    rise = Math.sqrt(Math.max(0, a * a - along * along));
  const bend = start
    .clone()
    .addScaledVector(direction, along)
    .addScaledVector(pole.normalize(), rise);
  turn(upper, middle.sub(start), bend.clone().sub(start));
  turn(joint, world(end).sub(world(joint)), target.clone().sub(world(joint)));
  end.quaternion.copy(
    required(end.parent).getWorldQuaternion(new Quaternion()).invert().multiply(orientation),
  );
  end.updateWorldMatrix(false, true);
  return true;
}
/** Reuse native clocks and bone lengths. Baking the small pose changes into a
 * cached clip lets the existing crossfades and planted-foot forecasts see the
 * same poses as the visible body. Source clips, horse clips and work stay intact. */
export function readableHumanClip(
  source: AnimationClip,
  body: Object3D,
  bones: Record<string, string>,
  semantic: string,
  options: RestOptions = {},
) {
  const [posture, action, equipment] = semantic.split('.');
  if (
    !['stand', 'mounted'].includes(required(posture)) ||
    !['idle', 'walk', 'run', 'backwalk', 'strafeLeft', 'strafeRight'].includes(required(action))
  ) {
    return source;
  }
  // The wide relaxed stance is a rest pose. Preserve native foot crossings,
  // knee planes and arm swing while walking or running.
  if (posture === 'stand' && action !== 'idle') {
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
  const plantFeet = Boolean(options.plantFeet && posture === 'stand' && action === 'idle'),
    key = plantFeet ? `${semantic}:planted:${options.footwearName ?? ''}` : semantic;
  const cached = variants.get(key);
  if (cached) {
    return cached;
  }
  const model = skeletonCopy(body),
    root = model.getObjectByName(required(bones['root'])),
    hips = model.getObjectByName(required(bones['hips']));
  const limb = (role: string, side: number): Limb | undefined => {
    const end = model.getObjectByName(required(bones[role])),
      joint = end?.parent,
      upper = joint?.parent;
    return end && end instanceof Bone && joint instanceof Bone && upper instanceof Bone
      ? { upper: required(upper), joint: required(joint), end, side }
      : undefined;
  };
  const legs = [limb('footLeft', 1), limb('footRight', -1)],
    arms = [limb('handLeft', 1), limb('handRight', -1)];
  // Replacement rigs without the native two-joint chains retain their own pose.
  if (
    !root ||
    !root.parent ||
    !hips ||
    legs.some((leg) => !leg || leg.upper.parent !== hips) ||
    arms.some((arm) => !arm)
  ) {
    variants.set(key, source);
    return source;
  }
  // Keep the mounted seat exact while opening the elbows.
  const widenLegs = posture === 'stand';
  const nativeLegs = legs.filter((leg): leg is Limb => leg !== undefined),
    nativeArms = arms.filter((arm): arm is Limb => arm !== undefined),
    modified = [...(widenLegs ? nativeLegs : []), ...nativeArms].flatMap((limb) => [
      limb.upper,
      limb.joint,
      limb.end,
    ]);
  if (
    widenLegs &&
    nativeLegs.some((leg) => !leg.end.children.some((child) => child instanceof Bone))
  ) {
    variants.set(key, source);
    return source;
  }
  const soles = plantFeet ? nativeSoles(body, nativeLegs, options.footwearName) : undefined;
  if (plantFeet && !soles) {
    variants.set(key, source);
    return source;
  }
  const samples = Math.max(1, Math.ceil(source.duration * 60)),
    times = [
      ...new Set(
        [
          ...Array.from({ length: samples + 1 }, (_, n) => (source.duration * n) / samples),
          ...source.tracks.flatMap((track) => Array.from(track.times)),
        ].map(Math.fround),
      ),
    ].sort((a, b) => a - b);
  const values = new Map(modified.map((node) => [node, [] as number[]])),
    positions: number[] = [];
  const native = new Map(modified.map((node) => [node, node.quaternion.clone()])),
    nativeRoot = root.position.clone();
  const mixer = new AnimationMixer(model),
    playing = mixer.clipAction(source).setLoop(LoopOnce, 1);
  playing.clampWhenFinished = true;
  playing.play();
  const unsupported = () => {
    mixer.stopAllAction();
    mixer.uncacheRoot(model);
    variants.set(key, source);
    return source;
  };
  for (const time of times) {
    for (const [node, rotation] of native) {
      node.quaternion.copy(rotation);
    }
    root.position.copy(nativeRoot);
    playing.enabled = true;
    playing.paused = false;
    playing.time = time;
    playing.timeScale = 0;
    mixer.update(0);
    model.updateMatrixWorld(true);
    for (const [node, rotation] of native) {
      rotation.copy(node.quaternion);
    }
    nativeRoot.copy(root.position);
    // Held guards retain enough forward reach for the native paid care/loot
    // transition; their foot spread is smaller than the relaxed unarmed pose.
    const centre = world(hips).x,
      shoulders = nativeArms.map((arm) => world(arm.upper)),
      halfWidth =
        Math.abs(required(shoulders[0]).x - required(shoulders[1]).x) *
        (equipment === 'unarmed' ? 0.48 : 0.34);
    if (widenLegs) {
      const goals = nativeLegs.map((leg, index) => {
        const target = world(leg.end),
          orientation = leg.end.getWorldQuaternion(new Quaternion());
        target.x = centre + leg.side * Math.max(halfWidth, leg.side * (target.x - centre));
        const sole = soles?.[index],
          toe = required(leg.end.children.find((child) => child instanceof Bone)),
          forward = sole
            ? sole.forward.clone().applyQuaternion(orientation)
            : world(toe).sub(world(leg.end));
        // Native feet face +Z. A preserved inward yaw becomes conspicuous once
        // the ankles spread; turn only that yaw out, retaining pitch and roll.
        const heading = Math.atan2(forward.x, forward.z),
          outward = leg.side * Math.max(leg.side * heading, Math.PI / 180),
          yaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), outward - heading);
        orientation.premultiply(yaw);
        forward.applyQuaternion(yaw);
        forward.y = 0;
        forward.normalize();
        if (sole) {
          // Flatten the actual sole, then restore its outward heading. The ankle
          // target comes from the lowest sole vertex, not a guessed bone offset.
          const up = new Vector3(0, 1, 0),
            normal = sole.normal.clone().applyQuaternion(orientation);
          orientation.premultiply(new Quaternion().setFromUnitVectors(normal, up));
          const flatForward = sole.forward.clone().applyQuaternion(orientation),
            flatHeading = Math.atan2(flatForward.x, flatForward.z);
          orientation.premultiply(new Quaternion().setFromAxisAngle(up, outward - flatHeading));
          const scale = leg.end.getWorldScale(new Vector3());
          if (
            !finite(scale) ||
            scale.x <= 0 ||
            Math.abs(scale.x - scale.y) > 1e-6 ||
            Math.abs(scale.x - scale.z) > 1e-6
          ) {
            return;
          }
          target.y =
            0.002 -
            Math.min(
              ...sole.points.map(
                (point) => point.clone().multiply(scale).applyQuaternion(orientation).y,
              ),
            );
          forward.copy(sole.forward).applyQuaternion(orientation);
          forward.y = 0;
          forward.normalize();
        }
        // A knee target at an absolute X can sit inside the hip-to-ankle axis.
        // Place its bend direction in the same forward plane as the toe instead.
        const pole = world(leg.upper).add(forward);
        return { leg, target, orientation, pole };
      });
      if (goals.some((goal) => !goal || !finite(goal.target))) {
        return unsupported();
      }
      const supported = goals.filter(
        (goal): goal is NonNullable<typeof goal> => goal !== undefined,
      );
      let drop = 0;
      for (const { leg, target } of supported) {
        const start = world(leg.upper),
          middle = world(leg.joint),
          reach = (start.distanceTo(middle) + middle.distanceTo(world(leg.end))) * 0.9995,
          horizontal = (start.x - target.x) ** 2 + (start.z - target.z) ** 2;
        drop = Math.max(
          drop,
          start.y - target.y - Math.sqrt(Math.max(0, reach * reach - horizontal)),
        );
      }
      if (plantFeet && (!Number.isFinite(drop) || drop > 0.06)) {
        return unsupported();
      }
      if (drop <= (plantFeet ? 0.06 : 0.018)) {
        if (drop > 0) {
          const point = world(root);
          point.y -= drop;
          root.position.copy(required(root.parent).worldToLocal(point));
          root.updateWorldMatrix(false, true);
        }
        for (const { leg, target, orientation, pole } of supported) {
          if (!solve(leg, target, pole, orientation) && plantFeet) {
            return unsupported();
          }
        }
      }
    }
    for (const arm of nativeArms) {
      const start = world(arm.upper),
        target = world(arm.end),
        pole = world(arm.joint),
        orientation = arm.end.getWorldQuaternion(new Quaternion());
      // Unarmed hands may relax outward. Held hands and mounted rein positions
      // stay fixed, while the elbow bends away from the torso around that grip.
      if (posture === 'stand' && equipment === 'unarmed') {
        target.x =
          centre +
          arm.side * Math.max(arm.side * (target.x - centre), arm.side * (start.x - centre) + 0.1);
      }
      pole.x =
        centre +
        arm.side * Math.max(arm.side * (pole.x - centre), arm.side * (start.x - centre) + 0.105);
      solve(arm, target, pole, orientation);
    }
    for (const node of modified) {
      const row = required(values.get(node)),
        q = node.quaternion;
      if (
        row.length &&
        row.slice(-4).reduce((sum, value, index) => sum + value * required(q.toArray()[index]), 0) <
          0
      ) {
        row.push(-q.x, -q.y, -q.z, -q.w);
      } else {
        row.push(q.x, q.y, q.z, q.w);
      }
    }
    positions.push(...root.position.toArray());
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(model);
  const replacements = new Map<string, QuaternionKeyframeTrack | VectorKeyframeTrack>(
    modified.map((node) => [
      node.name + '.quaternion',
      new QuaternionKeyframeTrack(node.name + '.quaternion', times, required(values.get(node))),
    ]),
  );
  if (widenLegs) {
    replacements.set(
      root.name + '.position',
      new VectorKeyframeTrack(root.name + '.position', times, positions),
    );
  }
  const clip = new AnimationClip(
    source.name,
    source.duration,
    [...source.tracks.filter((track) => !replacements.has(track.name)), ...replacements.values()],
    source.blendMode,
  );
  variants.set(key, clip);
  return clip;
}
