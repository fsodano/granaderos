import type { SectorSession } from '../../../domain/sector-sessions/sector-session.ts';
import type {
  SectorDeployment,
  DeploymentPoint,
} from '../../../domain/sector-sessions/sector-deployment.ts';
export type ReinforcementAdmission = Readonly<{
  session: SectorSession;
  deployment: SectorDeployment;
  preferences: readonly Readonly<{ characterId: string; point: DeploymentPoint }>[];
  occupiedPoints: readonly DeploymentPoint[];
  revision: number;
}>;
export interface AdmitSectorReinforcementsRepository {
  loadReinforcementAdmission(): ReinforcementAdmission;
  commitReinforcementAdmission(
    session: SectorSession,
    placements: Readonly<Record<string, DeploymentPoint>>,
    expectedRevision: number,
  ): void;
}
