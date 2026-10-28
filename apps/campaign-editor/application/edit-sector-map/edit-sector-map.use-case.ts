import type { SectorMapCommand } from '../../domain/sector-map-command.ts';
import type { CampaignEditorRefusalSnapshot } from '../../domain/campaign-editor-refusal.ts';
import type { EditSectorMapRepository } from './edit-sector-map.repository.ts';

export type EditSectorMapRequest = {
  mapId: string;
  revision: number;
  commands: readonly SectorMapCommand[];
};

export type EditSectorMapResponse = {
  document: { id: string; revision: number; [field: string]: unknown };
  errors: string[];
  warnings: string[];
  refusal?: CampaignEditorRefusalSnapshot;
};

export class EditSectorMapUseCase {
  #repository: EditSectorMapRepository;

  constructor(repository: EditSectorMapRepository) {
    this.#repository = repository;
  }

  execute(request: EditSectorMapRequest): EditSectorMapResponse {
    const map = this.#repository.load(request.mapId);
    const result = map.edit(request.commands, { expectedRevision: request.revision });
    if (!result.errors.length && !result.refusal) this.#repository.commit(map, request.revision);
    return result;
  }
}
