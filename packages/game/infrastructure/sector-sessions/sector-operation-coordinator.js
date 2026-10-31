import { ResumeSectorOperationUseCase } from '../../application/sector-sessions/resume-sector-operation/resume-sector-operation.use-case.ts';
import { SectorOperationKind } from '../../domain/sector-sessions/sector-operation.ts';
import { SectorOperationRunner } from '../../application/sector-sessions/sector-operation-runner.ts';
import { ExecuteSectorOrderUseCase } from '../../application/sector-sessions/execute-sector-order/execute-sector-order.use-case.ts';
import { EndSectorTurnUseCase } from '../../application/sector-sessions/end-sector-turn/end-sector-turn.use-case.ts';
import {
  SectorOperationTransaction,
  SnapshotExecuteSectorOrderRepository,
  SnapshotEndSectorTurnRepository,
  SnapshotResumeSectorOperationRepository,
} from './sector-operation-repositories.js';
import {
  captureBattlePresentationCheckpoint,
  restoreBattlePresentationCheckpoint,
} from '../../battle-presentation.js';
import {
  captureFirearmNearMissCheckpoint,
  restoreFirearmNearMissCheckpoint,
} from '../../firearm-near-miss-feedback.js';

let currentRunner = null;
const presentationEffects = {
  checkpoint: () => ({
    presentation: captureBattlePresentationCheckpoint(),
    nearMiss: captureFirearmNearMissCheckpoint(),
  }),
  restore: (checkpoint) => {
    restoreBattlePresentationCheckpoint(checkpoint.presentation);
    restoreFirearmNearMissCheckpoint(checkpoint.nearMiss);
  },
};
export function checkpointCompletedSectorOrder(state) {
  currentRunner?.completeOrder(state);
}
export function checkpointSectorOperation(state) {
  currentRunner?.checkpoint(state);
}
export function remainingSectorRestSeconds(state, fallback) {
  return currentRunner?.remainingRestSeconds(state) ?? fallback;
}
export function coordinateSectorOperation(state, intent, execute, advanceIdleTime) {
  if (currentRunner) {
    return execute(state);
  }
  const input = structuredClone(state);
  const transaction = new SectorOperationTransaction(input);
  const createRunner = (snapshot) => {
    const runner = new SectorOperationRunner(snapshot, intent, presentationEffects);
    currentRunner = runner;
    return runner;
  };
  try {
    if (intent.kind === SectorOperationKind.Order) {
      return new ExecuteSectorOrderUseCase(
        new SnapshotExecuteSectorOrderRepository(transaction),
        createRunner,
        execute,
        advanceIdleTime,
      ).execute({ order: intent.order });
    }
    if (intent.kind === SectorOperationKind.Continue) {
      return new ResumeSectorOperationUseCase(
        new SnapshotResumeSectorOperationRepository(transaction),
        createRunner,
        execute,
        advanceIdleTime,
      ).execute();
    }
    return new EndSectorTurnUseCase(
      new SnapshotEndSectorTurnRepository(transaction),
      createRunner,
      execute,
      advanceIdleTime,
    ).execute();
  } finally {
    currentRunner = null;
  }
}
