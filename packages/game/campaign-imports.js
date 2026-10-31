import { validateImportRules as validateSchema } from '../campaign-format/campaign-location-schema.js';
export function validateImportRules(value, context = null) {
  return validateSchema(value, { world: campaignWorld(context) });
}
import { campaignSectors, campaignDefinitions, campaignWorld } from './campaign-definition.js';
import { DEFAULT_CONTENT } from '../../content/campaigns/default.js';
import { arrivalFacilityOptions } from './arrival-sites.js';

export const importPortsFor = (context) =>
  campaignSectors(context).filter((s) => arrivalFacilityOptions(s.id, context).includes('port'));
export const IMPORT_PORTS = Object.freeze(importPortsFor());
export const DEFAULT_IMPORT_RULES = Object.freeze(DEFAULT_CONTENT.imports);
export const importRulesFor = (state) =>
  campaignDefinitions(state)?.imports ??
  (campaignDefinitions(state)?.scenario === 'generic-v1'
    ? { port: null, minHours: 72, maxHours: 120 }
    : DEFAULT_IMPORT_RULES);
export const importPortName = (state) => {
  const port = importPortsFor(state).find((s) => s.id === importRulesFor(state).port);
  return port?.shortName ?? port?.name;
};

export function importOrderReason(state) {
  if (importRulesFor(state).port === null) {
    return 'Esta campaña no permite pedidos de armas importadas.';
  }
  if (state.sectors[importRulesFor(state).port]?.owner !== 'patriot') {
    return `Las importaciones requieren ${importPortName(state)} bajo control patriota.`;
  }
  if (state.reputation.foreign < 0) {
    return 'Los comerciantes extranjeros no están dispuestos a negociar.';
  }
  return null;
}
export function importDelayReason(state) {
  if (importRulesFor(state).port === null) {
    return 'Importaciones deshabilitadas';
  }
  if (state.sectors[importRulesFor(state).port]?.owner !== 'patriot') {
    return 'Demorado por ocupación del puerto';
  }
  if (state.blockade) {
    return 'Demorado por bloqueo';
  }
  return null;
}
