import { syncUnitAmmunition } from '../../tactical-ammunition.js';
import { HELD_SUPPLIES } from '../../held-supplies.js';
import { withPocketRefusals } from '../../inventory-pockets.js';
import { Item, InventoryRefusal, InventoryRefusalCode } from '../../domain/inventory/item.ts';
import { Inventory } from '../../domain/inventory/inventory.ts';
import { BODY_SLOTS } from '../../outfits.js';
import { handLayout } from '../../hand-layout.js';
import { fittingItemIds } from '../../weapon-fittings.js';
import {
  SUPPLY_ITEMS,
  itemQuantity,
  itemDescriptor,
  readItemStack,
  itemStackDescriptor,
  validateHands,
  normalizeItemStack,
  extractItemQuantity,
  handMetadata,
} from '../../tactical-inventory.js';

export function withInventoryRefusals(operation) {
  try {
    return withPocketRefusals(operation);
  } catch (error) {
    if (!(error instanceof InventoryRefusal)) throw error;
    const messages = {
      [InventoryRefusalCode.InvalidItem]: 'El objeto o la cantidad no son válidos.',
      [InventoryRefusalCode.InsufficientQuantity]: 'No queda esa cantidad del objeto.',
      [InventoryRefusalCode.DuplicateIdentity]: 'Ese objeto identificado ya está en el inventario.',
      [InventoryRefusalCode.CapacityExceeded]: 'No queda espacio en el inventario.',
      [InventoryRefusalCode.SameCustodian]: 'Elegí otro combatiente para recibir el objeto.',
      [InventoryRefusalCode.StaleSelection]: 'Cambió el equipo. Seleccioná el objeto de nuevo.',
    };
    throw new Error(messages[error.code]);
  }
}

export function readTransferredItem(stack) {
  const { item, count, ...metadata } = normalizeItemStack(stack);
  const kind =
    stack.weapon !== undefined
      ? `weapon:${stack.weapon}`
      : item.startsWith('inventory:')
        ? item.slice(10)
        : item;
  return new Item({ kind, quantity: count, instanceIds: fittingItemIds(stack), metadata });
}

export function readIncomingPlacement(stack) {
  const descriptor = itemStackDescriptor(stack);
  const supply = Object.hasOwn(SUPPLY_ITEMS, stack.item);
  const key =
    stack.item === 'weapon'
      ? `weapon:${stack.weapon}`
      : stack.item.startsWith('inventory:')
        ? stack.item.slice(10)
        : stack.item;
  return {
    selectionId: supply ? stack.item : `inventory:${key}`,
    stackLimit: descriptor.stackLimit,
    slotSize: descriptor.slotSize,
    separateUnits: stack.weapon !== undefined || stack.itemType === 'tool' || stack.kind === 'tool',
  };
}

export function readTacticalInventory(unit, custodianId = `character:${unit.id ?? 'anonymous'}`) {
  validateHands(unit);
  const held = handLayout(unit).held;
  const selections = [
    ...Object.keys(SUPPLY_ITEMS).filter((item) => item !== 'ammo' || unit.ammunitionVersion !== 2),
    ...Object.keys(unit.inventory ?? {})
      .sort()
      .map((key) => `inventory:${key}`),
    'primary',
    'blade',
    'offhand',
    ...BODY_SLOTS,
    ...(unit.equipmentCursor ? ['cursor'] : []),
  ];
  const entries = selections.flatMap((selectionId) => {
    const quantity = itemQuantity(unit, selectionId);
    if (!quantity) return [];
    const descriptor = itemDescriptor(unit, selectionId);
    const item = readTransferredItem(readItemStack(unit, selectionId, quantity));
    return [
      {
        selectionId,
        item: item.toSnapshot(),
        heldQuantity:
          selectionId === 'cursor' || BODY_SLOTS.includes(selectionId)
            ? quantity
            : held.filter((selection) => selection === selectionId).length,
        stackLimit: descriptor.stackLimit,
        slotSize: descriptor.slotSize,
      },
    ];
  });
  return new Inventory({
    custodianId,
    entries,
    ...(unit.pocketOrder === undefined ? {} : { pocketOrder: unit.pocketOrder }),
  });
}

export function writeStoredInventory(unit, inventory) {
  const snapshot = inventory.toSnapshot();
  const next = structuredClone(unit);
  next.inventory ??= {};
  for (const entry of snapshot.entries) {
    if (Object.hasOwn(SUPPLY_ITEMS, entry.selectionId))
      next[entry.selectionId] = entry.item.quantity;
    if (!entry.selectionId.startsWith('inventory:')) continue;
    const key = entry.selectionId.slice(10);
    const previous = unit.inventory?.[key];
    const unchanged =
      previous !== undefined &&
      (typeof previous === 'number' ? previous : previous.count) > 0 &&
      JSON.stringify(
        readTransferredItem(
          readItemStack(
            unit,
            entry.selectionId,
            typeof previous === 'number' ? previous : previous.count,
          ),
        ).toSnapshot(),
      ) === JSON.stringify(entry.item);
    next.inventory[key] = unchanged
      ? structuredClone(previous)
      : { ...structuredClone(entry.item.metadata), count: entry.item.quantity };
  }
  if (snapshot.pocketOrder !== undefined) next.pocketOrder = structuredClone(snapshot.pocketOrder);
  return next;
}

function assignOptional(record, key, value) {
  if (value === undefined) delete record[key];
  else record[key] = structuredClone(value);
}

function writeHandRecord(unit, selectionId, item) {
  const metadata = structuredClone(item.metadata);
  if (item.quantity !== 1 || metadata.weapon === undefined)
    throw new Error('A weapon slot requires one weapon.');
  if (selectionId === 'offhand') {
    unit.offHand = { ...metadata, count: 1 };
    return;
  }
  const primary = selectionId === 'primary';
  unit[primary ? 'weapon' : 'blade'] = metadata.weapon;
  unit[primary ? 'condition' : 'bladeCondition'] = metadata.condition ?? 100;
  assignOptional(unit, primary ? 'weaponInstanceId' : 'bladeInstanceId', metadata.instanceId);
  const extra = handMetadata(metadata);
  assignOptional(
    unit,
    primary ? 'weaponMetadata' : 'bladeMetadata',
    Object.keys(extra).length ? extra : undefined,
  );
  unit[primary ? 'weaponFittingPattern' : 'bladeFittingPattern'] = metadata.fittingPattern ?? null;
  if (primary) {
    unit.weaponDropped = false;
    unit.loaded = metadata.loaded ?? 0;
    unit.jammed = metadata.jammed ?? false;
    unit.weaponFittings = structuredClone(metadata.fittings ?? {});
    for (const field of ['reloadProgress', 'contentWeapon', 'ammunitionChoice'])
      assignOptional(unit, field, metadata[field]);
  }
}

function restoreHeldSelections(unit, before, entries) {
  const held = entries.flatMap((entry) =>
    BODY_SLOTS.includes(entry.selectionId) || entry.selectionId === 'cursor'
      ? []
      : Array(entry.heldQuantity).fill(entry.selectionId),
  );
  if (held.length > 2) throw new Error('The inventory cannot occupy more than two hands.');
  const take = (preferred) => {
    const index = held.indexOf(preferred);
    return index < 0 ? null : held.splice(index, 1)[0];
  };
  const original = handLayout(before);
  const right = take(original.right) ?? held.shift() ?? null;
  const left = take(original.left) ?? held.shift() ?? null;
  delete unit.activeItem;
  delete unit.activeTool;
  delete unit.activeSupply;
  unit.activeSlot = 'unarmed';
  if (['primary', 'blade', 'offhand'].includes(right)) unit.activeSlot = right;
  else if (right === 'medkits') unit.activeSlot = 'medical';
  else if (Object.hasOwn(HELD_SUPPLIES, right ?? '')) {
    unit.activeSlot = 'supply';
    unit.activeSupply = right;
  } else if (right) {
    const value = unit.inventory?.[right.replace(/^inventory:/, '')];
    if (value?.itemType === 'tool' || value?.kind === 'tool') {
      unit.activeSlot = 'tool';
      unit.activeTool = right;
    } else {
      unit.activeSlot = 'item';
      unit.activeItem = right;
    }
  }
  unit.leftHandItem = left;
}

export function writeTacticalInventory(unit, inventory) {
  const snapshot = inventory.toSnapshot();
  const expected = new Map(
    snapshot.entries
      .filter((entry) => entry.item.quantity > 0)
      .map((entry) => [entry.selectionId, entry]),
  );
  const original = readTacticalInventory(unit, snapshot.custodianId).toSnapshot();
  let next = structuredClone(unit);
  for (const entry of original.entries) {
    const remaining = expected.get(entry.selectionId)?.item.quantity ?? 0;
    if (remaining < entry.item.quantity)
      next = extractItemQuantity(next, entry.selectionId, entry.item.quantity - remaining, {
        keepOtherHand: false,
      }).unit;
  }
  next = writeStoredInventory(next, inventory);
  for (const entry of expected.values()) {
    if (['primary', 'blade', 'offhand'].includes(entry.selectionId))
      writeHandRecord(next, entry.selectionId, entry.item);
    else if (BODY_SLOTS.includes(entry.selectionId)) {
      next[entry.selectionId] = {
        ...structuredClone(entry.item.metadata),
        count: entry.item.quantity,
      };
      if (entry.selectionId === 'outfit') delete next.poncho;
    } else if (entry.selectionId === 'cursor') {
      if (!unit.equipmentCursor)
        throw new Error('A cursor item requires its admitted cursor origin.');
      next.equipmentCursor = {
        ...structuredClone(unit.equipmentCursor),
        stack: {
          ...structuredClone(entry.item.metadata),
          item: unit.equipmentCursor.stack.item,
          count: entry.item.quantity,
        },
      };
    }
  }
  restoreHeldSelections(next, unit, [...expected.values()]);
  if (snapshot.pocketOrder === undefined) delete next.pocketOrder;
  if (next.ammunitionVersion === 2) syncUnitAmmunition(next);
  const projected = readTacticalInventory(next, snapshot.custodianId).toSnapshot();
  const comparable = (entries) =>
    entries
      .filter((entry) => entry.item.quantity > 0)
      .sort((left, right) => left.selectionId.localeCompare(right.selectionId));
  if (
    JSON.stringify(comparable(projected.entries)) !== JSON.stringify(comparable(snapshot.entries))
  )
    throw new Error('The inventory cannot be projected without changing item custody.');
  return next;
}
