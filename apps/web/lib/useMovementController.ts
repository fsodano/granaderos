'use client';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  unitCanAct,
  groupSelectionMode,
} from '../../../packages/game/ja2-hud.ts';
import { createMovementController } from './movement-controller.js';
import { BattleJobKind } from './battle-worker-contracts.ts';
import type {
  BattleWorkerActionByKind,
  BattleWorkerContinuationByKind,
  BattleWorkerResultByKind,
} from './battle-worker-contracts.ts';
import type {
  MovementCommit,
  MovementControllerOptions,
} from './movement-controller-types.ts';

type MovementJob =
  | typeof BattleJobKind.MovementStep
  | typeof BattleJobKind.GroupStep;
type RunMovement = <Kind extends MovementJob>(
  action: BattleWorkerActionByKind[NoInfer<Kind>],
  kind: Kind,
  continuation?: BattleWorkerContinuationByKind[NoInfer<Kind>] | null,
) => Promise<BattleWorkerResultByKind[Kind] | null>;
function movementOptions(
  run: RunMovement,
  commit: MovementCommit,
): MovementControllerOptions {
  return {
    execute: (action, continuation) => {
      if (action.type === 'groupMove') {
        if (Array.isArray(continuation)) {
          throw new Error('Group movement received an individual route');
        }
        return run(action, BattleJobKind.GroupStep, continuation);
      }
      if (continuation !== null && !Array.isArray(continuation)) {
        throw new Error('Individual movement received a group continuation');
      }
      return run(action, BattleJobKind.MovementStep, continuation);
    },
    commit: (next, action, source, result) =>
      commit(next, action, source, result),
    canMove: (state, id, action) =>
      action.type === 'groupMove'
        ? groupSelectionMode(state) &&
          action.unitIds.some((id) =>
            unitCanAct(
              state,
              state.units.find((unit) => unit.id === id),
            ),
          )
        : unitCanAct(
            state,
            state.units.find((unit) => unit.id === id),
          ),
  };
}
export function useMovementController(
  run: RunMovement,
  commit: MovementCommit,
) {
  const [current] = useState(() =>
    createMovementController(movementOptions(run, commit)),
  );
  useLayoutEffect(() => {
    current.updateCallbacks(movementOptions(run, commit));
  }, [current, run, commit]);

  const intent = useSyncExternalStore(
    current.subscribe,
    current.getSnapshot,
    current.getSnapshot,
  );
  useEffect(() => {
    current.setEnabled(true);
    return () => current.setEnabled(false);
  }, [current]);
  const movingUnitId = intent?.movingUnitId;
  const continuingIds = useMemo(
    () => new Set(movingUnitId ? [movingUnitId] : []),
    [movingUnitId],
  );
  return {
    intent,
    continuingIds,
    request: current.request,
    cancel: current.cancel,
    observe: current.observe,
    isActive: (id: string) => {
      const currentIntent = current.getSnapshot();
      return (
        currentIntent?.unitId === id ||
        (currentIntent?.action.type === 'groupMove' &&
          currentIntent.action.unitIds.includes(id))
      );
    },
  };
}
