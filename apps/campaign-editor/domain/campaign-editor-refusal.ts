export const CampaignEditorRefusalCode = {
  InvalidHistoryCapacity: 'InvalidHistoryCapacity',
  ProjectNotOpen: 'ProjectNotOpen',
  StaleProjectRevision: 'StaleProjectRevision',
  ProjectNotFound: 'ProjectNotFound',
  ProjectIdentityInUse: 'ProjectIdentityInUse',
  MapNotOpen: 'MapNotOpen',
  IncompatibleCampaignMap: 'IncompatibleCampaignMap',
  BuildingNotFound: 'BuildingNotFound',
  RoofAccessUnavailable: 'RoofAccessUnavailable',
  CellNotFound: 'CellNotFound',
  LocalityNotFound: 'LocalityNotFound',
  AnchorRequiresLand: 'AnchorRequiresLand',
  CellOwnedByAnotherLocality: 'CellOwnedByAnotherLocality',
  LocalityRequiresAnchor: 'LocalityRequiresAnchor',
  InvalidLocalityIdentity: 'InvalidLocalityIdentity',
  LocalityRequiresName: 'LocalityRequiresName',
  CellAlreadyAssigned: 'CellAlreadyAssigned',
  LocalityMapIdentityMismatch: 'LocalityMapIdentityMismatch',
  AnchorDestinationUnavailable: 'AnchorDestinationUnavailable',
  LocalityStructureOperationRequired: 'LocalityStructureOperationRequired',
  AnchorDistrictLocked: 'AnchorDistrictLocked',
  DistrictRequiresLand: 'DistrictRequiresLand',
  CellGeometryImmutable: 'CellGeometryImmutable',
  DistrictMustBeRemoved: 'DistrictMustBeRemoved',
  RoadNeedsDistinctLocalities: 'RoadNeedsDistinctLocalities',
  ReservedProjectIdentity: 'ReservedProjectIdentity',
  ProjectIdentityOperationRequired: 'ProjectIdentityOperationRequired',
  StaleMapRevision: 'StaleMapRevision',
  InvalidMapResourcePath: 'InvalidMapResourcePath',
  InvalidProjectIdentity: 'InvalidProjectIdentity',
  InvalidProjectName: 'InvalidProjectName',
  InvalidResourceTypeOrPath: 'InvalidResourceTypeOrPath',
  ResourceTooLarge: 'ResourceTooLarge',
  ResourceIdentityInUse: 'ResourceIdentityInUse',
  IncompatibleProjectDocument: 'IncompatibleProjectDocument',
  TooManyProjectResources: 'TooManyProjectResources',
  ProjectResourcesTooLarge: 'ProjectResourcesTooLarge',
  ProjectDocumentTooLarge: 'ProjectDocumentTooLarge',
  InvalidBuildingDimensions: 'InvalidBuildingDimensions',
  InvalidMapCommandBatch: 'InvalidMapCommandBatch',
  InvalidMapSelection: 'InvalidMapSelection',
  InvalidTerrainBrush: 'InvalidTerrainBrush',
  CellOutsideMap: 'CellOutsideMap',
  InvalidMapLayer: 'InvalidMapLayer',
  FurnitureNotFound: 'FurnitureNotFound',
  MapGeometryOperationRequired: 'MapGeometryOperationRequired',
  DoorNotFound: 'DoorNotFound',
  OpeningRequired: 'OpeningRequired',
  InvalidWallEdge: 'InvalidWallEdge',
  OpeningRequiresWall: 'OpeningRequiresWall',
  UnsupportedTemplateVersion: 'UnsupportedTemplateVersion',
  InvalidTemplateDimensions: 'InvalidTemplateDimensions',
  ObjectNotFound: 'ObjectNotFound',
  UnsupportedMapCommand: 'UnsupportedMapCommand',
  LocalitiesDisconnected: 'LocalitiesDisconnected',
  LocalityInUse: 'LocalityInUse',
  ResourceNotFound: 'ResourceNotFound',
  InvalidProjectResource: 'InvalidProjectResource',
} as const;

export type CampaignEditorRefusalCode =
  (typeof CampaignEditorRefusalCode)[keyof typeof CampaignEditorRefusalCode];

export type CampaignEditorRefusalDetails = Readonly<
  Record<string, string | number | readonly string[]>
>;

export type CampaignEditorRefusalSnapshot = Readonly<{
  code: CampaignEditorRefusalCode;
  details: CampaignEditorRefusalDetails;
}>;

export class CampaignEditorRefusal extends Error {
  readonly code: CampaignEditorRefusalCode;
  readonly details: CampaignEditorRefusalDetails;

  constructor(code: CampaignEditorRefusalCode, details: CampaignEditorRefusalDetails = {}) {
    super(code);
    this.name = 'CampaignEditorRefusal';
    this.code = code;
    this.details = Object.freeze(
      Object.fromEntries(
        Object.entries(details).map(([key, value]) => [
          key,
          Array.isArray(value) ? Object.freeze([...value]) : value,
        ]),
      ),
    );
  }

  snapshot(): CampaignEditorRefusalSnapshot {
    return { code: this.code, details: this.details };
  }
}
