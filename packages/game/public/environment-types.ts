import type { BattleUnit, EquipmentItem } from './compatibility-types.ts';
export type EnvironmentVerb =
  | 'inspect'
  | 'open'
  | 'close'
  | 'unlock'
  | 'pick'
  | 'pry'
  | 'force'
  | 'disarm'
  | 'breach';
export type ToolKey = 'key' | 'lockpick' | 'crowbar' | 'pliers';
export interface ToolDefinition {
  toolKey: ToolKey;
  label: string;
  name: string;
  weight: number;
  verb: EnvironmentVerb;
  pa: number;
  wear: number;
}
export interface HeldTool extends ToolDefinition {
  item: string;
  inventoryKey: string;
  condition: number;
  keyId?: string;
}
export type EnvironmentItem = EquipmentItem & { item: string; count: number };
export interface EnvironmentTrap {
  type: 'alarm' | 'injury';
  difficulty: number;
  armed?: boolean;
  discoveredBy?: string[];
  damage?: number;
  breathLoss?: number;
}
export interface EnvironmentRecord {
  type: string;
  id?: string;
  doorId?: string;
  kind?: string;
  x?: number;
  y?: number;
  tacticalLevel?: number;
  axis?: 'x' | 'y';
  material?: string;
  open?: boolean;
  locked?: boolean;
  broken?: boolean;
  keyId?: string;
  lockDifficulty?: number;
  lockIntegrity?: number;
  contents?: EnvironmentItem[];
  trap?: EnvironmentTrap;
  structureDamage?: number;
  destroyed?: boolean;
  blocked?: boolean;
  blocksSight?: boolean;
  cover?: number;
  obstacleHeight?: number;
  projectileResistance?: number;
}
export type EnvironmentActor = Pick<
  Partial<BattleUnit>,
  | 'activeSlot'
  | 'activeTool'
  | 'inventory'
  | 'side'
  | 'tacticalLevel'
  | 'entangled'
  | 'mounted'
  | 'hp'
  | 'energy'
  | 'departure'
  | 'surrendered'
  | 'routed'
  | 'knockedDown'
  | 'mechanical'
  | 'dexterity'
  | 'strength'
  | 'experienceLevel'
  | 'wisdom'
  | 'traits'
  | 'abilities'
> & { bound?: boolean };
export interface EnvironmentActionProfile {
  verb: string;
  label: string;
  pa: number;
  chance: number | null;
  requiresRoll: boolean;
  valid: boolean;
  reason: string | null;
  toolWear?: number;
}
export interface EnvironmentInteractionResult<Unit, Target> {
  unit: Unit;
  target: Target;
  pa: number;
  success: boolean;
  outcome: string;
  message: string;
  noiseKind: 'alarm' | 'melee' | 'door' | null;
  damage: number;
  breathLoss: number;
  practice: { mechanical?: number };
  trapTriggered: boolean;
}
export interface EnvironmentSummary {
  id: string | undefined;
  type: string;
  label: string;
  material?: string | undefined;
  open?: boolean;
  locked?: boolean;
  broken: boolean;
  structureDamage?: number;
  destroyed?: boolean;
  trap?: { type: 'alarm' | 'injury'; armed: boolean };
  contents?: EnvironmentItem[];
}
