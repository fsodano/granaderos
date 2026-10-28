import {DEFAULT_WORLD} from '../../content/campaigns/default.js';

// Compatibility callers use the installed stock world. A selected campaign
// with no physical sources has no caches, tools, or arsenal discoveries.
export const DEFAULT_PHYSICAL=DEFAULT_WORLD.physical;
const EMPTY_PHYSICAL=Object.freeze({version:1,caches:Object.freeze({}),arsenals:Object.freeze({}),environment:Object.freeze({})});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const own=(value,key)=>object(value)&&Object.hasOwn(value,key);
export function physicalSourcesFor(value){
 if(own(value,'finiteResourceDefinitions'))return value.finiteResourceDefinitions;
 const definitions=value?.contentCampaign?.package??value?.campaignPackage??value;
 if(own(definitions,'world'))return definitions.world?.physical??EMPTY_PHYSICAL;
 if(definitions?.scenario==='generic-v1'||definitions?.campaignStory)return EMPTY_PHYSICAL;
 return DEFAULT_PHYSICAL;
}
export const finiteCachesFor=value=>physicalSourcesFor(value).caches;
export const finiteArsenalsFor=value=>physicalSourcesFor(value).arsenals;
export const finiteEnvironmentFor=value=>physicalSourcesFor(value).environment;
