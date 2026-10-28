import type { CampaignProject } from '../../domain/campaign-project.ts';

export interface EditCampaignProjectRepository {
  load(identifier: string): { project: CampaignProject; revision: number };
  commit(identifier: string, project: CampaignProject, expectedRevision: number): number;
}
