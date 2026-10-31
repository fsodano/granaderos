'use client';
import type { CampaignProjectDocument, JsonValue } from '../../domain/campaign-project.ts';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  registerPreviewAssets,
  subscribePreviewAssets,
  getPreviewAssetsRevision,
  sitePath,
} from '../../../web/game-preview-assets.js';

export function studioAssetURLs(project: CampaignProjectDocument | null): Map<string, string> {
  const urls = new Map<string, string>(),
    id = project?.manifest?.id;
  for (const [path, resource] of Object.entries(project?.resources ?? {})) {
    if (resource?.type?.startsWith('image/') && typeof resource.base64 === 'string') {
      urls.set(`/campaigns/${id}/${path}`, `data:${resource.type};base64,${resource.base64}`);
    }
  }
  return urls;
}

export function useStudioAssetResolver(project: CampaignProjectDocument | null) {
  const urls = useMemo(() => studioAssetURLs(project), [project]);
  useSyncExternalStore(subscribePreviewAssets, getPreviewAssetsRevision, () => 0);
  useEffect(() => {
    return registerPreviewAssets(urls);
  }, [urls]);
  return (reference: string) => urls.get(reference) ?? sitePath(reference);
}

export function replaceProjectImageReferences(
  value: JsonValue,
  from: string,
  to: string,
): JsonValue {
  if (typeof value === 'string') {
    return value === from ? to : value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => replaceProjectImageReferences(entry, from, to));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        replaceProjectImageReferences(entry, from, to),
      ]),
    );
  }
  return value;
}

export function projectAssetUsage(project: CampaignProjectDocument | null, path: string): string[] {
  if (!project) {
    return [];
  }
  const target = `/campaigns/${project.manifest.id}/${path}`,
    found: string[] = [];
  function visit(value: JsonValue | undefined, pointer: string) {
    if (value === target) {
      found.push(pointer);
    } else if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${pointer}.${index}`));
    } else if (value && typeof value === 'object') {
      for (const [key, entry] of Object.entries(value)) {
        visit(entry, `${pointer}.${key}`);
      }
    }
  }
  for (const key of ['content', 'world', 'presentation', 'maps'] as const) {
    visit(project[key], key);
  }
  return found;
}
