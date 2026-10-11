import {campaignWorld,campaignSectors} from './campaign-definition.js';
import {DEFAULT_CONTENT} from '../campaigns/default.js';

export const ARRIVAL_FACILITIES = Object.freeze({post:'Posta', barracks:'Cuartel', port:'Puerto', landing:'Embarcadero'});
export function arrivalFacilityOptions(sector,context=null) {
 const world=campaignWorld(context);
 return world.arrivalFacilities?.[sector]??[];
}
export function defaultArrivalSites(){return structuredClone(DEFAULT_CONTENT.arrivalSites);}
const BASELINE = Object.freeze(defaultArrivalSites().map(s => Object.freeze({...s,facilities:Object.freeze(s.facilities)})));
export function arrivalSitesFor(state) { return state.contentCampaign?.package.arrivalSites ?? BASELINE; }
export function arrivalSiteLabel(site) { return site.facilities.map(f => ARRIVAL_FACILITIES[f]).join(' · '); }
export function validateArrivalSites(sites,context=null) {
  if (!Array.isArray(sites) || sites.length > campaignSectors(context).length) return ['Llegadas: lista de puntos de recepción inválida.'];
  const seen = new Set(), errors = [];
  for (const site of sites) {
    if (!site || typeof site !== 'object' || Array.isArray(site) || Object.keys(site).length !== 2 || !Object.hasOwn(site,'sector') || !Object.hasOwn(site,'facilities')) {
      errors.push('Llegadas: punto de recepción inválido.'); continue;
    }
    const allowed = arrivalFacilityOptions(site.sector,context);
    if (seen.has(site.sector) || !allowed.length) errors.push(`Llegadas.${site.sector}: elegí una localidad con acceso habilitado, no una celda de agua ni un paso cordillerano.`);
    seen.add(site.sector);
    if (!Array.isArray(site.facilities) || !site.facilities.length || new Set(site.facilities).size !== site.facilities.length || !site.facilities.every(f => allowed.includes(f)))
      errors.push(`Llegadas.${site.sector}: infraestructura incompatible; los puertos y embarcaderos requieren acceso al río navegable.`);
  }
  return errors;
}
