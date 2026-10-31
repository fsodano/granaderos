import type {
  BattleSnapshot,
  GroupMoveAction,
  GroupMovementContinuation,
  MoveAction,
  MovementStepResult,
  TacticalPoint,
  TacticalRoutePoint,
} from '../../../packages/game/public/compatibility-types.ts';

export type MovementOrder =
  | (MoveAction & { unitId: string })
  | (GroupMoveAction & { type: 'groupMove'; unitId: string });
export type MovementContinuation = TacticalRoutePoint[] | GroupMovementContinuation;
export type MovementResult = MovementStepResult<MovementContinuation>;
export interface MovementIntent {
  unitId: string;
  movingUnitId: string;
  action: MovementOrder;
  finishing: boolean;
}
export type MovementPositions = Record<string, TacticalPoint & { settled?: boolean }>;
export type MovementCommit = (
  next: BattleSnapshot,
  action: MovementOrder,
  source: BattleSnapshot,
  result: MovementResult,
) => BattleSnapshot | null | void;
export interface MovementControllerOptions {
  execute: (
    action: MovementOrder,
    continuation: MovementContinuation | null,
  ) => Promise<MovementResult | null>;
  commit: MovementCommit;
  canMove: (state: BattleSnapshot, id: string, action: MovementOrder) => boolean;
}
export interface MovementController {
  updateCallbacks: (options: MovementControllerOptions) => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => MovementIntent | null;
  observe: (next: BattleSnapshot, visual: MovementPositions) => void;
  request: (action: MovementOrder) => boolean;
  cancel: () => void;
  setEnabled: (enabled: boolean) => void;
}
