import type {
  BattlePresentationFrame,
  BodyImpact,
  ProjectilePresentationPoint,
  PresentedBattleResult,
  TacticalPoint,
} from '../../../packages/game/public/compatibility-types.ts';
import { isWorkerRecord, readBattleSnapshot } from './battle-worker-values.ts';
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown): value is string => typeof value === 'string';
const boolean = (value: unknown): value is boolean =>
  typeof value === 'boolean';
const identity = (value: unknown): value is string | number =>
  text(value) || finite(value);
const optional = (
  record: Record<string, unknown>,
  key: string,
  accepts: (value: unknown) => boolean,
) => record[key] === undefined || accepts(record[key]);
const array = (value: unknown, accepts: (value: unknown) => boolean) =>
  Array.isArray(value) && value.every(accepts);
function point(value: unknown): value is TacticalPoint {
  return (
    isWorkerRecord(value) &&
    finite(value['x']) &&
    finite(value['y']) &&
    optional(value, 'tacticalLevel', finite)
  );
}
function projectilePoint(value: unknown): value is ProjectilePresentationPoint {
  return (
    isWorkerRecord(value) &&
    point(value) &&
    finite(value['height']) &&
    optional(value, 'fraction', finite)
  );
}
function impact(value: unknown): value is BodyImpact {
  return (
    isWorkerRecord(value) &&
    point(value) &&
    ['id', 'unitId'].every((key) => optional(value, key, text)) &&
    optional(value, 'kind', (value) => value === 'unit' || value === 'npc') &&
    ['damage', 'energyLoss', 'hpBefore', 'hpAfter'].every((key) =>
      optional(value, key, finite),
    ) &&
    ['killed', 'knockedDown', 'unconscious'].every((key) =>
      optional(value, key, boolean),
    )
  );
}
const outcome = (value: unknown) =>
  value === null ||
  ['hit', 'cover', 'miss', 'pellets'].some((kind) => kind === value);
function projectile(
  value: unknown,
  kind: 'shot' | 'artillery' | 'knife' | 'grenade',
): boolean {
  if (
    !isWorkerRecord(value) ||
    !boolean(value['visible']) ||
    !projectilePoint(value['source'])
  ) {
    return false;
  }
  if (
    kind === 'artillery'
      ? !optional(value, 'impact', projectilePoint)
      : !projectilePoint(value['impact'])
  ) {
    return false;
  }
  if (!optional(value, 'points', (value) => array(value, projectilePoint))) {
    return false;
  }
  if (kind === 'shot') {
    return (
      outcome(value['outcome']) &&
      optional(value, 'material', text) &&
      ['spread', 'discharge'].every((key) => optional(value, key, boolean)) &&
      optional(
        value,
        'shotHand',
        (value) => value === 'primary' || value === 'offhand',
      ) &&
      optional(value, 'shotId', identity) &&
      ['bodyTargetKey', 'sourceBodyKey'].every((key) =>
        optional(value, key, text),
      )
    );
  }
  if (kind === 'artillery') {
    return (
      optional(value, 'impacts', (value) =>
        array(
          value,
          (item) =>
            isWorkerRecord(item) &&
            projectilePoint(item) &&
            optional(item, 'outcome', outcome) &&
            optional(item, 'material', text),
        ),
      ) &&
      ['canister', 'discharge'].every((key) => optional(value, key, boolean)) &&
      optional(value, 'cannonId', text)
    );
  }
  if (kind === 'knife') {
    return optional(value, 'weapon', finite);
  }
  return (
    point(value['landing']) &&
    array(value['points'], projectilePoint) &&
    finite(value['radius']) &&
    boolean(value['detonated'])
  );
}
function frameFields(
  value: unknown,
): value is Omit<BattlePresentationFrame, 'state'> & { state: unknown } {
  if (
    !isWorkerRecord(value) ||
    !text(value['type']) ||
    !text(value['action'])
  ) {
    return false;
  }
  if (
    !['unitId', 'mountFromPosture', 'mountToPosture', 'sequenceId'].every(
      (key) => optional(value, key, text),
    )
  ) {
    return false;
  }
  if (
    ![
      'performed',
      'shotComplete',
      'artilleryComplete',
      'contactComplete',
      'releaseComplete',
      'careSelf',
      'healInterval',
      'mountComplete',
    ].every((key) => optional(value, key, boolean))
  ) {
    return false;
  }
  if (
    ![
      'startedAt',
      'durationMs',
      'actionStartedAt',
      'actionDurationMs',
      'actionId',
      'index',
    ].every((key) => optional(value, key, finite))
  ) {
    return false;
  }
  if (
    !optional(value, 'visibleIds', (value) => array(value, text)) ||
    !optional(value, 'impacts', (value) => array(value, impact))
  ) {
    return false;
  }
  if (
    !optional(
      value,
      'targetPoint',
      (value) =>
        isWorkerRecord(value) &&
        point(value) &&
        optional(value, 'id', text) &&
        optional(value, 'kind', (value) => value === 'unit' || value === 'npc'),
    )
  ) {
    return false;
  }
  if (
    !optional(value, 'cameraFocus', (value) => value === null || point(value))
  ) {
    return false;
  }
  if (
    !optional(
      value,
      'shotHand',
      (value) => value === 'primary' || value === 'offhand',
    ) ||
    !optional(value, 'shotId', identity) ||
    !optional(
      value,
      'mountAction',
      (value) => value === 'mount' || value === 'dismount',
    )
  ) {
    return false;
  }
  if (
    !optional(value, 'actionWork', (value) =>
      array(
        value,
        (item) =>
          isWorkerRecord(item) &&
          finite(item['from']) &&
          finite(item['to']) &&
          optional(item, 'barrel', finite) &&
          optional(
            item,
            'hand',
            (value) => value === 'primary' || value === 'offhand',
          ),
      ),
    )
  ) {
    return false;
  }
  if (
    !optional(value, 'shotVisual', (value) => projectile(value, 'shot')) ||
    !optional(value, 'artilleryVisual', (value) =>
      projectile(value, 'artillery'),
    ) ||
    !optional(value, 'knifeVisual', (value) => projectile(value, 'knife')) ||
    !optional(value, 'grenadeVisual', (value) => projectile(value, 'grenade'))
  ) {
    return false;
  }
  return optional(
    value,
    'grenadeEffect',
    (value) =>
      value === null ||
      (isWorkerRecord(value) &&
        finite(value['id']) &&
        finite(value['startedAt']) &&
        projectile(value['visual'], 'grenade')),
  );
}
export function readPresentedBattleResult(
  value: unknown,
): PresentedBattleResult {
  if (!isWorkerRecord(value) || !Array.isArray(value['frames'])) {
    throw new Error('Invalid battle presentation result');
  }
  const frames = value['frames'].map((frame: unknown) => {
    if (!isWorkerRecord(frame) || !frameFields(frame)) {
      throw new Error('Invalid battle presentation frame');
    }
    return { ...frame, state: readBattleSnapshot(frame['state']) };
  });
  return { state: readBattleSnapshot(value['state']), frames };
}
