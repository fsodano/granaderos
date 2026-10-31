import { assertSectorOperationContext } from './infrastructure/sector-sessions/sector-operation-context.js';
import {
  actBattle,
  endTurn,
  resumeSectorOperation,
  getReachable,
  knownArtillery,
  canSee,
  teamCanSee,
} from './tactical.js';
import {
  executeGroupMove,
  planGroupMove,
  groupMovementStep,
  resumeGroupMove,
} from './group-movement.ts';
import { movementStep } from './movement-step.ts';
import { BattleJobKind } from './public/battle-job-types.ts';
import type { BattleWorkerJob, BattleWorkerResultByKind } from './public/battle-job-types.ts';
import type { TacticalPoint } from './public/compatibility-types.ts';
type DiscriminatedJob = { [Kind in BattleJobKind]: BattleWorkerJob<Kind> }[BattleJobKind];

// Browser workers and the synchronous fallback use the same deterministic rules.
export function runBattleJob<Kind extends BattleJobKind>(
  job: BattleWorkerJob<Kind>,
): BattleWorkerResultByKind[Kind];
export function runBattleJob(job: DiscriminatedJob): BattleWorkerResultByKind[BattleJobKind] {
  const { battle, context } = job;
  if (context) {
    assertSectorOperationContext(battle, context);
  }
  switch (job.kind) {
    case BattleJobKind.Resume:
      if (battle.pendingSectorOperation?.kind === 'groupMovement') {
        return resumeGroupMove(battle);
      }
      return resumeSectorOperation(battle);
    case BattleJobKind.MovementStep:
      return movementStep(battle, job.action, job.continuation ?? null);
    case BattleJobKind.GroupStep:
      return groupMovementStep(battle, job.action, job.continuation ?? null);
    case BattleJobKind.ReachablePreview: {
      const { action } = job;
      const unit = battle.units.find((actor) => actor.id === String(action.unitId));
      if (!unit) {
        return [];
      }
      // Preview visibility must not reveal hidden people or artillery.
      const observed = (point: TacticalPoint) =>
        unit.side === 'player' ? teamCanSee(battle, unit.side, point) : canSee(battle, unit, point);
      const view = {
        ...battle,
        units: battle.units.filter((other) => other.side === unit.side || observed(other)),
        npcs: battle.npcs.filter(observed),
        artillery: knownArtillery(battle, unit),
      };
      return getReachable(view, action.unitId, {
        ...(action.movementIntent ? { movementIntent: action.movementIntent } : {}),
        previewBudget: Boolean(action.previewBudget),
      });
    }
    case BattleJobKind.Turn:
      return endTurn(battle);
    case BattleJobKind.Group:
      return executeGroupMove(battle, job.action);
    case BattleJobKind.GroupPreview:
      return planGroupMove(battle, job.action);
    case BattleJobKind.Action:
      return actBattle(battle, job.action);
  }
}
