import { TacticalActionKind } from '../../../packages/game/public/compatibility-types.ts';
import { validateBattleSnapshot } from '../../../packages/game/validate-battle.js';
import type {
  BattleSnapshot,
  TacticalAction,
  MoveAction,
  GroupMoveAction,
  TacticalRoutePoint,
  GroupMovementContinuation,
  GroupMovementMember,
  GroupMovementReport,
  GroupMovementResult,
  MovementStepResult,
} from '../../../packages/game/public/compatibility-types.ts';
import { BattleJobKind } from './battle-worker-contracts.ts';
import type {
  BattleWorkerActionByKind,
  BattleWorkerResultByKind,
  BattleWorkerContinuationByKind,
} from './battle-worker-contracts.ts';
import { readBattlePreview } from './battle-preview.ts';

export function isWorkerRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const identity = (value: unknown): value is string | number =>
  typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value));
export function readBattleSnapshot(value: unknown): BattleSnapshot {
  // The shared save admission validates nested simulation records and applies supported migrations.
  return validateBattleSnapshot(value);
}
function isPoint(value: unknown): value is TacticalRoutePoint {
  return (
    isWorkerRecord(value) &&
    finite(value['x']) &&
    finite(value['y']) &&
    (value['tacticalLevel'] === undefined || finite(value['tacticalLevel'])) &&
    (value['kind'] === undefined || typeof value['kind'] === 'string') &&
    (value['linkId'] === undefined || typeof value['linkId'] === 'string') &&
    (value['elevation'] === undefined || finite(value['elevation']))
  );
}
function isMove(value: unknown): value is MoveAction {
  return (
    isWorkerRecord(value) &&
    value['type'] === 'move' &&
    identity(value['unitId']) &&
    isPoint(value) &&
    movementFields(value) &&
    (value['conversationTargetId'] === undefined ||
      typeof value['conversationTargetId'] === 'string')
  );
}
function movementFields(value: Record<string, unknown>): boolean {
  return (
    (value['movement'] === undefined ||
      ['walk', 'run', 'crouch', 'prone'].some((mode) => mode === value['movement'])) &&
    (value['movementIntent'] === undefined ||
      ['forward', 'preserveFacing'].some((intent) => intent === value['movementIntent']))
  );
}
function isGroupMove(value: unknown): value is GroupMoveAction {
  return (
    isWorkerRecord(value) &&
    isPoint(value) &&
    (value['type'] === undefined || value['type'] === 'groupMove') &&
    Array.isArray(value['unitIds']) &&
    value['unitIds'].every(identity) &&
    identity(value['anchorId']) &&
    movementFields(value)
  );
}
const text = (value: unknown): value is string => typeof value === 'string';
const boolean = (value: unknown): value is boolean => typeof value === 'boolean';
const oneOf =
  (...values: readonly string[]) =>
  (value: unknown) =>
    typeof value === 'string' && values.includes(value);
const listOf = (accepts: (value: unknown) => boolean) => (value: unknown) =>
  Array.isArray(value) && value.every(accepts);
function optionalFields(
  value: Record<string, unknown>,
  fields: Readonly<Record<string, (value: unknown) => boolean>>,
): boolean {
  return Object.entries(fields).every(
    ([key, accepts]) => value[key] === undefined || accepts(value[key]),
  );
}
function isLootSelection(value: unknown): boolean {
  return (
    isWorkerRecord(value) &&
    finite(value['count']) &&
    optionalFields(value, {
      targetId: text,
      item: text,
      groundId: text,
      dropIndex: finite,
    }) &&
    ((text(value['targetId']) && text(value['item'])) ||
      text(value['groundId']) ||
      finite(value['dropIndex']))
  );
}
function isEnvironmentSelection(value: unknown): boolean {
  return (
    isWorkerRecord(value) &&
    text(value['kind']) &&
    optionalFields(value, {
      id: text,
      verb: text,
      x: finite,
      y: finite,
      tacticalLevel: finite,
    })
  );
}
type FieldsOf<Value> = Value extends object ? keyof Value : never;
const actionFields = {
  type: oneOf(...Object.values(TacticalActionKind), 'move', 'groupMove'),
  open: boolean,
  expectedHost: text,
  expectedCursor: text,
  family: text,
  transferKind: oneOf('give', 'relay', 'throw', 'drop', 'gift'),
  transferRoute: listOf(text),
  hostId: text,
  operation: text,
  kind: text,
  id: text,
  wallEdgeId: text,
  axis: oneOf('x', 'y'),
  verb: text,
  index: finite,
  doorId: text,
  unitId: identity,
  targetId: identity,
  npcId: text,
  artilleryId: text,
  targetKind: oneOf('unit', 'npc', 'artillery'),
  x: finite,
  y: finite,
  tacticalLevel: finite,
  item: text,
  itemId: text,
  slot: text,
  sourceId: text,
  destinationId: text,
  count: finite,
  expectedSource: text,
  expectedDestination: text,
  aim: finite,
  bodyPart: text,
  mode: text,
  stance: oneOf('standing', 'crouched', 'prone'),
  facing: finite,
  enabled: boolean,
  seconds: finite,
  exitId: text,
  escortOrder: oneOf('follow', 'wait'),
  supplyKey: text,
  toolKey: text,
  inventoryKey: (value: unknown) => value === null || text(value),
  destination: text,
  linkId: text,
  hitLocation: text,
  unitIds: listOf(identity),
  dropIndex: finite,
  groundId: text,
  items: listOf(isLootSelection),
  environment: isEnvironmentSelection,
  movement: oneOf('walk', 'run', 'crouch', 'prone'),
  movementIntent: oneOf('forward', 'preserveFacing'),
  weaponMode: text,
  conversationTargetId: text,
  anchorId: identity,
} satisfies Record<FieldsOf<TacticalAction>, (value: unknown) => boolean>;
function isTacticalAction(value: unknown): value is TacticalAction {
  if (!isWorkerRecord(value) || !text(value['type']) || !optionalFields(value, actionFields)) {
    return false;
  }
  if (value['type'] === 'move') {
    return isMove(value);
  }
  if (value['type'] === 'groupMove') {
    return isGroupMove(value);
  }
  return true;
}
function expect<Value>(
  value: unknown,
  accepts: (value: unknown) => value is Value,
  label: string,
): Value {
  if (!accepts(value)) {
    throw new Error(`Invalid battle worker ${label}`);
  }
  return value;
}
function isGroupMember(value: unknown): value is GroupMovementMember {
  return (
    isWorkerRecord(value) &&
    typeof value['unitId'] === 'string' &&
    isPoint(value['from']) &&
    (value['destination'] === null || isPoint(value['destination'])) &&
    Array.isArray(value['path']) &&
    value['path'].every(isPoint) &&
    finite(value['cost']) &&
    typeof value['reason'] === 'string' &&
    optionalFields(value, {
      to: isPoint,
      desired: isPoint,
      status: text,
      moved: boolean,
      energyBefore: finite,
      energyAfter: finite,
      elapsedSeconds: finite,
    })
  );
}
function isGroupContinuation(value: unknown): value is GroupMovementContinuation {
  return (
    isWorkerRecord(value) &&
    isGroupMove(value['request']) &&
    Array.isArray(value['members']) &&
    value['members'].every(isGroupMember) &&
    Number.isSafeInteger(value['index']) &&
    (value['route'] === null || (Array.isArray(value['route']) && value['route'].every(isPoint))) &&
    Array.isArray(value['orders']) &&
    value['orders'].every(isMove) &&
    finite(value['startSeconds'])
  );
}
function readReport(value: unknown): GroupMovementReport {
  if (
    !isWorkerRecord(value) ||
    !Array.isArray(value['members']) ||
    !value['members'].every(isGroupMember) ||
    typeof value['status'] !== 'string' ||
    typeof value['reason'] !== 'string' ||
    !finite(value['elapsedSeconds']) ||
    !finite(value['actions']) ||
    !Array.isArray(value['orders']) ||
    !value['orders'].every(isMove)
  ) {
    throw new Error('Invalid battle worker group report');
  }
  return {
    ...value,
    members: value['members'],
    status: value['status'],
    reason: value['reason'],
    elapsedSeconds: value['elapsedSeconds'],
    actions: value['actions'],
    orders: value['orders'],
  };
}
function readGroupResult(value: unknown): GroupMovementResult {
  if (!isWorkerRecord(value)) {
    throw new Error('Invalid battle worker group result');
  }
  return {
    ...value,
    ...readReport(value),
    state: readBattleSnapshot(value['state']),
  };
}
function readMovementResult<Continuation>(
  value: unknown,
  accepts: (value: unknown) => value is Continuation,
): MovementStepResult<Continuation> {
  if (!isWorkerRecord(value)) {
    throw new Error('Invalid battle worker movement result');
  }
  if (value['unitId'] !== undefined && !text(value['unitId'])) {
    throw new Error('Invalid battle worker movement unit');
  }
  const status = value['status'];
  if (
    status !== 'stopped' &&
    status !== 'completed' &&
    status !== 'moving' &&
    status !== 'interrupted' &&
    status !== 'invalid' &&
    status !== 'partial' &&
    status !== 'contact'
  ) {
    throw new Error('Invalid battle worker movement status');
  }
  return {
    ...value,
    state: readBattleSnapshot(value['state']),
    status,
    continuation:
      value['continuation'] === null
        ? null
        : expect(value['continuation'], accepts, 'continuation'),
    ...(value['report'] === undefined ? {} : { report: readReport(value['report']) }),
  };
}
const isRoute = (value: unknown): value is TacticalRoutePoint[] =>
  Array.isArray(value) && value.every(isPoint);
const actionReaders: {
  [Kind in BattleJobKind]: (value: unknown) => BattleWorkerActionByKind[Kind];
} = {
  action: (value) => expect(value, isTacticalAction, 'action'),
  turn: () => null,
  resume: () => null,
  group: (value) => expect(value, isGroupMove, 'group action'),
  'movement-step': (value) => expect(value, isMove, 'movement action'),
  'group-step': (value) => expect(value, isGroupMove, 'group action'),
  'reachable-preview': (value) => {
    if (
      !isWorkerRecord(value) ||
      !identity(value['unitId']) ||
      !movementFields(value) ||
      (value['previewBudget'] !== undefined && typeof value['previewBudget'] !== 'boolean')
    ) {
      throw new Error('Invalid battle worker preview request');
    }
    const movementIntent = value['movementIntent'];
    return {
      unitId: value['unitId'],
      ...(movementIntent === 'forward' || movementIntent === 'preserveFacing'
        ? { movementIntent }
        : {}),
      ...(typeof value['previewBudget'] === 'boolean'
        ? { previewBudget: value['previewBudget'] }
        : {}),
    };
  },
  'group-preview': (value) => expect(value, isGroupMove, 'group preview'),
};
const resultReaders: {
  [Kind in BattleJobKind]: (value: unknown) => BattleWorkerResultByKind[Kind];
} = {
  action: readBattleSnapshot,
  turn: readBattleSnapshot,
  resume: readBattleSnapshot,
  group: readGroupResult,
  'movement-step': (value) => readMovementResult(value, isRoute),
  'group-step': (value) => readMovementResult(value, isGroupContinuation),
  'reachable-preview': (value) => readBattlePreview(BattleJobKind.ReachablePreview, value),
  'group-preview': (value) => readBattlePreview(BattleJobKind.GroupPreview, value),
};
const noContinuation = (value: unknown): never => {
  throw new Error(`Unexpected battle worker continuation: ${typeof value}`);
};
const continuationReaders: {
  [Kind in BattleJobKind]: (value: unknown) => BattleWorkerContinuationByKind[Kind];
} = {
  action: noContinuation,
  turn: noContinuation,
  group: noContinuation,
  resume: noContinuation,
  'reachable-preview': noContinuation,
  'group-preview': noContinuation,
  'movement-step': (value) => expect(value, isRoute, 'route'),
  'group-step': (value) => expect(value, isGroupContinuation, 'group continuation'),
};
export function readBattleWorkerAction<Kind extends BattleJobKind>(
  kind: Kind,
  value: unknown,
): BattleWorkerActionByKind[Kind] {
  return actionReaders[kind](value);
}
export function readBattleWorkerResult<Kind extends BattleJobKind>(
  kind: Kind,
  value: unknown,
): BattleWorkerResultByKind[Kind] {
  return resultReaders[kind](value);
}
export function readBattleWorkerContinuation<Kind extends BattleJobKind>(
  kind: Kind,
  value: unknown,
): BattleWorkerContinuationByKind[Kind] {
  return continuationReaders[kind](value);
}
