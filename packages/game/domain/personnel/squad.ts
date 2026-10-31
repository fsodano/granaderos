import { DomainRefusal, DomainRefusalCode } from '../shared/domain-refusal.ts';

export const SquadRules = Object.freeze({
  MaximumMembers: 6,
  MaximumSquads: 8,
  MinimumNameLength: 2,
  MaximumNameLength: 30,
});
export type SquadSnapshot = Readonly<{
  id: string;
  name: string;
  locationId: string;
  memberIds: readonly string[];
  membershipLocked: boolean;
}>;

export class Squad {
  readonly #id: string;
  readonly #name: string;
  readonly #locationId: string;
  readonly #membershipLocked: boolean;
  #memberIds: string[];

  constructor(snapshot: SquadSnapshot) {
    if (
      !snapshot.id ||
      !snapshot.locationId ||
      !snapshot.name ||
      snapshot.memberIds.length > SquadRules.MaximumMembers ||
      new Set(snapshot.memberIds).size !== snapshot.memberIds.length ||
      snapshot.memberIds.some((id) => !id)
    ) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    this.#id = snapshot.id;
    this.#name = snapshot.name;
    this.#locationId = snapshot.locationId;
    this.#membershipLocked = snapshot.membershipLocked;
    this.#memberIds = [...snapshot.memberIds];
  }

  static form(id: string, name: string, locationId: string): Squad {
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (
      trimmedName.length < SquadRules.MinimumNameLength ||
      trimmedName.length > SquadRules.MaximumNameLength ||
      /[<>]/.test(trimmedName)
    ) {
      throw new DomainRefusal(DomainRefusalCode.InvalidSquadName);
    }
    return new Squad({ id, name: trimmedName, locationId, memberIds: [], membershipLocked: false });
  }

  get id(): string {
    return this.#id;
  }
  get locationId(): string {
    return this.#locationId;
  }
  get memberIds(): readonly string[] {
    return [...this.#memberIds];
  }
  get vacant(): boolean {
    return !this.#memberIds.length && !this.#membershipLocked;
  }

  assertCanReorganize(): void {
    if (this.#membershipLocked) {
      throw new DomainRefusal(DomainRefusalCode.SquadUnavailable);
    }
  }

  replaceMembers(memberIds: readonly string[]): void {
    this.assertCanReorganize();
    if (
      memberIds.length > SquadRules.MaximumMembers ||
      new Set(memberIds).size !== memberIds.length ||
      memberIds.some((id) => !id)
    ) {
      throw new DomainRefusal(DomainRefusalCode.InvalidSquadMembers);
    }
    this.#memberIds = [...memberIds];
  }

  admitRecruitedMember(characterId: string): void {
    if (
      !characterId ||
      this.#memberIds.includes(characterId) ||
      this.#memberIds.length >= SquadRules.MaximumMembers
    ) {
      throw new DomainRefusal(DomainRefusalCode.InvalidSquadMembers);
    }
    this.#memberIds.push(characterId);
  }

  releaseMember(characterId: string): void {
    this.#memberIds = this.#memberIds.filter((id) => id !== characterId);
  }

  toSnapshot(): SquadSnapshot {
    return {
      id: this.#id,
      name: this.#name,
      locationId: this.#locationId,
      memberIds: this.memberIds,
      membershipLocked: this.#membershipLocked,
    };
  }
}
