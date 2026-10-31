import type { Treasury } from '../../domain/finance/treasury.ts';
import type { Inventory } from '../../domain/inventory/inventory.ts';
import type { Journey } from '../../domain/journeys/journey.ts';
import type { Character } from '../../domain/personnel/character.ts';
import type { ForceRoster } from '../../domain/personnel/force-roster.ts';
import type { Squad } from '../../domain/personnel/squad.ts';
import type { SectorParticipant } from '../../domain/sector-sessions/sector-participant.ts';
import type { SectorSession } from '../../domain/sector-sessions/sector-session.ts';
import type { GameSession } from '../../domain/session/game-session.ts';
import type { Corpse } from '../../domain/world/corpse.ts';
import type { ResidentRoutine } from '../../domain/world/resident-routine.ts';
import type { Sector } from '../../domain/world/sector.ts';
import type { WorldTimeline } from '../../domain/world/world-timeline.ts';

interface DomainObjects {
  Character: Character;
  Corpse: Corpse;
  ForceRoster: ForceRoster;
  GameSession: GameSession;
  Inventory: Inventory;
  Journey: Journey;
  ResidentRoutine: ResidentRoutine;
  Sector: Sector;
  SectorParticipant: SectorParticipant;
  SectorSession: SectorSession;
  Squad: Squad;
  Treasury: Treasury;
  WorldTimeline: WorldTimeline;
}

type IdentityStores = { [Kind in keyof DomainObjects]: Map<string, DomainObjects[Kind]> };

export class DomainIdentityMap {
  readonly #objects: IdentityStores = {
    Character: new Map(),
    Corpse: new Map(),
    ForceRoster: new Map(),
    GameSession: new Map(),
    Inventory: new Map(),
    Journey: new Map(),
    ResidentRoutine: new Map(),
    Sector: new Map(),
    SectorParticipant: new Map(),
    SectorSession: new Map(),
    Squad: new Map(),
    Treasury: new Map(),
    WorldTimeline: new Map(),
  };

  obtain<Kind extends keyof DomainObjects>(
    kind: Kind,
    id: string,
    restore: () => DomainObjects[Kind],
  ): DomainObjects[Kind] {
    const identities: Map<string, DomainObjects[Kind]> = this.#objects[kind];
    const existing = identities.get(id);
    if (existing) return existing;
    const object = restore();
    identities.set(id, object);
    return object;
  }
}
