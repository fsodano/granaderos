import { CombatRefusal, CombatRefusalCode } from './action-points.ts';
import { MaximumAutomaticActionsPerTurn } from './combat-turn.ts';
export const ReactionReturn = Object.freeze({
  EnemyTurn: 'enemyTurn',
  Reaction: 'reaction',
} as const);
export type ReactionWindowSnapshot = Readonly<{
  participantIds: readonly string[];
  triggeringCharacterId: string;
  returnTo: (typeof ReactionReturn)[keyof typeof ReactionReturn];
  automaticActions: Readonly<Record<string, number>>;
}>;
export class ReactionWindow {
  readonly #participantIds: readonly string[];
  readonly #triggeringCharacterId: string;
  readonly #returnTo: ReactionWindowSnapshot['returnTo'];
  readonly #automaticActions: Map<string, number>;
  private constructor(snapshot: ReactionWindowSnapshot) {
    if (
      !snapshot.participantIds.length ||
      new Set(snapshot.participantIds).size !== snapshot.participantIds.length ||
      snapshot.participantIds.some((id) => !id) ||
      !snapshot.triggeringCharacterId ||
      !Object.values(ReactionReturn).includes(snapshot.returnTo) ||
      Object.entries(snapshot.automaticActions).some(
        ([id, count]) =>
          !snapshot.participantIds.includes(id) ||
          !Number.isSafeInteger(count) ||
          count < 1 ||
          count > MaximumAutomaticActionsPerTurn,
      )
    )
      throw new CombatRefusal(CombatRefusalCode.InvalidCombatPhase);
    this.#participantIds = [...snapshot.participantIds];
    this.#triggeringCharacterId = snapshot.triggeringCharacterId;
    this.#returnTo = snapshot.returnTo;
    this.#automaticActions = new Map(Object.entries(snapshot.automaticActions));
  }
  static open(
    participantIds: readonly string[],
    triggeringCharacterId: string,
    returnTo: ReactionWindowSnapshot['returnTo'],
  ): ReactionWindow {
    return new ReactionWindow({
      participantIds,
      triggeringCharacterId,
      returnTo,
      automaticActions: {},
    });
  }
  static restore(snapshot: ReactionWindowSnapshot): ReactionWindow {
    return new ReactionWindow(snapshot);
  }
  allows(characterId: string): boolean {
    return this.#participantIds.includes(characterId);
  }
  canActAutomatically(characterId: string): boolean {
    return (
      this.allows(characterId) &&
      (this.#automaticActions.get(characterId) ?? 0) < MaximumAutomaticActionsPerTurn
    );
  }
  recordAutomaticAction(characterId: string): void {
    if (!this.canActAutomatically(characterId))
      throw new CombatRefusal(CombatRefusalCode.InvalidCombatPhase);
    this.#automaticActions.set(characterId, (this.#automaticActions.get(characterId) ?? 0) + 1);
  }
  finishAutomaticActions(characterId: string): void {
    if (!this.allows(characterId)) throw new CombatRefusal(CombatRefusalCode.InvalidCombatPhase);
    this.#automaticActions.set(characterId, MaximumAutomaticActionsPerTurn);
  }
  snapshot(): ReactionWindowSnapshot {
    return {
      participantIds: [...this.#participantIds],
      triggeringCharacterId: this.#triggeringCharacterId,
      returnTo: this.#returnTo,
      automaticActions: Object.fromEntries(this.#automaticActions),
    };
  }
}
