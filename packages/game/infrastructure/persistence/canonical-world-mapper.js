import { CanonicalInventoryMapper } from './canonical-inventory-mapper.js';
import { CanonicalSectorMapper } from './canonical-sector-mapper.js';
import { WorldTimeline } from '../../domain/world/world-timeline.ts';
import { Corpse } from '../../domain/world/corpse.ts';
import { ResidentRoutine } from '../../domain/world/resident-routine.ts';
import { PhysicalSectorProjection } from './physical-sector-projection.js';

export class CanonicalWorldMapper {
  #entries = [];
  #identities;
  #sectors;
  #inventories;
  #projections = [];

  constructor(identities) {
    this.#identities = identities;
    this.#sectors = new CanonicalSectorMapper(identities);
    this.#inventories = new CanonicalInventoryMapper(identities);
  }

  restoreField(snapshot, ownerId, includesParticipant = () => true) {
    const projection = new PhysicalSectorProjection(snapshot, includesParticipant);
    this.#projections.push(projection);
    const field = projection.field;
    this.#sectors.restoreField(field, ownerId);
    this.#inventories.restoreField(field, ownerId);
    if (field.worldTimeline) {
      this.#restore(
        ownerId,
        'WorldTimeline',
        field,
        'worldTimeline',
        () => new WorldTimeline(field.worldTimeline),
      );
    }
    if (field.residentRoutine) {
      this.#restore(
        ownerId,
        'ResidentRoutine',
        field,
        'residentRoutine',
        () => new ResidentRoutine(field.residentRoutine),
      );
    }
    for (const actor of [
      ...(field.units ?? []),
      ...(field.npcs ?? []),
      ...(field.civilians ?? []),
    ]) {
      if (actor.corpse) {
        this.#restore(actor.corpse.id, 'Corpse', actor, 'corpse', () => new Corpse(actor.corpse));
      }
    }
    for (const death of field.deathHistory ?? []) {
      this.#restore(death.corpse.id, 'Corpse', death, 'corpse', () => new Corpse(death.corpse));
    }
  }

  /** @param {string} ownerId
   * @param {string} characterId
   * @returns {import('../../domain/inventory/inventory.ts').Inventory} */
  inventory(ownerId, characterId) {
    return this.#inventories.inventory(ownerId, characterId);
  }

  /** @template {keyof import('../../public/world-state-types.ts').WorldObjectByKind} Kind
   * @param {Kind} kind
   * @param {string} id
   * @returns {import('../../public/world-state-types.ts').WorldObjectByKind[Kind]} */
  object(kind, id) {
    if (kind === 'Inventory') {
      const inventory = this.#inventories.object(id);
      if (!inventory) {
        throw new Error('El inventario no pertenece al contexto cargado.');
      }
      return inventory;
    }
    if (kind === 'Sector') {
      const sector = this.#sectors.object(id);
      if (!sector) {
        throw new Error('El sector no pertenece al contexto cargado.');
      }
      return sector;
    }
    const entry = this.#entries.find((candidate) => candidate.kind === kind && candidate.id === id);
    if (!entry) {
      throw new Error('El objeto del mundo no pertenece al contexto cargado.');
    }
    return entry.object;
  }

  apply() {
    this.#sectors.apply();
    this.#inventories.apply();
    for (const entry of this.#entries) {
      const snapshot = entry.object.toSnapshot();
      if (JSON.stringify(snapshot) !== entry.original) {
        entry.owner[entry.field] = snapshot;
      }
    }
    for (const projection of this.#projections) {
      projection.apply();
    }
  }

  #restore(id, kind, owner, field, restore) {
    const object = this.#identities.obtain(kind, id, restore);
    this.#entries.push({
      id,
      kind,
      owner,
      field,
      object,
      original: JSON.stringify(object.toSnapshot()),
    });
  }
}
