import { RESIDENT_SCAVENGING_INTERVAL_SECONDS } from './resident-supplies.ts';
import { requireGameSecond } from './world-timeline.ts';

export const RESIDENT_ROUTINE_INTERVAL_SECONDS = 6;
export type ResidentRoutineSnapshot = Readonly<{
  startedAtSecond: number;
  advancedThroughSecond: number;
}>;

export class ResidentRoutine {
  #snapshot: ResidentRoutineSnapshot;

  constructor(snapshot: ResidentRoutineSnapshot) {
    requireGameSecond(snapshot.startedAtSecond);
    requireGameSecond(snapshot.advancedThroughSecond);
    if (snapshot.advancedThroughSecond < snapshot.startedAtSecond) {
      throw new Error('A resident routine cannot precede its start.');
    }
    this.#snapshot = Object.freeze({ ...snapshot });
  }

  advanceTo(
    targetSecond: number,
    performMovement: (atSecond: number) => void,
    performCollection: (atSecond: number) => void = () => {},
  ): void {
    requireGameSecond(targetSecond);
    if (targetSecond < this.#snapshot.advancedThroughSecond) {
      throw new Error('Resident movement time cannot move backwards.');
    }
    const completedIntervals = Math.floor(
      (this.#snapshot.advancedThroughSecond - this.#snapshot.startedAtSecond) /
        RESIDENT_ROUTINE_INTERVAL_SECONDS,
    );
    let nextMovement =
      this.#snapshot.startedAtSecond + (completedIntervals + 1) * RESIDENT_ROUTINE_INTERVAL_SECONDS;
    let nextCollection =
      (Math.floor(this.#snapshot.advancedThroughSecond / RESIDENT_SCAVENGING_INTERVAL_SECONDS) +
        1) *
      RESIDENT_SCAVENGING_INTERVAL_SECONDS;
    while (Math.min(nextMovement, nextCollection) <= targetSecond) {
      const atSecond = Math.min(nextMovement, nextCollection);
      if (nextMovement === atSecond) {
        performMovement(atSecond);
        nextMovement += RESIDENT_ROUTINE_INTERVAL_SECONDS;
      }
      if (nextCollection === atSecond) {
        performCollection(atSecond);
        nextCollection += RESIDENT_SCAVENGING_INTERVAL_SECONDS;
      }
      this.#snapshot = Object.freeze({ ...this.#snapshot, advancedThroughSecond: atSecond });
    }
    this.#snapshot = Object.freeze({ ...this.#snapshot, advancedThroughSecond: targetSecond });
  }

  toSnapshot(): ResidentRoutineSnapshot {
    return { ...this.#snapshot };
  }
}
