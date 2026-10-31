import { CampaignEditorRefusal, CampaignEditorRefusalCode } from './campaign-editor-refusal.ts';
export const CAMPAIGN_MAP_DIMENSIONS = Object.freeze({ width: 20, height: 16 });
const TERRACE_LEVEL = 1;

export class CampaignMap {
  #document;

  constructor(document) {
    this.#document = structuredClone(document);
  }
  snapshot() {
    return structuredClone(this.#document);
  }

  replace(document) {
    if (
      document.id !== this.#document.id ||
      document.width !== CAMPAIGN_MAP_DIMENSIONS.width ||
      document.height !== CAMPAIGN_MAP_DIMENSIONS.height
    ) {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.IncompatibleCampaignMap);
    }
    this.#document = structuredClone(document);
  }

  setBuildingSlab(buildingId, geometry, terraceGeometry) {
    const document = this.snapshot();
    const building = document.buildings.find((candidate) => candidate.id === buildingId);
    if (!building) {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.BuildingNotFound);
    }
    const previous = (document.upperSurfaces ?? []).filter(
      (surface) => surface.buildingId === buildingId,
    );
    const onPrevious = (point) =>
      previous.some(
        (surface) =>
          surface.x === point.x &&
          surface.y === point.y &&
          (surface.tacticalLevel ?? 0) === (point.tacticalLevel ?? 0),
      );
    document.upperSurfaces = (document.upperSurfaces ?? []).filter(
      (surface) => surface.buildingId !== buildingId,
    );
    document.climbLinks = (document.climbLinks ?? []).filter(
      (link) => !onPrevious(link.from) && !onPrevious(link.to),
    );
    if (geometry) {
      const candidates = [
        ...Array.from({ length: building.height }, (_, offset) => ({
          from: { x: building.x - 1, y: building.y + offset },
          to: { x: building.x, y: building.y + offset },
        })),
        ...Array.from({ length: building.width }, (_, offset) => ({
          from: { x: building.x + offset, y: building.y - 1 },
          to: { x: building.x + offset, y: building.y },
        })),
      ];
      const access = candidates.find((candidate) =>
        terraceGeometry.isClear(document, candidate.from),
      );
      if (!access) {
        throw new CampaignEditorRefusal(CampaignEditorRefusalCode.RoofAccessUnavailable);
      }
      building.roof = 'terrace';
      const roof = terraceGeometry.build(building, {
        ...geometry,
        tacticalLevel: TERRACE_LEVEL,
        climbPoints: [{ id: 'editor-access', ...access }],
      });
      document.upperSurfaces.push(...roof.upperSurfaces);
      document.climbLinks.push(...roof.climbLinks);
    }
    document.revision += 1;
    this.#document = document;
  }
}
