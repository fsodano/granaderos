import type {
  CampaignContent,
  CampaignManifest,
  CampaignPresentation,
} from '../../../packages/campaign-format/types.ts';
import type { CampaignContext } from '../../../packages/game/public/compatibility-types.ts';
import {
  campaignRelativePath,
  compileCampaignPackage,
  validateCampaignManifest,
  validateCampaignRegistry,
} from '../../../packages/game/campaign-library.js';
import { sitePath } from './site-path.js';

export type CampaignEntry = {
  id: string;
  name: string;
  revision: string;
  manifest: string;
};
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
  json: () => Promise<unknown>;
  arrayBuffer?: () => Promise<ArrayBuffer>;
}>;
const verifiedResources = new WeakMap<Reader, Map<string, Promise<void>>>();
export async function verifyCampaignResources(
  value: CampaignContext,
  {
    reader = fetch,
    signal,
    refresh = false,
  }: { reader?: Reader; signal?: AbortSignal; refresh?: boolean } = {},
): Promise<void> {
  const content = contentFor(value),
    assets = content?.assets?.assets;
  if (!content || !Array.isArray(assets) || !assets.length) {
    return;
  }
  if (typeof content.id !== 'string') {
    throw Error('La campaña no tiene una identidad válida.');
  }
  const revision = content?.campaignOrigin?.revision;
  const reinstall = revision
    ? `Instalá la revisión ${revision} usada por esta partida.`
    : 'Instalá la revisión usada por esta partida.';
  const descriptor = JSON.stringify([
    content.id,
    assets.map((asset) => [asset.path, asset.sha256]),
  ]);
  let cache = verifiedResources.get(reader);
  if (!cache) {
    cache = new Map();
    verifiedResources.set(reader, cache);
  }
  let verified = refresh ? undefined : cache.get(descriptor);
  if (!verified) {
    verified = (async () => {
      for (let start = 0; start < assets.length; start += 4) {
        await Promise.all(
          assets.slice(start, start + 4).map(async (asset) => {
            if (signal?.aborted) {
              throw new DOMException('Aborted', 'AbortError');
            }
            if (
              !campaignRelativePath(asset.path) ||
              !asset.path.startsWith('assets/')
            ) {
              throw Error('La campaña tiene una ruta de recurso inválida.');
            }
            const path = `/campaigns/${content.id}/${asset.path}`,
              response = await reader(
                sitePath(path),
                refresh ? { cache: 'no-store' } : undefined,
              );
            if (!response.ok || !response.arrayBuffer) {
              throw Error(
                `Falta un recurso de la campaña: ${path}. ${reinstall}`,
              );
            }
            const bytes = await response.arrayBuffer(),
              digest = await crypto.subtle.digest('SHA-256', bytes),
              actual = Array.from(new Uint8Array(digest), (byte) =>
                byte.toString(16).padStart(2, '0'),
              ).join('');
            if (actual !== asset.sha256) {
              throw Error(`El recurso cambió: ${path}. ${reinstall}`);
            }
          }),
        );
      }
    })();
    cache.set(descriptor, verified);
    verified.catch(() => {
      if (cache.get(descriptor) === verified) {
        cache.delete(descriptor);
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
  assertRegistry(registry);
  return registry.campaigns;
}
export async function loadInstalledCampaign(
  entry: CampaignEntry,
  { reader = fetch, signal }: { reader?: Reader; signal?: AbortSignal } = {},
): Promise<LoadedCampaign> {
  const manifestPath = relativeFile('/campaigns', entry.manifest),
    base = manifestPath.slice(0, manifestPath.lastIndexOf('/'));
  const manifest = await readJSON(manifestPath, reader, signal);
  assertManifest(manifest);
  if (
    manifest.id !== entry.id ||
    manifest.name !== entry.name ||
    manifest.revision !== entry.revision
  ) {
    throw Error('El índice y la campaña no coinciden.');
  }
  const names = ['content', 'world', 'maps', 'presentation', 'assets'] as const;
  const documents = await Promise.all(
    names.map((name) =>
      readJSON(relativeFile(base, manifest[name]), reader, signal),
    ),
  );
  const [content, world, index, presentation, assets] = documents;
  assertMapIndex(index);
  const mapBase = relativeFile(base, manifest.maps).replace(/\/[^/]+$/, '');
  const maps: Record<string, unknown> = {};
  const loaded = await Promise.all(
    index.maps.map(async (item) => {
      if (
        !item ||
        typeof item.id !== 'string' ||
        !item.id ||
        typeof item.path !== 'string'
      ) {
        throw Error('El índice de mapas contiene una entrada inválida.');
      }
      return [
        item.id,
        await readJSON(relativeFile(mapBase, item.path), reader, signal),
      ] as const;
    }),
  );
  for (const [id, map] of loaded) {
    if (Object.hasOwn(maps, id)) {
      throw Error(`El mapa ${id} está repetido.`);
    }
    maps[id] = map;
  }
  const resolved: CampaignContent = compileCampaignPackage(manifest, {
    content,
    world,
    maps,
    presentation,
    assets,
  });
  if (!resolved.presentation) {
    throw Error('Falta la presentación de la campaña.');
  }
  await verifyCampaignResources(resolved, {
    reader,
    ...(signal ? { signal } : {}),
  });
  return {
    entry,
    manifest,
    content: resolved,
    presentation: resolved.presentation,
  };
}

function contentFor(context: CampaignContext): Partial<CampaignContent> | null {
  if (!context) {
    return null;
  }
  if ('contentCampaign' in context && context.contentCampaign) {
    return context.contentCampaign.package;
  }
  if ('campaignPackage' in context && context.campaignPackage) {
    return context.campaignPackage;
  }
  return 'characters' in context ? context : null;
}
function assertRegistry(
  value: unknown,
): asserts value is { campaigns: CampaignEntry[] } {
  validateCampaignRegistry(value);
}
function assertManifest(value: unknown): asserts value is CampaignManifest {
  validateCampaignManifest(value);
}
function assertMapIndex(
  value: unknown,
): asserts value is { maps: { id: string; path: string }[] } {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('maps' in value) ||
    !Array.isArray(value.maps) ||
    !value.maps.every(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        typeof item.id === 'string' &&
        item.id.length > 0 &&
        'path' in item &&
        typeof item.path === 'string',
    )
  ) {
    throw Error('Falta el índice de mapas de la campaña.');
  }
}
