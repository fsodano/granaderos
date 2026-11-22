export type FirearmIdentifier = string | number;

// Authored alternative loads may carry the same projectile profile fields as the
// primary ammunition, so the shape mirrors the campaign file contract locally:
// the domain does not depend on the shared format package.
export type AlternativeLoad = Readonly<{
  family: string;
  damage: number;
  range: number;
  pattern: 'single' | 'cone';
  materialRangeSlope?: number;
  projectileEnergy?: Readonly<{ model: string; massGrams: number; muzzleVelocityMps: number }>;
  projectileAirDrag?: Readonly<{ model: string; retentionAtRange: number }>;
}>;

export type FirearmReference = Readonly<{ id?: FirearmIdentifier }>;

export type FirearmDefinition = Readonly<{
  id?: FirearmIdentifier | FirearmReference;
  template?: FirearmIdentifier | FirearmReference;
  ammunitionFamily?: string;
  alternativeLoads?: readonly AlternativeLoad[];
}>;

// A unit, an item, an authored weapon definition, or a plain identifier: the
// rule reads the same fields from whatever the caller holds.
export type FirearmLoadSource = Readonly<{
  weapon?: FirearmIdentifier | FirearmReference;
  primary?: FirearmIdentifier | FirearmReference;
  template?: FirearmIdentifier | FirearmReference;
  id?: FirearmIdentifier | FirearmReference;
  contentWeapon?: FirearmDefinition;
  weaponMetadata?: Readonly<{ contentWeapon?: FirearmDefinition }>;
  ammunitionFamily?: string;
  alternativeLoads?: readonly AlternativeLoad[];
}>;

const shot = (damage: number, range: number): readonly AlternativeLoad[] =>
  Object.freeze([{ family: 'ammoShot', damage, range, pattern: 'cone' as const }]);

const ball = (damage: number, range: number): readonly AlternativeLoad[] =>
  Object.freeze([{ family: 'ammoMusket', damage, range, pattern: 'single' as const }]);

// Gameplay tuning for alternative smoothbore loads. These are not historical
// ballistic measurements. Campaign content can replace or remove each list.
export const DEFAULT_ALTERNATIVE_LOADS: Readonly<
  Record<FirearmIdentifier, readonly AlternativeLoad[]>
> = Object.freeze({
  1800: shot(28, 6),
  1801: shot(26, 6),
  1803: shot(22, 5),
  1804: ball(35, 10),
  1805: shot(14, 3),
  1806: shot(12, 3),
  1807: ball(32, 8),
  1808: shot(14, 3),
});

function identifierOf(
  raw: FirearmIdentifier | FirearmReference | null | undefined,
): FirearmIdentifier | undefined {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return raw ?? undefined;
  }
  return raw.id;
}

export function firearmId(
  value: FirearmLoadSource | FirearmIdentifier | null | undefined,
): FirearmIdentifier | undefined {
  const raw =
    typeof value === 'object' && value !== null
      ? (value.weapon ?? value.primary ?? value.template ?? value.id)
      : value;
  return identifierOf(raw);
}

export function loadDefinition(
  value: FirearmLoadSource | FirearmIdentifier | null | undefined,
): FirearmDefinition | FirearmIdentifier | null | undefined {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  return value.contentWeapon ?? value.weaponMetadata?.contentWeapon ?? value;
}

export function alternativeLoadsFor(
  value: FirearmLoadSource | FirearmIdentifier | null | undefined,
): readonly AlternativeLoad[] {
  const definition = loadDefinition(value);
  const authored = definition !== null && typeof definition === 'object' ? definition : undefined;
  const id = firearmId(value);
  // An authored primary-family override never inherits an incompatible default.
  return (
    authored?.alternativeLoads ??
    (authored?.ammunitionFamily === undefined
      ? id === undefined
        ? []
        : (DEFAULT_ALTERNATIVE_LOADS[id] ?? [])
      : [])
  );
}
