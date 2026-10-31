import { DEFAULT_CATALOGUE } from '../../content/campaigns/default.js';
import { handRecord } from './tactical-inventory.js';
import { WEAPON_READY_AP } from './weapon-readiness.js';
import {
  AMMO_TYPES,
  primaryAmmoTypeFor,
  selectedAmmunitionLoad,
  validateAmmunitionChoice,
} from './ammo-types.js';
import { validateReloadProgress } from './weapon-reload.js';
import { WEAPONS as ITEMS } from './data.js';
import { WEAPONS as FIREARMS } from './firearm-definitions.js';
import { BLADES } from './blade-definitions.js';
import { canonicalContent } from './content-identity.js';
import { validMaterialRangeSlope } from './material-range-penetration.js';
import { validProjectileEnergy } from './projectile-energy.js';
import { validProjectileAirDrag } from './projectile-air-drag.js';
import { isContentImageReference } from './campaign-assets.js';
import type {
  CampaignContent,
  CompiledWeaponDefinition,
  WeaponDefinition,
} from '../campaign-format/types.ts';
import type {
  WeaponCarrier,
  WeaponMetadata,
  WeaponProfile,
  WeaponReference,
  WeaponSlot,
  WeaponSpecification,
} from './public/weapon-types.ts';

export const FIREARM_PRICES: Readonly<Record<string, number>> = structuredClone(
  DEFAULT_CATALOGUE.firearmPrices,
);
export const BLADE_PRICES: Readonly<Record<string, number>> = structuredClone(
  DEFAULT_CATALOGUE.bladePrices,
);
export const FIREARM_MELEE_FIELDS = ['stockAP', 'stockDamage', 'stockReach'] as const;
const itemFamilies: Readonly<
  Record<string, WeaponProfile & { name: string; damage: number; fireAP: number; range: number }>
> = ITEMS;
const firearmFamilies: Readonly<Record<string, { id: number; capacity: number } & WeaponProfile>> =
  FIREARMS;
const bladeFamilies: Readonly<
  Record<string, { id: number; ap: number; reach: number } & WeaponProfile>
> = BLADES;
const readyCosts: Readonly<Record<string, number>> = WEAPON_READY_AP;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string | number =>
  typeof value === 'string' || typeof value === 'number';
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const finite = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
function need(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw Error(message);
  }
}
export function isBladeDefinition(value: unknown): boolean {
  return (
    record(value) &&
    identifier(value['template']) &&
    Object.hasOwn(bladeFamilies, value['template'])
  );
}
export function validWeaponArt(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    isContentImageReference(value) &&
    (!value.startsWith('data:') || value.length < 350000)
  );
}
export function compileWeaponDefinition(authored: WeaponDefinition): CompiledWeaponDefinition {
  const item = itemFamilies[authored.template];
  need(item, 'La familia del arma no es válida.');
  if (isBladeDefinition(authored)) {
    need(
      authored.ammunitionFamily === undefined &&
        authored.alternativeLoads === undefined &&
        authored.materialRangeSlope === undefined &&
        authored.projectileEnergy === undefined &&
        authored.projectileAirDrag === undefined,
      'La munición solo se configura en armas de fuego.',
    );
    need(
      !FIREARM_MELEE_FIELDS.some((key) => Object.hasOwn(authored, key)),
      'El golpe con la culata solo se configura en armas de fuego.',
    );
    const result: unknown = {
      version: 1,
      id: authored.id,
      template: authored.template,
      name: authored.name,
      damage: authored.damage,
      ap: authored.ap,
      reach: authored.reach,
      weight: authored.weight ?? item.weight,
      price: authored.price ?? BLADE_PRICES[authored.template],
      art: authored.art ?? `/art/weapon-${authored.template}.png`,
    };
    validateWeaponDefinition(result, authored.template);
    need(result, 'La definición del arma no es válida.');
    return result;
  }
  const base = firearmFamilies[authored.template];
  need(base, 'La familia del arma no es válida.');
  const result: unknown = {
    ...(authored.stockAP !== undefined ? { stockAP: authored.stockAP } : {}),
    ...(authored.stockDamage !== undefined ? { stockDamage: authored.stockDamage } : {}),
    ...(authored.stockReach !== undefined ? { stockReach: authored.stockReach } : {}),
    ...(authored.projectileAirDrag !== undefined
      ? { projectileAirDrag: structuredClone(authored.projectileAirDrag) }
      : {}),
    ...(authored.projectileEnergy !== undefined
      ? { projectileEnergy: structuredClone(authored.projectileEnergy) }
      : {}),
    ...(authored.materialRangeSlope !== undefined
      ? { materialRangeSlope: authored.materialRangeSlope }
      : {}),
    ...(authored.alternativeLoads !== undefined
      ? { alternativeLoads: structuredClone(authored.alternativeLoads) }
      : {}),
    ...(authored.ammunitionFamily !== undefined
      ? { ammunitionFamily: authored.ammunitionFamily }
      : {}),
    version: 1,
    id: authored.id,
    template: base.id,
    name: authored.name,
    damage: authored.damage,
    fireAP: authored.fireAP,
    aimAP: authored.aimAP,
    reloadAP: authored.reloadAP,
    range: authored.range,
    readyAP: authored.readyAP ?? 0,
    capacity: authored.capacity ?? base.capacity,
    weight: authored.weight ?? item.weight,
    price: authored.price ?? FIREARM_PRICES[base.id],
    art: authored.art ?? `/art/weapon-${base.id}.png`,
  };
  validateWeaponDefinition(result, base.id);
  need(result, 'La definición del arma no es válida.');
  return result;
}
function validAlternativeLoad(value: unknown, primary: string | null): boolean {
  if (!record(value)) {
    return false;
  }
  return (
    Object.keys(value).every((key) =>
      [
        'family',
        'damage',
        'range',
        'pattern',
        'materialRangeSlope',
        'projectileEnergy',
        'projectileAirDrag',
      ].includes(key),
    ) &&
    ['family', 'damage', 'range', 'pattern'].every((key) => Object.hasOwn(value, key)) &&
    (!Object.hasOwn(value, 'materialRangeSlope') ||
      validMaterialRangeSlope(value['materialRangeSlope'])) &&
    (!Object.hasOwn(value, 'projectileEnergy') ||
      validProjectileEnergy(value['projectileEnergy'])) &&
    (!Object.hasOwn(value, 'projectileAirDrag') ||
      validProjectileAirDrag(value['projectileAirDrag'], value['projectileEnergy'])) &&
    typeof value['family'] === 'string' &&
    Object.hasOwn(AMMO_TYPES, value['family']) &&
    value['family'] !== primary &&
    integer(value['damage'], 1, 100) &&
    integer(value['range'], 1, 100) &&
    (value['pattern'] === 'single' || value['pattern'] === 'cone')
  );
}
export function validateWeaponDefinition(
  value: unknown,
  host: unknown,
): asserts value is CompiledWeaponDefinition | undefined {
  if (value === undefined) {
    return;
  }
  need(identifier(host), 'La definición del arma no coincide con su familia.');
  const blade = Boolean(bladeFamilies[host]);
  const keys = blade
    ? ['version', 'id', 'template', 'name', 'damage', 'ap', 'reach', 'weight', 'price', 'art']
    : [
        'version',
        'id',
        'template',
        'name',
        'damage',
        'fireAP',
        'aimAP',
        'reloadAP',
        'range',
        'readyAP',
        'capacity',
        'weight',
        'price',
        'art',
      ];
  const optionalFields: readonly string[] = [
    ...FIREARM_MELEE_FIELDS,
    'ammunitionFamily',
    'alternativeLoads',
    'materialRangeSlope',
    'projectileEnergy',
    'projectileAirDrag',
  ];
  need(
    record(value) &&
      Object.keys(value).every(
        (key) => keys.includes(key) || (!blade && optionalFields.includes(key)),
      ) &&
      keys.every((key) => Object.hasOwn(value, key)),
    'La definición del arma no es válida.',
  );
  if (Object.hasOwn(value, 'projectileEnergy')) {
    need(
      !blade && validProjectileEnergy(value['projectileEnergy']),
      'El perfil de energía del proyectil no es válido.',
    );
  }
  if (Object.hasOwn(value, 'projectileAirDrag')) {
    need(
      !blade && validProjectileAirDrag(value['projectileAirDrag'], value['projectileEnergy']),
      'La pérdida de energía en el aire no es válida.',
    );
  }
  if (Object.hasOwn(value, 'materialRangeSlope')) {
    need(
      !blade && validMaterialRangeSlope(value['materialRangeSlope']),
      'La pérdida de penetración por distancia no es válida.',
    );
  }
  need(
    value['version'] === 1 &&
      (firearmFamilies[host] || bladeFamilies[host]) &&
      value['template'] === host,
    'La definición del arma no coincide con su familia.',
  );
  if (Object.hasOwn(value, 'ammunitionFamily')) {
    need(
      !blade &&
        typeof value['ammunitionFamily'] === 'string' &&
        Object.hasOwn(AMMO_TYPES, value['ammunitionFamily']),
      'La familia de munición no es válida.',
    );
  }
  if (Object.hasOwn(value, 'alternativeLoads')) {
    const primary = primaryAmmoTypeFor(value),
      loads: unknown = value['alternativeLoads'];
    need(
      !blade &&
        Array.isArray(loads) &&
        loads.length <= 3 &&
        loads.every((load: unknown) => validAlternativeLoad(load, primary)),
      'Las cargas alternativas no son válidas.',
    );
    const families = loads.map((load: unknown) => (record(load) ? load['family'] : null));
    need(new Set(families).size === loads.length, 'Las cargas alternativas no son válidas.');
  }
  need(
    typeof value['id'] === 'string' &&
      /^[a-z][a-z0-9-]{0,79}$/.test(value['id']) &&
      !['constructor', 'prototype', 'bronze4', 'field8', 'swivel'].includes(value['id']),
    'La identidad del arma no es válida.',
  );
  need(
    typeof value['name'] === 'string' &&
      value['name'].trim().length > 0 &&
      value['name'].length <= 100,
    'El nombre del arma no es válido.',
  );
  if (blade) {
    need(
      integer(value['damage'], 1, 100) &&
        integer(value['ap'], 1, 100) &&
        finite(value['reach'], 1, 4),
      'Los valores del arma blanca no son válidos.',
    );
  } else {
    for (const key of ['damage', 'fireAP', 'aimAP', 'reloadAP', 'range', 'readyAP']) {
      need(
        integer(
          value[key],
          ['aimAP', 'readyAP'].includes(key) ? 0 : 1,
          key === 'reloadAP' ? 500 : 100,
        ),
        'Los valores del arma no son válidos.',
      );
    }
    for (const key of FIREARM_MELEE_FIELDS) {
      if (Object.hasOwn(value, key)) {
        need(
          key === 'stockReach' ? finite(value[key], 1, 1.5) : integer(value[key], 1, 100),
          'Los valores del golpe con la culata no son válidos.',
        );
      }
    }
    need(
      typeof value['readyAP'] === 'number' &&
        typeof value['fireAP'] === 'number' &&
        value['readyAP'] < value['fireAP'] &&
        integer(value['capacity'], 1, 8),
      'El manejo del arma no es válido.',
    );
  }
  need(
    finite(value['weight'], 0.1, 30) && integer(value['price'], 0, 1000000),
    'El manejo del arma no es válido.',
  );
  need(validWeaponArt(value['art']), 'La imagen del arma no es válida.');
}
export function contentWeaponOf(
  value: WeaponReference,
  slot: WeaponSlot = 'primary',
): WeaponDefinition | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  return slot === 'blade'
    ? value.bladeMetadata?.contentWeapon
    : (value.contentWeapon ?? value.weaponMetadata?.contentWeapon);
}
export function weaponSpecification(
  value: WeaponReference,
  slot: WeaponSlot = 'primary',
): WeaponSpecification | null {
  const raw =
    typeof value === 'object' && value !== null
      ? slot === 'blade'
        ? value.blade
        : (value.weapon ?? value.item ?? value.id)
      : value;
  const id = typeof raw === 'object' ? raw?.id : raw;
  if (!identifier(id)) {
    return null;
  }
  const item = itemFamilies[id],
    firearm = firearmFamilies[id],
    blade = bladeFamilies[id];
  if (!item) {
    return null;
  }
  const definition = contentWeaponOf(value, slot),
    load = slot === 'primary' ? selectedAmmunitionLoad(value) : null;
  const profile = typeof raw === 'object' && raw !== null ? raw : null;
  const specification: WeaponSpecification = {
    ...item,
    ...firearm,
    ...blade,
    ...(firearm
      ? {
          readyAP: readyCosts[id] ?? 0,
          loadPattern: load?.pattern ?? (load?.family === 'ammoShot' ? 'cone' : 'single'),
        }
      : {}),
    ...(blade ? { capacity: 0 } : {}),
    ...profile,
    ...definition,
    ...(load?.damage
      ? {
          damage: load.damage,
          range: load.range ?? definition?.range ?? profile?.range ?? item.range,
          loadPattern: load.pattern ?? (load.family === 'ammoShot' ? 'cone' : 'single'),
        }
      : {}),
    id,
    capacity:
      definition?.capacity ??
      profile?.capacity ??
      (blade ? 0 : (firearm?.capacity ?? item.capacity ?? 0)),
    ...(definition ? { contentId: definition.id } : {}),
    art: definition?.art ?? `/art/weapon-${id}.png`,
    price: definition?.price ?? FIREARM_PRICES[id] ?? BLADE_PRICES[id],
  };
  // Each alternative load owns its own penetration profile.
  if (load && load.family !== primaryAmmoTypeFor(value)) {
    delete specification.materialRangeSlope;
    delete specification.projectileEnergy;
    delete specification.projectileAirDrag;
    if (load.projectileAirDrag !== undefined) {
      specification.projectileAirDrag = structuredClone(load.projectileAirDrag);
    }
    if (load.projectileEnergy !== undefined) {
      specification.projectileEnergy = structuredClone(load.projectileEnergy);
    }
    if (load.materialRangeSlope !== undefined) {
      specification.materialRangeSlope = load.materialRangeSlope;
    }
  }
  return specification;
}
export function weaponMetadata(definition: WeaponDefinition): WeaponMetadata {
  return { contentWeapon: compileWeaponDefinition(definition) };
}
export function validateWeaponCarrier(value: WeaponCarrier): void {
  validateAmmunitionChoice(value);
  if (value.bladeCondition !== undefined) {
    need(finite(value.bladeCondition, 0, 100), 'El estado del arma blanca no es válido.');
  }
  if (value.bladeJammed !== undefined) {
    need(typeof value.bladeJammed === 'boolean', 'Los datos del arma blanca no son válidos.');
  }
  if (value.jammed !== undefined) {
    need(typeof value.jammed === 'boolean', 'El atasco del arma no es válido.');
  }
  const host = typeof value.weapon === 'object' ? value.weapon.id : value.weapon;
  const definition = contentWeaponOf(value);
  validateWeaponDefinition(definition, host);
  validateReloadProgress(
    value.reloadProgress,
    weaponSpecification(value)?.capacity ?? 0,
    value.loaded ?? 0,
    Boolean(value.weaponDropped),
  );
  if (value.weaponMetadata !== undefined) {
    need(
      record(value.weaponMetadata) &&
        ![
          'weapon',
          'loaded',
          'condition',
          'jammed',
          'count',
          'reloadProgress',
          'ammunitionChoice',
        ].some((key) => Object.hasOwn(value.weaponMetadata ?? {}, key)),
      'Los datos del arma no son válidos.',
    );
  }
  const blade = contentWeaponOf(value, 'blade');
  validateWeaponDefinition(blade, value.blade);
  if (value.bladeMetadata !== undefined) {
    need(
      value.blade !== undefined &&
        bladeFamilies[value.blade] &&
        record(value.bladeMetadata) &&
        ![
          'weapon',
          'loaded',
          'condition',
          'jammed',
          'count',
          'reloadProgress',
          'ammunitionChoice',
        ].some((key) => Object.hasOwn(value.bladeMetadata ?? {}, key)),
      'Los datos del arma blanca no son válidos.',
    );
  }
  if (definition && value.loaded !== undefined) {
    need(integer(value.loaded, 0, definition.capacity ?? 0), 'La carga del arma no es válida.');
  }
  if (definition && value.weight !== undefined && value.count !== undefined) {
    need(value.weight === definition.weight, 'El peso del arma no coincide con su definición.');
  }
}
type WeaponContentContext = { contentCampaign?: { package: Pick<CampaignContent, 'weapons'> } };
function compiledDefinitions(state: WeaponContentContext): Map<string, CompiledWeaponDefinition> {
  return new Map(
    (state.contentCampaign?.package.weapons ?? []).map((weapon) => [
      weapon.id,
      compileWeaponDefinition(weapon),
    ]),
  );
}
export function validateWeaponReferences(state: WeaponContentContext, value: unknown): void {
  const definitions = compiledDefinitions(state);
  function visit(node: unknown): void {
    if (Array.isArray(node)) {
      for (const child of node) {
        visit(child);
      }
      return;
    }
    if (!record(node)) {
      return;
    }
    if (Object.hasOwn(node, 'contentWeapon')) {
      const definition = node['contentWeapon'];
      const expected =
        record(definition) && typeof definition['id'] === 'string'
          ? definitions.get(definition['id'])
          : undefined;
      need(
        expected && canonicalContent(expected) === canonicalContent(definition),
        'El arma guardada no coincide con el contenido de campaña.',
      );
    }
    for (const [key, child] of Object.entries(node)) {
      if (key !== 'contentCampaign' && key !== 'contentWeapon') {
        visit(child);
      }
    }
  }
  visit(value);
}
export function weaponRecord(carrier: WeaponCarrier, slot: WeaponSlot = 'primary') {
  return handRecord(carrier, slot);
}
export function setWeaponDefinition(
  carrier: WeaponCarrier,
  source: WeaponCarrier,
  slot: WeaponSlot = 'primary',
): void {
  const definition = contentWeaponOf(source);
  if (slot === 'blade') {
    delete carrier.bladeMetadata;
    carrier.bladeCondition = source.condition ?? 100;
    carrier.bladeJammed = Boolean(source.jammed);
    if (definition) {
      carrier.bladeMetadata = { contentWeapon: structuredClone(definition) };
    }
    return;
  }
  delete carrier.contentWeapon;
  delete carrier.weaponMetadata;
  delete carrier.ammunitionChoice;
  if (source.ammunitionChoice !== undefined) {
    carrier.ammunitionChoice = source.ammunitionChoice;
  }
  if (definition) {
    carrier.weaponMetadata = { contentWeapon: structuredClone(definition) };
  }
}
// Save references share the immutable package instead of repeating uploaded art.
export function weaponSaveReplacer(
  state: WeaponContentContext,
): (key: string, value: unknown) => unknown {
  const definitions = new Map(
    [...compiledDefinitions(state)].map(([id, definition]) => [id, canonicalContent(definition)]),
  );
  return (key, value) =>
    key === 'contentWeapon' &&
    record(value) &&
    typeof value['id'] === 'string' &&
    definitions.get(value['id']) === canonicalContent(value)
      ? { definitionRef: value['id'] }
      : value;
}
export function restoreWeaponReferences(state: WeaponContentContext, value: unknown): void {
  const definitions = compiledDefinitions(state);
  function visit(node: unknown): void {
    if (Array.isArray(node)) {
      for (const child of node) {
        visit(child);
      }
      return;
    }
    if (!record(node)) {
      return;
    }
    const reference = node['contentWeapon'];
    if (record(reference) && Object.hasOwn(reference, 'definitionRef')) {
      need(
        Object.keys(reference).length === 1 && typeof reference['definitionRef'] === 'string',
        'La referencia del arma guardada no es válida.',
      );
      const definition = definitions.get(reference['definitionRef']);
      need(definition, 'La referencia del arma guardada no es válida.');
      node['contentWeapon'] = { ...definition };
    }
    for (const [key, child] of Object.entries(node)) {
      if (key !== 'contentCampaign' && key !== 'contentWeapon') {
        visit(child);
      }
    }
  }
  visit(value);
}
