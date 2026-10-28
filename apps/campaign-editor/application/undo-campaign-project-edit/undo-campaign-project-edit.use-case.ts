import type { CampaignProjectDocument } from '../../domain/campaign-project.ts';
import type { UndoCampaignProjectEditRepository } from './undo-campaign-project-edit.repository.ts';

export type UndoCampaignProjectEditRequest = { projectId: string; revision: number };
export type UndoCampaignProjectEditResponse = {
  project: CampaignProjectDocument;
  revision: number;
};

export class UndoCampaignProjectEditUseCase {
  #repository: UndoCampaignProjectEditRepository;

  constructor(repository: UndoCampaignProjectEditRepository) {
    this.#repository = repository;
  }

  execute(request: UndoCampaignProjectEditRequest): UndoCampaignProjectEditResponse {
    return this.#repository.undo(request.projectId, request.revision);
  }
}
