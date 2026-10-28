import type { RecruitmentAssignmentValue } from '../../../domain/personnel/force-roster.ts';

export type RecruitCombatantResponse = Readonly<{
  characterId: string;
  locationId: string;
  assignment: RecruitmentAssignmentValue;
  paidPesos: number;
  serviceEndsAtSeconds: number | null;
}>;
