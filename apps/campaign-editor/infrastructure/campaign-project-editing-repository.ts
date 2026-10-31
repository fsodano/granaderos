import {
  CampaignEditorRefusal,
  CampaignEditorRefusalCode,
} from '../domain/campaign-editor-refusal.ts';
import { CampaignProject } from '../domain/campaign-project.ts';
import { CampaignProjectHistory } from '../domain/campaign-project-history.ts';
import type { EditCampaignProjectRepository } from '../application/edit-campaign-project/edit-campaign-project.repository.ts';
import type { UndoCampaignProjectEditRepository } from '../application/undo-campaign-project-edit/undo-campaign-project-edit.repository.ts';
import type { RedoCampaignProjectEditRepository } from '../application/redo-campaign-project-edit/redo-campaign-project-edit.repository.ts';

export class CampaignProjectEditingRepository
  implements
    EditCampaignProjectRepository,
    UndoCampaignProjectEditRepository,
    RedoCampaignProjectEditRepository
{
  #history = new CampaignProjectHistory();
  #revision = 0;

  open(project: CampaignProject): void {
    this.#history = new CampaignProjectHistory();
    this.#history.record(project);
    this.#revision += 1;
  }

  close(): void {
    this.#history = new CampaignProjectHistory();
    this.#revision += 1;
  }

  snapshot() {
    return { ...this.#history.snapshot(), revision: this.#revision };
  }

  load(identifier: string) {
    const project = this.#history.current();
    if (!project || project.id !== identifier) {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.ProjectNotOpen);
    }
    return { project, revision: this.#revision };
  }

  commit(identifier: string, project: CampaignProject, expectedRevision: number): number {
    this.#requireRevision(identifier, expectedRevision);
    this.#history.record(project);
    return ++this.#revision;
  }

  undo(identifier: string, expectedRevision: number) {
    this.#requireRevision(identifier, expectedRevision);
    if (this.#history.canUndo) {
      this.#history.undo();
      this.#revision += 1;
    }
    const current = this.#history.current();
    if (!current) {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.ProjectNotOpen);
    }
    return { project: current.snapshot(), revision: this.#revision };
  }

  redo(identifier: string, expectedRevision: number) {
    this.#requireRevision(identifier, expectedRevision);
    if (this.#history.canRedo) {
      this.#history.redo();
      this.#revision += 1;
    }
    const current = this.#history.current();
    if (!current) {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.ProjectNotOpen);
    }
    return { project: current.snapshot(), revision: this.#revision };
  }

  #requireRevision(identifier: string, expectedRevision: number): void {
    const { revision } = this.load(identifier);
    if (revision !== expectedRevision) {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.StaleProjectRevision);
    }
  }
}
