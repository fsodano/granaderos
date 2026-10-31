import { SectorOperationContext } from '../../../packages/game/domain/sector-sessions/sector-operation-context.ts';
import {
  sectorOperationContextFor,
  assertSectorOperationContext,
} from '../../../packages/game/infrastructure/sector-sessions/sector-operation-context.js';
import { battleWorkerMessageId, readBattleWorkerResponse } from './battle-worker-transport.ts';
import type { BattleWorkerJob, BattleWorkerRequest } from './battle-worker-transport.ts';

export interface BattleWorkerPort {
  postMessage(message: BattleWorkerRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => unknown) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
}

type PendingRequest = Readonly<{
  resolve: (result: unknown) => void;
  reject: (error: unknown) => void;
  context: SectorOperationContext;
}>;

export interface BattleExecutor {
  run(job: BattleWorkerJob): Promise<unknown>;
  close(): void;
}

export function createBattleExecutor(worker: BattleWorkerPort): BattleExecutor {
  let sequence = 0;
  let closed = false;
  const pending = new Map<number, PendingRequest>();
  const rejectAll = (error: Error) => {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };
  worker.onmessage = ({ data }: MessageEvent<unknown>) => {
    const id = battleWorkerMessageId(data);
    if (id === undefined) return;
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    try {
      const response = readBattleWorkerResponse(data);
      request.context.assertMatches(response.context);
      if ('error' in response) throw new Error(response.error);
      request.resolve(response.battle);
    } catch (error) {
      request.reject(error);
    }
  };
  const fail = () => {
    if (closed) return;
    closed = true;
    rejectAll(new Error('Battle worker failed'));
    worker.terminate();
  };
  worker.onerror = fail;
  worker.onmessageerror = fail;
  return {
    run(job: BattleWorkerJob): Promise<unknown> {
      if (closed) return Promise.reject(new Error('Battle worker closed'));
      const id = ++sequence;
      let context: SectorOperationContext;
      try {
        context = job.context
          ? new SectorOperationContext(job.context)
          : sectorOperationContextFor(job.battle, id);
        assertSectorOperationContext(job.battle, context.snapshot());
      } catch (error) {
        return Promise.reject(error);
      }
      return new Promise<unknown>((resolve, reject) => {
        pending.set(id, { resolve, reject, context });
        try {
          worker.postMessage({
            id,
            context: context.snapshot(),
            job: { ...job, context: context.snapshot() },
          });
        } catch (error) {
          pending.delete(id);
          reject(error);
        }
      });
    },
    close() {
      if (closed) return;
      closed = true;
      rejectAll(new Error('Battle worker closed'));
      worker.terminate();
    },
  };
}
