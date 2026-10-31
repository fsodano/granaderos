import { CORPSE_REMOVAL_EVENT } from '../../../domain/world/corpse.ts';
import type { AdvanceWorldTimeRepository } from './advance-world-time.repository.ts';

export type AdvanceWorldTimeRequest = Readonly<{ targetSecond: number }>;
export type AdvanceWorldTimeResult = Readonly<{
  acceptedSecond: number;
  removedCorpseIds: readonly string[];
}>;

export class AdvanceWorldTimeUseCase {
  #repository: AdvanceWorldTimeRepository;

  constructor(repository: AdvanceWorldTimeRepository) {
    this.#repository = repository;
  }

  execute(request: AdvanceWorldTimeRequest): AdvanceWorldTimeResult {
    const context = this.#repository.load();
    const removedCorpseIds: string[] = [];
    const corpses = new Map(context.corpses.map((corpse) => [corpse.id, corpse]));
    if (corpses.size !== context.corpses.length) {
      throw new Error('A corpse identity cannot be duplicated.');
    }
    context.timeline.advanceTo(request.targetSecond, (event) => {
      if (event.kind !== CORPSE_REMOVAL_EVENT) {
        throw new Error('The world event kind has no registered domain handler.');
      }
      const corpse = corpses.get(event.subjectId);
      if (!corpse) {
        throw new Error('The world event refers to an unknown corpse.');
      }
      corpse.removeAt(event.atSecond, context.corpseEquipment.get(corpse.id) ?? []);
      removedCorpseIds.push(corpse.id);
      return 'continue';
    });
    this.#repository.commit(context, removedCorpseIds);
    return { acceptedSecond: context.timeline.currentSecond, removedCorpseIds };
  }
}
