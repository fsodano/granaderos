import { scaffoldDocuments } from './project-scaffold.ts';
import { encodeBase64 } from '../../../packages/campaign-format/campaign-resources.js';
/** @param {string} id @param {string} name @returns {Promise<import("../domain/campaign-project.ts").CampaignProjectDocument>} */
export async function createCampaignProject(id, name) {
  const { manifest, content, world, presentation, maps, assets, image } = scaffoldDocuments(
    id,
    name,
  );
  return {
    format: 'granaderos-editor-project',
    version: 1,
    manifest,
    content,
    world,
    presentation,
    maps,
    mapIndex: { maps: Object.keys(maps).map((id) => ({ id, path: `${id}.json` })) },
    assets,
    resources: { 'assets/guide.png': { type: 'image/png', base64: encodeBase64(image) } },
  };
}
