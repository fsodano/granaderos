import type { CampaignProjectDocument } from '../../domain/campaign-project.ts';

export interface UndoCampaignProjectEditRepository {
  undo(
    identifier: string,
    expectedRevision: number,
  ): { project: CampaignProjectDocument; revision: number };
}
