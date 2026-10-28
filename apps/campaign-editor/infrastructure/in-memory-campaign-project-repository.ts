import {
  CampaignEditorRefusal,
  CampaignEditorRefusalCode,
} from '../domain/campaign-editor-refusal.ts';
import { CampaignProject } from '../domain/campaign-project.ts';
import type { EditCampaignProjectRepository } from '../application/edit-campaign-project/edit-campaign-project.repository.ts';

export class InMemoryCampaignProjectRepository implements EditCampaignProjectRepository {
  #projects = new Map<string, { project: CampaignProject; revision: number }>();

  constructor(projects: CampaignProject[] = []) {
    for (const project of projects)
      this.#projects.set(project.id, {
        project: new CampaignProject(project.snapshot()),
        revision: 0,
      });
  }

  load(identifier: string): { project: CampaignProject; revision: number } {
    const stored = this.#projects.get(identifier);
    if (!stored) throw new CampaignEditorRefusal(CampaignEditorRefusalCode.ProjectNotFound);
    return { project: new CampaignProject(stored.project.snapshot()), revision: stored.revision };
  }

  commit(identifier: string, project: CampaignProject, expectedRevision: number): number {
    const stored = this.#projects.get(identifier);
    if (!stored || stored.revision !== expectedRevision)
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.StaleProjectRevision);
    if (project.id !== identifier && this.#projects.has(project.id))
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.ProjectIdentityInUse);
    const revision = expectedRevision + 1;
    this.#projects.delete(identifier);
    this.#projects.set(project.id, { project: new CampaignProject(project.snapshot()), revision });
    return revision;
  }
}
