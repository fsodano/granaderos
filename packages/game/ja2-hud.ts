import type {
  HeldReloadPlan,
  ItemUsePreview,
  FirearmShotPreview,
} from './public/tactical-preview-types.ts';
import type {
  BattleSnapshot,
  BattleUnit,
  BattleNpc,
  TacticalPoint,
} from './public/compatibility-types.ts';
import type {
  ActionPreview,
  TacticalPointer,
  TargetingContext,
  OrderDescriptor,
  TacticalOrder,
  EquipmentSlot,
  InventoryModel,
  LootOption,
} from './public/hud-types.ts';
import type { EquipmentItem } from './public/compatibility-types.ts';
import type { EquipmentPreview } from './public/inventory-types.ts';
import { wallEdgeId, wallEdgeCenter } from './wall-geometry.js';
import { formatAP } from './action-points.js';
import { firearmServiceable, BROKEN_FIREARM_REASON } from './firearm-serviceability.js';
import { CIVILIAN_SUPPLY_FIELDS } from './civilian-supplies.js';
import { finiteArsenalsFor } from './campaign-physical.js';
import { weaponSpecification } from './weapon-definition.ts';
import { AMMUNITION_TYPES, availableAmmunition, weaponAmmoType } from './ammunition-types.js';
import { tacticalLevel, sameCell, sameSurface, spaceKey } from './tactical-space.js';
import { BODY_SLOTS, OUTFITS, wornOutfit, hasPoncho } from './outfits.ts';
import { handLayout, selectMainHand } from './hand-layout.ts';
import { reloadPlan, reprimePlan, lookPreview, firearmMaintenancePreview } from './tactical.js';
import { reprimeLabel } from './weapon-reprime.js';
import { shotRangeText } from './shot-range.js';
import { heldThrowingKnife } from './thrown-knife.js';
import { heldGrenade } from './grenade-throw.js';
import { knifeThrowPreview, grenadeThrowPreview } from './tactical.js';
import { canChooseShotLocation } from './targeted-combat.js';
import { tacticalGridLabel } from './tactical-grid.js';
// Pure HUD model for the tactical battle inspector and squad strip.
// Read-only descriptors plus action-object constructors; no game rules.
// Pure HUD model for the tactical battle inspector and squad strip.
// Read-only descriptors plus action-object constructors; no game rules.
import {
  mainItemPreview,
  swapHandsPreview,
  weaponFor,
  bladeFor,
  hasFirearm,
  carriedWeight,
  carryCapacity,
  actionCosts,
  actionPointBudget,
  stanceCost,
  firearmVolleyPreview,
  firearmRangeProfile,
  firearmProjectilePath,
  firearmFlightPreview,
  canSee,
  hasLineOfSight,
  artilleryCosts,
  artilleryCrewPlan,
  artilleryReloadPreview,
  interruptAvailable,
  canEndCombat,
  fieldCapable,
  transferPreview,
  dropPreview,
  environmentTargetAt,
  environmentPreview,
  containerLootPreview,
  supplyUsePreview,
  getReachable,
  knownArtillery,
  movementIntentReason,
  exitPreview,
  WEAPONS,
  BLADES,
} from './tactical.js';
import { pairedPistol, secondaryPistolView } from './paired-fire.js';
import { directionTo } from './tactical-awareness.js';
import { unarmedChance } from './unarmed-combat.js';
import {
  inventoryUsage,
  carriedObject,
  itemDescriptor,
  readItemStack,
  INVENTORY_CAPACITY,
  SUPPLY_ITEMS,
} from './tactical-inventory.js';
import {
  TOOL_TYPES,
  heldTool,
  ENVIRONMENT_VERBS,
  environmentTargetSummary,
  visibleContainerContents,
} from './environment-interactions.ts';
import { HELD_SUPPLIES, heldSupply } from './held-supplies.js';
import { planGroupMove } from './group-movement.ts';
import {
  npcGiftPreview,
  contextualAttack,
  meleePreview,
  meleePointPreview,
  fitBayonetPreview,
  removeBayonetPreview,
  medicalUsePreview,
  itemUsePreview,
  environmentUsePreview,
  lootApproachPreview,
  lootSearchPreview,
  lootBatchPreview,
  stealPreview,
  pointFirePreview,
} from './tactical.js';
import { fixedBayonetFor, fittingLabel, weaponItemWeight } from './weapon-fittings.js';
import { firearmBystanderRisk, firearmBystanderWarning } from './firearm-bystander-risk.js';
import { environmentContainerVisible } from './tactical.js';
import { campaignDefinitions, campaignSectors } from './campaign-definition.js';
import { campaignPlace } from './world-cells.ts';
import { campaignFactionName } from './campaign-faction-presentation.js';
import { CITY_LOYALTY_REWARDS } from './cities.js';

const bladeDefinition = (id: string | number | undefined) =>
  Object.values(BLADES).find((blade) => blade.id === id);
const firearmDefinition = (id: string | number | undefined) =>
  Object.values(WEAPONS).find((weapon) => weapon.id === id);
const alive = (u: BattleUnit | BattleNpc) =>
  u.hp > 0 && !u.routed && !u.unconscious && !u.departure && !u.fled;
const shortName = (u: Pick<BattleUnit, 'name' | 'nickname'>) =>
  u.nickname ||
  String(u.name || '')
    .split(' ')
    .slice(-1)[0] ||
  '';
const distance = (a: TacticalPoint, b: TacticalPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const toolTargets = (unit: BattleUnit) =>
  heldTool(unit)?.toolKey === 'crowbar'
    ? 'una puerta, un cofre, una pared de adobe o una barricada de madera'
    : 'una puerta o un cofre';
/** @param {number} value @returns {string} */
export const chancePercent = (value: number): string =>
  value > 0 && value < 1 ? '<1%' : `${Math.round(value)}%`;
const maintenanceGainFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
/** Public authored destinations and the accepted delivery's saved choice. */
/** @param {{beneficiaries?:{id:string,sector:string,reward:{treasury:number,loyalty:boolean}}[],selectedBeneficiaryId?:string|null|undefined,beneficiaryId?:string|undefined} | null | undefined} delivery
 * @param {import('./public/compatibility-types.ts').CampaignContext} [context] */
export function beneficiaryDeliveryNotice(
  delivery:
    | {
        beneficiaries?: {
          id: string;
          sector: string;
          reward: { treasury: number; loyalty: boolean };
        }[];
        selectedBeneficiaryId?: string | null | undefined;
        beneficiaryId?: string | undefined;
      }
    | null
    | undefined,
  context: import('./public/compatibility-types.ts').CampaignContext = null,
) {
  if (!delivery?.beneficiaries?.length) {
    return null;
  }
  const place = (id: string) =>
    campaignSectors(context).find((sector) => sector.id === id)?.name ?? id;
  const selected = delivery.beneficiaries.find(
    (recipient) => recipient.id === delivery.selectedBeneficiaryId,
  );
  if (selected) {
    return `Destino fijado: ${place(selected.sector)}. ${delivery.beneficiaryId && delivery.beneficiaryId !== selected.id ? 'Este contacto rechazará el objeto; seguirá en tu equipo.' : 'Todos los objetos deben ir al mismo contacto.'}`;
  }
  const destinations = delivery.beneficiaries.map(
    (recipient) =>
      `${place(recipient.sector)}: ${[recipient.reward.treasury > 0 ? `${recipient.reward.treasury} pesos` : null, recipient.reward.loyalty ? `apoyo local +${CITY_LOYALTY_REWARDS.quest}` : null].filter(Boolean).join(' y ') || 'sin recompensa'}`,
  );
  return `${destinations.join(' · ')}. La primera entrega aceptada fija el destino. No podrás cambiarlo.`;
}
const shotLoadText = (shot: { pelletCount: number; damageFactor: number }) =>
  `Carga de perdigones (${shot.pelletCount} proyectiles). Probabilidad de al menos un contacto; no garantiza varios impactos ni la zona del cuerpo. ${shot.damageFactor === 0 ? 'Ningún perdigón puede llegar por las trayectorias previstas.' : shot.damageFactor < 1 ? `Fuerza media si llega algún perdigón: ${Math.round(shot.damageFactor * 100)}% de la carga.` : ''} Disparar consume una carga.`;
const affordable = (state: BattleSnapshot, unit: BattleUnit, pa: number) =>
  state.mode === 'exploration' || unit.ap >= pa;
const hasPrimary = (unit: BattleUnit) => Boolean(unit.weapon) && !unit.weaponDropped;
/** @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @returns {import('./public/hud-types.ts').ToolItem[]} */
export function toolItems(
  unit: BattleUnit | null | undefined,
): import('./public/hud-types.ts').ToolItem[] {
  if (!unit) {
    return [];
  }
  return Object.entries(unit?.inventory || {}).flatMap(([key, record]) => {
    if (typeof record === 'number') {
      return [];
    }
    const item = `inventory:${key}`,
      tool = heldTool({ ...unit, activeSlot: 'tool', activeTool: item });
    return tool
      ? [
          {
            ...record,
            ...tool,
            key,
            count: record.count ?? 0,
            active: unit.activeSlot === 'tool' && unit.activeTool === item,
          },
        ]
      : [];
  });
}
/** @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @returns {import('./public/hud-types.ts').HeldSupplyItem[]} */
export function supplyItems(
  unit: BattleUnit | null | undefined,
): import('./public/hud-types.ts').HeldSupplyItem[] {
  if (!unit) {
    return [];
  }
  return Object.keys(HELD_SUPPLIES).flatMap((key) => {
    const supply = heldSupply({ ...unit, activeSlot: 'supply', activeSupply: key });
    return supply
      ? [
          {
            ...supply,
            label: SUPPLY_ITEMS[key]?.label ?? supply.name,
            active: unit.activeSlot === 'supply' && unit.activeSupply === key,
          },
        ]
      : [];
  });
}
/** @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @returns {import('./public/hud-types.ts').TacticalOrder} */
export function heldSupplyAction(
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  target: TacticalPointer,
): import('./public/hud-types.ts').TacticalOrder {
  return {
    type: 'useItem',
    ...(unit?.activeSupply === 'torches' || target?.id === undefined
      ? {
          x: target.x,
          y: target.y,
          ...(target.tacticalLevel === undefined ? {} : { tacticalLevel: target.tacticalLevel }),
        }
      : { targetId: target?.id }),
  };
}

/** @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit @returns {"throwGrenade" | "throwKnife" | "fire" | "useItem"} */
export const attackCursorMode = (
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
): 'throwGrenade' | 'throwKnife' | 'fire' | 'useItem' =>
  heldGrenade(unit)
    ? 'throwGrenade'
    : heldThrowingKnife(unit)
      ? 'throwKnife'
      : unit && hasFirearm(unit) && unit.weaponMode !== 'melee'
        ? 'fire'
        : 'useItem';
/** @param {string} mode @returns {boolean} */
export const aimedCursorMode = (mode: string): boolean =>
  mode === 'fire' || mode === 'throwKnife' || mode === 'throwGrenade';
/** @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit @param {string} mode @returns {boolean} */
export const grenadeTargetingMode = (
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  mode: string,
): boolean => mode === 'throwGrenade' || (mode === 'useItem' && Boolean(heldGrenade(unit)));
/** @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit @param {string} mode @returns {boolean} */
export const meleePointTargetingMode = (
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  mode: string,
): boolean =>
  mode === 'useItem' &&
  unit != null &&
  !['medical', 'tool', 'supply', 'item'].includes(unit.activeSlot) &&
  (!hasFirearm(unit) || unit.weaponMode === 'melee');
/** @param {import('./public/hud-types.ts').TacticalPointer} point @returns {import('./public/hud-types.ts').TacticalOrder} */
export const meleePointInputAction = (
  point: import('./public/hud-types.ts').TacticalPointer,
): import('./public/hud-types.ts').TacticalOrder => ({
  type: 'meleePoint',
  x: point?.x,
  y: point?.y,
  tacticalLevel: tacticalLevel(point),
});
/** @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit @param {string} mode @returns {string} */
export const retainedAttackCursor = (
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  mode: string,
): string =>
  (mode === 'throwKnife' && !heldThrowingKnife(unit)) ||
  (mode === 'throwGrenade' && !heldGrenade(unit)) ||
  (mode === 'fire' && !hasFirearm(unit || {}))
    ? 'move'
    : mode === 'fire' && unit?.weaponMode === 'melee'
      ? 'useItem'
      : mode;
/** @param {import('./public/hud-types.ts').TacticalPointer} target @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit @returns {import('./public/hud-types.ts').TacticalOrder} */
export const pickupTargetAction = (
  target: import('./public/hud-types.ts').TacticalPointer,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
): import('./public/hud-types.ts').TacticalOrder => ({
  type:
    target.side !== unit?.side &&
    (target.hp ?? 0) > 0 &&
    !target.unconscious &&
    !target.surrendered &&
    !target.routed
      ? 'steal'
      : 'loot',
  ...(target.id === undefined ? {} : { targetId: target.id }),
});
/** @param {string} mode @param {string} targetId @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit @returns {{type:'fire'|'useItem',targetId:string}} */
export const targetItemAction = (
  mode: string,
  targetId: string,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
): { type: 'fire' | 'useItem'; targetId: string } => ({
  type: mode === 'fire' && hasFirearm(unit || {}) ? 'fire' : 'useItem',
  targetId,
});
/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TacticalPointer | null | undefined} point
 * @param {string} [mode]
 * @returns {import('./public/compatibility-types.ts').TacticalAction | null} */
export function civilianMedicalInputAction(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  point: import('./public/hud-types.ts').TacticalPointer | null | undefined,
  mode: string = 'move',
): { type: 'heal' | 'useItem'; targetId: string; targetKind: 'npc' } | null {
  if (unit?.activeSlot !== 'medical' || !['move', 'useItem', 'heal'].includes(mode) || !point) {
    return null;
  }
  const npc = (state.npcs ?? []).find(
    (n) => sameCell(n, point) && (point.id === undefined || n.id === point.id),
  );
  if (!npc || npc.departure || npc.fled || !canSee(state, unit, npc)) {
    return null;
  }
  return { type: mode === 'heal' ? 'heal' : 'useItem', targetId: npc.id, targetKind: 'npc' };
}
// Civilian aiming uses the existing ground-shot contract, never a body target.
/** @param {import('./public/hud-types.ts').TacticalPointer} point @param {{aim?:number}} [options] @returns {import('./public/hud-types.ts').TacticalOrder} */
export const pointFireInputAction = (
  point: import('./public/hud-types.ts').TacticalPointer,
  { aim = 0 }: { aim?: number } = {},
): import('./public/hud-types.ts').TacticalOrder => ({
  type: 'firePoint',
  x: point?.x,
  y: point?.y,
  tacticalLevel: tacticalLevel(point),
  hitLocation: 'torso',
  aim,
});
function explicitPointShot(state: BattleSnapshot, point: TacticalPointer | null | undefined) {
  if (point?.anonymous) {
    return true;
  }
  return Boolean(
    point?.id &&
    (state.npcs ?? []).some(
      (npc) =>
        npc.id === point.id &&
        sameCell(npc, point) &&
        state.units.some((observer) => observer.side === 'player' && canSee(state, observer, npc)),
    ),
  );
}
function visibleThrowPoint(state: BattleSnapshot, point: TacticalPointer | null | undefined) {
  return point && explicitPointShot(state, point)
    ? { x: point.x, y: point.y, tacticalLevel: tacticalLevel(point), anonymous: true }
    : visibleHover(state, point);
}
function knifeTarget(
  state: BattleSnapshot,
  unit: BattleUnit | null | undefined,
  point: TacticalPointer | null | undefined,
): TacticalPointer | null {
  const visible = visibleThrowPoint(state, point);
  if (!visible) {
    return null;
  }
  if (visible.anonymous) {
    return { x: visible.x, y: visible.y, tacticalLevel: tacticalLevel(visible) };
  }
  const target = cellOccupant(
    state.units.filter((other) => sameCell(other, visible) && visibleHover(state, other)),
    visible,
  );
  return target && target.side !== unit?.side && (target.hp ?? 0) > 0 && !target.surrendered
    ? target
    : { x: visible.x, y: visible.y, tacticalLevel: tacticalLevel(visible) };
}
/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TacticalPointer | null | undefined} point
 * @returns {import('./public/hud-types.ts').TacticalOrder} */
export function knifeThrowInputAction(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  point: TacticalPointer,
  { aim = 0, hitLocation = 'torso' } = {},
): import('./public/hud-types.ts').TacticalOrder {
  const target = knifeTarget(state, unit, point);
  return {
    type: 'throwKnife',
    aim,
    ...(target?.id
      ? { targetId: target.id, hitLocation: canChooseShotLocation(target) ? hitLocation : 'torso' }
      : { x: point?.x, y: point?.y, tacticalLevel: tacticalLevel(point), hitLocation: 'torso' }),
  };
}
/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TacticalPointer | null | undefined} point
 * @returns {import('./public/hud-types.ts').TacticalOrder} */
export function grenadeThrowInputAction(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  _unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  point: TacticalPointer,
): import('./public/hud-types.ts').TacticalOrder {
  const target = visibleThrowPoint(state, point) ?? point;
  return {
    type: 'throwGrenade',
    x: target?.x,
    y: target?.y,
    tacticalLevel: tacticalLevel(target),
    aim: 0,
  };
}
/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TacticalOrder} action
 * @returns {string} */
export function resolvedOrderType(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  action: import('./public/hud-types.ts').TacticalOrder,
): string {
  if (action.type !== 'useItem' || !unit) {
    return action.type;
  }
  if (heldGrenade(unit)) {
    return 'throwGrenade';
  }
  if (action.environment || unit.activeSlot === 'tool') {
    return 'environment';
  }
  if (unit.activeSlot === 'supply') {
    return 'supply';
  }
  if (unit.activeSlot === 'medical') {
    return 'heal';
  }
  if (unit.activeSlot === 'item' && state.npcs?.some((npc) => npc.id === action.targetId)) {
    return 'giveItem';
  }
  return contextualAttack(
    state,
    unit,
    state.units.find((target) => target.id === action.targetId),
    action,
  ).type;
}
// A firing click on an empty held gun performs one reload, never a reload and shot.
// Keep strict shot commands in the combat engine for AI and reaction validation.
/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TacticalOrder} action
 * @returns {import('./public/hud-types.ts').TacticalOrder} */
export function tacticalInputAction(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  action: import('./public/hud-types.ts').TacticalOrder,
): import('./public/hud-types.ts').TacticalOrder {
  if (!unit || !hasFirearm(unit) || unit.loaded > 0) {
    return action;
  }
  const type = resolvedOrderType(state, unit, action);
  if (!['fire', 'firePoint'].includes(type)) {
    return action;
  }
  return { type: 'reload', ...(action.unitId ? { unitId: action.unitId } : {}), aim: 0 };
}
// Keep a failed spare from blocking useful loading of the main hand. Both R
// and the existing order control choose the same next maintenance action.
/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @returns {import('./public/hud-types.ts').TacticalOrder} */
export function firearmMaintenanceAction(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
): import('./public/hud-types.ts').TacticalOrder {
  if (!unit) {
    return { type: 'reload' };
  }
  const priming = reprimePlan(unit, state);
  if (
    !unit.jammed &&
    reloadPlan(unit, state).pa > 0 &&
    (unit.loaded < 1 || !priming.hands.length)
  ) {
    return { type: 'reload' };
  }
  return { type: priming.required ? 'reprime' : 'reload' };
}
/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TacticalPointer | null | undefined} point
 * @returns {string} */
export function firearmCostText(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: BattleUnit,
  point: import('./public/hud-types.ts').TacticalPointer | null | undefined,
): string {
  if (state.mode === 'exploration') {
    return 'Sin coste de PA; consume tiempo y la munición del disparo.';
  }
  const c = actionCosts(state, unit, point);
  if (c.turn) {
    return c.ready
      ? `Preparar y girar: ${formatAP(c.setup)} PA · disparar: ${formatAP(c.discharge)} PA.`
      : `Girar: ${formatAP(c.turn)} PA · disparar: ${formatAP(c.discharge)} PA.`;
  }
  return c.ready
    ? `Preparar: ${formatAP(c.ready)} PA · disparar: ${formatAP(c.discharge)} PA.`
    : `Arma en posición de tiro · disparar: ${formatAP(c.discharge)} PA.`;
}
function reloadLabel(plan: HeldReloadPlan) {
  if (plan.partial) {
    return plan.hands?.[0]?.hand === 'offhand'
      ? 'Recarga parcial: segunda mano'
      : 'Recarga parcial';
  }
  return plan.hands?.length === 2
    ? 'Recargar ambas pistolas'
    : plan.hands?.[0]?.hand === 'offhand'
      ? 'Recargar segunda mano'
      : 'Recargar';
}
function reloadNote(state: BattleSnapshot, unit: BattleUnit, plan: HeldReloadPlan) {
  if (!plan.available) {
    return undefined;
  }
  // Only count the selected loads in this reload. Paired guns can share a
  // reserve or select different loads; an unrelated pocket is not usable stock.
  const types = new Set(
    (plan.hands ?? [{ hand: 'primary' }]).map((hand) =>
      weaponAmmoType(hand.hand === 'offhand' ? secondaryPistolView(unit) : unit),
    ),
  );
  const reserve =
    [...types].reduce((sum, type) => sum + availableAmmunition(unit, type), 0) - plan.rounds;
  if (!plan.hands) {
    return plan.partial
      ? `Carga ${plan.rounds} cartuchos ahora. Faltan ${formatAP(plan.remainingPA)} PA para completar la recarga. Continuá con R o un clic de disparo con el arma vacía.`
      : `Carga ${plan.rounds} cartucho${plan.rounds === 1 ? '' : 's'}. Quedan ${reserve} de reserva. Hacé otro clic para disparar.`;
  }
  const hands = plan.hands.map(
    (hand) =>
      `${hand.hand === 'primary' ? 'Mano principal' : 'Segunda mano'}: ${hand.partial ? 'recarga parcial, ' : ''}carga ${hand.rounds} cartucho${hand.rounds === 1 ? '' : 's'}${state.mode === 'exploration' ? '' : ` (${formatAP(hand.pa)} PA)`}.`,
  );
  return [
    ...hands,
    plan.partial
      ? `Faltan ${formatAP(plan.remainingPA)} PA para completar la recarga. Continuá con R.`
      : null,
    plan.offhandPending ? 'La segunda mano queda pendiente. Conservás los PA sobrantes.' : null,
    `Quedan ${reserve} cartuchos de reserva.`,
    plan.partial ? null : 'Hacé otro clic para disparar.',
  ]
    .filter(Boolean)
    .join(' ');
}
/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @returns {import('./public/hud-types.ts').ActionPreview | null} */
export function emptyGunPreview(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
): import('./public/hud-types.ts').ActionPreview | null {
  if (!unit || !hasFirearm(unit) || unit.loaded > 0) {
    return null;
  }
  const plan = reloadPlan(unit, state),
    rounds = plan.available,
    pa = state.mode === 'exploration' ? 0 : plan.pa;
  const reason =
    plan.reason ??
    (!rounds
      ? `Sin munición compatible. Requiere ${AMMUNITION_TYPES[weaponAmmoType(unit) ?? '']?.name ?? 'la carga del arma'}.`
      : unit.jammed && firearmServiceable(unit)
        ? 'Cebá el arma antes de recargar (R).'
        : unit.knockedDown
          ? 'Primero debés levantarte.'
          : !unitCanAct(state, unit)
            ? 'El combatiente no puede actuar.'
            : !plan.pa || !affordable(state, unit, plan.pa)
              ? 'PA insuficientes para recargar.'
              : null);
  return {
    name: weaponFor(unit).name,
    actionLabel: rounds ? reloadLabel(plan) : 'Sin munición',
    attackType: 'reload',
    cursor: rounds ? 'reload' : 'empty',
    pa,
    chance: undefined,
    chanceLabel: undefined,
    hitLocation: undefined,
    attackLabel: undefined,
    remaining: Math.max(0, unit.ap - (state.mode === 'exploration' || reason ? 0 : pa)),
    rounds: plan.rounds,
    partial: plan.partial,
    remainingReloadPA: plan.remainingPA,
    reloadProgress: plan.progress,
    reason,
    valid: !reason,
    coverNote: reloadNote(state, unit, plan),
  };
}
/** @type {[import('./public/compatibility-types.ts').BattleUnit["stance"], string][]} */
export const STANCES: [import('./public/compatibility-types.ts').BattleUnit['stance'], string][] = [
  ['standing', 'De pie'],
  ['crouched', 'Agachado'],
  ['prone', 'Cuerpo a tierra'],
];
/** @param {string | undefined} stance @returns {string} */
export const stanceLabel = (stance: string | undefined): string =>
  STANCES.find(([id]) => id === stance)?.[1] || 'De pie';
/** @param {import('./public/compatibility-types.ts').BattleUnit} unit @returns {import('./public/compatibility-types.ts').BattleUnit["stance"]} */
export const nextStance = (
  unit: import('./public/compatibility-types.ts').BattleUnit,
): import('./public/compatibility-types.ts').BattleUnit['stance'] =>
  unit.knockedDown
    ? 'standing'
    : (STANCES[(STANCES.findIndex(([id]) => id === unit.stance) + 1) % STANCES.length]?.[0] ??
      'standing');
const COMPASS_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
/** @param {import('./public/compatibility-types.ts').BattleUnit} unit @returns {string} */
export const facingLabel = (unit: import('./public/compatibility-types.ts').BattleUnit): string =>
  COMPASS_LABELS[directionTo(unit, unit)] ?? 'E';
/** @type {["torso" | "head" | "legs", string][]} */
export const HIT_LOCATIONS: ['torso' | 'head' | 'legs', string][] = [
  ['torso', 'Torso'],
  ['head', 'Cabeza'],
  ['legs', 'Piernas'],
];
const hitLocationFor = (value: string | undefined): 'torso' | 'head' | 'legs' =>
  value === 'head' || value === 'legs' ? value : 'torso';

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @returns {unit is import('./public/compatibility-types.ts').BattleUnit} */
export function unitCanAct(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
): unit is import('./public/compatibility-types.ts').BattleUnit {
  return (
    unit != null &&
    !unit.militia &&
    (!state.alliedTurn || state.phase === 'interrupt') &&
    interruptAvailable(state, unit)
  );
}

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @returns {boolean} */
export function groupSelectionMode(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
): boolean {
  return (
    state.status === 'active' &&
    state.mode === 'exploration' &&
    state.phase === 'player' &&
    !state.interrupt &&
    !state.enemyTurn &&
    !state.reactionStack?.length
  );
}

/** Submits a settled deployment report; this does not move anyone across a sector edge. */
/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {boolean} [peacefulVisit] */
export function campaignReturnModel(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  peacefulVisit: boolean = false,
) {
  const settled =
    state.status === 'active' &&
    state.mode === 'exploration' &&
    state.phase === 'player' &&
    !state.interrupt &&
    !state.enemyTurn &&
    !state.reactionStack &&
    !state.contactInitiative;
  const available =
    settled &&
    (state.sectorCleared === true || peacefulVisit) &&
    state.units.some((unit) => unit.side === 'player' && fieldCapable(unit)) &&
    !state.units.some((unit) => unit.side === 'enemy' && fieldCapable(unit));
  return {
    available,
    label: 'Volver a la campaña',
    note: state.units.some((unit) => unit.side === 'player' && unit.departure)
      ? 'Quienes siguen aquí permanecen en este sector.'
      : 'La escuadra permanece en este sector.',
  };
}

/** @param {import('./public/compatibility-types.ts').BattleUnit[]} units
 * @param {import('./public/hud-types.ts').TacticalPointer | null | undefined} point
 * @returns {import('./public/compatibility-types.ts').BattleUnit | undefined} */
export function cellOccupant(
  units: import('./public/compatibility-types.ts').BattleUnit[],
  point: import('./public/hud-types.ts').TacticalPointer | null | undefined,
): import('./public/compatibility-types.ts').BattleUnit | undefined {
  if (!point) {
    return undefined;
  }
  const occupants = units.filter((unit) => !unit.fled && !unit.departure && sameCell(unit, point));
  return (
    occupants.find((unit) => unit.id === point.id) ||
    occupants.find((unit) => unit.hp > 0) ||
    occupants[0]
  );
}

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TacticalPointer | null | undefined} point
 * @returns {boolean} */
export function isMovementGround(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  point: import('./public/hud-types.ts').TacticalPointer | null | undefined,
): boolean {
  if (point?.wallEdgeId) {
    return false;
  }
  if (!point) {
    return false;
  }
  const occupied = state.units.some(
    (target) =>
      (target.hp ?? 0) > 0 &&
      !target.fled &&
      !target.departure &&
      sameCell(target, point) &&
      (target.side === 'player' ||
        state.units.some(
          (observer) => observer.side === 'player' && canSee(state, observer, target),
        )),
  );
  const environment = environmentTargetAt(state, point);
  return !occupied && !(unit && environment && canSee(state, unit, environment));
}
/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TacticalPointer | null | undefined} point
 * @returns {boolean} */
export function isGroupGround(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  point: import('./public/hud-types.ts').TacticalPointer | null | undefined,
): boolean {
  return groupSelectionMode(state) && isMovementGround(state, unit, point);
}

/** @param {import('./public/hud-types.ts').TacticalPointer | null | undefined} point
 * @param {import('./public/compatibility-types.ts').MovementIntent} [movementIntent]
 * @returns {Omit<import('./public/compatibility-types.ts').MoveAction, 'unitId'>} */
export function movementAction(
  point: TacticalPointer,
  movementIntent: import('./public/compatibility-types.ts').MovementIntent = 'forward',
): Omit<import('./public/compatibility-types.ts').MoveAction, 'unitId'> {
  return {
    type: 'move',
    x: point.x,
    y: point.y,
    tacticalLevel: tacticalLevel(point),
    ...(movementIntent === 'preserveFacing' ? { movementIntent } : {}),
  };
}

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {string[]} ids
 * @param {string} targetId
 * @param {string | undefined} selectedId
 * @returns {string[]} */
export function toggleMovementGroup(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  ids: string[],
  targetId: string,
  selectedId: string | undefined,
): string[] {
  const target = state.units.find((unit) => unit.id === targetId);
  if (
    !groupSelectionMode(state) ||
    !target ||
    target.side !== 'player' ||
    !unitCanAct(state, target)
  ) {
    return ids;
  }
  const current = ids.filter((id) =>
    state.units.some((unit) => unit.id === id && unit.side === 'player' && !unit.departure),
  );
  if (current.includes(targetId)) {
    return current.filter((id) => id !== targetId);
  }
  const selected = state.units.find((unit) => unit.id === selectedId);
  if (!current.length && selected?.side === 'player' && unitCanAct(state, selected)) {
    current.push(selected.id);
  }
  return [...new Set([...current, targetId])];
}

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {string[]} ids
 * @param {string | undefined} selectedId
 * @param {import('./public/hud-types.ts').TacticalPointer | null | undefined} point
 * @returns {import('./public/hud-types.ts').MovementGroupModel} */
export function movementGroupModel(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  ids: string[],
  selectedId: string | undefined,
  point: import('./public/hud-types.ts').TacticalPointer | null | undefined,
  { preview = true } = {},
): import('./public/hud-types.ts').MovementGroupModel {
  const members = groupSelectionMode(state)
    ? [...new Set(ids)].flatMap((id) => {
        const unit = state.units.find(
          (unit) => unit.id === id && unit.side === 'player' && !unit.departure && !unit.fled,
        );
        return unit ? [{ id, name: unit.nickname || unit.name }] : [];
      })
    : [];
  const anchorId = members.some((unit) => unit.id === selectedId) ? selectedId : members[0]?.id;
  const request =
    members.length && point && anchorId
      ? {
          unitIds: members.map((unit) => unit.id),
          anchorId,
          x: point.x,
          y: point.y,
          ...(state.upperSurfaces?.length || point.tacticalLevel !== undefined
            ? { tacticalLevel: tacticalLevel(point) }
            : {}),
        }
      : null;
  return {
    members,
    anchorId,
    request,
    preview: preview && request ? planGroupMove(state, request) : null,
  };
}

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').CampaignContext} [context] */
export function turnModel(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  context: import('./public/compatibility-types.ts').CampaignContext = null,
) {
  const interrupted = state.phase === 'interrupt' && state.interrupt?.side === 'player';
  const selected = context ?? state;
  const packaged = campaignDefinitions(selected);
  const faction = packaged
    ? campaignFactionName(selected, state.phase === 'enemy' ? 'royalist' : 'patriot')
    : state.phase === 'enemy'
      ? 'Ejército realista'
      : 'Ejército patriota';
  return {
    interrupted,
    label: interrupted
      ? 'Interrupción'
      : state.mode === 'exploration'
        ? 'Exploración libre'
        : `Turno ${state.turn} · ${faction}`,
    endLabel: interrupted
      ? 'Continuar turno enemigo'
      : state.mode === 'exploration'
        ? 'Descansar'
        : 'Fin del turno',
    units: interrupted ? state.units.filter((u) => unitCanAct(state, u)) : [],
    canExplore: canEndCombat(state),
  };
}

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TargetingContext} [ctx]
 * @returns {{id:string,label:string,active:boolean,disabled:boolean}[]} */
export function shotLocationOptions(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  ctx: import('./public/hud-types.ts').TargetingContext = {},
): { id: string; label: string; active: boolean; disabled: boolean }[] {
  if (ctx.mode === 'throwGrenade') {
    return [];
  }
  if (ctx.mode === 'throwKnife' && explicitPointShot(state, ctx.target)) {
    return [];
  }
  if (
    ctx.mode === 'fire' &&
    ctx.target &&
    (explicitPointShot(state, ctx.target) ||
      !cellOccupant(
        state.units.filter(
          (other) =>
            other.side !== unit?.side &&
            other.hp > 0 &&
            !other.surrendered &&
            visibleHover(state, other),
        ),
        ctx.target,
      ))
  ) {
    return [];
  }
  if (!unit || !(hasFirearm(unit) || (ctx.mode === 'throwKnife' && heldThrowingKnife(unit)))) {
    return [];
  }
  return HIT_LOCATIONS.filter(
    ([id]) => !ctx.target || canChooseShotLocation(ctx.target) || id === 'torso',
  ).map(([id, label]) => ({
    id,
    label,
    active: id === hitLocationFor(ctx.hitLocation),
    disabled: !unitCanAct(state, unit) || Boolean(ctx.busy),
  }));
}

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit */
export function heardNoiseModel(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
) {
  const noise = unit?.lastHeardNoise;
  if (
    !unit ||
    !alive(unit) ||
    !noise ||
    noise.investigated ||
    !Number.isInteger(noise.turn) ||
    state.turn - noise.turn > 3 ||
    state.turn < noise.turn
  ) {
    return null;
  }
  if (
    !Number.isFinite(noise.x) ||
    !Number.isFinite(noise.y) ||
    !Number.isFinite(noise.uncertainty) ||
    noise.uncertainty < 0
  ) {
    return null;
  }
  return {
    x: noise.x,
    y: noise.y,
    ...(noise.tacticalLevel === undefined ? {} : { tacticalLevel: noise.tacticalLevel }),
    radius: noise.uncertainty,
    label: 'Ruido: zona aproximada',
  };
}

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/hud-types.ts').TacticalPointer | null | undefined} point
 * @returns {import('./public/hud-types.ts').TacticalPointer | null} */
export function visibleHover(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  point: import('./public/hud-types.ts').TacticalPointer | null | undefined,
): import('./public/hud-types.ts').TacticalPointer | null {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return null;
  }
  if (point.wallEdgeId) {
    const edge = (state.wallEdges ?? []).find((edge) => wallEdgeId(edge) === point.wallEdgeId);
    return edge && state.units.some((unit) => unit.side === 'player' && canSee(state, unit, edge))
      ? { ...edge, wallEdgeId: wallEdgeId(edge) }
      : null;
  }
  if (point.anonymous) {
    return {
      x: point.x,
      y: point.y,
      ...(point.tacticalLevel === undefined ? {} : { tacticalLevel: point.tacticalLevel }),
      anonymous: true,
    };
  }
  const unit =
    point.id && point.targetKind !== 'npc'
      ? state.units.find((unit) => unit.id === point.id)
      : null;
  const npc = !unit && point.id ? (state.npcs || []).find((npc) => npc.id === point.id) : null;
  const target = unit || npc;
  if (!target) {
    return point;
  }
  if (
    target.departure ||
    target.fled ||
    (target.side !== 'player' &&
      !state.units.some(
        (observer) => observer.side === 'player' && canSee(state, observer, target),
      ))
  ) {
    return null;
  }
  return npc && point.targetKind === 'npc' ? { ...npc, targetKind: 'npc' } : target;
}

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {string | undefined} selectedId
 * @returns {import('./public/hud-types.ts').TacticalPointer | null} */
export function interruptHover(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  selectedId: string | undefined,
): import('./public/hud-types.ts').TacticalPointer | null {
  const enemy = state.units.find((unit) => unit.id === state.interrupt?.enemyId);
  const seen = visibleHover(state, enemy);
  if (seen) {
    return seen;
  }
  const eligible = state.units.filter((unit) => unitCanAct(state, unit));
  const observer = eligible.find((unit) => unit.id === selectedId) || eligible[0];
  const noise = heardNoiseModel(state, observer);
  return noise
    ? {
        x: noise.x,
        y: noise.y,
        ...(noise.tacticalLevel === undefined ? {} : { tacticalLevel: noise.tacticalLevel }),
        anonymous: true,
      }
    : null;
}

/** @param {string} mode
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TargetingContext} [ctx]
 * @returns {string} */
export function targetingHelp(
  mode: string,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  ctx: import('./public/hud-types.ts').TargetingContext = {},
): string {
  if (mode === 'move' && heldGrenade(unit)) {
    return 'Granada en mano: clic en el suelo para caminar. Botón derecho o F: preparar el lanzamiento. Otro clic derecho vuelve a movimiento.';
  }
  if (grenadeTargetingMode(unit, mode)) {
    return 'Granada: clic en una casilla para lanzar. Otro clic derecho o Esc vuelve a movimiento. No permite aumentar la puntería ni elegir una parte del cuerpo. La explosión puede herir aliados.';
  }
  if (mode === 'throwKnife') {
    return 'Facón: clic para lanzar; botón derecho para apuntar más, incluso a una casilla vacía. Esc vuelve al cursor de movimiento.';
  }
  if (mode === 'talk') {
    return 'Hablar: seleccioná una persona visible y contigua. Esc vuelve al cursor de movimiento.';
  }
  if (
    (ctx.itemIntent === 'steal' && ['move', 'useItem'].includes(mode)) ||
    (mode === 'loot' && unit?.activeSlot === 'unarmed')
  ) {
    return 'Manos libres: seleccioná un enemigo contiguo para quitarle el arma. Requiere 7 PA como mínimo y consume todos los restantes. Los cuerpos se registran.';
  }
  if (unit?.activeSlot === 'unarmed' && ['move', 'useItem'].includes(mode)) {
    return mode === 'useItem'
      ? 'Puños: seleccioná un enemigo o una casilla para acercarte y golpear. Esc: caminar.'
      : 'Seleccioná un enemigo para golpear. F: golpear una casilla. Ctrl+clic: quitar el arma.';
  }
  if (mode === 'fire') {
    return 'Disparo deliberado: seleccioná un enemigo o una casilla. Una casilla no confirma un objetivo; el tiro puede herir aliados. G o Esc vuelve al uso contextual.';
  }
  if (mode === 'look') {
    return 'Seleccioná hacia dónde mirar. El giro consume PA. Con un arma de fuego, mirá otra vez en la misma dirección para prepararla sin disparar. La vista previa muestra el costo. F: usar el arma en el modo elegido; Esc: cancelar.';
  }
  if (mode === 'move' && ctx.movementIntent === 'preserveFacing') {
    return 'Alt: mové solo al seleccionado sin girar. Cancela el grupo. Caminar, agachado o cuerpo a tierra; no correr ni montar.';
  }
  if (unit?.activeSlot === 'supply' && unit.activeSupply && ['move', 'useItem'].includes(mode)) {
    return (
      {
        torches:
          'Seleccioná una casilla para arrojar la antorcha. Para avanzar, cambiá el objeto en mano.',
        boleadoras:
          'Seleccioná un enemigo visible o una casilla para lanzar las boleadoras. Para avanzar, cambiá el objeto en mano.',
        rations:
          'Seleccionate a vos para comer la ración. Recupera fuerzas; no detiene hemorragias.',
      }[unit.activeSupply] || 'Equipá un pertrecho disponible.'
    );
  }
  if (unit?.activeSlot === 'item' && ['move', 'useItem'].includes(mode)) {
    return 'Objeto en mano: podés guardarlo, darlo o soltarlo. Para atacar, prepará un arma o las manos libres.';
  }
  if (unit?.activeSlot === 'tool' && ['move', 'useItem'].includes(mode)) {
    return `Seleccioná ${toolTargets(unit)} para usar la herramienta. Las casillas libres permiten avanzar.`;
  }
  if (
    unit &&
    hasFirearm(unit) &&
    unit.weaponMode === 'melee' &&
    ['move', 'useItem'].includes(mode)
  ) {
    return `${fixedBayonetFor(unit) ? 'Bayoneta' : 'Culatazo'}: ${mode === 'useItem' ? 'seleccioná un enemigo o una casilla para acercarte y golpear. Esc: caminar.' : 'clic en el suelo para caminar; F o botón derecho para golpear una casilla.'} B: volver a Disparo.`;
  }
  if (heldThrowingKnife(unit) && ['move', 'useItem'].includes(mode)) {
    return 'Clic sobre un enemigo: acercarse y atacar con el facón. Botón derecho o F: apuntar para lanzarlo.';
  }
  if (mode === 'useItem') {
    return unit?.activeSlot === 'medical'
      ? 'Seleccionate a vos, a un aliado o a un civil herido. Se acerca y venda si hay ruta y PA suficientes. Reduce la hemorragia y estabiliza heridas críticas hasta 15 de salud. Puede necesitar más de una venda.'
      : hasFirearm(unit || {})
        ? 'Seleccioná un enemigo. Apuntar consume PA adicionales.'
        : 'Seleccioná un enemigo para acercarte y usar el arma blanca.';
  }
  return (
    {
      move: 'Seleccioná una casilla para avanzar. Sobre un combatiente se usa el objeto equipado.',
      loot: 'Seleccioná un cuerpo o equipo visible. Elegí qué recoger; los PA incluyen el desplazamiento.',
      torch: 'Seleccioná una casilla para arrojar la antorcha.',
      bolas: 'Seleccioná un enemigo o una casilla para lanzar las boleadoras.',
      artillery: 'Seleccioná un objetivo dentro del arco del cañón.',
      artilleryMove: 'Seleccioná una casilla contigua al cañón.',
      artilleryPivot: 'Seleccioná hacia dónde apuntar el cañón.',
    }[mode] || 'Seleccioná una orden.'
  );
}

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TargetingContext} [ctx]
 * @returns {{level:number,pa:number,disabled:boolean}[]} */
export function aimOptions(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  ctx: import('./public/hud-types.ts').TargetingContext = {},
): { level: number; pa: number; disabled: boolean }[] {
  if (grenadeTargetingMode(unit, ctx.mode ?? 'move')) {
    const preview = grenadeThrowPreview(state, unit, visibleThrowPoint(state, ctx.target), {
      aim: 0,
    });
    return [
      {
        level: 0,
        pa: state.mode === 'exploration' ? 0 : preview.pa,
        disabled: Boolean(ctx.busy) || !preview.valid,
      },
    ];
  }
  if (ctx.mode === 'throwKnife') {
    const target = knifeTarget(state, unit, ctx.target);
    return Array.from({ length: 5 }, (_, level) => {
      const preview = knifeThrowPreview(state, unit, target, {
        aim: level,
        hitLocation: target?.id ? (ctx.hitLocation ?? 'torso') : 'torso',
      });
      return {
        level,
        pa: state.mode === 'exploration' ? 0 : preview.pa,
        disabled: Boolean(ctx.busy) || !preview.valid,
      };
    });
  }
  const costs = unit ? actionCosts(state, unit, ctx.target) : { fire: 0, aim: 0 };
  const ready =
    unitCanAct(state, unit) &&
    hasFirearm(unit) &&
    unit.loaded > 0 &&
    !unit.jammed &&
    !unit.knockedDown &&
    !ctx.busy;
  return Array.from({ length: 5 }, (_, level) => {
    const pa = costs.fire + level * costs.aim;
    return { level, pa, disabled: !ready || !affordable(state, unit, pa) };
  });
}

// A read-only preview of the selected action. Enemy data must already be visible.
/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TacticalPointer | null | undefined} point
 * @param {import('./public/hud-types.ts').TargetingContext} [ctx]
 * @returns {import('./public/hud-types.ts').ActionPreview | null} */
export function targetPreview(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  point: import('./public/hud-types.ts').TacticalPointer | null | undefined,
  ctx: import('./public/hud-types.ts').TargetingContext = {},
): import('./public/hud-types.ts').ActionPreview | null {
  const preview = targetPreviewWithCosts(state, unit, point, ctx);
  return state.mode === 'exploration' && preview
    ? { ...preview, ...(preview.pa === undefined ? {} : { pa: 0, remaining: unit?.ap }) }
    : preview;
}
function meleePreparationText(
  state: BattleSnapshot,
  preview: { stancePa?: number; movePa?: number; strikePa?: number; actionPa?: number },
) {
  if (!preview.stancePa && !preview.movePa) {
    return undefined;
  }
  if (state.mode === 'exploration') {
    return `${preview.movePa ? (preview.stancePa ? 'Se acerca, se levanta y ataca' : 'Se acerca y ataca') : 'Se levanta antes de atacar'}. Sin coste de PA; consume tiempo${preview.movePa ? ' y energía' : ''}. El contacto puede detener la acción.`;
  }
  return (
    [
      preview.movePa ? `Desplazamiento: ${formatAP(preview.movePa)} PA` : null,
      preview.stancePa ? `Levantarse: ${formatAP(preview.stancePa)} PA` : null,
      `ataque: ${formatAP(preview.strikePa ?? preview.actionPa ?? 0)} PA`,
    ]
      .filter(Boolean)
      .join(' · ') + '. El contacto puede detener la acción.'
  );
}
function medicalTreatmentText(
  state: BattleSnapshot,
  preview: Pick<ItemUsePreview, 'valid' | 'movePa' | 'actionPa' | 'treatment' | 'composureRelief'>,
) {
  if (!preview.valid || !preview.treatment) {
    return undefined;
  }
  const treatment = preview.treatment;
  const approach = preview.movePa
    ? state.mode === 'exploration'
      ? 'Se acerca. Consume tiempo y energía.'
      : `Desplazamiento: ${formatAP(preview.movePa)} PA · vendas: ${formatAP(preview.actionPa)} PA.`
    : '';
  return [
    approach,
    'Usa una venda.',
    treatment.hpGain > 0 ? `Salud: +${treatment.hpGain}, hasta ${treatment.hpAfter}.` : null,
    treatment.bleedingAfter > 0
      ? `Hemorragia restante: ${treatment.bleedingAfter}.`
      : 'Sin hemorragia al terminar.',
    treatment.partial
      ? 'Tratamiento parcial: necesita más vendas.'
      : treatment.critical
        ? 'Estabilizado. La recuperación completa requiere atención en campaña.'
        : 'Las heridas quedan vendadas; la recuperación de salud requiere atención en campaña.',
    (preview.composureRelief ?? 0) > 0
      ? (preview.composureRelief ?? 0) < 0.01
        ? 'La tensión del sanitario baja menos de 0,01.'
        : `Tensión del sanitario: −${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(preview.composureRelief ?? 0)}.`
      : null,
    preview.movePa ? 'El contacto puede detener la acción.' : null,
  ]
    .filter(Boolean)
    .join(' ');
}
function pendingMovementPreview(point: TacticalPoint, ctx: TargetingContext): ActionPreview | null {
  if (!ctx.routesPending && !ctx.routesFailed) {
    return null;
  }
  return {
    name: tacticalGridLabel(point.x, point.y),
    actionLabel: 'Mover',
    valid: false,
    pending: Boolean(ctx.routesPending),
    reason: ctx.routesPending
      ? 'Calculando ruta…'
      : 'No se pudo calcular la vista previa. La ruta se comprobará al dar la orden.',
  };
}
function movementTargetPreview(
  state: BattleSnapshot,
  unit: BattleUnit,
  point: TacticalPoint,
  ctx: TargetingContext,
): ActionPreview {
  const pending = pendingMovementPreview(point, ctx);
  if (pending) {
    return pending;
  }
  const destination = (ctx.reachable ?? []).find((p) => sameCell(p, point)),
    pa = destination ? (state.mode === 'exploration' ? 0 : destination.cost) : undefined;
  const reason = !unitCanAct(state, unit)
    ? 'El combatiente no puede actuar.'
    : unit.knockedDown
      ? 'Primero debés levantarte.'
      : !destination
        ? 'Destino inaccesible.'
        : state.mode !== 'exploration' && pa !== undefined && pa > unit.ap
          ? 'PA insuficientes.'
          : null;
  return {
    name: tacticalGridLabel(point.x, point.y),
    actionLabel: 'Mover',
    movement: true,
    path: destination?.path,
    pa,
    remaining: pa === undefined ? undefined : Math.max(0, unit.ap - pa),
    valid: !reason,
    reason,
  };
}
function targetPreviewWithCosts(
  state: BattleSnapshot,
  unit: BattleUnit | null | undefined,
  point: TacticalPointer | null | undefined,
  ctx: TargetingContext = {},
): ActionPreview | null {
  if (!unit) {
    return null;
  }
  const mode = ctx.mode || 'move';
  if (grenadeTargetingMode(unit, mode)) {
    const target = visibleThrowPoint(state, point),
      preview = grenadeThrowPreview(state, unit, target, { aim: 0 });
    const friendlyRisk = Array.isArray(preview.friendlyRisk)
      ? preview.friendlyRisk.length > 0
      : Boolean(preview.friendlyRisk);
    const reach = Number.isFinite(preview.range?.maximum)
      ? `Alcance ${Math.round(preview.range.maximum * 10) / 10} casillas.`
      : '';
    const blocked = Boolean(preview.flight?.blocked),
      landing = preview.flight?.landing,
      landingLabel = landing
        ? `${tacticalGridLabel(landing.x, landing.y)}${tacticalLevel(landing) > 0 ? ` · nivel ${tacticalLevel(landing)}` : ''}`
        : undefined;
    return {
      name: target ? tacticalGridLabel(target.x, target.y) : 'Granada',
      actionLabel: 'Lanzar granada',
      attackLabel: 'Lanzar granada',
      attackType: 'throwGrenade',
      pa: preview.pa,
      energy: preview.costs?.energy,
      chance: blocked ? undefined : preview.chance,
      chanceLabel: 'precisión',
      remaining: Math.max(0, unit.ap - (state.mode === 'exploration' ? 0 : preview.pa)),
      valid: preview.valid,
      reason: preview.reason,
      blastRadius: preview.blastRadius,
      friendlyRisk,
      blocked,
      landing,
      landingLabel,
      coverNote: [
        blocked
          ? `Un obstáculo corta la trayectoria. Caída prevista: ${landingLabel ?? 'antes del objetivo'}.`
          : null,
        preview.costs?.energy > 0 ? `${preview.costs.energy} EN.` : null,
        reach,
        Number.isFinite(preview.blastRadius)
          ? `Radio de explosión: ${preview.blastRadius} casillas.`
          : null,
        friendlyRisk
          ? 'Aliados dentro del radio de explosión.'
          : 'La explosión puede herir a cualquiera en la zona.',
      ]
        .filter(Boolean)
        .join(' '),
    };
  }
  if (mode === 'throwKnife') {
    const target = knifeTarget(state, unit, point),
      preview = knifeThrowPreview(state, unit, target, {
        aim: ctx.aim ?? 0,
        hitLocation: target?.id ? hitLocationFor(ctx.hitLocation) : 'torso',
      });
    const label = target?.id
      ? (HIT_LOCATIONS.find(([id]) => id === preview.hitLocation)?.[1] ?? 'Torso')
      : undefined;
    const reach = preview.range?.nominal
      ? `Alcance útil ${Math.round(preview.range.nominal * 10) / 10} casillas.`
      : '';
    return {
      name: target?.id
        ? (target.name ?? 'Objetivo')
        : point
          ? tacticalGridLabel(point.x, point.y)
          : 'Facón',
      actionLabel: 'Lanzar facón',
      attackType: 'throwKnife',
      pa: preview.pa,
      energy: preview.costs?.energy ?? 6,
      chance: target?.id ? preview.chance : undefined,
      hitLocation: label,
      remaining: Math.max(0, unit.ap - (state.mode === 'exploration' ? 0 : preview.pa)),
      valid: preview.valid,
      reason: preview.reason,
      coverNote: `6 EN · ${reach} ${preview.flight?.blocked ? 'La cobertura detiene el facón.' : preview.flight?.victimId && preview.flight.victimId !== target?.id ? 'Un combatiente se interpone: podés herirlo.' : !target?.id ? 'Puede herir a quien esté en su trayectoria.' : 'El facón se puede recuperar tras el impacto.'}`,
    };
  }
  const reload = mode === 'fire' ? emptyGunPreview(state, unit) : null;
  if (reload) {
    return reload;
  }
  if (!point) {
    return null;
  }
  if (point.wallEdgeId) {
    const environment = environmentTargetAt(state, point);
    if (!environment || !canSee(state, unit, environment)) {
      return null;
    }
    const preview = environmentUsePreview(state, unit, environment),
      summary = environmentTargetSummary(unit, environment);
    return {
      name: summary.label,
      actionLabel: preview.label,
      pa: preview.pa,
      remaining: Math.max(0, unit.ap - (state.mode === 'exploration' ? 0 : preview.pa)),
      valid: preview.valid,
      reason: preview.reason,
      attackType: 'environment',
      coverNote: preview.movePa
        ? `Desplazamiento: ${formatAP(preview.movePa)} PA · uso: ${formatAP(preview.actionPa)} PA.`
        : undefined,
    };
  }
  if (
    ctx.itemIntent === 'moveOnly' &&
    ['move', 'useItem', 'loot'].includes(mode) &&
    isMovementGround(state, unit, point)
  ) {
    return movementTargetPreview(state, unit, point, ctx);
  }
  const civilianAid = civilianMedicalInputAction(state, unit, point, mode);
  if (civilianAid) {
    const patient = state.npcs.find((n) => n.id === civilianAid.targetId);
    if (!patient) {
      return null;
    }
    const options = { targetKind: 'npc' };
    const local = mode === 'heal' ? medicalUsePreview(state, unit, patient, options) : null;
    const preview = local
      ? {
          pa: local.cost,
          valid: local.allowed,
          reason: local.reason,
          movePa: 0,
          actionPa: local.cost,
          treatment: local.treatment,
          ...((local.composureRelief ?? 0) > 0 ? { composureRelief: local.composureRelief } : {}),
        }
      : itemUsePreview(state, unit, patient, options);
    if (!preview) {
      return null;
    }
    return {
      name: patient.name,
      actionLabel: preview.movePa ? 'Acercarse y vendar' : 'Vendar',
      pa: preview.pa,
      remaining: Math.max(0, unit.ap - (state.mode === 'exploration' ? 0 : preview.pa)),
      valid: preview.valid,
      reason: preview.reason,
      treatment: preview.treatment,
      ...((preview.composureRelief ?? 0) > 0 ? { composureRelief: preview.composureRelief } : {}),
      coverNote: medicalTreatmentText(state, preview),
    };
  }
  const recipient = state.npcs?.find(
    (n) => !n.departure && !n.fled && sameCell(n, point) && canSee(state, unit, n),
  );
  if (
    recipient &&
    unit.activeSlot === 'item' &&
    !heldGrenade(unit) &&
    ['move', 'useItem'].includes(mode)
  ) {
    const gift = npcGiftPreview(state, unit, recipient);
    return {
      name: recipient.name,
      actionLabel: gift.label,
      pa: gift.pa,
      remaining: unit.ap,
      valid: gift.valid,
      reason: gift.reason,
      coverNote: [
        beneficiaryDeliveryNotice(gift.beneficiaryDelivery, state),
        'Se entrega el objeto que está en la mano. No se usa la reserva del cuartel.',
      ]
        .filter(Boolean)
        .join(' '),
    };
  }
  const occupants = state.units.filter(
    (v) =>
      sameCell(v, point) &&
      !v.fled &&
      !v.departure &&
      (v.side === unit.side ||
        state.units.some((p) => p.side === unit.side && canSee(state, p, v))),
  );
  const target = cellOccupant(occupants, point);
  if (
    mode === 'fire' &&
    (explicitPointShot(state, point) ||
      !target ||
      target.side === unit.side ||
      target.hp <= 0 ||
      target.surrendered)
  ) {
    const preview = pointFirePreview(state, unit, point, ctx.aim ?? 0);
    const paired = pairedPistol(unit),
      shotLoad =
        weaponFor(unit).loadPattern === 'cone' ||
        (paired && weaponFor(secondaryPistolView(unit, paired)).loadPattern === 'cone');
    return {
      name: tacticalGridLabel(point.x, point.y),
      actionLabel: paired ? 'Disparar ambas pistolas a la casilla' : 'Disparar a la casilla',
      attackType: 'fire',
      pa: preview.pa,
      remaining: Math.max(0, unit.ap - (state.mode === 'exploration' ? 0 : preview.pa)),
      valid: preview.valid,
      reason: preview.reason,
      coverNote: `${firearmCostText(state, unit, point)} ${paired ? 'Un disparo por pistola. ' : ''}${shotLoad ? 'Carga de perdigones. ' : ''}Sin objetivo confirmado. Altura de apuntado fija; la cobertura y los cuerpos pueden interceptar el tiro. Puede herir aliados.`,
    };
  }
  if (!target && !recipient && meleePointTargetingMode(unit, mode) && ctx.itemIntent !== 'steal') {
    const preview = meleePointPreview(state, unit, point),
      label =
        unit.activeSlot === 'unarmed'
          ? 'Puños'
          : fixedBayonetFor(unit)
            ? 'Estocada de bayoneta'
            : hasFirearm(unit)
              ? 'Culatazo'
              : bladeFor(unit).name;
    return {
      name: tacticalGridLabel(point.x, point.y),
      actionLabel: preview.movePa
        ? 'Acercarse y golpear la casilla'
        : preview.stancePa
          ? 'Levantarse y golpear la casilla'
          : 'Golpear la casilla',
      attackLabel: label,
      attackType: 'meleePoint',
      pa: preview.pa,
      remaining: Math.max(0, unit.ap - (state.mode === 'exploration' ? 0 : preview.pa)),
      valid: preview.valid,
      reason: preview.reason,
      coverNote: [meleePreparationText(state, preview), 'Golpe al vacío.']
        .filter(Boolean)
        .join(' '),
    };
  }
  if (
    target &&
    target.side !== unit.side &&
    pickupTargetAction(target, unit).type === 'steal' &&
    ((ctx.itemIntent === 'steal' && ['move', 'useItem'].includes(mode)) || mode === 'loot')
  ) {
    const preview = stealPreview(state, unit, target);
    return {
      name: target.name,
      actionLabel: 'Quitar arma',
      attackLabel: 'Quitar arma',
      pa: preview.pa,
      remaining: state.mode === 'exploration' ? unit.ap : 0,
      reason: preview.reason,
      valid: preview.valid,
      coverNote: 'Intento disputado: consume todos los PA restantes, también si falla.',
    };
  }
  const preserveFacing =
    mode === 'move' &&
    ctx.movementIntent === 'preserveFacing' &&
    isMovementGround(state, unit, point);
  if (preserveFacing) {
    const pending = pendingMovementPreview(point, ctx);
    if (pending) {
      return pending;
    }
    const destination = (
      ctx.reachable ||
      getReachable({ ...state, artillery: knownArtillery(state, unit) }, unit, {
        movementIntent: 'preserveFacing',
      })
    ).find((tile) => sameCell(tile, point));
    const reason =
      movementIntentReason(unit, 'preserveFacing') ||
      (!unitCanAct(state, unit)
        ? 'El combatiente no puede actuar.'
        : unit.knockedDown
          ? 'Primero debés levantarte.'
          : unit.entangled
            ? 'Primero debés liberarte de las boleadoras.'
            : !destination || !destination.path.length
              ? 'Destino inaccesible o PA insuficientes.'
              : null);
    const pa = destination ? (state.mode === 'exploration' ? 0 : destination.cost) : undefined;
    const insufficient = state.mode !== 'exploration' && pa !== undefined && pa > unit.ap;
    return {
      name: `${tacticalGridLabel(point.x, point.y)}`,
      actionLabel: 'Mover sin girar',
      movement: true,
      path: destination?.path,
      pa,
      remaining: pa === undefined ? undefined : Math.max(0, unit.ap - pa),
      reason: reason || (insufficient ? 'PA insuficientes.' : null),
      valid: !reason && !insufficient,
    };
  }
  const pickup = pickupSelection(state, unit, point, ctx);
  const p = pickup[0];
  if (p) {
    return {
      name: 'Equipo',
      actionLabel: p.movePa ? 'Acercarse al equipo' : 'Elegir qué recoger',
      pa: p.movePa,
      remaining: Math.max(0, unit.ap - (state.mode === 'exploration' ? 0 : p.movePa)),
      valid: p.valid,
      reason: p.reason,
      coverNote:
        state.mode === 'exploration'
          ? 'Al llegar, elegí el objeto y la cantidad. Recoger consume tiempo.'
          : 'Al llegar, elegí el objeto y la cantidad. Recoger cuesta 2 PA adicionales. El contacto puede detener el desplazamiento.',
    };
  }
  const aliasSupply = { torch: 'torches', bolas: 'boleadoras', ration: 'rations' }[mode];
  if (
    aliasSupply ||
    (unit.activeSlot === 'supply' &&
      ['move', 'useItem'].includes(mode) &&
      (unit?.activeSupply === 'torches' ||
        unit.activeSupply === 'boleadoras' ||
        target ||
        mode === 'useItem'))
  ) {
    const key = aliasSupply || unit.activeSupply;
    if (!key) {
      return null;
    }
    const preview = supplyUsePreview(
      state,
      unit,
      key === 'torches' || key === 'boleadoras' ? (target ?? point) : target,
      key,
    );
    const label =
      { torches: 'Arrojar antorcha', boleadoras: 'Lanzar boleadoras', rations: 'Comer ración' }[
        key
      ] || 'Usar pertrecho';
    return {
      name: target?.name || `${tacticalGridLabel(point.x, point.y)}`,
      actionLabel: label,
      attackLabel: label,
      pa: preview.cost,
      remaining: Math.max(0, unit.ap - (state.mode === 'exploration' ? 0 : preview.cost)),
      reason: preview.reason,
      valid: preview.allowed,
    };
  }
  const environment =
    !target && ['move', 'useItem'].includes(mode) ? environmentTargetAt(state, point) : null;
  if (
    environment &&
    canSee(state, unit, environment) &&
    (environment.kind !== 'container' || environmentContainerVisible(state, unit, environment))
  ) {
    const summary = environmentTargetSummary(unit, environment),
      preview = environmentUsePreview(state, unit, environment);
    const coverNote = [
      preview.movePa
        ? `Desplazamiento: ${formatAP(preview.movePa)} PA · uso: ${formatAP(preview.actionPa)} PA. El contacto puede detener la acción.`
        : null,
      environment.kind === 'wall' && (preview.toolWear ?? 0) > 0
        ? `Desgaste de la barreta: hasta ${preview.toolWear} puntos. Abre un paso permanente.`
        : null,
    ]
      .filter(Boolean)
      .join(' ');
    return {
      name: summary.label,
      pa: preview.pa,
      chance: preview.chance ?? undefined,
      chanceLabel: 'éxito',
      attackLabel: preview.label,
      actionLabel: preview.label,
      remaining: Math.max(0, unit.ap - (state.mode === 'exploration' ? 0 : preview.pa)),
      coverNote: coverNote || undefined,
      reason: preview.reason,
      valid: preview.valid,
    };
  }
  if (
    mode === 'heal' ||
    (unit.activeSlot === 'medical' && ['move', 'useItem'].includes(mode) && target)
  ) {
    const local = mode === 'heal' ? medicalUsePreview(state, unit, target ?? null) : null;
    const preview = local
      ? {
          pa: local.cost,
          valid: local.allowed,
          reason: local.reason,
          movePa: 0,
          actionPa: local.cost,
          treatment: local.treatment,
          ...((local.composureRelief ?? 0) > 0 ? { composureRelief: local.composureRelief } : {}),
        }
      : itemUsePreview(state, unit, target);
    if (!preview) {
      return null;
    }
    return {
      name: target?.name || tacticalGridLabel(point.x, point.y),
      actionLabel: preview.movePa ? 'Acercarse y vendar' : 'Vendar',
      pa: preview.pa,
      remaining: Math.max(0, unit.ap - (state.mode === 'exploration' ? 0 : preview.pa)),
      coverNote: medicalTreatmentText(state, preview),
      treatment: preview.treatment,
      ...((preview.composureRelief ?? 0) > 0 ? { composureRelief: preview.composureRelief } : {}),
      reason: preview.reason,
      valid: preview.valid,
    };
  }

  let pa,
    chance,
    chanceLabel,
    reason,
    actionLabel,
    attackType,
    attackLabel,
    coverNote,
    shotLoadForecast: Extract<FirearmShotPreview, { shotLoad: true }> | undefined;
  if (mode === 'look') {
    const preview = lookPreview(state, unit, point);
    pa = preview.pa;
    reason = preview.reason;
    actionLabel = preview.prepare
      ? preview.actionLabel
      : `Mirar al ${COMPASS_LABELS[preview.facing]}`;
    coverNote = preview.prepare
      ? 'Prepara el arma sin disparar. Conserva los cartuchos; el próximo disparo no vuelve a pagar la preparación.'
      : hasFirearm(unit)
        ? 'Una vez orientado, mirá otra vez en esa dirección para preparar el arma.'
        : undefined;
  } else if (
    target &&
    target.side !== unit.side &&
    ['move', 'useItem', 'fire', 'melee'].includes(mode)
  ) {
    if (target.hp <= 0 || target.surrendered) {
      return null;
    }
    if (unit.activeSlot === 'item') {
      return {
        name: target.name,
        reason: heldGrenade(unit)
          ? 'Botón derecho o F para lanzar la granada a una casilla.'
          : 'Este objeto no se puede usar sobre una persona. Guardalo o elegí otro objeto.',
        valid: false,
      };
    }
    if (unit.activeSlot === 'tool') {
      return {
        name: target.name,
        reason: `La herramienta se usa sobre ${toolTargets(unit)}.`,
        valid: false,
      };
    }
    const attack = contextualAttack(state, unit, target, {
      type: mode,
      aim: ctx.aim || 0,
      hitLocation: hitLocationFor(ctx.hitLocation),
    });
    pa = attack.pa;
    attackType = attack.type;
    if (attack.type === 'melee') {
      const approach = meleePreview(state, unit, target, {
        approach: ['move', 'useItem'].includes(mode),
      });
      attackLabel =
        unit.activeSlot === 'unarmed'
          ? 'Puños'
          : fixedBayonetFor(unit)
            ? 'Estocada de bayoneta'
            : hasFirearm(unit)
              ? 'Culatazo'
              : 'name' in attack.profile
                ? attack.profile.name
                : 'Granada';
      actionLabel = attackLabel;
      pa = approach.pa;
      reason = approach.reason;
      coverNote = meleePreparationText(state, approach);
      if (approach.movePa) {
        actionLabel = 'Acercarse y atacar';
      } else if (approach.stancePa) {
        actionLabel = 'Levantarse y atacar';
      }
      if (!approach.movePa && approach.valid && unit.activeSlot === 'unarmed') {
        chance = unarmedChance(unit, target, {
          aware: canSee(state, target, approach.stancePa ? { ...unit, stance: 'standing' } : unit),
        });
      }
    } else {
      const reload = emptyGunPreview(state, unit);
      if (reload) {
        return reload;
      }
      const volley = firearmVolleyPreview(
          state,
          unit,
          target,
          ctx.aim || 0,
          hitLocationFor(ctx.hitLocation),
        ),
        primaryShot = volley.shots[0];
      if (!primaryShot) {
        throw new Error('Falta la vista previa del disparo.');
      }
      chance = primaryShot.chance;
      let interveningBody = false,
        ricochet = false;
      if (primaryShot.shotLoad) {
        shotLoadForecast = primaryShot;
        chanceLabel = 'al menos un perdigón';
        coverNote = shotLoadText(primaryShot);
      } else {
        const path = firearmProjectilePath(state, unit, target, hitLocationFor(ctx.hitLocation));
        ricochet = Boolean(path.ricochets?.length);
        coverNote = ricochet
          ? 'Disparar consume la carga.'
          : path.blocked
            ? 'La cobertura detiene este tiro. Disparar consume la carga.'
            : path.damageFactor < 1
              ? `La cobertura reduce el daño un ${Math.round((1 - path.damageFactor) * 100)}%.`
              : undefined;
        const flight = firearmFlightPreview(state, unit, target, hitLocationFor(ctx.hitLocation));
        const targetImpactIndex =
          flight.bodyImpacts?.findIndex(
            (impact) => impact.victimKind === 'unit' && impact.victimId === target.id,
          ) ?? -1;
        const selectedImpact =
          targetImpactIndex < 0 ? null : flight.bodyImpacts?.[targetImpactIndex];
        interveningBody =
          (targetImpactIndex < 0 ? (flight.bodyImpacts?.length ?? 0) : targetImpactIndex) > 0 ||
          Boolean(
            flight.victimId &&
            ((flight.victimKind ?? 'unit') !== 'unit' || flight.victimId !== target.id),
          );
        if (interveningBody) {
          const passage =
            selectedImpact && selectedImpact.reachChance < 1
              ? `La bala puede atravesarlo: ${chancePercent(selectedImpact.reachChance * 100)} de paso hasta el objetivo; daño reducido un ${Math.round((1 - selectedImpact.damageFactor) * 100)}% si llega.`
              : 'La bala puede herirlo; el paso al objetivo no está asegurado.';
          coverNote = `Un combatiente está en la trayectoria. ${passage} Disparar consume la carga.`;
          if ((selectedImpact?.reachChance ?? 1) < 1) {
            chanceLabel = 'impacto con penetración';
          }
        }
      }
      coverNote = [shotRangeText(firearmRangeProfile(state, unit, target)), coverNote]
        .filter(Boolean)
        .join(' ');
      if (volley.paired) {
        attackLabel = actionLabel = 'Disparar ambas pistolas';
        chanceLabel = primaryShot.shotLoad
          ? 'al menos un perdigón (mano principal)'
          : 'impacto (mano principal)';
        const chances = volley.shots
          .map(
            (shot) =>
              `${shot.hand === 'primary' ? 'Mano principal' : 'Segunda mano'}: ${chancePercent(shot.chance)}${shot.shotLoad ? ` de al menos un perdigón. ${shotLoadText(shot)}` : `${shot.conditional ? ` (incluye ${chancePercent((shot.reachChance ?? 1) * 100)} de paso)` : ''}${shot.damageFactor === 0 ? ' (sin impacto previsto en el blanco)' : shot.damageFactor < 1 ? ` (daño reducido un ${Math.round((1 - shot.damageFactor) * 100)}%${shot.conditional ? ' si llega' : ''})` : ''}`}`,
          )
          .join(' · ');
        coverNote = [
          `${chances}. Un disparo por pistola.`,
          `Mano principal: ${shotRangeText(firearmRangeProfile(state, unit, target))}`,
          interveningBody
            ? 'Un combatiente está en la trayectoria. La bala puede herirlo y atravesarlo con menos fuerza; consume las cargas.'
            : undefined,
        ]
          .filter(Boolean)
          .join(' ');
      }
      coverNote = [
        ricochet ? 'Riesgo de rebote en piedra.' : null,
        coverNote,
        firearmBystanderWarning(
          firearmBystanderRisk(state, unit, target, hitLocationFor(ctx.hitLocation)),
        ),
      ]
        .filter(Boolean)
        .join(' ');
      if (!canChooseShotLocation(target) && hitLocationFor(ctx.hitLocation) !== 'torso') {
        reason = 'Un objetivo cuerpo a tierra tiene una sola zona de tiro.';
      } else if (!firearmServiceable(unit)) {
        reason = BROKEN_FIREARM_REASON;
      } else if (unit.jammed) {
        reason = 'Cebá el arma antes de disparar.';
      } else if (!(unit.loaded > 0)) {
        reason = 'Recargá el arma.';
      } else if (!hasLineOfSight(state, unit, target)) {
        reason = 'No hay línea de tiro.';
      }
    }
  } else if (mode === 'move' && !target) {
    return movementTargetPreview(state, unit, point, ctx);
  } else {
    return null;
  }
  if (attackType === 'fire') {
    coverNote = [firearmCostText(state, unit, target), coverNote].filter(Boolean).join(' ');
  }
  if (unit.knockedDown) {
    reason = 'Primero debés levantarte.';
  }
  if (!reason && !unitCanAct(state, unit)) {
    reason =
      state.phase === 'interrupt'
        ? 'Este combatiente no puede actuar en la interrupción.'
        : 'El combatiente no puede actuar.';
  }
  if (!reason && pa !== undefined && !affordable(state, unit, pa)) {
    reason = 'PA insuficientes.';
  }
  return {
    name:
      (attackType ? target?.name : actionLabel || target?.name) ||
      `${tacticalGridLabel(point.x, point.y)}`,
    pa,
    chance,
    ...(chanceLabel ? { chanceLabel } : {}),
    ...(shotLoadForecast
      ? {
          shotLoad: true,
          pelletCount: shotLoadForecast.pelletCount,
          expectedForce: shotLoadForecast.expectedForce,
          damageFactor: shotLoadForecast.damageFactor,
        }
      : {}),
    coverNote,
    hitLocation:
      chance === undefined || attackType !== 'fire'
        ? undefined
        : HIT_LOCATIONS.find(([id]) => id === hitLocationFor(ctx.hitLocation))?.[1],
    attackType,
    attackLabel,
    actionLabel,
    remaining:
      pa === undefined ? undefined : Math.max(0, unit.ap - (state.mode === 'exploration' ? 0 : pa)),
    reason,
    valid: !reason,
  };
}

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @returns {import('./public/hud-types.ts').FittingInventoryModel} */
export function fittingInventoryModel(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: BattleUnit,
): import('./public/hud-types.ts').FittingInventoryModel {
  const sources = [
    ...(unit.blade === 1811
      ? [
          {
            item: 'blade',
            condition: unit.bladeCondition ?? 100,
            pattern: unit.bladeFittingPattern,
          },
        ]
      : []),
    ...Object.entries(unit.inventory || {}).flatMap(([key, record]) =>
      typeof record !== 'number' && record.weapon === 1811 && (record.count ?? 0) > 0
        ? [
            {
              item: `inventory:${key}`,
              condition: record.condition ?? 100,
              pattern: record.fittingPattern,
            },
          ]
        : [],
    ),
  ].map((source): import('./public/hud-types.ts').BayonetSource => ({
    ...source,
    label: fittingLabel(source.pattern),
    weight: weaponItemWeight(1811),
    preview: fitBayonetPreview(state, unit, source.item),
    action: { type: 'fitBayonet', item: source.item },
  }));
  const attached = unit.weaponFittings?.['bayonet'];
  return {
    sources,
    attached: attached
      ? {
          ...attached,
          label: fittingLabel(attached.fittingPattern),
          weight: weaponItemWeight(attached.weapon),
          hostCondition: unit.condition,
          removals: ['inventory', 'blade'].map((destination) => ({
            destination,
            label: destination === 'inventory' ? 'Retirar a mochila' : 'Retirar a secundaria',
            preview: removeBayonetPreview(state, unit, destination),
            action: { type: 'removeBayonet', destination },
          })),
        }
      : null,
  };
}

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TargetingContext} [ctx]
 * @returns {string} */
export function equippedItemHelp(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  ctx: import('./public/hud-types.ts').TargetingContext = {},
): string {
  if (!unit) {
    return 'Seleccioná un combatiente.';
  }
  if (heldGrenade(unit) || ctx.mode === 'throwGrenade') {
    return targetingHelp(ctx.mode ?? 'move', unit);
  }
  if (ctx.mode === 'throwKnife') {
    return targetingHelp(ctx.mode, unit);
  }
  const weapon = weaponFor(unit),
    costs = actionCosts(state, unit),
    exploring = state.mode === 'exploration';
  if (unit.activeSlot === 'supply') {
    return `${weapon.name} · ${formatAP(exploring ? 0 : supplyUsePreview(state, unit, ctx.target).cost)} PA. ${targetingHelp('useItem', unit)}`;
  }
  if (unit.activeSlot === 'item') {
    return `${weapon.name}. ${targetingHelp('useItem', unit)}`;
  }
  if (unit.activeSlot === 'tool') {
    return `${weapon.name}. Seleccioná ${toolTargets(unit)} para usarla.`;
  }
  if (unit.activeSlot === 'medical' && exploring) {
    return 'Vendas: sin coste de PA. Seleccionate a vos, a un aliado o a un civil herido. Consume tiempo y vendas. Reduce la hemorragia y estabiliza heridas críticas hasta 15 de salud. La recuperación completa requiere atención en campaña.';
  }
  if (unit.activeSlot === 'medical') {
    return `Vendas: ${formatAP(costs.heal)} PA, más el desplazamiento. Seleccionate a vos, a un aliado o a un civil herido. Se acerca y venda si hay PA suficientes. Reduce la hemorragia y estabiliza heridas críticas hasta 15 de salud. La recuperación completa requiere atención en campaña.`;
  }
  const attack = contextualAttack(state, unit, ctx.target, { type: ctx.mode, aim: ctx.aim || 0 });
  const reload = attack.type === 'fire' ? emptyGunPreview(state, unit) : null;
  if (reload) {
    return `${weapon.name} · ${reload.actionLabel}${reload.valid ? `: ${formatAP(reload.pa)} PA. ${reload.coverNote}` : `. ${reload.reason}`}`;
  }
  const approach =
    ctx.target && ['move', 'useItem', undefined].includes(ctx.mode)
      ? itemUsePreview(state, unit, ctx.target)
      : null;
  if (attack.type === 'melee' && (approach?.stancePa || costs.meleeStance)) {
    const preparation = approach ?? {
      pa: attack.pa,
      stancePa: costs.meleeStance,
      strikePa: costs.meleeStrike,
    };
    const label = hasFirearm(unit)
      ? fixedBayonetFor(unit)
        ? 'Estocada de bayoneta'
        : 'Culatazo'
      : weapon.name;
    return `${label} · ${formatAP(exploring ? 0 : preparation.pa)} PA. ${meleePreparationText(state, preparation)}`;
  }
  if (approach?.movePa && exploring) {
    return `${weapon.name} · sin coste de PA. Se acerca y usa el objeto. El contacto puede detener la acción.`;
  }
  if (approach?.movePa) {
    return `${weapon.name} · ${formatAP(approach.pa)} PA (${formatAP(approach.movePa)} para acercarse y ${formatAP(approach.actionPa)} para usarlo). El contacto puede detener la acción.`;
  }
  const label =
    attack.type === 'melee' && hasFirearm(unit)
      ? fixedBayonetFor(unit)
        ? 'Estocada de bayoneta'
        : 'Culatazo'
      : attack.type === 'fire' && pairedPistol(unit)
        ? 'Disparar ambas pistolas'
        : weapon.name;
  return `${label} · ${formatAP(exploring ? 0 : attack.pa)} PA. ${attack.type === 'fire' ? firearmCostText(state, unit, ctx.target) + ' ' : ''}${fixedBayonetFor(unit) || ctx.mode === 'fire' ? targetingHelp(ctx.mode || 'move', unit) : 'Seleccioná un enemigo para usarlo.'}`;
}

/** @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @returns {number} */
export function levelFor(unit: BattleUnit): number {
  if (typeof unit.experienceLevel === 'number' && Number.isFinite(unit.experienceLevel)) {
    return unit.experienceLevel;
  }
  return Math.floor(
    (unit.agility +
      unit.dexterity +
      unit.strength +
      (unit.leadership ?? 0) +
      unit.wisdom +
      unit.marksmanship +
      unit.mechanical +
      (unit.explosives ?? 0) +
      unit.medical +
      unit.maxHp) /
      100,
  );
}

/** @param {import('./public/compatibility-types.ts').BattleUnit} unit
 * @param {string | undefined} selectedId
 * @param {import('./public/compatibility-types.ts').BattleSnapshot | undefined} state
 * @param {number} [index]
 * @returns {import('./public/hud-types.ts').OccupiedRosterCell} */
export function rosterCell(
  unit: import('./public/compatibility-types.ts').BattleUnit,
  selectedId: string | undefined,
  state: import('./public/compatibility-types.ts').BattleSnapshot | undefined,
  index: number = 0,
): import('./public/hud-types.ts').OccupiedRosterCell {
  const fallen = unit.hp <= 0 || unit.routed || unit.unconscious;
  const dead = unit.hp <= 0;
  const hp = Math.max(0, unit.hp);
  const wounds = Math.max(0, unit.maxHp - hp);
  const bandaged = dead ? 0 : Math.min(wounds, Math.max(0, unit.bandaged || 0));
  const untreated = dead ? 0 : wounds - bandaged;
  return {
    unit,
    portrait: unit.portrait ?? null,
    label: shortName(unit),
    hpPct: Math.max(0, Math.min(100, Math.round((100 * unit.hp) / unit.maxHp))),
    ap: unit.ap,
    energy: unit.energy,
    bleeding: unit.bleeding || 0,
    bandaged,
    untreated,
    dead,
    moralePct: dead ? 0 : Math.max(0, Math.min(100, unit.morale ?? 0)),
    visibleEnemyCount:
      state && !dead
        ? state.units.filter(
            (enemy) =>
              enemy.side === 'enemy' &&
              enemy.hp > 0 &&
              !enemy.departure &&
              !enemy.fled &&
              canSee(state, unit, enemy),
          ).length
        : 0,
    apPct: Math.max(
      0,
      Math.min(100, (unit.ap / Math.max(1, (unit.maxAP || 100) + (unit.carriedAP || 0))) * 100),
    ),
    active: unit.id === selectedId,
    fallen,
    disabled: fallen || (state ? !unitCanAct(state, unit) : false),
    interruptReady: state?.phase === 'interrupt' && unitCanAct(state, unit),
    index,
  };
}

/** @param {import('./public/compatibility-types.ts').BattleUnit[]} players
 * @param {string | undefined} selectedId
 * @param {import('./public/compatibility-types.ts').BattleSnapshot | undefined} state
 * @returns {import('./public/hud-types.ts').RosterCell[]} */
export function rosterCells(
  players: import('./public/compatibility-types.ts').BattleUnit[],
  selectedId: string | undefined,
  state: import('./public/compatibility-types.ts').BattleSnapshot | undefined,
): import('./public/hud-types.ts').RosterCell[] {
  const cells: import('./public/hud-types.ts').RosterCell[] = fieldUnits({ units: players }).map(
    (unit, index) => rosterCell(unit, selectedId, state, index),
  );
  while (cells.length < 6) {
    cells.push({ empty: true });
  }
  return cells;
}

/** @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {string | null} [explicitSlot]
 * @returns {import('./public/hud-types.ts').TacticalOrder} */
export function slotAction(
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  explicitSlot: string | null = null,
): import('./public/hud-types.ts').TacticalOrder {
  if (!unit) {
    return { type: 'weapon', slot: explicitSlot ?? 'unarmed' };
  }
  if (explicitSlot !== null) {
    return { type: 'weapon', slot: explicitSlot };
  }
  const tools = toolItems(unit),
    supplies = supplyItems(unit),
    slots = [
      'primary',
      'blade',
      'medical',
      ...(tools.length ? ['tool'] : []),
      ...(supplies.length ? ['supply'] : []),
      'unarmed',
    ],
    current = slots.indexOf(unit.activeSlot || 'primary');
  if (unit.activeSlot === 'supply') {
    const next = supplies[supplies.findIndex((supply) => supply.key === unit.activeSupply) + 1];
    if (next) {
      return { type: 'weapon', slot: 'supply', supplyKey: next.key };
    }
  }
  const available = (slot: string | undefined) =>
    (slot !== undefined && ['unarmed', 'tool', 'supply'].includes(slot)) ||
    (slot === 'medical'
      ? unit.medkits > 0
      : slot === 'blade'
        ? Boolean(bladeDefinition(unit.blade))
        : hasPrimary(unit));
  const slot =
    Array.from(
      { length: slots.length },
      (_, offset) => slots[(current + offset + 1) % slots.length],
    ).find(available) || 'unarmed';
  return {
    type: 'weapon',
    slot,
    ...(slot === 'tool'
      ? {
          toolKey:
            tools.find((tool) => tool.item === unit.activeTool)?.item ?? tools[0]?.item ?? '',
        }
      : slot === 'supply'
        ? { supplyKey: supplies[0]?.key ?? '' }
        : {}),
  };
}

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TargetingContext} [ctx]
 * @returns {import('./public/hud-types.ts').EquipmentSlot[]} */
export function equipmentSlots(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  ctx: import('./public/hud-types.ts').TargetingContext = {},
): import('./public/hud-types.ts').EquipmentSlot[] {
  if (!unit) {
    return [];
  }
  const pa = state.mode === 'exploration' ? 0 : actionCosts(state, unit).weapon;
  const tools = toolItems(unit),
    activeTool = tools.find((tool) => tool.item === unit.activeTool) ?? tools[0],
    supplies = supplyItems(unit),
    activeSupply = supplies.find((supply) => supply.key === unit.activeSupply) ?? supplies[0],
    object = carriedObject(unit);
  const entries: [string, string][] = [
    ['primary', 'Arma'],
    ['blade', 'Arma blanca'],
    ['medical', `Vendas · ${unit.medkits ?? 0}`],
  ];
  if (activeTool) {
    entries.push(['tool', 'Herramienta']);
  }
  if (activeSupply) {
    entries.push(['supply', `${activeSupply.label} · ${activeSupply.count}`]);
  }
  if (unit.activeSlot === 'item' && object) {
    entries.push(['item', object.label]);
  }
  entries.push(['unarmed', 'Manos libres']);
  return entries.map(([slot, label]): EquipmentSlot => {
    const action: EquipmentSlot['action'] = {
      type: 'weapon',
      slot,
      ...(slot === 'tool' && activeTool ? { toolKey: activeTool.item } : {}),
      ...(slot === 'supply' && activeSupply ? { supplyKey: activeSupply.key } : {}),
      ...(slot === 'item' && unit.activeItem ? { item: unit.activeItem } : {}),
    };
    const held = selectMainHand(unit, {
      activeSlot: slot,
      ...(action.toolKey ? { activeTool: action.toolKey } : {}),
      ...(action.supplyKey ? { activeSupply: action.supplyKey } : {}),
      ...(action.item ? { activeItem: action.item } : {}),
    });
    let reason: string | null = null;
    try {
      if (inventoryUsage(held).overloaded) {
        reason = 'No queda espacio para guardar el objeto en mano.';
      }
    } catch (error) {
      reason = error instanceof Error ? error.message : 'No se puede preparar el objeto.';
    }
    return {
      slot,
      label,
      pa,
      action,
      reason,
      active:
        (unit.activeSlot || 'primary') === slot && !(slot === 'unarmed' && handLayout(unit).left),
      disabled:
        !unitCanAct(state, unit) ||
        Boolean(ctx.busy) ||
        Boolean(unit.knockedDown) ||
        !affordable(state, unit, pa) ||
        Boolean(reason) ||
        (slot === 'medical'
          ? !(unit.medkits > 0)
          : slot === 'blade'
            ? !bladeDefinition(unit.blade)
            : slot === 'primary'
              ? !hasPrimary(unit)
              : false),
    };
  });
}

// Retained work on the next charge, independent of ready ammunition or a future order.
/** @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {string | null | undefined} item
 * @returns {import('./public/hud-types.ts').FirearmLoadingProgress | null} */
export function firearmLoadingProgress(
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  item: string | null | undefined,
): import('./public/hud-types.ts').FirearmLoadingProgress | null {
  if (!item || !unit) {
    return null;
  }
  const stack = readItemStack(unit, item, 1),
    progress = stack.reloadProgress ?? 0;
  if (weaponSpecification(stack)?.type !== 'firearm' || !(progress > 0 && progress < 1)) {
    return null;
  }
  const percent = progress < 0.01 ? '<1%' : `${Math.min(99, Math.round(progress * 100))}%`;
  return {
    progress,
    percent,
    label: `Recarga en curso: ${percent}`,
    description: `Recarga en curso: ${percent} del próximo cartucho.`,
  };
}

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @returns {import('./public/hud-types.ts').HandSlot[]} */
export function handSlots(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
): import('./public/hud-types.ts').HandSlot[] {
  if (!unit) {
    return [];
  }
  const layout = handLayout(unit),
    options = equipmentSlots(state, unit);
  return (['right', 'left'] as const).map((side) => {
    const reference = layout[side],
      blocked = side === 'left' && layout.twoHanded;
    const descriptor = reference ? itemDescriptor(unit, reference) : null;
    let option:
      | (Partial<EquipmentPreview> & { action?: TacticalOrder; disabled?: boolean })
      | undefined = options.find((o) => o.slot === reference);
    if (reference === 'offhand') {
      option = { ...swapHandsPreview(state, unit), action: { type: 'swapHands' } };
    } else if (reference === 'medkits') {
      option = options.find((o) => o.slot === 'medical');
    } else if (reference && Object.hasOwn(HELD_SUPPLIES, reference)) {
      option = equipmentSlots(state, { ...unit, activeSupply: reference }).find(
        (o) => o.slot === 'supply',
      );
    } else if (
      reference?.startsWith('inventory:') &&
      heldTool({ ...unit, activeSlot: 'tool', activeTool: reference })
    ) {
      option = equipmentSlots(state, { ...unit, activeTool: reference }).find(
        (o) => o.slot === 'tool',
      );
    } else if (reference && carriedObject(unit, reference)) {
      option = mainItemPreview(state, unit, reference);
    }
    const loading = firearmLoadingProgress(unit, reference);
    return {
      side,
      item: reference,
      blocked,
      label: descriptor?.label ?? (blocked ? 'Ocupada por el arma' : 'Vacía'),
      weapon: descriptor?.weapon,
      art: descriptor?.art,
      loaded: firearmDefinition(descriptor?.weapon) ? descriptor?.loaded : undefined,
      condition: descriptor?.condition,
      ...(loading ? { loading } : {}),
      action: side === 'left' ? option?.action : null,
      pa: option?.pa,
      reason: option?.reason,
      disabled: blocked || (side === 'left' && (option?.disabled || option?.valid === false)),
    };
  });
}

/** @param {string} key
 * @param {string} slot
 * @returns {import('./public/hud-types.ts').TacticalOrder} */
export function backpackEquipAction(
  key: string,
  slot: string,
): import('./public/hud-types.ts').TacticalOrder {
  return { type: 'equipLoot', inventoryKey: key, slot };
}

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @returns {import('./public/hud-types.ts').InventoryModel} */
export function inventoryModel(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: BattleUnit,
): import('./public/hud-types.ts').InventoryModel {
  const tools = toolItems(unit);
  const stats = [
    { id: 'agility', label: 'Agilidad', value: unit.agility },
    { id: 'dexterity', label: 'Destreza', value: unit.dexterity },
    { id: 'strength', label: 'Fuerza', value: unit.strength },
    { id: 'leadership', label: 'Liderazgo', value: unit.leadership ?? 0 },
    { id: 'wisdom', label: 'Sabiduría', value: unit.wisdom },
    { id: 'level', label: 'Nivel', value: levelFor(unit) },
    { id: 'marksmanship', label: 'Puntería', value: unit.marksmanship },
    { id: 'explosives', label: 'Pólvora y artillería', value: unit.explosives ?? 0 },
    { id: 'mechanical', label: 'Mecánica', value: unit.mechanical },
    { id: 'medical', label: 'Medicina', value: unit.medical },
  ];
  const supplies = [
    ...(unit.ammunitionVersion === 2
      ? []
      : [{ id: 'ammo', label: 'Cartuchos', count: unit.ammo ?? 0 }]),
    { id: 'rations', label: 'Raciones', count: unit.rations },
    { id: 'medkits', label: 'Vendas', count: unit.medkits ?? 0 },
    { id: 'boleadoras', label: 'Boleadoras', count: unit.boleadoras ?? 0 },
    { id: 'torches', label: 'Antorchas', count: unit.torches ?? 0 },
  ];
  const backpack: InventoryModel['backpack'] = Object.entries(unit.inventory || {})
    .filter(([, record]) => record && (typeof record === 'object' || Number.isInteger(record)))
    .map(([key, value]) => {
      const record: EquipmentItem = typeof value === 'object' ? value : { count: value, weight: 0 };
      const weapon = weaponSpecification(record);
      const blade = bladeDefinition(
        typeof record.weapon === 'number' || typeof record.weapon === 'string'
          ? record.weapon
          : record.weapon?.template,
      );
      return {
        key,
        ...record,
        count: record.count ?? 0,
        art: weapon?.art ?? null,
        equippable: Boolean(weapon || blade || record.kind === 'outfit'),
        name:
          record.weapon === 1811
            ? fittingLabel(record.fittingPattern)
            : (weapon?.name ??
              blade?.name ??
              (record.outfit ? OUTFITS[record.outfit]?.name : undefined) ??
              tools.find((tool) => tool.key === key)?.name ??
              record.name ??
              null),
      };
    });
  const outfit = wornOutfit(unit);
  const items = [
    ...BODY_SLOTS.flatMap((slot) => {
      const worn = wornOutfit(unit, slot);
      return worn
        ? [{ ...worn, item: slot, label: OUTFITS[worn.outfit]?.name ?? worn.outfit }]
        : [];
    }),
    ...(hasPrimary(unit)
      ? [
          {
            item: 'primary',
            label: weaponFor({ ...unit, activeSlot: 'primary' }).name,
            count: 1,
            loaded: unit.loaded,
            condition: unit.condition,
            jammed: Boolean(unit.jammed),
          },
        ]
      : []),
    ...(bladeDefinition(unit.blade)
      ? [
          {
            item: 'blade',
            label: weaponSpecification(unit, 'blade')?.name ?? 'Arma blanca',
            count: 1,
          },
        ]
      : []),
    ...(unit.offHand
      ? [{ ...itemDescriptor(unit, 'offhand'), ...unit.offHand, item: 'offhand', count: 1 }]
      : []),
    ...supplies
      .filter((supply) => supply.count > 0)
      .map((supply) => ({ item: supply.id, label: supply.label, count: supply.count })),
    ...backpack
      .filter((record) => (record.count ?? 0) > 0)
      .map((record) => ({
        ...record,
        item: `inventory:${record.key}`,
        label: record.name || 'Pertrechos',
      })),
  ];
  let pockets;
  try {
    pockets = inventoryUsage(unit);
  } catch {
    pockets = {
      used: null,
      capacity: INVENTORY_CAPACITY,
      free: 0,
      overloaded: true,
      items: [],
      slots: [],
      overflow: [],
    };
  }
  return {
    stats,
    hands: handSlots(state, unit),
    slots: {
      primary: weaponFor({ ...unit, activeSlot: 'primary' }),
      blade: bladeDefinition(unit.blade) ? bladeFor({ ...unit, activeSlot: 'blade' }) : null,
      medical: { name: 'Vendas de campaña', count: unit.medkits ?? 0 },
    },
    activeSlot: unit.activeSlot,
    weight: carriedWeight(unit),
    capacity: carryCapacity(unit),
    outfit: outfit ? { ...outfit, label: OUTFITS[outfit.outfit]?.name ?? outfit.outfit } : null,
    poncho: hasPoncho(unit),
    supplies,
    heldSupplies: supplyItems(unit),
    backpack,
    items,
    pockets,
    tools,
    fittings: fittingInventoryModel(state, unit),
    unitAlive: alive(unit),
    unitReady: unitCanAct(state, unit),
    apBudget: actionPointBudget(state, unit),
    currentAPLimit: (unit.maxAP || 100) + (unit.carriedAP || 0),
    equipCost: actionCosts(state, unit).equipLoot,
  };
}

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TargetingContext} [ctx] */
export function inventoryHandlingModel(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: BattleUnit,
  ctx: import('./public/hud-types.ts').TargetingContext = {},
) {
  const recipients = state.units.filter(
    (target) =>
      target.id !== unit.id &&
      target.side === unit.side &&
      (target.hp ?? 0) > 0 &&
      !target.routed &&
      !target.fled &&
      !target.departure,
  );
  const target = recipients.find((target) => target.id === ctx.targetId);
  const transfer = transferPreview(state, unit, target, ctx.item, ctx.count ?? 1);
  const drop = dropPreview(state, unit, ctx.item, ctx.count ?? 1);
  return {
    recipients,
    transfer: {
      ...transfer,
      action: {
        type: 'transfer' as const,
        ...(target ? { targetId: target.id } : {}),
        ...(ctx.item ? { item: ctx.item } : {}),
        count: ctx.count ?? 1,
        transferKind: transfer.kind,
        transferRoute: transfer.route.map((v) => v.id),
      },
      label: !target
        ? 'Dar o arrojar'
        : transfer.kind === 'relay'
          ? 'Pasar por aliados'
          : transfer.kind === 'throw'
            ? 'Arrojar al aliado'
            : 'Dar al aliado',
      detail:
        transfer.kind === 'relay'
          ? `${transfer.route.map((v) => `${v.name} (${formatAP(v.pa)} PA)`).join(' → ')}. ${formatAP(transfer.totalPA)} PA en total. Entrega segura.`
          : transfer.kind === 'throw'
            ? `${transfer.chance}% de recepción. El aliado necesita 0,5 PA; si falla, el objeto cae al suelo.`
            : 'Entrega directa al aliado contiguo.',
      disabled: Boolean(ctx.busy) || !transfer.valid,
    },
    drop: { ...drop, disabled: Boolean(ctx.busy) || !drop.valid },
  };
}

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TacticalPointer | null | undefined} [point]
 * @returns {import('./public/hud-types.ts').LootOption[]} */
export function nearbyLootOptions(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  point:
    | import('./public/hud-types.ts').TacticalPointer
    | null
    | undefined = /** @type {{x:number,y:number}|null} */ (null),
): import('./public/hud-types.ts').LootOption[] {
  if (!unit) {
    return [];
  }
  const options: LootOption[] = [],
    visible = (source: TacticalPoint) =>
      sameSurface(unit, source) &&
      (point ? sameCell(source, point) : distance(unit, source) <= 1.5) &&
      canSee(state, unit, source);
  for (const source of state.units) {
    if (
      source.id === unit.id ||
      source.fled ||
      source.departure ||
      !(source.hp <= 0 || source.unconscious || source.surrendered) ||
      distance(unit, source) > 1.5 ||
      !visible(source)
    ) {
      continue;
    }
    const cursorItems = source.equipmentCursor
      ? [
          {
            ...source.equipmentCursor.stack,
            ...itemDescriptor(source, 'cursor'),
            item: 'cursor',
            count: source.equipmentCursor.stack.count,
          },
        ]
      : [];
    for (const item of [...inventoryModel(state, source).items, ...cursorItems]) {
      options.push({
        ...item,
        id: `unit:${source.id}:${item.item}`,
        source: source.name,
        action: {
          type: 'loot',
          targetId: source.id,
          item: item.item === 'primary' ? 'weapon' : item.item,
        },
      });
    }
  }
  for (const source of state.npcs || []) {
    if (
      source.departure ||
      source.fled ||
      !(source.hp <= 0 || source.unconscious) ||
      distance(unit, source) > 1.5 ||
      !visible(source)
    ) {
      continue;
    }
    for (const item of CIVILIAN_SUPPLY_FIELDS) {
      const count = source.civilianSupplies?.[item],
        spec = SUPPLY_ITEMS[item];
      if (count !== undefined && count > 0 && spec) {
        options.push({
          id: `npc:${source.id}:${item}`,
          label: spec.label,
          count,
          source: source.name,
          action: { type: 'loot', targetId: source.id, item },
        });
      }
    }
    for (const slot of ['primary', 'blade'] as const) {
      const record = source.civilianWeapons?.[slot];
      if (record) {
        options.push({
          ...record,
          id: `npc:${source.id}:${slot}`,
          label: weaponSpecification(record)?.name || 'Arma',
          count: 1,
          source: source.name,
          action: {
            type: 'loot',
            targetId: source.id,
            item: slot === 'primary' ? 'weapon' : 'blade',
          },
        });
      }
    }
  }
  for (const [index, source] of (state.droppedWeapons || []).entries()) {
    if (source.taken || !visible(source)) {
      continue;
    }
    options.push({
      ...source,
      id: `drop:${index}`,
      label: weaponSpecification(source)?.name || 'Arma',
      count: 1,
      source: 'En el suelo',
      action: { type: 'loot', dropIndex: index },
    });
  }
  for (const source of state.groundItems || []) {
    if (source.heldBy || source.containerId || !((source.count ?? 0) > 0) || !visible(source)) {
      continue;
    }
    const stack = source.stack || source;
    options.push({
      ...stack,
      id: `ground:${source.id}`,
      label:
        source.type === 'money'
          ? 'Pesos'
          : weaponSpecification(stack)?.name ||
            (stack.outfit ? OUTFITS[stack.outfit]?.name : undefined) ||
            SUPPLY_ITEMS[stack.item || stack.type || '']?.label ||
            stack.name ||
            'Objeto',
      count: source.count ?? 0,
      source: 'En el suelo',
      action: { type: 'loot', ...(source.id === undefined ? {} : { groundId: source.id }) },
    });
  }
  return options;
}
/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TacticalPointer | null | undefined} point
 * @param {import('./public/hud-types.ts').TargetingContext} [ctx] */
export function pickupSelection(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  point: import('./public/hud-types.ts').TacticalPointer | null | undefined,
  ctx: import('./public/hud-types.ts').TargetingContext = {},
) {
  if (!unit || !point) {
    return [];
  }
  if (ctx.itemIntent === 'moveOnly') {
    return [];
  }
  const mode = ctx.mode ?? 'move';
  if (mode !== 'loot') {
    if (
      !['move', 'useItem'].includes(mode) ||
      ctx.movementIntent === 'preserveFacing' ||
      (ctx.itemIntent !== 'steal' &&
        unit.activeSlot === 'supply' &&
        unit?.activeSupply === 'torches')
    ) {
      return [];
    }
    // Match the attack preview and click controller: an explicit identity wins,
    // otherwise a known living occupant takes precedence over a body in its cell.
    const occupant = cellOccupant(
      state.units.filter(
        (other) =>
          sameCell(other, point) &&
          (other.side === unit.side ||
            state.units.some(
              (observer) => observer.side === unit.side && canSee(state, observer, other),
            )),
      ),
      point,
    );
    if (
      occupant &&
      !point.loot &&
      ctx.itemIntent !== 'steal' &&
      (occupant.hp > 0 || unit.activeSlot === 'medical')
    ) {
      return [];
    }
  }
  const preview = lootSearchPreview(state, unit, point);
  return preview.available ? [preview] : [];
}
/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TacticalPointer | null | undefined} point */
export function lootSelectionModel(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  point: import('./public/hud-types.ts').TacticalPointer | null | undefined,
  { id = '', count = 1 } = {},
) {
  const options = nearbyLootOptions(state, unit, point),
    item = options.find((option) => option.id === id) || options[0];
  const action = item ? { ...item.action, count } : null,
    preview = action ? lootApproachPreview(state, unit, action) : null;
  return { options, item, action, preview };
}
/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TacticalPointer | null | undefined} point */
export function lootBatchSelectionModel(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  point: import('./public/hud-types.ts').TacticalPointer | null | undefined,
  selection: Readonly<Record<string, number>> = {},
) {
  const options = nearbyLootOptions(state, unit, point),
    items: (
      | { targetId: string; item: string; count: number }
      | { groundId: string; count: number }
      | { dropIndex: number; count: number }
    )[] = [];
  let missing = false;
  for (const [id, count] of Object.entries(selection)) {
    const option = options.find((entry) => entry.id === id);
    if (!option) {
      missing = true;
      continue;
    }
    const source = option.action;
    if (source.targetId !== undefined && source.item !== undefined) {
      items.push({ targetId: source.targetId, item: source.item, count });
    } else if (source.groundId !== undefined) {
      items.push({ groundId: source.groundId, count });
    } else if (source.dropIndex !== undefined) {
      items.push({ dropIndex: source.dropIndex, count });
    } else {
      missing = true;
    }
  }
  const action = { type: 'lootBatch' as const, items },
    preview = missing
      ? {
          pa: 8,
          valid: false,
          reason: 'Un objeto seleccionado ya no está disponible. Revisá la selección.',
        }
      : lootBatchPreview(state, unit, items);
  return { options, action, preview, selectedCount: Object.keys(selection).length };
}
/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit[]} actors
 * @returns {(import('./public/compatibility-types.ts').TacticalPoint & {count:number})[]} */
export function groundLootPiles(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  actors: import('./public/compatibility-types.ts').BattleUnit[],
): (import('./public/compatibility-types.ts').TacticalPoint & { count: number })[] {
  const piles = new Map<
    string,
    import('./public/compatibility-types.ts').TacticalPoint & { count: number }
  >();
  for (const source of [
    ...(state.droppedWeapons ?? []).filter((item) => !item.taken),
    ...(state.groundItems ?? []).filter(
      (item) => (item.count ?? 0) > 0 && !item.heldBy && !item.containerId,
    ),
  ]) {
    if (!actors.some((actor) => canSee(state, actor, source))) {
      continue;
    }
    const key = spaceKey(source),
      pile = piles.get(key) ?? {
        x: source.x,
        y: source.y,
        ...(source.tacticalLevel === undefined ? {} : { tacticalLevel: source.tacticalLevel }),
        count: 0,
      };
    pile.count++;
    piles.set(key, pile);
  }
  return [...piles.values()];
}

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TargetingContext} [ctx]
 * @returns {import('./public/hud-types.ts').NearbyEnvironmentModel} */
export function nearbyEnvironmentModel(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  ctx: import('./public/hud-types.ts').TargetingContext = {},
): import('./public/hud-types.ts').NearbyEnvironmentModel {
  if (!unit) {
    return { targets: [], target: null, preview: null, contents: [], verbs: [], loot: null };
  }
  const found = new Map<string, NonNullable<ReturnType<typeof environmentTargetAt>>>();
  if (unit) {
    for (const point of [
      ...(state.wallEdges ?? []).map((edge) => ({ ...edge, wallEdgeId: wallEdgeId(edge) })),
      ...state.tiles,
    ]) {
      if (distance(unit, point.axis ? wallEdgeCenter(point) : point) > 1.5) {
        continue;
      }
      const raw = environmentTargetAt(state, point);
      if (!raw || !canSee(state, unit, raw)) {
        continue;
      }
      if (raw?.kind === 'container' && !environmentContainerVisible(state, unit, raw)) {
        continue;
      }
      if (raw && (raw.kind !== 'wall' || (tacticalLevel(raw) === 0 && sameSurface(unit, raw)))) {
        found.set(`${raw.kind}:${raw.id}`, raw);
      }
    }
  }
  const targets = [...found].map(([key, raw]) => {
    const summary = environmentTargetSummary(unit, raw);
    if (raw.kind === 'wall') {
      return {
        key,
        kind: raw.kind,
        id: raw.id,
        x: raw.x,
        y: raw.y,
        ...('axis' in raw && raw.axis ? { axis: raw.axis, wallEdgeId: wallEdgeId(raw) } : {}),
        tacticalLevel: 0,
        label: `${summary.label} · ${tacticalGridLabel(raw.x, raw.y)}`,
        ...(summary.material === undefined ? {} : { material: summary.material }),
      };
    }
    const arsenal = finiteArsenalsFor(state)[state.sectorId],
      arsenalAvailable =
        arsenal?.chest === raw.id &&
        (state.finiteArtilleryArsenal || ('artilleryRecovered' in raw && raw.artilleryRecovered));
    return {
      key,
      kind: raw.kind,
      id: raw.id,
      label: `${summary.label} · ${tacticalGridLabel(raw.x, raw.y)}`,
      open: summary.open,
      locked: summary.locked,
      broken: summary.broken,
      trapKnown: Boolean(summary.trap),
      trapArmed: summary.trap?.armed,
      ...(arsenalAvailable
        ? {
            arsenalHint:
              'artilleryRecovered' in raw && raw.artilleryRecovered
                ? 'Las piezas recuperadas quedan emplazadas. Usá Artillería en la carta para guardarlas o trasladarlas.'
                : `Abrí este cofre para recuperar ${arsenal.pieces.length} piezas del arsenal con munición finita.`,
          }
        : {}),
    };
  });
  const target = targets.find((entry) => entry.key === ctx.targetKey) || targets[0];
  if (!target) {
    return { targets, target: null, preview: null, contents: [], verbs: [], loot: null };
  }
  const raw = found.get(target.key),
    preview = environmentPreview(state, unit, target, ctx.verb || undefined);
  const contents = (target.kind === 'container' && raw ? visibleContainerContents(raw) : []).map(
    (stack, index) => ({
      ...stack,
      index,
      label:
        weaponSpecification(stack)?.name ||
        (stack.outfit ? OUTFITS[stack.outfit]?.name : undefined) ||
        Object.values(TOOL_TYPES).find((tool) => tool.toolKey === stack.toolKey)?.label ||
        (stack.item ? SUPPLY_ITEMS[stack.item]?.label : undefined) ||
        stack.name ||
        'Pertrechos',
    }),
  );
  const verbs = (
    target.kind === 'wall' ? ['breach'] : ENVIRONMENT_VERBS.filter((id) => id !== 'breach')
  ).map((id) => ({ id, label: environmentPreview(state, unit, target, id).label }));
  const loot =
    target.kind === 'container'
      ? containerLootPreview(state, unit, target, ctx.index ?? 0, ctx.count ?? 1)
      : null;
  return { targets, target, preview, contents, verbs, loot };
}

const ORDER_DEFS = [
  { id: 'move', label: 'Mover', kind: 'mode' },
  { id: 'look', label: 'Mirar', kind: 'mode' },
  { id: 'stealth', label: 'Sigilo', kind: 'order' },
  { id: 'useItem', label: 'Usar objeto equipado', kind: 'mode' },
  { id: 'fire', label: 'Disparar', kind: 'mode' },
  { id: 'melee', label: 'Atacar', kind: 'mode' },
  { id: 'charge', label: 'Cargar', kind: 'mode' },
  { id: 'heal', label: 'Vendar', kind: 'mode' },
  { id: 'loot', label: 'Recoger equipo', kind: 'mode' },
  { id: 'reload', label: 'Recargar', kind: 'order' },
  { id: 'reprime', label: 'Resolver fallo', kind: 'order' },
  { id: 'weapon', label: 'Cambiar arma', kind: 'order' },
  { id: 'stance', label: 'Postura', kind: 'order' },
  { id: 'overwatch', label: 'Cubrir', kind: 'order' },
  { id: 'mount', label: 'Montar', kind: 'order' },
  { id: 'brace', label: 'Guardia de bayoneta', kind: 'order' },
  { id: 'repair', label: 'Mantener arma', kind: 'order' },
  { id: 'ration', label: 'Comer tasajo', kind: 'order' },
  { id: 'torch', label: 'Arrojar antorcha', kind: 'mode' },
  { id: 'bolas', label: 'Lanzar boleadoras', kind: 'mode' },
  { id: 'free', label: 'Liberarse', kind: 'order' },
  { id: 'sight', label: 'Campo de visión', kind: 'toggle' },
  { id: 'endTurn', label: 'Fin del turno', kind: 'order' },
  { id: 'artillery', label: 'Disparar cañón', kind: 'mode' },
  { id: 'artilleryMove', label: 'Desplazar pieza', kind: 'mode' },
  { id: 'artilleryPivot', label: 'Girar pieza', kind: 'mode' },
  { id: 'artilleryReload', label: 'Recargar pieza', kind: 'order' },
] as const;
type OrderId = (typeof ORDER_DEFS)[number]['id'];

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TargetingContext} [ctx]
 * @returns {import('./public/hud-types.ts').OrderDescriptor[]} */
export function orderDescriptors(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  unit: import('./public/compatibility-types.ts').BattleUnit | null | undefined,
  ctx: import('./public/hud-types.ts').TargetingContext = {},
): import('./public/hud-types.ts').OrderDescriptor[] {
  if (!unit) {
    return ORDER_DEFS.map((def) => ({ ...def, disabled: true }));
  }
  const u = unit;
  const unitAlive = alive(u);
  const busy = Boolean(ctx.busy);
  const statusActive = state.status === 'active';
  const baseDisabled = !unitAlive || busy || !statusActive || !unitCanAct(state, unit);
  const firearm = hasFirearm(u);
  const blade = bladeFor(u);
  const gun = (state.artillery || []).find((g) => g.id === ctx.cannonId && g.side === u.side);
  const costs = actionCosts(state, unit);
  const gunCosts = gun && unit ? artilleryCosts(state, u, gun) : null,
    gunLoading = artilleryReloadPreview(state, unit, gun);
  const gunCostKeys = {
    artillery: 'fire',
    artilleryMove: 'move',
    artilleryPivot: 'pivot',
  } as const;
  const gunPlans = {
    artillery: artilleryCrewPlan(state, unit, gun, gunCosts?.fire ?? 0),
    artilleryMove: artilleryCrewPlan(state, unit, gun, gunCosts?.move ?? 0),
    artilleryPivot: artilleryCrewPlan(state, unit, gun, gunCosts?.pivot ?? 0),
    artilleryReload: gunLoading,
  };
  const loading = unit ? reloadPlan(unit, state) : null;
  const priming = unit ? reprimePlan(unit, state) : null;
  const maintenance = firearmMaintenancePreview(state, unit);
  const pa: Partial<Record<OrderId, number>> = {
    ...costs,
    reload: loading?.pa ?? 0,
    fire: costs.fire + Math.max(0, Math.min(4, Math.floor(ctx.aim || 0))) * costs.aim,
    stance: unit ? stanceCost(u, nextStance(u)) : 0,
  };
  const attack =
    unit && !['medical', 'tool', 'supply', 'item'].includes(u.activeSlot)
      ? contextualAttack(state, u, ctx.target, { aim: ctx.aim || 0 })
      : null;
  const medicalPreview = medicalUsePreview(state, unit, ctx.target ?? unit);
  const itemPreview = ctx.target ? itemUsePreview(state, unit, ctx.target) : null;
  const localMelee = unit && ctx.target ? meleePreview(state, unit, ctx.target) : null;
  const supplyAliases = {
    ration: supplyUsePreview(state, unit, ctx.target ?? unit, 'rations'),
    torch: supplyUsePreview(
      state,
      unit,
      ctx.target ?? {
        x: ctx.x,
        y: ctx.y,
        ...(ctx.tacticalLevel === undefined ? {} : { tacticalLevel: ctx.tacticalLevel }),
      },
      'torches',
    ),
    bolas: supplyUsePreview(
      state,
      unit,
      ctx.target ??
        (Number.isInteger(ctx.x) && Number.isInteger(ctx.y)
          ? {
              x: ctx.x,
              y: ctx.y,
              ...(ctx.tacticalLevel === undefined ? {} : { tacticalLevel: ctx.tacticalLevel }),
            }
          : undefined),
      'boleadoras',
    ),
  };
  pa.heal = medicalPreview.cost;
  for (const id of ['ration', 'torch', 'bolas'] as const) {
    pa[id] = supplyAliases[id].cost;
  }
  pa.useItem = u.activeSlot === 'medical' ? medicalPreview.cost : (attack?.pa ?? costs.melee);
  if (itemPreview) {
    pa.useItem = itemPreview.pa;
  }
  const supplyPreview =
    u.activeSlot === 'supply'
      ? supplyUsePreview(state, u, ctx.target ?? (u.activeSupply === 'rations' ? u : undefined))
      : null;
  if (supplyPreview) {
    pa.useItem = supplyPreview.cost;
  }
  if (['tool', 'item'].includes(u.activeSlot)) {
    delete pa.useItem;
  }
  if (gun && unit) {
    const gunCosts = artilleryCosts(state, unit, gun);
    for (const [id, costId] of [
      ['artillery', 'fire'],
      ['artilleryMove', 'move'],
      ['artilleryPivot', 'pivot'],
      ['artilleryReload', 'reload'],
    ] as const) {
      pa[id] =
        id === 'artilleryReload' ? artilleryReloadPreview(state, unit, gun).pa : gunCosts[costId];
    }
  }

  const disabled = {
    move: Boolean(u.entangled),
    look: false,
    stealth: Boolean(u.mounted) && !u.stealthMode,
    useItem:
      u.activeSlot === 'item'
        ? true
        : itemPreview
          ? !itemPreview.valid
          : u.activeSlot === 'supply'
            ? !heldSupply(u) ||
              ((u.activeSupply === 'rations' || ctx.target) && !supplyPreview?.allowed)
            : u.activeSlot === 'tool'
              ? !heldTool(u)
              : u.activeSlot === 'medical'
                ? !medicalPreview.allowed
                : attack?.type === 'fire' && (!(u.loaded > 0) || Boolean(u.jammed)),
    fire: !firearm || !(u.loaded > 0) || Boolean(u.jammed),
    melee: localMelee
      ? !localMelee.valid
      : blade.usable === false || ['medical', 'tool', 'supply', 'item'].includes(u.activeSlot),
    charge:
      blade.usable === false ||
      blade.id <= 0 ||
      ['medical', 'tool', 'supply', 'item'].includes(u.activeSlot) ||
      u.stance === 'prone',
    heal: !medicalPreview.allowed,
    loot: false,
    reload: !firearm || !loading?.pa || !loading.available || Boolean(u.jammed),
    reprime: !firearm || !priming?.hands.length,
    weapon: false,
    stance: Boolean(u.mounted),
    overwatch: !u.overwatch && (!firearm || !(u.loaded > 0) || Boolean(u.jammed)),
    mount: !u.horse,
    brace: !fixedBayonetFor(u) || u.stance === 'prone',
    repair: !maintenance.valid,
    ration: !supplyAliases.ration.allowed,
    torch: !supplyAliases.torch.allowed,
    bolas: !supplyAliases.bolas.allowed,
    free: !u.entangled,
    sight: false,
    endTurn: false,
    artillery: !gun || !gun.loaded,
    artilleryMove: !gun,
    artilleryPivot: !gun,
    artilleryReload: !gun || Boolean(gun.loaded) || !(gun.ammo > 0),
  };

  const active: Partial<Record<OrderId, boolean>> = {
    overwatch: Boolean(u.overwatch),
    brace: Boolean(u.braced),
    stealth: Boolean(u.stealthMode),
  };

  return ORDER_DEFS.map((def) => {
    const reserveOff = def.id === 'overwatch' && u.overwatch;
    let unavailable =
      Boolean(disabled[def.id]) ||
      (Boolean(u.knockedDown) &&
        ![
          'stance',
          'heal',
          'ration',
          'sight',
          'endTurn',
          ...(u.activeSlot === 'medical' ||
          (u.activeSlot === 'supply' && u.activeSupply === 'rations')
            ? ['useItem']
            : []),
        ].includes(def.id));
    if (gun && def.id.startsWith('artillery')) {
      const crew =
        def.id === 'artilleryReload'
          ? artilleryReloadPreview(state, unit, gun)
          : artilleryCrewPlan(state, unit, gun, pa[def.id] ?? 0);
      unavailable ||= Boolean(crew.reason);
    }
    const label =
      def.id === 'useItem'
        ? u.activeSlot === 'item'
          ? 'Objeto sin uso'
          : u.activeSlot === 'supply'
            ? 'Usar pertrecho'
            : u.activeSlot === 'tool'
              ? 'Usar herramienta'
              : u.activeSlot === 'medical'
                ? 'Usar vendas'
                : firearm
                  ? 'Usar arma'
                  : u.activeSlot === 'unarmed'
                    ? 'Usar puños'
                    : 'Usar arma blanca'
        : def.id === 'reprime' && priming
          ? reprimeLabel(priming)
          : def.id === 'reload' && loading?.hands
            ? reloadLabel(loading)
            : def.id === 'stance'
              ? stanceLabel(nextStance(u))
              : def.id === 'overwatch' && u.overwatch
                ? 'Cancelar cobertura'
                : def.label;
    /** @type {{id:string,label:string,kind:string,disabled:boolean,pa?:number,reserve?:boolean,active?:boolean}} */
    const actionPoints = pa[def.id];
    const d: OrderDescriptor = {
      id: def.id,
      label:
        def.id === 'melee' && blade.id === 0
          ? 'Golpear con las manos vacías'
          : def.id === 'melee' && blade.id === -1
            ? 'Golpear con la culata'
            : label,
      kind: def.kind,
      disabled:
        baseDisabled ||
        unavailable ||
        (!reserveOff && actionPoints !== undefined && !affordable(state, u, actionPoints)),
    };
    if (def.id === 'overwatch') {
      d.reserve = !reserveOff;
    }
    if (actionPoints !== undefined) {
      d.pa = state.mode === 'exploration' ? 0 : actionPoints;
    }
    // Pickup can mean an 8-AP corpse search or an all-remaining-AP grab.
    // Show its actual cost on the target preview, not on the shared cursor.
    if (def.id === 'loot' && u.activeSlot === 'unarmed') {
      delete d.pa;
    }
    if (reserveOff) {
      d.pa = 0;
    }
    const activeOrder = active[def.id];
    if (activeOrder !== undefined) {
      d.active = activeOrder;
    }
    if (
      def.id === 'artillery' ||
      def.id === 'artilleryMove' ||
      def.id === 'artilleryPivot' ||
      def.id === 'artilleryReload'
    ) {
      const plan = gunPlans[def.id],
        cost =
          def.id === 'artilleryReload' ? gunLoading.pa : (gunCosts?.[gunCostKeys[def.id]] ?? 0);
      d.pa = state.mode === 'exploration' ? 0 : cost;
      if (state.mode === 'exploration') {
        d.seconds = cost ? Math.max(1, Math.ceil(cost * 0.06)) : 0;
      }
      d.detail =
        plan.reason ||
        (def.id === 'artillery' && !gun?.loaded
          ? 'Primero hay que recargar la pieza.'
          : def.id === 'artilleryReload' && gunLoading.partial
            ? `${formatAP(cost)} PA por artillero ahora; faltan ${formatAP(gunLoading.remainingPA)} PA por artillero.`
            : state.mode === 'exploration'
              ? 'Trabajo simultáneo de la dotación.'
              : `${formatAP(cost)} PA por artillero.`);
    }
    if (def.id === 'fire' && firearm && (weaponFor(u).readyAP ?? 0) > 0) {
      if (state.mode === 'exploration') {
        d.seconds = Math.max(1, Math.ceil(costs.fire * 0.06));
        d.detail = costs.ready ? 'Levanta el arma antes de disparar.' : 'Arma en posición de tiro.';
      } else {
        d.detail = costs.ready
          ? `Preparar: ${formatAP(costs.ready)} PA · disparar: ${formatAP(costs.discharge)} PA.`
          : `Arma en posición de tiro · disparar: ${formatAP(costs.discharge)} PA.`;
      }
    }
    if (def.id === 'reload' && loading) {
      if (state.mode === 'exploration') {
        d.seconds = loading.pa ? Math.max(1, Math.ceil(loading.pa * 0.06)) : 0;
      }
      d.detail = loading.partial
        ? `${loading.rounds} cartuchos; después faltan ${formatAP(loading.remainingPA)} PA.`
        : `${loading.rounds} cartuchos; recarga completa.`;
    }
    if (def.id === 'repair') {
      d.action = maintenance.action;
      d.detail =
        maintenance.reason ||
        `Estado +${maintenanceGainFormat.format(maintenance.gain)} puntos · materiales: ${maintenance.materialCost} puntos.`;
    }
    return d;
  });
}

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {import('./public/compatibility-types.ts').BattleUnit | null | undefined} unit
 * @param {import('./public/hud-types.ts').TargetingContext} [ctx]
 * @param {string} id
 * @returns {import('./public/hud-types.ts').TacticalOrder} */
export function orderAction(
  _state: BattleSnapshot,
  unit: BattleUnit | null | undefined,
  ctx: TargetingContext = {},
  id: string,
): TacticalOrder {
  const point = {
    ...(ctx.x === undefined ? {} : { x: ctx.x }),
    ...(ctx.y === undefined ? {} : { y: ctx.y }),
    ...(ctx.tacticalLevel === undefined ? {} : { tacticalLevel: ctx.tacticalLevel }),
  };
  const target = ctx.targetId === undefined ? {} : { targetId: ctx.targetId };
  const artillery = ctx.artilleryId === undefined ? {} : { artilleryId: ctx.artilleryId };
  switch (id) {
    case 'movement':
      return { type: 'movement', ...(ctx.movement ? { movement: ctx.movement } : {}) };
    case 'climb':
      return { type: 'climb', ...(ctx.linkId ? { linkId: ctx.linkId } : {}) };
    case 'look':
      return { type: 'look', ...point };
    case 'stealth':
      return { type: 'stealth', enabled: ctx.enabled ?? !unit?.stealthMode };
    case 'reload':
    case 'reprime':
    case 'overwatch':
    case 'mount':
    case 'brace':
    case 'repair':
    case 'ration':
    case 'free':
      return { type: id };
    case 'weapon':
      return slotAction(unit);
    case 'stance':
      return { type: 'stance', stance: ctx.stance ?? (unit ? nextStance(unit) : 'standing') };
    case 'equipLoot':
      return {
        type: 'equipLoot',
        ...(ctx.inventoryKey ? { inventoryKey: ctx.inventoryKey } : {}),
        ...(ctx.slot ? { slot: ctx.slot } : {}),
      };
    case 'torch':
      return { type: 'throwTorch', ...point };
    case 'bolas':
      return ctx.targetId !== undefined
        ? { type: 'boleadoras', ...target }
        : { type: 'boleadoras', ...point };
    case 'artillery':
      return {
        type: 'artillery',
        ...artillery,
        ...point,
        ...target,
        ...(ctx.mode ? { mode: ctx.mode } : {}),
      };
    case 'artilleryMove':
    case 'artilleryPivot':
      return { type: id, ...artillery, ...point };
    case 'artilleryReload':
      return { type: 'artilleryReload', ...artillery };
    case 'endTurn':
      return { type: 'rest' };
    case 'move':
      if (ctx.x === undefined || ctx.y === undefined) {
        throw Error('Seleccioná una casilla de destino.');
      }
      return { type: 'move', x: ctx.x, y: ctx.y, tacticalLevel: tacticalLevel(ctx) };
    case 'fire':
    case 'melee':
    case 'charge':
    case 'heal':
    case 'loot':
      return { type: id, ...target };
    case 'useItem':
      return {
        type: 'useItem',
        ...target,
        aim: ctx.aim ?? 0,
        hitLocation: hitLocationFor(ctx.hitLocation),
      };
    default:
      throw Error(`La orden táctica no existe: ${id}`);
  }
}

/** Keep departure receipts in the saved state, outside all field render lists. */
/** @param {Pick<import('./public/compatibility-types.ts').BattleSnapshot,'units'>} state
 * @returns {import('./public/compatibility-types.ts').BattleUnit[]} */
export function fieldUnits(
  state: Pick<import('./public/compatibility-types.ts').BattleSnapshot, 'units'>,
): import('./public/compatibility-types.ts').BattleUnit[] {
  return state.units.filter((unit) => !unit.departure && !unit.fled);
}
/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @returns {import('./public/compatibility-types.ts').BattleSnapshot} */
export function fieldState(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
): import('./public/compatibility-types.ts').BattleSnapshot {
  return { ...state, units: fieldUnits(state) };
}

/** @param {import('./public/compatibility-types.ts').BattleSnapshot} state
 * @param {{unitIds?:string[],exitId?:string}} [selection]
 * @param {import('./public/compatibility-types.ts').CampaignContext} [context]
 * @returns {import('./public/hud-types.ts').ExitModel} */
export function exitModel(
  state: import('./public/compatibility-types.ts').BattleSnapshot,
  {
    unitIds = /** @type {string[]} */ ([]),
    exitId = '',
  }: { unitIds?: string[]; exitId?: string } = {},
  context: import('./public/compatibility-types.ts').CampaignContext = state,
): import('./public/hud-types.ts').ExitModel {
  const units = fieldUnits(state).filter((unit) => unit.side === 'player' && unit.hp > 0);
  const ids = [...new Set(unitIds)].filter((id) => units.some((unit) => unit.id === id));
  const exits = (state.exits || []).map((exit) => ({
    ...exit,
    label: `${{ N: 'Norte', E: 'Este', S: 'Sur', W: 'Oeste' }[exit.edge] || exit.edge} · ${campaignPlace(exit.destination, context)?.name ?? String(exit.destination).replaceAll('_', ' ')}`,
  }));
  const selectedExit = exits.find((exit) => exit.id === exitId) || exits[0];
  const preview = exitPreview(state, { unitIds: ids, exitId: selectedExit?.id });
  const action: TacticalOrder = {
    type: 'exit',
    unitIds: ids,
    ...(selectedExit ? { exitId: selectedExit.id } : {}),
  };
  return {
    units,
    exits,
    selectedExit,
    unitIds: ids,
    preview,
    action,
    departures: state.units.filter((unit) => unit.side === 'player' && unit.departure),
  };
}
