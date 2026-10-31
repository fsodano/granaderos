import {
  CampaignEditorRefusal,
  CampaignEditorRefusalCode,
} from '../../domain/campaign-editor-refusal.ts';
import type { CampaignProjectDocument, JsonDocument } from '../../domain/campaign-project.ts';
import type { EditCampaignProjectRepository } from './edit-campaign-project.repository.ts';

export type EditCampaignProjectRequest = {
  projectId: string;
  revision: number;
  edit:
    | { kind: 'rename'; identifier: string; name?: string }
    | { kind: 'replace-content'; content: JsonDocument }
    | { kind: 'replace-draft'; document: CampaignProjectDocument }
    | { kind: 'remove-resource'; path: string };
};

export type EditCampaignProjectResponse = { project: CampaignProjectDocument; revision: number };

export class EditCampaignProjectUseCase {
  #repository: EditCampaignProjectRepository;

  constructor(repository: EditCampaignProjectRepository) {
    this.#repository = repository;
  }

  execute(request: EditCampaignProjectRequest): EditCampaignProjectResponse {
    const { project, revision } = this.#repository.load(request.projectId);
    if (revision !== request.revision) {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.StaleProjectRevision);
    }
    const edit = request.edit;
    switch (edit.kind) {
      case 'rename':
        project.rename(edit.identifier, edit.name);
        break;
      case 'replace-content':
        project.replaceContent(edit.content);
        break;
      case 'replace-draft':
        project.replaceDraft(edit.document);
        break;
      case 'remove-resource':
        project.removeResource(edit.path);
        break;
    }
    const nextRevision = this.#repository.commit(request.projectId, project, revision);
    return { project: project.snapshot(), revision: nextRevision };
  }
}
