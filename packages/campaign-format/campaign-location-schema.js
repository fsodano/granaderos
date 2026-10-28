const campaignWorld = (context) => context?.world ?? {};
const campaignSectors = (context) => campaignWorld(context).sectors ?? [];
const arrivalFacilityOptions = (sectorId, context) =>
  campaignWorld(context).arrivalFacilities?.[sectorId] ?? [];
const foundryLocations = (context) =>
  campaignSectors(context).filter((sector) =>
    arrivalFacilityOptions(sector.id, context).includes('barracks'),
  );
const headquartersOptions = foundryLocations;
const importPortsFor = (context) =>
  campaignSectors(context).filter((sector) =>
    arrivalFacilityOptions(sector.id, context).includes('port'),
  );
export function validateFoundry(value, context = null) {
  if (value === undefined) return [];
  const keys = ['sector', 'name', 'armyName', 'setupCost', 'fundingCost'];
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    !keys.every((k) => Object.hasOwn(value, k))
  )
    return ['Fundición: configurá su ubicación, nombres y dos costos.'];
  const errors = [];
  if (!foundryLocations(context).some((s) => s.id === value.sector))
    errors.push(
      'Fundición: elegí una localidad terrestre con instalaciones, no un paso ni una celda de agua.',
    );
  for (const key of ['name', 'armyName'])
    if (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > 100)
      errors.push('Fundición: cada nombre necesita entre 1 y 100 caracteres.');
  for (const key of ['setupCost', 'fundingCost'])
    if (!Number.isSafeInteger(value[key]) || value[key] < 0 || value[key] > 1000000)
      errors.push('Fundición: cada costo debe ser un número entero entre 0 y 1000000 pesos.');
  return errors;
}

export function validateCampaignRoles(value, characters) {
  if (value === undefined) return [];
  const keys = ['foundryEngineer', 'marchCommander'];
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    !keys.every((k) => Object.hasOwn(value, k))
  )
    return ['Funciones de campaña: elegí el responsable de fundición y de marcha, o ninguno.'];
  return keys.flatMap((key) =>
    value[key] === null ||
    (typeof value[key] === 'string' && characters.some((c) => c?.id === value[key]))
      ? []
      : ['Funciones de campaña: el personaje asignado no existe.'],
  );
}

export function validateImportRules(value, context = null) {
  if (value === undefined) return [];
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== 3 ||
    !['port', 'minHours', 'maxHours'].every((k) => Object.hasOwn(value, k))
  )
    return ['Importaciones: configurá el puerto y los dos plazos de entrega.'];
  const errors = [];
  if (value.port !== null && !importPortsFor(context).some((s) => s.id === value.port))
    errors.push(
      'Importaciones: elegí un puerto con acceso al río navegable, o deshabilitá los pedidos.',
    );
  if (
    !Number.isInteger(value.minHours) ||
    !Number.isInteger(value.maxHours) ||
    value.minHours < 1 ||
    value.maxHours > 720 ||
    value.minHours > value.maxHours
  )
    errors.push(
      'Importaciones: los plazos deben ser horas enteras entre 1 y 720, con el mínimo no mayor que el máximo.',
    );
  return errors;
}

export function validateHeadquarters(value, context = null) {
  return value === undefined ||
    (typeof value === 'string' && headquartersOptions(context).some((s) => s.id === value))
    ? []
    : [
        'Cuartel general: elegí una localidad con acceso terrestre compatible, no un paso ni una celda de agua.',
      ];
}

export function validateStartingTerritory(value, headquarters, context = null) {
  headquarters ??= campaignWorld(context).defaultHeadquarters;
  const CAMPAIGN_SECTORS = campaignSectors(context);
  if (value === undefined) return [];
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== CAMPAIGN_SECTORS.length ||
    !CAMPAIGN_SECTORS.every((s) => Object.hasOwn(value, s.id))
  )
    return ['Territorio inicial: configurá todas las localidades del mapa.'];
  const errors = [];
  for (const sector of CAMPAIGN_SECTORS) {
    const r = value[sector.id];
    if (
      !r ||
      typeof r !== 'object' ||
      Array.isArray(r) ||
      Object.keys(r).length !== 2 ||
      !Object.hasOwn(r, 'owner') ||
      !Object.hasOwn(r, 'loyalty') ||
      !['patriot', 'royalist'].includes(r.owner) ||
      !Number.isInteger(r.loyalty) ||
      r.loyalty < 0 ||
      r.loyalty > 100
    )
      errors.push(
        `Territorio inicial de ${sector.name}: elegí control patriota o realista y lealtad entera entre 0 y 100.`,
      );
  }
  if (value[headquarters]?.owner !== 'patriot')
    errors.push(
      'El cuartel general debe comenzar bajo control patriota: es el origen de abastecimiento de esta campaña.',
    );
  return errors;
}

export function validateArrivalSites(sites, context = null) {
  if (!Array.isArray(sites) || sites.length > campaignSectors(context).length)
    return ['Llegadas: lista de puntos de recepción inválida.'];
  const seen = new Set(),
    errors = [];
  for (const site of sites) {
    if (
      !site ||
      typeof site !== 'object' ||
      Array.isArray(site) ||
      Object.keys(site).length !== 2 ||
      !Object.hasOwn(site, 'sector') ||
      !Object.hasOwn(site, 'facilities')
    ) {
      errors.push('Llegadas: punto de recepción inválido.');
      continue;
    }
    const allowed = arrivalFacilityOptions(site.sector, context);
    if (seen.has(site.sector) || !allowed.length)
      errors.push(
        `Llegadas.${site.sector}: elegí una localidad con acceso habilitado, no una celda de agua ni un paso cordillerano.`,
      );
    seen.add(site.sector);
    if (
      !Array.isArray(site.facilities) ||
      !site.facilities.length ||
      new Set(site.facilities).size !== site.facilities.length ||
      !site.facilities.every((f) => allowed.includes(f))
    )
      errors.push(
        `Llegadas.${site.sector}: infraestructura incompatible; los puertos y embarcaderos requieren acceso al río navegable.`,
      );
  }
  return errors;
}

export const ARTILLERY_TRADING_FIELDS = Object.freeze([
  ['initialCash', 'Fondos iniciales de cada taller (pesos)', 0, 1000000],
  ['buyPercent', 'Pago general del taller (% del precio)', 0, 100],
  ['resalePercent', 'Precio de recompra (% del precio)', 0, 100],
]);

export function validateArtilleryTradingRules(value, context = null) {
  if (value === undefined) return [];
  const object = (v) => v && typeof v === 'object' && !Array.isArray(v),
    keys = ['enabled', 'initialCash', 'buyPercent', 'resalePercent', 'buyingOverrides'];
  if (
    !object(value) ||
    Object.keys(value).length !== keys.length ||
    !keys.every((k) => Object.hasOwn(value, k))
  )
    return ['Comercio de artillería: configurá todas las reglas, sin campos adicionales.'];
  const errors =
    typeof value.enabled === 'boolean'
      ? []
      : ['Comercio de artillería: el permiso debe estar activado o desactivado.'];
  for (const [key, label, min, max] of ARTILLERY_TRADING_FIELDS)
    if (!Number.isSafeInteger(value[key]) || value[key] < min || value[key] > max)
      errors.push(`${label}: elegí un entero de ${min} a ${max}.`);
  if (
    !object(value.buyingOverrides) ||
    Object.entries(value.buyingOverrides).some(
      ([id, n]) =>
        !campaignSectors(context).some((s) => s.id === id) ||
        !Number.isSafeInteger(n) ||
        n < 0 ||
        n > 100,
    )
  )
    errors.push(
      'Comercio de artillería: cada precio local necesita una localidad existente y un porcentaje de 0 a 100.',
    );
  return errors;
}
