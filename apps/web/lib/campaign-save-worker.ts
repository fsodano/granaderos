import { encodeSave } from '../../../packages/game/save.js';

self.onmessage = (event: MessageEvent) => {
  const { id, sessionId, revision, requestId, campaign, battle } = event.data;
  const identity = { id, sessionId, revision, requestId };
  try {
    if (
      (campaign.gameSessionId && campaign.gameSessionId !== sessionId) ||
      (campaign.gameRevision ?? 0) !== revision
    ) {
      throw new Error(
        'La revisión enviada al guardado no coincide con la partida.',
      );
    }
    self.postMessage({ ...identity, text: encodeSave(campaign, battle) });
  } catch (error) {
    self.postMessage({
      ...identity,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
