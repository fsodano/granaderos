import { DomainRefusal, DomainRefusalCode } from '../shared/domain-refusal.ts';
import { Squad, SquadRules } from './squad.ts';

export type SquadMemberAvailability = Readonly<{
  characterId: string;
  locationId: string;
  available: boolean;
}>;
export type SquadFormation = Readonly<{
  target: Squad;
  squads: readonly Squad[];
  discardedSquadId: string | null;
}>;

export class SquadFormationService {
  form(
    squads: readonly Squad[],
    target: Squad,
    selectedIds: readonly string[],
    candidates: readonly SquadMemberAvailability[],
  ): SquadFormation {
    target.assertCanReorganize();
    if (
      !selectedIds.length ||
      selectedIds.length > SquadRules.MaximumMembers ||
      new Set(selectedIds).size !== selectedIds.length
    ) {
      throw new DomainRefusal(DomainRefusalCode.InvalidSquadMembers);
    }
    for (const id of selectedIds) {
      const candidate = candidates.find((candidate) => candidate.characterId === id);
      if (!candidate?.available) {
        throw new DomainRefusal(DomainRefusalCode.CharacterUnavailable);
      }
      if (candidate.locationId !== target.locationId) {
        throw new DomainRefusal(DomainRefusalCode.SquadLocationMismatch);
      }
    }
    const existing = squads.find((squad) => squad.id === target.id);
    if (existing && existing !== target) {
      throw new DomainRefusal(DomainRefusalCode.InvalidValue);
    }
    const discarded =
      !existing && squads.length >= SquadRules.MaximumSquads
        ? squads.find((squad) => squad.vacant)
        : undefined;
    if (!existing && squads.length >= SquadRules.MaximumSquads && !discarded) {
      throw new DomainRefusal(DomainRefusalCode.TooManySquads);
    }
    const affected = squads.filter(
      (squad) => squad !== target && squad.memberIds.some((id) => selectedIds.includes(id)),
    );
    for (const squad of affected) {
      squad.assertCanReorganize();
    }
    for (const squad of affected) {
      squad.replaceMembers(squad.memberIds.filter((id) => !selectedIds.includes(id)));
    }
    target.replaceMembers(selectedIds);
    return {
      target,
      squads: [...squads.filter((squad) => squad !== discarded), ...(!existing ? [target] : [])],
      discardedSquadId: discarded?.id ?? null,
    };
  }
}
