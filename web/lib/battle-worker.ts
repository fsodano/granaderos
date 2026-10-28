import { runBattleJob } from '../../game/battle-job.js';
import { assertSectorOperationContext } from '../../game/infrastructure/sector-sessions/sector-operation-context.js';
self.onmessage = (event: MessageEvent) => {
  const { id, job, context } = event.data;
  try {
    assertSectorOperationContext(job.battle, context);
    self.postMessage({ id, context, battle: runBattleJob({ ...job, context }) });
  } catch (error) {
    self.postMessage({
      id,
      context,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
