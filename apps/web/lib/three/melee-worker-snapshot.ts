import { isMesh, isSkinnedMesh } from './scene-node-types';
import { required } from './required';
import {
  InterleavedBufferAttribute,
  AnimationClip,
  Bone,
  BufferAttribute,
  BufferGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Skeleton,
  SkinnedMesh,
} from 'three';
import type { NativeMeleeContactFit } from './melee-contact-fit';
export type Attribute = {
  array: BufferAttribute['array'];
  itemSize: number;
  normalized: boolean;
};
type NodeRecord = {
  id: string;
  parent: number;
  name: string;
  bone: boolean;
  visible: boolean;
  position: number[];
  quaternion: number[];
  scale: number[];
  matrix: number[];
  auto: boolean;
  geometry?: {
    attributes: Record<string, Attribute>;
    index?: Attribute;
    morph: Attribute[];
    relative: boolean;
  };
  material?: string;
  skin?: {
    bones: string[];
    inverse: number[][];
    bind: number[];
    bindInverse: number[];
    mode: SkinnedMesh['bindMode'];
  };
  morph?: number[];
  morphNames?: Record<string, number>;
  itemId?: string;
};
export type ActorSnapshot = {
  parent: number[];
  nodes: NodeRecord[];
  model: string;
  root: string;
  weapon?: string;
};
export type Calibration = {
  limbs: {
    name: string;
    first: number;
    second: number;
  }[];
  flat: {
    name: string;
    quaternion: number[];
  }[];
  soles: {
    name: string;
    floor: number;
    outline: number[];
  }[];
};
function shown(node: Object3D) {
  for (let current: Object3D | null = node; current; current = current.parent) {
    if (!current.visible) {
      return false;
    }
  }
  return true;
}
function attribute(
  source: BufferAttribute | InterleavedBufferAttribute,
): Attribute {
  if (source instanceof InterleavedBufferAttribute) {
    const array = source.data.array.slice(0, source.count * source.itemSize);
    for (let i = 0; i < source.count; i++) {
      for (let j = 0; j < source.itemSize; j++) {
        array[i * source.itemSize + j] = required(
          source.data.array[i * source.data.stride + source.offset + j],
        );
      }
    }
    return { array, itemSize: source.itemSize, normalized: source.normalized };
  }
  return {
    array: source.array.slice(),
    itemSize: source.itemSize,
    normalized: source.normalized,
  };
}

/** The explicit rendered actor subtree contains no roster, future frame,
 * ammunition, userData dump, image, material texture or hidden mesh. */
export function snapshotActor(
  root: Object3D,
  model: Object3D,
  weapon?: Object3D,
): ActorSnapshot {
  root.updateWorldMatrix(true, true);
  root.updateMatrixWorld(true);
  const nodes: NodeRecord[] = [],
    weaponPath = new Set<Object3D>();
  for (
    let current: Object3D | null = weapon ?? null;
    current && current !== root;
    current = current.parent
  ) {
    weaponPath.add(current);
  }
  const visit = (
    node: Object3D,
    parent: number,
    insideModel = false,
    insideWeapon = false,
  ) => {
    insideModel ||= node === model;
    insideWeapon ||= node === weapon;
    if (
      isMesh(node) &&
      ((!isSkinnedMesh(node) && !insideWeapon) || !shown(node))
    ) {
      return;
    }
    const record: NodeRecord = {
        id: node.uuid,
        parent,
        name: node.name,
        bone: node instanceof Bone,
        visible: node.visible,
        position: node.position.toArray(),
        quaternion: node.quaternion.toArray(),
        scale: node.scale.toArray(),
        matrix: node.matrix.toArray(),
        auto: node.matrixAutoUpdate,
      },
      index = nodes.push(record) - 1;
    if (isMesh(node)) {
      const attributes: Record<string, Attribute> = {};
      for (const name of ['position', 'skinIndex', 'skinWeight']) {
        if (node.geometry.attributes[name]) {
          attributes[name] = attribute(
            required(node.geometry.attributes[name]),
          );
        }
      }
      record.geometry = {
        attributes,
        ...(node.geometry.index
          ? { index: attribute(node.geometry.index) }
          : {}),
        morph: (node.geometry.morphAttributes.position ?? []).map(attribute),
        relative: node.geometry.morphTargetsRelative,
      };
      record.material = Array.isArray(node.material)
        ? (node.material[0]?.name ?? '')
        : node.material.name;
      if (node.morphTargetInfluences) {
        record.morph = [...node.morphTargetInfluences];
      }
      if (node.morphTargetDictionary) {
        record.morphNames = { ...node.morphTargetDictionary };
      }
      if (isSkinnedMesh(node)) {
        record.skin = {
          bones: node.skeleton.bones.map((bone) => bone.uuid),
          inverse: node.skeleton.boneInverses.map((matrix) => matrix.toArray()),
          bind: node.bindMatrix.toArray(),
          bindInverse: node.bindMatrixInverse.toArray(),
          mode: node.bindMode,
        };
      }
    }
    if (node === weapon) {
      const itemId: unknown = weapon.userData['itemId'];
      if (typeof itemId === 'string' || typeof itemId === 'number') {
        record.itemId = String(itemId);
      }
    }
    for (const child of node.children) {
      if (
        insideModel ||
        insideWeapon ||
        child === model ||
        weaponPath.has(child)
      ) {
        visit(child, index, insideModel, insideWeapon);
      }
    }
  };
  visit(root, -1);
  return {
    parent: root.parent?.matrixWorld.toArray() ?? new Matrix4().toArray(),
    nodes,
    root: root.uuid,
    model: model.uuid,
    ...(weapon ? { weapon: weapon.uuid } : {}),
  };
}
export function restoreActor(snapshot: ActorSnapshot) {
  const objects = new Map<string, Object3D>(),
    parent = new Object3D();
  parent.matrixAutoUpdate = false;
  parent.matrix.fromArray(snapshot.parent);
  for (const record of snapshot.nodes) {
    let node: Object3D;
    if (record.geometry) {
      const geometry = new BufferGeometry();
      for (const [name, data] of Object.entries(record.geometry.attributes)) {
        geometry.setAttribute(
          name,
          new BufferAttribute(data.array, data.itemSize, data.normalized),
        );
      }
      if (record.geometry.index) {
        const a = record.geometry.index;
        geometry.setIndex(
          new BufferAttribute(a.array, a.itemSize, a.normalized),
        );
      }
      geometry.morphAttributes.position = record.geometry.morph.map(
        (data) =>
          new BufferAttribute(data.array, data.itemSize, data.normalized),
      );
      geometry.morphTargetsRelative = record.geometry.relative;
      const material = new MeshBasicMaterial();
      material.name = record.material ?? '';
      node = record.skin
        ? new SkinnedMesh(geometry, material)
        : new Mesh(geometry, material);
      if (record.morph && isMesh(node)) {
        node.morphTargetInfluences = [...record.morph];
      }
      if (record.morphNames && isMesh(node)) {
        node.morphTargetDictionary = { ...record.morphNames };
      }
    } else {
      node = record.bone ? new Bone() : new Object3D();
    }
    node.uuid = record.id;
    node.name = record.name;
    node.visible = record.visible;
    node.position.fromArray(record.position);
    node.quaternion.fromArray(record.quaternion);
    node.scale.fromArray(record.scale);
    node.matrix.fromArray(record.matrix);
    node.matrixAutoUpdate = record.auto;
    if (record.itemId) {
      node.userData['itemId'] = record.itemId;
    }
    objects.set(record.id, node);
    (record.parent < 0
      ? parent
      : required(objects.get(required(snapshot.nodes[record.parent]).id))
    ).add(node);
  }
  for (const record of snapshot.nodes) {
    if (record.skin) {
      const node = required(objects.get(record.id)),
        skin = record.skin;
      if (!isSkinnedMesh(node)) {
        throw new Error('Invalid sampled skinned mesh');
      }
      node.skeleton = new Skeleton(
        skin.bones.map((id) => {
          const bone = objects.get(id);
          if (!(bone instanceof Bone)) {
            throw new Error('Invalid sampled skeleton bone');
          }
          return bone;
        }),
        skin.inverse.map((matrix) => new Matrix4().fromArray(matrix)),
      );
      node.bindMatrix.fromArray(skin.bind);
      node.bindMatrixInverse.fromArray(skin.bindInverse);
      node.bindMode = skin.mode;
    }
  }
  parent.updateMatrixWorld(true);
  return {
    model: required(objects.get(snapshot.model)),
    root: required(objects.get(snapshot.root)),
    weapon: snapshot.weapon ? objects.get(snapshot.weapon) : undefined,
    parent,
  };
}
export function snapshotCalibration(fit: NativeMeleeContactFit): Calibration {
  return fit.snapshotCalibration();
}
export function restoreCalibration(
  fit: NativeMeleeContactFit,
  calibration: Calibration,
) {
  fit.restoreCalibration(calibration);
}
export function clipSnapshot(clip: AnimationClip) {
  const data = AnimationClip.toJSON(clip);
  for (let index = 0; index < clip.tracks.length; index++) {
    required(data.tracks[index]).interpolation = required(
      clip.tracks[index],
    ).getInterpolation();
  }
  return data;
}
