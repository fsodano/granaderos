export type TalkToCharacterResponse<TCampaign, TSectorSession> = Readonly<{
  campaign: TCampaign;
  sectorSession: TSectorSession;
}>;
