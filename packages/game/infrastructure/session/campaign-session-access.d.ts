import type { CampaignSuspendedSectorSession } from '../../public/campaign-types.ts';

export type SectorEntryRecord = {
  id: string;
  sector: string;
  sceneId?: string | null;
  squad: ReadonlyArray<{ id: string | number }>;
};

/** The fields these accessors read from a suspended visit, derived from the saved record. */
export type SuspendedSectorSessionRecord = Pick<
  CampaignSuspendedSectorSession,
  'request' | 'snapshot'
>;

export type CampaignSessionAccessSnapshot = {
  sectorEntryRequest?: SectorEntryRecord | null;
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
