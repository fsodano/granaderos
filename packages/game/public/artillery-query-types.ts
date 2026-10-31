import type { CampaignArtillery, CampaignAction } from './campaign-types.ts';
export type ArtillerySaleOffer =
  | { kind: 'stock'; model: string; stockCount: number }
  | { kind: 'depot'; artilleryId: string }
  | { kind: 'field'; sector: string; artilleryId: string };
export type ArtilleryTradeAction =
  | {
      type: 'sellArtillery';
      sector: string;
      sourceKind: 'stock';
      stockType: string;
      expectedCount: number;
    }
  | { type: 'sellArtillery'; sector: string; sourceKind: 'deployed'; gunId: string | null }
  | { type: 'purchaseUsedArtillery' | 'sellArtillery'; sector: string; gunId: string | null };
export type ArtilleryTradeGun = Omit<CampaignArtillery, 'id'> & { id: string | null };
export type ArtillerySaleQuote = {
  available: boolean;
  reason: string;
  price: number;
  gun: CampaignArtillery | { type: string } | null | undefined;
};
export type ArtilleryTradePreview = Omit<ArtillerySaleQuote, 'gun'> & {
  valid: boolean;
  gun: ArtilleryTradeGun | null | undefined;
  count: number;
  action: ArtilleryTradeAction;
};
export type ArtilleryMerchant = { cash: number; guns: CampaignArtillery[] };
export type ArtilleryStorageQuote = {
  available: boolean;
  reason: string;
  sector: string;
  from: string;
  gun: CampaignArtillery | undefined;
  crew: number;
};
export type ArtilleryTransportQuote = {
  available: boolean;
  reason: string;
  from: string;
  to: string;
  mode: string;
  path: string[] | null;
  cost: number;
  hours: number;
  crew: number;
  weight: number;
  capacity: number;
};
export type ArtilleryOrder =
  | ArtilleryTradeAction
  | ({ type: 'sellArtillery' } & ArtillerySaleOffer)
  | Extract<CampaignAction, { type: 'transportArtillery' }>;
