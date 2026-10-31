import {
  loadCampaignRegistry,
  loadInstalledCampaign,
  type CampaignEntry,
} from './campaign-library.ts';

export const editorDraftKey = (kind: 'story' | 'sector', id: string) =>
  `granaderos.${kind}-draft.v2.${encodeURIComponent(id)}`;
export function editorCampaignContent(
  content: import('../../../../packages/campaign-format/types.ts').CampaignContent,
) {
  const draft = structuredClone(content);
  delete draft.campaignOrigin;
  return draft;
}
export async function editorCampaignBase() {
  const entries = await loadCampaignRegistry(),
    id = new URLSearchParams(window.location.search).get('campaign');
  const entry = entries.find((item) => item.id === id) ?? (!id ? entries[0] : null);
  if (!entry) {
    throw Error('La campaña seleccionada no está instalada.');
  }
  return { entries, loaded: await loadInstalledCampaign(entry) };
}
export function editorCampaignURL(entry: CampaignEntry) {
  const url = new URL(window.location.href);
  url.searchParams.set('campaign', entry.id);
  window.history.replaceState(null, '', url);
}
