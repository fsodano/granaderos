import { CampaignWorld } from '../domain/campaign-world.js';
import { CampaignMap } from '../domain/campaign-map.js';
import { CampaignBuildingTemplates } from '../domain/campaign-building-templates.js';
import {
  compileMap,
  buildTerrace,
  propBlocksAt,
  blankMap,
  validateMap,
} from '../../../packages/game/public/campaign-editor-api.ts';

const DEFAULT_LOCALITY_SPAWNS = Object.freeze([
  { id: 'entry', x: 3, y: 8, side: 'player' },
  { id: 'opposition', x: 16, y: 8, side: 'enemy' },
]);

function editWorld(project, edit) {
  const world = new CampaignWorld(project);
  edit(world);
  return world.snapshot();
}

/** @param {import("../domain/campaign-project.ts").CampaignProjectDocument} project
 * @returns {import("../domain/campaign-project.ts").CampaignProjectDocument} */
export function addProjectLocality(project, options) {
  const document = blankMap({ id: options.id, title: options.name });
  document.spawns = structuredClone(DEFAULT_LOCALITY_SPAWNS);
  return editWorld(project, (world) => world.addLocality(options, document));
}
/** @param {import("../domain/campaign-project.ts").CampaignProjectDocument} project
 * @returns {import("../domain/campaign-project.ts").CampaignProjectDocument} */
export function moveProjectLocality(project, id, cellId) {
  return editWorld(project, (world) => world.moveLocality(id, cellId));
}
/** @param {import("../domain/campaign-project.ts").CampaignProjectDocument} project
 * @returns {import("../domain/campaign-project.ts").CampaignProjectDocument} */
export function updateProjectLocality(project, id, fields) {
  return editWorld(project, (world) => world.updateLocality(id, fields));
}
/** @param {import("../domain/campaign-project.ts").CampaignProjectDocument} project
 * @param {string|null} [localityId]
 * @returns {import("../domain/campaign-project.ts").CampaignProjectDocument} */
export function setProjectDistrict(project, cellId, localityId = null) {
  return editWorld(project, (world) => world.assignDistrict(cellId, localityId));
}
/** @param {import("../domain/campaign-project.ts").CampaignProjectDocument} project
 * @returns {import("../domain/campaign-project.ts").CampaignProjectDocument} */
export function updateProjectCell(project, cellId, fields) {
  return editWorld(project, (world) => world.updateCell(cellId, fields));
}
/** @param {import("../domain/campaign-project.ts").CampaignProjectDocument} project
 * @returns {import("../domain/campaign-project.ts").CampaignProjectDocument} */
export function setProjectLocalityLink(project, from, to, connected) {
  return editWorld(project, (world) => world.connectLocalities(from, to, connected));
}
/** @param {import("../domain/campaign-project.ts").CampaignProjectDocument} project
 * @returns {import("../domain/campaign-project.ts").CampaignProjectDocument} */
export function deleteProjectLocality(project, id) {
  return editWorld(project, (world) => world.deleteLocality(id));
}
/** @param {import("../domain/campaign-project.ts").CampaignProjectDocument} project
 * @returns {import("../domain/campaign-project.ts").CampaignProjectDocument} */
export function setProjectMap(project, id, document) {
  const map = new CampaignMap(project.maps[id] ?? { id });
  map.replace(document);
  const report = validateMap(map.snapshot());
  if (!report.valid) {
    throw Error(report.errors.join('\n'));
  }
  return { ...project, maps: { ...project.maps, [id]: map.snapshot() } };
}
/** @param {import("../domain/campaign-project.ts").CampaignProjectDocument} project
 * @returns {import("../domain/campaign-project.ts").CampaignProjectDocument} */
export function saveProjectBuildingTemplate(project, template) {
  const templates = new CampaignBuildingTemplates(project.editor?.buildingTemplates ?? []);
  templates.save(template);
  return { ...project, editor: { ...project.editor, buildingTemplates: templates.snapshot() } };
}
/** @param {import("../domain/campaign-project.ts").CampaignProjectDocument} project
 * @returns {import("../domain/campaign-project.ts").CampaignProjectDocument} */
export function setProjectBuildingSlab(project, mapId, buildingId, geometry) {
  const map = new CampaignMap(project.maps[mapId]);
  let compiled;
  map.setBuildingSlab(buildingId, geometry, {
    isClear(document, point) {
      compiled ??= compileMap(document);
      return (
        point.x >= 0 &&
        point.y >= 0 &&
        point.x < compiled.width &&
        point.y < compiled.height &&
        compiled.tiles.some(
          (tile) => tile.x === point.x && tile.y === point.y && !tile.blocked && !tile.buildingId,
        ) &&
        !propBlocksAt(compiled, point.x, point.y)
      );
    },
    build: buildTerrace,
  });
  return setProjectMap(project, mapId, map.snapshot());
}
