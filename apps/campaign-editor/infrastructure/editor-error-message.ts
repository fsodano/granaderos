import { CampaignEditorRefusalCode } from '../domain/campaign-editor-refusal.ts';
import type {
  CampaignEditorRefusalDetails,
  CampaignEditorRefusalSnapshot,
} from '../domain/campaign-editor-refusal.ts';

type RefusalTranslation = (details: CampaignEditorRefusalDetails) => string;

const translations = {
  InvalidHistoryCapacity: () => 'El historial necesita una capacidad positiva.',
  ProjectNotOpen: () => 'El proyecto no está abierto.',
  StaleProjectRevision: () => 'El proyecto cambió. Recargá la versión actual.',
  ProjectNotFound: () => 'El proyecto no existe.',
  ProjectIdentityInUse: () => 'La identidad del proyecto ya existe.',
  MapNotOpen: () => 'El mapa no está abierto.',
  IncompatibleCampaignMap: () => 'El mapa debe conservar su identidad y medir 20 × 16.',
  BuildingNotFound: () => 'El edificio no existe.',
  RoofAccessUnavailable: () => 'La losa necesita un acceso libre junto al edificio.',
  CellNotFound: () => 'La casilla no existe.',
  LocalityNotFound: () => 'La localidad no existe.',
  AnchorRequiresLand: () => 'La cabecera necesita una casilla terrestre.',
  CellOwnedByAnotherLocality: () => 'La casilla pertenece a otra localidad.',
  LocalityRequiresAnchor: () => 'La localidad necesita una cabecera.',
  InvalidLocalityIdentity: () => 'La localidad necesita una identidad nueva y válida.',
  LocalityRequiresName: () => 'La localidad necesita un nombre.',
  CellAlreadyAssigned: () => 'La casilla ya pertenece a una localidad.',
  LocalityMapIdentityMismatch: () => 'El mapa debe pertenecer a la nueva localidad.',
  AnchorDestinationUnavailable: () => 'La nueva cabecera necesita una casilla terrestre libre.',
  LocalityStructureOperationRequired: () => 'Usá las operaciones de identidad, cabecera y caminos.',
  AnchorDistrictLocked: () => 'Mové o eliminá la cabecera antes de cambiar su distrito.',
  DistrictRequiresLand: () => 'El distrito necesita una casilla terrestre.',
  CellGeometryImmutable: () => 'La posición y la identidad de la casilla son fijas.',
  DistrictMustBeRemoved: () => 'Quitá el distrito antes de convertir la casilla en agua.',
  RoadNeedsDistinctLocalities: () => 'El camino necesita dos localidades.',
  ReservedProjectIdentity: () => 'Granaderos es una identidad reservada.',
  ProjectIdentityOperationRequired: () => 'Usá la operación de identidad para cambiar el proyecto.',
  StaleMapRevision: () => 'La revisión cambió. Recargá antes de aplicar estos cambios.',
  InvalidMapResourcePath: () => 'El índice de mapas contiene una ruta inválida.',
  InvalidProjectIdentity: () => 'Usá un identificador con letras minúsculas, números y guiones.',
  InvalidProjectName: () => 'El nombre necesita entre 1 y 100 caracteres.',
  InvalidResourceTypeOrPath: () =>
    'El recurso necesita una ruta assets/ y un tipo PNG, JPEG, WebP o JSON.',
  ResourceTooLarge: () => 'El archivo de recurso es demasiado grande.',
  ResourceIdentityInUse: () => 'El recurso necesita un identificador único.',
  IncompatibleProjectDocument: () => 'El archivo no es un proyecto de campaña compatible.',
  TooManyProjectResources: () => 'El proyecto contiene demasiados recursos.',
  ProjectResourcesTooLarge: () => 'Los recursos del proyecto son demasiado grandes.',
  ProjectDocumentTooLarge: () => 'El archivo de proyecto es demasiado grande.',
  InvalidBuildingDimensions: () => 'Dimensiones de edificio no válidas.',
  InvalidMapCommandBatch: () => 'Lote de comandos no válido.',
  InvalidMapSelection: () => 'Selección no válida.',
  InvalidTerrainBrush: () => 'Pincel no válido.',
  CellOutsideMap: () => 'Casilla fuera del mapa.',
  InvalidMapLayer: () => 'Capa no válida.',
  FurnitureNotFound: () => 'Mueble desconocido.',
  MapGeometryOperationRequired: () =>
    'Usá una operación geométrica para cambiar la posición o el tamaño.',
  DoorNotFound: () => 'Puerta desconocida.',
  OpeningRequired: () => 'Seleccioná una puerta o ventana.',
  InvalidWallEdge: () => 'La pared debe estar en un borde del edificio.',
  OpeningRequiresWall: () => 'Las aberturas deben ocupar una pared.',
  UnsupportedTemplateVersion: () => 'Versión de plantilla no válida.',
  InvalidTemplateDimensions: () => 'Dimensiones de plantilla no válidas.',
  ObjectNotFound: (details) => `Objeto desconocido: ${String(details.id)}`,
  UnsupportedMapCommand: (details) => `Comando desconocido: ${String(details.command)}`,
  LocalitiesDisconnected: (details) =>
    `El camino ${String(details.origin)} / ${String(details.destination)} no tiene conexión terrestre.`,
  LocalityInUse: (details) =>
    `Reasigná las referencias antes de eliminar: ${Array.isArray(details.references) ? details.references.join(', ') : ''}.`,
  ResourceNotFound: (details) => `Falta el recurso ${String(details.path)}.`,
  InvalidProjectResource: (details) => `Recurso de proyecto inválido: ${String(details.path)}.`,
} satisfies Record<CampaignEditorRefusalCode, RefusalTranslation>;

function isEditorRefusal(value: unknown): value is CampaignEditorRefusalSnapshot {
  if (!value || typeof value !== 'object' || !('code' in value) || !('details' in value))
    return false;
  return (
    typeof value.code === 'string' &&
    Object.hasOwn(translations, value.code) &&
    value.details !== null &&
    typeof value.details === 'object'
  );
}

export function editorErrorMessage(error: unknown): string {
  if (isEditorRefusal(error)) return translations[error.code](error.details);
  if (error instanceof Error) return error.message;
  return String(error);
}
