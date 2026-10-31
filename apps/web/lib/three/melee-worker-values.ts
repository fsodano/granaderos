import { isWorkerRecord } from '../battle-worker-values';
import type { LowerPathCache, LowerPoseRow } from './melee-lower-path-cache';
import type {
  NativePoseCache,
  SettledPoseCache,
  SettledPoseRow,
} from './melee-native-pose-cache';
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every((item: unknown) => typeof item === 'string');
const numbers = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every(finite);
const tuple = (value: unknown, length: number) =>
  numbers(value) && value.length === length;
const floatValues = (value: unknown): value is Float64Array =>
  value instanceof Float64Array && value.every(Number.isFinite);
function lowerRow(value: unknown): value is LowerPoseRow {
  return (
    isWorkerRecord(value) &&
    finite(value['time']) &&
    floatValues(value['values']) &&
    tuple(value['nativeRight'], 3) &&
    tuple(value['nativeLeft'], 3) &&
    tuple(value['rotation'], 4) &&
    ['handWeight', 'footError', 'maximumError'].every((key) =>
      finite(value[key]),
    ) &&
    typeof value['solves'] === 'boolean' &&
    typeof value['bodyCheck'] === 'boolean'
  );
}
function validGait(value: Record<string, unknown>) {
  return ['step', 'foot', 'sole', 'boot'].every((key) => finite(value[key]));
}
function lowerCache(value: unknown): value is LowerPathCache {
  if (
    !isWorkerRecord(value) ||
    !strings(value['names']) ||
    !isWorkerRecord(value['gait']) ||
    !validGait(value['gait'])
  ) {
    return false;
  }
  return (
    Array.isArray(value['core']) &&
    value['core'].every(
      (item: unknown) =>
        isWorkerRecord(item) &&
        typeof item['name'] === 'string' &&
        tuple(item['low'], 3) &&
        tuple(item['high'], 3),
    ) &&
    Array.isArray(value['recipes']) &&
    value['recipes'].every(
      (item: unknown) =>
        isWorkerRecord(item) &&
        typeof item['key'] === 'string' &&
        typeof item['accepted'] === 'boolean' &&
        Array.isArray(item['rows']) &&
        item['rows'].every(lowerRow),
    ) &&
    Array.isArray(value['previewLegs']) &&
    value['previewLegs'].every(
      (item: unknown) =>
        isWorkerRecord(item) &&
        typeof item['name'] === 'string' &&
        finite(item['first']) &&
        finite(item['second']),
    )
  );
}
function nativeCache(value: unknown): value is NativePoseCache {
  if (
    !isWorkerRecord(value) ||
    !strings(value['names']) ||
    !Array.isArray(value['rows'])
  ) {
    return false;
  }
  const length = value['names'].length * 10;
  return value['rows'].every(
    (item: unknown) =>
      isWorkerRecord(item) &&
      finite(item['time']) &&
      floatValues(item['values']) &&
      item['values'].length === length,
  );
}
function settledRow(value: unknown): value is SettledPoseRow {
  return (
    isWorkerRecord(value) &&
    finite(value['time']) &&
    floatValues(value['values']) &&
    tuple(value['right'], 3) &&
    tuple(value['left'], 3) &&
    tuple(value['rotation'], 4) &&
    Array.isArray(value['feet']) &&
    value['feet'].length === 2 &&
    value['feet'].every((item: unknown) => tuple(item, 3))
  );
}
function settledCache(value: unknown): value is SettledPoseCache {
  if (
    !isWorkerRecord(value) ||
    !strings(value['names']) ||
    !Array.isArray(value['rows'])
  ) {
    return false;
  }
  const length = value['names'].length * 26;
  return value['rows'].every(
    (item: unknown) => settledRow(item) && item.values.length === length,
  );
}
export interface ReadyMeleeSamples {
  id: number;
  cache: LowerPathCache;
  native: NativePoseCache;
  settled: SettledPoseCache;
  pairs: number[][];
  workerMs: number;
}
export function readReadyMeleeSamples(value: unknown): ReadyMeleeSamples {
  if (
    !isWorkerRecord(value) ||
    !finite(value['id']) ||
    !lowerCache(value['cache']) ||
    !nativeCache(value['native']) ||
    !settledCache(value['settled']) ||
    !Array.isArray(value['pairs']) ||
    !value['pairs'].every(
      (item: unknown) => numbers(item) && item.length === 2,
    ) ||
    !finite(value['workerMs'])
  ) {
    throw new Error('Invalid melee preparation result');
  }
  return {
    id: value['id'],
    cache: value['cache'],
    native: value['native'],
    settled: value['settled'],
    pairs: value['pairs'].map((pair: unknown) => {
      if (!numbers(pair)) {
        throw new Error('Invalid melee speed pair');
      }
      return pair;
    }),
    workerMs: value['workerMs'],
  };
}
