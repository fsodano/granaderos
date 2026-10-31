import { isArrayValue } from '../shared/array-value.ts';
export const ItemRules = Object.freeze({ MaximumQuantity: 1_000_000 });

export const InventoryRefusalCode = Object.freeze({
  InvalidItem: 'invalid-item',
  InsufficientQuantity: 'insufficient-item-quantity',
  DuplicateIdentity: 'duplicate-item-identity',
  CapacityExceeded: 'inventory-capacity-exceeded',
  SameCustodian: 'same-item-custodian',
  StaleSelection: 'stale-item-selection',
} as const);

export class InventoryRefusal extends Error {
  readonly code: (typeof InventoryRefusalCode)[keyof typeof InventoryRefusalCode];

  constructor(code: (typeof InventoryRefusalCode)[keyof typeof InventoryRefusalCode]) {
    super(code);
    this.name = 'InventoryRefusal';
    this.code = code;
  }
}

export type ItemSnapshot = Readonly<{
  kind: string;
  quantity: number;
  instanceIds: readonly string[];
  metadata: Readonly<Record<string, unknown>>;
}>;

function canonicalValue(value: unknown): unknown {
  if (isArrayValue(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, nested]) => [key, canonicalValue(nested)]),
    );
  }
  return value;
}

export class Item {
  readonly #kind: string;
  #quantity: number;
  readonly #instanceIds: readonly string[];
  readonly #metadata: Readonly<Record<string, unknown>>;

  constructor(snapshot: ItemSnapshot) {
    if (
      !snapshot.kind ||
      !Number.isSafeInteger(snapshot.quantity) ||
      snapshot.quantity < 0 ||
      snapshot.quantity > ItemRules.MaximumQuantity ||
      !isArrayValue(snapshot.instanceIds) ||
      snapshot.instanceIds.some((id) => typeof id !== 'string' || !id) ||
      !snapshot.metadata ||
      typeof snapshot.metadata !== 'object' ||
      isArrayValue(snapshot.metadata)
    ) {
      throw new InventoryRefusal(InventoryRefusalCode.InvalidItem);
    }
    if (
      new Set(snapshot.instanceIds).size !== snapshot.instanceIds.length ||
      (snapshot.instanceIds.length && snapshot.quantity > 1)
    ) {
      throw new InventoryRefusal(InventoryRefusalCode.DuplicateIdentity);
    }
    this.#kind = snapshot.kind;
    this.#quantity = snapshot.quantity;
    this.#instanceIds = Object.freeze([...snapshot.instanceIds]);
    this.#metadata = Object.freeze(structuredClone(snapshot.metadata));
  }

  get quantity(): number {
    return this.#quantity;
  }
  get kind(): string {
    return this.#kind;
  }
  get instanceIds(): readonly string[] {
    return [...this.#instanceIds];
  }

  take(quantity: number): Item {
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > this.#quantity) {
      throw new InventoryRefusal(InventoryRefusalCode.InsufficientQuantity);
    }
    const transferred = new Item({ ...this.toSnapshot(), quantity });
    this.#quantity -= quantity;
    return transferred;
  }

  canMerge(other: Item): boolean {
    return (
      this.#instanceIds.length === 0 &&
      other.#instanceIds.length === 0 &&
      this.#kind === other.#kind &&
      JSON.stringify(canonicalValue(this.#metadata)) ===
        JSON.stringify(canonicalValue(other.#metadata))
    );
  }

  merge(other: Item): void {
    if (!this.canMerge(other) || this.#quantity + other.#quantity > ItemRules.MaximumQuantity)
      throw new InventoryRefusal(InventoryRefusalCode.InvalidItem);
    this.#quantity += other.#quantity;
  }

  toSnapshot(): ItemSnapshot {
    return {
      kind: this.#kind,
      quantity: this.#quantity,
      instanceIds: [...this.#instanceIds],
      metadata: structuredClone(this.#metadata),
    };
  }
}
