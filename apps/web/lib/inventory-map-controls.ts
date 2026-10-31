import type {
  BattleSnapshot,
  BattleUnit,
  TacticalPoint,
} from '../../../packages/game/public/compatibility-types.ts';
import type {
  InventoryMapAction,
  SelectedItemMapPreview,
} from '../../../packages/game/public/inventory-types.ts';
import { formatAP } from '../../../packages/game/action-points.js';
import { inventoryMapPreview, canSee, visibleRooms } from '../../../packages/game/tactical.js';
import { tacticalLevel, sameCell, spaceKey } from '../../../packages/game/tactical-space.js';
import { isInteriorVisible } from '../../../packages/game/tactical-visibility.ts';
import type { EquipmentInteraction, EquipmentSource } from './equipment-interaction';

export type InventoryMapIntent = 'auto' | 'ground';
export type InventoryMapOverride = {
  target: string;
  intent: InventoryMapIntent;
} | null;
export const inventoryIntentAt = (
  override: InventoryMapOverride,
  point: (TacticalPoint & { id?: string }) | null,
): InventoryMapIntent => (point && override?.target === spaceKey(point) ? override.intent : 'auto');
export const toggleInventoryDestination = (
  override: InventoryMapOverride,
  point: TacticalPoint,
): InventoryMapOverride => ({
  target: spaceKey(point),
  intent: inventoryIntentAt(override, point) === 'auto' ? 'ground' : 'auto',
});
export const retainInventoryDestination = (
  override: InventoryMapOverride,
  point: (TacticalPoint & { id?: string }) | null,
): InventoryMapOverride => (point && override?.target === spaceKey(point) ? override : null);
export function selectedItemMapPreview(
  battle: BattleSnapshot,
  unit: BattleUnit | null | undefined,
  picked: EquipmentSource | null,
  point: (TacticalPoint & { id?: string }) | null,
  intent: InventoryMapIntent = 'auto',
): SelectedItemMapPreview | null {
  if (!picked || !unit || !point) {
    return null;
  }

  // Surface and scenery IDs are not recipient IDs. Resolve only a public
  // person on the clicked cell, including when an upper floor has its own ID.
  const target =
    point.id &&
    [...(battle.units ?? []), ...(battle.npcs ?? [])].find(
      (person) =>
        person.id === point.id &&
        sameCell(person, point) &&
        (person.side === 'player' ||
          (isInteriorVisible(
            battle,
            person,
            new Set([...(battle.revealedRooms ?? []), ...visibleRooms(battle)]),
          ) &&
            battle.units?.some(
              (observer) => observer.side === 'player' && canSee(battle, observer, person),
            ))),
    );
  const action: InventoryMapAction = {
    type: 'inventoryMap',
    sourceId: picked.sourceId,
    expectedSource: picked.expectedSource,
    count: picked.count,
    intent,
    x: point.x,
    y: point.y,
    tacticalLevel: tacticalLevel(point),
    ...(target ? { targetId: target.id } : {}),
  };
  const preview = inventoryMapPreview(battle, unit, action);
  if (picked.unitId !== String(unit.id)) {
    return {
      ...preview,
      valid: false,
      reason: 'Seleccioná el objeto de este combatiente.',
      pa: 0,
      name: picked.label,
      actionLabel: 'Colocar objeto',
      coverNote: null,
      remaining: unit.ap,
      action,
    };
  }
  const actionLabel =
    (preview.actionLabel ?? 'Colocar objeto') +
    (preview.valid && preview.kind === 'throw' && preview.action?.targetId
      ? ` · ${preview.chance}% de atrapar`
      : '');
  const relayNote =
    preview.kind === 'gift' && preview.path?.length
      ? 'Acercarse y entregar el objeto.'
      : preview.route.length > 2
        ? `${preview.route.map((step) => step.name).join(' → ')}${battle.mode === 'exploration' ? '' : ` · ${formatAP(preview.totalPA)} PA en total`}`
        : null;
  return {
    ...preview,
    name: `${picked.label} · ${picked.count}`,
    actionLabel,
    coverNote: relayNote,
    remaining: Math.max(0, (unit.ap ?? 0) - preview.pa),
    action: preview.action ?? action,
  };
}

// Return true whenever the item cursor owns the click, including a refusal.
// A failed placement must never fall through to movement, treatment or combat.
export function placeSelectedItemOnMap(
  store: EquipmentInteraction,
  battle: BattleSnapshot,
  unit: BattleUnit | null | undefined,
  point: (TacticalPoint & { id?: string }) | null,
  intent: InventoryMapIntent,
  busy: boolean,
  onOrder: (action: InventoryMapAction) => BattleSnapshot | null | undefined,
) {
  const picked = store.getSnapshot().selection;
  if (!picked) {
    return false;
  }
  if (busy) {
    store.report('Esperá a que termine la orden.');
    return true;
  }
  const preview = selectedItemMapPreview(battle, unit, picked, point, intent);
  if (!preview?.valid) {
    store.report(preview?.reason ?? 'Elegí un destino válido.');
    return true;
  }
  const accepted = onOrder(preview.action);
  if (accepted && !accepted.lastError) {
    store.accept(accepted, String(unit?.id));
  } else {
    store.report(
      accepted?.lastError ?? 'La orden no se pudo completar. El objeto sigue en su lugar.',
    );
  }
  return true;
}
