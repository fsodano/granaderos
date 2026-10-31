import assert from 'node:assert/strict';

export type NativeComponentKind = 5120 | 5121 | 5122 | 5123 | 5125 | 5126;
export type NativeAccessorKind = 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' | 'MAT2' | 'MAT3' | 'MAT4';
export interface NativeAccessor {
  componentType: NativeComponentKind;
  type: NativeAccessorKind;
  count: number;
  normalized?: boolean;
  bufferView?: number;
  byteOffset?: number;
  sparse?: {
    count: number;
    indices: { bufferView: number; byteOffset?: number; componentType: NativeComponentKind };
    values: { bufferView: number; byteOffset?: number };
  };
}
export interface NativeNode {
  name?: string;
  children?: number[];
  mesh?: number;
  skin?: number;
  matrix?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
}
export interface NativePrimitive {
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
  mode?: number;
  targets?: Record<string, number>[];
}
export interface NativeAnimation {
  name?: string;
  channels: { sampler: number; target: { node?: number; path: string } }[];
  samplers: {
    input: number;
    output: number;
    interpolation?: string;
    extras?: { nativeRoofFingerBeforeSampler?: number };
  }[];
}
export interface NativeGlb {
  nodes: NativeNode[];
  accessors: NativeAccessor[];
  bufferViews: { buffer: number; byteLength: number; byteOffset?: number; byteStride?: number }[];
  scenes?: { nodes?: number[] }[];
  scene?: number;
  meshes?: { name?: string; primitives: NativePrimitive[] }[];
  skins?: { joints: number[]; inverseBindMatrices?: number }[];
  animations?: NativeAnimation[];
  materials?: { name?: string }[];
  images?: unknown[];
  textures?: unknown[];
  samplers?: unknown[];
}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown): value is string => typeof value === 'string';
const boolean = (value: unknown): value is boolean => typeof value === 'boolean';
const list =
  <Value>(check: (value: unknown) => value is Value) =>
  (value: unknown): value is Value[] =>
    Array.isArray(value) && value.every(check);
const optional = (
  record: Record<string, unknown>,
  name: string,
  check: (value: unknown) => boolean,
) => !Object.hasOwn(record, name) || check(record[name]);
const numbers = list(finite);
function component(value: unknown): value is NativeComponentKind {
  return (
    value === 5120 ||
    value === 5121 ||
    value === 5122 ||
    value === 5123 ||
    value === 5125 ||
    value === 5126
  );
}
function accessorKind(value: unknown): value is NativeAccessorKind {
  return (
    value === 'SCALAR' ||
    value === 'VEC2' ||
    value === 'VEC3' ||
    value === 'VEC4' ||
    value === 'MAT2' ||
    value === 'MAT3' ||
    value === 'MAT4'
  );
}
const reference = (value: unknown) =>
  object(value) && finite(value['bufferView']) && optional(value, 'byteOffset', finite);
function accessor(value: unknown): value is NativeAccessor {
  return (
    object(value) &&
    component(value['componentType']) &&
    accessorKind(value['type']) &&
    finite(value['count']) &&
    optional(value, 'normalized', boolean) &&
    optional(value, 'bufferView', finite) &&
    optional(value, 'byteOffset', finite) &&
    optional(
      value,
      'sparse',
      (sparse) =>
        object(sparse) &&
        finite(sparse['count']) &&
        reference(sparse['values']) &&
        object(sparse['indices']) &&
        reference(sparse['indices']) &&
        component(sparse['indices']['componentType']),
    )
  );
}
function node(value: unknown): value is NativeNode {
  return (
    object(value) &&
    optional(value, 'name', text) &&
    optional(value, 'children', numbers) &&
    optional(value, 'mesh', finite) &&
    optional(value, 'skin', finite) &&
    ['matrix', 'translation', 'rotation', 'scale'].every((key) => optional(value, key, numbers))
  );
}
const attributes = (value: unknown): value is Record<string, number> =>
  object(value) && Object.values(value).every(finite);
function primitive(value: unknown): value is NativePrimitive {
  return (
    object(value) &&
    attributes(value['attributes']) &&
    optional(value, 'indices', finite) &&
    optional(value, 'material', finite) &&
    optional(value, 'mode', finite) &&
    optional(value, 'targets', list(attributes))
  );
}
function animation(value: unknown): value is NativeAnimation {
  return (
    object(value) &&
    optional(value, 'name', text) &&
    Array.isArray(value['channels']) &&
    value['channels'].every(
      (channel: unknown) =>
        object(channel) &&
        finite(channel['sampler']) &&
        object(channel['target']) &&
        optional(channel['target'], 'node', finite) &&
        text(channel['target']['path']),
    ) &&
    Array.isArray(value['samplers']) &&
    value['samplers'].every(
      (sampler: unknown) =>
        object(sampler) &&
        finite(sampler['input']) &&
        finite(sampler['output']) &&
        optional(sampler, 'interpolation', text) &&
        optional(
          sampler,
          'extras',
          (extras) => object(extras) && optional(extras, 'nativeRoofFingerBeforeSampler', finite),
        ),
    )
  );
}
function nativeGlb(value: unknown): value is NativeGlb {
  return (
    object(value) &&
    list(node)(value['nodes']) &&
    list(accessor)(value['accessors']) &&
    Array.isArray(value['bufferViews']) &&
    value['bufferViews'].every(
      (view: unknown) =>
        object(view) &&
        finite(view['buffer']) &&
        finite(view['byteLength']) &&
        optional(view, 'byteOffset', finite) &&
        optional(view, 'byteStride', finite),
    ) &&
    optional(value, 'scene', finite) &&
    optional(
      value,
      'scenes',
      (scenes) =>
        Array.isArray(scenes) &&
        scenes.every((scene: unknown) => object(scene) && optional(scene, 'nodes', numbers)),
    ) &&
    optional(
      value,
      'meshes',
      (meshes) =>
        Array.isArray(meshes) &&
        meshes.every(
          (mesh: unknown) =>
            object(mesh) && optional(mesh, 'name', text) && list(primitive)(mesh['primitives']),
        ),
    ) &&
    optional(
      value,
      'skins',
      (skins) =>
        Array.isArray(skins) &&
        skins.every(
          (skin: unknown) =>
            object(skin) &&
            numbers(skin['joints']) &&
            optional(skin, 'inverseBindMatrices', finite),
        ),
    ) &&
    optional(value, 'animations', list(animation)) &&
    optional(
      value,
      'materials',
      (materials) =>
        Array.isArray(materials) &&
        materials.every(
          (material: unknown) => object(material) && optional(material, 'name', text),
        ),
    ) &&
    ['images', 'textures', 'samplers'].every((key) => optional(value, key, Array.isArray))
  );
}

/** Admit only the fields read by CPU geometry fixtures, retaining the original GLB document. */
export function readNativeGlb(value: unknown): NativeGlb {
  assert.ok(
    nativeGlb(value),
    'The native GLB must contain valid geometry and animation declarations.',
  );
  return value;
}
