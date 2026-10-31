import { Squad } from './squad.ts';
import { DomainRefusal, DomainRefusalCode } from '../shared/domain-refusal.ts';

export const RecruitmentAssignment = Object.freeze({ Squad: 'squad', Reserve: 'reserve' } as const);
export type RecruitmentAssignmentValue =
  (typeof RecruitmentAssignment)[keyof typeof RecruitmentAssignment];

export class ForceRoster {
  readonly #members: Set<string>;
  readonly #squad: Squad;
  readonly #squadLocationId: string;
  readonly #squadCapacity: number;

  constructor(
    members: readonly string[],
    squadMembers: readonly string[],
    squadLocationId: string,
    squadCapacity: number,
    squad?: Squad,
  ) {
    if (
      new Set(members).size !== members.length ||
      new Set(squadMembers).size !== squadMembers.length ||
      !Number.isSafeInteger(squadCapacity) ||
      squadCapacity <= 0 ||
      squadMembers.length > squadCapacity ||
      squadMembers.some((id) => !members.includes(id))
    ) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    this.#members = new Set(members);
    if (
      squad &&
      (squad.locationId !== squadLocationId ||
        JSON.stringify([...squad.memberIds].sort()) !== JSON.stringify([...squadMembers].sort()))
    ) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    this.#squad =
      squad ??
      new Squad({
        id: 'active-squad',
        name: 'Active squad',
        locationId: squadLocationId,
        memberIds: squadMembers,
        membershipLocked: false,
      });
    this.#squadLocationId = squadLocationId;
    this.#squadCapacity = squadCapacity;
  }

  assertCanAdmit(characterId: string): void {
    if (this.#members.has(characterId)) {
      throw new DomainRefusal(DomainRefusalCode.AlreadyServing);
    }
  }

  admit(characterId: string, locationId: string, joinSquad = true): RecruitmentAssignmentValue {
    this.assertCanAdmit(characterId);
    if (
      joinSquad &&
      locationId === this.#squadLocationId &&
      this.#squad.memberIds.length < this.#squadCapacity
    ) {
      this.#squad.admitRecruitedMember(characterId);
      this.#members.add(characterId);
      return RecruitmentAssignment.Squad;
    }
    this.#members.add(characterId);
    return RecruitmentAssignment.Reserve;
  }

  release(characterId: string): void {
    if (!this.#members.has(characterId)) {
      throw new DomainRefusal(DomainRefusalCode.NotServing);
    }
    this.#members.delete(characterId);
    this.#squad.releaseMember(characterId);
  }

  get members(): readonly string[] {
    return [...this.#members];
  }
  get squadMembers(): readonly string[] {
    return this.#squad.memberIds;
  }
}
