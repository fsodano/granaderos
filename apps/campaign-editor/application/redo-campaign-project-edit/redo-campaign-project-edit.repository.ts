import type { CampaignProjectDocument } from '../../domain/campaign-project.ts';

export interface RedoCampaignProjectEditRepository {
  redo(
    identifier: string,
    expectedRevision: number,
  ): { project: CampaignProjectDocument; revision: number };
}
