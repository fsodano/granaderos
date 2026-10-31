export type BattlePreviewKind = 'reachable-preview' | 'group-preview';

export interface PreviewPoint {
  x: number;
  y: number;
  tacticalLevel?: number;
}

export interface ReachablePreviewRequest {
  unitId: string | number;
  movementIntent?: string;
  previewBudget?: boolean;
}

export interface GroupMovePreviewRequest extends PreviewPoint {
  unitIds: (string | number)[];
  anchorId: string | number;
  movement?: string;
  movementIntent?: string;
}

export interface ReachablePreviewPoint extends PreviewPoint {
  cost: number;
  path: PreviewPoint[];
}

export interface GroupMovePreviewMember {
  unitId: string;
  destination: PreviewPoint | null;
  path: PreviewPoint[];
  cost: number;
  reason: string;
}

export interface GroupMovePreview {
  ok: boolean;
  reason: string;
  members: GroupMovePreviewMember[];
}

export interface BattlePreviewRequestByKind {
  'reachable-preview': ReachablePreviewRequest;
  'group-preview': GroupMovePreviewRequest;
}

export interface BattlePreviewResultByKind {
  'reachable-preview': ReachablePreviewPoint[];
  'group-preview': GroupMovePreview;
}

export interface BattlePreviewJob<Kind extends BattlePreviewKind> {
  battle: unknown;
  action: BattlePreviewRequestByKind[Kind];
  kind: Kind;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPoint(value: unknown): value is PreviewPoint {
  return (
    isRecord(value) &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y) &&
    (value.tacticalLevel === undefined ||
      (typeof value.tacticalLevel === 'number' && Number.isFinite(value.tacticalLevel)))
  );
}

function isReachablePoint(value: unknown): value is ReachablePreviewPoint {
  return (
    isRecord(value) &&
    isPoint(value) &&
    typeof value.cost === 'number' &&
    Number.isFinite(value.cost) &&
    Array.isArray(value.path) &&
    value.path.every(isPoint)
  );
}

function isGroupMember(value: unknown): value is GroupMovePreviewMember {
  return (
    isRecord(value) &&
    typeof value.unitId === 'string' &&
    (value.destination === null || isPoint(value.destination)) &&
    Array.isArray(value.path) &&
    value.path.every(isPoint) &&
    typeof value.cost === 'number' &&
    Number.isFinite(value.cost) &&
    typeof value.reason === 'string'
  );
}

function isBattlePreview<Kind extends BattlePreviewKind>(
  kind: Kind,
  value: unknown,
): value is BattlePreviewResultByKind[Kind] {
  if (kind === 'reachable-preview') return Array.isArray(value) && value.every(isReachablePoint);
  return (
    isRecord(value) &&
    typeof value.ok === 'boolean' &&
    typeof value.reason === 'string' &&
    Array.isArray(value.members) &&
    value.members.every(isGroupMember)
  );
}

// Validate the fields read by preview UI. Additional route metadata and the
// complete sector snapshot stay opaque; game rules own route validity and privacy.
export function readBattlePreview<Kind extends BattlePreviewKind>(
  kind: Kind,
  value: unknown,
): BattlePreviewResultByKind[Kind] {
  if (!isBattlePreview(kind, value)) throw new Error('Battle worker returned an invalid preview');
  return value;
}
