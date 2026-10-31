import type { SectorOperationContextSnapshot } from '../../../packages/game/domain/sector-sessions/sector-operation-context.ts';
import type {
  BattleJobKind,
  BattleWorkerJob,
} from '../../../packages/game/public/battle-job-types.ts';
export { BattleJobKind } from '../../../packages/game/public/battle-job-types.ts';
export type {
  BattleWorkerJob,
  BattleWorkerActionByKind,
  BattleWorkerResultByKind,
  BattleWorkerContinuationByKind,
} from '../../../packages/game/public/battle-job-types.ts';
export interface BattleWorkerRequest<Kind extends BattleJobKind = BattleJobKind> {
  id: number;
  context: SectorOperationContextSnapshot;
  job: BattleWorkerJob<Kind>;
}
