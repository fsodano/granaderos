import type { EquipmentAction } from '../../../packages/game/public/compatibility-types.ts';
import type { TacticalOrder } from '../../../packages/game/public/hud-types.ts';
import type {
  InventoryActor,
  InventoryContext,
  InventoryOrderHandler,
  InventoryOrderResult,
  SelectedEquipmentPreview,
} from '../../../packages/game/public/inventory-types.ts';
import { formatAP } from '../../../packages/game/action-points.js';
import {
  equipmentEndpoint,
  equipmentFingerprint,
  itemDescriptor,
} from '../../../packages/game/tactical-inventory.js';
import {
  equipmentCursorPreview,
  interruptAvailable,
} from '../../../packages/game/tactical.js';

export type EquipmentSource = {
  owner: symbol;
  unitId: string;
  sourceId: string;
  expectedSource: string;
  label: string;
  count: number;
  maxCount: number;
  weapon?: number;
};
export type EquipmentGesture = EquipmentSource & {
  x: number;
  y: number;
  dragging: boolean;
  action: EquipmentAction | null;
  remainingSelection: EquipmentSource | null;
};
type State = {
  selection: EquipmentSource | null;
  gesture: EquipmentGesture | null;
  target: string;
  hint: string;
};
const empty = (): State => ({
  selection: null,
  gesture: null,
  target: '',
  hint: '',
});
const restoredOwner = Symbol('saved-equipment-cursor');
const selectedHint = (picked: EquipmentSource) =>
  `${picked.label} · ${picked.count} de ${picked.maxCount} · Elegí el destino. Esc: devolver objeto.`;

// The reducer owns the item. This store only projects that durable cursor and
// holds a pointer gesture or a smaller quantity chosen for the next placement.
export function createEquipmentInteraction(scope: string) {
  let state = empty(),
    binding: {
      unit: InventoryActor;
      battle: InventoryContext;
      disabled: boolean;
      onOrder: InventoryOrderHandler;
    } | null = null,
    pending = false;
  let lastPreview: {
    battle: InventoryContext;
    unit: InventoryActor;
    unitId: string;
    sourceId: string;
    expectedSource: string;
    count: number;
    destinationId: string;
    result: SelectedEquipmentPreview;
  } | null = null;
  const listeners = new Set<() => void>(),
    cancelledPresses = new Set<symbol>();
  const publish = (next: State) => {
    state = next;
    for (const update of listeners) {
      update();
    }
  };
  const resetGesture = () => {
    lastPreview = null;
    if (state.gesture) {
      cancelledPresses.add(state.gesture.owner);
    }
  };
  const source = (
    unit: InventoryActor,
    sourceId: string,
    owner: symbol,
    all = false,
  ): EquipmentSource | null => {
    const endpoint = equipmentEndpoint(unit, sourceId);
    if (!endpoint.item) {
      return null;
    }
    const descriptor = itemDescriptor(unit, endpoint.item),
      maxCount = endpoint.count;
    if (!descriptor) {
      return null;
    }
    return {
      owner,
      unitId: String(unit.id),
      sourceId,
      expectedSource: equipmentFingerprint(unit, sourceId),
      label: descriptor.label,
      count: all ? maxCount : 1,
      maxCount,
      ...('weapon' in descriptor && typeof descriptor.weapon === 'number'
        ? { weapon: descriptor.weapon }
        : {}),
    };
  };
  const observe = (
    unit: InventoryActor | null | undefined,
    owner = state.selection?.owner ?? restoredOwner,
  ) => {
    const cursor = unit?.equipmentCursor
      ? source(unit, 'cursor', owner, true)
      : null;
    if (
      cursor &&
      state.selection?.expectedSource === cursor.expectedSource &&
      state.selection.unitId === cursor.unitId
    ) {
      return;
    }
    if (!cursor && !state.selection) {
      return;
    }
    lastPreview = null;
    pending = false;
    publish({
      ...state,
      selection: cursor,
      target: '',
      hint: cursor ? selectedHint(cursor) : '',
    });
  };
  const accept = (
    result: InventoryOrderResult,
    unitId: string,
    owner?: symbol,
  ) => {
    if (
      result &&
      typeof result === 'object' &&
      'lastError' in result &&
      result.lastError
    ) {
      pending = false;
      publish({ ...state, target: '', hint: result.lastError });
      return false;
    }
    const unit =
      result && typeof result === 'object'
        ? 'units' in result
          ? result.units.find((actor) => String(actor.id) === unitId)
          : String(result.id) === unitId
            ? result
            : null
        : null;
    if (unit) {
      pending = false;
      if (binding) {
        binding = {
          ...binding,
          unit,
          battle:
            result && typeof result === 'object' && 'units' in result
              ? result
              : binding.battle,
        };
      }
      observe(unit, owner);
      return true;
    }
    if (result === null || result === false) {
      pending = false;
      publish({
        ...state,
        target: '',
        hint: 'La orden no se pudo completar. El objeto conserva su lugar.',
      });
      return false;
    }
    return true; // Campaign dispatch acknowledges through the next authoritative props.
  };
  const dispatch = (
    action: TacticalOrder,
    onOrder: InventoryOrderHandler | undefined = binding?.onOrder,
    owner?: symbol,
  ) => {
    if (!onOrder || pending) {
      return false;
    }
    const unitId = String(
      ('unitId' in action ? action.unitId : undefined) ??
        binding?.unit.id ??
        state.selection?.unitId ??
        state.gesture?.unitId ??
        '',
    );
    pending = true;
    return accept(onOrder(action), unitId, owner);
  };
  const cancel = () => {
    const active = Boolean(state.selection || state.gesture);
    if (!active) {
      return false;
    }
    resetGesture();
    if (state.gesture) {
      publish({ ...state, gesture: null, target: '' });
    }
    if (state.selection) {
      if (!binding || binding.disabled || pending) {
        return false;
      }
      dispatch({
        type: 'returnEquipmentCursor',
        unitId: state.selection.unitId,
        expectedSource: state.selection.expectedSource,
      });
      return !state.selection;
    }
    return true;
  };
  const preview = (
    battle: InventoryContext,
    unit: InventoryActor,
    picked: EquipmentSource,
    destinationId: string,
    fresh = false,
  ): SelectedEquipmentPreview => {
    if (picked.unitId !== String(unit.id)) {
      return {
        valid: false,
        reason: 'Colocá primero el objeto del otro combatiente.',
        pa: 0,
        action: null,
      };
    }
    // Pointer motion within one slot reuses a single preview. Reducers replace
    // authoritative state, so a changed battle, unit or quantity invalidates it.
    if (
      !fresh &&
      lastPreview &&
      lastPreview.battle === battle &&
      lastPreview.unit === unit &&
      lastPreview.unitId === picked.unitId &&
      lastPreview.sourceId === picked.sourceId &&
      lastPreview.expectedSource === picked.expectedSource &&
      lastPreview.count === picked.count &&
      lastPreview.destinationId === destinationId
    ) {
      return lastPreview.result;
    }
    try {
      const action: EquipmentAction = {
        type: picked.sourceId === 'cursor' ? 'placeEquipment' : 'dragEquipment',
        sourceId: picked.sourceId,
        destinationId,
        count: picked.count,
        expectedSource: picked.expectedSource,
        expectedDestination: equipmentFingerprint(unit, destinationId),
      };
      const result = {
        ...equipmentCursorPreview(battle, unit, action),
        action,
      };
      lastPreview = {
        battle,
        unit,
        unitId: picked.unitId,
        sourceId: picked.sourceId,
        expectedSource: picked.expectedSource,
        count: picked.count,
        destinationId,
        result,
      };
      return result;
    } catch (error) {
      return {
        valid: false,
        reason:
          error instanceof Error
            ? error.message
            : 'No se pudo comprobar el destino.',
        pa: 0,
        action: null,
      };
    }
  };
  const targetHint = (result: {
    reason?: string | null;
    pa: number;
    operation?: string;
    actionLabel?: string;
    rounds?: number;
    partial?: boolean;
    remainingPA?: number;
    seconds?: number;
  }) => {
    if (result.reason) {
      return result.reason;
    }
    if (result.operation !== 'reload') {
      return 'Colocar objeto · sin PA';
    }
    const cost =
      result.pa > 0
        ? `${formatAP(result.pa)} PA`
        : `sin PA${result.seconds ? ` · ${result.seconds} s` : ''}`;
    const rounds = result.rounds ?? 0,
      loaded = `${rounds} ${rounds === 1 ? 'carga lista' : 'cargas listas'}`;
    const partial = result.partial
      ? ` · Recarga parcial${result.remainingPA ? ` · faltan ${formatAP(result.remainingPA)} PA` : ''}`
      : '';
    return `${result.actionLabel ?? 'Recargar arma'} · ${cost} · ${loaded}${partial}`;
  };
  return {
    scope,
    getSnapshot: () => state,
    subscribe: (update: () => void) => {
      listeners.add(update);
      return () => {
        listeners.delete(update);
      };
    },
    cancel,
    dispatch,
    accept,
    report(hint: string) {
      publish({ ...state, target: '', hint });
    },
    setCount(count: number) {
      const picked = state.selection;
      if (
        !picked ||
        state.gesture ||
        pending ||
        !Number.isSafeInteger(count) ||
        count < 1 ||
        count > picked.maxCount
      ) {
        return false;
      }
      const selection = { ...picked, count };
      publish({
        ...state,
        selection,
        target: '',
        hint: selectedHint(selection),
      });
      return true;
    },
    clearOwned(owner: symbol) {
      if (state.gesture?.owner === owner) {
        resetGesture();
        publish({ ...state, gesture: null, target: '' });
      }
    },
    revalidate(
      unit: InventoryActor,
      disabled: boolean,
      onOrder?: InventoryOrderHandler,
      battle?: InventoryContext,
    ) {
      if (
        state.selection &&
        String(unit?.id) !== state.selection.unitId &&
        battle
      ) {
        const owner = battle.units.find(
          (actor) => String(actor.id) === state.selection?.unitId,
        );
        if (
          !owner?.equipmentCursor ||
          ('tiles' in battle &&
            !interruptAvailable(
              battle,
              battle.units.find(
                (actor) => String(actor.id) === String(owner.id),
              ),
            ))
        ) {
          resetGesture();
          pending = false;
          publish({
            ...empty(),
            hint: owner?.equipmentCursor
              ? 'El objeto permanece con su dueño.'
              : '',
          });
        }
      }
      if (onOrder && battle) {
        if (binding?.unit !== unit) {
          pending = false;
        }
        binding = { unit, disabled, onOrder, battle };
      }
      if (state.gesture) {
        let matches = false;
        try {
          matches =
            state.gesture.expectedSource ===
            equipmentFingerprint(unit, state.gesture.sourceId);
        } catch {}
        if (disabled || !matches) {
          resetGesture();
          publish({ ...state, gesture: null, target: '' });
        }
      }
      // Changing panels never destroys an owned item. The battlefield binds the
      // cursor's actual actor; campaign panels restore it when that actor opens.
      if (
        state.selection &&
        String(unit?.id) !== state.selection.unitId &&
        !unit?.equipmentCursor
      ) {
        return;
      }
      observe(unit);
    },
    click(
      battle: InventoryContext,
      unit: InventoryActor,
      slotId: string,
      owner: symbol,
      all = false,
    ) {
      if (!battle || pending) {
        return null;
      }
      const picked = state.selection;
      if (!picked) {
        const next = source(unit, slotId, owner, all);
        if (!next) {
          return null;
        }
        const action: EquipmentAction = {
          type: 'pickupEquipment',
          sourceId: slotId,
          count: next.count,
          expectedSource: next.expectedSource,
        };
        const result = equipmentCursorPreview(battle, unit, action);
        if (!result.valid) {
          publish({ ...state, hint: result.reason ?? '' });
          return null;
        }
        return action;
      }
      const result = preview(battle, unit, picked, slotId, true);
      if (!result.valid) {
        publish({
          ...state,
          target: '',
          hint: result.reason ?? 'No se puede colocar aquí.',
        });
        return null;
      }
      return result.action;
    },
    hover(battle: InventoryContext, unit: InventoryActor, slotId: string) {
      const picked = state.selection;
      if (!picked || state.gesture) {
        return;
      }
      const result = preview(battle, unit, picked, slotId);
      publish({
        ...state,
        target: result.valid ? slotId : '',
        hint: targetHint(result),
      });
    },
    leave() {
      if (state.selection && !state.gesture) {
        publish({ ...state, target: '', hint: selectedHint(state.selection) });
      }
    },
    press(
      unit: InventoryActor,
      slotId: string,
      owner: symbol,
      x: number,
      y: number,
      all = false,
    ) {
      if (state.gesture || state.selection || pending) {
        return false;
      }
      cancelledPresses.delete(owner);
      const picked = source(unit, slotId, owner, all);
      if (!picked) {
        return false;
      }
      publish({
        ...state,
        gesture: {
          ...picked,
          x,
          y,
          dragging: false,
          action: null,
          remainingSelection: null,
        },
      });
      return true;
    },
    drag(
      battle: InventoryContext,
      unit: InventoryActor,
      owner: symbol,
      x: number,
      y: number,
      destinationId: string | null,
      fresh = false,
    ) {
      const current = state.gesture;
      if (
        !current ||
        current.owner !== owner ||
        (!current.dragging && Math.hypot(x - current.x, y - current.y) <= 5)
      ) {
        return;
      }
      const result =
        destinationId && destinationId !== current.sourceId
          ? preview(battle, unit, current, destinationId, fresh)
          : null;
      const pickup: EquipmentAction = {
        type: 'pickupEquipment',
        sourceId: current.sourceId,
        count: current.count,
        expectedSource: current.expectedSource,
      };
      const action = result?.valid
        ? result.action
        : equipmentCursorPreview(battle, unit, pickup).valid
          ? pickup
          : null;
      publish({
        ...state,
        gesture: { ...current, dragging: true, action },
        target: result?.valid ? (destinationId ?? '') : '',
        hint: result ? targetHint(result) : 'Elegí dónde colocar el objeto.',
      });
    },
    release(owner: symbol) {
      if (cancelledPresses.delete(owner)) {
        return { dragging: false, action: null, suppressClick: true };
      }
      const current = state.gesture;
      if (!current || current.owner !== owner) {
        return null;
      }
      lastPreview = null;
      publish({ ...state, gesture: null, target: '' });
      return {
        dragging: current.dragging,
        action: current.action,
        suppressClick: current.dragging,
      };
    },
  };
}
export type EquipmentInteraction = ReturnType<
  typeof createEquipmentInteraction
>;
