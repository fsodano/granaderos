import { isArrayValue } from '../shared/array-value.ts';
import { ItemCustodianKind } from './item-custody.ts';
import type { ItemCustody } from './item-custody.ts';

export type SectorPosition = Readonly<{ x: number; y: number; level: number }>;
export type SectorEnvironment = Readonly<{ width: number; height: number }>;
export type SectorCharacterReference = Readonly<{
  characterId: string;
  localId: string;
  custodianId: string;
  position: SectorPosition;
  alive: boolean;
}>;
export type SectorCorpseReference = Readonly<{
  id: string;
  characterId: string;
  localId: string;
  position: SectorPosition;
  itemIds: readonly string[];
}>;
export type SectorObjectReference = Readonly<{
  id: string;
  custodianId: string;
  position: SectorPosition;
  itemIds: readonly string[];
}>;
export type SectorSnapshot = Readonly<{
  id: string;
  environment: SectorEnvironment;
  residents: readonly SectorCharacterReference[];
  participants: readonly SectorCharacterReference[];
  corpses: readonly SectorCorpseReference[];
  objects: readonly SectorObjectReference[];
  removedCharacterIds: readonly string[];
}>;

function requireIdentity(value: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('A sector reference requires an identity.');
  }
}

export class Sector {
  readonly #id: string;
  readonly #environment: SectorEnvironment;
  #residents = new Map<string, SectorCharacterReference>();
  #participants = new Map<string, SectorCharacterReference>();
  #corpses = new Map<string, SectorCorpseReference>();
  #objects = new Map<string, SectorObjectReference>();
  #removedCharacterIds: Set<string>;

  constructor(snapshot: SectorSnapshot) {
    requireIdentity(snapshot.id);
    if (
      ![snapshot.environment.width, snapshot.environment.height].every(
        (value) => Number.isSafeInteger(value) && value > 0,
      )
    ) {
      throw new Error('Sector dimensions must be positive integers.');
    }
    this.#id = snapshot.id;
    this.#environment = Object.freeze({ ...snapshot.environment });
    this.#removedCharacterIds = new Set(snapshot.removedCharacterIds);
    if (this.#removedCharacterIds.size !== snapshot.removedCharacterIds.length) {
      throw new Error('A removed character cannot appear twice.');
    }
    for (const id of this.#removedCharacterIds) {
      requireIdentity(id);
    }
    for (const resident of snapshot.residents) {
      this.admitResident(resident);
    }
    for (const participant of snapshot.participants) {
      this.admitParticipant(participant);
    }
    for (const corpse of snapshot.corpses) {
      this.admitCorpse(corpse);
    }
    for (const object of snapshot.objects) {
      this.admitObject(object);
    }
  }

  get id(): string {
    return this.#id;
  }

  admitResident(resident: SectorCharacterReference): void {
    this.#admitCharacter(resident, this.#residents);
  }

  admitParticipant(participant: SectorCharacterReference): void {
    this.#admitCharacter(participant, this.#participants);
  }

  #admitCharacter(
    reference: SectorCharacterReference,
    members: Map<string, SectorCharacterReference>,
  ): void {
    for (const id of [reference.characterId, reference.localId, reference.custodianId]) {
      requireIdentity(id);
    }
    this.#requirePosition(reference.position);
    if (reference.custodianId !== reference.characterId) {
      throw new Error('A sector character must retain its canonical inventory custodian.');
    }
    if (
      typeof reference.alive !== 'boolean' ||
      this.#residents.has(reference.characterId) ||
      this.#participants.has(reference.characterId) ||
      this.#removedCharacterIds.has(reference.characterId)
    ) {
      throw new Error('A character can have only one physical presence in a sector.');
    }
    members.set(reference.characterId, structuredClone(reference));
  }

  replaceResidents(residents: readonly SectorCharacterReference[]): void {
    const next = new Sector({ ...this.toSnapshot(), residents });
    this.#residents = next.#residents;
  }

  moveResident(characterId: string, position: SectorPosition, expectedCustodianId: string): void {
    const resident = this.#resident(characterId, expectedCustodianId);
    this.#requirePosition(position);
    this.#residents.set(characterId, { ...resident, position: { ...position } });
  }

  transferResidentTo(
    destination: Sector,
    characterId: string,
    position: SectorPosition,
    expectedCustodianId: string,
  ): void {
    if (destination.id === this.id) {
      throw new Error('A resident sector transfer requires another sector.');
    }
    const resident = this.#resident(characterId, expectedCustodianId);
    const nextDestination = new Sector(destination.toSnapshot());
    nextDestination.admitResident({ ...resident, position });
    this.#residents.delete(characterId);
    destination.#residents = nextDestination.#residents;
  }

  #resident(characterId: string, expectedCustodianId: string): SectorCharacterReference {
    const resident = this.#residents.get(characterId);
    if (!resident || !resident.alive || resident.custodianId !== expectedCustodianId) {
      throw new Error('The resident is absent, dead, or has different custody.');
    }
    return resident;
  }

  admitCorpse(corpse: SectorCorpseReference): void {
    for (const id of [corpse.id, corpse.characterId, corpse.localId]) {
      requireIdentity(id);
    }
    this.#requirePosition(corpse.position);
    this.#requireItemIds(corpse.itemIds);
    const character =
      this.#residents.get(corpse.characterId) ?? this.#participants.get(corpse.characterId);
    if (
      !character ||
      character.alive ||
      character.localId !== corpse.localId ||
      this.#corpses.has(corpse.id) ||
      [...this.#corpses.values()].some((current) => current.characterId === corpse.characterId)
    ) {
      throw new Error('A corpse requires one present dead character.');
    }
    this.#corpses.set(corpse.id, structuredClone(corpse));
  }

  admitObject(object: SectorObjectReference): void {
    requireIdentity(object.id);
    requireIdentity(object.custodianId);
    this.#requirePosition(object.position);
    this.#requireItemIds(object.itemIds);
    const heldItems = new Set([...this.#objects.values()].flatMap((current) => current.itemIds));
    if (this.#objects.has(object.id) || object.itemIds.some((id) => heldItems.has(id))) {
      throw new Error('A sector object or item reference cannot occur twice.');
    }
    this.#objects.set(object.id, structuredClone(object));
  }

  removeCorpse(
    corpseId: string,
    releasedEquipment: readonly ItemCustody[],
    recoveredObjects: readonly SectorObjectReference[],
  ): void {
    const corpse = this.#corpses.get(corpseId);
    if (!corpse) {
      throw new Error('The corpse is no longer present in this sector.');
    }
    const releasedIds = new Set(releasedEquipment.map((item) => item.itemId));
    const ground = { kind: ItemCustodianKind.Ground, id: this.id };
    const recoveredIds = recoveredObjects.flatMap((object) => object.itemIds);
    if (
      releasedIds.size !== releasedEquipment.length ||
      releasedIds.size !== corpse.itemIds.length ||
      corpse.itemIds.some((id) => !releasedIds.has(id)) ||
      releasedEquipment.some((item) => !item.heldBy(ground)) ||
      recoveredIds.length !== releasedIds.size ||
      new Set(recoveredIds).size !== releasedIds.size ||
      recoveredIds.some((id) => !releasedIds.has(id)) ||
      recoveredObjects.some((object) => object.custodianId !== `ground:${this.id}`)
    ) {
      throw new Error('Corpse removal must settle each remaining item into this sector ground.');
    }
    const next = new Sector(this.toSnapshot());
    for (const object of recoveredObjects) {
      next.admitObject(object);
    }
    next.#corpses.delete(corpseId);
    next.#residents.delete(corpse.characterId);
    next.#participants.delete(corpse.characterId);
    next.#removedCharacterIds.add(corpse.characterId);
    this.#corpses = next.#corpses;
    this.#objects = next.#objects;
    this.#residents = next.#residents;
    this.#participants = next.#participants;
    this.#removedCharacterIds = next.#removedCharacterIds;
  }

  #requirePosition(position: SectorPosition): void {
    if (
      !position ||
      ![position.x, position.y, position.level].every(Number.isSafeInteger) ||
      position.x < 0 ||
      position.y < 0 ||
      position.level < 0 ||
      position.x >= this.#environment.width ||
      position.y >= this.#environment.height
    ) {
      throw new Error('The position must belong to this sector environment.');
    }
  }

  #requireItemIds(itemIds: readonly string[]): void {
    if (!isArrayValue(itemIds) || new Set(itemIds).size !== itemIds.length) {
      throw new Error('Sector item references must be unique.');
    }
    for (const id of itemIds) {
      requireIdentity(id);
    }
  }

  toSnapshot(): SectorSnapshot {
    return structuredClone({
      id: this.id,
      environment: this.#environment,
      residents: [...this.#residents.values()],
      participants: [...this.#participants.values()],
      corpses: [...this.#corpses.values()],
      objects: [...this.#objects.values()],
      removedCharacterIds: [...this.#removedCharacterIds],
    });
  }
}
