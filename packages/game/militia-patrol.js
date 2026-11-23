import { militiaPatrolRules } from './militia-patrol-rules.js';
import { canSee, getReachable, knownArtillery } from './tactical.js';
import {
  canAct,
  militiaPatrolDestination,
  militiaPatrolsThisTurn,
  militiaPatrolWaypoint,
} from './domain/personnel/militia-patrol.ts';

// Fixed map waypoints do not expose or follow unseen opponents. The clock and
// each actor's position already belong to the validated tactical snapshot.
export function militiaPatrolOrder(state, unit) {
  const rules = militiaPatrolRules(state);
  const enemyInSight = state.units.some(
    (v) =>
      v.side !== unit.side &&
      canAct(v) &&
      state.units.some((p) => p.side === unit.side && canAct(p) && canSee(state, p, v)),
  );
  if (!militiaPatrolsThisTurn(rules, unit, state.turn, state, enemyInSight)) {
    return null;
  }
  const waypoint = militiaPatrolWaypoint(rules, state.turn, state);
  const perceived = {
    ...state,
    units: state.units.filter((v) => v.side === unit.side || canSee(state, unit, v)),
    artillery: knownArtillery(state, unit),
  };
  const destination = militiaPatrolDestination(unit, waypoint, getReachable(perceived, unit));
  return destination
    ? { type: 'move', unitId: unit.id, x: destination.x, y: destination.y, patrol: true }
    : null;
}
