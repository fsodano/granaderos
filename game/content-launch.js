// Separate storage prevents authored campaigns from replacing the normal save.
export const CONTENT_LAUNCH_KEY = "granaderos.content-launch.v1";
export const CONTENT_SAVE_KEY = "granaderos.content-campaign.v1";

export function campaignStorageKey(campaign=null,search='') {
  const params=new URLSearchParams(search);
  if(campaign?Boolean(campaign.contentCampaign):params.get('content')==='1')return CONTENT_SAVE_KEY;
  return params.get('qa')==='1'?'granaderos.campaign.v1.qa':'granaderos.campaign.v1';
}
