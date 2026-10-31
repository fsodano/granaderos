import { canonicalContent } from './content-identity.js';

// The save owns one immutable package. Deployment requests refer to that exact
// package instead of repeating uploaded images and the full strategic world.
/** @returns {(key:string,value:unknown)=>unknown} */
export function campaignPackageSaveReplacer(state, replacer) {
  const definitions = state.contentCampaign?.package,
    hash = state.contentCampaign?.identity?.hash;
  const canonical = definitions && canonicalContent(definitions);
  return function (key, value) {
    if (key === 'campaignPackage' && hash && value && canonicalContent(value) === canonical) {
      return { campaignDefinitionRef: hash };
    }
    return replacer.call(this, key, value);
  };
}

export function restoreCampaignPackageReference(state, request) {
  const value = request?.campaignPackage;
  if (!value || !Object.hasOwn(value, 'campaignDefinitionRef')) {
    return;
  }
  if (
    Object.keys(value).length !== 1 ||
    !state.contentCampaign ||
    value.campaignDefinitionRef !== state.contentCampaign.identity.hash
  ) {
    throw Error('El contenido del despliegue no coincide con la campaña guardada.');
  }
  request.campaignPackage = state.contentCampaign.package;
}
