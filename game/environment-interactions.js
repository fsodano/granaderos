import {AMMUNITION_TYPES} from './ammunition-types.js';
import {validateItemStack} from './tactical-inventory.js';
import {finiteSectorCache} from './finite-sector-caches.js';
import {hasCharacterAbility} from './character-abilities.js';

// Classic JA2 manual, printed pp. 25–27: held tools, keys, lock picks,
// crowbars, force, uncertain examination, disarming, and finite containers.
// Patusco pp. 22, 26, 64: mechanical skill, experience, lock-picking traits,
// and strength with a crowbar. Costs, chances, wear, and nonexplosive trap
// effects below are explicit Granaderos tuning on its 100-AP scale.
export const TOOL_TYPES = Object.freeze(Object.fromEntries([
  ['key', 'Llave', .2, 'unlock', 4, 0],
  ['lockpick', 'Ganzúas', .4, 'pick', 16, 2],
  ['crowbar', 'Barreta', 2.5, 'pry', 20, 3],
  ['pliers', 'Alicates', .5, 'disarm', 18, 2],
].map(([toolKey, label, weight, verb, pa, wear]) => [toolKey, Object.freeze({toolKey, label, name: label, weight, verb, pa, wear})])));
export const ENVIRONMENT_VERBS = Object.freeze(['inspect', 'open', 'close', 'unlock', 'pick', 'pry', 'force', 'disarm', 'breach']);
const LABELS = Object.freeze({inspect: 'Examinar', open: 'Abrir', close: 'Cerrar', unlock: 'Usar llave', pick: 'Forzar con ganzúas', pry: 'Hacer palanca', force: 'Forzar a golpes', disarm: 'Desarmar trampa', breach: 'Abrir brecha con barreta'});
const COSTS = Object.freeze({inspect: 4, open: 4, close: 4, unlock: 4, pick: 16, pry: 20, force: 24, disarm: 18});
const REQUIRED = Object.freeze({unlock: 'key', pick: 'lockpick', pry: 'crowbar', disarm: 'pliers', breach: 'crowbar'});
const SIDES = ['player', 'enemy', 'neutral'];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = reason => {throw new Error(reason);};
const stat = (unit, key, fallback = 0) => clamp(Number.isFinite(unit[key]) ? unit[key] : fallback, 0, key === 'experienceLevel' ? 10 : 100);
function safeKey(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 100 && !/[<>\x00-\x1f]/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
}
function number(value, low, high, message) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high) fail(message);
}
function rollValue(value) {number(value, 0, 1, 'La tirada de interacción no es válida.'); return value;}
const trapKnown = (unit, target) => Boolean(target.trap?.discoveredBy?.includes(unit.side ?? 'player'));
const isArmed = target => Boolean(target.trap && target.trap.armed !== false);
export const breachableWall = target => Boolean(target?.type === 'wall' && target.blocked === true &&
  ['adobe', 'wood'].includes(target.material) && (target.tacticalLevel ?? 0) === 0 && !['floor', 'roof'].includes(target.kind));

export function validateEnvironment(target) {
  if (!object(target) || !['door', 'chest', 'container'].includes(target.type)) fail('El objeto del entorno no es válido.');
  for (const key of ['open', 'locked', 'broken']) if (target[key] !== undefined && typeof target[key] !== 'boolean') fail('El estado del cierre no es válido.');
  for (const key of ['keyId']) if (target[key] !== undefined && !safeKey(target[key])) fail('La identificación de la llave no es válida.');
  for (const key of ['lockDifficulty', 'lockIntegrity']) if (target[key] !== undefined) number(target[key], 0, 100, 'La resistencia del cierre no es válida.');
  if (target.open && target.locked || target.broken && target.locked) fail('El cierre tiene estados incompatibles.');
  if (target.trap !== undefined) {
    const trap = target.trap;
    if (!object(trap) || !['alarm', 'injury'].includes(trap.type)) fail('La trampa no es válida.');
    number(trap.difficulty, 0, 100, 'La dificultad de la trampa no es válida.');
    if (trap.armed !== undefined && typeof trap.armed !== 'boolean') fail('El estado de la trampa no es válido.');
    if (trap.discoveredBy !== undefined && (!Array.isArray(trap.discoveredBy) || new Set(trap.discoveredBy).size !== trap.discoveredBy.length || trap.discoveredBy.some(side => !SIDES.includes(side)))) fail('El conocimiento de la trampa no es válido.');
    for (const key of ['damage', 'breathLoss']) if (trap[key] !== undefined) number(trap[key], 0, 100, 'El efecto de la trampa no es válido.');
  }
  if (target.contents !== undefined) {
    if (!Array.isArray(target.contents) || target.contents.length > 1000) fail('El contenido del recipiente no es válido.');
    const identities = new Set();
    for (const stack of target.contents) {
      validateItemStack(stack);
      if (stack.instanceId !== undefined) {
        if (identities.has(stack.instanceId)) fail('El recipiente contiene un objeto identificado repetido.');
        identities.add(stack.instanceId);
      }
    }
  }
  return true;
}

export function heldTool(unit) {
  if (unit.activeSlot !== 'tool' || typeof unit.activeTool !== 'string' || !unit.activeTool.startsWith('inventory:')) return null;
  const key = unit.activeTool.slice(10);
  if (!safeKey(key) || !object(unit.inventory) || !Object.hasOwn(unit.inventory, key)) return null;
  const record = unit.inventory[key];
  if (!object(record) || !Number.isSafeInteger(record.count) || record.count < 1 || record.weapon !== undefined || !Object.hasOwn(TOOL_TYPES, record.toolKey) || !(record.itemType === 'tool' || record.kind === 'tool')) return null;
  const condition = record.condition ?? 100;
  if (!Number.isFinite(condition) || condition < 0 || condition > 100 || record.keyId !== undefined && !safeKey(record.keyId)) return null;
  return {...TOOL_TYPES[record.toolKey], item: unit.activeTool, inventoryKey: key, condition, ...(record.keyId === undefined ? {} : {keyId: record.keyId})};
}
export function heldToolWearReason(unit) {
  const tool = heldTool(unit);
  return tool && unit.inventory[tool.inventoryKey].count > 1 && Object.keys(unit.inventory).length >= 1000
    ? 'No hay espacio para separar la herramienta usada de las herramientas sin desgaste.' : null;
}

export function environmentActionProfile(unit, target, verb) {
  const wall = target?.kind === 'wall' || target?.type === 'wall';
  const result = {verb, label: LABELS[verb] ?? 'Interactuar', pa: verb === 'breach' ? hasCharacterAbility(unit, 'breaching') ? 25 : 45 : COSTS[verb] ?? 0, chance: null, requiresRoll: false, valid: false, reason: null,
    ...(verb === 'breach' ? {toolWear: TOOL_TYPES.crowbar.wear} : {})};
  const reject = reason => ({...result, reason});
  if (wall || verb === 'breach') {
    if (verb !== 'breach' || !breachableWall(target)) return reject('La brecha manual requiere una pared de adobe o una barricada de madera al nivel del suelo.');
    if ((unit.tacticalLevel ?? 0) !== 0) return reject('La brecha manual requiere trabajar al nivel del suelo.');
    if (unit.bound || unit.entangled || unit.mounted) return reject('El combatiente debe estar libre y desmontado para abrir la brecha.');
  } else try {validateEnvironment(target);} catch (error) {return reject(error.message);}
  if (!ENVIRONMENT_VERBS.includes(verb)) return reject('Seleccioná una acción del entorno.');
  if (unit.hp !== undefined && unit.hp < 15 || unit.energy !== undefined && unit.energy <= 0 || unit.departure || unit.surrendered || unit.routed || unit.knockedDown) return reject('El combatiente no puede manipular el objeto.');
  if (verb === 'open' && target.open) return reject('El objeto ya está abierto.');
  if (verb === 'close' && !target.open) return reject('El objeto ya está cerrado.');
  if (verb === 'open' && target.locked) return reject('El objeto está cerrado con llave.');
  if (['unlock', 'pick', 'pry', 'force'].includes(verb) && !target.locked) return reject('El cierre ya está desbloqueado.');
  // Unknown traps and absent traps expose exactly the same disarm preview.
  if (verb === 'disarm' && (!trapKnown(unit, target) || !isArmed(target))) return reject('No hay una trampa identificada para desarmar.');
  const tool = heldTool(unit), required = REQUIRED[verb];
  if (required && tool?.toolKey !== required) return reject(`Llevá ${TOOL_TYPES[required].label.toLowerCase()} en la mano.`);
  if (required && tool.condition <= 0) return reject('La herramienta está rota.');
  if (verb === 'breach') {
    const wearReason = heldToolWearReason(unit);
    return wearReason ? reject(wearReason) : {...result, valid: true, chance: 100};
  }
  if (verb === 'unlock' && (!target.keyId || tool.keyId !== target.keyId)) return reject('La llave no corresponde a este cierre.');
  const mechanical = stat(unit, 'mechanical'), dexterity = stat(unit, 'dexterity', 50), strength = stat(unit, 'strength', 50), experience = stat(unit, 'experienceLevel', 1);
  const difficulty = target.lockDifficulty ?? 35, wearPenalty = (100 - (tool?.condition ?? 100)) * .25;
  if (verb === 'pick') {
    result.chance = mechanical <= 0 ? 0 : clamp(Math.round(mechanical * .7 + dexterity * .2 + experience * 2 + ((unit.traits ?? []).includes('lockpicking') ? 15 : 0) - difficulty * .75 - wearPenalty), 0, 95);
  } else if (verb === 'pry') result.chance = clamp(Math.round(strength * .75 + mechanical * .2 + 10 - difficulty * .65 - wearPenalty), 5, 95);
  else if (verb === 'force') result.chance = clamp(Math.round(strength * .9 - difficulty * .7), 5, 90);
  else if (verb === 'disarm') result.chance = mechanical <= 0 ? 0 : clamp(Math.round(mechanical * .55 + dexterity * .25 + experience * 2 + stat(unit, 'wisdom', 50) * .15 - target.trap.difficulty * .85 - wearPenalty), 0, 95);
  else if (verb !== 'inspect') result.chance = 100;
  if (result.chance === 0) return reject('La habilidad y la herramienta no alcanzan para este trabajo.');
  result.requiresRoll = ['inspect', 'pick', 'pry', 'force', 'disarm'].includes(verb);
  return {...result, valid: true};
}

function wornTool(unit, wear) {
  const tool = heldTool(unit);
  if (!tool || !wear) return;
  let key = tool.inventoryKey, record = unit.inventory[key];
  // Old stacked tools remain conserved: only the selected tool is worn.
  if (record.count > 1) {
    record.count--;
    const stem = key.slice(0, 88); let index = 1;
    while (Object.hasOwn(unit.inventory, `${stem}:${index}`)) index++;
    key = `${stem}:${index}`;
    unit.inventory[key] = {...structuredClone(record), count: 1};
    unit.activeTool = `inventory:${key}`;
    record = unit.inventory[key];
  }
  record.condition = Math.max(0, tool.condition - wear);
}
function discover(target, side) {
  target.trap.discoveredBy ??= [];
  if (!target.trap.discoveredBy.includes(side)) target.trap.discoveredBy.push(side);
}
function trigger(result, side) {
  const trap = result.target.trap;
  trap.armed = false; discover(result.target, side);
  result.success = false; result.trapTriggered = true;
  result.outcome = trap.type === 'alarm' ? 'alarm-triggered' : 'injury-triggered';
  result.message = trap.type === 'alarm' ? 'El alambre hace sonar una alarma.' : 'La trampa hiere al combatiente.';
  result.noiseKind = trap.type === 'alarm' ? 'alarm' : 'melee';
  result.damage = trap.type === 'injury' ? trap.damage ?? 18 : 0;
  result.breathLoss = trap.type === 'injury' ? trap.breathLoss ?? 25 : 0;
}

// Pure resolution. The caller validates reach/AP, supplies one deterministic
// roll when required, and applies returned costs, practice, noise and injuries.
export function resolveEnvironmentInteraction(unit, target, {verb, roll} = {}) {
  const profile = environmentActionProfile(unit, target, verb);
  if (!profile.valid) fail(profile.reason);
  if (profile.requiresRoll) rollValue(roll);
  const result = {unit: structuredClone(unit), target: structuredClone(target), pa: profile.pa, success: false, outcome: 'failed', message: 'El intento falla.', noiseKind: null, damage: 0, breathLoss: 0, practice: {}, trapTriggered: false};
  const next = result.target, side = SIDES.includes(unit.side) ? unit.side : 'player';
  const success = !profile.requiresRoll || roll * 100 < profile.chance;
  const tool = heldTool(unit);
  if (REQUIRED[verb]) wornTool(result.unit, tool.wear);
  if (verb === 'breach') {
    Object.assign(next, {blocked: false, blocksSight: false, type: 'rubble', cover: 15});
    delete next.obstacleHeight; delete next.projectileResistance;
    return {...result, success: true, outcome: 'wall-breached', message: 'Abre una brecha con la barreta.', noiseKind: 'melee'};
  }
  if (['pick', 'pry', 'disarm'].includes(verb)) result.practice.mechanical = 1;
  if (verb === 'inspect') {
    const chance = clamp(Math.round(stat(unit, 'experienceLevel', 1) * 5 + stat(unit, 'wisdom', 50) * .5 + stat(unit, 'dexterity', 50) * .1 - (next.trap?.difficulty ?? 0) * .7), 5, 95);
    if (isArmed(next) && (trapKnown(unit, next) || roll * 100 < chance)) {
      discover(next, side); result.success = true; result.outcome = 'trap-found'; result.message = 'Identifica una trampa en el cierre.';
    } else {result.outcome = 'nothing-detected'; result.message = 'No detecta una trampa.';}
    return result;
  }
  if (verb === 'disarm') {
    if (!success) trigger(result, side);
    else {next.trap.armed = false; result.success = true; result.outcome = 'disarmed'; result.message = 'Desarma la trampa.'; result.practice.mechanical = 2;}
    return result;
  }
  if (verb !== 'close' && isArmed(next)) {trigger(result, side); return result;}
  result.noiseKind = ['pry', 'force'].includes(verb) ? 'melee' : verb === 'pick' ? null : 'door';
  if (verb === 'open' || verb === 'close') {
    next.open = verb === 'open'; result.success = true; result.outcome = next.open ? 'opened' : 'closed'; result.message = next.open ? 'Abre el objeto.' : 'Cierra el objeto.';
  } else if (verb === 'unlock' || verb === 'pick' && success) {
    next.locked = false; result.success = true; result.outcome = 'unlocked'; result.message = 'Desbloquea el cierre.';
    if (verb === 'pick') result.practice.mechanical = 2;
  } else if (['pry', 'force'].includes(verb) && success) {
    const damage = Math.round((verb === 'pry' ? 35 : 20) + stat(unit, 'strength', 50) * (verb === 'pry' ? .45 : .3));
    next.lockIntegrity = Math.max(0, (next.lockIntegrity ?? 100) - damage);
    result.success = true;
    if (!next.lockIntegrity) {next.locked = false; next.broken = true; result.outcome = 'lock-broken'; result.message = 'Rompe el cierre.';}
    else {result.outcome = 'lock-damaged'; result.message = 'El cierre cede, pero sigue trabado.';}
  }
  // A door's collision is derived from its resulting open state. Chest
  // geometry remains the caller's responsibility and is never removed here.
  if (next.type === 'door') {next.blocked = !next.open; next.blocksSight = !next.open;}
  return result;
}

export function visibleContainerContents(target) {
  validateEnvironment(target);
  return target.open ? structuredClone(target.contents ?? []) : [];
}
export function environmentTargetSummary(unit, target) {
  if (breachableWall(target)) return {id: target.id ?? `wall:${target.x}:${target.y}`, type: 'wall', label: target.material === 'wood' ? 'Barricada de madera' : 'Pared de adobe', material: target.material, broken: false};
  validateEnvironment(target);
  const summary = {id: target.id ?? target.doorId, type: target.type, label: target.type === 'door' ? 'Puerta' : 'Cofre', open: Boolean(target.open), locked: Boolean(target.locked), broken: Boolean(target.broken)};
  if (trapKnown(unit, target)) summary.trap = {type: target.trap.type, armed: isArmed(target)};
  if (target.open) summary.contents = visibleContainerContents(target);
  return summary;
}
export function extractContainerItem(target, index, count = 1) {
  validateEnvironment(target);
  if (!target.open) fail('Abrí el recipiente antes de retirar objetos.');
  if (!Number.isSafeInteger(index) || index < 0 || index >= (target.contents?.length ?? 0)) fail('Ese objeto ya no está en el recipiente.');
  if (!Number.isSafeInteger(count) || count < 1 || count > target.contents[index].count) fail('No queda esa cantidad en el recipiente.');
  const next = structuredClone(target), stack = {...structuredClone(next.contents[index]), count};
  next.contents[index].count -= count;
  if (!next.contents[index].count) next.contents.splice(index, 1);
  return {target: next, stack};
}

// Fresh-map logical metadata only. Call once for a new sector, then persist
// the resulting objects. These caches reuse existing furniture and doors.
export function authoredEnvironment(sector, map) {
  const doors = [], containers = [];
  const cache=finiteSectorCache(sector,map);if(cache)containers.push(cache);
  const hasChest = id => (map.props ?? []).some(prop => prop.type === 'chest' && prop.id === id);
  const tool = (toolKey, keyId) => ({item: `inventory:${toolKey}`, count: 1, weight: TOOL_TYPES[toolKey].weight, itemType: 'tool', toolKey, condition: 100, ...(keyId ? {keyId} : {})});
  if (sector === 'yatasto') {
    const id = 'yatasto:building:chest:11:8';
    if (hasChest(id)) containers.push({id, type: 'chest', open: false, locked: false, contents: [tool('lockpick'), tool('crowbar'), tool('pliers'), tool('key', 'yatasto-store')]});
    const door = (map.tiles ?? []).find(tile => tile.doorId === 'yatasto:door-right');
    if (door) doors.push({id: door.doorId, type: 'door', open: false, locked: true, keyId: 'yatasto-store', lockDifficulty: 25, lockIntegrity: 100});
  }
  if (sector === 'mendoza') {
    // Room dimensions and furniture positions can change; the supply cache keeps its role.
    const chest = (map.props ?? []).find(prop => prop.type === 'chest' && prop.buildingId === 'mendoza:house-0' && prop.purpose === 'supply-cache');
    if (chest) containers.push({id: chest.id, type: 'chest', open: false, locked: true, lockDifficulty: 40, lockIntegrity: 100,
      trap: {type: 'alarm', difficulty: 35, armed: true, discoveredBy: []}, contents: [{item:'inventory:ammo:musket_75',kind:'ammunition',ammoType:'musket_75',name:AMMUNITION_TYPES.musket_75.name,count:12,weight:.04}, {item: 'medkits', count: 3, weight: .2}]});
  }
  return {doors, containers};
}
