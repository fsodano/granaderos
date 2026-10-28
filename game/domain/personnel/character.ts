import { Health } from './health.ts';
import { CharacterAbilities, type CharacterAbilitiesSnapshot } from './character-abilities.ts';
import { DomainRefusal, DomainRefusalCode } from '../shared/domain-refusal.ts';
import { ServiceContract } from './service-contract.ts';

export type CharacterSnapshot = Readonly<{
  id: string;
  health: number;
  maximumHealth: number;
  alive: boolean;
  captured: boolean;
  bleeding?: number;
  bandaged?: number;
  locationId: string | null;
  abilities?: CharacterAbilitiesSnapshot;
}>;

export class Character {
  readonly #id: string;
  readonly #health: Health;
  readonly #abilities: CharacterAbilities;
  readonly #captured: boolean;
  #locationId: string | null;
  #service: ServiceContract | null;

  private constructor(snapshot: CharacterSnapshot, service: ServiceContract | null) {
    if (
      !snapshot.id ||
      !Number.isFinite(snapshot.health) ||
      !Number.isFinite(snapshot.maximumHealth) ||
      snapshot.maximumHealth <= 0 ||
      snapshot.health < 0 ||
      snapshot.health > snapshot.maximumHealth ||
      snapshot.alive !== snapshot.health > 0 ||
      (service && service.characterId !== snapshot.id)
    ) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    this.#id = snapshot.id;
    this.#health = new Health({
      current: snapshot.health,
      maximum: snapshot.maximumHealth,
      bleeding: snapshot.bleeding ?? 0,
      bandaged:
        snapshot.bandaged ?? (snapshot.bleeding ? 0 : snapshot.maximumHealth - snapshot.health),
    });
    this.#abilities = snapshot.abilities
      ? new CharacterAbilities(snapshot.abilities)
      : CharacterAbilities.empty();
    this.#captured = snapshot.captured;
    this.#locationId = snapshot.locationId;
    this.#service = service;
  }

  static restore(snapshot: CharacterSnapshot, service: ServiceContract | null = null): Character {
    return new Character(snapshot, service);
  }

  get id(): string {
    return this.#id;
  }
  get health(): Health {
    return this.#health;
  }
  get abilities(): CharacterAbilities {
    return this.#abilities;
  }
  get locationId(): string | null {
    return this.#locationId;
  }
  get service(): ServiceContract | null {
    return this.#service;
  }

  assertAvailableForService(): void {
    if (!this.#health.alive || this.#captured)
      throw new DomainRefusal(DomainRefusalCode.CharacterUnavailable);
    if (this.#service) throw new DomainRefusal(DomainRefusalCode.AlreadyServing);
  }

  beginService(contract: ServiceContract, locationId: string): void {
    this.assertAvailableForService();
    if (contract.characterId !== this.#id || !locationId) {
      throw new DomainRefusal(DomainRefusalCode.InvalidPlacement);
    }
    this.#service = contract;
    this.#locationId = locationId;
  }

  renewService(contract: ServiceContract): void {
    if (!this.#service) throw new DomainRefusal(DomainRefusalCode.NotServing);
    if (!this.#health.alive) throw new DomainRefusal(DomainRefusalCode.CharacterUnavailable);
    if (contract.characterId !== this.#id) throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    this.#service = contract;
  }

  endService(): ServiceContract {
    if (!this.#service) throw new DomainRefusal(DomainRefusalCode.NotServing);
    const ended = this.#service;
    this.#service = null;
    return ended;
  }

  snapshot(): CharacterSnapshot {
    return {
      id: this.#id,
      health: this.#health.toSnapshot().current,
      maximumHealth: this.#health.toSnapshot().maximum,
      alive: this.#health.alive,
      bleeding: this.#health.toSnapshot().bleeding,
      bandaged: this.#health.toSnapshot().bandaged,
      captured: this.#captured,
      locationId: this.#locationId,
      abilities: this.#abilities.toSnapshot(),
    };
  }
}
