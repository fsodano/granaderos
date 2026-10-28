import { editorErrorMessage } from '../infrastructure/editor-error-message.ts';
import { SectorMap } from '../domain/sector-map.js';
import { SectorMapHistory } from '../domain/sector-map-history.js';
import { EditSectorMapUseCase } from '../application/edit-sector-map/edit-sector-map.use-case.ts';
import { SectorMapEditingRepository } from '../infrastructure/sector-map-editing-repository.ts';
import { sectorMapGeometry } from '../infrastructure/sector-map-geometry.js';

function presentMapEditResult(result) {
  return result.refusal ? { ...result, errors: [editorErrorMessage(result.refusal)] } : result;
}

export function editSectorMapDocument(
  document,
  commands,
  { expectedRevision = document.revision } = {},
) {
  const repository = new SectorMapEditingRepository({ document });
  return presentMapEditResult(
    new EditSectorMapUseCase(repository).execute({
      mapId: document.id,
      revision: expectedRevision,
      commands,
    }),
  );
}

export function createSectorMapHistory(document) {
  return new SectorMapHistory({ document }).snapshot();
}

export function editSectorMap(history, commands) {
  const repository = new SectorMapEditingRepository(history);
  const result = presentMapEditResult(
    new EditSectorMapUseCase(repository).execute({
      mapId: history.document.id,
      revision: history.document.revision,
      commands,
    }),
  );
  return result.errors.length
    ? { ...repository.snapshot(), errors: result.errors, refusal: result.refusal }
    : repository.snapshot();
}

export function undoSectorMapEdit(history) {
  return new SectorMapEditingRepository(history).undo();
}
export function redoSectorMapEdit(history) {
  return new SectorMapEditingRepository(history).redo();
}
export function selectionRoots(document, identifiers) {
  return new SectorMap(document, sectorMapGeometry).selectionRoots(identifiers);
}
export function buildingTemplate(document, identifier) {
  return new SectorMap(document, sectorMapGeometry).buildingTemplate(identifier);
}
