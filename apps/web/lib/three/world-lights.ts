import { Group, PointLight, Quaternion, Vector3 } from 'three';
import { ladderGeometry } from '../../../../packages/game/climb-geometry.ts';
import { WorldBatch, seeded } from './world-geometry';
import { illuminationAt } from './world-materials';
import type { WorldGeometry } from './world-geometry';
import type { WorldMaterialSource } from './world-materials';
import type {
  WorldInput,
  WorldLight,
  WorldPoint,
  WorldSmoke,
} from './world-types';

export function lightActive(light: WorldLight) {
  return (
    !light.extinguished && light.turns !== 0 && light.remainingSeconds !== 0
  );
}
export function buildLight(
  id: string,
  source: WorldLight,
  input: WorldInput,
  T: number,
  geometry: WorldGeometry,
  materials: WorldMaterialSource,
  pointLight = true,
) {
  const batch = new WorldBatch(geometry),
    light = illuminationAt(input, source),
    wood = materials.get('darkwood'),
    iron = materials.get('iron'),
    active = lightActive(source),
    flame = materials.get('flame', { emissive: active }),
    kind = source.type ?? 'campfire';
  let height = 0.3;
  if (kind === 'campfire') {
    for (let n = 0; n < 5; n++) {
      const a = n * Math.PI * 0.4;
      batch.cylinder(
        wood,
        new Vector3(Math.cos(a) * -0.26, 0.06, Math.sin(a) * -0.26),
        new Vector3(Math.cos(a) * 0.26, 0.09, Math.sin(a) * 0.26),
        0.044,
        light,
      );
    }
    for (let n = 0; n < 9; n++) {
      const a = (n * Math.PI * 2) / 9;
      batch.primitive(
        'rock',
        materials.get('stone'),
        [Math.cos(a) * 0.37, 0.04, Math.sin(a) * 0.37],
        [0.1, 0.075, 0.1],
        undefined,
        light,
      );
    }
    batch.primitive(
      'sphere',
      materials.get('ember', { emissive: active }),
      [0, 0.08, 0],
      [0.19, 0.045, 0.16],
      undefined,
      light,
    );
    height = 0.3;
  } else if (kind === 'lantern') {
    height = 1.23;
    batch.box(wood, 0, 0.49, 0, 0.07, 0.98, 0.07, light);
    batch.box(iron, 0.105, 1.04, 0, 0.27, 0.04, 0.035, light);
    batch.box(iron, 0.19, 1.44, 0, 0.21, 0.045, 0.18, light);
    batch.box(iron, 0.19, 1.16, 0, 0.21, 0.055, 0.18, light);
    for (const x of [0.1, 0.28]) {
      for (const z of [-0.073, 0.073]) {
        batch.box(iron, x, 1.3, z, 0.014, 0.28, 0.014, light);
      }
    }
    batch.box(
      materials.get('glass', { opacity: 0.3 }),
      0.19,
      1.3,
      0,
      0.17,
      0.23,
      0.14,
      light,
    );
    batch.primitive(
      'cone',
      iron,
      [0.19, 1.48, 0],
      [0.145, 0.11, 0.13],
      undefined,
      light,
    );
  } else {
    height = 0.62;
    batch.cylinder(
      wood,
      new Vector3(0, 0.04, 0),
      new Vector3(0.08, 0.57, 0),
      0.028,
      light,
    );
    batch.cylinder(
      materials.get('linen'),
      new Vector3(0.065, 0.49, 0),
      new Vector3(0.087, 0.62, 0),
      0.055,
      light,
    );
  }
  const group = batch.finish(`light:${id}`);
  group.position.set(source.x * T, source.elevation ?? 0, source.y * T);
  group.userData['kind'] = 'light';
  group.userData['semanticId'] = `light:${id}`;
  if (active) {
    const fire = new WorldBatch(geometry),
      x = kind === 'lantern' ? 0.19 : 0;
    fire.primitive(
      'cone',
      flame,
      [x, height, 0],
      [
        kind === 'campfire' ? 0.14 : 0.033,
        kind === 'campfire' ? 0.35 : 0.105,
        kind === 'campfire' ? 0.12 : 0.03,
      ],
      undefined,
      1,
    );
    if (kind === 'campfire') {
      for (let n = 0; n < 3; n++) {
        fire.primitive(
          'cone',
          materials.get('ember', { emissive: true }),
          [(n - 1) * 0.09, height * 0.8, 0.04],
          [0.07, 0.24, 0.06],
          new Quaternion().setFromAxisAngle(
            new Vector3(0, 0, 1),
            (n - 1) * 0.16,
          ),
          1,
        );
      }
    }
    const flames = fire.finish(`flame:${id}`);
    group.add(flames);
    group.userData['flame'] = flames;
    group.userData['seed'] = seeded(
      Math.floor(source.x),
      Math.floor(source.y),
      9,
    );
    if (pointLight) {
      const lamp = new PointLight(
        '#ffd0a1',
        (input.terrain.night ? 3.8 : 1.2) * (source.intensity ?? 1),
        (source.radius ?? 4) * T,
        2,
      );
      lamp.position.set(x, height + 0.1, 0);
      group.add(lamp);
      group.userData['lamp'] = lamp;
    }
  }
  return group;
}

export function buildSmoke(
  id: string,
  source: WorldSmoke,
  input: WorldInput,
  T: number,
  geometry: WorldGeometry,
  materials: WorldMaterialSource,
) {
  const batch = new WorldBatch(geometry),
    radius = (source.radius ?? 1) * T,
    seed = seeded(Math.floor(source.x), Math.floor(source.y), 43);
  for (let n = 0; n < 7; n++) {
    const angle = n * 2.4 + seed * 3,
      r = radius * (n === 0 ? 0.66 : 0.45),
      distance = n === 0 ? 0 : radius * 0.55;
    batch.primitive(
      'sphere',
      materials.get('smoke', { opacity: n === 0 ? 0.2 : 0.12 }),
      [Math.cos(angle) * distance, 0.5 + n * 0.14, Math.sin(angle) * distance],
      [r, r * 0.75, r],
      undefined,
      illuminationAt(input, source),
    );
  }
  const group = batch.finish(`smoke:${id}`);
  group.position.set(source.x * T, source.elevation ?? 0, source.y * T);
  group.userData['kind'] = 'smoke';
  group.userData['semanticId'] = `smoke:${id}`;
  group.userData['seed'] = seed;
  group.userData['baseY'] = group.position.y;
  return group;
}

export function animateWorldNode(
  group: Group,
  time: number,
  reducedMotion: boolean,
) {
  if (reducedMotion) {
    return;
  }
  const seed = Number(group.userData['seed'] ?? 0),
    phase = time * 2.6 + seed * 7;
  const flame: unknown = group.userData['flame'],
    lamp: unknown = group.userData['lamp'];
  if (flame instanceof Group) {
    flame.scale.set(
      1 + 0.08 * Math.sin(phase),
      1 + 0.11 * Math.sin(phase * 1.7),
      1 + 0.05 * Math.cos(phase),
    );
  }
  if (lamp instanceof PointLight) {
    const stored: unknown = group.userData['lampIntensity'];
    const intensity = typeof stored === 'number' ? stored : lamp.intensity;
    group.userData['lampIntensity'] = intensity;
    lamp.intensity = intensity * (1 + 0.04 * Math.sin(phase * 1.7));
  }
  if (group.userData['kind'] === 'smoke') {
    group.rotation.y = Math.sin(time * 0.11 + seed) * 0.035;
    group.position.y =
      Number(group.userData['baseY']) + 0.035 * Math.sin(time * 0.67 + seed);
  }
}

export function buildClimbLinks(
  input: WorldInput,
  T: number,
  geometry: WorldGeometry,
  materials: WorldMaterialSource,
) {
  const batch = new WorldBatch(geometry),
    wood = materials.get('wood'),
    iron = materials.get('iron');
  const elevation = (point: WorldPoint) =>
    point.elevation ??
    (point.tacticalLevel
      ? input.terrain.upperSurfaces
      : input.terrain.tiles
    )?.find(
      (surface) =>
        surface.x === point.x &&
        surface.y === point.y &&
        (surface.tacticalLevel ?? 0) === (point.tacticalLevel ?? 0),
    )?.elevation ??
    0;
  for (const link of input.terrain.climbLinks ?? []) {
    const a = new Vector3(
        link.from.x * T,
        elevation(link.from),
        link.from.y * T,
      ),
      b = new Vector3(link.to.x * T, elevation(link.to), link.to.y * T),
      delta = b.clone().sub(a),
      light = illuminationAt(input, link.from);
    const across = new Vector3(-delta.z, 0, delta.x);
    if (across.lengthSq() < 0.001) {
      across.set(1, 0, 0);
    }
    across.normalize().multiplyScalar(0.23);
    if (/stair/.test(link.kind)) {
      const steps = Math.max(3, Math.ceil(Math.abs(delta.y) / 0.23));
      for (let n = 0; n < steps; n++) {
        const p = a.clone().addScaledVector(delta, (n + 0.5) / steps),
          y = a.y + (delta.y * (n + 1)) / steps;
        batch.box(
          wood,
          p.x,
          (a.y + y) * 0.5,
          p.z,
          Math.max(0.5, Math.abs(delta.x) / steps + 0.02),
          Math.max(0.08, y - a.y),
          Math.max(0.5, Math.abs(delta.z) / steps + 0.02),
          light,
        );
      }
    } else {
      const lower = a.y <= b.y ? a : b,
        upper = a.y <= b.y ? b : a,
        support = ladderGeometry(lower.toArray(), upper.toArray(), T),
        base = new Vector3(...support.base),
        top = new Vector3(...support.top),
        rise = top.clone().sub(base);
      for (const side of [-1, 1]) {
        batch.cylinder(
          wood,
          base.clone().addScaledVector(across, side),
          top.clone().addScaledVector(across, side),
          0.035,
          light,
        );
      }
      for (let n = 1; n < support.steps; n++) {
        const p = base.clone().addScaledVector(rise, n / support.steps);
        batch.cylinder(
          wood,
          p.clone().sub(across),
          p.clone().add(across),
          support.rungRadius,
          light,
        );
      }
      batch.cylinder(
        iron,
        top.clone().sub(across),
        top.clone().add(across),
        0.022,
        light,
      );
    }
  }
  const group = batch.finish('climb-links');
  group.userData['kind'] = 'climb-links';
  group.userData['semanticIds'] = (input.terrain.climbLinks ?? []).map(
    (link) => `climb:${link.id}`,
  );
  return group;
}
