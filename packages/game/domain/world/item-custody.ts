export const ItemCustodianKind = Object.freeze({
  Character: 'character',
  Container: 'container',
  Ground: 'ground',
  Corpse: 'corpse',
} as const);

export type ItemCustodian = Readonly<{
  kind: (typeof ItemCustodianKind)[keyof typeof ItemCustodianKind];
  id: string;
}>;

function requireCustodian(custodian: ItemCustodian): void {
  if (
    !Object.values(ItemCustodianKind).includes(custodian.kind) ||
    typeof custodian.id !== 'string' ||
    !custodian.id
  ) {
    throw new Error('An item must have one identified custodian.');
  }
}

export class ItemCustody {
  readonly itemId: string;
  #custodian: ItemCustodian;

  constructor(itemId: string, custodian: ItemCustodian) {
    if (typeof itemId !== 'string' || !itemId) {
      throw new Error('An item needs an identity.');
    }
    requireCustodian(custodian);
    this.itemId = itemId;
    this.#custodian = Object.freeze({ ...custodian });
  }

  heldBy(custodian: ItemCustodian): boolean {
    return this.#custodian.kind === custodian.kind && this.#custodian.id === custodian.id;
  }

  transferFrom(expected: ItemCustodian, destination: ItemCustodian): void {
    requireCustodian(destination);
    if (!this.heldBy(expected)) {
      throw new Error('The item is no longer held by the expected custodian.');
    }
    this.#custodian = Object.freeze({ ...destination });
  }

  toSnapshot(): Readonly<{ itemId: string; custodian: ItemCustodian }> {
    return { itemId: this.itemId, custodian: { ...this.#custodian } };
  }
}
