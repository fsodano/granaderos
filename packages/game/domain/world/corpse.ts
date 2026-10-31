import { ItemCustody, ItemCustodianKind } from './item-custody.ts';
import { requireGameSecond } from './world-timeline.ts';
import type { WorldEvent } from './world-timeline.ts';

export const CORPSE_REMOVAL_EVENT = 'corpse-removal';
export const DEFAULT_CORPSE_LIFETIME_SECONDS = 72 * 60 * 60;

export type CorpseSnapshot = Readonly<{
  id: string;
  characterId: string;
  sectorId: string;
  diedAtSecond: number;
  removalAtSecond: number;
  removedAtSecond: number | null;
}>;

export class CorpseRemovalPolicy {
  #lifetimeSeconds: number;

  constructor(lifetimeSeconds = DEFAULT_CORPSE_LIFETIME_SECONDS) {
    requireGameSecond(lifetimeSeconds);
    if (lifetimeSeconds === 0) {
      throw new Error('Corpse lifetime must be positive.');
    }
    this.#lifetimeSeconds = lifetimeSeconds;
  }

  removalAt(diedAtSecond: number): number {
    requireGameSecond(diedAtSecond);
    const removalAtSecond = diedAtSecond + this.#lifetimeSeconds;
    requireGameSecond(removalAtSecond);
    return removalAtSecond;
  }
}

export class Corpse {
  #snapshot: CorpseSnapshot;

  constructor(snapshot: CorpseSnapshot) {
    if (
      !snapshot ||
      ![snapshot.id, snapshot.characterId, snapshot.sectorId].every(
        (value) => typeof value === 'string' && value.length > 0,
      )
    ) {
      throw new Error('A corpse needs an identity, character, and sector.');
    }
    requireGameSecond(snapshot.diedAtSecond);
    requireGameSecond(snapshot.removalAtSecond);
    if (snapshot.removalAtSecond <= snapshot.diedAtSecond) {
      throw new Error('Corpse removal must follow death.');
    }
    if (snapshot.removedAtSecond !== null) {
      requireGameSecond(snapshot.removedAtSecond);
      if (snapshot.removedAtSecond !== snapshot.removalAtSecond) {
        throw new Error('Corpse removal must retain the scheduled time.');
      }
    }
    this.#snapshot = Object.freeze({ ...snapshot });
  }

  static recordDeath(
    characterId: string,
    sectorId: string,
    diedAtSecond: number,
    policy = new CorpseRemovalPolicy(),
  ): Corpse {
    return new Corpse({
      id: `${sectorId}:${characterId}:${diedAtSecond}`,
      characterId,
      sectorId,
      diedAtSecond,
      removalAtSecond: policy.removalAt(diedAtSecond),
      removedAtSecond: null,
    });
  }

  get id(): string {
    return this.#snapshot.id;
  }
  get characterId(): string {
    return this.#snapshot.characterId;
  }
  get isPresent(): boolean {
    return this.#snapshot.removedAtSecond === null;
  }

  removalEvent(): WorldEvent {
    return {
      id: `${CORPSE_REMOVAL_EVENT}:${this.id}`,
      kind: CORPSE_REMOVAL_EVENT,
      subjectId: this.id,
      atSecond: this.#snapshot.removalAtSecond,
    };
  }

  removeAt(currentSecond: number, equipment: readonly ItemCustody[]): readonly string[] {
    requireGameSecond(currentSecond);
    if (!this.isPresent) {
      throw new Error('A corpse cannot be removed twice.');
    }
    if (currentSecond < this.#snapshot.removalAtSecond) {
      throw new Error('The corpse removal time has not been reached.');
    }
    const owner = { kind: ItemCustodianKind.Corpse, id: this.id };
    const identities = new Set(equipment.map((item) => item.itemId));
    if (identities.size !== equipment.length || equipment.some((item) => !item.heldBy(owner))) {
      throw new Error('Corpse equipment must have unique and current custody.');
    }
    for (const item of equipment) {
      item.transferFrom(owner, { kind: ItemCustodianKind.Ground, id: this.#snapshot.sectorId });
    }
    this.#snapshot = Object.freeze({
      ...this.#snapshot,
      removedAtSecond: this.#snapshot.removalAtSecond,
    });
    return equipment.map((item) => item.itemId);
  }

  toSnapshot(): CorpseSnapshot {
    return { ...this.#snapshot };
  }
}
