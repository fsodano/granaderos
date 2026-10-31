import { CampaignEditorRefusal, CampaignEditorRefusalCode } from './campaign-editor-refusal.ts';
import {
  assertCampaignProjectEnvelope,
  projectContent,
  renameCampaignProject,
  updateProjectContent,
  removeProjectResource,
  setProjectResource,
} from './project-document.ts';

import type { CampaignProjectDocument, JsonDocument } from './project-document.ts';
export type { CampaignProjectDocument, JsonDocument, JsonValue } from './project-document.ts';

export class CampaignProject {
  #document: CampaignProjectDocument;

  constructor(document: CampaignProjectDocument) {
    assertCampaignProjectEnvelope(document);
    this.#document = structuredClone(document);
  }

  get id(): string {
    return this.#document.manifest.id;
  }

  snapshot(): CampaignProjectDocument {
    return structuredClone(this.#document);
  }

  previewContent(): JsonDocument {
    return projectContent(this.#document);
  }

  rename(identifier: string, name?: string): void {
    if (identifier === 'granaderos' && this.id !== 'granaderos') {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.ReservedProjectIdentity);
    }
    this.#admit(renameCampaignProject(this.#document, identifier, name));
  }

  replaceContent(content: JsonDocument): void {
    this.#admit(updateProjectContent(this.#document, content));
  }

  replaceDraft(document: CampaignProjectDocument): void {
    if (document.manifest.id !== this.id) {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.ProjectIdentityOperationRequired);
    }
    this.#admit(document);
  }

  async replaceResource(
    path: string,
    bytes: Uint8Array,
    type?: string,
    identifier?: string,
  ): Promise<void> {
    this.#admit(await setProjectResource(this.#document, path, bytes, type, identifier));
  }

  removeResource(path: string): void {
    this.#admit(removeProjectResource(this.#document, path));
  }

  #admit(document: CampaignProjectDocument): void {
    assertCampaignProjectEnvelope(document);
    this.#document = structuredClone(document);
  }
}
