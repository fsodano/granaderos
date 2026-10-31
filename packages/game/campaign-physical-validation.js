import { DEFAULT_WORLD } from '../../content/campaigns/default.js';
import { validateCampaignPhysical as validatePhysicalRecords } from '../campaign-format/physical-schema.js';
import { ARTILLERY } from './artillery-definitions.ts';
import { validateEnvironment } from './environment-interactions.ts';

export function validateCampaignPhysical(value, world = DEFAULT_WORLD) {
  const errors = validatePhysicalRecords(value, world);
  if (errors.length || value === undefined) {
    return errors;
  }
  const checkEnvironment = (target) => {
    try {
      validateEnvironment(target);
    } catch (error) {
      errors.push(`Fuentes físicas: ${error.message}`);
    }
  };
  for (const cache of Object.values(value.caches)) {
    checkEnvironment({ type: 'chest', contents: cache.contents });
  }
  for (const source of Object.values(value.arsenals)) {
    for (const piece of source.pieces) {
      if (!Object.hasOwn(ARTILLERY, piece.type)) {
        errors.push(`Fuentes físicas: pieza inválida: ${piece.id}.`);
      }
    }
  }
  for (const environment of Object.values(value.environment)) {
    for (const door of environment.doors) {
      checkEnvironment(door);
    }
    for (const entry of environment.containers) {
      checkEnvironment(entry.configuration);
    }
  }
  return errors;
}
