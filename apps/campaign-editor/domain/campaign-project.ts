import { CampaignEditorRefusal, CampaignEditorRefusalCode } from './campaign-editor-refusal.ts';
import {
  assertCampaignProjectEnvelope,
  projectContent,
  renameCampaignProject,
  updateProjectContent,
  removeProjectResource,
  setProjectResource,
} from './project-document.js';

export type JsonValue = string | number | boolean | null | JsonValue[] | JsonDocument;
export type JsonDocument = { [field: string]: JsonValue };
export type CampaignProjectDocument = {
  format: 'granaderos-editor-project';
  version: 1;
  manifest: JsonDocument & {
    id: string;
    name: string;
    scenario: string;
    revision: string;
    content: string;
    world: string;
    maps: string;
    presentation: string;
    assets: string;
  };
  content: JsonDocument;
  world: JsonDocument;
  presentation: JsonDocument;
  maps: Record<string, JsonDocument>;
  mapIndex: { maps: Array<{ id: string; path: string }> };
  assets: JsonDocument;
  resources: Record<string, { type: string; base64: string }>;
  editor?: JsonDocument;
};

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
    if (identifier === 'granaderos' && this.id !== 'granaderos')
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.ReservedProjectIdentity);
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
