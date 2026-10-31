import { campaignRelativePath } from '../../../../packages/campaign-format/campaign-assets.js';
import {
  assertCampaignManifest,
  assertCampaignRegistry,
  requireJsonDocument,
} from './editor-documents.ts';
import type {
  JsonValue,
  CampaignManifest,
  CampaignContent,
  CampaignPresentation,
  CampaignOrigin,
} from '../../../../packages/campaign-format/types.ts';
import { compileCampaignPackage } from '../../../../packages/game/public/campaign-editor-api.ts';
import { resourceSHA256 } from '../../../../packages/campaign-format/campaign-resources.js';
import { sitePath } from '../../../web/game-preview-assets.js';

export type CampaignEntry = { id: string; name: string; revision: string; manifest: string };
export type LoadedCampaign = {
  entry: CampaignEntry;
  manifest: CampaignManifest;
  content: CampaignContent;
  presentation: CampaignPresentation;
};
type Reader = (
  url: string,
  options?: RequestInit,
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<JsonValue>;
  arrayBuffer?: () => Promise<ArrayBuffer>;
}>;
const verifiedResources = new WeakMap<Reader, Map<string, Promise<void>>>();
export async function verifyCampaignResources(
  value:
    | CampaignContent
    | {
        contentCampaign?: { package: CampaignContent };
        campaignPackage?: CampaignContent;
        campaignOrigin?: CampaignOrigin;
      },
  {
    reader = fetch,
    signal,
    refresh = false,
  }: { reader?: Reader; signal?: AbortSignal; refresh?: boolean } = {},
): Promise<void> {
  const content =
      'contentCampaign' in value
        ? value.contentCampaign?.package
        : 'campaignPackage' in value
          ? value.campaignPackage
          : 'id' in value
            ? value
            : undefined,
    assets = content?.assets?.assets;
  if (!Array.isArray(assets) || !assets.length) {
    return;
  }
  const revision = content?.campaignOrigin?.revision ?? value?.campaignOrigin?.revision;
  const reinstall = revision
    ? `Instalá la revisión ${revision} usada por esta partida.`
    : 'Instalá la revisión usada por esta partida.';
  const descriptor = JSON.stringify([
    content?.id,
    assets.map((asset) => [asset.path, asset.sha256]),
  ]);
  let cache = verifiedResources.get(reader);
  if (!cache) {
    cache = new Map();
    verifiedResources.set(reader, cache);
  }
  const resourceCache = cache;
  let verified = refresh ? undefined : cache.get(descriptor);
  if (!verified) {
    verified = (async () => {
      for (let start = 0; start < assets.length; start += 4) {
        await Promise.all(
          assets.slice(start, start + 4).map(async (asset) => {
            if (signal?.aborted) {
              throw new DOMException('Aborted', 'AbortError');
            }
            if (!campaignRelativePath(asset.path) || !asset.path.startsWith('assets/')) {
              throw Error('La campaña tiene una ruta de recurso inválida.');
            }
            const path = `/campaigns/${content?.id}/${asset.path}`,
              response = await reader(sitePath(path), refresh ? { cache: 'no-store' } : undefined);
            if (!response.ok || !response.arrayBuffer) {
              throw Error(`Falta un recurso de la campaña: ${path}. ${reinstall}`);
            }
            const bytes = await response.arrayBuffer(),
              actual = await resourceSHA256(new Uint8Array(bytes));
            if (actual !== asset.sha256) {
              throw Error(`El recurso cambió: ${path}. ${reinstall}`);
            }
          }),
        );
      }
    })();
    cache.set(descriptor, verified);
    verified.catch(() => {
      if (resourceCache.get(descriptor) === verified) {
        resourceCache.delete(descriptor);
      }
    });
  }
  await verified;
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
}
function relativeFile(base: string, path: string) {
  if (!campaignRelativePath(path)) {
    throw Error('La campaña tiene una ruta de archivo inválida.');
  }
  return `${base}/${path}`;
}
async function readJSON(path: string, reader: Reader, signal?: AbortSignal) {
  const response = await reader(sitePath(path));
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  if (!response.ok) {
    throw Error(`No se pudo cargar la campaña (${response.status}): ${path}`);
  }
  return response.json();
}
export async function loadCampaignRegistry({
  reader = fetch,
  signal,
}: { reader?: Reader; signal?: AbortSignal } = {}) {
  const registry = await readJSON('/campaigns/index.json', reader, signal);
  assertCampaignRegistry(registry);
  return registry.campaigns;
}
export async function loadInstalledCampaign(
  entry: CampaignEntry,
  { reader = fetch, signal }: { reader?: Reader; signal?: AbortSignal } = {},
): Promise<LoadedCampaign> {
  const manifestPath = relativeFile('/campaigns', entry.manifest),
    base = manifestPath.slice(0, manifestPath.lastIndexOf('/'));
  const manifest = await readJSON(manifestPath, reader, signal);
  assertCampaignManifest(manifest);
  if (
    manifest.id !== entry.id ||
    manifest.name !== entry.name ||
    manifest.revision !== entry.revision
  ) {
    throw Error('El índice y la campaña no coinciden.');
  }
  const [content, world, indexValue, presentation, assets] = await Promise.all([
    readJSON(relativeFile(base, manifest.content), reader, signal),
    readJSON(relativeFile(base, manifest.world), reader, signal),
    readJSON(relativeFile(base, manifest.maps), reader, signal),
    readJSON(relativeFile(base, manifest.presentation), reader, signal),
    readJSON(relativeFile(base, manifest.assets), reader, signal),
  ]);
  const index = requireJsonDocument(indexValue);
  if (!Array.isArray(index['maps'])) {
    throw Error('Falta el índice de mapas de la campaña.');
  }
  const mapBase = relativeFile(base, manifest.maps).replace(/\/[^/]+$/, '');
  const maps: Record<string, JsonValue> = {};
  const loaded = await Promise.all(
    index['maps'].map(async (value) => {
      const item = requireJsonDocument(value);
      if (
        !item ||
        typeof item['id'] !== 'string' ||
        !item['id'] ||
        typeof item['path'] !== 'string'
      ) {
        throw Error('El índice de mapas contiene una entrada inválida.');
      }
      return [
        item['id'],
        await readJSON(relativeFile(mapBase, item['path']), reader, signal),
      ] as const;
    }),
  );
  for (const [id, map] of loaded) {
    if (Object.hasOwn(maps, id)) {
      throw Error(`El mapa ${id} está repetido.`);
    }
    maps[id] = map;
  }
  const resolved = compileCampaignPackage(manifest, { content, world, maps, presentation, assets });
  await verifyCampaignResources(resolved, signal ? { reader, signal } : { reader });
  return {
    entry,
    manifest,
    content: resolved,
    presentation: resolved.presentation,
  };
}
