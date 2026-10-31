import { validateEnvironmentRecord } from '../campaign-format/environment-record-schema.js';
import { validateItemStack } from './tactical-inventory.js';
import type { EnvironmentRecord } from './public/environment-types.ts';
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
/** Admit the optional physical fields in addition to the existing lock/item schema. */
export function assertEnvironmentRecord(value: unknown): asserts value is EnvironmentRecord {
  validateEnvironmentRecord(value);
  if (!record(value) || typeof value['type'] !== 'string') {
    throw Error('El objeto del entorno no es válido.');
  }
  for (const key of ['id', 'doorId', 'kind', 'material']) {
    if (value[key] !== undefined && typeof value[key] !== 'string') {
      throw Error('La identidad del objeto del entorno no es válida.');
    }
  }
  for (const key of [
    'x',
    'y',
    'tacticalLevel',
    'structureDamage',
    'cover',
    'obstacleHeight',
    'projectileResistance',
  ]) {
    const field = value[key];
    if (field !== undefined && (typeof field !== 'number' || !Number.isFinite(field))) {
      throw Error('La geometría del objeto del entorno no es válida.');
    }
  }
  for (const key of ['destroyed', 'blocked', 'blocksSight']) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') {
      throw Error('El estado del objeto del entorno no es válido.');
    }
  }
  if (value['axis'] !== undefined && value['axis'] !== 'x' && value['axis'] !== 'y') {
    throw Error('El eje del objeto del entorno no es válido.');
  }
  const contents = value['contents'];
  if (Array.isArray(contents)) {
    const entries: readonly unknown[] = contents;
    for (const stack of entries) {
      validateItemStack(stack);
    }
  }
}
export type AuthoredEnvironment = {
  doors: EnvironmentRecord[];
  containers: { selector: Record<string, string>; configuration: EnvironmentRecord }[];
};
export function readAuthoredEnvironment(value: unknown): Record<string, AuthoredEnvironment> {
  if (!record(value)) {
    throw Error('Las fuentes físicas del entorno no son válidas.');
  }
  const result: Record<string, AuthoredEnvironment> = {};
  for (const [key, source] of Object.entries(value)) {
    if (
      !record(source) ||
      !Array.isArray(source['doors']) ||
      !Array.isArray(source['containers'])
    ) {
      throw Error('Las fuentes físicas del entorno no son válidas.');
    }
    const doors: EnvironmentRecord[] = [],
      containers: AuthoredEnvironment['containers'] = [];
    const rawDoors: readonly unknown[] = source['doors'],
      rawContainers: readonly unknown[] = source['containers'];
    for (const door of rawDoors) {
      assertEnvironmentRecord(door);
      doors.push(door);
    }
    for (const entry of rawContainers) {
      if (!record(entry) || !record(entry['selector'])) {
        throw Error('El selector del recipiente no es válido.');
      }
      const selector: Record<string, string> = {};
      for (const [field, match] of Object.entries(entry['selector'])) {
        if (typeof match !== 'string') {
          throw Error('El selector del recipiente no es válido.');
        }
        selector[field] = match;
      }
      const configuration = entry['configuration'];
      assertEnvironmentRecord(configuration);
      containers.push({ selector, configuration });
    }
    result[key] = { doors, containers };
  }
  return result;
}
