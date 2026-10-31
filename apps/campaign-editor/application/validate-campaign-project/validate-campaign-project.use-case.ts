import type { CompiledCampaignContent } from '../../../../packages/campaign-format/types.ts';
import type { CampaignProjectDocument } from '../../domain/campaign-project.ts';
import type { ValidateCampaignProjectRepository } from './validate-campaign-project.repository.ts';

export type CampaignProjectIssue = { section: string; message: string; path?: string };
export type CampaignProjectValidation = {
  valid: boolean;
  issues: CampaignProjectIssue[];
  content?: CompiledCampaignContent;
  checks?: { maps: number; resources: number; resourceBytes: number };
};
export interface CampaignProjectValidator {
  validate(project: CampaignProjectDocument): Promise<CampaignProjectValidation>;
}
export type ValidateCampaignProjectRequest = { projectId: string };
export type ValidateCampaignProjectResponse = CampaignProjectValidation & { revision: number };

export class ValidateCampaignProjectUseCase {
  #repository: ValidateCampaignProjectRepository;
  #validator: CampaignProjectValidator;

  constructor(repository: ValidateCampaignProjectRepository, validator: CampaignProjectValidator) {
    this.#repository = repository;
    this.#validator = validator;
  }

  async execute(request: ValidateCampaignProjectRequest): Promise<ValidateCampaignProjectResponse> {
    const { project, revision } = await this.#repository.load(request.projectId);
    return { ...(await this.#validator.validate(project.snapshot())), revision };
  }
}
