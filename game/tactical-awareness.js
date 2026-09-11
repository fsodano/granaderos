import {fittingWeight,weaponItemWeight} from './weapon-fittings.js';
import {SUPPLY_ITEMS} from './tactical-inventory.js';
// Source rules: JA2 manual pp. 18–20 describes movement, facing, and an
// independent stealth toggle; p. 35 describes limited sight and mutual hearing.
// Patusco's guide 1.3 pp. 13, 26 describes sound lures and stealth/night skills.
// The cone, AP costs, sound radii, and uncertainty below are Granaderos tuning.
// These helpers neither inspect a battle nor use RNG or change their inputs.
export const FACING_LABELS = Object.freeze(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);
export const NOISE_KINDS = Object.freeze(['move', 'fire', 'reload', 'door', 'melee', 'explosion', 'alarm']);

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function finite(value, label, minimum = -Infinity) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) throw new RangeError(`${label} is invalid.`);
  return value;
}
function point(value) {
  finite(value?.x, 'X coordinate'); finite(value?.y, 'Y coordinate');
}
function facing(value) {
  if (!Number.isInteger(value) || value < 0 || value > 7) throw new RangeError('Facing must be an integer from 0 to 7.');
  return value;
}
const facingOf = unit => facing(unit.facing ?? (unit.side === 'enemy' ? 6 : unit.side === 'player' ? 2 : 0));
function noiseKind(kind) {
  if (!NOISE_KINDS.includes(kind)) throw new RangeError(`Unknown noise kind: ${String(kind)}`);
  return kind;
}

// Grid Y increases southward. Coincident points retain the supplied/current
// facing. Legacy units without facing look toward the opposite deployment edge.
export function directionTo(from, to, fallback = facingOf(from)) {
  point(from); point(to); facing(fallback);
  if (from.x === to.x && from.y === to.y) return fallback;
  return (Math.round(Math.atan2(to.x - from.x, from.y - to.y) / (Math.PI / 4)) + 8) % 8;
}

// This is only the facing gate. The caller must still check range, walls,
// smoke, illumination, and whether the observer is able to see.
export function facingAllowsSight(observer, target, {peripheralRange = 2, halfArc = 2} = {}) {
  point(observer); point(target);
  finite(peripheralRange, 'Peripheral range', 0);
  finite(halfArc, 'Half arc', 0);
  if (halfArc > 4) throw new RangeError('Half arc cannot exceed four compass steps.');
  const angle = facingOf(observer) * Math.PI / 4;
  const dx = target.x - observer.x, dy = target.y - observer.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= peripheralRange) return true;
  const alignment = (dx * Math.sin(angle) - dy * Math.cos(angle)) / distance;
  return alignment + 1e-12 >= Math.cos(halfArc * Math.PI / 4);
}

export function turnAPCost(unit, newFacing) {
  const difference = Math.abs(facing(newFacing) - facingOf(unit));
  return Math.min(difference, 8 - difference) * (unit.stance === 'prone' ? 4 : 2);
}

// Toggling stealth is free; each subsequent movement step pays this multiplier.
// Posture remains independent. A mounted rider cannot silence hoofbeats.
export const stealthAPMultiplier = unit => unit.stealthMode && !unit.mounted ? 1.25 : 1;

function burdenNoise(unit) {
  const inventory = Object.values(unit.inventory ?? {}).reduce((total, item) => {
    if (typeof item !== 'object' || item === null) return total;
    return total + finite(item.count ?? 0, 'Item count', 0) * (finite(item.weight ?? 0, 'Item weight', 0)+fittingWeight(item)+finite(item.loaded??0,'Loaded rounds',0)*.04);
  }, 0);
  const weaponWeight = unit.weaponDropped ? 0 : weaponItemWeight(unit.weapon)+fittingWeight(unit);
  const bladeWeight = weaponItemWeight(unit.blade);
  const carried = finite(unit.weight ?? unit.carryWeight ?? 0, 'Carried weight', 0) + inventory + weaponWeight + bladeWeight +
    finite(unit.loaded ?? 0, 'Loaded rounds', 0)*.04+Object.entries(SUPPLY_ITEMS).reduce((sum,[key,item])=>sum+finite(unit[key]??0,'Supply quantity',0)*item.weight,0);
  const capacity = Math.max(10, finite(unit.strength ?? 50, 'Strength', 0) * .5);
  // Overload makes straps, equipment, and foot placement harder to control.
  // Three extra audible tiles per capacity of excess is period game tuning.
  return Math.ceil(Math.max(0, carried / capacity - 1) * 3);
}

export function noiseRadius(kind, unit = {}, tile = {}) {
  noiseKind(kind);
  const heldFacon = unit.activeSlot === 'blade' ? unit.blade === 1813 : (unit.activeSlot ?? 'primary') === 'primary' && !unit.weaponDropped && unit.weapon === 1813;
  if (kind === 'melee' && heldFacon) return 3;
  if (kind !== 'move') return {fire: 18, reload: 3, door: 5, melee: 7, explosion: 28, alarm: 20}[kind];
  const mode = unit.movementMode ?? 'walk';
  if (!['walk', 'run', 'crouch', 'prone'].includes(mode)) throw new RangeError('Unknown movement mode.');
  const surface = {stone: 2, rubble: 2, forest: 1, scrub: 1, mud: 1, water: 3}[tile.type] ?? 0;
  const base = {walk: 4, run: 8, crouch: 3, prone: 2}[mode] + surface + (unit.mounted ? 4 : 0) + burdenNoise(unit);
  const skill = clamp(finite(unit.stealth ?? 0, 'Stealth skill', 0), 0, 100);
  const quiet = unit.stealthMode && !unit.mounted ? .65 - skill * .003 : 1;
  return Math.max(1, Math.ceil(base * quiet));
}

// Return an anonymous sound report, never the source object, its ID, side, HP,
// or exact-position flag. Coarse cells stay stable across repeated reports so
// repeated clicks/listeners cannot average deterministic offsets into a fix.
// uncertainty is a radius in tiles, including clamped cells at map boundaries.
// Obstructions are supplied by the caller and muffle three tiles each; hearing
// can cross a wall, unlike sight. Facing does not gate hearing.
export function approximateHeardPosition(listener, source, {kind = 'move', radius, turn = 0, width, height, obstructions = 0, night = false} = {}) {
  point(listener); point(source); noiseKind(kind);
  finite(radius, 'Noise radius', 0); finite(obstructions, 'Sound obstructions', 0);
  if (!Number.isInteger(turn) || turn < 0) throw new RangeError('Sound turn must be a nonnegative integer.');
  for (const bound of [width, height]) if (bound !== undefined && (!Number.isInteger(bound) || bound < 1)) throw new RangeError('Map dimensions must be positive integers.');
  if (listener.hp !== undefined && listener.hp <= 0 || listener.unconscious) return null;
  const nightBonus = night ? listener.traits?.includes('night_vision') ? 2 : listener.traits?.includes('night_vision_basic') ? 1 : 0 : 0;
  const effectiveRadius = Math.max(0, radius + nightBonus - obstructions * 3 - (listener.movementMode === 'run' ? 2 : 0));
  const distance = Math.hypot(source.x - listener.x, source.y - listener.y);
  if (radius === 0 || effectiveRadius === 0 || distance > effectiveRadius) return null;
  // Loud sounds carry farther but do not pinpoint an unseen shooter. Every
  // listener uses the same grid for this sound kind/radius, preventing a more
  // precise fix simply by requesting the same report from several soldiers.
  const cellSize = radius <= 8 ? 3 : 5, half = (cellSize - 1) / 2;
  const x = Math.floor(source.x / cellSize) * cellSize + half;
  const y = Math.floor(source.y / cellSize) * cellSize + half;
  return {
    x: width === undefined ? x : clamp(x, 0, width - 1),
    y: height === undefined ? y : clamp(y, 0, height - 1),
    turn, kind, uncertainty: Math.ceil(Math.SQRT2 * half),
  };
}
