import type { Corpse } from '../../../domain/world/corpse.ts';
import type { ItemCustody } from '../../../domain/world/item-custody.ts';
import type { WorldTimeline } from '../../../domain/world/world-timeline.ts';

export type AdvanceWorldTimeContext = {
  timeline: WorldTimeline;
  corpses: readonly Corpse[];
  corpseEquipment: ReadonlyMap<string, readonly ItemCustody[]>;
};

export interface AdvanceWorldTimeRepository {
  load(): AdvanceWorldTimeContext;
  commit(context: AdvanceWorldTimeContext, removedCorpseIds: readonly string[]): void;
}
