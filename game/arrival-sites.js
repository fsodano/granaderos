import {CAMPAIGN_SECTORS} from './data.js';

export const ARRIVAL_FACILITIES = Object.freeze({post:'Posta', barracks:'Cuartel', port:'Puerto', landing:'Embarcadero'});
const WATER_ACCESS = new Set(['buenos_aires','ensenada','san_nicolas','santa_fe']);
const PASSES = new Set(['uspallata','los_patos']);
export function arrivalFacilityOptions(sector) {
  if (!CAMPAIGN_SECTORS.some(s => s.id === sector) || PASSES.has(sector)) return [];
  return ['post','barracks', ...(WATER_ACCESS.has(sector) ? ['port','landing'] : [])];
}
export function defaultArrivalSites() {
  return [
    {sector:'retiro', facilities:['barracks']},
    {sector:'buenos_aires', facilities:['port','post']},
    {sector:'ensenada', facilities:['port']},
    {sector:'san_nicolas', facilities:['landing','post']},
    {sector:'santa_fe', facilities:['port','post']},
    ...['cordoba','mendoza','tucuman','salta','jujuy','humahuaca'].map(sector => ({sector, facilities:['post']})),
  ];
}
const BASELINE = Object.freeze(defaultArrivalSites().map(s => Object.freeze({...s,facilities:Object.freeze(s.facilities)})));
export function arrivalSitesFor(state) { return state.contentCampaign?.package.arrivalSites ?? BASELINE; }
export function arrivalSiteLabel(site) { return site.facilities.map(f => ARRIVAL_FACILITIES[f]).join(' · '); }
export function validateArrivalSites(sites) {
  if (!Array.isArray(sites) || sites.length > CAMPAIGN_SECTORS.length) return ['Llegadas: lista de puntos de recepción inválida.'];
  const seen = new Set(), errors = [];
  for (const site of sites) {
    if (!site || typeof site !== 'object' || Array.isArray(site) || Object.keys(site).length !== 2 || !Object.hasOwn(site,'sector') || !Object.hasOwn(site,'facilities')) {
      errors.push('Llegadas: punto de recepción inválido.'); continue;
    }
    const allowed = arrivalFacilityOptions(site.sector);
    if (seen.has(site.sector) || !allowed.length) errors.push(`Llegadas.${site.sector}: elegí una localidad con acceso habilitado, no una celda de agua ni un paso cordillerano.`);
    seen.add(site.sector);
    if (!Array.isArray(site.facilities) || !site.facilities.length || new Set(site.facilities).size !== site.facilities.length || !site.facilities.every(f => allowed.includes(f)))
      errors.push(`Llegadas.${site.sector}: infraestructura incompatible; los puertos y embarcaderos requieren acceso al río navegable.`);
  }
  return errors;
}
