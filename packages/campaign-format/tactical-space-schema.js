export const MAX_TACTICAL_LEVEL = 8;
export const DEFAULT_SLAB_THICKNESS = 0.2;
/** @returns {number} */
export const tacticalLevel = (point) =>
  point?.tacticalLevel === undefined ? 0 : point.tacticalLevel;
export const validTacticalLevel = (level) =>
  Number.isInteger(level) && level >= 0 && level <= MAX_TACTICAL_LEVEL;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value, minimum, maximum) =>
  Number.isFinite(value) && value >= minimum && value <= maximum;
const identifier = (value) =>
  typeof value === 'string' &&
  value.length <= 240 &&
  /^[a-zA-Z0-9][a-zA-Z0-9:._-]*$/.test(value) &&
  !['__proto__', 'constructor', 'prototype'].includes(value);
const spaceKey = (point) => `${tacticalLevel(point)}:${point.x},${point.y}`;
const need = (condition, label) => {
  if (!condition) {
    throw new Error(`El espacio táctico contiene ${label} inválidos.`);
  }
};

export function validateTacticalSpaceRecords(state) {
  const coordinate = (point) =>
    object(point) &&
    Number.isInteger(point.x) &&
    Number.isInteger(point.y) &&
    point.x >= 0 &&
    point.y >= 0 &&
    point.x < state.width &&
    point.y < state.height &&
    validTacticalLevel(tacticalLevel(point));
  const surfaces = state.upperSurfaces === undefined ? [] : state.upperSurfaces;
  const links = state.climbLinks === undefined ? [] : state.climbLinks;
  need(
    Array.isArray(surfaces) &&
      surfaces.length <= 8192 &&
      Array.isArray(links) &&
      links.length <= 2000,
    'superficies o accesos',
  );
  for (const tile of state.tiles ?? []) {
    need(tacticalLevel(tile) === 0, 'niveles del terreno');
    if (tile.elevation !== undefined) {
      need(finite(tile.elevation, 0, 100), 'alturas del terreno');
    }
  }
  const identifiers = new Set(),
    cells = new Set();
  for (const surface of surfaces) {
    need(
      coordinate(surface) &&
        tacticalLevel(surface) > 0 &&
        identifier(surface.id) &&
        !identifiers.has(surface.id) &&
        !cells.has(spaceKey(surface)),
      'identidades o posiciones de superficies',
    );
    identifiers.add(surface.id);
    cells.add(spaceKey(surface));
    need(
      surface.type === 'floor' &&
        ['roof', 'platform'].includes(surface.kind) &&
        typeof surface.blocked === 'boolean' &&
        finite(surface.cover, 0, 100),
      'superficies',
    );
    need(finite(surface.elevation, 0, 100) && surface.elevation > 0, 'alturas');
    const thickness =
      surface.slabThickness === undefined ? DEFAULT_SLAB_THICKNESS : surface.slabThickness;
    need(finite(thickness, 0, 10) && thickness > 0 && thickness <= surface.elevation, 'espesores');
    if (surface.blocksSight !== undefined) {
      need(typeof surface.blocksSight === 'boolean', 'visibilidad');
    }
    if (surface.material !== undefined) {
      need(['wood', 'adobe', 'stone', 'hay'].includes(surface.material), 'materiales');
    }
    for (const [field, maximum] of [
      ['obstacleHeight', 10],
      ['projectileResistance', 1000],
      ['concealment', 100],
    ]) {
      if (surface[field] !== undefined) {
        need(finite(surface[field], 0, maximum), 'cobertura');
      }
    }
    if (surface.buildingId !== undefined) {
      need(
        (state.buildings ?? []).some((building) => building.id === surface.buildingId),
        'pertenencia al edificio',
      );
    }
    if (surface.roomId !== undefined) {
      need(
        (state.buildings ?? [])
          .flatMap((building) => building.rooms ?? [])
          .some((room) => room.id === surface.roomId),
        'pertenencia a la habitación',
      );
    }
  }
  const endpoint = (point) =>
    coordinate(point) &&
    Object.keys(point).every((field) => ['x', 'y', 'tacticalLevel'].includes(field)) &&
    (tacticalLevel(point) === 0 || cells.has(spaceKey(point)));
  const edges = new Set();
  for (const link of links) {
    need(
      object(link) && identifier(link.id) && !identifiers.has(link.id) && link.kind === 'climb',
      'identidades de accesos',
    );
    identifiers.add(link.id);
    need(endpoint(link.from) && endpoint(link.to), 'extremos de accesos');
    const edge = `${spaceKey(link.from)}>${spaceKey(link.to)}`;
    need(!edges.has(edge), 'accesos duplicados');
    edges.add(edge);
  }
}
