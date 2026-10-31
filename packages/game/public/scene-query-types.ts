import type { BattleSnapshot, TacticalAction } from './compatibility-types.ts';

export type SpritePlayback = 'still' | 'breathing' | 'movement' | 'action';
export interface RenderedSprite {
  name: string;
  playback: SpritePlayback;
  requestedName: string;
  style: 'illustrated-pixel-art' | 'native-pixel';
  fallbackReason: 'invalid-atlas' | 'missing-atlas' | null;
  href: string;
  cell: number;
  anchor: number[];
  logicalCell: number;
  frames: number;
  fps: number;
  size: number[];
  mounted: boolean;
}
export type RoomDressingKind =
  | 'shelf'
  | 'chest'
  | 'candle'
  | 'rug'
  | 'pottery'
  | 'hearth'
  | 'washstand'
  | 'sacks'
  | 'rubble'
  | 'broken-timber';
export type RoomDecorProfile = {
  purpose:
    | 'archive'
    | 'office'
    | 'reception'
    | 'bedroom'
    | 'kitchen'
    | 'washroom'
    | 'store'
    | 'workshop'
    | 'ruin'
    | 'hall'
    | 'quarters';
  floor: 'wood' | 'floor' | 'cobble' | 'dirt' | 'stone';
  details: RoomDressingKind[];
};
export interface RoomDressing {
  id: string;
  type: RoomDressingKind;
  x: number;
  y: number;
  tacticalLevel: number;
  roomId: string;
  buildingId: string;
  purpose: RoomDecorProfile['purpose'];
  decorative: true;
  blocksMovement: false;
  footprint: { width: number; height: number };
}
export interface BandagePatientSummary {
  id: string;
  name: string;
  hp: number;
  bleeding: number;
  medkits: number;
}
export interface AutoBandageStatus {
  available: boolean;
  reason: string | null;
  patients: BandagePatientSummary[];
  doctors: BandagePatientSummary[];
}
export interface AutoBandageResult {
  battle: BattleSnapshot;
  treatedIds: string[];
  steps: TacticalAction[];
  stoppedReason: string | null;
  untreated: { id: string; name: string; reason: string }[];
  elapsedSeconds: number;
}
