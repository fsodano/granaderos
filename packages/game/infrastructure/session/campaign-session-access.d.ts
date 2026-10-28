export type SectorEntryRecord = {
  id: string;
  sector: string;
  sceneId?: string | null;
  squad: ReadonlyArray<{ id: string | number }>;
};

export type SuspendedSectorSessionRecord = {
  request: SectorEntryRecord;
  snapshot: unknown;
};

export type CampaignSessionAccessSnapshot = {
  pendingBattle?: SectorEntryRecord | null;
  suspendedSectorSessions?: readonly SuspendedSectorSessionRecord[];
};

export function openSectorEntryRequests(
  campaign: CampaignSessionAccessSnapshot,
): SectorEntryRecord[];
export function isCharacterDeployed(
  campaign: CampaignSessionAccessSnapshot,
  characterId: string | number,
): boolean;
export function suspendedSectorSessionFor(
  campaign: CampaignSessionAccessSnapshot,
  sectorId: string,
): SuspendedSectorSessionRecord | undefined;
