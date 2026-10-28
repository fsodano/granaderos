import {DEFAULT_CATALOGUE} from '../../content/campaigns/default.js';

export const PORTRAIT_GENDERS=[{id:'woman',name:'Mujeres'},{id:'man',name:'Hombres'}];
export const PORTRAIT_ROLES=[
 {id:'soldier',name:'Soldados'},{id:'officer',name:'Oficiales'},
 {id:'scout',name:'Exploración'},{id:'gaucho',name:'Gauchos y gauchas'},
 {id:'artisan',name:'Artesanos y artesanas'},{id:'medic',name:'Medicina'},
];
export const PORTRAIT_SKIN_TONES=[{id:'light',name:'Clara'},{id:'brown',name:'Morena'},{id:'dark',name:'Oscura'}];
export const PORTRAITS_PER_COMBINATION=5;
// Surplus faces remain valid for old saves and for their paid recruit owners.
// The chooser uses exactly five faces in each gender/type/skin-tone group.
export const LEGACY_ONLY_PORTRAIT_IDS=Object.freeze([...DEFAULT_CATALOGUE.legacyOnlyPortraitIds]);

export const CHARACTER_PORTRAITS=structuredClone(DEFAULT_CATALOGUE.characterPortraits);

export const SELECTABLE_CHARACTER_PORTRAITS=CHARACTER_PORTRAITS.filter(portrait=>portrait.selectable);

const portraitsById=new Map(CHARACTER_PORTRAITS.map(portrait=>[portrait.id,portrait]));
export const characterPortrait=id=>portraitsById.get(id);
