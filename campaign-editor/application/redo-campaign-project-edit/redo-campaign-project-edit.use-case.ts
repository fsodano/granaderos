import type { CampaignProjectDocument } from '../../domain/campaign-project.ts';
import type { RedoCampaignProjectEditRepository } from './redo-campaign-project-edit.repository.ts';

export type RedoCampaignProjectEditRequest = { projectId: string; revision: number };
export type RedoCampaignProjectEditResponse = {
  project: CampaignProjectDocument;
  revision: number;
};

export class RedoCampaignProjectEditUseCase {
  #repository: RedoCampaignProjectEditRepository;

  constructor(repository: RedoCampaignProjectEditRepository) {
    this.#repository = repository;
  }

  execute(request: RedoCampaignProjectEditRequest): RedoCampaignProjectEditResponse {
    return this.#repository.redo(request.projectId, request.revision);
  }
}
