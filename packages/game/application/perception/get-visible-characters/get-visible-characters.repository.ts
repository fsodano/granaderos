export type CharacterVisibility = Readonly<{ characterId: string; visible: boolean }>;
export interface GetVisibleCharactersRepository {
  inspect(): Iterable<CharacterVisibility>;
}
