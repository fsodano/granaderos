import type { CampaignProject } from '../../domain/campaign-project.ts';

export interface ValidateCampaignProjectRepository {
  load(
    identifier: string,
  ):
    | { project: CampaignProject; revision: number }
    | Promise<{ project: CampaignProject; revision: number }>;
}
