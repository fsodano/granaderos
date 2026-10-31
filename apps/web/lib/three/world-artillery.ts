import { Group, Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import { WorldBatch, lathe } from './world-geometry';
import { wheel } from './world-props';
import { illuminationAt } from './world-materials';
import type { WorldGeometry } from './world-geometry';
import type { WorldMaterialSource } from './world-materials';
import type { WorldCannon, WorldInput } from './world-types';

const cannonAnchors = new WeakMap<Group, Map<string, Object3D>>();
export const worldCannonAnchors = (group: Group) => cannonAnchors.get(group);

export function buildCannon(
  cannon: WorldCannon,
  input: WorldInput,
  T: number,
  geometry: WorldGeometry,
  materials: WorldMaterialSource,
) {
  const batch = new WorldBatch(geometry),
    light = illuminationAt(input, cannon),
    wood = materials.get('darkwood'),
    iron = materials.get('iron'),
    metal = materials.get(cannon.type === 'field8' ? 'iron' : 'brass'),
    swivel = cannon.type === 'swivel';
  const length = swivel ? 1.03 : cannon.type === 'field8' ? 1.95 : 1.52,
    radius = swivel ? 0.072 : cannon.type === 'field8' ? 0.145 : 0.12,
    height = swivel ? 1.05 : 0.8,
    axle = swivel ? 0.45 : 0.87;
  // A turned hollow muzzle, breech mouldings, trunnions, trail and spoked wheels
  // give the three authored cannon types different real silhouettes.
  const barrel = lathe([
    [radius * 0.48, -length * 0.5],
    [radius * 0.95, -length * 0.48],
    [radius * 1.18, -length * 0.42],
    [radius * 1.22, -length * 0.35],
    [radius * 1.09, -length * 0.1],
    [radius * 0.86, length * 0.35],
    [radius * 1.05, length * 0.42],
    [radius * 1.05, length * 0.5],
    [radius * 0.68, length * 0.5],
    [radius * 0.68, length * 0.35],
  ] as const);
  const barrelQ = new Quaternion().setFromAxisAngle(
      new Vector3(0, 0, 1),
      -Math.PI * 0.5,
    ),
    centre = new Vector3(0.22, height, 0);
  batch.add(
    barrel,
    metal,
    new Matrix4().compose(centre, barrelQ, new Vector3(1, 1, 1)),
    light,
  );
  barrel.dispose();
  batch.primitive(
    'sphere',
    metal,
    [-length * 0.5 + 0.12, height, 0],
    [radius * 0.45, radius * 0.45, radius * 0.45],
    undefined,
    light,
  );
  batch.cylinder(
    iron,
    new Vector3(-0.11, height, -radius * 1.9),
    new Vector3(-0.11, height, radius * 1.9),
    radius * 0.3,
    light,
  );
  if (swivel) {
    batch.box(wood, -0.11, 0.47, 0, 0.17, 0.94, 0.17, light);
    batch.box(iron, -0.11, 0.96, 0, 0.24, 0.09, 0.34, light);
    for (const side of [-1, 1]) {
      batch.box(iron, -0.11, 1.02, side * 0.14, 0.05, 0.19, 0.055, light);
    }
    batch.box(wood, -0.1, 0.1, 0, 0.85, 0.2, 0.66, light);
    for (const side of [-1, 1]) {
      batch.box(wood, -0.1, 0.22, side * 0.24, 0.78, 0.07, 0.075, light);
    }
    batch.cylinder(
      wood,
      new Vector3(-0.44, height, 0),
      new Vector3(-0.8, height - 0.18, 0),
      0.03,
      light,
    );
  } else {
    batch.cylinder(
      iron,
      new Vector3(-0.1, 0.48, -axle * 0.6),
      new Vector3(-0.1, 0.48, axle * 0.6),
      0.045,
      light,
    );
    // wheel helper axle is local X; rotate wheel geometry to local Z here.
    const wheels = new WorldBatch(geometry),
      wheelRadius = 0.48 / (1.04 * 1.09);
    for (const side of [-1, 1]) {
      wheel(
        wheels,
        materials,
        light,
        side * axle * 0.59,
        0.48,
        0.1,
        wheelRadius,
      );
    }
    const wheelGroup = wheels.finish('cannon-wheels'),
      matrix = new Matrix4().makeRotationY(Math.PI * 0.5);
    batch.take(wheelGroup, matrix);
    for (const side of [-1, 1]) {
      batch.box(
        wood,
        -0.12,
        0.61,
        side * radius * 1.5,
        0.71,
        0.25,
        0.11,
        light,
      );
      batch.cylinder(
        wood,
        new Vector3(0.1, 0.54, side * 0.2),
        new Vector3(-1.14, 0.15, side * 0.13),
        0.072,
        light,
      );
      batch.box(
        iron,
        -0.06,
        0.71,
        side * radius * 1.54,
        0.19,
        0.05,
        0.13,
        light,
      );
    }
    batch.box(wood, -1.07, 0.13, 0, 0.39, 0.1, 0.42, light);
    batch.box(iron, -1.12, 0.15, 0, 0.11, 0.035, 0.4, light);
    batch.box(wood, -0.61, 0.32, 0, 0.24, 0.1, 0.42, light);
    if (cannon.loaded) {
      for (let n = 0; n < 3; n++) {
        batch.primitive(
          'sphere',
          iron,
          [
            -0.78 + (n % 2) * 0.12,
            0.41 + (n === 2 ? 0.1 : 0),
            ((n % 2) - 0.5) * 0.13,
          ],
          [0.052, 0.052, 0.052],
          undefined,
          light,
        );
      }
    }
  }
  const group = batch.finish(`cannon:${cannon.id}`);
  group.position.set(cannon.x * T, cannon.elevation ?? 0, cannon.y * T);
  group.rotation.y = -(cannon.facing ?? 0);
  group.userData['kind'] = 'cannon';
  group.userData['semanticId'] = `cannon:${cannon.id}`;
  group.userData['loaded'] = Boolean(cannon.loaded);
  group.userData['cannonType'] = cannon.type;
  const muzzle = new Object3D();
  muzzle.name = `muzzle:${cannon.id}`;
  muzzle.position.set(centre.x + length * 0.5, height, 0);
  group.add(muzzle);
  const muzzleForward = new Object3D();
  muzzleForward.name = `muzzle-forward:${cannon.id}`;
  muzzleForward.position.set(centre.x + length * 0.5 + 0.3, height, 0);
  group.add(muzzleForward);
  const anchors = new Map([
    ['muzzle', muzzle],
    ['muzzleForward', muzzleForward],
  ]);
  group.userData['anchorNodes'] = anchors;
  cannonAnchors.set(group, anchors);
  return group;
}
