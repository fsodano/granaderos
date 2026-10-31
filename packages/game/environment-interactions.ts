import { assertEnvironmentRecord, readAuthoredEnvironment } from './environment-values.ts';
import type { BattleProp, BattleTile } from './public/compatibility-types.ts';
import type { CampaignContent, RoadsideDiscovery } from '../campaign-format/types.ts';
import { validateRoadsideDiscoveries } from '../campaign-format/roadside-discovery-schema.js';
import type { CampaignContext } from './public/compatibility-types.ts';
import type {
  EnvironmentVerb,
  ToolKey,
  ToolDefinition,
  HeldTool,
  EnvironmentItem,
  EnvironmentRecord,
  EnvironmentActor,
  EnvironmentActionProfile,
  EnvironmentInteractionResult,
  EnvironmentSummary,
} from './public/environment-types.ts';
import { takeStoredItemQuantity } from './tactical-inventory.js';
import { finiteSectorCache } from './finite-sector-caches.js';
import { finiteEnvironmentFor } from './campaign-physical.js';
import { hasCharacterAbility } from './character-abilities.js';
import { makeOutfit } from './outfits.ts';
import { destroyStructure } from './structure-blast.js';
import { wallEdgeId, wallEdgeBlocksMovement } from './wall-geometry.js';
import { roadsideDiscoveryForMap, roadsideDiscoveryIds } from './roadside-discoveries.js';

// Classic JA2 manual, printed pp. 25–27: held tools, keys, lock picks,
// crowbars, force, uncertain examination, disarming, and finite containers.
// Patusco pp. 22, 26, 64: mechanical skill, experience, lock-picking traits,
// and strength with a crowbar. Costs, chances, wear, and nonexplosive trap
// effects below are explicit Granaderos tuning on its 100-AP scale.
const toolRows: readonly (readonly [ToolKey, string, number, EnvironmentVerb, number, number])[] = [
  ['key', 'Llave', 0.2, 'unlock', 4, 0],
  ['lockpick', 'Ganzúas', 0.4, 'pick', 16, 2],
  ['crowbar', 'Barreta', 2.5, 'pry', 20, 3],
  ['pliers', 'Alicates', 0.5, 'disarm', 18, 2],
];
export const TOOL_TYPES: Readonly<Record<ToolKey, ToolDefinition>> = {
  key: tool('key'),
  lockpick: tool('lockpick'),
  crowbar: tool('crowbar'),
  pliers: tool('pliers'),
};
function tool(key: ToolKey): ToolDefinition {
  const row = toolRows.find((row) => row[0] === key);
  if (!row) {
    throw Error(`Missing tool definition: ${key}`);
  }
  const [toolKey, label, weight, verb, pa, wear] = row;
  return Object.freeze({ toolKey, label, name: label, weight, verb, pa, wear });
}

export const ENVIRONMENT_VERBS = Object.freeze([
  'inspect',
  'open',
  'close',
  'unlock',
  'pick',
  'pry',
  'force',
  'disarm',
  'breach',
]);
const LABELS: Readonly<Record<string, string>> = Object.freeze({
  inspect: 'Examinar',
  open: 'Abrir',
  close: 'Cerrar',
  unlock: 'Usar llave',
  pick: 'Forzar con ganzúas',
  pry: 'Hacer palanca',
  force: 'Forzar a golpes',
  disarm: 'Desarmar trampa',
  breach: 'Abrir brecha con barreta',
});
const COSTS: Readonly<Record<string, number>> = Object.freeze({
  inspect: 4,
  open: 4,
  close: 4,
  unlock: 4,
  pick: 16,
  pry: 20,
  force: 24,
  disarm: 18,
});
const REQUIRED: Readonly<Partial<Record<string, ToolKey>>> = Object.freeze({
  unlock: 'key',
  pick: 'lockpick',
  pry: 'crowbar',
  disarm: 'pliers',
  breach: 'crowbar',
});
const SIDES = ['player', 'enemy', 'neutral'];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
function fail(reason: string): never {
  throw new Error(reason);
}
const stat = (
  unit: EnvironmentActor,
  key: 'mechanical' | 'dexterity' | 'strength' | 'experienceLevel' | 'wisdom',
  fallback = 0,
) =>
  clamp(
    typeof unit[key] === 'number' && Number.isFinite(unit[key]) ? unit[key] : fallback,
    0,
    key === 'experienceLevel' ? 10 : 100,
  );
function safeKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 100 &&
    !/[<>]/.test(value) &&
    value.split('').every((character) => character.charCodeAt(0) > 31) &&
    !['__proto__', 'constructor', 'prototype'].includes(value)
  );
}
function number(
  value: unknown,
  low: number,
  high: number,
  message: string,
): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high) {
    fail(message);
  }
}
function rollValue(value: unknown): number {
  number(value, 0, 1, 'La tirada de interacción no es válida.');
  return value;
}
const trapKnown = (unit: EnvironmentActor, target: EnvironmentRecord) =>
  Boolean(target.trap?.discoveredBy?.includes(unit.side ?? 'player'));
const isArmed = (target: EnvironmentRecord) => Boolean(target.trap && target.trap.armed !== false);
export const breachableWall = (target: EnvironmentRecord | null | undefined) =>
  Boolean(
    target?.type === 'wall' &&
    (target.axis ? wallEdgeBlocksMovement(target) : target.blocked === true) &&
    ['adobe', 'wood'].includes(target.material ?? '') &&
    (target.tacticalLevel ?? 0) === 0 &&
    !['floor', 'roof'].includes(target.kind ?? ''),
  );

export function validateEnvironment(target: unknown) {
  assertEnvironmentRecord(target);
  return true;
}

export function heldTool(unit: EnvironmentActor): HeldTool | null {
  if (
    unit.activeSlot !== 'tool' ||
    typeof unit.activeTool !== 'string' ||
    !unit.activeTool.startsWith('inventory:')
  ) {
    return null;
  }
  const key = unit.activeTool.slice(10),
    inventory = unit.inventory;
  if (!safeKey(key) || !inventory || !Object.hasOwn(inventory, key)) {
    return null;
  }
  const record = inventory[key];
  if (
    !record ||
    typeof record === 'number' ||
    record.count === undefined ||
    !Number.isSafeInteger(record.count) ||
    record.count < 1 ||
    record.weapon !== undefined ||
    !isToolKey(record.toolKey) ||
    !(record.itemType === 'tool' || record.kind === 'tool')
  ) {
    return null;
  }
  const condition = record.condition ?? 100;
  if (
    !Number.isFinite(condition) ||
    condition < 0 ||
    condition > 100 ||
    (record.keyId !== undefined && !safeKey(record.keyId))
  ) {
    return null;
  }
  return {
    ...TOOL_TYPES[record.toolKey],
    item: unit.activeTool,
    inventoryKey: key,
    condition,
    ...(record.keyId === undefined ? {} : { keyId: record.keyId }),
  };
}
export function heldToolWearReason(unit: EnvironmentActor) {
  const tool = heldTool(unit);
  const stored = tool ? unit.inventory?.[tool.inventoryKey] : undefined;
  const count = typeof stored === 'number' ? stored : (stored?.count ?? 0);
  return tool &&
    tool.wear > 0 &&
    tool.condition > 0 &&
    count > 1 &&
    Object.keys(unit.inventory ?? {}).length >= 1000
    ? 'No hay espacio para separar la herramienta usada de las herramientas sin desgaste.'
    : null;
}

export function environmentActionProfile(
  unit: EnvironmentActor,
  target: EnvironmentRecord,
  verb: string,
): EnvironmentActionProfile {
  const wall = target?.kind === 'wall' || target?.type === 'wall';
  const result: EnvironmentActionProfile = {
    verb,
    label: LABELS[verb] ?? 'Interactuar',
    pa: verb === 'breach' ? (hasCharacterAbility(unit, 'breaching') ? 25 : 45) : (COSTS[verb] ?? 0),
    chance: null,
    requiresRoll: false,
    valid: false,
    reason: null,
    ...(verb === 'breach' ? { toolWear: TOOL_TYPES.crowbar.wear } : {}),
  };
  const reject = (reason: string) => ({ ...result, reason });
  if (wall || verb === 'breach') {
    if (verb !== 'breach' || !breachableWall(target)) {
      return reject(
        'La brecha manual requiere una pared de adobe o una barricada de madera al nivel del suelo.',
      );
    }
    if ((unit.tacticalLevel ?? 0) !== 0) {
      return reject('La brecha manual requiere trabajar al nivel del suelo.');
    }
    if (unit.bound || unit.entangled || unit.mounted) {
      return reject('El combatiente debe estar libre y desmontado para abrir la brecha.');
    }
  } else {
    try {
      validateEnvironment(target);
    } catch (error) {
      return reject(error instanceof Error ? error.message : String(error));
    }
  }
  if (!ENVIRONMENT_VERBS.includes(verb)) {
    return reject('Seleccioná una acción del entorno.');
  }
  if (target.destroyed && verb !== 'inspect') {
    return reject('La explosión destruyó el objeto. Sus restos quedan abiertos.');
  }
  if (
    (unit.hp !== undefined && unit.hp < 15) ||
    (unit.energy !== undefined && unit.energy <= 0) ||
    unit.departure ||
    unit.surrendered ||
    unit.routed ||
    unit.knockedDown
  ) {
    return reject('El combatiente no puede manipular el objeto.');
  }
  if (verb === 'open' && target.open) {
    return reject('El objeto ya está abierto.');
  }
  if (verb === 'close' && !target.open) {
    return reject('El objeto ya está cerrado.');
  }
  if (verb === 'open' && target.locked) {
    return reject('El objeto está cerrado con llave.');
  }
  if (['unlock', 'pick', 'pry', 'force'].includes(verb) && !target.locked) {
    return reject('El cierre ya está desbloqueado.');
  }
  // Unknown traps and absent traps expose exactly the same disarm preview.
  if (verb === 'disarm' && (!trapKnown(unit, target) || !isArmed(target))) {
    return reject('No hay una trampa identificada para desarmar.');
  }
  const tool = heldTool(unit),
    required = REQUIRED[verb];
  if (required && tool?.toolKey !== required) {
    return reject(`Llevá ${TOOL_TYPES[required].label.toLowerCase()} en la mano.`);
  }
  if (required && tool && tool.condition <= 0) {
    return reject('La herramienta está rota.');
  }
  if (required) {
    const wearReason = heldToolWearReason(unit);
    if (wearReason) {
      return reject(wearReason);
    }
  }
  if (verb === 'breach') {
    return { ...result, valid: true, chance: 100 };
  }
  if (verb === 'unlock' && (!target.keyId || tool?.keyId !== target.keyId)) {
    return reject('La llave no corresponde a este cierre.');
  }
  const mechanical = stat(unit, 'mechanical'),
    dexterity = stat(unit, 'dexterity', 50),
    strength = stat(unit, 'strength', 50),
    experience = stat(unit, 'experienceLevel', 1);
  const difficulty = target.lockDifficulty ?? 35,
    wearPenalty = (100 - (tool?.condition ?? 100)) * 0.25;
  if (verb === 'pick') {
    result.chance =
      mechanical <= 0
        ? 0
        : clamp(
            Math.round(
              mechanical * 0.7 +
                dexterity * 0.2 +
                experience * 2 +
                ((unit.traits ?? []).includes('lockpicking') ? 15 : 0) -
                difficulty * 0.75 -
                wearPenalty,
            ),
            0,
            95,
          );
  } else if (verb === 'pry') {
    result.chance = clamp(
      Math.round(strength * 0.75 + mechanical * 0.2 + 10 - difficulty * 0.65 - wearPenalty),
      5,
      95,
    );
  } else if (verb === 'force') {
    result.chance = clamp(Math.round(strength * 0.9 - difficulty * 0.7), 5, 90);
  } else if (verb === 'disarm') {
    result.chance =
      mechanical <= 0
        ? 0
        : clamp(
            Math.round(
              mechanical * 0.55 +
                dexterity * 0.25 +
                experience * 2 +
                stat(unit, 'wisdom', 50) * 0.15 -
                requireTrap(target).difficulty * 0.85 -
                wearPenalty,
            ),
            0,
            95,
          );
  } else if (verb !== 'inspect') {
    result.chance = 100;
  }
  if (result.chance === 0) {
    return reject('La habilidad y la herramienta no alcanzan para este trabajo.');
  }
  result.requiresRoll = ['inspect', 'pick', 'pry', 'force', 'disarm'].includes(verb);
  return { ...result, valid: true };
}

function wornTool(unit: EnvironmentActor, wear: number) {
  const tool = heldTool(unit);
  if (!tool || !wear) {
    return;
  }
  const inventory = unit.inventory;
  if (!inventory) {
    throw Error('Missing held tool inventory');
  }
  let key = tool.inventoryKey,
    record = inventory[key];
  if (!record || typeof record === 'number') {
    throw Error('Missing held tool record');
  }
  // Old stacked tools remain conserved: only the selected tool is worn.
  if ((record.count ?? 0) > 1) {
    record.count = (record.count ?? 0) - 1;
    const stem = key.slice(0, 88);
    let index = 1;
    while (Object.hasOwn(inventory, `${stem}:${index}`)) {
      index++;
    }
    key = `${stem}:${index}`;
    inventory[key] = { ...structuredClone(record), count: 1 };
    unit.activeTool = `inventory:${key}`;
    record = inventory[key];
    if (!record || typeof record === 'number') {
      throw Error('Missing separated tool');
    }
  }
  record.condition = Math.max(0, tool.condition - wear);
}
function discover(target: EnvironmentRecord, side: string) {
  const trap = requireTrap(target);
  trap.discoveredBy ??= [];
  if (!trap.discoveredBy.includes(side)) {
    trap.discoveredBy.push(side);
  }
}
function trigger(
  result: EnvironmentInteractionResult<EnvironmentActor, EnvironmentRecord>,
  side: string,
) {
  const trap = requireTrap(result.target);
  trap.armed = false;
  discover(result.target, side);
  result.success = false;
  result.trapTriggered = true;
  result.outcome = trap.type === 'alarm' ? 'alarm-triggered' : 'injury-triggered';
  result.message =
    trap.type === 'alarm' ? 'El alambre hace sonar una alarma.' : 'La trampa hiere al combatiente.';
  result.noiseKind = trap.type === 'alarm' ? 'alarm' : 'melee';
  result.damage = trap.type === 'injury' ? (trap.damage ?? 18) : 0;
  result.breathLoss = trap.type === 'injury' ? (trap.breathLoss ?? 25) : 0;
}

// Pure resolution. The caller validates reach/AP, supplies one deterministic
// roll when required, and applies returned costs, practice, noise and injuries.
export function resolveEnvironmentInteraction<
  Unit extends EnvironmentActor,
  Target extends EnvironmentRecord,
>(
  unit: Unit,
  target: Target,
  { verb = '', roll }: { verb?: string; roll?: number } = {},
): EnvironmentInteractionResult<Unit, Target> {
  const profile = environmentActionProfile(unit, target, verb);
  if (!profile.valid) {
    fail(profile.reason ?? 'La interacción no es válida.');
  }
  if (profile.requiresRoll) {
    rollValue(roll);
  }
  const result: EnvironmentInteractionResult<Unit, Target> = {
    unit: structuredClone(unit),
    target: structuredClone(target),
    pa: profile.pa,
    success: false,
    outcome: 'failed',
    message: 'El intento falla.',
    noiseKind: null,
    damage: 0,
    breathLoss: 0,
    practice: {},
    trapTriggered: false,
  };
  const next = result.target,
    side = SIDES.includes(unit.side ?? '') ? (unit.side ?? 'player') : 'player';
  const success = !profile.requiresRoll || (roll ?? 0) * 100 < (profile.chance ?? 0);
  const tool = heldTool(unit);
  if (REQUIRED[verb] && tool) {
    wornTool(result.unit, tool.wear);
  }
  if (verb === 'breach') {
    Object.assign(next, { blocked: false, blocksSight: false, type: 'rubble', cover: 15 });
    if (next.structureDamage !== undefined || next.axis) {
      destroyStructure(next, next.axis ? 'edge' : 'surface');
    }
    delete next.obstacleHeight;
    delete next.projectileResistance;
    return {
      ...result,
      success: true,
      outcome: 'wall-breached',
      message: 'Abre una brecha con la barreta.',
      noiseKind: 'melee',
    };
  }
  if (['pick', 'pry', 'disarm'].includes(verb)) {
    result.practice.mechanical = 1;
  }
  if (verb === 'inspect') {
    const chance = clamp(
      Math.round(
        stat(unit, 'experienceLevel', 1) * 5 +
          stat(unit, 'wisdom', 50) * 0.5 +
          stat(unit, 'dexterity', 50) * 0.1 -
          (next.trap?.difficulty ?? 0) * 0.7,
      ),
      5,
      95,
    );
    if (isArmed(next) && (trapKnown(unit, next) || (roll ?? 0) * 100 < chance)) {
      discover(next, side);
      result.success = true;
      result.outcome = 'trap-found';
      result.message = 'Identifica una trampa en el cierre.';
    } else {
      result.outcome = 'nothing-detected';
      result.message = 'No detecta una trampa.';
    }
    return result;
  }
  if (verb === 'disarm') {
    if (!success) {
      trigger(result, side);
    } else {
      requireTrap(next).armed = false;
      result.success = true;
      result.outcome = 'disarmed';
      result.message = 'Desarma la trampa.';
      result.practice.mechanical = 2;
    }
    return result;
  }
  if (verb !== 'close' && isArmed(next)) {
    trigger(result, side);
    return result;
  }
  result.noiseKind = ['pry', 'force'].includes(verb) ? 'melee' : verb === 'pick' ? null : 'door';
  if (verb === 'open' || verb === 'close') {
    next.open = verb === 'open';
    result.success = true;
    result.outcome = next.open ? 'opened' : 'closed';
    result.message = next.open ? 'Abre el objeto.' : 'Cierra el objeto.';
  } else if (verb === 'unlock' || (verb === 'pick' && success)) {
    next.locked = false;
    result.success = true;
    result.outcome = 'unlocked';
    result.message = 'Desbloquea el cierre.';
    if (verb === 'pick') {
      result.practice.mechanical = 2;
    }
  } else if (['pry', 'force'].includes(verb) && success) {
    const damage = Math.round(
      (verb === 'pry' ? 35 : 20) + stat(unit, 'strength', 50) * (verb === 'pry' ? 0.45 : 0.3),
    );
    next.lockIntegrity = Math.max(0, (next.lockIntegrity ?? 100) - damage);
    result.success = true;
    if (!next.lockIntegrity) {
      next.locked = false;
      next.broken = true;
      result.outcome = 'lock-broken';
      result.message = 'Rompe el cierre.';
    } else {
      result.outcome = 'lock-damaged';
      result.message = 'El cierre cede, pero sigue trabado.';
    }
  }
  // A door's collision is derived from its resulting open state. Chest
  // geometry remains the caller's responsibility and is never removed here.
  if (next.type === 'door') {
    next.blocked = !next.open;
    next.blocksSight = !next.open;
  }
  return result;
}

export function visibleContainerContents(target: EnvironmentRecord): EnvironmentItem[] {
  validateEnvironment(target);
  return target.open ? structuredClone(target.contents ?? []) : [];
}
export function environmentTargetSummary(
  unit: EnvironmentActor,
  target: EnvironmentRecord,
): EnvironmentSummary {
  if (breachableWall(target)) {
    return {
      id: target.axis ? wallEdgeId(target) : (target.id ?? `wall:${target.x}:${target.y}`),
      type: 'wall',
      label: target.material === 'wood' ? 'Barricada de madera' : 'Pared de adobe',
      material: target.material,
      broken: false,
    };
  }
  validateEnvironment(target);
  const summary: EnvironmentSummary = {
    id: target.id ?? target.doorId,
    type: target.type,
    label: target.type === 'door' ? 'Puerta' : 'Cofre',
    open: Boolean(target.open),
    locked: Boolean(target.locked),
    broken: Boolean(target.broken),
  };
  if (target.structureDamage !== undefined) {
    summary.structureDamage = target.structureDamage;
  }
  if (target.destroyed !== undefined) {
    summary.destroyed = target.destroyed;
  }
  if (trapKnown(unit, target)) {
    summary.trap = { type: requireTrap(target).type, armed: isArmed(target) };
  }
  if (target.open) {
    summary.contents = visibleContainerContents(target);
  }
  return summary;
}
export function extractContainerItem<Target extends EnvironmentRecord>(
  target: Target,
  index: number,
  count = 1,
) {
  validateEnvironment(target);
  if (!target.open) {
    fail('Abrí el recipiente antes de retirar objetos.');
  }
  if (!Number.isSafeInteger(index) || index < 0 || index >= (target.contents?.length ?? 0)) {
    fail('Ese objeto ya no está en el recipiente.');
  }
  const source = target.contents?.[index];
  if (!source) {
    fail('Ese objeto ya no está en el recipiente.');
  }
  if (!Number.isSafeInteger(count) || count < 1 || count > source.count) {
    fail('No queda esa cantidad en el recipiente.');
  }
  const next = structuredClone(target),
    contents = next.contents,
    entry = contents?.[index];
  if (!contents || !entry) {
    throw Error('Missing admitted container item');
  }
  const { stack, remaining } = takeStoredItemQuantity(entry, count);
  entry.count = remaining;
  if (!entry.count) {
    contents.splice(index, 1);
  }
  return { target: next, stack };
}

// Fresh-map logical metadata only. Call once for a new sector, then persist
// the resulting objects. These caches reuse existing furniture and doors.
export function authoredEnvironment(
  sector: string,
  map: {
    props?: readonly BattleProp[];
    wallEdges?: readonly BattleTile[];
    tiles?: readonly BattleTile[];
    roadsideDiscoveryDefinitions?: RoadsideDiscovery[];
    campaignPackage?: CampaignContent;
  },
  context: CampaignContext = map,
) {
  const doors: EnvironmentRecord[] = [],
    containers: EnvironmentRecord[] = [];
  const cache: unknown = finiteSectorCache(sector, map, context);
  if (cache) {
    assertEnvironmentRecord(cache);
    containers.push(cache);
  }
  const tool = (toolKey: ToolKey, keyId?: string) => ({
    item: `inventory:${toolKey}`,
    count: 1,
    weight: TOOL_TYPES[toolKey].weight,
    itemType: 'tool',
    toolKey,
    condition: 100,
    ...(keyId ? { keyId } : {}),
  });
  const roadside: unknown = roadsideDiscoveryForMap(sector, map);
  if (roadside) {
    assertRoadside(roadside);
    containers.push({
      id: roadsideDiscoveryIds(roadside).chest,
      type: 'chest',
      open: false,
      locked: false,
      contents: [
        {
          ...tool('crowbar'),
          condition: roadside.crowbarCondition,
          instanceId: roadsideDiscoveryIds(roadside).crowbar,
        },
        {
          item: 'inventory:linen-shirt:roadside',
          ...makeOutfit('linen_shirt', roadside.linenShirtCondition),
          instanceId: roadsideDiscoveryIds(roadside).shirt,
        },
      ],
    });
  }
  const authored = readAuthoredEnvironment(finiteEnvironmentFor(context))[sector];
  for (const configuration of authored?.doors ?? []) {
    const door = [...(map.wallEdges ?? []), ...(map.tiles ?? [])].find(
      (tile) => tile.doorId === configuration.id,
    );
    if (door) {
      doors.push(structuredClone(configuration));
    }
  }
  for (const { selector, configuration } of authored?.containers ?? []) {
    const container = (map.props ?? []).find((prop) =>
      Object.entries(selector).every(([key, value]) =>
        Object.entries(prop).some(([field, actual]) => field === key && actual === value),
      ),
    );
    if (container) {
      containers.push({ id: container.id, ...structuredClone(configuration) });
    }
  }
  return { doors, containers };
}

function isToolKey(value: unknown): value is ToolKey {
  return value === 'key' || value === 'lockpick' || value === 'crowbar' || value === 'pliers';
}
function requireTrap(target: EnvironmentRecord) {
  const trap = target.trap;
  if (!trap) {
    throw Error('Missing admitted environment trap');
  }
  return trap;
}

function assertRoadside(value: unknown): asserts value is RoadsideDiscovery {
  if (validateRoadsideDiscoveries([value]).length) {
    throw Error('El hallazgo del camino no es válido.');
  }
}
