import { ReactionWindow, ReactionReturn } from '../../domain/combat/reaction-window.ts';
import { ReactionStack } from '../../domain/combat/reaction-stack.ts';
import { CombatTurn } from '../../domain/combat/combat-turn.ts';
import { SectorSession, SectorSessionMode } from '../../domain/sector-sessions/sector-session.ts';
import {
  CombatPhase,
  CombatOutcome,
  QuietRoundsBeforeExploration,
} from '../../domain/combat/combat-session.ts';
import { SectorParticipant } from '../../domain/sector-sessions/sector-participant.ts';

export function readSectorSession(state) {
  const sessionId =
    state.sectorSession?.id ??
    `sector:${state.battleId ?? state.sectorId}:${state.startSeconds ?? 0}`;
  const mode = state.deployment
    ? SectorSessionMode.Deployment
    : (state.mode ?? SectorSessionMode.Combat);
  const previous = state.sectorSession;
  const sequence =
    mode === SectorSessionMode.Combat
      ? Math.max(1, previous?.combatSequence ?? 1)
      : (previous?.combatSequence ?? 0);
  const quietRounds =
    state.quietCombatTurns ??
    (state.units.some(
      (unit) =>
        unit.hp > 0 &&
        unit.lastKnownEnemy &&
        state.turn - unit.lastKnownEnemy.turn <= QuietRoundsBeforeExploration,
    )
      ? 0
      : QuietRoundsBeforeExploration);
  return SectorSession.restore({
    id: sessionId,
    sectorId: state.sectorId,
    mode,
    combatSequence: sequence,
    ...(mode === SectorSessionMode.Combat
      ? {
          combat: {
            id: previous?.combat?.id ?? `${sessionId}:combat:${sequence}`,
            round: state.turn,
            phase: state.phase,
            outcome: state.status,
            quietRounds,
            contactThisRound: Boolean(state.contactThisRound),
            firstSide: state.roundFirstSide ?? 'player',
            roundTimeCharged: Boolean(state.roundTimeCharged),
          },
        }
      : {}),
    completedCombatSessions: previous?.completedCombatSessions ?? [],
    participantIds: state.units.map((unit) => String(unit.id)),
    ...(['defeat', 'retreat'].includes(state.status) ? { termination: state.status } : {}),
  });
}

export function writeSectorSession(state, session) {
  const snapshot = session.snapshot();
  state.sectorSession = snapshot;
  state.mode =
    snapshot.mode === SectorSessionMode.Deployment ? SectorSessionMode.Exploration : snapshot.mode;
  if (snapshot.combat) {
    const combat = snapshot.combat;
    state.turn = combat.round;
    state.phase = combat.phase;
    state.status = combat.outcome;
    state.quietCombatTurns = combat.quietRounds;
    state.contactThisRound = combat.contactThisRound;
    state.roundFirstSide = combat.firstSide;
    state.roundTimeCharged = combat.roundTimeCharged;
  } else {
    state.phase = CombatPhase.Player;
    state.status = snapshot.termination ?? CombatOutcome.Active;
    state.quietCombatTurns = QuietRoundsBeforeExploration;
    state.contactThisRound = false;
    state.roundTimeCharged = false;
    delete state.roundFirstSide;
  }
  return state;
}

export function changeCombat(state, change) {
  const session = readSectorSession(state);
  if (!session.combat) return;
  change(session.combat);
  writeSectorSession(state, session);
}

export function setCombatPhase(state, phase) {
  changeCombat(state, (combat) => {
    if (!combat.active) return;
    if (phase === CombatPhase.Player) combat.beginPlayerPhase();
    else if (phase === CombatPhase.Enemy) combat.beginEnemyPhase();
    else combat.openPlayerInterrupt();
  });
}

export function participantOf(unit) {
  return SectorParticipant.restore({
    characterId: String(unit.id),
    actionPoints: unit.ap ?? 0,
    maximumActionPoints: unit.maxAP ?? 0,
    carriedActionPoints: unit.carriedAP ?? 0,
  });
}

export function writeParticipant(unit, participant) {
  const snapshot = participant.snapshot();
  unit.ap = snapshot.actionPoints;
  unit.maxAP = snapshot.maximumActionPoints;
  unit.carriedAP = snapshot.carriedActionPoints;
}

export function spendParticipantActionPoints(unit, amount) {
  const participant = participantOf(unit);
  if (!participant.canSpend(amount)) return false;
  participant.spend(amount);
  writeParticipant(unit, participant);
  return true;
}

export function loseParticipantActionPoints(unit, amount) {
  const participant = participantOf(unit);
  participant.lose(amount);
  writeParticipant(unit, participant);
}

export function readCombatTurn(queue) {
  return CombatTurn.restore({
    participantIds: queue.unitIds,
    participantIndex: queue.unitIndex,
    actionsTaken: queue.actionsTaken,
    participantStarted: Boolean(queue.started),
    budgetsIssued: Boolean(queue.budgetsIssued),
  });
}
export function writeCombatTurn(queue, turn) {
  const snapshot = turn.snapshot();
  queue.unitIds = [...snapshot.participantIds];
  queue.unitIndex = snapshot.participantIndex;
  queue.actionsTaken = snapshot.actionsTaken;
  queue.started = snapshot.participantStarted;
  queue.budgetsIssued = snapshot.budgetsIssued;
}

export function readReactionWindow(window) {
  return ReactionWindow.restore({
    participantIds: window.unitIds,
    triggeringCharacterId: window.enemyId,
    returnTo: window.returnTo ?? ReactionReturn.EnemyTurn,
    automaticActions: window.militiaActions ?? {},
  });
}
export function reactionWindowSnapshot(window) {
  const snapshot = window.snapshot();
  return {
    side: 'player',
    unitIds: [...snapshot.participantIds],
    enemyId: snapshot.triggeringCharacterId,
    ...(snapshot.returnTo === ReactionReturn.Reaction ? { returnTo: ReactionReturn.Reaction } : {}),
    ...(Object.keys(snapshot.automaticActions).length
      ? { militiaActions: { ...snapshot.automaticActions } }
      : {}),
  };
}
export function readReactionStack(state) {
  return new ReactionStack(
    (state.reactionStack ?? []).map((frame) => ({
      turn: readCombatTurn(frame).snapshot(),
      resumePhase: frame.resumePhase,
      ...(frame.resumeInterrupt
        ? { resumeWindow: readReactionWindow(frame.resumeInterrupt).snapshot() }
        : {}),
    })),
    state.units.length,
  );
}
export function writeReactionStack(state, stack) {
  if (stack.empty) {
    delete state.reactionStack;
    return;
  }
  state.reactionStack = stack.snapshot().map((frame) => {
    const queue = {
      resumePhase: frame.resumePhase,
      ...(frame.resumeWindow
        ? { resumeInterrupt: reactionWindowSnapshot(ReactionWindow.restore(frame.resumeWindow)) }
        : {}),
    };
    writeCombatTurn(queue, CombatTurn.restore(frame.turn));
    return queue;
  });
}
