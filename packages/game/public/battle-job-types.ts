import type { SectorOperationContextSnapshot } from '../domain/sector-sessions/sector-operation-context.ts';
import type {
  BattleSnapshot,
  TacticalAction,
  MoveAction,
  GroupMoveAction,
  TacticalRoutePoint,
  GroupMovementContinuation,
  GroupMovementResult,
  MovementStepResult,
} from './compatibility-types.ts';
import type {
  BattlePreviewRequestByKind,
  BattlePreviewResultByKind,
} from './battle-preview-types.ts';

export const BattleJobKind = Object.freeze({
  Action: 'action',
  Turn: 'turn',
  Group: 'group',
  MovementStep: 'movement-step',
  GroupStep: 'group-step',
  Resume: 'resume',
  ReachablePreview: 'reachable-preview',
  GroupPreview: 'group-preview',
} as const);
export type BattleJobKind = (typeof BattleJobKind)[keyof typeof BattleJobKind];
export interface BattleWorkerActionByKind extends BattlePreviewRequestByKind {
  action: TacticalAction;
  turn: null;
  group: GroupMoveAction;
  'movement-step': MoveAction;
  'group-step': GroupMoveAction;
  resume: null;
}
export interface BattleWorkerResultByKind extends BattlePreviewResultByKind {
  action: BattleSnapshot;
  turn: BattleSnapshot;
  group: GroupMovementResult;
  'movement-step': MovementStepResult;
  'group-step': MovementStepResult<GroupMovementContinuation>;
  resume: BattleSnapshot;
}
export interface BattleWorkerContinuationByKind {
  action: never;
  turn: never;
  group: never;
  'movement-step': TacticalRoutePoint[];
  'group-step': GroupMovementContinuation;
  resume: never;
  'reachable-preview': never;
  'group-preview': never;
}
export type BattleWorkerJob<Kind extends BattleJobKind = BattleJobKind> = {
  battle: BattleSnapshot;
  kind: Kind;
  continuation?: BattleWorkerContinuationByKind[NoInfer<Kind>] | null;
  context?: SectorOperationContextSnapshot;
} & (
  | { action: BattleWorkerActionByKind[NoInfer<Kind>] }
  | { kind: Extract<Kind, 'turn' | 'resume'>; action?: null }
);
