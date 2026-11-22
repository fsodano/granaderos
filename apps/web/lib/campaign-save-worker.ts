import { encodeSave } from '../../../packages/game/public/game-runtime-api.ts';
import { readCampaignSaveRequest, readSaveRequestIdentity } from './campaign-save-values';

self.onmessage = (event: MessageEvent<unknown>) => {
  // Replies can be correlated only after the transport identity is admitted.
  const identity = readSaveRequestIdentity(event.data);
  try {
    const { campaign, battle } = readCampaignSaveRequest(event.data);
    self.postMessage({ ...identity, text: encodeSave(campaign, battle) });
  } catch (error) {
    self.postMessage({
      ...identity,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
