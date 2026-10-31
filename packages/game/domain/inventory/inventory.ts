import { Item, InventoryRefusal, InventoryRefusalCode } from './item.ts';
import type { ItemSnapshot } from './item.ts';
import { PocketLayout, PocketRules } from './pocket-layout.ts';
import type { PocketOrderEntry } from './pocket-layout.ts';

export type InventoryEntrySnapshot = Readonly<{
  selectionId: string;
  item: ItemSnapshot;
  heldQuantity: number;
  stackLimit: number;
  slotSize: number;
}>;
export type InventorySnapshot = Readonly<{
  custodianId: string;
  entries: readonly InventoryEntrySnapshot[];
  pocketOrder?: readonly PocketOrderEntry[];
  unlimitedCapacity?: boolean;
}>;
export type IncomingPlacement = Readonly<{
  selectionId: string;
  stackLimit: number;
  slotSize: number;
  separateUnits?: boolean;
}>;
type Entry = {
  selectionId: string;
  item: Item;
  heldQuantity: number;
  stackLimit: number;
  slotSize: number;
};

export class Inventory {
  readonly #custodianId: string;
  readonly #unlimitedCapacity: boolean;
  #entries = new Map<string, Entry>();
  #pocketOrder: readonly PocketOrderEntry[] | undefined;

  constructor(snapshot: InventorySnapshot) {
    if (!snapshot.custodianId) {
      throw new InventoryRefusal(InventoryRefusalCode.InvalidItem);
    }
    this.#custodianId = snapshot.custodianId;
    this.#unlimitedCapacity = snapshot.unlimitedCapacity ?? false;
    this.#pocketOrder =
      snapshot.pocketOrder === undefined ? undefined : structuredClone(snapshot.pocketOrder);
    PocketLayout.validateOrder(this.#pocketOrder);
    for (const entry of snapshot.entries) {
      if (
        !entry.selectionId ||
        this.#entries.has(entry.selectionId) ||
        !Number.isSafeInteger(entry.heldQuantity) ||
        entry.heldQuantity < 0 ||
        entry.heldQuantity > entry.item.quantity ||
        !Number.isSafeInteger(entry.stackLimit) ||
        entry.stackLimit <= 0 ||
        !Number.isFinite(entry.slotSize) ||
        entry.slotSize < 0
      ) {
        throw new InventoryRefusal(InventoryRefusalCode.InvalidItem);
      }
      this.#entries.set(entry.selectionId, { ...entry, item: new Item(entry.item) });
    }
    this.#assertUniqueIdentities();
  }

  get custodianId(): string {
    return this.#custodianId;
  }
  get overloaded(): boolean {
    return !this.#unlimitedCapacity && this.#layout().overloaded;
  }

  quantityOf(selectionId: string): number {
    return this.#entries.get(selectionId)?.item.quantity ?? 0;
  }

  fingerprint(selectionId: string): string {
    const entry = this.#entries.get(selectionId);
    if (!entry) {
      throw new InventoryRefusal(InventoryRefusalCode.InsufficientQuantity);
    }
    return JSON.stringify({
      custodianId: this.#custodianId,
      selectionId,
      item: entry.item.toSnapshot(),
    });
  }

  assertSelection(selectionId: string, expected?: string): void {
    if (expected !== undefined && this.fingerprint(selectionId) !== expected) {
      throw new InventoryRefusal(InventoryRefusalCode.StaleSelection);
    }
  }

  take(selectionId: string, quantity: number, expected?: string): Item {
    this.assertSelection(selectionId, expected);
    const entry = this.#entries.get(selectionId);
    if (!entry) {
      throw new InventoryRefusal(InventoryRefusalCode.InsufficientQuantity);
    }
    const item = entry.item.take(quantity);
    if (entry.item.quantity === 0) {
      this.#entries.delete(selectionId);
    } else {
      entry.heldQuantity = Math.min(entry.heldQuantity, entry.item.quantity);
    }
    return item;
  }

  receive(
    item: Item,
    placement: IncomingPlacement,
    { deferCapacity = false } = {},
  ): readonly string[] {
    if (item.quantity <= 0) {
      throw new InventoryRefusal(InventoryRefusalCode.InvalidItem);
    }
    if (!deferCapacity && this.overloaded) {
      throw new InventoryRefusal(InventoryRefusalCode.CapacityExceeded);
    }
    const next = new Inventory(this.toSnapshot());
    const incomingIdentities = item.instanceIds;
    if (
      [...next.#entries.values()].some(
        (entry) =>
          entry.item.quantity > 0 &&
          entry.item.instanceIds.some((id) => incomingIdentities.includes(id)),
      )
    ) {
      throw new InventoryRefusal(InventoryRefusalCode.DuplicateIdentity);
    }
    const selections: string[] = [];
    if (placement.separateUnits) {
      if (!next.#unlimitedCapacity && item.quantity > PocketRules.Capacity) {
        throw new InventoryRefusal(InventoryRefusalCode.CapacityExceeded);
      }
      const available = new Item(item.toSnapshot());
      while (available.quantity > 0) {
        const selectionId = next.#availableSelection(placement.selectionId);
        next.#entries.set(selectionId, {
          selectionId,
          item: available.take(1),
          heldQuantity: 0,
          stackLimit: placement.stackLimit,
          slotSize: placement.slotSize,
        });
        selections.push(selectionId);
      }
    } else {
      const existing = next.#entries.get(placement.selectionId);
      if (existing?.item.canMerge(item)) {
        existing.item.merge(item);
        selections.push(existing.selectionId);
      } else {
        const selectionId = next.#availableSelection(placement.selectionId);
        next.#entries.set(selectionId, {
          selectionId,
          item: new Item(item.toSnapshot()),
          heldQuantity: 0,
          stackLimit: placement.stackLimit,
          slotSize: placement.slotSize,
        });
        selections.push(selectionId);
      }
    }
    if (this.#pocketOrder?.some((entry) => entry.count !== undefined)) {
      const slots = this.#layout()
        .toSnapshot()
        .slots.map((slot) => structuredClone(slot));
      for (const selectionId of new Set(
        slots.flatMap((slot) => (slot.entry ? [slot.entry.item] : [])),
      )) {
        let added = next.quantityOf(selectionId) - this.quantityOf(selectionId);
        for (const slot of slots) {
          if (added <= 0 || slot.entry?.item !== selectionId) {
            continue;
          }
          const count = Math.min(added, slot.entry.stackLimit - slot.entry.count);
          slot.entry = { ...slot.entry, count: slot.entry.count + count };
          added -= count;
        }
      }
      next.#pocketOrder = PocketLayout.restore({ slots, overflow: [] }).toOrder();
    }
    next.#assertUniqueIdentities();
    if (!deferCapacity) {
      next.assertCapacity();
    }
    this.#entries = next.#entries;
    this.#pocketOrder = next.#pocketOrder;
    return selections;
  }

  assertCapacity(): void {
    if (this.overloaded) {
      throw new InventoryRefusal(InventoryRefusalCode.CapacityExceeded);
    }
  }

  #availableSelection(base: string): string {
    if (!this.#entries.has(base)) {
      return base;
    }
    const stem = base.slice(0, base.startsWith('inventory:') ? 98 : 88);
    for (let index = 1; index <= 1_000_000; index++) {
      const selectionId = `${stem}:${index}`;
      if (!this.#entries.has(selectionId)) {
        return selectionId;
      }
    }
    throw new InventoryRefusal(InventoryRefusalCode.CapacityExceeded);
  }

  #assertUniqueIdentities(): void {
    const identities = new Set<string>();
    for (const entry of this.#entries.values()) {
      if (entry.item.quantity === 0) {
        continue;
      }
      for (const id of entry.item.instanceIds) {
        if (identities.has(id)) {
          throw new InventoryRefusal(InventoryRefusalCode.DuplicateIdentity);
        }
        identities.add(id);
      }
    }
  }

  #layout(): PocketLayout {
    const items = [...this.#entries.values()]
      .filter((entry) => entry.item.quantity > entry.heldQuantity)
      .map((entry) => ({
        item: entry.selectionId,
        count: entry.item.quantity - entry.heldQuantity,
        stackLimit: entry.stackLimit,
        slotSize: entry.slotSize,
      }));
    return PocketLayout.allocate(items, this.#pocketOrder);
  }

  toSnapshot(): InventorySnapshot {
    return {
      custodianId: this.#custodianId,
      entries: [...this.#entries.values()].map((entry) => ({
        ...entry,
        item: entry.item.toSnapshot(),
      })),
      ...(this.#pocketOrder === undefined
        ? {}
        : { pocketOrder: structuredClone(this.#pocketOrder) }),
      ...(this.#unlimitedCapacity ? { unlimitedCapacity: true } : {}),
    };
  }
}
