import { runBattleJob } from '../../../packages/game/battle-job.ts';
import { executeBattleWorkerRequest } from './battle-worker-transport.ts';

self.onmessage = (event: MessageEvent<unknown>) => {
  const response = executeBattleWorkerRequest(event.data, (job) => runBattleJob(job));
  if (!response) {
    return;
  }
  try {
    self.postMessage(response);
  } catch (error) {
    self.postMessage({
      id: response.id,
      context: response.context,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
