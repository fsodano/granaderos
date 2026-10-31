import {
  PocketDefinitions,
  PocketLayout,
  PocketRefusal,
  PocketRefusalCode,
} from './domain/inventory/pocket-layout.ts';
import type { PocketItem, PocketOrderEntry, PocketSlot } from './domain/inventory/pocket-layout.ts';

type AllocationItem = Pick<PocketItem, 'item' | 'count' | 'stackLimit' | 'slotSize'>;
type AllocationSlot = Omit<PocketSlot, 'entry'> & {
  entry: (AllocationItem & { index: number }) | null;
};
type AllocationLayout = { slots: readonly AllocationSlot[]; overflow: readonly AllocationItem[] };

export type LabeledPocketLayout = {
  slots: (PocketSlot & { label: string })[];
  overflow: readonly PocketItem[];
};

export const POCKETS = Object.freeze(
  PocketDefinitions.map((pocket) =>
    Object.freeze({
      ...pocket,
      label: `Bolsillo ${pocket.size === 'large' ? 'grande' : 'pequeño'} ${pocket.id.split('-')[1]}`,
    }),
  ),
);
export function withPocketRefusals<Result>(operation: () => Result): Result {
  try {
    return operation();
  } catch (error) {
    if (!(error instanceof PocketRefusal)) {
      throw error;
    }
    const messages = {
      [PocketRefusalCode.InvalidOrder]: 'La distribución de los bolsillos no es válida.',
      [PocketRefusalCode.StackLimit]: 'La cantidad del bolsillo supera el límite de la pila.',
      [PocketRefusalCode.InvalidStack]: 'La pila del bolsillo no es válida.',
      [PocketRefusalCode.InvalidExchange]: 'Seleccioná un objeto y otro bolsillo.',
      [PocketRefusalCode.NeedsLargePocket]: 'Ese objeto necesita un bolsillo grande.',
    };
    throw new Error(messages[error.code]);
  }
}
export const validatePocketOrder = (order?: readonly PocketOrderEntry[]) =>
  withPocketRefusals(() => PocketLayout.validateOrder(order));
export function allocatePockets(
  items: readonly AllocationItem[],
  order?: readonly PocketOrderEntry[],
): LabeledPocketLayout {
  const layout = withPocketRefusals(() =>
    PocketLayout.allocate(
      items.map((item) => ({ ...item })),
      order,
    ).toSnapshot(),
  );
  return {
    ...layout,
    slots: layout.slots.map((slot) => ({
      ...slot,
      label: pocketLabel(slot.id),
    })),
  };
}
export const pocketOrderFromSlots = (slots: readonly AllocationSlot[]) =>
  withPocketRefusals(() => PocketLayout.restore(domainLayout({ slots, overflow: [] })).toOrder());
export function rearrangePockets(
  layout: AllocationLayout,
  sourceId: string,
  destinationId: string,
) {
  return withPocketRefusals(() => {
    const pockets = PocketLayout.restore(domainLayout(layout));
    pockets.exchange(sourceId, destinationId);
    return pockets.toOrder();
  });
}

function pocketLabel(id: string): string {
  const definition = POCKETS.find((pocket) => pocket.id === id);
  if (!definition) {
    throw new Error('La distribución de los bolsillos no es válida.');
  }
  return definition.label;
}

function domainLayout(layout: AllocationLayout) {
  return {
    slots: layout.slots.map((slot) => ({
      ...slot,
      entry: slot.entry === null ? null : { ...slot.entry },
    })),
    overflow: layout.overflow.map((item) => ({ ...item })),
  };
}
