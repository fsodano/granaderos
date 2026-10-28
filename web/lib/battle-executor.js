import { SectorOperationContext } from '../../game/domain/sector-sessions/sector-operation-context.ts';
import {
  sectorOperationContextFor,
  assertSectorOperationContext,
} from '../../game/infrastructure/sector-sessions/sector-operation-context.js';

export function createBattleExecutor(worker) {
  let sequence = 0;
  let closed = false;
  const pending = new Map();
  const rejectAll = (error) => {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };
  worker.onmessage = ({ data }) => {
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    try {
      request.context.assertMatches(data.context);
      if (data.error) throw new Error(data.error);
      request.resolve(data.battle);
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
    run(job) {
      if (closed) return Promise.reject(new Error('Battle worker closed'));
      const id = ++sequence;
      let context;
      try {
        context = job.context
          ? new SectorOperationContext(job.context)
          : sectorOperationContextFor(job.battle, id);
        assertSectorOperationContext(job.battle, context.snapshot());
      } catch (error) {
        return Promise.reject(error);
      }
      return new Promise((resolve, reject) => {
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
