import {WEAPONS} from './data.js';

// Corresponding sockets are distinct items. Legacy unmarked bayonets never
// acquire a compatible pattern from the gun beside them. See the I06 plan.
export const FITTING_RULES_VERSION = 1;
export const FITTING_PATTERNS = Object.freeze({
  india_socket: Object.freeze({weapon:1811, host:1800, name:'Bayoneta para Brown Bess India', weight:.5}),
});
export const FIT_BAYONET_AP = 12;
export const REMOVE_BAYONET_AP = 8;
export const LOOSE_BAYONET = Object.freeze({id:1811,name:'Bayoneta suelta',ap:16,damage:24,reach:1});
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = message => {throw Error(message);};
const FITTING_FIELDS = new Set(['weapon','fittingPattern','instanceId','condition']);
const ITEM_FIELDS = new Set(['item','count','weapon','loaded','condition','jammed','fittings','fittingPattern','instanceId','reloadProgress']);
const IDENTITY_FIELDS = new Set(['instanceId','weaponInstanceId','bladeInstanceId','fittings','weaponFittings','fittingPattern','weaponFittingPattern','bladeFittingPattern','equipmentCursor','inventory','offHand','weaponMetadata','bladeMetadata']);
function validateFittingMetadata(metadata, pattern) {
  if (!object(metadata) || Object.keys(metadata).some(key => ITEM_FIELDS.has(key))) fail('Los metadatos de la bayoneta no son válidos.');
  if (Object.hasOwn(metadata,'weight') && metadata.weight !== FITTING_PATTERNS[pattern]?.weight) fail('El peso de la bayoneta no es válido.');
  const seen = new Set();
  let remaining = 10000;
  const visit = (value, depth) => {
    if (--remaining < 0 || depth > 20) fail('Los metadatos de la bayoneta son demasiado extensos.');
    if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return;
    if (typeof value !== 'object' || seen.has(value) || !Array.isArray(value) && ![Object.prototype,null].includes(Object.getPrototypeOf(value))) fail('Los metadatos de la bayoneta no son válidos.');
    seen.add(value);
    for (const key of Object.keys(value)) {
      if (['__proto__','constructor','prototype'].includes(key) || IDENTITY_FIELDS.has(key)) fail('Los metadatos de la bayoneta no pueden contener otro equipo.');
      visit(value[key],depth+1);
    }
    seen.delete(value);
  };
  visit(metadata,0);
}
export function validItemIdentity(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 100 &&
    !/[<>\x00-\x1f]/.test(id) && !['__proto__','constructor','prototype'].includes(id);
}
export function fittingLabel(pattern) {return Object.hasOwn(FITTING_PATTERNS,pattern) ? FITTING_PATTERNS[pattern].name : 'Bayoneta de encastre sin identificar';}
export function weaponItemWeight(id) {
  if (typeof id === 'object') return Number.isFinite(id?.weight) ? id.weight : id?.capacity > 0 ? 4 : 0;
  return WEAPONS[id]?.weight ?? 0;
}
export function validateFittingPattern(pattern, weapon, instanceId) {
  if (pattern === undefined || pattern === null) return true;
  const spec = typeof pattern==='string' && Object.hasOwn(FITTING_PATTERNS,pattern) ? FITTING_PATTERNS[pattern] : null;
  if (!spec || spec.weapon !== weapon || !validItemIdentity(instanceId)) fail('La bayoneta identificada no tiene un encastre o una identidad válidos.');
  return true;
}
export function validateFitting(fitting, hostWeaponId) {
  if (!object(fitting) || Object.keys(fitting).some(key => !FITTING_FIELDS.has(key) && key !== 'metadata') ||
      ![...FITTING_FIELDS].every(key => Object.hasOwn(fitting,key))) fail('Los datos de la bayoneta fijada no son válidos.');
  validateFittingPattern(fitting.fittingPattern,fitting.weapon,fitting.instanceId);
  const spec = FITTING_PATTERNS[fitting.fittingPattern];
  if (!spec || spec.host !== hostWeaponId) fail('La bayoneta no corresponde a este fusil.');
  if (!Number.isFinite(fitting.condition) || fitting.condition < 0 || fitting.condition > 100) fail('La condición de la bayoneta no es válida.');
  if (Object.hasOwn(fitting,'metadata')) validateFittingMetadata(fitting.metadata,fitting.fittingPattern);
  return true;
}
// A fitting remains the same finite item while the host owns it. The four
// original fields stay canonical; optional metadata cannot hide another item
// or restore stale condition after a thrust or a repair.
export function fittingFromItem(stack, hostWeaponId) {
  if (!object(stack) || stack.count !== 1 || stack.weight !== weaponItemWeight(stack.weapon) ||
      (stack.loaded ?? 0) !== 0 || (stack.jammed ?? false) !== false || stack.reloadProgress !== undefined) fail('El objeto de la bayoneta no es válido.');
  validateWeaponFittings(stack.fittings,stack.weapon);
  const fitting = Object.fromEntries([...FITTING_FIELDS].map(key => [key,stack[key]]));
  const metadata = Object.fromEntries(Object.entries(stack).filter(([key]) => !ITEM_FIELDS.has(key) && key !== 'weight'));
  if (Object.keys(metadata).length) fitting.metadata = metadata;
  validateFitting(fitting,hostWeaponId);
  return structuredClone(fitting);
}
export function fittingToItem(fitting) {
  const spec = FITTING_PATTERNS[fitting?.fittingPattern];
  validateFitting(fitting,spec?.host);
  return {...structuredClone(fitting.metadata ?? {}),item:'weapon',count:1,weight:spec.weight,weapon:fitting.weapon,
    loaded:0,jammed:false,condition:fitting.condition,instanceId:fitting.instanceId,fittingPattern:fitting.fittingPattern};
}
export function validateWeaponFittings(fittings, hostWeaponId) {
  if (fittings === undefined) return true;
  if (!object(fittings) || Object.keys(fittings).some(key => key !== 'bayonet')) fail('Los accesorios del arma no son válidos.');
  if (fittings.bayonet !== undefined) validateFitting(fittings.bayonet,hostWeaponId);
  return true;
}
// Returns only a usable, held assembly. Stored/broken fittings still have weight
// and ownership, but cannot give an attack or a guard to another hand item.
export function fixedBayonetFor(unit) {
  if (!unit || unit.weaponDropped || (unit.activeSlot ?? 'primary') !== 'primary') return null;
  const fitting = unit.weaponFittings?.bayonet;
  try {validateFitting(fitting,unit.weapon);} catch {return null;}
  return fitting.condition > 0 ? fitting : null;
}
export function fixedBayonetProfile(unit) {
  const fitting = fixedBayonetFor(unit);
  return fitting ? {id:1811,name:fittingLabel(fitting.fittingPattern),ap:16,damage:50*(.5+fitting.condition/200),reach:2,fitting:true} : null;
}
export function fittingWeight(record) {
  const fitting = record?.fittings?.bayonet ?? record?.weaponFittings?.bayonet;
  return fitting ? FITTING_PATTERNS[fitting.fittingPattern]?.weight ?? 0 : 0;
}
export function fittingItemIds(record) {
  const ids = [];
  if (record?.instanceId !== undefined) ids.push(record.instanceId);
  if (record?.fittings?.bayonet?.instanceId !== undefined) ids.push(record.fittings.bayonet.instanceId);
  return ids;
}
export function heldItemIds(unit) {
  return [
    ...(!unit.weaponDropped ? [unit.weaponInstanceId,unit.weaponFittings?.bayonet?.instanceId] : []),
    ...(unit.blade ? [unit.bladeInstanceId] : []),
    ...(unit.offHand?fittingItemIds(unit.offHand):[]),
    ...(unit.outfit?.instanceId?[unit.outfit.instanceId]:[]),
  ].filter(id => id !== undefined);
}
export function normalizeUnitFittings(unit) {
  unit.weaponFittings ??= {};
  unit.weaponFittingPattern ??= null;
  unit.bladeFittingPattern ??= null;
  return unit;
}
export function validateUnitFittings(unit) {
  validateWeaponFittings(unit.weaponFittings,unit.weapon);
  validateFittingPattern(unit.weaponFittingPattern,unit.weapon,unit.weaponInstanceId);
  validateFittingPattern(unit.bladeFittingPattern,unit.blade,unit.bladeInstanceId);
  if (unit.weaponDropped && (unit.weaponFittings?.bayonet || unit.weaponFittingPattern != null)) fail('El arma abandonada no puede conservar una bayoneta.');
  const ids = heldItemIds(unit);
  if (new Set(ids).size !== ids.length) fail('La identidad del equipo está duplicada.');
  return true;
}
