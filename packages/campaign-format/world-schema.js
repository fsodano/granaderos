import { validateCampaignPhysical } from './physical-schema.js';
// Data admission only. Campaign JSON cannot add executable mechanics.
import { validateCampaignData } from './campaign-data-validation.js';
import { validateMerchantPolicies } from './merchant-policy-schema.js';
import { validateEnemyStrategy } from './enemy-strategy-schema.js';
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const id = (v) =>
  typeof v === 'string' &&
  /^[a-z][a-z0-9_-]{0,79}$/.test(v) &&
  !['constructor', 'prototype', '__proto__'].includes(v);
const text = (v, max = 200) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
const finite = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
const unique = (values) => new Set(values).size === values.length;
const BIOMES = [
  'water',
  'mountain',
  'plains',
  'wetland',
  'foothills',
  'forest',
  'scrub',
  'river',
  'urban',
];
const ARCHITECTURES = [
  'house',
  'farmhouse',
  'estancia',
  'church',
  'mansion',
  'cabildo',
  'pulperia',
  'warehouse',
  'barracks',
];
const LANDSCAPES = [
  'settlement',
  'wetland',
  'river',
  'woodland',
  'wooded-foothills',
  'scrub',
  'dry-mountain',
  'dry-foothills',
];
const EDGES = ['N', 'E', 'S', 'W'];
const anchor = (v) => object(v) && integer(v.x, 0, 19) && integer(v.y, 0, 15);
const edgeAnchor = (edge, v) =>
  anchor(v) &&
  (edge === 'N'
    ? v.y === 0
    : edge === 'S'
      ? v.y === 15
      : edge === 'W'
        ? v.x === 0
        : edge === 'E' && v.x === 19);

function geometry(value, kinds) {
  if (!object(value) || !kinds.includes(value.type)) return false;
  const point = (v) =>
    Array.isArray(v) && v.length === 2 && finite(v[0], -180, 180) && finite(v[1], -90, 90);
  const line = (v, min) =>
    Array.isArray(v) && v.length >= min && v.length <= 50000 && v.every(point);
  const ring = (v) => line(v, 4) && v[0][0] === v.at(-1)[0] && v[0][1] === v.at(-1)[1];
  const polygon = (v) => Array.isArray(v) && v.length > 0 && v.every(ring);
  return value.type === 'Polygon'
    ? polygon(value.coordinates)
    : value.type === 'MultiPolygon'
      ? Array.isArray(value.coordinates) &&
        value.coordinates.length > 0 &&
        value.coordinates.every(polygon)
      : value.type === 'LineString'
        ? line(value.coordinates, 2)
        : Array.isArray(value.coordinates) &&
          value.coordinates.length > 0 &&
          value.coordinates.every((v) => line(v, 2));
}

export function validateWorldData(world, options = {}) {
  try {
    const errors = validateCampaignData(world);
    if (errors.length) return errors.map((error) => `Mapa de campaña: ${error}`);
    const worldErrors = validateWorldRecords(world, options);
    if (!worldErrors.length) worldErrors.push(...validateCampaignPhysical(world.physical, world));
    return worldErrors;
  } catch {
    return ['Mapa de campaña: los datos contienen una estructura inválida.'];
  }
}
function validateWorldRecords(world, options) {
  const errors = [],
    check = (valid, message) => {
      if (!valid) errors.push(`Mapa de campaña: ${message}`);
    };
  if (!object(world)) return ['Mapa de campaña: se necesita una definición.'];
  check(world.version === 1, 'versión incompatible.');
  check(
    world.columns === 36 && world.rows === 33,
    'la cuadrícula debe conservar 36 columnas y 33 filas.',
  );
  check(
    Array.isArray(world.sectors) && world.sectors.length > 0 && world.sectors.length <= 1188,
    'localidades inválidas.',
  );
  check(Array.isArray(world.cells) && world.cells.length === 1188, 'se necesitan las 1188 celdas.');
  check(
    ['cities', 'factions', 'theaters'].every((k) => Array.isArray(world[k])) &&
      world.factions.length > 0 &&
      world.theaters.length > 0,
    'faltan ciudades, facciones o regiones.',
  );
  if (errors.length) return errors;
  if (world.projection !== undefined) {
    const p = world.projection;
    check(
      object(p) &&
        Object.keys(p).length === 4 &&
        finite(p.minLongitude, -180, 180) &&
        finite(p.maxLatitude, -90, 90) &&
        finite(p.longitudeScale, Number.MIN_VALUE, 10000) &&
        finite(p.latitudeScale, Number.MIN_VALUE, 10000),
      'proyección geográfica inválida.',
    );
  }
  for (const key of [
    'ruralSectors',
    'workshopSectors',
    'incomeSources',
    'exitLinks',
    'sceneEntries',
  ])
    if (world[key] !== undefined)
      check(Array.isArray(world[key]), `${key}: se necesita una lista.`);
  for (const key of [
    'places',
    'districts',
    'arrivalFacilities',
    'sectorCash',
    'sceneExits',
    'sceneExitAnchors',
    'landscapes',
    'deployment',
    'sceneLocations',
  ])
    if (world[key] !== undefined) check(object(world[key]), `${key}: se necesita un objeto.`);
  if (world.geography !== undefined)
    check(
      object(world.geography) &&
        Array.isArray(world.geography.land) &&
        Array.isArray(world.geography.rivers),
      'geografía inválida.',
    );
  if (errors.length) return errors;
  const sectors = new Set(world.sectors.map((s) => s?.id)),
    theaters = new Set(world.theaters.map((t) => t?.id));
  errors.push(...validateEnemyStrategy(world.enemyStrategy, world, options));
  check(sectors.size === world.sectors.length, 'las localidades deben tener identidades únicas.');
  for (const kind of ['factions', 'theaters']) {
    check(unique(world[kind].map((v) => v?.id)), `${kind}: identidades repetidas.`);
    for (const entry of world[kind])
      check(
        object(entry) &&
          id(entry.id) &&
          text(entry.name) &&
          (entry.description === undefined || text(entry.description, 1000)),
        `${kind}: definición inválida.`,
      );
  }
  for (const sector of world.sectors) {
    check(
      object(sector) &&
        id(sector.id) &&
        text(sector.name) &&
        (sector.shortName === undefined || text(sector.shortName)) &&
        BIOMES.includes(sector.biome) &&
        sector.biome !== 'water' &&
        theaters.has(sector.theater) &&
        Array.isArray(sector.neighbors) &&
        unique(sector.neighbors) &&
        sector.neighbors.every((target) => sectors.has(target) && target !== sector.id),
      `localidad inválida: ${sector?.id ?? '?'} .`,
    );
    if (Array.isArray(sector?.neighbors))
      for (const target of sector.neighbors) {
        const reciprocal = world.sectors.find((s) => s?.id === target)?.neighbors;
        check(
          Array.isArray(reciprocal) && reciprocal.includes(sector.id),
          `la conexión ${sector.id} / ${target} debe ser recíproca.`,
        );
      }
    for (const key of ['x', 'y', 'income'])
      if (sector?.[key] !== undefined)
        check(finite(sector[key], 0, 1000000), `valor inválido: ${sector.id}.${key}.`);
  }
  const locations = new Set(),
    cells = new Set(),
    mainCells = new Map();
  for (const cell of world.cells) {
    if (!object(cell)) {
      check(false, 'celda inválida.');
      continue;
    }
    check(
      integer(cell.col, 0, 35) &&
        integer(cell.row, 0, 32) &&
        cell.id === `cell-${cell.col}-${cell.row}` &&
        !cells.has(cell.id),
      'coordenadas o identidad de celda inválidas.',
    );
    check(
      id(cell.location) &&
        !locations.has(cell.location) &&
        typeof cell.land === 'boolean' &&
        typeof cell.anchor === 'boolean' &&
        typeof cell.district === 'boolean' &&
        text(cell.name) &&
        text(cell.grid, 40) &&
        BIOMES.includes(cell.biome) &&
        theaters.has(cell.theater),
      'datos de celda inválidos.',
    );
    check(
      cell.locality === null || sectors.has(cell.locality),
      'la celda refiere a una localidad inexistente.',
    );
    check(
      cell.land ? cell.biome !== 'water' : cell.biome === 'water' && !cell.anchor && !cell.district,
      'el agua no puede ser una cabecera o un distrito terrestre.',
    );
    check(
      cell.anchor ? cell.land && cell.location === cell.locality : cell.location === cell.id,
      'la cabecera debe coincidir con su localidad; las demás celdas conservan su identidad.',
    );
    check(
      cell.x === 36 + cell.col * 18 && cell.y === 36 + cell.row * 18,
      'la posición visual debe coincidir con la cuadrícula.',
    );
    check(
      cell.grid === `${cell.col + 1},${cell.row + 1}`,
      'la etiqueta de cuadrícula debe coincidir con la celda.',
    );
    check(
      !cell.district || (cell.land && sectors.has(cell.locality)),
      'el distrito necesita una localidad terrestre.',
    );
    if (cell.anchor) mainCells.set(cell.locality, (mainCells.get(cell.locality) ?? 0) + 1);
    cells.add(cell.id);
    locations.add(cell.location);
  }
  for (const sector of world.sectors)
    check(mainCells.get(sector?.id) === 1, `se necesita una celda principal de ${sector?.id}.`);
  const cityIds = new Set(),
    citySectors = new Set();
  for (const city of world.cities) {
    const valid =
      object(city) &&
      id(city.id) &&
      !cityIds.has(city.id) &&
      text(city.name) &&
      Array.isArray(city.sectors) &&
      city.sectors.length > 0 &&
      unique(city.sectors) &&
      city.sectors.every((s) => sectors.has(s) && !citySectors.has(s));
    check(valid, `ciudad inválida: ${city?.id ?? '?'} .`);
    cityIds.add(city?.id);
    if (Array.isArray(city?.sectors)) for (const sector of city.sectors) citySectors.add(sector);
  }
  check(object(world.places) && object(world.districts), 'faltan etiquetas o distritos.');
  for (const [place, p] of Object.entries(world.places ?? {}))
    check(
      sectors.has(place) &&
        object(p) &&
        finite(p.lon, -180, 180) &&
        finite(p.lat, -90, 90) &&
        text(p.label) &&
        (p.dx === undefined || finite(p.dx, -2000, 2000)) &&
        (p.dy === undefined || finite(p.dy, -2000, 2000)),
      `etiqueta inválida: ${place}.`,
    );
  const districtIds = new Set(),
    districtCells = new Set();
  for (const [sector, rows] of Object.entries(world.districts ?? {})) {
    if (!sectors.has(sector) || !Array.isArray(rows)) {
      check(false, `distritos inválidos: ${sector}.`);
      continue;
    }
    for (const d of rows) {
      const cell = world.cells.find((c) => c?.col === d?.col && c?.row === d?.row);
      check(
        object(d) &&
          text(d.id) &&
          !districtIds.has(d.id) &&
          !districtCells.has(cell?.id) &&
          d.sectorId === sector &&
          text(d.name) &&
          typeof d.urban === 'boolean' &&
          cell?.land &&
          cell?.district &&
          cell?.locality === sector &&
          d.x === cell.x &&
          d.y === cell.y,
        `distrito inválido: ${d?.id ?? sector}.`,
      );
      districtIds.add(d?.id);
      districtCells.add(cell?.id);
    }
  }
  for (const cell of world.cells)
    if (cell?.district) check(districtCells.has(cell.id), `falta el distrito de ${cell.id}.`);
  check(
    object(world.geography) &&
      Array.isArray(world.geography.land) &&
      Array.isArray(world.geography.rivers),
    'geografía inválida.',
  );
  for (const g of world.geography?.land ?? [])
    check(geometry(g, ['Polygon', 'MultiPolygon']), 'polígono terrestre inválido.');
  for (const g of world.geography?.rivers ?? [])
    check(geometry(g, ['LineString', 'MultiLineString']), 'curso de agua inválido.');
  if (world.geography?.argentina !== undefined)
    check(
      geometry(world.geography.argentina, ['Polygon', 'MultiPolygon']),
      'contorno principal inválido.',
    );
  const localList = (values, label) =>
    check(
      Array.isArray(values) && unique(values) && values.every((v) => sectors.has(v)),
      `${label}: localidades inválidas.`,
    );
  localList(world.ruralSectors ?? [], 'áreas rurales');
  check(sectors.has(world.defaultHeadquarters), 'cuartel principal inválido.');
  check(object(world.arrivalFacilities), 'instalaciones de llegada inválidas.');
  for (const [sector, facilities] of Object.entries(world.arrivalFacilities ?? {}))
    check(
      sectors.has(sector) &&
        Array.isArray(facilities) &&
        unique(facilities) &&
        facilities.every((f) => ['post', 'barracks', 'port', 'landing'].includes(f)),
      `instalaciones inválidas: ${sector}.`,
    );
  check(
    Array.isArray(world.arrivalFacilities?.[world.defaultHeadquarters]) &&
      world.arrivalFacilities[world.defaultHeadquarters].includes('barracks'),
    'el cuartel principal necesita un cuartel de llegada.',
  );
  const foundry = world.defaultFoundry;
  check(
    object(foundry) &&
      sectors.has(foundry.sector) &&
      text(foundry.name) &&
      text(foundry.armyName) &&
      integer(foundry.setupCost, 0, 1000000) &&
      integer(foundry.fundingCost, 0, 1000000) &&
      Array.isArray(world.arrivalFacilities?.[foundry.sector]) &&
      world.arrivalFacilities[foundry.sector].includes('barracks'),
    'fundición general inválida.',
  );
  const roles = world.defaultRoles,
    roleKeys = ['foundryEngineer', 'marchCommander'];
  check(
    object(roles) &&
      Object.keys(roles).length === roleKeys.length &&
      roleKeys.every((k) => Object.hasOwn(roles, k) && (roles[k] === null || id(roles[k]))),
    'funciones generales inválidas.',
  );
  check(Array.isArray(world.incomeSources), 'faltan las fuentes de ingresos.');
  const incomeIds = new Set(),
    representatives = new Set();
  for (const source of Array.isArray(world.incomeSources) ? world.incomeSources : []) {
    const representative = source?.representative;
    check(
      object(source) &&
        id(source.id) &&
        !incomeIds.has(source.id) &&
        text(source.name) &&
        text(source.source) &&
        sectors.has(source.sectorId) &&
        Array.isArray(source.requiredSectors) &&
        source.requiredSectors.length > 0 &&
        unique(source.requiredSectors) &&
        source.requiredSectors.includes(source.sectorId) &&
        source.requiredSectors.every((s) => sectors.has(s)) &&
        integer(source.dailyAmount, 0, 1000000) &&
        object(representative) &&
        id(representative.npcId) &&
        !representatives.has(representative.npcId) &&
        text(representative.name) &&
        source.requiredSectors.includes(representative.sectorId),
      'fuente de ingresos inválida.',
    );
    incomeIds.add(source?.id);
    representatives.add(representative?.npcId);
  }
  const types = world.buildings?.types,
    footprints = world.buildings?.footprints;
  check(
    object(types) && object(footprints) && Object.hasOwn(types ?? {}, 'house'),
    'faltan estilos y dimensiones de edificios.',
  );
  for (const [kind, style] of Object.entries(types ?? {}))
    check(
      ARCHITECTURES.includes(kind) &&
        object(style) &&
        text(style.name) &&
        ['tile', 'thatch', 'terrace'].includes(style.roof) &&
        /^#[a-fA-F0-9]{6}$/.test(style.wall) &&
        /^#[a-fA-F0-9]{6}$/.test(style.trim) &&
        finite(style.height, 1, 500) &&
        ['gallery', 'tower', 'upper', 'arcade', 'awning'].every(
          (k) => style[k] === undefined || typeof style[k] === 'boolean',
        ),
      `estilo de edificio inválido: ${kind}.`,
    );
  for (const [kind, size] of Object.entries(footprints ?? {}))
    check(
      Object.hasOwn(types ?? {}, kind) &&
        Array.isArray(size) &&
        size.length === 2 &&
        size.every((n) => integer(n, 3, 20)),
      `dimensiones de edificio inválidas: ${kind}.`,
    );
  for (const kind of Object.keys(types ?? {}))
    check(Object.hasOwn(footprints ?? {}, kind), `faltan dimensiones de ${kind}.`);
  const expansion = world.expansion;
  check(object(expansion), 'expansión táctica inválida.');
  if (object(expansion)) {
    const scenes = new Set([...sectors, ...Object.keys(world.sceneExits ?? {})]);
    for (const key of ['coast', 'rural'])
      check(
        Array.isArray(expansion[key]) &&
          unique(expansion[key]) &&
          expansion[key].every((v) => scenes.has(v)),
        `${key}: expansión inválida.`,
      );
    if (expansion.pavedStreets !== undefined)
      check(
        Array.isArray(expansion.pavedStreets) &&
          unique(expansion.pavedStreets) &&
          expansion.pavedStreets.every((v) => scenes.has(v)),
        'calles pavimentadas inválidas.',
      );
    for (const key of [
      'buildingSelections',
      'buildingLandmarks',
      'buildingTargets',
      'waterOffsets',
      'accessRoads',
    ])
      if (expansion[key] !== undefined)
        check(object(expansion[key]), `${key}: expansión inválida.`);
    const selection = (v) =>
      Array.isArray(v) && v.length > 0 && v.every((kind) => Object.hasOwn(types ?? {}, kind));
    check(
      selection(expansion.defaultBuildingSelection),
      'selección general de edificios inválida.',
    );
    for (const [place, v] of Object.entries(expansion.buildingSelections ?? {}))
      check(scenes.has(place) && selection(v), `selección de edificios inválida: ${place}.`);
    for (const [place, v] of Object.entries(expansion.buildingLandmarks ?? {}))
      check(
        scenes.has(place) && Object.hasOwn(types ?? {}, v),
        `edificio principal inválido: ${place}.`,
      );
    for (const [place, v] of Object.entries(expansion.buildingTargets ?? {}))
      check(scenes.has(place) && integer(v, 0, 100), `cantidad de edificios inválida: ${place}.`);
    for (const [place, v] of Object.entries(expansion.waterOffsets ?? {}))
      check(scenes.has(place) && integer(v, 0, 19), `ribera inválida: ${place}.`);
    for (const [place, v] of Object.entries(expansion.accessRoads ?? {}))
      check(scenes.has(place) && Array.isArray(v) && v.every(anchor), `acceso inválido: ${place}.`);
  }
  for (const [place, amount] of Object.entries(world.sectorCash ?? {}))
    check(sectors.has(place) && integer(amount, 0, 1000000), `fondos inválidos: ${place}.`);
  localList(world.workshopSectors ?? [], 'talleres');
  errors.push(...validateMerchantPolicies(world.merchantPolicies, world));
  for (const kind of ['caches', 'arsenals', 'environment'])
    for (const place of Object.keys(world.physical?.[kind] ?? {}))
      check(
        locations.has(place) || Object.hasOwn(world.sceneExits ?? {}, place),
        `fuente física en un lugar inexistente: ${place}.`,
      );
  const trading = world.artilleryTrading;
  if (trading !== undefined)
    check(
      object(trading) &&
        typeof trading.enabled === 'boolean' &&
        integer(trading.initialCash, 0, 1000000) &&
        integer(trading.buyPercent, 0, 100) &&
        integer(trading.resalePercent, 0, 100) &&
        object(trading.buyingOverrides) &&
        Object.entries(trading.buyingOverrides).every(
          ([place, n]) => sectors.has(place) && integer(n, 0, 100),
        ),
      'comercio de artillería inválido.',
    );
  const travel = world.travel;
  if (travel !== undefined) {
    check(object(travel), 'transporte inválido.');
    if (travel?.roughTransportSectors !== undefined)
      localList(travel.roughTransportSectors, 'transporte por terreno difícil');
    if (travel?.flotillaTheaters !== undefined)
      check(
        Array.isArray(travel.flotillaTheaters) &&
          unique(travel.flotillaTheaters) &&
          travel.flotillaTheaters.every((t) => theaters.has(t)),
        'regiones navegables inválidas.',
      );
    const winter = travel?.winter;
    if (winter !== undefined)
      check(
        object(winter) &&
          Array.isArray(winter.months) &&
          unique(winter.months) &&
          winter.months.every((m) => integer(m, 1, 12)) &&
          Array.isArray(winter.biomes) &&
          winter.biomes.every((b) => BIOMES.includes(b)) &&
          Array.isArray(winter.theaters) &&
          winter.theaters.every((t) => theaters.has(t)) &&
          typeof winter.excludeCities === 'boolean',
        'cierre estacional inválido.',
      );
    if (travel?.transportPresentation !== undefined)
      check(
        Array.isArray(travel.transportPresentation) &&
          unique(travel.transportPresentation.map((v) => v?.id)) &&
          travel.transportPresentation.every(
            (v) =>
              object(v) &&
              ['posta', 'carts', 'flotilla', 'mules'].includes(v.id) &&
              text(v.name) &&
              text(v.description, 1000),
          ),
        'presentación de transporte inválida.',
      );
    if (travel?.transportIssues !== undefined)
      check(
        object(travel.transportIssues) &&
          Object.entries(travel.transportIssues).every(
            ([key, value]) =>
              [
                'network_unavailable',
                'route_cut',
                'snow',
                'flotilla_route',
                'mountain_carts',
              ].includes(key) && text(value, 1000),
          ),
        'mensajes de transporte inválidos.',
      );
  }
  const weather = world.weather;
  if (weather !== undefined) {
    check(
      object(weather) &&
        weather.version === 1 &&
        integer(weather.seed, 0, 0xffffffff) &&
        object(weather.climates) &&
        Object.keys(weather.climates).length > 0 &&
        object(weather.regions) &&
        object(weather.fallbacks),
      'clima inválido.',
    );
    for (const [key, c] of Object.entries(weather?.climates ?? {}))
      check(
        id(key) &&
          object(c) &&
          text(c.name) &&
          text(c.terrain) &&
          ['humidity', 'rain'].every(
            (k) => Array.isArray(c[k]) && c[k].length === 4 && c[k].every((n) => finite(n, 0, 99)),
          ),
        `perfil climático inválido: ${key}.`,
      );
    for (const [place, c] of Object.entries(weather?.regions ?? {}))
      check(
        (locations.has(place) || Object.hasOwn(world.sceneExits ?? {}, place)) &&
          Object.hasOwn(weather?.climates ?? {}, c),
        `región climática inválida: ${place}.`,
      );
    check(
      object(weather?.fallbacks?.biomes) &&
        object(weather?.fallbacks?.theaters) &&
        Object.hasOwn(weather?.climates ?? {}, weather?.fallbacks?.default),
      'clima general inválido.',
    );
    for (const [b, c] of Object.entries(weather?.fallbacks?.biomes ?? {}))
      check(
        BIOMES.includes(b) && Object.hasOwn(weather?.climates ?? {}, c),
        'clima por terreno inválido.',
      );
    for (const [t, c] of Object.entries(weather?.fallbacks?.theaters ?? {}))
      check(
        theaters.has(t) && Object.hasOwn(weather?.climates ?? {}, c),
        'clima por región inválido.',
      );
  }
  for (const [place, v] of Object.entries(world.landscapes ?? {}))
    check(
      (locations.has(place) || Object.hasOwn(world.sceneExits ?? {}, place)) &&
        LANDSCAPES.includes(v),
      `paisaje inválido: ${place}.`,
    );
  const linked = new Set();
  for (const link of world.exitLinks ?? []) {
    const pair = Array.isArray(link) ? [link[0], link[4]].sort().join('|') : null;
    check(
      Array.isArray(link) &&
        link.length === 8 &&
        sectors.has(link[0]) &&
        sectors.has(link[4]) &&
        link[0] !== link[4] &&
        !linked.has(pair) &&
        edgeAnchor(link[1], { x: link[2], y: link[3] }) &&
        edgeAnchor(link[5], { x: link[6], y: link[7] }),
      'enlace táctico inválido.',
    );
    linked.add(pair);
  }
  for (const [scene, record] of Object.entries(world.sceneExits ?? {}))
    check(
      id(scene) &&
        object(record) &&
        (sectors.has(record.sector) || record.sector === scene) &&
        Array.isArray(record.exits) &&
        unique(record.exits.map((v) => v?.id)) &&
        record.exits.every(
          (v) =>
            object(v) &&
            text(v.id) &&
            EDGES.includes(v.edge) &&
            sectors.has(v.destination) &&
            edgeAnchor(v.entryEdge, v.entryAnchor),
        ),
      `salidas de escena inválidas: ${scene}.`,
    );
  for (const entry of world.sceneEntries ?? [])
    check(
      object(entry) &&
        sectors.has(entry.from) &&
        (sectors.has(entry.to) || Object.hasOwn(world.sceneExits ?? {}, entry.to)) &&
        (entry.scene === null || Object.hasOwn(world.sceneExits ?? {}, entry.scene)) &&
        edgeAnchor(entry.entryEdge, entry.entryAnchor),
      'entrada de escena inválida.',
    );
  for (const [scene, p] of Object.entries(world.sceneExitAnchors ?? {}))
    check(Object.hasOwn(world.sceneExits ?? {}, scene) && anchor(p), 'ancla de salida inválida.');
  for (const [scene, location] of Object.entries(world.sceneLocations ?? {}))
    check(
      Object.hasOwn(world.sceneExits ?? {}, scene) && sectors.has(location),
      'localidad de escena inválida.',
    );
  const placementValid = (placement) =>
    object(placement) &&
    (placement.playerAnchors === undefined ||
      (Array.isArray(placement.playerAnchors) &&
        placement.playerAnchors.length > 0 &&
        placement.playerAnchors.length <= 48 &&
        placement.playerAnchors.every(anchor))) &&
    (placement.enemyAnchor === undefined || anchor(placement.enemyAnchor));
  if (world.defaultDeployment !== undefined)
    check(placementValid(world.defaultDeployment), 'despliegue general inválido.');
  for (const [place, placement] of Object.entries(world.deployment ?? {}))
    check(
      (sectors.has(place) || Object.hasOwn(world.sceneExits ?? {}, place)) &&
        placementValid(placement),
      `despliegue inválido: ${place}.`,
    );
  if (!errors.length) {
    const byCell = new Map(world.cells.map((c) => [c.id, c])),
      components = new Map();
    let index = 0;
    for (const cell of world.cells)
      if (cell.land && !components.has(cell.id)) {
        const queue = [cell];
        components.set(cell.id, index);
        for (let i = 0; i < queue.length; i++)
          for (const [dx, dy] of [
            [0, -1],
            [0, 1],
            [-1, 0],
            [1, 0],
          ]) {
            const next = byCell.get(`cell-${queue[i].col + dx}-${queue[i].row + dy}`);
            if (next?.land && !components.has(next.id)) {
              components.set(next.id, index);
              queue.push(next);
            }
          }
        index++;
      }
    const anchorCells = new Map(world.cells.filter((c) => c.anchor).map((c) => [c.locality, c.id]));
    for (const sector of world.sectors)
      for (const to of sector.neighbors)
        check(
          components.get(anchorCells.get(sector.id)) === components.get(anchorCells.get(to)),
          `el camino ${sector.id} / ${to} no tiene conexión terrestre.`,
        );
  }
  return errors;
}
