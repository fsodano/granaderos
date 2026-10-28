export type FormSquadRequest = Readonly<{
  characterIds: readonly string[];
  squadId?: string;
  name?: string;
  locationId?: string;
}>;
