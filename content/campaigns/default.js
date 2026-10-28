// Compatibility defaults for callers which have not selected a campaign.
// Runtime campaign queries use their pinned package instead of these defaults.
import world from './granaderos/world.json' with {type:'json'};
import presentation from './granaderos/presentation.json' with {type:'json'};
import catalogue from './granaderos/catalogue.json' with {type:'json'};
export const DEFAULT_WORLD=world;
export const DEFAULT_PRESENTATION=presentation;
export const DEFAULT_CATALOGUE={...catalogue,characterPortraits:presentation.characterPortraits};

import content from './granaderos/content.json' with {type:'json'};
export const DEFAULT_CONTENT=content;

import {maps} from './granaderos/maps/library.js';
export const DEFAULT_MAPS=maps;
