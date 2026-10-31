import { presentedEndTurn } from '../../../packages/game/tactical.js';
import { readBattleSnapshot } from './battle-worker-values.ts';

self.onmessage = ({ data }: MessageEvent<unknown>) => {
  if (
    typeof data !== 'object' ||
    data === null ||
    !('id' in data) ||
    typeof data.id !== 'number' ||
    !Number.isSafeInteger(data.id)
  ) {
    return;
  }
  const id = data.id;
  try {
    if (!('state' in data)) {
      throw Error('Missing turn snapshot');
    }
    const state = readBattleSnapshot(data.state);
    self.postMessage({ id, result: presentedEndTurn(state) });
  } catch {
    self.postMessage({
      id,
      error: 'No se pudo completar el turno. Intentá de nuevo.',
    });
  }
};
