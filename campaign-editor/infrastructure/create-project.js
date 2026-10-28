import { scaffoldDocuments } from './project-scaffold.js';
import { encodeBase64 } from '../../campaign-format/campaign-resources.js';
/** @returns {Promise<any>} */
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
