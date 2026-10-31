import type {
  PlayerKnownState,
  KnownBattle,
} from '../../../packages/game/public/player-known-types.ts';

export interface BrowserToolSchema {
  type: 'object' | 'array' | 'string' | 'integer' | 'boolean';
  properties?: Record<string, BrowserToolSchema>;
  additionalProperties?: boolean;
  required?: string[];
  enum?: readonly string[];
  items?: BrowserToolSchema;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}
export type BrowserOrderResult =
  | { ok: false; error: string }
  | {
      turn: number;
      status: string;
      phase: string;
      units: KnownBattle['units'];
      interrupt: KnownBattle['interrupt'];
      deployment?: KnownBattle['deployment'];
    };
export interface BrowserTool {
  name: string;
  title: string;
  description: string;
  inputSchema: BrowserToolSchema;
  annotations?: { readOnlyHint: boolean };
  execute: (input: unknown) => PlayerKnownState | BrowserOrderResult;
}
export interface BrowserModelContext {
  registerTool(tool: BrowserTool, options: { signal: AbortSignal }): void | Promise<void>;
}
declare global {
  interface Document {
    modelContext?: BrowserModelContext;
  }
}
