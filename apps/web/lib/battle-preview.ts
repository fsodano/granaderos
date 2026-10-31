import type {
  BattlePreviewKind,
  PreviewPoint,
  ReachablePreviewPoint,
  GroupMovePreviewMember,
  BattlePreviewResultByKind,
} from '../../../packages/game/public/battle-preview-types.ts';
export type {
  BattlePreviewKind,
  PreviewPoint,
  ReachablePreviewRequest,
  GroupMovePreviewRequest,
  ReachablePreviewPoint,
  GroupMovePreviewMember,
  GroupMovePreview,
  BattlePreviewRequestByKind,
  BattlePreviewResultByKind,
} from '../../../packages/game/public/battle-preview-types.ts';
export type BattlePreviewJob<Kind extends BattlePreviewKind> =
  import('./battle-worker-contracts.ts').BattleWorkerJob<Kind>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPoint(value: unknown): value is PreviewPoint {
  return (
    isRecord(value) &&
    typeof value['x'] === 'number' &&
    Number.isFinite(value['x']) &&
    typeof value['y'] === 'number' &&
    Number.isFinite(value['y']) &&
    (value['tacticalLevel'] === undefined ||
      (typeof value['tacticalLevel'] === 'number' &&
        Number.isFinite(value['tacticalLevel'])))
  );
}

function isReachablePoint(value: unknown): value is ReachablePreviewPoint {
  return (
    isRecord(value) &&
    isPoint(value) &&
    typeof value['cost'] === 'number' &&
    Number.isFinite(value['cost']) &&
    Array.isArray(value['path']) &&
    value['path'].every(isPoint)
  );
}

function isGroupMember(value: unknown): value is GroupMovePreviewMember {
  return (
    isRecord(value) &&
    typeof value['unitId'] === 'string' &&
    (value['status'] === undefined ||
      ['skipped', 'blocked', 'ready', 'arrived'].some(
        (status) => status === value['status'],
      )) &&
    (value['destination'] === null || isPoint(value['destination'])) &&
    Array.isArray(value['path']) &&
    value['path'].every(isPoint) &&
    typeof value['cost'] === 'number' &&
    Number.isFinite(value['cost']) &&
    typeof value['reason'] === 'string'
  );
}

function isBattlePreview<Kind extends BattlePreviewKind>(
  kind: Kind,
  value: unknown,
): value is BattlePreviewResultByKind[Kind] {
  if (kind === 'reachable-preview') {
    return Array.isArray(value) && value.every(isReachablePoint);
  }
  return (
    isRecord(value) &&
    typeof value['ok'] === 'boolean' &&
    typeof value['reason'] === 'string' &&
    Array.isArray(value['members']) &&
    value['members'].every(isGroupMember)
  );
}

// Preview admission checks every field consumed by the browser. Game rules own route validity and privacy.
export function readBattlePreview<Kind extends BattlePreviewKind>(
  kind: Kind,
  value: unknown,
): BattlePreviewResultByKind[Kind] {
  if (!isBattlePreview(kind, value)) {
    throw new Error('Battle worker returned an invalid preview');
  }
  return value;
}
