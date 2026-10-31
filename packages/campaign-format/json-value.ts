import type { JsonObject, JsonValue } from './types.ts';

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (typeof value === 'object') {
    return Object.values(value).every(isJsonValue);
  }
  return false;
}

export function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && isJsonValue(value);
}

export function parseJsonObject(text: string): JsonObject {
  const value: unknown = JSON.parse(text);
  if (!isJsonObject(value)) {
    throw new Error('Expected a JSON object with finite values.');
  }
  return value;
}
