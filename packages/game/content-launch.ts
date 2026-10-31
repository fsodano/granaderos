import type { CampaignOrigin } from '../campaign-format/types.ts';
import type { CampaignSnapshot } from './public/campaign-types.ts';
type CampaignLaunch = {
  campaignOrigin?: CampaignOrigin;
  contentCampaign?: {
    package?: { campaignOrigin?: CampaignOrigin };
    identity?: NonNullable<CampaignSnapshot['contentCampaign']>['identity'];
  };
};
// Separate storage prevents authored campaigns from replacing the normal save.
export const CONTENT_LAUNCH_KEY = 'granaderos.content-launch.v1';
export const CONTENT_SAVE_KEY = 'granaderos.content-campaign.v1';

export function campaignStorageKey(campaign: CampaignLaunch | null = null, search = '') {
  const params = new URLSearchParams(search);
  const origin = campaign?.campaignOrigin ?? campaign?.contentCampaign?.package?.campaignOrigin;
  const installedId = origin?.id ?? (!campaign ? params.get('campaign') : null);
  const suffix = params.get('qa') === '1' ? '.qa' : '';
  if (installedId) {
    return `granaderos.campaign.v2.${encodeURIComponent(installedId)}${suffix}`;
  }
  if (campaign?.contentCampaign) {
    const identity = campaign.contentCampaign.identity;
    if (!identity) {
      throw new Error('Campaign content needs an identity for storage.');
    }
    return `granaderos.content-campaign.v2.${encodeURIComponent(identity.packageId)}.${encodeURIComponent(identity.hash)}${suffix}`;
  }
  if (!campaign && params.get('content') === '1') {
    const id = params.get('contentId'),
      hash = params.get('contentHash');
    return id && hash
      ? `granaderos.content-campaign.v2.${encodeURIComponent(id)}.${encodeURIComponent(hash)}${suffix}`
      : `${CONTENT_SAVE_KEY}${suffix}`;
  }
  return `granaderos.campaign.v1${suffix}`;
}

// Old stock and editor saves remain available for a one-time explicit resume.
// Newly installed campaigns never use a legacy autosave destination.
export function campaignStorageCandidates(campaign: CampaignLaunch | null = null, search = '') {
  const params = new URLSearchParams(search),
    key = campaignStorageKey(campaign, search),
    suffix = params.get('qa') === '1' ? '.qa' : '';
  const id = campaign?.campaignOrigin?.id ?? params.get('campaign');
  const legacy =
    id === 'granaderos'
      ? `granaderos.campaign.v1${suffix}`
      : !id && params.get('content') === '1'
        ? `${CONTENT_SAVE_KEY}${suffix}`
        : null;
  return [...new Set([key, ...(legacy ? [legacy] : [])])];
}

export function campaignLaunchSearch(campaign: CampaignLaunch | null, search = '') {
  const params = new URLSearchParams(search);
  for (const key of ['campaign', 'content', 'contentId', 'contentHash', 'launch']) {
    params.delete(key);
  }
  const origin = campaign?.campaignOrigin ?? campaign?.contentCampaign?.package?.campaignOrigin;
  if (origin) {
    params.set('campaign', origin.id);
  } else if (campaign?.contentCampaign) {
    const identity = campaign.contentCampaign.identity;
    if (!identity) {
      throw new Error('Campaign content needs an identity for launch.');
    }
    params.set('content', '1');
    params.set('contentId', identity.packageId);
    params.set('contentHash', identity.hash);
  }
  return params.toString();
}
