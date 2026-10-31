import type {
  CampaignContent,
  DialogueChoice,
  DialogueCondition,
  JsonObject,
} from '../../campaign-format/types.ts';
import type { CampaignAction, CampaignOperative, CampaignSnapshot } from './campaign-types.ts';
import type { BattleNpc, BattleSnapshot, TacticalAction } from './compatibility-types.ts';
import type { DialogueView } from './hud-types.ts';

export interface CampaignSandboxSetup {
  startingTreasury?: number;
  startingTerritory?: CampaignContent['startingTerritory'];
}
export type CampaignSandboxAction =
  | CampaignAction
  | { type: 'enter'; sector?: string }
  | { type: 'finish' }
  | { type: 'leave' }
  | { type: 'approach'; unitId: string; npcId: string }
  | {
      type: 'talk';
      unitId: string;
      npcId: string;
      approach?: string;
      term?: string;
      node?: string;
      choice?: string;
      questResolution?: 'cash' | 'civic';
      questWithdrawal?: { questId: string; beneficiaryId?: string; deliveredCount: number };
    }
  | { type: 'tactical'; order: TacticalAction | { type: 'endTurn' } };
export interface CampaignSandboxHistoryEntry {
  action: JsonObject & { type: string };
  hour: number;
  second: number;
  treasury: number;
}
export interface CampaignSandbox {
  version: 1;
  seed: number;
  setup: CampaignSandboxSetup;
  sourceIdentity: { version: number; packageId: string; formatVersion: number; hash: string };
  campaign: CampaignSnapshot;
  battle: BattleSnapshot | null;
  history: CampaignSandboxHistoryEntry[];
  lastError: string | null;
}
export interface CampaignSandboxDialogue {
  npc: BattleNpc;
  dialogue: DialogueView;
  choices: {
    choice: DialogueChoice;
    conditions: { condition: DialogueCondition; met: boolean }[];
    available: DialogueView['choices'][number] | null;
  }[];
}
export type CampaignSandboxActor = CampaignOperative;
