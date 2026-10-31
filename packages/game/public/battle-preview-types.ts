import type { MovementMode, MovementIntent } from './compatibility-types.ts';
export type BattlePreviewKind = 'reachable-preview' | 'group-preview';

export interface PreviewPoint {
  x: number;
  y: number;
  tacticalLevel?: number;
}

export interface ReachablePreviewRequest {
  unitId: string | number;
  movementIntent?: MovementIntent;
  previewBudget?: boolean;
}

export interface GroupMovePreviewRequest extends PreviewPoint {
  unitIds: (string | number)[];
  anchorId: string | number;
  movement?: MovementMode;
  movementIntent?: MovementIntent;
}

export interface ReachablePreviewPoint extends PreviewPoint {
  cost: number;
  path: PreviewPoint[];
}

export interface GroupMovePreviewMember {
  status?: 'skipped' | 'blocked' | 'ready' | 'arrived';
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
