import { getReachable, canSee, knownArtillery } from './tactical.js';
import {
  civilianPatrolDestination,
  civilianPatrolsThisTurn,
} from './domain/personnel/npc-patrol.ts';

// The map reports which cells the civilian can reach and what it can see; the
// domain decides whether it patrols, where it aims and which cell it takes.
export function choosePatrolAction(state, unit) {
  if (!civilianPatrolsThisTurn(unit, state.turn)) {
    return null;
  }
  const perceived = {
    ...state,
    units: state.units.filter((other) => other.side === unit.side || canSee(state, unit, other)),
    artillery: knownArtillery(state, unit),
  };
  const next = civilianPatrolDestination(unit, state.turn, getReachable(perceived, unit));
  return next ? { type: 'move', unitId: unit.id, x: next.x, y: next.y, patrol: true } : null;
}
