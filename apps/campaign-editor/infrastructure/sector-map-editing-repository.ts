import {
  CampaignEditorRefusal,
  CampaignEditorRefusalCode,
} from '../domain/campaign-editor-refusal.ts';
import { SectorMap } from '../domain/sector-map.js';
import { SectorMapHistory } from '../domain/sector-map-history.js';
import type { EditSectorMapRepository } from '../application/edit-sector-map/edit-sector-map.repository.ts';
import { sectorMapGeometry } from './sector-map-geometry.js';

export class SectorMapEditingRepository implements EditSectorMapRepository {
  #history: SectorMapHistory;

  constructor(history: ConstructorParameters<typeof SectorMapHistory>[0]) {
    this.#history = new SectorMapHistory(history);
  }

  load(identifier: string): SectorMap {
    const { document } = this.#history.snapshot();
    if (document.id !== identifier) {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.MapNotOpen);
    }
    return new SectorMap(document, sectorMapGeometry);
  }

  commit(map: SectorMap, expectedRevision: number): void {
    this.#history.accept(map.snapshot(), expectedRevision);
  }

  snapshot() {
    return this.#history.snapshot();
  }
  undo() {
    this.#history.undo();
    return this.snapshot();
  }
  redo() {
    this.#history.redo();
    return this.snapshot();
  }
}
