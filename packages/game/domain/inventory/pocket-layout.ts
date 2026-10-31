export const PocketRefusalCode = Object.freeze({
  InvalidOrder: 'invalid-pocket-order',
  StackLimit: 'pocket-stack-limit',
  InvalidStack: 'invalid-pocket-stack',
  InvalidExchange: 'invalid-pocket-exchange',
  NeedsLargePocket: 'needs-large-pocket',
} as const);
export class PocketRefusal extends Error {
  readonly code: (typeof PocketRefusalCode)[keyof typeof PocketRefusalCode];
  constructor(code: (typeof PocketRefusalCode)[keyof typeof PocketRefusalCode]) {
    super(code);
    this.code = code;
    this.name = 'PocketRefusal';
  }
}

export const PocketRules = Object.freeze({ LargeCount: 4, SmallCount: 8, Capacity: 12 });
export type PocketOrderEntry = Readonly<{
  slotId: string;
  item: string;
  index: number;
  count?: number;
}>;
export type PocketItem = Readonly<{
  item: string;
  count: number;
  stackLimit: number;
  slotSize: number;
  [property: string]: unknown;
}>;
export type PocketEntry = PocketItem & Readonly<{ index: number }>;
export type PocketSlot = { id: string; size: 'large' | 'small'; entry: PocketEntry | null };
export type PocketLayoutSnapshot = Readonly<{
  slots: readonly PocketSlot[];
  overflow: readonly PocketItem[];
}>;

export const PocketDefinitions = Object.freeze([
  ...Array.from({ length: PocketRules.LargeCount }, (_, index) =>
    Object.freeze({ id: `large-${index + 1}`, size: 'large' as const }),
  ),
  ...Array.from({ length: PocketRules.SmallCount }, (_, index) =>
    Object.freeze({ id: `small-${index + 1}`, size: 'small' as const }),
  ),
]);

const partitionKey = (entry: { item: string; index: number }): string =>
  JSON.stringify([entry.item, entry.index]);
const fits = (entry: PocketItem, slot: PocketSlot): boolean =>
  entry.slotSize <= 1 || slot.size === 'large';

export class PocketLayout {
  #slots: PocketSlot[];
  #overflow: PocketItem[];

  private constructor(snapshot: PocketLayoutSnapshot) {
    if (
      !Array.isArray(snapshot.slots) ||
      !Array.isArray(snapshot.overflow) ||
      snapshot.slots.length !== PocketRules.Capacity ||
      new Set(snapshot.slots.map((slot) => slot.id)).size !== PocketRules.Capacity ||
      snapshot.slots.some((slot) => {
        const definition = PocketDefinitions.find((pocket) => pocket.id === slot.id);
        return (
          !definition ||
          definition.size !== slot.size ||
          (slot.entry !== null &&
            (!Number.isSafeInteger(slot.entry.count) ||
              slot.entry.count < 1 ||
              slot.entry.count > slot.entry.stackLimit ||
              !fits(slot.entry, slot)))
        );
      })
    ) {
      throw new PocketRefusal(PocketRefusalCode.InvalidOrder);
    }
    this.#slots = structuredClone([...snapshot.slots]);
    this.#overflow = structuredClone([...snapshot.overflow]);
  }

  static validateOrder(order?: readonly PocketOrderEntry[]): void {
    if (order === undefined) return;
    if (!Array.isArray(order) || order.length > PocketRules.Capacity)
      throw new PocketRefusal(PocketRefusalCode.InvalidOrder);
    const slots = new Set<string>();
    const items = new Set<string>();
    for (const entry of order) {
      if (
        !entry ||
        !PocketDefinitions.some((pocket) => pocket.id === entry.slotId) ||
        typeof entry.item !== 'string' ||
        !entry.item.length ||
        entry.item.length > 110 ||
        // eslint-disable-next-line no-control-regex -- Reject control characters in authored text/IDs.
        /[<>\x00-\x1f]/.test(entry.item) ||
        !Number.isSafeInteger(entry.index) ||
        entry.index < 0 ||
        entry.index > 1_000_000 ||
        (entry.count !== undefined && (!Number.isSafeInteger(entry.count) || entry.count < 1)) ||
        slots.has(entry.slotId) ||
        items.has(partitionKey(entry))
      ) {
        throw new PocketRefusal(PocketRefusalCode.InvalidOrder);
      }
      slots.add(entry.slotId);
      items.add(partitionKey(entry));
    }
  }

  static allocate(items: readonly PocketItem[], order?: readonly PocketOrderEntry[]): PocketLayout {
    PocketLayout.validateOrder(order);
    const slots: PocketSlot[] = PocketDefinitions.map((pocket) => ({ ...pocket, entry: null }));
    const entries: PocketEntry[] = [];
    const overflow: PocketItem[] = [];
    const limits = new Map(items.map((item) => [item.item, item.stackLimit]));
    const partitions = new Map<string, number>();
    for (const entry of order ?? []) {
      if (entry.count === undefined) continue;
      if (limits.has(entry.item) && entry.count > limits.get(entry.item)!)
        throw new PocketRefusal(PocketRefusalCode.StackLimit);
      partitions.set(partitionKey(entry), entry.count);
    }
    for (const item of items) {
      if (
        !Number.isSafeInteger(item.count) ||
        item.count < 0 ||
        !Number.isSafeInteger(item.stackLimit) ||
        item.stackLimit <= 0
      )
        throw new PocketRefusal(PocketRefusalCode.InvalidStack);
      let remaining = item.count;
      for (let index = 0; index < PocketRules.Capacity && remaining > 0; index++) {
        const count = Math.min(
          partitions.get(partitionKey({ item: item.item, index })) ?? item.stackLimit,
          remaining,
        );
        entries.push({ ...item, index, count });
        remaining -= count;
      }
    }
    const preferences = new Map((order ?? []).map((entry) => [partitionKey(entry), entry.slotId]));
    for (const large of [true, false]) {
      const group = entries.filter((entry) => entry.slotSize > 1 === large);
      const placed = new Set<string>();
      for (const entry of group) {
        const slot = slots.find(
          (pocket) =>
            pocket.id === preferences.get(partitionKey(entry)) &&
            !pocket.entry &&
            fits(entry, pocket),
        );
        if (slot) {
          slot.entry = entry;
          placed.add(partitionKey(entry));
        }
      }
      for (const entry of group.filter((entry) => !placed.has(partitionKey(entry)))) {
        const slot = slots
          .filter((pocket) => !pocket.entry && fits(entry, pocket))
          .sort((left, right) => Number(left.size === 'large') - Number(right.size === 'large'))[0];
        if (slot) slot.entry = entry;
      }
    }
    for (const item of items) {
      const count = slots.reduce(
        (total, pocket) => total + (pocket.entry?.item === item.item ? pocket.entry.count : 0),
        0,
      );
      if (count < item.count) overflow.push({ ...item, count: item.count - count });
    }
    return new PocketLayout({ slots, overflow });
  }

  static restore(snapshot: PocketLayoutSnapshot): PocketLayout {
    return new PocketLayout(snapshot);
  }

  get overloaded(): boolean {
    return this.#overflow.length > 0;
  }

  exchange(sourceId: string, destinationId: string): void {
    const source = this.#slots.find((pocket) => pocket.id === sourceId);
    const destination = this.#slots.find((pocket) => pocket.id === destinationId);
    if (!source?.entry || !destination || source === destination)
      throw new PocketRefusal(PocketRefusalCode.InvalidExchange);
    if (!fits(source.entry, destination) || (destination.entry && !fits(destination.entry, source)))
      throw new PocketRefusal(PocketRefusalCode.NeedsLargePocket);
    const displaced = destination.entry;
    destination.entry = source.entry;
    source.entry = displaced;
  }

  toOrder(): PocketOrderEntry[] {
    const indices = new Map<string, number>();
    const order = this.#slots.flatMap((slot) => {
      if (!slot.entry) return [];
      const { item, count } = slot.entry;
      const index = indices.get(item) ?? 0;
      indices.set(item, index + 1);
      return [{ slotId: slot.id, item, index, count }];
    });
    PocketLayout.validateOrder(order);
    return order;
  }

  toSnapshot(): PocketLayoutSnapshot {
    return { slots: structuredClone(this.#slots), overflow: structuredClone(this.#overflow) };
  }
}
