export type ResidentPresenceSnapshot = Readonly<{
  alive: boolean;
  recruited: boolean;
  suspended: boolean;
  appeared: boolean;
  revision: number;
  sector: string | null;
  hp: number;
}>;

export class ResidentPresence {
  #snapshot: ResidentPresenceSnapshot;

  constructor(snapshot: ResidentPresenceSnapshot) {
    if (
      !Number.isSafeInteger(snapshot.revision) ||
      snapshot.revision < 0 ||
      !Number.isFinite(snapshot.hp) ||
      snapshot.hp < 0
    ) {
      throw new Error('Resident presence has invalid health or revision.');
    }
    if (!snapshot.alive && (snapshot.hp !== 0 || snapshot.sector !== null)) {
      throw new Error('A dead resident cannot occupy a living placement.');
    }
    this.#snapshot = Object.freeze({ ...snapshot });
  }

  get canAppear(): boolean {
    return this.#snapshot.alive && !this.#snapshot.recruited && !this.#snapshot.suspended;
  }

  get canMove(): boolean {
    return this.canAppear && this.#snapshot.appeared;
  }

  get sector(): string | null {
    return this.#snapshot.sector;
  }

  arriveAt(sector: string): void {
    if (!sector || !this.canAppear) {
      throw new Error('The resident cannot arrive at this placement.');
    }
    this.#snapshot = Object.freeze({
      ...this.#snapshot,
      sector,
      appeared: true,
      revision: this.#snapshot.revision + 1,
    });
  }

  moveTo(sector: string): void {
    if (!this.canMove || !sector) {
      throw new Error('The resident cannot move from the current placement.');
    }
    if (this.#snapshot.sector === sector) {
      return;
    }
    this.#snapshot = Object.freeze({
      ...this.#snapshot,
      sector,
      revision: this.#snapshot.revision + 1,
    });
  }

  recordDeath(): void {
    this.#snapshot = Object.freeze({ ...this.#snapshot, alive: false, hp: 0, sector: null });
  }

  changeService(recruited: boolean): void {
    if (!this.#snapshot.alive) {
      throw new Error('A dead resident cannot change service.');
    }
    this.#snapshot = Object.freeze({ ...this.#snapshot, recruited });
  }

  toSnapshot(): ResidentPresenceSnapshot {
    return { ...this.#snapshot };
  }
}

export class ResidentMovementPolicy {
  chooseDestination(
    resident: ResidentPresence,
    sectors: readonly string[],
    chancePercent: number,
    selection: 'alternate' | 'random',
    random: () => number,
  ): string | null {
    if (
      !Number.isFinite(chancePercent) ||
      chancePercent < 0 ||
      chancePercent > 100 ||
      sectors.length === 0
    ) {
      throw new Error('Resident movement requires a valid probability and destinations.');
    }
    if (!resident.canMove) {
      return null;
    }
    const draw = (): number => {
      const value = random();
      if (!Number.isFinite(value) || value < 0 || value >= 1) {
        throw new Error('The world random source returned an invalid draw.');
      }
      return value;
    };
    if (draw() * 100 >= chancePercent) {
      return null;
    }
    const destination =
      selection === 'alternate'
        ? sectors.find((sector) => sector !== resident.sector)
        : sectors[Math.floor(draw() * sectors.length)];
    return destination && destination !== resident.sector ? destination : null;
  }
}
