import { SectorOperationContext } from '../../../packages/game/domain/sector-sessions/sector-operation-context.ts';
import type { SectorOperationContextSnapshot } from '../../../packages/game/domain/sector-sessions/sector-operation-context.ts';
import { assertSectorOperationContext } from '../../../packages/game/infrastructure/sector-sessions/sector-operation-context.js';

import { BattleJobKind } from './battle-worker-contracts.ts';
import type {
  BattleWorkerJob,
  BattleWorkerRequest,
  BattleWorkerResultByKind,
} from './battle-worker-contracts.ts';
import {
  readBattleSnapshot,
  readBattleWorkerAction,
  readBattleWorkerContinuation,
} from './battle-worker-values.ts';
export { BattleJobKind };
export type {
  BattleWorkerJob,
  BattleWorkerRequest,
} from './battle-worker-contracts.ts';

type WorkerEnvelope<Result, Context> = Readonly<{
  id: number;
  context: Context;
}> &
  (
    | Readonly<{ battle: Result; error?: never }>
    | Readonly<{ error: string; battle?: never }>
  );

export type BattleWorkerResponse = WorkerEnvelope<
  BattleWorkerResultByKind[BattleJobKind],
  SectorOperationContextSnapshot | null
>;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function battleWorkerMessageId(value: unknown): number | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return typeof value['id'] === 'number' &&
    Number.isSafeInteger(value['id']) &&
    value['id'] > 0
    ? value['id']
    : undefined;
}

function readContext(value: unknown): SectorOperationContextSnapshot {
  if (
    !isRecord(value) ||
    typeof value['sessionId'] !== 'string' ||
    typeof value['sectorSessionId'] !== 'string' ||
    typeof value['requestId'] !== 'string' ||
    typeof value['revision'] !== 'number' ||
    typeof value['sectorRevision'] !== 'number'
  ) {
    throw new Error('Invalid battle worker context');
  }
  return new SectorOperationContext({
    sessionId: value['sessionId'],
    sectorSessionId: value['sectorSessionId'],
    requestId: value['requestId'],
    revision: value['revision'],
    sectorRevision: value['sectorRevision'],
  }).snapshot();
}

function readKind(value: unknown): BattleJobKind {
  switch (value) {
    case undefined:
      return BattleJobKind.Action;
    case 'action':
    case 'turn':
    case 'group':
    case 'movement-step':
    case 'group-step':
    case 'resume':
    case 'reachable-preview':
    case 'group-preview':
      return value;
    default:
      throw new Error('Invalid battle worker job kind');
  }
}

export function readBattleWorkerRequest(value: unknown): BattleWorkerRequest {
  const id = battleWorkerMessageId(value);
  if (!isRecord(value) || id === undefined || !isRecord(value['job'])) {
    throw new Error('Invalid battle worker request');
  }
  const context = readContext(value['context']);
  const job = value['job'];
  if (!Object.hasOwn(job, 'battle')) {
    throw new Error('Invalid battle worker job');
  }
  if (job['context'] !== undefined) {
    new SectorOperationContext(context).assertMatches(
      readContext(job['context']),
    );
  }
  const battle = readBattleSnapshot(job['battle']);
  assertSectorOperationContext(battle, context);
  const kind = readKind(job['kind']);
  return {
    id,
    context,
    job: {
      battle,
      action: readBattleWorkerAction(kind, job['action']),
      kind,
      ...(job['continuation'] === undefined || job['continuation'] === null
        ? {}
        : {
            continuation: readBattleWorkerContinuation(
              kind,
              job['continuation'],
            ),
          }),
      context,
    },
  };
}

export function readBattleWorkerResponse(
  value: unknown,
): WorkerEnvelope<unknown, SectorOperationContextSnapshot> {
  const id = battleWorkerMessageId(value);
  if (!isRecord(value) || id === undefined) {
    throw new Error('Invalid battle worker response');
  }
  const context = readContext(value['context']);
  if (Object.hasOwn(value, 'error')) {
    if (typeof value['error'] !== 'string' || Object.hasOwn(value, 'battle')) {
      throw new Error('Invalid battle worker error response');
    }
    return { id, context, error: value['error'] };
  }
  if (!Object.hasOwn(value, 'battle')) {
    throw new Error('Invalid battle worker result response');
  }
  return { id, context, battle: value['battle'] };
}

export function executeBattleWorkerRequest(
  value: unknown,
  run: (job: BattleWorkerJob) => BattleWorkerResultByKind[BattleJobKind],
): BattleWorkerResponse | undefined {
  const id = battleWorkerMessageId(value);
  if (id === undefined) {
    return undefined;
  }
  try {
    const request = readBattleWorkerRequest(value);
    return { id, context: request.context, battle: run(request.job) };
  } catch (error) {
    return {
      id,
      context: responseContext(value),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function responseContext(
  value: unknown,
): SectorOperationContextSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }
  try {
    return readContext(value['context']);
  } catch {
    return null;
  }
}
