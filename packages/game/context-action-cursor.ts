import type { BattleSnapshot, BattleUnit, TacticalPoint } from './public/compatibility-types.ts';
import type { ActionPreview, TacticalPointer, TargetingContext } from './public/hud-types.ts';
export interface ContextActionCursor {
  icon: string;
  label: string;
  valid: boolean;
  reason: string | null;
  pa?: number;
}
import { canSee, teamCanSee } from './tactical.js';
import {
  visibleHover,
  cellOccupant,
  isMovementGround,
  civilianMedicalInputAction,
  grenadeTargetingMode,
  unitCanAct,
} from './ja2-hud.ts';
import { dialogueAvailability } from './npc-dialogue.ts';
import { sameCell } from './tactical-space.js';
import { spriteCondition } from './sprite-state.js';
import { heldGrenade } from './grenade-throw.js';

// Presentation only. Reuse the caller's native preview; do not search a route,
// choose a new attack, inspect hidden contents or dispatch an order on hover.
export function contextActionCursorModel(
  state: BattleSnapshot,
  unit: BattleUnit | null | undefined,
  hover: TacticalPointer | null | undefined,
  {
    preview = null,
    mode = 'move',
    itemIntent = 'use',
    movementIntent = 'forward',
    busy = false,
  }: TargetingContext & { preview?: ActionPreview | null } = {},
): ContextActionCursor | null {
  if (!state || !unit || !hover || unit.equipmentCursor) {
    return null;
  }
  const point = visibleHover(state, hover);
  if (!point) {
    return null;
  }
  const seen = (actor: TacticalPoint) => teamCanSee(state, unit.side, actor);
  const npc = (state.npcs ?? []).find(
    (actor) =>
      !actor.departure &&
      !actor.fled &&
      sameCell(actor, point) &&
      (point.id === undefined || actor.id === point.id) &&
      seen(actor),
  );
  const occupant = cellOccupant(state.units, point);
  const person = occupant && (occupant.side === unit.side || seen(occupant)) ? occupant : null;
  const collapse = (actor: TacticalPointer | null | undefined) =>
    actor && ['dead', 'unconscious'].includes(spriteCondition(actor));
  const floor = [
    ...(state.droppedWeapons ?? []).filter((item) => !item.taken),
    ...(state.groundItems ?? []).filter(
      (item) => !item.heldBy && !item.containerId && (item.count ?? 0) > 0,
    ),
  ].some((item) => sameCell(item, point) && seen(item));
  const present = (
    icon: string,
    label: string,
    fallbackReason: string | null = null,
  ): ContextActionCursor => {
    const reason = busy
      ? 'Esperá a que termine la acción.'
      : !unitCanAct(state, unit)
        ? 'El combatiente no puede actuar.'
        : (preview?.reason ?? fallbackReason);
    const valid = !reason && preview?.valid !== false;
    return {
      icon,
      label: preview?.actionLabel ?? label,
      valid,
      reason: reason ? String(reason) : null,
      ...(valid &&
      preview?.valid === true &&
      state.mode !== 'exploration' &&
      typeof preview.pa === 'number' &&
      Number.isFinite(preview.pa) &&
      preview.pa >= 0
        ? { pa: preview.pa }
        : {}),
    };
  };
  const select = () =>
    person?.side === 'player' && unitCanAct(state, person)
      ? { icon: 'select', label: 'Seleccionar', valid: true, reason: null }
      : null;
  const contextual = ['move', 'useItem', 'loot'].includes(mode);
  // A normal NPC hit target invokes its conversation handler. Ground and
  // collapsed/medical hit targets use the ordinary modifier-aware tile click.
  if (
    itemIntent === 'moveOnly' &&
    contextual &&
    isMovementGround(state, unit, point) &&
    (!npc || point.id === undefined || civilianMedicalInputAction(state, unit, point, mode))
  ) {
    return null;
  }
  if (
    mode === 'move' &&
    movementIntent === 'preserveFacing' &&
    isMovementGround(state, unit, point) &&
    !npc
  ) {
    return null;
  }
  // Wall hit targets always use the native environment branch before explicit
  // tile modes. The caller's existing preview already checked sight and tools.
  if (point.wallEdgeId) {
    return ['move', 'useItem'].includes(mode) && preview?.attackType === 'environment'
      ? present('hand', preview.actionLabel ?? 'Usar')
      : null;
  }
  if (grenadeTargetingMode(unit, mode) || ['fire', 'throwKnife', 'throwGrenade'].includes(mode)) {
    return present(
      preview?.attackType === 'reload' ? 'reload' : 'aim',
      preview?.attackType === 'reload' ? 'Recargar' : 'Disparar',
    );
  }
  if (civilianMedicalInputAction(state, unit, point, mode)) {
    return present('medical', 'Vendar');
  }
  if (
    npc &&
    mode !== 'loot' &&
    (!collapse(npc) || (unit.activeSlot === 'supply' && unit.activeSupply === 'torches'))
  ) {
    if (unit.activeSlot === 'item' && !heldGrenade(unit) && ['move', 'useItem'].includes(mode)) {
      return present('hand', 'Entregar objeto');
    }
    const availability = dialogueAvailability(state, unit, npc, {
      visible: canSee(state, unit, npc),
      busy,
    });
    return {
      icon: 'lips',
      label: 'Hablar',
      valid: !availability.reason || availability.canApproach,
      reason: availability.canApproach ? null : availability.reason,
    };
  }
  if (mode === 'talk') {
    const availability = dialogueAvailability(state, unit, person ?? npc, {
      visible: Boolean(person || npc),
      busy,
    });
    return {
      icon: 'lips',
      label: 'Hablar',
      valid: !availability.reason || availability.canApproach,
      reason: availability.canApproach ? null : availability.reason,
    };
  }
  if (mode === 'look') {
    return preview?.actionLabel ? present('look', 'Mirar') : null;
  }
  if (['torch', 'bolas'].includes(mode)) {
    return preview?.actionLabel ? present('hand', preview.actionLabel ?? 'Usar') : null;
  }
  if (mode.startsWith('artillery')) {
    const labels: Record<string, string> = {
      artillery: 'Disparar cañón',
      artilleryMove: 'Mover cañón',
      artilleryPivot: 'Girar cañón',
      artilleryReload: 'Recargar cañón',
    };
    const label = labels[mode];
    return label
      ? present(
          mode === 'artilleryReload' ? 'reload' : mode === 'artillery' ? 'aim' : 'hand',
          label,
        )
      : null;
  }
  const steal =
    person &&
    person.side !== unit.side &&
    person.hp > 0 &&
    !person.unconscious &&
    !person.surrendered &&
    !person.routed;
  if (
    (mode === 'loot' || (itemIntent === 'steal' && ['move', 'useItem'].includes(mode))) &&
    steal
  ) {
    return present('hand', 'Quitar arma');
  }
  const pickupPreview = ['Acercarse al equipo', 'Elegir qué recoger'].includes(
    preview?.actionLabel ?? '',
  );
  const torchHeld = unit.activeSlot === 'supply' && unit.activeSupply === 'torches';
  if (
    mode === 'loot' ||
    (contextual &&
      movementIntent !== 'preserveFacing' &&
      itemIntent !== 'moveOnly' &&
      (pickupPreview ||
        (npc && collapse(npc) && !torchHeld) ||
        (floor && (!person || point.loot) && (!torchHeld || itemIntent === 'steal'))))
  ) {
    return present('hand', floor ? 'Recoger' : 'Registrar');
  }
  if (mode === 'move' && heldGrenade(unit)) {
    return select();
  }
  if (
    person &&
    (mode === 'heal' || (unit.activeSlot === 'medical' && ['move', 'useItem'].includes(mode)))
  ) {
    return present('medical', 'Vendar');
  }
  if (
    unit.activeSlot === 'supply' &&
    ['move', 'useItem'].includes(mode) &&
    (person || ['torches', 'boleadoras'].includes(unit.activeSupply ?? ''))
  ) {
    return present('hand', 'Usar pertrecho');
  }
  if (['move', 'useItem'].includes(mode) && person?.side === 'player') {
    return select();
  }
  if (
    person &&
    person.side !== unit.side &&
    person.hp > 0 &&
    !person.surrendered &&
    ['move', 'useItem', 'melee'].includes(mode)
  ) {
    return present(
      preview?.attackType === 'reload'
        ? 'reload'
        : preview?.attackType === 'melee'
          ? 'hand'
          : 'aim',
      preview?.attackType === 'reload'
        ? 'Recargar'
        : preview?.attackType === 'melee'
          ? 'Atacar'
          : 'Disparar',
    );
  }
  // Doors, containers, tools and empty-cell melee use the already-computed
  // native action. Movement keeps its separate footprints and PA cursor.
  if (preview?.actionLabel && !preview.movement) {
    return present('hand', preview.actionLabel ?? 'Usar');
  }
  return null;
}
