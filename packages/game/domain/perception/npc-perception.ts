// A sound report never retains the live identity of the shooter. A civilian can
// know where a sound came from without knowing who made it, so the report holds
// only the coarse cell, the turn, the kind, and the uncertainty.
export type SoundSource = Readonly<{ x: number; y: number }>;
export type SoundListener = SoundSource &
  Readonly<{
    facing?: number | undefined;
    side?: string | undefined;
    hp?: number | undefined;
    unconscious?: boolean | undefined;
    movementMode?: string | undefined;
    traits?: readonly string[] | undefined;
  }>;
export type SoundReportOptions = Readonly<{
  kind?: string | undefined;
  radius: number;
  turn?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  obstructions?: number | undefined;
  night?: boolean | undefined;
}>;
export type SoundReport = Readonly<{
  x: number;
  y: number;
  turn: number;
  kind: string;
  uncertainty: number;
}>;

const CompassSteps = 8;
const RadiansPerStep = Math.PI / 4;
const SmallSoundRadius = 8;
const SmallSoundCellSize = 3;
const LargeSoundCellSize = 5;
const ObstructionMuffle = 3;
const NightVisionBonus = 2;
const BasicNightVisionBonus = 1;
const RunningHearingPenalty = 2;
const NoiseKinds: readonly string[] = Object.freeze([
  'move',
  'fire',
  'reload',
  'door',
  'melee',
  'knife',
  'explosion',
  'alarm',
]);

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, value));

function finite(value: unknown, label: string, minimum = -Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    throw new RangeError(`${label} is invalid.`);
  }
  return value;
}

function point(value: { readonly x?: unknown; readonly y?: unknown } | undefined): void {
  finite(value?.x, 'X coordinate');
  finite(value?.y, 'Y coordinate');
}

function facing(value: number | undefined): number {
  if (value === undefined || !Number.isInteger(value) || value < 0 || value > 7) {
    throw new RangeError('Facing must be an integer from 0 to 7.');
  }
  return value;
}

// Legacy units without a facing look toward the opposite deployment edge.
const facingOf = (unit: SoundListener): number =>
  facing(unit.facing ?? (unit.side === 'enemy' ? 6 : unit.side === 'player' ? 2 : 0));

function noiseKind(kind: string | undefined): string {
  if (kind === undefined || !NoiseKinds.includes(kind)) {
    throw new RangeError(`Unknown noise kind: ${String(kind)}`);
  }
  return kind;
}

// Grid Y increases southward. Coincident points retain the supplied/current
// facing. The default fallback is the listener's current facing.
export function directionTo(
  from: SoundListener,
  to: SoundSource,
  fallback: number = facingOf(from),
): number {
  point(from);
  point(to);
  facing(fallback);
  if (from.x === to.x && from.y === to.y) {
    return fallback;
  }
  return (
    (Math.round(Math.atan2(to.x - from.x, from.y - to.y) / RadiansPerStep) + CompassSteps) %
    CompassSteps
  );
}

// Return an anonymous sound report, never the source object, its ID, side, HP,
// or exact-position flag. Coarse cells stay stable across repeated reports so
// repeated clicks/listeners cannot average deterministic offsets into a fix.
// uncertainty is a radius in tiles, including clamped cells at map boundaries.
// Obstructions are supplied by the caller and muffle three tiles each; hearing
// can cross a wall, unlike sight. Night vision widens a running listener's
// hearing less, and facing does not gate hearing.
export function approximateHeardPosition(
  listener: SoundListener,
  source: SoundSource,
  {
    kind = 'move',
    radius,
    turn = 0,
    width,
    height,
    obstructions = 0,
    night = false,
  }: Partial<SoundReportOptions> = {},
): SoundReport | null {
  point(listener);
  point(source);
  noiseKind(kind);
  const soundRadius = finite(radius, 'Noise radius', 0);
  const muffling = finite(obstructions, 'Sound obstructions', 0);
  if (!Number.isInteger(turn) || turn < 0) {
    throw new RangeError('Sound turn must be a nonnegative integer.');
  }
  for (const bound of [width, height]) {
    if (bound !== undefined && (!Number.isInteger(bound) || bound < 1)) {
      throw new RangeError('Map dimensions must be positive integers.');
    }
  }
  if ((listener.hp !== undefined && listener.hp <= 0) || listener.unconscious) {
    return null;
  }
  const nightBonus = night
    ? listener.traits?.includes('night_vision')
      ? NightVisionBonus
      : listener.traits?.includes('night_vision_basic')
        ? BasicNightVisionBonus
        : 0
    : 0;
  const effectiveRadius = Math.max(
    0,
    soundRadius +
      nightBonus -
      muffling * ObstructionMuffle -
      (listener.movementMode === 'run' ? RunningHearingPenalty : 0),
  );
  const distance = Math.hypot(source.x - listener.x, source.y - listener.y);
  if (soundRadius === 0 || effectiveRadius === 0 || distance > effectiveRadius) {
    return null;
  }
  // Loud sounds carry farther but do not pinpoint an unseen shooter. Every
  // listener uses the same grid for this sound kind/radius, preventing a more
  // precise fix simply by requesting the same report from several soldiers.
  const cellSize = soundRadius <= SmallSoundRadius ? SmallSoundCellSize : LargeSoundCellSize,
    half = (cellSize - 1) / 2;
  const x = Math.floor(source.x / cellSize) * cellSize + half;
  const y = Math.floor(source.y / cellSize) * cellSize + half;
  return {
    x: width === undefined ? x : clamp(x, 0, width - 1),
    y: height === undefined ? y : clamp(y, 0, height - 1),
    turn,
    kind,
    uncertainty: Math.ceil(Math.SQRT2 * half),
  };
}
