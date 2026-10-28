import {
  readTacticalInventory,
  writeTacticalInventory,
} from '../inventory/tactical-inventory-mapper.js';

export class CanonicalInventoryMapper {
  #entries = new Map();
  #participants = new Map();
  #identities;

  constructor(identities) {
    this.#identities = identities;
  }

  restoreField(field, ownerId) {
    for (const unit of field.units ?? []) {
      const characterId = String(unit.operativeId ?? unit.id);
      const custodianId = `character:${characterId}`;
      const canonicalCharacter =
        unit.side === 'player' || unit.operativeId !== undefined || /^\d+$/.test(characterId);
      const identityKey = canonicalCharacter ? custodianId : `${ownerId}:${custodianId}`;
      if (this.#entries.has(identityKey))
        throw Error('El personaje tiene dos inventarios físicos en el contexto cargado.');
      const inventory = this.#identities.obtain('Inventory', identityKey, () =>
        readTacticalInventory(unit, custodianId),
      );
      this.#entries.set(identityKey, {
        inventory,
        unit,
        original: JSON.stringify(inventory.toSnapshot()),
      });
      this.#participants.set(`${ownerId}:${characterId}`, inventory);
      if (field.sectorSession)
        this.#participants.set(`${field.sectorSession.id}:${characterId}`, inventory);
    }
  }

  inventory(ownerId, characterId) {
    const inventory = this.#participants.get(`${ownerId}:${characterId}`);
    if (!inventory) throw Error('El personaje no tiene un inventario táctico en esta sesión.');
    return inventory;
  }

  object(identityKey) {
    return this.#entries.get(identityKey)?.inventory;
  }

  apply() {
    const projections = [];
    for (const { inventory, unit, original } of this.#entries.values()) {
      if (JSON.stringify(inventory.toSnapshot()) === original) continue;
      projections.push({ unit, projected: writeTacticalInventory(unit, inventory) });
    }
    for (const { unit, projected } of projections) {
      for (const key of Object.keys(unit)) if (!Object.hasOwn(projected, key)) delete unit[key];
      Object.assign(unit, projected);
    }
  }
}
