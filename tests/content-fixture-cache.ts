import { present } from './assert-present.ts';
import type { CampaignContent } from '../packages/campaign-format/types.ts';
import { canonicalContent } from '../packages/game/content-identity.js';
import { defaultContentPackage } from '../packages/game/content-package.js';

// Each distinct authored package still earns its fixture through real orders.
// Repeated consumers receive independent copies of that exact completed setup.
export function contentFixtureCache<T>(
  prepare: (content?: CampaignContent) => T,
): (content?: CampaignContent) => T {
  const prepared = new Map<string, { value: T }>();
  return (content?: CampaignContent) => {
    const key = present(canonicalContent(content ?? defaultContentPackage()));
    let entry = prepared.get(key);
    if (!entry) {
      entry = { value: structuredClone(prepare(content)) };
      prepared.set(key, entry);
    }
    return structuredClone(entry.value);
  };
}
