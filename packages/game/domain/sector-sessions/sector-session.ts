import { CombatSession, CombatOutcome } from '../combat/combat-session.ts';
import type {
  CombatSessionSnapshot,
  CombatOutcomeValue,
  CombatSide,
  ExplorationEligibility,
} from '../combat/combat-session.ts';
import { CombatRefusal, CombatRefusalCode } from '../combat/action-points.ts';

export const SectorSessionMode = Object.freeze({
  Deployment: 'deployment',
  Exploration: 'exploration',
  Combat: 'combat',
} as const);
export type SectorSessionModeValue = (typeof SectorSessionMode)[keyof typeof SectorSessionMode];
export type CompletedCombatSession = Readonly<{
  id: string;
  outcome: CombatOutcomeValue;
  completedAtRound: number;
}>;
export type SectorSessionSnapshot = Readonly<{
  id: string;
  sectorId: string;
  mode: SectorSessionModeValue;
  combatSequence: number;
  combat?: CombatSessionSnapshot;
  completedCombatSessions: readonly CompletedCombatSession[];
  participantIds?: readonly string[];
  termination?: 'defeat' | 'retreat';
}>;

export class SectorSession {
  readonly #id: string;
  readonly #sectorId: string;
  #mode: SectorSessionModeValue;
  #combatSequence: number;
  #combat: CombatSession | undefined;
  #completedCombatSessions: CompletedCombatSession[];
  readonly #participantIds: Set<string>;
  #termination: 'defeat' | 'retreat' | undefined;

  private constructor(snapshot: SectorSessionSnapshot) {
    if (
      typeof snapshot.id !== 'string' ||
      !snapshot.id ||
      typeof snapshot.sectorId !== 'string' ||
      !snapshot.sectorId ||
      !Object.values(SectorSessionMode).includes(snapshot.mode) ||
      !Number.isSafeInteger(snapshot.combatSequence) ||
      snapshot.combatSequence < 0 ||
      (snapshot.mode === SectorSessionMode.Combat && !snapshot.combat) ||
      (snapshot.mode !== SectorSessionMode.Combat && snapshot.combat)
    ) {
      throw new CombatRefusal(CombatRefusalCode.InvalidCombatSession);
    }
    const participantIds = snapshot.participantIds ?? [];
    if (
      participantIds.some((id) => typeof id !== 'string' || !id) ||
      new Set(participantIds).size !== participantIds.length
    )
      throw new CombatRefusal(CombatRefusalCode.InvalidParticipant);
    if (snapshot.termination !== undefined && !['defeat', 'retreat'].includes(snapshot.termination))
      throw new CombatRefusal(CombatRefusalCode.InvalidCombatSession);
    this.#termination = snapshot.termination;
    this.#participantIds = new Set(participantIds);
    this.#id = snapshot.id;
    this.#sectorId = snapshot.sectorId;
    this.#mode = snapshot.mode;
    this.#combatSequence = snapshot.combatSequence;
    this.#combat = snapshot.combat ? CombatSession.restore(snapshot.combat) : undefined;
    this.#completedCombatSessions = snapshot.completedCombatSessions.map((receipt) => ({
      ...receipt,
    }));
  }

  static enter(id: string, sectorId: string, deploymentRequired: boolean): SectorSession {
    return new SectorSession({
      id,
      sectorId,
      mode: deploymentRequired ? SectorSessionMode.Deployment : SectorSessionMode.Exploration,
      combatSequence: 0,
      completedCombatSessions: [],
    });
  }
  static restore(snapshot: SectorSessionSnapshot): SectorSession {
    return new SectorSession(snapshot);
  }
  get id(): string {
    return this.#id;
  }
  get mode(): SectorSessionModeValue {
    return this.#mode;
  }
  get combat(): CombatSession | undefined {
    return this.#combat;
  }

  confirmDeployment(): void {
    if (this.#mode !== SectorSessionMode.Deployment)
      throw new CombatRefusal(CombatRefusalCode.InvalidCombatPhase);
    this.#mode = SectorSessionMode.Exploration;
  }

  startCombat(firstSide: CombatSide, round: number): CombatSession {
    if (this.#termination || this.#mode !== SectorSessionMode.Exploration || this.#combat)
      throw new CombatRefusal(CombatRefusalCode.InvalidCombatPhase);
    this.#combatSequence++;
    this.#combat = CombatSession.begin(
      `${this.#id}:combat:${this.#combatSequence}`,
      round,
      firstSide,
    );
    this.#mode = SectorSessionMode.Combat;
    return this.#combat;
  }

  resumeExploration(eligibility: ExplorationEligibility): void {
    if (!this.#combat || !this.#combat.allowsExploration(eligibility))
      throw new CombatRefusal(CombatRefusalCode.ContactPreventsExploration);
    if (this.#combat.active) this.#combat.finish(CombatOutcome.Disengaged);
    const completed = this.#combat.snapshot();
    this.#completedCombatSessions.push({
      id: completed.id,
      outcome: completed.outcome,
      completedAtRound: completed.round,
    });
    this.#combat = undefined;
    this.#mode = SectorSessionMode.Exploration;
  }

  conclude(outcome: 'defeat' | 'retreat'): void {
    if (this.#termination && this.#termination !== outcome)
      throw new CombatRefusal(CombatRefusalCode.CombatAlreadyCompleted);
    if (this.#combat) this.#combat.finish(outcome);
    this.#termination = outcome;
  }

  admitParticipants(characterIds: readonly string[]): void {
    if (
      !characterIds.length ||
      new Set(characterIds).size !== characterIds.length ||
      characterIds.some((id) => typeof id !== 'string' || !id || this.#participantIds.has(id))
    ) {
      throw new CombatRefusal(CombatRefusalCode.InvalidParticipant);
    }
    for (const id of characterIds) this.#participantIds.add(id);
  }

  snapshot(): SectorSessionSnapshot {
    return {
      id: this.#id,
      sectorId: this.#sectorId,
      mode: this.#mode,
      combatSequence: this.#combatSequence,
      participantIds: [...this.#participantIds],
      ...(this.#termination ? { termination: this.#termination } : {}),
      ...(this.#combat ? { combat: this.#combat.snapshot() } : {}),
      completedCombatSessions: this.#completedCombatSessions.map((receipt) => ({ ...receipt })),
    };
  }
}
