export type SectorEntryRequest = Readonly<{
  sessionId: string;
  sectorId: string;
  participantIds: readonly string[];
  deploymentRequired: boolean;
}>;
