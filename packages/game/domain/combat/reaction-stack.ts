import { CombatTurn } from './combat-turn.ts';
import type { CombatTurnSnapshot } from './combat-turn.ts';
import { ReactionWindow } from './reaction-window.ts';
import type { ReactionWindowSnapshot } from './reaction-window.ts';
import { CombatPhase } from './combat-session.ts';
import { CombatRefusal, CombatRefusalCode } from './action-points.ts';
export type ReactionFrameSnapshot = Readonly<{
  turn: CombatTurnSnapshot;
  resumePhase: 'player' | 'interrupt';
  resumeWindow?: ReactionWindowSnapshot;
}>;
export class ReactionStack {
  readonly #frames: {
    turn: CombatTurn;
    resumePhase: 'player' | 'interrupt';
    resumeWindow?: ReactionWindow;
  }[];
  readonly #maximumDepth: number;
  constructor(snapshots: readonly ReactionFrameSnapshot[], maximumDepth: number) {
    if (
      !Number.isSafeInteger(maximumDepth) ||
      maximumDepth < 1 ||
      snapshots.length > maximumDepth
    ) {
      throw new CombatRefusal(CombatRefusalCode.InvalidCombatPhase);
    }
    const ids = snapshots.flatMap((snapshot) => snapshot.turn.participantIds);
    if (
      new Set(ids).size !== ids.length ||
      snapshots.some((snapshot) => !snapshot.turn.participantIds.length)
    ) {
      throw new CombatRefusal(CombatRefusalCode.InvalidCombatPhase);
    }
    this.#maximumDepth = maximumDepth;
    this.#frames = snapshots.map((snapshot) => {
      if (
        ![CombatPhase.Player, CombatPhase.Interrupt].includes(snapshot.resumePhase) ||
        Boolean(snapshot.resumeWindow) !== (snapshot.resumePhase === CombatPhase.Interrupt)
      ) {
        throw new CombatRefusal(CombatRefusalCode.InvalidCombatPhase);
      }
      return {
        turn: CombatTurn.restore(snapshot.turn),
        resumePhase: snapshot.resumePhase,
        ...(snapshot.resumeWindow
          ? { resumeWindow: ReactionWindow.restore(snapshot.resumeWindow) }
          : {}),
      };
    });
  }
  get currentTurn(): CombatTurn | undefined {
    return this.#frames.at(-1)?.turn;
  }
  get empty(): boolean {
    return this.#frames.length === 0;
  }
  suspend(
    participantIds: readonly string[],
    resumePhase: 'player' | 'interrupt',
    resumeWindow?: ReactionWindow,
  ): void {
    if (
      !participantIds.length ||
      participantIds.some((id) =>
        this.#frames.some((frame) => frame.turn.snapshot().participantIds.includes(id)),
      ) ||
      this.#frames.length >= this.#maximumDepth ||
      Boolean(resumeWindow) !== (resumePhase === CombatPhase.Interrupt)
    ) {
      throw new CombatRefusal(CombatRefusalCode.InvalidCombatPhase);
    }
    this.#frames.push({
      turn: CombatTurn.begin(participantIds),
      resumePhase,
      ...(resumeWindow ? { resumeWindow } : {}),
    });
  }
  completeCurrent(): Readonly<{ phase: 'player' | 'interrupt'; window?: ReactionWindowSnapshot }> {
    const frame = this.#frames.at(-1);
    if (!frame || !frame.turn.complete) {
      throw new CombatRefusal(CombatRefusalCode.InvalidCombatPhase);
    }
    this.#frames.pop();
    return {
      phase: frame.resumePhase,
      ...(frame.resumeWindow ? { window: frame.resumeWindow.snapshot() } : {}),
    };
  }
  snapshot(): readonly ReactionFrameSnapshot[] {
    return this.#frames.map((frame) => ({
      turn: frame.turn.snapshot(),
      resumePhase: frame.resumePhase,
      ...(frame.resumeWindow ? { resumeWindow: frame.resumeWindow.snapshot() } : {}),
    }));
  }
}
