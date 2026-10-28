import { editorErrorMessage } from './editor-error-message.ts';
import { CampaignProject } from '../domain/campaign-project.ts';
import { InMemoryCampaignProjectRepository } from './in-memory-campaign-project-repository.ts';
import { ValidateCampaignProjectUseCase } from '../application/validate-campaign-project/validate-campaign-project.use-case.ts';
import {
  compileCampaignPackage,
  validateContentPackage,
  validateCampaignWorld,
  validateCampaignPresentation,
  validateMap,
  campaignContentReport,
} from '../../../packages/game/public/campaign-editor-api.js';
import { validateCampaignManifest } from '../../../packages/campaign-format/campaign-manifest.js';
import { resourceSHA256 } from '../../../packages/campaign-format/campaign-resources.js';
import { campaignRelativePath } from '../../../packages/campaign-format/campaign-assets.js';
import {
  assertCampaignProjectEnvelope,
  projectContent,
  campaignMapFile,
  projectResourceBytes,
} from '../domain/project-document.js';
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const validPath = campaignRelativePath;
/** @returns {Promise<{valid:boolean,issues:any[],content?:any,checks?:any}>} */
async function validateProjectDocuments(project) {
  const issues = [],
    add = (section, message, path) => {
      if (
        !issues.some(
          (issue) => issue.section === section && issue.message === message && issue.path === path,
        )
      )
        issues.push({ section, message, ...(path ? { path } : {}) });
    };
  try {
    assertCampaignProjectEnvelope(project);
  } catch (error) {
    add('project', editorErrorMessage(error));
    return { valid: false, issues };
  }
  try {
    validateCampaignManifest(project.manifest);
  } catch (error) {
    add('manifest', editorErrorMessage(error), 'manifest.json');
  }
  const combined = projectContent(project);
  for (const message of validateCampaignWorld(project.world, {
    headquarters: project.content.headquarters ?? project.world.defaultHeadquarters,
  }))
    add('world', message, project.manifest.world);
  for (const message of validateCampaignPresentation(project.presentation, combined))
    add('presentation', message, project.manifest.presentation);
  for (const message of validateContentPackage(combined))
    add('content', message, project.manifest.content);
  const paths = new Set(['manifest.json']);
  for (const field of ['content', 'world', 'presentation', 'maps', 'assets']) {
    const path = project.manifest[field];
    if (!validPath(path) || paths.has(path))
      add('manifest', `La ruta ${field} es inválida o está repetida.`, path);
    else paths.add(path);
  }
  const seen = new Set();
  if (!Array.isArray(project.mapIndex.maps) || !project.mapIndex.maps.length)
    add('maps', 'El proyecto necesita un índice de mapas.', project.manifest.maps);
  else
    for (const entry of project.mapIndex.maps) {
      if (
        !object(entry) ||
        typeof entry.id !== 'string' ||
        !Object.hasOwn(project.maps, entry.id) ||
        seen.has(entry.id)
      ) {
        add('maps', 'El índice contiene un mapa ausente o repetido.', project.manifest.maps);
        continue;
      }
      seen.add(entry.id);
      try {
        const path = campaignMapFile(project.manifest, entry.path);
        if (!path.endsWith('.json') || paths.has(path))
          add('maps', 'La ruta de mapa está repetida o no es JSON.', path);
        else paths.add(path);
      } catch (error) {
        add('maps', editorErrorMessage(error), project.manifest.maps);
      }
    }
  for (const [id, map] of Object.entries(project.maps)) {
    if (!seen.has(id)) add('maps', `El mapa ${id} no está en el índice.`, project.manifest.maps);
    const report = validateMap(map, { playable: project.manifest.scenario === 'generic-v1' });
    for (const message of report.errors) add('maps', `Mapa ${id}: ${message}`, id);
  }
  const required = new Set();
  let checkedBytes = 0;
  for (const asset of Array.isArray(project.assets.assets) ? project.assets.assets : []) {
    if (!object(asset) || !validPath(asset.path)) {
      add('assets', 'El catálogo tiene una ruta inválida.', project.manifest.assets);
      continue;
    }
    required.add(asset.path);
    if (paths.has(asset.path))
      add('assets', 'El recurso ocupa la ruta de un documento.', asset.path);
    try {
      const bytes = projectResourceBytes(project, asset.path);
      checkedBytes += bytes.length;
      if (project.resources[asset.path].type !== asset.type)
        add('assets', 'El tipo del archivo y el catálogo no coinciden.', asset.path);
      if ((await resourceSHA256(bytes)) !== asset.sha256)
        add('assets', 'Los bytes del recurso no coinciden con su suma de control.', asset.path);
    } catch (error) {
      add('assets', editorErrorMessage(error), asset.path);
    }
  }
  for (const path of Object.keys(project.resources))
    if (!required.has(path)) add('assets', 'El recurso no está declarado en assets.json.', path);
  let content;
  try {
    content = compileCampaignPackage(project.manifest, {
      content: project.content,
      world: project.world,
      maps: project.maps,
      presentation: project.presentation,
      assets: project.assets,
    });
    const report = campaignContentReport(content);
    for (const message of report.blocked) add('content', message);
  } catch (error) {
    add('package', editorErrorMessage(error));
  }
  return {
    valid: issues.length === 0,
    issues,
    ...(content ? { content } : {}),
    checks: {
      maps: Object.keys(project.maps).length,
      resources: required.size,
      resourceBytes: checkedBytes,
    },
  };
}

export class GameCampaignProjectValidator {
  async validate(document) {
    return validateProjectDocuments(document);
  }
}

/** @returns {Promise<{valid:boolean,issues:any[],content?:any,checks?:any}>} */
export async function validateCampaignProject(document) {
  try {
    const project = new CampaignProject(document);
    const repository = new InMemoryCampaignProjectRepository([project]);
    return await new ValidateCampaignProjectUseCase(
      repository,
      new GameCampaignProjectValidator(),
    ).execute({ projectId: project.id });
  } catch (error) {
    return { valid: false, issues: [{ section: 'project', message: editorErrorMessage(error) }] };
  }
}
