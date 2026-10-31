import type { BattleNpc, BattleUnit } from './compatibility-types.ts';
import type { CorpseSnapshot } from '../domain/world/corpse.ts';

export interface ResidentScavengingReceipt {
  id: string;
  second: number;
  characterId: string;
  groundId: string;
  itemId: string;
  kind: 'rations' | 'medkits' | 'torches' | 'boleadoras';
}

export type SectorDeathRecord =
  | { corpse: CorpseSnapshot; kind: 'resident'; actor: BattleNpc }
  | { corpse: CorpseSnapshot; kind: 'combatant'; actor: BattleUnit };

export interface CivilianHarmOrigin {
  attackerId: string | null;
  side: 'player' | 'enemy' | 'unknown';
  militia: boolean;
  intentional: boolean;
}

export interface CivilianHealth {
  hp: number;
  maxHp?: number;
  energy?: number;
  unconscious?: boolean;
  civilianHealthVersion?: number;
  civilianWoundVersion?: number;
  civilianWoundSeconds?: number;
  bleeding?: number;
  bandaged?: number;
  bleedSource?: CivilianHarmOrigin;
  civilianHarm?: {
    version: 1;
    incidents: (CivilianHarmOrigin & {
      sequence: number;
      kind: 'wounded' | 'death';
      hpBefore: number;
      hpAfter: number;
    })[];
  };
  civilianFirstAid?: { version: 1; hpRestored: number };
}

export interface CivilianStateSnapshot {
  version: 1 | 2;
  people: Record<
    string,
    {
      npcId: string;
      sector: string;
      sceneId: string | null;
      health: CivilianHealth;
      inService?: boolean;
      corpseRemovedAtSecond?: number;
      scavengingReceiptIds?: string[];
    }
  >;
}

export interface WorldObjectByKind {
  Sector: import('../domain/world/sector.ts').Sector;
  Inventory: import('../domain/inventory/inventory.ts').Inventory;
  WorldTimeline: import('../domain/world/world-timeline.ts').WorldTimeline;
  ResidentRoutine: import('../domain/world/resident-routine.ts').ResidentRoutine;
  Corpse: import('../domain/world/corpse.ts').Corpse;
}

export interface ResidentRoutineObservers {
  beforePhase?: (atSecond: number) => boolean | void;
  afterPhase?: (atSecond: number) => void;
  beforeCollection?: (atSecond: number) => void;
  afterCollection?: (atSecond: number) => void;
  afterWound?: (resident: BattleNpc, previousHealth: number) => void;
  beforeConditions?: (atSecond: number) => void;
  advanceWorldEvents?: (atSecond: number) => void;
}
