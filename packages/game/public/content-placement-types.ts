import type { CampaignContent } from '../../campaign-format/types.ts';
import type { ResidentPresenceSnapshot } from '../domain/world/resident-presence.ts';

export type ContentPersonStatus = 'dead' | 'recruited' | 'released';
export type ContentPlacementCommand =
  | { type: 'advance'; minute: number; loadedSector: string | null }
  | { type: 'status'; id: string; status: ContentPersonStatus };
export type ContentPlacementSession = {
  version: 1;
  content: CampaignContent;
  rng: number;
  initialSeed: number;
  history: ContentPlacementCommand[];
  minute: number;
  nextDaily: number;
  people: Record<string, ResidentPresenceSnapshot>;
  events: { placement: string; at: number; destination?: string }[];
  receipts: { placement: string; trigger: string; minute: number; at: number }[];
};

export type ContentPlacementState = Pick<
  ContentPlacementSession,
  'content' | 'rng' | 'minute' | 'nextDaily' | 'people' | 'events' | 'receipts'
>;
