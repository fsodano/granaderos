// A sound report never retains the live identity of the shooter. A civilian can
// know where a sound came from without knowing who made it, so the report holds
// only the coarse cell, the turn, the kind, and the uncertainty.
export type SoundSource = Readonly<{ x: number; y: number }>;
export type SoundListener = SoundSource & Readonly<{ facing?: number | undefined }>;
export type SoundReportOptions = Readonly<{
  kind: string;
  radius: number;
  turn: number;
  width: number;
  height: number;
  obstructions?: number | undefined;
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

// Grid Y increases southward; coincident points retain the supplied facing.
export function directionTo(from: SoundListener, to: SoundSource): number {
  if (from.x === to.x && from.y === to.y) {
    return from.facing ?? 0;
  }
  return (
    (Math.round(Math.atan2(to.x - from.x, from.y - to.y) / RadiansPerStep) + CompassSteps) %
    CompassSteps
  );
}

// Obstructions muffle three tiles each; hearing can cross a wall, unlike sight.
// Coarse cells stay stable across repeated reports so several listeners cannot
// average deterministic offsets into a fix. uncertainty is a tile radius and
// includes cells clamped at the map boundary.
export function approximateHeardPosition(
  listener: SoundListener,
  source: SoundSource,
  { kind, radius, turn, width, height, obstructions = 0 }: SoundReportOptions,
): SoundReport | null {
  if (
    Math.hypot(source.x - listener.x, source.y - listener.y) >
      Math.max(0, radius - obstructions * ObstructionMuffle) ||
    radius <= 0
  ) {
    return null;
  }
  const size = radius <= SmallSoundRadius ? SmallSoundCellSize : LargeSoundCellSize,
    half = (size - 1) / 2;
  return {
    x: Math.max(0, Math.min(width - 1, Math.floor(source.x / size) * size + half)),
    y: Math.max(0, Math.min(height - 1, Math.floor(source.y / size) * size + half)),
    turn,
    kind,
    uncertainty: Math.ceil(Math.SQRT2 * half),
  };
}
