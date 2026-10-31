import type {
  BattleBody,
  TacticalAction,
} from '../../../packages/game/public/compatibility-types.ts';

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}
export type {
  TacticalPointer,
  ActionPreview,
  BayonetSource,
  AttachedBayonet,
  EnvironmentTarget,
  EnvironmentContent,
} from '../../../packages/game/public/hud-types.ts';
export type { InventoryMapPreview } from '../../../packages/game/public/inventory-types.ts';
export interface BandageReport {
  stoppedReason: string | null;
  treatedIds: string[];
  steps: TacticalAction[];
  untreated: { id: string; name: string; reason: string }[];
  elapsedSeconds: number;
}
export type ScenePerson = BattleBody & {
  nickname?: string;
  routed?: boolean;
  surrendered?: boolean;
  ai?: { activity?: string };
};
