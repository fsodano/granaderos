// Prepared loads, not interchangeable balls of the same nominal diameter.
// These helpers own only loose inventory quantities. Gun loads, the equipment
// cursor, pocket capacity and campaign stock are separate caller-owned state.
export const AMMUNITION_WEIGHT = .04;
export const AMMUNITION_STACK_LIMIT = 20;
const MAX_QUANTITY = 1000000;
const definitions = [
  ['musket_75', 'Cartucho de mosquete .75', 1800],
  ['musket_69', 'Cartucho de mosquete .69', 1801],
  ['rifle_62', 'Cartucho de fusil .62 con parche', 1802],
  ['carbine_65', 'Cartucho de tercerola .65', 1803],
  ['shot_16', 'Carga de perdigones calibre 16', 1804],
  ['pistol_69', 'Cartucho de pistola .69', 1805],
  ['pistol_50', 'Cartucho de pistola .50', 1806],
  ['scatter', 'Carga de metralla para trabuco', 1807],
  ['pistol_54', 'Cartucho de pistola .54', 1808],
];
export const AMMUNITION_TYPES = Object.freeze(Object.fromEntries(definitions.map(([id, name, weapon]) =>
  [id, Object.freeze({id, name, label:name, weaponIds:Object.freeze([weapon]), weight:AMMUNITION_WEIGHT, stackLimit:AMMUNITION_STACK_LIMIT})])));
export const WEAPON_AMMO_TYPES = Object.freeze(Object.fromEntries(definitions.map(([type, , weapon]) => [weapon, type])));

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const need = (condition, message) => {if (!condition) throw Error(message);};
const validQuantity = (count, minimum=0) => Number.isSafeInteger(count) && count >= minimum && count <= MAX_QUANTITY;
const safeKey = key => typeof key === 'string' && key.length > 0 && key.length <= 100 &&
  !/[<>\x00-\x1f]/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key);
function catalog(type) {
  need(typeof type === 'string' && Object.hasOwn(AMMUNITION_TYPES, type), 'El tipo de munición no es válido.');
  return AMMUNITION_TYPES[type];
}

// Legacy equipment IDs may be carried without being usable firearms. Never
// infer a prepared load from a name, caliber label or an unknown numeric ID.
export function weaponAmmoType(weapon) {
  const id = object(weapon) ? weapon.weapon ?? weapon.id : weapon;
  return Number.isInteger(id) && Object.hasOwn(WEAPON_AMMO_TYPES, id) ? WEAPON_AMMO_TYPES[id] : null;
}

// Classification is deliberately separate from admission: malformed tagged
// ammunition must produce a validation error, not disappear from the totals.
export const isAmmunitionStack = stack => object(stack) && stack.kind === 'ammunition';
export function validateAmmunitionStack(stack) {
  if (!isAmmunitionStack(stack)) return false;
  catalog(stack.ammoType);
  need(validQuantity(stack.count), 'La cantidad de munición no es válida.');
  need(stack.weight === AMMUNITION_WEIGHT, 'El peso de la munición no es válido.');
  need(typeof stack.name === 'string' && stack.name.trim().length > 0 && stack.name.length <= 100,
    'El nombre de la munición no es válido.');
  need(Object.keys(stack).every(key => !['__proto__', 'constructor', 'prototype'].includes(key)),
    'Los datos de la munición no son válidos.');
  need(['weapon', 'loaded', 'reloadProgress', 'loadedAmmoType', 'reloadAmmoType', 'jammed', 'fittings',
    'fittingPattern', 'toolKey', 'itemType', 'outfit'].every(key => stack[key] === undefined),
  'La munición suelta no puede contener datos de otro equipo.');
  if (stack.instanceId !== undefined) need(safeKey(stack.instanceId) && stack.count <= 1,
    'Una munición identificada debe conservarse por separado.');
  return true;
}

function reserveEntries(unit) {
  need(object(unit), 'El propietario de la munición no es válido.');
  const inventory = unit.inventory === undefined ? {} : unit.inventory;
  need(object(inventory), 'El inventario no es válido.');
  const entries = [];
  for (const key of Object.keys(inventory).sort()) {
    need(safeKey(key), 'La clave del objeto no es válida.');
    const stack = inventory[key];
    if (!isAmmunitionStack(stack)) continue;
    validateAmmunitionStack(stack);
    entries.push([key, stack]);
  }
  return {inventory, entries};
}
function totals(entries) {
  const result = {};
  for (const type of Object.keys(AMMUNITION_TYPES)) {
    const count = entries.reduce((sum, [, stack]) => sum + (stack.ammoType === type ? stack.count : 0), 0);
    need(Number.isSafeInteger(count), 'La cantidad total de munición no es válida.');
    if (count > 0) result[type] = count;
  }
  return result;
}
export function ammunitionByType(unit) {return totals(reserveEntries(unit).entries);}
export function totalReserveAmmunition(unit) {
  const count = Object.values(ammunitionByType(unit)).reduce((sum, value) => sum + value, 0);
  need(Number.isSafeInteger(count), 'La cantidad total de munición no es válida.');
  return count;
}
export function availableAmmunition(unit, weapon=unit?.weapon) {
  const type = typeof weapon === 'string' ? catalog(weapon).id : weaponAmmoType(weapon);
  const available = ammunitionByType(unit);
  return type ? available[type] ?? 0 : 0;
}

function emptyKey(inventory, type) {
  const base = `ammo:${type}`;
  if (!Object.hasOwn(inventory, base)) return base;
  for (let index=1; index<=MAX_QUANTITY; index++) {
    const key = `${base}:${index}`;
    if (!Object.hasOwn(inventory, key)) return key;
  }
  throw Error('No queda una ubicación para la munición.');
}
const canonical = (stack, spec) => stack.kind === 'ammunition' && stack.ammoType === spec.id &&
  stack.name === spec.name && stack.weight === spec.weight &&
  Object.keys(stack).every(key => ['kind', 'ammoType', 'name', 'weight', 'count'].includes(key));

// Both mutations validate and construct the next inventory before one commit.
// They do not enforce pocket capacity or rewrite hand/pocket references. Those
// references must be reconciled by the caller after actual consumption.
export function addAmmunition(unit, type, count) {
  const spec = catalog(type);
  need(validQuantity(count, 1), 'La cantidad de munición que se agrega no es válida.');
  const {inventory, entries} = reserveEntries(unit);
  const previous = entries.find(([, stack]) => canonical(stack, spec) && stack.count + count <= MAX_QUANTITY);
  const next = {...inventory};
  if (previous) next[previous[0]] = {...previous[1], count:previous[1].count + count};
  else next[emptyKey(inventory, type)] = {kind:'ammunition', ammoType:type, count, weight:spec.weight, name:spec.name};
  unit.inventory = next;
  return unit;
}
export function consumeAmmunition(unit, type, count) {
  catalog(type);
  need(validQuantity(count, 1), 'La cantidad de munición que se consume no es válida.');
  const {inventory, entries} = reserveEntries(unit), sources = entries.filter(([, stack]) => stack.ammoType === type);
  const available = sources.reduce((sum, [, stack]) => sum + stack.count, 0);
  need(Number.isSafeInteger(available) && count <= available, 'No queda esa cantidad de munición compatible.');
  const next = {...inventory};let remaining = count;
  for (const [key, stack] of sources) {
    if (!remaining) break;
    const used = Math.min(remaining, stack.count);if (!used) continue;
    if (used === stack.count) delete next[key];else next[key] = {...stack, count:stack.count - used};
    remaining -= used;
  }
  unit.inventory = next;
  return unit;
}
