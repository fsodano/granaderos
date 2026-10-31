import { editorErrorMessage } from '../infrastructure/editor-error-message.ts';
import { SectorMap } from '../domain/sector-map.js';
import { SectorMapHistory } from '../domain/sector-map-history.js';
import { EditSectorMapUseCase } from '../application/edit-sector-map/edit-sector-map.use-case.ts';
import { SectorMapEditingRepository } from '../infrastructure/sector-map-editing-repository.ts';
import { sectorMapGeometry } from '../infrastructure/sector-map-geometry.js';

/** @param {import("../domain/sector-map-command.ts").SectorMapEditResult} result */
function presentMapEditResult(result) {
  return result.refusal ? { ...result, errors: [editorErrorMessage(result.refusal)] } : result;
}

/** @param {import("../../../packages/campaign-format/types.ts").PhysicalMap} document
 * @param {readonly import("../domain/sector-map-command.ts").SectorMapCommand[]} commands */
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

/** @param {import("../../../packages/campaign-format/types.ts").PhysicalMap} document */
export function createSectorMapHistory(document) {
  return new SectorMapHistory({ document }).snapshot();
}

/** @param {import("../domain/sector-map-command.ts").SectorMapHistorySnapshot} history */
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
    ? {
        ...repository.snapshot(),
        errors: result.errors,
        ...(result.refusal ? { refusal: result.refusal } : {}),
      }
    : repository.snapshot();
}

/** @param {import("../domain/sector-map-command.ts").SectorMapHistorySnapshot} history */
export function undoSectorMapEdit(history) {
  return new SectorMapEditingRepository(history).undo();
}
/** @param {import("../domain/sector-map-command.ts").SectorMapHistorySnapshot} history */
export function redoSectorMapEdit(history) {
  return new SectorMapEditingRepository(history).redo();
}
/** @param {import("../../../packages/campaign-format/types.ts").PhysicalMap} document */
export function selectionRoots(document, identifiers) {
  return new SectorMap(document, sectorMapGeometry).selectionRoots(identifiers);
}
/** @param {import("../../../packages/campaign-format/types.ts").PhysicalMap} document */
export function buildingTemplate(document, identifier) {
  return new SectorMap(document, sectorMapGeometry).buildingTemplate(identifier);
}
