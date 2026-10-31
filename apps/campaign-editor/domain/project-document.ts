import type { CampaignProjectDocument, JsonDocument } from './campaign-project.ts';
import type { JsonValue } from '../../../packages/campaign-format/types.ts';
import { CampaignEditorRefusal, CampaignEditorRefusalCode } from './campaign-editor-refusal.ts';
import { campaignRelativePath } from '../../../packages/campaign-format/campaign-assets.js';
import { validateCampaignData } from '../../../packages/campaign-format/campaign-data-validation.ts';
import {
  CAMPAIGN_RESOURCE_LIMITS as CAMPAIGN_PROJECT_LIMITS,
  campaignResourceType,
  decodeBase64,
  encodeBase64,
  resourceSHA256,
} from '../../../packages/campaign-format/campaign-resources.js';
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const jsonValue = (value: unknown): value is JsonValue =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value)) ||
  (Array.isArray(value)
    ? value.every(jsonValue)
    : object(value) && Object.values(value).every(jsonValue));
const jsonDocument = (value: unknown): value is JsonDocument =>
  object(value) && Object.values(value).every(jsonValue);
function requireDocument(value: unknown): JsonDocument {
  if (!jsonDocument(value)) {
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.IncompatibleProjectDocument);
  }
  return value;
}
function mapDocuments(value: unknown): Record<string, JsonDocument> {
  if (!object(value)) {
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.IncompatibleProjectDocument);
  }
  return Object.fromEntries(
    Object.entries(value).map(([id, document]) => [id, requireDocument(document)]),
  );
}
function assetRecords(project: CampaignProjectDocument): JsonDocument[] {
  const records = project.assets['assets'];
  if (!Array.isArray(records) || !records.every(jsonDocument)) {
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.IncompatibleProjectDocument);
  }
  return records;
}
const copy = <Value>(value: Value): Value => structuredClone(value);
const validId = (id: unknown): id is string =>
  typeof id === 'string' &&
  /^[a-z][a-z0-9-]{0,79}$/.test(id) &&
  !['constructor', 'prototype'].includes(id);
const validPath = (path: unknown): path is string =>
  typeof path === 'string' && campaignRelativePath(path);
export function campaignMapFile(manifest: JsonDocument, path: string): string {
  if (!validPath(manifest['maps']) || !validPath(path)) {
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidMapResourcePath);
  }
  const directory = manifest['maps'].split('/').slice(0, -1).join('/');
  return directory ? `${directory}/${path}` : path;
}
export function projectContent(project: CampaignProjectDocument): JsonDocument {
  const {
    campaignOrigin: _campaignOrigin,
    campaignPackage: _campaignPackage,
    contentCampaign: _contentCampaign,
    ...content
  } = copy(project.content);
  return {
    ...content,
    ...(project.manifest['scenario'] === undefined
      ? {}
      : { scenario: project.manifest['scenario'] }),
    world: copy(project.world),
    maps: copy(project.maps),
    presentation: copy(project.presentation),
    assets: copy(project.assets),
  };
}
export function updateProjectContent(
  project: CampaignProjectDocument,
  next: JsonDocument,
): CampaignProjectDocument {
  const result = copy(project),
    {
      world,
      maps,
      presentation,
      assets,
      campaignOrigin: _campaignOrigin,
      campaignPackage: _campaignPackage,
      contentCampaign: _contentCampaign,
      scenario: _scenario,
      ...content
    } = copy(next);
  result.content = content;
  if (world !== undefined) {
    result.world = requireDocument(world);
  }
  if (maps !== undefined) {
    result.maps = mapDocuments(maps);
  }
  if (presentation !== undefined) {
    result.presentation = requireDocument(presentation);
  }
  if (assets !== undefined) {
    result.assets = requireDocument(assets);
  }
  // The manifest owns installed identity and trusted scenario selection.
  result.content['id'] = result.manifest['id'];
  return result;
}
export function renameCampaignProject(
  project: CampaignProjectDocument,
  newId: string,
  newName?: string,
): CampaignProjectDocument {
  if (!validId(newId)) {
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidProjectIdentity);
  }
  if (
    newName !== undefined &&
    (typeof newName !== 'string' || !newName.trim() || newName.length > 100)
  ) {
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidProjectName);
  }
  const oldId = project.manifest['id'],
    prefix = `/campaigns/${oldId}/`,
    nextPrefix = `/campaigns/${newId}/`;
  const rewrite = (value: JsonValue): JsonValue =>
    Array.isArray(value)
      ? value.map(rewrite)
      : object(value)
        ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewrite(child)]))
        : typeof value === 'string' && value.startsWith(prefix)
          ? nextPrefix + value.slice(prefix.length)
          : value;
  const result = assertCampaignProjectEnvelope(rewrite(copy(project)));
  result.manifest['id'] = newId;
  result.content['id'] = newId;
  if (newName !== undefined) {
    const oldName = result.manifest['name'];
    result.manifest['name'] = newName;
    result.content['name'] = newName;
    if (result.presentation['title'] === oldName) {
      result.presentation['title'] = newName;
    }
  }
  if (newId !== oldId && result.manifest['scenario'] === 'granaderos-historical-v1') {
    result.manifest['scenario'] = 'generic-v1';
    result.content['scenario'] = 'generic-v1';
  }
  delete result.content['campaignOrigin'];
  return result;
}
export function projectResourceBytes(project: CampaignProjectDocument, path: string): Uint8Array {
  const resource = project.resources?.[path];
  if (!resource) {
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.ResourceNotFound, { path });
  }
  return decodeBase64(resource.base64);
}
export async function setProjectResource(
  project: CampaignProjectDocument,
  path: string,
  bytes: Uint8Array,
  type: string | null = campaignResourceType(path),
  id?: string,
): Promise<CampaignProjectDocument> {
  if (
    !validPath(path) ||
    !path.startsWith('assets/') ||
    !type ||
    campaignResourceType(path) !== type
  ) {
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidResourceTypeOrPath);
  }
  if (!(bytes instanceof Uint8Array) || bytes.length > CAMPAIGN_PROJECT_LIMITS.fileBytes) {
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.ResourceTooLarge);
  }
  const result = copy(project),
    existing = assetRecords(result).find((asset) => asset['path'] === path);
  const base =
    id ??
    (typeof existing?.['id'] === 'string' ? existing['id'] : undefined) ??
    `asset-${path
      .slice(7)
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase()
      .slice(0, 65)}`;
  if (
    !validId(base) ||
    assetRecords(result).some((asset) => asset['path'] !== path && asset['id'] === base)
  ) {
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.ResourceIdentityInUse);
  }
  result.resources ??= {};
  result.resources[path] = { type, base64: encodeBase64(bytes) };
  result.assets ??= { version: 1, assets: [] };
  result.assets['assets'] = assetRecords(result).filter((asset) => asset['path'] !== path);
  result.assets['assets'].push({ id: base, path, sha256: await resourceSHA256(bytes), type });
  assertCampaignProjectEnvelope(result);
  return result;
}
export function removeProjectResource(
  project: CampaignProjectDocument,
  path: string,
): CampaignProjectDocument {
  const result = copy(project);
  delete result.resources[path];
  result.assets['assets'] = assetRecords(result).filter((asset) => asset['path'] !== path);
  return result;
}
/** Admits the project envelope while retaining incomplete authored JSON documents. */
export function assertCampaignProjectEnvelope(project: unknown): CampaignProjectDocument {
  const errors: string[] = validateCampaignData(project);
  if (errors.length) {
    throw new Error(errors.join('\n'));
  }
  const value = requireDocument(project);
  if (value['format'] !== 'granaderos-editor-project' || value['version'] !== 1) {
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.IncompatibleProjectDocument);
  }
  const manifest = requireDocument(value['manifest']);
  const id = manifest['id'];
  if (!validId(id)) {
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidProjectIdentity);
  }
  const resources = requireDocument(value['resources']);
  const entries = Object.entries(resources);
  if (entries.length > CAMPAIGN_PROJECT_LIMITS.files) {
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.TooManyProjectResources);
  }
  const admittedResources: CampaignProjectDocument['resources'] = {};
  let total = 0;
  for (const [path, resource] of entries) {
    if (
      !validPath(path) ||
      !path.startsWith('assets/') ||
      !object(resource) ||
      typeof resource['type'] !== 'string' ||
      typeof resource['base64'] !== 'string'
    ) {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidProjectResource, { path });
    }
    total += decodeBase64(resource['base64']).length;
    admittedResources[path] = { type: resource['type'], base64: resource['base64'] };
  }
  if (total > CAMPAIGN_PROJECT_LIMITS.totalBytes) {
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.ProjectResourcesTooLarge);
  }
  return {
    ...value,
    format: 'granaderos-editor-project',
    version: 1,
    manifest: { ...manifest, id },
    content: requireDocument(value['content']),
    world: requireDocument(value['world']),
    presentation: requireDocument(value['presentation']),
    maps: mapDocuments(value['maps']),
    mapIndex: requireDocument(value['mapIndex']),
    assets: requireDocument(value['assets']),
    resources: admittedResources,
    ...(value['editor'] === undefined ? {} : { editor: requireDocument(value['editor']) }),
  };
}
export function encodeCampaignProject(project: CampaignProjectDocument): string {
  assertCampaignProjectEnvelope(project);
  return JSON.stringify(project, null, 2);
}
export function decodeCampaignProject(text: string): CampaignProjectDocument {
  if (
    typeof text !== 'string' ||
    new TextEncoder().encode(text).length > CAMPAIGN_PROJECT_LIMITS.totalBytes * 2
  ) {
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.ProjectDocumentTooLarge);
  }
  const value: unknown = JSON.parse(text);
  return assertCampaignProjectEnvelope(value);
}
