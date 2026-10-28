import { validateCampaignData } from './campaign-data-validation.js';
import { campaignRelativePath } from './campaign-assets.js';
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = (value) =>
  typeof value === 'string' &&
  /^[a-z][a-z0-9-]{0,79}$/.test(value) &&
  !['constructor', 'prototype'].includes(value);
const text = (value, max = 100) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const need = (ok, message) => {
  if (!ok) throw Error(message);
};
export function validateCampaignManifest(manifest) {
  const dataErrors = validateCampaignData(manifest);
  need(!dataErrors.length, dataErrors.join('\n'));
  need(
    object(manifest) && manifest.format === 'granaderos-campaign' && manifest.version === 1,
    'El manifiesto de campaña no es compatible.',
  );
  need(
    identifier(manifest.id) && text(manifest.name) && text(manifest.revision, 80),
    'La campaña necesita identidad, nombre y revisión.',
  );
  need(
    ['generic-v1', 'granaderos-historical-v1'].includes(manifest.scenario),
    'El escenario de campaña no es compatible.',
  );
  for (const key of ['content', 'world', 'maps', 'presentation', 'assets'])
    need(
      campaignRelativePath(manifest[key]) && manifest[key].endsWith('.json'),
      `La referencia ${key} no es válida.`,
    );
  return manifest;
}
export function validateCampaignRegistry(value) {
  const dataErrors = validateCampaignData(value);
  need(!dataErrors.length, dataErrors.join('\n'));
  need(
    object(value) &&
      value.format === 'granaderos-campaign-registry' &&
      value.version === 1 &&
      Array.isArray(value.campaigns) &&
      value.campaigns.length > 0 &&
      value.campaigns.length <= 100,
    'El catálogo de campañas no es compatible.',
  );
  const ids = new Set();
  for (const entry of value.campaigns) {
    need(
      object(entry) &&
        identifier(entry.id) &&
        !ids.has(entry.id) &&
        text(entry.name) &&
        text(entry.revision, 80) &&
        entry.manifest === `${entry.id}/manifest.json`,
      'La entrada de campaña no es válida.',
    );
    ids.add(entry.id);
  }
  return value;
}
