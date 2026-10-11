import {DEFAULT_MAPS} from '../campaigns/default.js';
import {campaignDefinitions} from './campaign-definition.js';
export const MAP_LIBRARY=DEFAULT_MAPS;
export const mapLibrary=context=>campaignDefinitions(context)?.maps??DEFAULT_MAPS;
