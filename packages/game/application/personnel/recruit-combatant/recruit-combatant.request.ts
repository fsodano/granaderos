export type RecruitCombatantRequest = Readonly<{
  characterId: string;
  term: string;
  locationId?: string;
}>;
