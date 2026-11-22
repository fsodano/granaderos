import type { CampaignSnapshot } from './campaign-types.ts';
import type { BattleSnapshot } from './compatibility-types.ts';

export type GameSnapshotMapping = Readonly<{
  version: number;
  sessionId: string;
  revision: number;
}>;

export type GameSnapshotContent = Readonly<{
  campaign: CampaignSnapshot;
  battle: BattleSnapshot | null;
}>;

export interface GameSnapshot extends GameSnapshotContent {
  readonly format: 'granaderos';
  readonly schema: 1 | 2;
  readonly savedAt: string;
  readonly mapping?: GameSnapshotMapping;
}
