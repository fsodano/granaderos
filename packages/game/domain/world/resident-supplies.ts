import { Inventory } from '../inventory/inventory.ts';
import { ItemRules } from '../inventory/item.ts';
import { ItemTransferService } from '../inventory/item-transfer-service.ts';
import { ItemCustody, ItemCustodianKind } from './item-custody.ts';

export const RESIDENT_SCAVENGING_INTERVAL_SECONDS = 60 * 60;
export const RECOVERABLE_RESIDENT_SUPPLIES = Object.freeze([
  'rations',
  'medkits',
  'torches',
  'boleadoras',
] as const);
export type ResidentSupplyKind = (typeof RECOVERABLE_RESIDENT_SUPPLIES)[number];
export type ResidentSupplyQuantities = Readonly<Record<ResidentSupplyKind, number>>;

export class ResidentSupplies {
  readonly characterId: string;
  readonly x: number;
  readonly y: number;
  #quantities: Record<ResidentSupplyKind, number>;

  constructor(characterId: string, x: number, y: number, quantities: ResidentSupplyQuantities) {
    if (!characterId || !Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
      throw new Error('A resident needs an identity and local position.');
    }
    this.characterId = characterId;
    this.x = x;
    this.y = y;
    this.#quantities = { ...quantities };
    for (const kind of RECOVERABLE_RESIDENT_SUPPLIES) {
      if (!Number.isSafeInteger(quantities[kind]) || quantities[kind] < 0) {
        throw new Error('Resident supply quantities must be non-negative integers.');
      }
    }
  }

  quantityOf(kind: ResidentSupplyKind): number {
    return this.#quantities[kind];
  }

  collectOneFrom(source: Inventory, kind: ResidentSupplyKind): Inventory {
    if (!RECOVERABLE_RESIDENT_SUPPLIES.includes(kind)) {
      throw new Error('The resident cannot accept this supply.');
    }
    const destination = new Inventory({
      custodianId: `character:${this.characterId}`,
      unlimitedCapacity: true,
      entries: RECOVERABLE_RESIDENT_SUPPLIES.map((supply) => ({
        selectionId: supply,
        item: { kind: supply, quantity: this.#quantities[supply], instanceIds: [], metadata: {} },
        heldQuantity: 0,
        stackLimit: ItemRules.MaximumQuantity,
        slotSize: 0,
      })),
    });
    const transfer = new ItemTransferService().prepare(source, destination, kind, 1, {
      selectionId: kind,
      stackLimit: ItemRules.MaximumQuantity,
      slotSize: 0,
    });
    this.#quantities[kind] = transfer.destination.quantityOf(kind);
    return transfer.source;
  }

  toSnapshot(): ResidentSupplyQuantities {
    return { ...this.#quantities };
  }
}

export class GroundSupply {
  readonly id: string;
  readonly kind: ResidentSupplyKind;
  readonly x: number;
  readonly y: number;
  #quantity: number;

  constructor(id: string, kind: ResidentSupplyKind, quantity: number, x: number, y: number) {
    if (
      !id ||
      !RECOVERABLE_RESIDENT_SUPPLIES.includes(kind) ||
      !Number.isSafeInteger(quantity) ||
      quantity < 0 ||
      !Number.isSafeInteger(x) ||
      !Number.isSafeInteger(y)
    ) {
      throw new Error('A ground supply needs a valid identity, quantity, type, and position.');
    }
    this.id = id;
    this.kind = kind;
    this.#quantity = quantity;
    this.x = x;
    this.y = y;
  }

  get quantity(): number {
    return this.#quantity;
  }

  transferOneTo(resident: ResidentSupplies): ItemCustody {
    if (this.#quantity === 0) {
      throw new Error('The ground supply is empty.');
    }
    const source = { kind: ItemCustodianKind.Ground, id: this.id };
    const custody = new ItemCustody(`${this.id}:${this.#quantity}`, source);
    const inventory = new Inventory({
      custodianId: `ground:${this.id}`,
      unlimitedCapacity: true,
      entries: [
        {
          selectionId: this.kind,
          item: { kind: this.kind, quantity: this.#quantity, instanceIds: [], metadata: {} },
          heldQuantity: 0,
          stackLimit: ItemRules.MaximumQuantity,
          slotSize: 0,
        },
      ],
    });
    const remaining = resident.collectOneFrom(inventory, this.kind);
    custody.transferFrom(source, { kind: ItemCustodianKind.Character, id: resident.characterId });
    this.#quantity = remaining.quantityOf(this.kind);
    return custody;
  }
}

export class ScavengingPolicy {
  #maximumDistance: number;
  #targetQuantity: number;

  constructor({ maximumDistance = 1, targetQuantity = 1 } = {}) {
    if (
      !Number.isSafeInteger(maximumDistance) ||
      maximumDistance < 0 ||
      !Number.isSafeInteger(targetQuantity) ||
      targetQuantity <= 0
    ) {
      throw new Error('The scavenging policy requires valid distance and quantity limits.');
    }
    this.#maximumDistance = maximumDistance;
    this.#targetQuantity = targetQuantity;
  }

  selectSupply(resident: ResidentSupplies, supplies: readonly GroundSupply[]): GroundSupply | null {
    return (
      [...supplies]
        .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
        .find(
          (supply) =>
            supply.quantity > 0 &&
            resident.quantityOf(supply.kind) < this.#targetQuantity &&
            Math.max(Math.abs(supply.x - resident.x), Math.abs(supply.y - resident.y)) <=
              this.#maximumDistance,
        ) ?? null
    );
  }
}
