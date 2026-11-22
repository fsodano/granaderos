import { FieldOfView } from './domain/perception/field-of-view.ts';
import { fittingWeight, weaponItemWeight } from './weapon-fittings.js';
import { SUPPLY_ITEMS } from './tactical-inventory.js';
export { approximateHeardPosition, directionTo } from './domain/perception/npc-perception.ts';
// Source rules: JA2 manual pp. 18–20 describes movement, facing, and an
// independent stealth toggle; p. 35 describes limited sight and mutual hearing.
// Patusco's guide 1.3 pp. 13, 26 describes sound lures and stealth/night skills.
// The cone, AP costs, sound radii, and uncertainty below are Granaderos tuning.
// These helpers neither inspect a battle nor use RNG or change their inputs.
export const FACING_LABELS = Object.freeze(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);
export const NOISE_KINDS = Object.freeze([
  'move',
  'fire',
  'reload',
  'door',
  'melee',
  'knife',
  'explosion',
  'alarm',
]);

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function finite(value, label, minimum = -Infinity) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    throw new RangeError(`${label} is invalid.`);
  }
  return value;
}
function facing(value) {
  if (!Number.isInteger(value) || value < 0 || value > 7) {
    throw new RangeError('Facing must be an integer from 0 to 7.');
  }
  return value;
}
const facingOf = (unit) =>
  facing(unit.facing ?? (unit.side === 'enemy' ? 6 : unit.side === 'player' ? 2 : 0));
function noiseKind(kind) {
  if (!NOISE_KINDS.includes(kind)) {
    throw new RangeError(`Unknown noise kind: ${String(kind)}`);
  }
  return kind;
}

// This is only the facing gate. The caller must still check range, walls,
// smoke, illumination, and whether the observer is able to see.
export function facingAllowsSight(observer, target, { peripheralRange = 2, halfArc = 2 } = {}) {
  return new FieldOfView(facingOf(observer), peripheralRange, halfArc).includes(observer, target);
}

export function turnAPCost(unit, newFacing) {
  const difference = Math.abs(facing(newFacing) - facingOf(unit));
  return Math.min(difference, 8 - difference) * (unit.stance === 'prone' ? 4 : 2);
}

// Toggling stealth is free; each subsequent movement step pays this multiplier.
// Posture remains independent. A mounted rider cannot silence hoofbeats.
export const stealthAPMultiplier = (unit) => (unit.stealthMode && !unit.mounted ? 1.25 : 1);

function burdenNoise(unit) {
  const inventory = Object.values(unit.inventory ?? {}).reduce((total, item) => {
    if (typeof item !== 'object' || item === null) {
      return total;
    }
    return (
      total +
      finite(item.count ?? 0, 'Item count', 0) *
        (finite(item.weight ?? 0, 'Item weight', 0) +
          fittingWeight(item) +
          finite(item.loaded ?? 0, 'Loaded rounds', 0) * 0.04)
    );
  }, 0);
  const weaponWeight = unit.weaponDropped ? 0 : weaponItemWeight(unit.weapon) + fittingWeight(unit);
  const bladeWeight = weaponItemWeight(unit.blade);
  const carried =
    finite(unit.weight ?? unit.carryWeight ?? 0, 'Carried weight', 0) +
    inventory +
    weaponWeight +
    bladeWeight +
    finite(unit.loaded ?? 0, 'Loaded rounds', 0) * 0.04 +
    Object.entries(SUPPLY_ITEMS).reduce(
      (sum, [key, item]) => sum + finite(unit[key] ?? 0, 'Supply quantity', 0) * item.weight,
      0,
    );
  const capacity = Math.max(10, finite(unit.strength ?? 50, 'Strength', 0) * 0.5);
  // Overload makes straps, equipment, and foot placement harder to control.
  // Three extra audible tiles per capacity of excess is period game tuning.
  return Math.ceil(Math.max(0, carried / capacity - 1) * 3);
}

export function noiseRadius(kind, unit = {}, tile = {}) {
  noiseKind(kind);
  const heldFacon =
    unit.activeSlot === 'blade'
      ? unit.blade === 1813
      : (unit.activeSlot ?? 'primary') === 'primary' && !unit.weaponDropped && unit.weapon === 1813;
  if (kind === 'melee' && heldFacon) {
    return 3;
  }
  if (kind !== 'move') {
    return { fire: 18, reload: 3, door: 5, melee: 7, knife: 2, explosion: 28, alarm: 20 }[kind];
  }
  const mode = unit.movementMode ?? 'walk';
  if (!['walk', 'run', 'crouch', 'prone'].includes(mode)) {
    throw new RangeError('Unknown movement mode.');
  }
  const surface = { stone: 2, rubble: 2, forest: 1, scrub: 1, mud: 1, water: 3 }[tile.type] ?? 0;
  const base =
    { walk: 4, run: 8, crouch: 3, prone: 2 }[mode] +
    surface +
    (unit.mounted ? 4 : 0) +
    burdenNoise(unit);
  const skill = clamp(finite(unit.stealth ?? 0, 'Stealth skill', 0), 0, 100);
  const quiet = unit.stealthMode && !unit.mounted ? 0.65 - skill * 0.003 : 1;
  return Math.max(1, Math.ceil(base * quiet));
}

// The heard-position and direction rules live in the domain module and are
// re-exported above; the sight, movement, and noise-radius rules stay here.
