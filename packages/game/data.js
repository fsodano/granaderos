// Compatibility exports for the shipped campaign. Runtime campaign queries
// select the immutable installed package instead of modifying these defaults.
import {DEFAULT_WORLD,DEFAULT_CATALOGUE} from '../../content/campaigns/default.js';
export const OPERATIVES=structuredClone(DEFAULT_CATALOGUE.operatives);
export const WEAPONS=structuredClone(DEFAULT_CATALOGUE.weapons);
export const FACTIONS=structuredClone(DEFAULT_WORLD.factions);
export const THEATERS=structuredClone(DEFAULT_WORLD.theaters);
export const CAMPAIGN_SECTORS=structuredClone(DEFAULT_WORLD.sectors);
export const PHASES=structuredClone(DEFAULT_CATALOGUE.phases);
export const RESOURCE_NAMES=structuredClone(DEFAULT_CATALOGUE.resourceNames);
