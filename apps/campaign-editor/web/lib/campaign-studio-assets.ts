'use client';
import { useEffect, useMemo, useState } from 'react';
import { registerPreviewAssets, sitePath } from '../../../web/game-preview-assets.js';

export function studioAssetURLs(project: any): Map<string, string> {
  const urls = new Map<string, string>(),
    id = project?.manifest?.id;
  for (const [path, resource] of Object.entries(project?.resources ?? {}) as [string, any][]) {
    if (resource?.type?.startsWith('image/') && typeof resource.base64 === 'string')
      urls.set(`/campaigns/${id}/${path}`, `data:${resource.type};base64,${resource.base64}`);
  }
  return urls;
}

export function useStudioAssetResolver(project: any) {
  const urls = useMemo(() => studioAssetURLs(project), [project?.manifest?.id, project?.resources]),
    [, refresh] = useState(0);
  useEffect(() => {
    const release = registerPreviewAssets(urls);
    refresh((value) => value + 1);
    return release;
  }, [urls]);
  return (reference: string) => urls.get(reference) ?? sitePath(reference);
}

export function replaceProjectImageReferences(value: any, from: string, to: string): any {
  if (typeof value === 'string') return value === from ? to : value;
  if (Array.isArray(value))
    return value.map((entry) => replaceProjectImageReferences(entry, from, to));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        replaceProjectImageReferences(entry, from, to),
      ]),
    );
  return value;
}

export function projectAssetUsage(project: any, path: string): string[] {
  const target = `/campaigns/${project.manifest.id}/${path}`,
    found: string[] = [];
  function visit(value: any, pointer: string) {
    if (value === target) found.push(pointer);
    else if (Array.isArray(value))
      value.forEach((entry, index) => visit(entry, `${pointer}.${index}`));
    else if (value && typeof value === 'object')
      for (const [key, entry] of Object.entries(value)) visit(entry, `${pointer}.${key}`);
  }
  for (const key of ['content', 'world', 'presentation', 'maps']) visit(project[key], key);
  return found;
}
