import { CombatRefusal, CombatRefusalCode } from './action-points.ts';

export const CombatPhase = Object.freeze({
  Player: 'player',
  Enemy: 'enemy',
  Interrupt: 'interrupt',
} as const);
export const CombatOutcome = Object.freeze({
  Active: 'active',
  Victory: 'victory',
  Defeat: 'defeat',
  Retreat: 'retreat',
  Disengaged: 'disengaged',
} as const);
export type CombatPhaseValue = (typeof CombatPhase)[keyof typeof CombatPhase];
export type CombatOutcomeValue = (typeof CombatOutcome)[keyof typeof CombatOutcome];
export type CombatSide = 'player' | 'enemy';
export const QuietRoundsBeforeExploration = 2;

export type CombatSessionSnapshot = Readonly<{
  id: string;
  round: number;
  phase: CombatPhaseValue;
  outcome: CombatOutcomeValue;
  quietRounds: number;
  contactThisRound: boolean;
  firstSide: CombatSide;
  roundTimeCharged: boolean;
}>;

export type ExplorationEligibility = Readonly<{
  visualContact: boolean;
  automaticActionsPending: boolean;
  routedParticipants: boolean;
}>;

export class CombatSession {
  readonly #id: string;
  #round: number;
  #phase: CombatPhaseValue;
  #outcome: CombatOutcomeValue;
  #quietRounds: number;
  #contactThisRound: boolean;
  readonly #firstSide: CombatSide;
  #roundTimeCharged: boolean;

  private constructor(snapshot: CombatSessionSnapshot) {
    if (
      !snapshot.id ||
      !Number.isSafeInteger(snapshot.round) ||
      snapshot.round < 1 ||
      !Object.values(CombatPhase).includes(snapshot.phase) ||
      !Object.values(CombatOutcome).includes(snapshot.outcome) ||
      !Number.isSafeInteger(snapshot.quietRounds) ||
      snapshot.quietRounds < 0 ||
      snapshot.quietRounds > QuietRoundsBeforeExploration ||
      typeof snapshot.contactThisRound !== 'boolean' ||
      typeof snapshot.roundTimeCharged !== 'boolean' ||
      !['player', 'enemy'].includes(snapshot.firstSide)
    ) {
      throw new CombatRefusal(CombatRefusalCode.InvalidCombatSession);
    }
    this.#id = snapshot.id;
    this.#round = snapshot.round;
    this.#phase = snapshot.phase;
    this.#outcome = snapshot.outcome;
    this.#quietRounds = snapshot.quietRounds;
    this.#contactThisRound = snapshot.contactThisRound;
    this.#firstSide = snapshot.firstSide;
    this.#roundTimeCharged = snapshot.roundTimeCharged;
  }

  static begin(id: string, round: number, firstSide: CombatSide): CombatSession {
    return new CombatSession({
      id,
      round,
      firstSide,
      phase: CombatPhase.Player,
      outcome: CombatOutcome.Active,
      quietRounds: 0,
      contactThisRound: true,
      roundTimeCharged: false,
    });
  }
  static restore(snapshot: CombatSessionSnapshot): CombatSession {
    return new CombatSession(snapshot);
  }
  get id(): string {
    return this.#id;
  }
  get phase(): CombatPhaseValue {
    return this.#phase;
  }
  get outcome(): CombatOutcomeValue {
    return this.#outcome;
  }
  get active(): boolean {
    return this.#outcome === CombatOutcome.Active;
  }
  get roundTimeCharged(): boolean {
    return this.#roundTimeCharged;
  }

  recordVisualContact(): void {
    if (!this.active) {
      return;
    }
    this.#contactThisRound = true;
    this.#quietRounds = 0;
  }

  beginEnemyPhase(): void {
    this.#changePhase(CombatPhase.Enemy);
  }
  beginPlayerPhase(): void {
    this.#changePhase(CombatPhase.Player);
  }
  openPlayerInterrupt(): void {
    this.#changePhase(CombatPhase.Interrupt);
  }
  #changePhase(phase: CombatPhaseValue): void {
    if (!this.active) {
      throw new CombatRefusal(CombatRefusalCode.CombatAlreadyCompleted);
    }
    this.#phase = phase;
  }

  chargeRoundTime(): boolean {
    if (this.#roundTimeCharged) {
      return false;
    }
    this.#roundTimeCharged = true;
    return true;
  }

  finishRound(visualContact: boolean): void {
    if (!this.active) {
      throw new CombatRefusal(CombatRefusalCode.CombatAlreadyCompleted);
    }
    this.#quietRounds =
      visualContact || this.#contactThisRound
        ? 0
        : Math.min(QuietRoundsBeforeExploration, this.#quietRounds + 1);
    this.#contactThisRound = false;
    this.#round++;
    this.#phase = CombatPhase.Player;
    this.#roundTimeCharged = false;
  }

  allowsExploration(eligibility: ExplorationEligibility): boolean {
    if (this.#outcome === CombatOutcome.Victory) {
      return true;
    }
    return (
      this.active &&
      this.#phase === CombatPhase.Player &&
      !eligibility.visualContact &&
      !eligibility.automaticActionsPending &&
      !eligibility.routedParticipants &&
      this.#quietRounds >= QuietRoundsBeforeExploration
    );
  }

  finish(outcome: Exclude<CombatOutcomeValue, 'active'>): void {
    if (!Object.values(CombatOutcome).includes(outcome)) {
      throw new CombatRefusal(CombatRefusalCode.InvalidCombatSession);
    }
    if (!this.active && this.#outcome !== outcome) {
      throw new CombatRefusal(CombatRefusalCode.CombatAlreadyCompleted);
    }
    this.#outcome = outcome;
    this.#phase = CombatPhase.Player;
  }

  snapshot(): CombatSessionSnapshot {
    return {
      id: this.#id,
      round: this.#round,
      phase: this.#phase,
      outcome: this.#outcome,
      quietRounds: this.#quietRounds,
      contactThisRound: this.#contactThisRound,
      firstSide: this.#firstSide,
      roundTimeCharged: this.#roundTimeCharged,
    };
  }
}
