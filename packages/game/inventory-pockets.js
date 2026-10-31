import {
  PocketDefinitions,
  PocketLayout,
  PocketRefusal,
  PocketRefusalCode,
} from './domain/inventory/pocket-layout.ts';

export const POCKETS = Object.freeze(
  PocketDefinitions.map((pocket) =>
    Object.freeze({
      ...pocket,
      label: `Bolsillo ${pocket.size === 'large' ? 'grande' : 'pequeño'} ${pocket.id.split('-')[1]}`,
    }),
  ),
);
export function withPocketRefusals(operation) {
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
export const validatePocketOrder = (order) =>
  withPocketRefusals(() => PocketLayout.validateOrder(order));
export function allocatePockets(items, order) {
  const layout = withPocketRefusals(() => PocketLayout.allocate(items, order).toSnapshot());
  return {
    ...layout,
    slots: layout.slots.map((slot) => ({
      ...slot,
      label: POCKETS.find((pocket) => pocket.id === slot.id).label,
    })),
  };
}
export const pocketOrderFromSlots = (slots) =>
  withPocketRefusals(() => PocketLayout.restore({ slots, overflow: [] }).toOrder());
export function rearrangePockets(layout, sourceId, destinationId) {
  return withPocketRefusals(() => {
    const pockets = PocketLayout.restore(layout);
    pockets.exchange(sourceId, destinationId);
    return pockets.toOrder();
  });
}
