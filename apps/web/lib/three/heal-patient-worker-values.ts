import { isWorkerRecord } from '../battle-worker-values';
import type { PatientPlanData } from './heal-patient-contact-fit';
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const numbers = (value: unknown): value is number[] => Array.isArray(value) && value.every(finite);
const vector = (value: unknown) => numbers(value) && value.length === 3;
const optionalVector = (value: unknown) => value === undefined || vector(value);
function plan(value: unknown): value is PatientPlanData {
  if (!isWorkerRecord(value) || !isWorkerRecord(value['face'])) {
    return false;
  }
  const face = value['face'];
  return (
    typeof face['mesh'] === 'string' &&
    typeof face['bone'] === 'string' &&
    numbers(face['ids']) &&
    face['ids'].length === 3 &&
    face['ids'].every(Number.isSafeInteger) &&
    vector(value['bary']) &&
    vector(value['palm']) &&
    optionalVector(value['approach']) &&
    optionalVector(value['axis']) &&
    finite(value['turn']) &&
    finite(value['tilt']) &&
    (value['offset'] === undefined || finite(value['offset'])) &&
    (value['elbowUp'] === undefined || finite(value['elbowUp'])) &&
    Array.isArray(value['arm']) &&
    value['arm'].every(
      (group: unknown) =>
        isWorkerRecord(group) &&
        typeof group['mesh'] === 'string' &&
        numbers(group['indices']) &&
        group['indices'].every((index) => Number.isSafeInteger(index) && index >= 0),
    )
  );
}
export interface PatientFitResult {
  id: number;
  plan: PatientPlanData | null;
  lift: number | undefined;
  workerMs: number;
}
export function readPatientFitResult(value: unknown): PatientFitResult {
  if (
    !isWorkerRecord(value) ||
    !finite(value['id']) ||
    (value['plan'] !== null && !plan(value['plan'])) ||
    (value['lift'] !== undefined && !finite(value['lift'])) ||
    !finite(value['workerMs'])
  ) {
    throw new Error('Invalid patient preparation result');
  }
  return {
    id: value['id'],
    plan: value['plan'],
    lift: value['lift'],
    workerMs: value['workerMs'],
  };
}
