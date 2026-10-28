import { CampaignEditorRefusal, CampaignEditorRefusalCode } from './campaign-editor-refusal.ts';
import { LandConnection } from './land-connection.js';

const WORLD_PROJECTION_ORIGIN = 36;
const NEW_LOCALITY = Object.freeze({ income: 0, x: 50, y: 50, asset: 'Territorio' });
const INITIAL_TERRITORY = Object.freeze({ owner: 'patriot', loyalty: 50 });
const DEFAULT_WORLD_PROJECTION = Object.freeze({
  minLongitude: 0,
  maxLatitude: 33,
  longitudeScale: 18,
  latitudeScale: 18,
});
const clone = (value) => structuredClone(value);
const validId = (id) =>
  typeof id === 'string' &&
  /^[a-z][a-z0-9_-]{0,79}$/.test(id) &&
  !['constructor', 'prototype', '__proto__'].includes(id);
const cellFor = (world, id) => world.cells.find((cell) => cell.id === id);
function requireCell(world, id) {
  const cell = cellFor(world, id);
  if (!cell) throw new CampaignEditorRefusal(CampaignEditorRefusalCode.CellNotFound);
  return cell;
}
function requireLocality(world, id) {
  const sector = world.sectors.find((locality) => locality.id === id);
  if (!sector) throw new CampaignEditorRefusal(CampaignEditorRefusalCode.LocalityNotFound);
  return sector;
}
function district(cell, sector) {
  return {
    id: `${sector.id}:${cell.col}:${cell.row}`,
    sectorId: sector.id,
    col: cell.col,
    row: cell.row,
    name: cell.name,
    x: cell.x,
    y: cell.y,
    urban: false,
  };
}
function resetCell(cell) {
  Object.assign(cell, {
    anchor: false,
    district: false,
    locality: null,
    location: cell.id,
    name: `Celda ${cell.col + 1},${cell.row + 1}`,
  });
}
function place(world, sector, cell) {
  const projection = world.projection ?? DEFAULT_WORLD_PROJECTION;
  world.places[sector.id] = {
    ...(world.places[sector.id] ?? {}),
    lon: projection.minLongitude + (cell.x - WORLD_PROJECTION_ORIGIN) / projection.longitudeScale,
    lat: projection.maxLatitude - (cell.y - WORLD_PROJECTION_ORIGIN) / projection.latitudeScale,
    label: sector.name,
  };
}
function attach(world, sector, cell) {
  if (!cell.land) throw new CampaignEditorRefusal(CampaignEditorRefusalCode.AnchorRequiresLand);
  if (cell.locality && cell.locality !== sector.id)
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.CellOwnedByAnotherLocality);
  Object.assign(cell, {
    anchor: true,
    district: true,
    locality: sector.id,
    location: sector.id,
    name: sector.name,
    biome: sector.biome,
    theater: sector.theater,
  });
  sector.grid = cell.grid;
  world.districts[sector.id] ??= [];
  world.districts[sector.id] = world.districts[sector.id].filter(
    (district) => district.col !== cell.col || district.row !== cell.row,
  );
  world.districts[sector.id].push(district(cell, sector));
  place(world, sector, cell);
}
function referencePaths(value, id, path = 'content') {
  if (value === id) return [path];
  if (Array.isArray(value))
    return value.flatMap((value, index) => referencePaths(value, id, `${path}[${index}]`));
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([key, value]) =>
      key === id ? [`${path}.${key}`] : referencePaths(value, id, `${path}.${key}`),
    );
  return [];
}

function synchronizeLocality(project, locality) {
  const world = project.world;
  for (const cell of world.cells.filter((cell) => cell.locality === locality.id)) {
    cell.theater = locality.theater;
    cell.biome = locality.biome;
    if (cell.anchor) cell.name = locality.name;
  }
  const anchor = world.cells.find((cell) => cell.anchor && cell.locality === locality.id);
  if (!anchor) throw new CampaignEditorRefusal(CampaignEditorRefusalCode.LocalityRequiresAnchor);
  place(world, locality, anchor);
  for (const district of world.districts[locality.id] ?? []) {
    if (district.col === anchor.col && district.row === anchor.row) district.name = locality.name;
  }
  if (project.maps[locality.id]) project.maps[locality.id].metadata.title = locality.name;
}

export class CampaignWorld {
  #project;

  constructor(project) {
    this.#project = structuredClone(project);
  }
  snapshot() {
    return structuredClone(this.#project);
  }

  addLocality({ id, name, cellId }, mapDocument) {
    const next = clone(this.#project),
      world = next.world,
      cell = requireCell(world, cellId);
    if (
      !validId(id) ||
      world.sectors.some((locality) => locality.id === id) ||
      world.cells.some((cell) => cell.location === id) ||
      Object.hasOwn(world.sceneExits ?? {}, id) ||
      Object.hasOwn(next.maps, id)
    )
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidLocalityIdentity);
    if (typeof name !== 'string' || !name.trim())
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.LocalityRequiresName);
    if (cell.locality)
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.CellAlreadyAssigned);
    const sector = {
      id,
      name: name.trim(),
      grid: cell.grid,
      biome: cell.biome,
      theater: cell.theater,
      neighbors: [],
      ...NEW_LOCALITY,
    };
    world.sectors.push(sector);
    attach(world, sector, cell);
    world.arrivalFacilities ??= {};
    world.arrivalFacilities[id] = [];
    next.content.startingTerritory ??= {};
    next.content.startingTerritory[id] = { ...INITIAL_TERRITORY };
    if (mapDocument.id !== id)
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.LocalityMapIdentityMismatch);
    next.maps[id] = clone(mapDocument);
    next.mapIndex.maps.push({ id, path: `${id}.json` });
    this.#project = next;
  }

  moveLocality(id, cellId) {
    const next = clone(this.#project),
      world = next.world,
      locality = requireLocality(world, id),
      target = requireCell(world, cellId);
    if (!target.land || (target.locality && target.locality !== id))
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.AnchorDestinationUnavailable);
    const old = world.cells.find((cell) => cell.anchor && cell.locality === id);
    if (old?.id === target.id) return;
    if (old) {
      world.districts[id] = world.districts[id].filter(
        (district) => district.col !== old.col || district.row !== old.row,
      );
      resetCell(old);
    }
    attach(world, locality, target);
    this.#project = next;
  }

  updateLocality(id, fields) {
    const next = clone(this.#project),
      world = next.world,
      locality = requireLocality(world, id);
    if (['id', 'grid', 'neighbors'].some((key) => Object.hasOwn(fields, key)))
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.LocalityStructureOperationRequired);
    Object.assign(locality, clone(fields));
    synchronizeLocality(next, locality);
    this.#project = next;
  }
  /** @param {string|null} localityId */

  assignDistrict(cellId, localityId = null) {
    const next = clone(this.#project),
      world = next.world,
      cell = requireCell(world, cellId);
    if (cell.anchor)
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.AnchorDistrictLocked);
    if (localityId && !cell.land)
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.DistrictRequiresLand);
    for (const rows of Object.values(world.districts))
      for (let index = rows.length - 1; index >= 0; index--)
        if (rows[index].col === cell.col && rows[index].row === cell.row) rows.splice(index, 1);
    cell.locality = localityId;
    cell.district = Boolean(localityId);
    if (localityId) {
      const locality = requireLocality(world, localityId);
      cell.theater = locality.theater;
      cell.biome = locality.biome;
      world.districts[localityId].push(district(cell, locality));
    }
    this.#project = next;
  }

  updateCell(cellId, fields) {
    if (Object.keys(fields).some((key) => !['name', 'biome', 'theater', 'land'].includes(key)))
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.CellGeometryImmutable);
    const next = clone(this.#project),
      cell = requireCell(next.world, cellId);
    if (cell.district && fields.land === false)
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.DistrictMustBeRemoved);
    Object.assign(cell, fields);
    if (fields.land === false) cell.biome = 'water';
    if (fields.land === true && cell.biome === 'water') cell.biome = 'plains';
    if (fields.biome) cell.land = fields.biome !== 'water';
    if (!cell.land && cell.district)
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.DistrictRequiresLand);
    if (cell.anchor) {
      const locality = requireLocality(next.world, cell.locality);
      Object.assign(locality, { name: cell.name, biome: cell.biome, theater: cell.theater });
      synchronizeLocality(next, locality);
    }
    this.#project = next;
  }

  connectLocalities(from, to, connected) {
    const next = clone(this.#project),
      origin = requireLocality(next.world, from),
      destination = requireLocality(next.world, to);
    if (from === to)
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.RoadNeedsDistinctLocalities);
    for (const [locality, target] of [
      [origin, to],
      [destination, from],
    ])
      locality.neighbors = connected
        ? [...new Set([...locality.neighbors, target])]
        : locality.neighbors.filter((id) => id !== target);
    if (connected && !new LandConnection(next.world.cells).connects(from, to))
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.LocalitiesDisconnected, {
        origin: from,
        destination: to,
      });
    this.#project = next;
  }

  deleteLocality(id) {
    const next = clone(this.#project),
      world = next.world;
    requireLocality(world, id);
    const content = clone(next.content);
    delete content.startingTerritory?.[id];
    const references = referencePaths(content, id);
    if (world.defaultHeadquarters === id) references.push('world.defaultHeadquarters');
    if (world.defaultFoundry?.sector === id) references.push('world.defaultFoundry.sector');
    for (const [key, value] of Object.entries(world)) {
      if (
        [
          'sectors',
          'cells',
          'places',
          'districts',
          'arrivalFacilities',
          'ruralSectors',
          'workshopSectors',
          'sectorCash',
          'landscapes',
          'deployment',
          'expansion',
          'physical',
          'weather',
          'travel',
        ].includes(key)
      )
        continue;
      references.push(...referencePaths(value, id, `world.${key}`));
    }
    for (const [mapId, map] of Object.entries(next.maps))
      if (mapId !== id) references.push(...referencePaths(map.exits, id, `maps.${mapId}.exits`));
    if (references.length)
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.LocalityInUse, { references });
    world.sectors = world.sectors.filter((locality) => locality.id !== id);
    for (const locality of world.sectors)
      locality.neighbors = locality.neighbors.filter((neighbor) => neighbor !== id);
    for (const cell of world.cells) if (cell.locality === id) resetCell(cell);
    for (const key of [
      'places',
      'districts',
      'arrivalFacilities',
      'sectorCash',
      'landscapes',
      'deployment',
    ])
      delete world[key]?.[id];
    for (const key of ['ruralSectors', 'workshopSectors'])
      if (world[key]) world[key] = world[key].filter((value) => value !== id);
    for (const key of ['caches', 'arsenals', 'environment']) delete world.physical?.[key]?.[id];
    delete world.weather?.regions?.[id];
    for (const key of ['roughTransportSectors'])
      if (world.travel?.[key])
        world.travel[key] = world.travel[key].filter((value) => value !== id);
    for (const [key, value] of Object.entries(world.expansion ?? {})) {
      if (Array.isArray(value)) world.expansion[key] = value.filter((value) => value !== id);
      else if (value && typeof value === 'object') delete value[id];
    }
    delete next.content.startingTerritory?.[id];
    delete next.maps[id];
    next.mapIndex.maps = next.mapIndex.maps.filter((map) => map.id !== id);
    this.#project = next;
  }
}
