// A point's tactical level is a fact about the map the game plays on, not
// about a recruit's earned level. A point that records no level stands on
// level zero. The shared file contract validates authored maps and keeps its
// own copy of these rules because it cannot import the game.
/** The only field the level rule reads, so records without coordinates are welcome. */
export type TacticalLevelSource = Readonly<{
  tacticalLevel?: number | undefined;
}>;

export type TacticalPoint = Readonly<{
  x: number;
  y: number;
}> &
  TacticalLevelSource;

export type TacticalSpacePoint = Readonly<{
  x: number;
  y: number;
  tacticalLevel: number;
}>;

export const MAX_TACTICAL_LEVEL = 8;

export const tacticalLevel = (
  point: TacticalPoint | TacticalLevelSource | null | undefined,
): number => (point?.tacticalLevel === undefined ? 0 : point.tacticalLevel);

export const validTacticalLevel = (level: number): boolean =>
  Number.isInteger(level) && level >= 0 && level <= MAX_TACTICAL_LEVEL;

export const spaceKey = (point: TacticalPoint): string =>
  `${tacticalLevel(point)}:${point.x},${point.y}`;

export const sameSurface = (a: TacticalPoint, b: TacticalPoint): boolean =>
  tacticalLevel(a) === tacticalLevel(b);

export const sameCell = (a: TacticalPoint, b: TacticalPoint): boolean =>
  sameSurface(a, b) && a.x === b.x && a.y === b.y;

export const spacePoint = (point: TacticalPoint): TacticalSpacePoint => ({
  x: point.x,
  y: point.y,
  tacticalLevel: tacticalLevel(point),
});
