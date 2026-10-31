import { DEFAULT_WORLD, DEFAULT_PRESENTATION } from '../../content/campaigns/default.js';
import { validateCampaignPhysical } from './campaign-physical-validation.js';
import { validateWorldData } from './campaign-world-validation.js';
import { validateCampaignPresentation } from './campaign-presentation-validation.js';
import { validateCampaignData } from './campaign-data-validation.js';
import { validateCampaignAssets, validateSelectedCampaignAssets } from './campaign-assets.js';

export { CAMPAIGN_GRID } from './world-grid.js';
/**
 * @param {import('./public/compatibility-types.ts').CampaignContext} [value]
 * @returns {Partial<import('../campaign-format/types.ts').CampaignContent> | null | undefined}
 */
export const campaignDefinitions = (value) =>
  value?.contentCampaign?.package ?? value?.campaignPackage ?? value;
/** @param {import('./public/compatibility-types.ts').CampaignContext} [value] @returns {import('../campaign-format/types.ts').WorldDefinition} */
export const campaignWorld = (value) => campaignDefinitions(value)?.world ?? DEFAULT_WORLD;
/** @param {import('./public/compatibility-types.ts').CampaignContext} [value] */
export const campaignSectors = (value) => campaignWorld(value).sectors;
/** @param {import('./public/compatibility-types.ts').CampaignContext} [value] */
export const campaignFactions = (value) => campaignWorld(value).factions;
/** @param {import('./public/compatibility-types.ts').CampaignContext} [value] */
export const campaignCities = (value) => campaignWorld(value).cities;
/** @param {import('./public/compatibility-types.ts').CampaignContext} [value] @returns {import('../campaign-format/types.ts').CampaignPresentation} */
export const campaignPresentation = (value) =>
  campaignDefinitions(value)?.presentation ?? DEFAULT_PRESENTATION;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = (value) =>
  typeof value === 'string' &&
  /^[a-z][a-z0-9_-]{0,79}$/.test(value) &&
  !['constructor', 'prototype', '__proto__'].includes(value);
const text = (value, max = 100) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;

/** @param {unknown} world @param {{headquarters?: string}} [options] @returns {string[]} */
export function validateCampaignWorld(world, options = {}) {
  const errors = validateWorldData(world, options);
  if (!errors.length) {
    errors.push(...validateCampaignPhysical(world.physical, world));
  }
  return errors;
}

export function validateCampaignDefinitionFields(value) {
  try {
    return validateDefinitionRecords(value);
  } catch {
    return ['Campaña: los datos contienen una estructura inválida.'];
  }
}
function validateDefinitionRecords(value) {
  if (!object(value)) {
    return ['Campaña: se necesita una definición.'];
  }
  const dataErrors = validateCampaignData(value);
  if (dataErrors.length) {
    return dataErrors;
  }
  const errors = [];
  if (
    value.scenario !== undefined &&
    !['generic-v1', 'granaderos-historical-v1'].includes(value.scenario)
  ) {
    errors.push('Campaña: escenario incompatible.');
  }
  if (value.world !== undefined) {
    errors.push(
      ...validateCampaignWorld(value.world, {
        headquarters: value.headquarters ?? value.world?.defaultHeadquarters,
      }),
    );
  }
  if (
    value.campaignRoles === undefined &&
    object(value.world?.defaultRoles) &&
    Array.isArray(value.characters)
  ) {
    const characters = new Set(value.characters.map((c) => c?.id));
    for (const character of Object.values(value.world.defaultRoles)) {
      if (character !== null && !characters.has(character))
        {errors.push('Funciones de campaña: el personaje asignado por el mapa no existe.');}
    }
  }
  if (value.maps !== undefined && !object(value.maps)) {
    errors.push('Campaña: el catálogo de sectores no es válido.');
  }
  if (object(value.maps)) {
    for (const [key, doc] of Object.entries(value.maps)) {
      if (
        !id(key) ||
        !object(doc) ||
        doc.id !== key ||
        doc.width !== 20 ||
        doc.height !== 16 ||
        ![1, 2].includes(doc.schemaVersion) ||
        !['terrain', 'features', 'buildings', 'props', 'spawns', 'exits', 'items', 'lights'].every(
          (k) => Array.isArray(doc[k]),
        )
      )
        {errors.push(`Campaña: el mapa ${key} no tiene una definición táctica válida.`);}
    }
    if (!errors.length && value.world) {
      for (const key of [
        ...value.world.sectors.map((s) => s.id),
        ...Object.keys(value.world.sceneExits ?? {}),
      ])
        {if (!Object.hasOwn(value.maps, key)) {errors.push(`Campaña: falta el mapa ${key}.`);}}
    }
  }
  if (value.presentation !== undefined) {
    errors.push(...validateCampaignPresentation(value.presentation, value));
  }
  if (value.assets !== undefined) {
    errors.push(...validateCampaignAssets(value.assets));
  }
  const origin = value.campaignOrigin;
  if (
    origin !== undefined &&
    (!object(origin) ||
      origin.version !== 1 ||
      origin.id !== value.id ||
      !id(origin.id) ||
      !text(origin.revision, 80))
  ) {
    errors.push('Campaña: la identidad de origen no es válida.');
  }
  if (
    origin !== undefined &&
    ['world', 'maps', 'presentation', 'assets'].some((key) => value[key] === undefined)
  ) {
    errors.push('Campaña: faltan definiciones del paquete instalado.');
  }
  if (origin !== undefined && !errors.length) {
    errors.push(...validateSelectedCampaignAssets(value.id, value.assets, [value]));
  }
  return errors;
}
