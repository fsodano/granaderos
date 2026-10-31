import type {
  AppearanceSpec,
  CharacterManifest,
  ClipSpec,
  EquipmentSpec,
  SocketSpec,
} from './actor-assets';

type ObjectValue = Record<string, unknown>;
type Check = (value: unknown) => boolean;
const object = (value: unknown): value is ObjectValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const boolean = (value: unknown): value is boolean => typeof value === 'boolean';
const vector = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length === 3 && value.every(finite);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
const array =
  (check: Check): Check =>
  (value) =>
    Array.isArray(value) && value.every(check);
const record =
  (check: Check): Check =>
  (value) =>
    object(value) && Object.values(value).every(check);
const optional = (value: ObjectValue, key: string, check: Check) =>
  value[key] === undefined || check(value[key]);
const optionalText = (value: ObjectValue, keys: readonly string[]) =>
  keys.every((key) => optional(value, key, text));
const optionalNumbers = (value: ObjectValue, keys: readonly string[]) =>
  keys.every((key) => optional(value, key, finite));
const transform = (value: ObjectValue) =>
  optional(value, 'position', vector) &&
  optional(value, 'rotation', vector) &&
  optional(value, 'scale', finite);
const hand = (value: unknown) => value === 'handRight' || value === 'handLeft';

function socket(value: unknown): value is SocketSpec {
  return (
    object(value) &&
    text(value['node']) &&
    optionalText(value, ['bone']) &&
    transform(value) &&
    optional(
      value,
      'mirror',
      (mirror) =>
        object(mirror) &&
        text(mirror['socket']) &&
        ['x', 'y', 'z'].some((axis) => axis === mirror['localAxis']),
    )
  );
}
function equipment(value: unknown): value is EquipmentSpec {
  return (
    object(value) &&
    text(value['node']) &&
    transform(value) &&
    optionalText(value, ['category', 'socket', 'grip', 'stowedSocket', 'muzzle']) &&
    optional(value, 'clipOverrides', record(text))
  );
}
function clip(value: unknown): value is ClipSpec {
  if (!object(value) || !text(value['name']) || !boolean(value['loop'])) {
    return false;
  }
  return (
    optionalText(value, [
      'semantic',
      'gesture',
      'variant',
      'posture',
      'fromPosture',
      'toPosture',
    ]) &&
    optionalNumbers(value, [
      'playbackRate',
      'duration',
      'durationSeconds',
      'locomotionSpeed',
      'nativeStrideSpeed',
      'strideDistance',
    ]) &&
    optional(value, 'barrelClips', strings) &&
    optional(value, 'seatAnchor', vector) &&
    optional(value, 'markers', record(finite)) &&
    optional(
      value,
      'reviewedPose',
      (pose) =>
        object(pose) && text(pose['name']) && text(pose['origin']) && text(pose['sourceSha256']),
    ) &&
    optional(value, 'freeHands', array(hand)) &&
    optional(
      value,
      'handProps',
      array(
        (prop) =>
          object(prop) &&
          hand(prop['hand']) &&
          strings(prop['categories']) &&
          optionalText(prop, ['untilMarker']),
      ),
    ) &&
    optional(
      value,
      'gripOffsets',
      array(
        (offset) =>
          object(offset) &&
          hand(offset['hand']) &&
          array((key) => object(key) && finite(key['time']) && vector(key['position']))(
            offset['keys'],
          ),
      ),
    ) &&
    optional(
      value,
      'seatWeight',
      array((key) => object(key) && finite(key['time']) && finite(key['weight'])),
    ) &&
    optional(
      value,
      'horseVisibility',
      (window) => object(window) && finite(window['start']) && finite(window['end']),
    ) &&
    optional(
      value,
      'climbSupport',
      (support) =>
        object(support) &&
        finite(support['height']) &&
        finite(support['span']) &&
        object(support['feetRest']) &&
        vector(support['feetRest']['l']) &&
        vector(support['feetRest']['r']),
    ) &&
    optional(
      value,
      'stowItems',
      array(
        (item) =>
          object(item) && strings(item['categories']) && text(item['socket']) && transform(item),
      ),
    ) &&
    optional(
      value,
      'propCues',
      array(
        (cue) =>
          object(cue) &&
          text(cue['item']) &&
          text(cue['socket']) &&
          finite(cue['start']) &&
          finite(cue['end']) &&
          transform(cue),
      ),
    ) &&
    optional(
      value,
      'strideMeasurement',
      (measure) =>
        text(measure) ||
        (object(measure) &&
          text(measure['method']) &&
          strings(measure['bones']) &&
          finite(measure['maximumContactHeight']) &&
          optional(measure, 'sampleCount', finite)),
    )
  );
}
function appearance(value: unknown): value is AppearanceSpec {
  return (
    object(value) &&
    text(value['id']) &&
    text(value['gender']) &&
    finite(value['height']) &&
    text(value['animationLibrary']) &&
    array(
      (lod) =>
        object(lod) &&
        finite(lod['lod']) &&
        text(lod['url']) &&
        finite(lod['triangles']) &&
        optionalNumbers(lod, ['bytes']),
    )(value['lods']) &&
    optional(value, 'parts', record(text)) &&
    optional(value, 'materials', record(text)) &&
    optional(value, 'sockets', record(socket)) &&
    optional(value, 'lodPixelThresholds', array(finite))
  );
}
function manifest(value: unknown): value is CharacterManifest {
  if (!object(value) || !finite(value['version']) || !record(text)(value['bones'])) {
    return false;
  }
  return (
    (array(appearance)(value['appearances']) || record(appearance)(value['appearances'])) &&
    record((bank) => object(bank) && text(bank['url']) && array(clip)(bank['clips']))(
      value['animationLibraries'],
    ) &&
    object(value['equipment']) &&
    text(value['equipment']['url']) &&
    record(equipment)(value['equipment']['items']) &&
    optional(value['equipment'], 'aliases', record(text)) &&
    optional(value['equipment'], 'fittings', record(equipment)) &&
    optional(value, 'skinTones', record(text)) &&
    optional(value, 'sockets', record(socket)) &&
    optional(
      value,
      'animationMirroring',
      (mirror) => object(mirror) && mirror['axis'] === 'x' && record(text)(mirror['bones']),
    ) &&
    optional(
      value,
      'rig',
      (rig) =>
        object(rig) &&
        optional(rig, 'bones', record(text)) &&
        optional(rig, 'sockets', record(socket)),
    ) &&
    optional(
      value,
      'garments',
      record(
        (garment) =>
          object(garment) &&
          text(garment['url']) &&
          record(
            (item) =>
              object(item) &&
              text(item['node']) &&
              text(item['slot']) &&
              strings(item['hideAppearanceParts']),
          )(garment['items']),
      ),
    ) &&
    optional(
      value,
      'horse',
      (horse) =>
        object(horse) &&
        array((lod) => object(lod) && finite(lod['lod']) && text(lod['url']))(horse['lods']) &&
        optional(
          horse,
          'saddle',
          (saddle) => object(saddle) && text(saddle['node']) && vector(saddle['position']),
        ) &&
        optional(horse, 'actions', record(text)) &&
        optional(horse, 'clips', array(clip)),
    )
  );
}

/** Admit the model and animation fields consumed by the renderer. Authored provenance remains untouched. */
export function readCharacterManifest(value: unknown): CharacterManifest {
  if (!manifest(value)) {
    throw new Error('Invalid character manifest');
  }
  return value;
}
