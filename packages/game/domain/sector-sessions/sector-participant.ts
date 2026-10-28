import {
  ActionPoints,
  ActionPointRules,
  CombatRefusal,
  CombatRefusalCode,
} from '../combat/action-points.ts';

export type SectorParticipantSnapshot = Readonly<{
  characterId: string;
  actionPoints: number;
  maximumActionPoints: number;
  carriedActionPoints: number;
}>;

export class SectorParticipant {
  readonly #characterId: string;
  #actionPoints: ActionPoints;
  #maximumActionPoints: number;
  #carriedActionPoints: number;

  private constructor(snapshot: SectorParticipantSnapshot) {
    if (
      typeof snapshot.characterId !== 'string' ||
      !snapshot.characterId ||
      !Number.isSafeInteger(snapshot.maximumActionPoints) ||
      snapshot.maximumActionPoints < 0 ||
      !Number.isSafeInteger(snapshot.carriedActionPoints) ||
      snapshot.carriedActionPoints < 0 ||
      snapshot.carriedActionPoints > ActionPointRules.CarryLimit
    ) {
      throw new CombatRefusal(CombatRefusalCode.InvalidParticipant);
    }
    this.#characterId = snapshot.characterId;
    this.#actionPoints = ActionPoints.of(snapshot.actionPoints);
    this.#maximumActionPoints = snapshot.maximumActionPoints;
    this.#carriedActionPoints = snapshot.carriedActionPoints;
  }

  static restore(snapshot: SectorParticipantSnapshot): SectorParticipant {
    return new SectorParticipant(snapshot);
  }
  get characterId(): string {
    return this.#characterId;
  }
  get actionPoints(): number {
    return this.#actionPoints.amount;
  }
  canSpend(cost: number): boolean {
    return this.#actionPoints.canSpend(cost);
  }
  spend(cost: number): void {
    this.#actionPoints = this.#actionPoints.spend(cost);
  }
  lose(amount: number): void {
    this.#actionPoints = this.#actionPoints.lose(amount);
  }

  beginEncounter(base: number): void {
    const points = ActionPoints.of(base);
    this.#maximumActionPoints = base;
    this.#carriedActionPoints = 0;
    this.#actionPoints = points;
  }

  beginTurn(base: number): void {
    ActionPoints.of(base);
    this.#maximumActionPoints = base;
    this.#carriedActionPoints = base > 0 ? this.#actionPoints.carryToNextTurn() : 0;
    this.#actionPoints = ActionPoints.of(base + this.#carriedActionPoints);
  }

  becomeUnableToAct(): void {
    this.#actionPoints = ActionPoints.of(0);
    this.#maximumActionPoints = 0;
    this.#carriedActionPoints = 0;
  }

  snapshot(): SectorParticipantSnapshot {
    return {
      characterId: this.#characterId,
      actionPoints: this.#actionPoints.amount,
      maximumActionPoints: this.#maximumActionPoints,
      carriedActionPoints: this.#carriedActionPoints,
    };
  }
}
