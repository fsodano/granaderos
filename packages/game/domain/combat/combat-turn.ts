import { CombatRefusal, CombatRefusalCode } from './action-points.ts';
export const MaximumAutomaticActionsPerTurn = 12;
export type CombatTurnSnapshot = Readonly<{
  participantIds: readonly string[];
  participantIndex: number;
  actionsTaken: number;
  participantStarted: boolean;
  budgetsIssued: boolean;
}>;
export class CombatTurn {
  #participantIds: string[];
  #participantIndex: number;
  #actionsTaken: number;
  #participantStarted: boolean;
  #budgetsIssued: boolean;
  private constructor(snapshot: CombatTurnSnapshot) {
    if (
      new Set(snapshot.participantIds).size !== snapshot.participantIds.length ||
      snapshot.participantIds.some((id) => typeof id !== 'string' || !id) ||
      !Number.isSafeInteger(snapshot.participantIndex) ||
      snapshot.participantIndex < 0 ||
      snapshot.participantIndex > snapshot.participantIds.length ||
      !Number.isSafeInteger(snapshot.actionsTaken) ||
      snapshot.actionsTaken < 0 ||
      snapshot.actionsTaken > MaximumAutomaticActionsPerTurn ||
      typeof snapshot.participantStarted !== 'boolean' ||
      typeof snapshot.budgetsIssued !== 'boolean'
    ) {
      throw new CombatRefusal(CombatRefusalCode.InvalidCombatPhase);
    }
    this.#participantIds = [...snapshot.participantIds];
    this.#participantIndex = snapshot.participantIndex;
    this.#actionsTaken = snapshot.actionsTaken;
    this.#participantStarted = snapshot.participantStarted;
    this.#budgetsIssued = snapshot.budgetsIssued;
  }
  static begin(participantIds: readonly string[]): CombatTurn {
    return new CombatTurn({
      participantIds,
      participantIndex: 0,
      actionsTaken: 0,
      participantStarted: false,
      budgetsIssued: false,
    });
  }
  static restore(snapshot: CombatTurnSnapshot): CombatTurn {
    return new CombatTurn(snapshot);
  }
  get currentCharacterId(): string | undefined {
    return this.#participantIds[this.#participantIndex];
  }
  get complete(): boolean {
    return this.#participantIndex === this.#participantIds.length;
  }
  get canAct(): boolean {
    return !this.complete && this.#actionsTaken < MaximumAutomaticActionsPerTurn;
  }
  get actionsTaken(): number {
    return this.#actionsTaken;
  }
  beginCurrentParticipant(): void {
    if (this.complete) {
      throw new CombatRefusal(CombatRefusalCode.InvalidCombatPhase);
    }
    this.#participantStarted = true;
  }
  takeUnissuedBudgets(): readonly string[] {
    if (this.#budgetsIssued) {
      return [];
    }
    this.#budgetsIssued = true;
    return this.#participantIds.slice(this.#participantIndex + (this.#participantStarted ? 1 : 0));
  }
  recordAction(): void {
    if (!this.canAct) {
      throw new CombatRefusal(CombatRefusalCode.InvalidCombatPhase);
    }
    this.#participantStarted = true;
    this.#actionsTaken++;
  }
  finishCurrentActions(): void {
    if (this.complete) {
      throw new CombatRefusal(CombatRefusalCode.InvalidCombatPhase);
    }
    this.#actionsTaken = MaximumAutomaticActionsPerTurn;
  }
  finishCurrentParticipant(remove = false): void {
    if (this.complete) {
      throw new CombatRefusal(CombatRefusalCode.InvalidCombatPhase);
    }
    if (remove) {
      this.#participantIds.splice(this.#participantIndex, 1);
    } else {
      this.#participantIndex++;
    }
    this.#actionsTaken = 0;
    this.#participantStarted = false;
  }
  snapshot(): CombatTurnSnapshot {
    return {
      participantIds: [...this.#participantIds],
      participantIndex: this.#participantIndex,
      actionsTaken: this.#actionsTaken,
      participantStarted: this.#participantStarted,
      budgetsIssued: this.#budgetsIssued,
    };
  }
}
