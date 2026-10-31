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
} from './group-movement.js';
import { movementStep } from './movement-step.js';
// Both browser paths execute the same deterministic rules on owned snapshots.
/** @param {{battle:any,action:any,kind?:string,continuation?:unknown,context?:any}} job */
export function runBattleJob({
  battle,
  action,
  kind = 'action',
  continuation = null,
  context = null,
}) {
  if (context) assertSectorOperationContext(battle, context);
  if (kind === 'resume') {
    const pending = battle.pendingSectorOperation;
    if (pending?.kind === 'groupMovement') return resumeGroupMove(battle);
    return resumeSectorOperation(battle);
  }
  if (kind === 'movement-step') return movementStep(battle, action, continuation);
  if (kind === 'group-step') return groupMovementStep(battle, action, continuation);
  if (kind === 'reachable-preview') {
    const unit = battle.units.find((unit) => unit.id === String(action.unitId));
    if (!unit) return [];
    // Match native movement planning. Hidden people and guns cannot disclose
    // their cells through a preview; execution still checks the complete field.
    const observed = (point) =>
      unit.side === 'player' ? teamCanSee(battle, unit.side, point) : canSee(battle, unit, point);
    const view = {
      ...battle,
      units: battle.units.filter((other) => other.side === unit.side || observed(other)),
      npcs: (battle.npcs ?? []).filter(observed),
      artillery: knownArtillery(battle, unit),
    };
    return getReachable(view, action.unitId, {
      movementIntent: action.movementIntent,
      previewBudget: Boolean(action.previewBudget),
    });
  }
  if (kind === 'turn') return endTurn(battle);
  if (kind === 'group') return executeGroupMove(battle, action);
  if (kind === 'group-preview') return planGroupMove(battle, action);
  if (kind !== 'action') throw Error('Unknown battle job');
  return actBattle(battle, action);
}
