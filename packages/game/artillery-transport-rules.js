export {
  ARTILLERY_TRANSPORT_FIELDS,
  validateArtilleryTransportRules,
} from '../campaign-format/campaign-rules-schema.js';
// Transport rates and charges are game tuning. Omission retains older packages.
export const DEFAULT_ARTILLERY_TRANSPORT = Object.freeze({
  enabled: true,
  cartsHours: 18,
  flotillaHours: 5,
  cartsFee: 0,
  flotillaFee: 0,
});

export const artilleryTransportRules = (s) =>
  s?.contentCampaign?.package.artilleryTransport ?? DEFAULT_ARTILLERY_TRANSPORT;
