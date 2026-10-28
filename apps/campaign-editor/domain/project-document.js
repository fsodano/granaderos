import { CampaignEditorRefusal, CampaignEditorRefusalCode } from './campaign-editor-refusal.ts';
import { campaignRelativePath } from '../../../packages/campaign-format/campaign-assets.js';
import { validateCampaignData } from '../../../packages/campaign-format/campaign-data-validation.js';
import {
  CAMPAIGN_RESOURCE_LIMITS as CAMPAIGN_PROJECT_LIMITS,
  campaignResourceType,
  decodeBase64,
  encodeBase64,
  resourceSHA256,
} from '../../../packages/campaign-format/campaign-resources.js';
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const copy = (value) => structuredClone(value);
const validId = (id) =>
  typeof id === 'string' &&
  /^[a-z][a-z0-9-]{0,79}$/.test(id) &&
  !['constructor', 'prototype'].includes(id);
const validPath = (path) => campaignRelativePath(path);
export function campaignMapFile(manifest, path) {
  if (!validPath(manifest?.maps) || !validPath(path))
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidMapResourcePath);
  const directory = manifest.maps.split('/').slice(0, -1).join('/');
  return directory ? `${directory}/${path}` : path;
}
/** Combine raw editable documents for previews; do not add a pinned save origin. */
export function projectContent(project) {
  const { campaignOrigin, campaignPackage, contentCampaign, ...content } = copy(project.content);
  return {
    ...content,
    scenario: project.manifest.scenario,
    world: copy(project.world),
    maps: copy(project.maps),
    presentation: copy(project.presentation),
    assets: copy(project.assets),
  };
}
/** @returns {any} */
export function updateProjectContent(project, next) {
  const result = copy(project),
    {
      world,
      maps,
      presentation,
      assets,
      campaignOrigin,
      campaignPackage,
      contentCampaign,
      scenario,
      ...content
    } = copy(next);
  result.content = content;
  if (world !== undefined) result.world = world;
  if (maps !== undefined) result.maps = maps;
  if (presentation !== undefined) result.presentation = presentation;
  if (assets !== undefined) result.assets = assets;
  // The manifest owns installed identity and trusted scenario selection.
  result.content.id = result.manifest.id;
  return result;
}
/** Atomic identity change across raw documents; external URLs stay untouched. */
export function renameCampaignProject(project, newId, newName) {
  if (!validId(newId))
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidProjectIdentity);
  if (
    newName !== undefined &&
    (typeof newName !== 'string' || !newName.trim() || newName.length > 100)
  )
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidProjectName);
  const oldId = project.manifest.id,
    prefix = `/campaigns/${oldId}/`,
    nextPrefix = `/campaigns/${newId}/`;
  const rewrite = (value) =>
    Array.isArray(value)
      ? value.map(rewrite)
      : object(value)
        ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewrite(child)]))
        : typeof value === 'string' && value.startsWith(prefix)
          ? nextPrefix + value.slice(prefix.length)
          : value;
  const result = rewrite(copy(project));
  result.manifest.id = newId;
  result.content.id = newId;
  if (newName !== undefined) {
    const oldName = result.manifest.name;
    result.manifest.name = newName;
    result.content.name = newName;
    if (result.presentation.title === oldName) result.presentation.title = newName;
  }
  if (newId !== oldId && result.manifest.scenario === 'granaderos-historical-v1') {
    result.manifest.scenario = 'generic-v1';
    result.content.scenario = 'generic-v1';
  }
  delete result.content.campaignOrigin;
  return result;
}
export function projectResourceBytes(project, path) {
  const resource = project.resources?.[path];
  if (!resource)
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.ResourceNotFound, { path });
  return decodeBase64(resource.base64);
}
/** @returns {Promise<any>} */
export async function setProjectResource(
  project,
  path,
  bytes,
  type = campaignResourceType(path),
  id,
) {
  if (
    !validPath(path) ||
    !path.startsWith('assets/') ||
    !type ||
    campaignResourceType(path) !== type
  )
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidResourceTypeOrPath);
  if (!(bytes instanceof Uint8Array) || bytes.length > CAMPAIGN_PROJECT_LIMITS.fileBytes)
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.ResourceTooLarge);
  const result = copy(project),
    existing = result.assets?.assets?.find((asset) => asset.path === path);
  const base =
    id ??
    existing?.id ??
    `asset-${path
      .slice(7)
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase()
      .slice(0, 65)}`;
  if (
    !validId(base) ||
    result.assets?.assets?.some((asset) => asset.path !== path && asset.id === base)
  )
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.ResourceIdentityInUse);
  result.resources ??= {};
  result.resources[path] = { type, base64: encodeBase64(bytes) };
  result.assets ??= { version: 1, assets: [] };
  result.assets.assets = result.assets.assets.filter((asset) => asset.path !== path);
  result.assets.assets.push({ id: base, path, sha256: await resourceSHA256(bytes), type });
  assertCampaignProjectEnvelope(result);
  return result;
}
export function removeProjectResource(project, path) {
  const result = copy(project);
  delete result.resources[path];
  result.assets.assets = result.assets.assets.filter((asset) => asset.path !== path);
  return result;
}
/** Structural admission only: invalid authored documents can remain as drafts. */
export function assertCampaignProjectEnvelope(project) {
  if (
    !object(project) ||
    project.format !== 'granaderos-editor-project' ||
    project.version !== 1 ||
    !object(project.manifest) ||
    !object(project.content) ||
    !object(project.world) ||
    !object(project.presentation) ||
    !object(project.maps) ||
    !object(project.mapIndex) ||
    !object(project.assets) ||
    !object(project.resources)
  )
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.IncompatibleProjectDocument);
  const errors = validateCampaignData(project);
  if (errors.length) throw Error(errors.join('\n'));
  if (!validId(project.manifest.id))
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidProjectIdentity);
  const entries = Object.entries(project.resources);
  if (entries.length > CAMPAIGN_PROJECT_LIMITS.files)
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.TooManyProjectResources);
  let total = 0;
  for (const [path, value] of entries) {
    if (
      !validPath(path) ||
      !path.startsWith('assets/') ||
      !object(value) ||
      typeof value.type !== 'string'
    )
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidProjectResource, { path });
    total += decodeBase64(value.base64).length;
  }
  if (total > CAMPAIGN_PROJECT_LIMITS.totalBytes)
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.ProjectResourcesTooLarge);
  return project;
}
export function encodeCampaignProject(project) {
  assertCampaignProjectEnvelope(project);
  return JSON.stringify(project, null, 2);
}
export function decodeCampaignProject(text) {
  if (
    typeof text !== 'string' ||
    new TextEncoder().encode(text).length > CAMPAIGN_PROJECT_LIMITS.totalBytes * 2
  )
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.ProjectDocumentTooLarge);
  return assertCampaignProjectEnvelope(JSON.parse(text));
}
