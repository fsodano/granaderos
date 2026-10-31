import { CampaignDefinition } from '../campaign-format/campaign-definition.ts';

export {
  validateCampaignManifest,
  validateCampaignRegistry,
} from '../campaign-format/campaign-manifest.js';
import { resolveContent } from './content-package.js';
import { validateCampaignWorld } from './campaign-definition.js';
import { validateMap } from './map-schema.js';
import { campaignContentReport } from './campaign-content.js';
import { validateCampaignData } from './campaign-data-validation.js';
import { validateCampaignAssets, validateSelectedCampaignAssets } from './campaign-assets.js';
export { campaignRelativePath } from './campaign-assets.js';

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const need = (ok, message) => {
  if (!ok) {
    throw Error(message);
  }
};
/**
 * Admit authored documents only after their schemas and references pass validation.
 * @param {unknown} manifest
 * @param {unknown} documents
 * @returns {import('../campaign-format/types.ts').CompiledCampaignContent}
 */
export function compileCampaignPackage(manifest, documents) {
  need(object(documents), 'La campaña necesita documentos válidos.');
  const { content, world, maps, presentation, assets } = documents;
  new CampaignDefinition(manifest, documents);
  const dataErrors = validateCampaignData({ manifest, content, world, maps, presentation, assets });
  need(!dataErrors.length, dataErrors.join('\n'));
  need(object(content) && content.id === manifest.id, 'El contenido pertenece a otra campaña.');
  for (const key of ['characters', 'weapons', 'placements']) {
    need(Array.isArray(content[key]), `El contenido necesita una lista de ${key}.`);
  }
  const errors = validateCampaignWorld(world, {
    headquarters: content.headquarters ?? world?.defaultHeadquarters,
  });
  need(!errors.length, errors.slice(0, 12).join('\n'));
  need(object(maps) && Object.keys(maps).length > 0, 'La campaña necesita mapas tácticos.');
  for (const [id, doc] of Object.entries(maps)) {
    need(
      /^[a-z][a-z0-9_-]{0,79}$/.test(id) &&
        !['constructor', 'prototype', '__proto__'].includes(id) &&
        doc?.id === id,
      `El mapa ${id} tiene otra identidad.`,
    );
    need(doc.width === 20 && doc.height === 16, `Mapa ${id}: se necesitan 20 columnas y 16 filas.`);
    const result = validateMap(doc, { playable: manifest.scenario === 'generic-v1' });
    need(result.valid, `Mapa ${id}: ${result.errors.slice(0, 4).join('; ')}`);
    if (manifest.scenario === 'generic-v1') {
      need(
        doc.spawns.some((s) => s.side === 'enemy'),
        `Mapa ${id}: falta una aparición adversaria.`,
      );
    }
    for (const building of doc.buildings ?? []) {
      need(
        !building.architecture || Object.hasOwn(world.buildings.types, building.architecture),
        `El mapa ${id} necesita el estilo ${building.architecture}.`,
      );
    }
  }
  for (const sector of world.sectors) {
    need(Object.hasOwn(maps, sector.id), `Falta el mapa de la localidad ${sector.id}.`);
  }
  for (const scene of Object.keys(world.sceneExits ?? {})) {
    need(Object.hasOwn(maps, scene), `Falta el mapa de la escena ${scene}.`);
  }
  need(
    object(presentation) && object(assets) && Array.isArray(assets.assets),
    'La campaña necesita presentación y recursos.',
  );
  const assetErrors = [
    ...validateCampaignAssets(assets),
    ...validateSelectedCampaignAssets(manifest.id, assets, [presentation, content, world, maps]),
  ];
  need(!assetErrors.length, assetErrors.slice(0, 12).join('\n'));
  const genericDefaults =
    manifest.scenario === 'generic-v1'
      ? { errands: [], roadsideDiscoveries: [], includeOriginalResidents: false }
      : {};
  const definitions = resolveContent({
    ...genericDefaults,
    ...content,
    scenario: manifest.scenario,
    world,
    maps,
    presentation,
    assets,
    campaignOrigin: { version: 1, id: manifest.id, revision: manifest.revision },
  });
  const report = campaignContentReport(definitions);
  need(!report.blocked.length, report.blocked.join('\n'));
  return definitions;
}
