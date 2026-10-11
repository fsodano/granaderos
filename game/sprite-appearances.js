import {DEFAULT_CATALOGUE} from '../campaigns/default.js';

// Shared visual archetypes, not one sprite set per named character.
// These traits describe the actual art to author; they are not inferred from
// names, nationality, stats, or a character's current health or animation.
const rows = [
 ['granadero','man','regular','olive','black','short','shako','navy-uniform','Granadero infantry; ivory crossbelts, crimson facings, compact pack'],
 ['royalist','man','regular','fair','brown','short','shako','white-uniform','Royalist infantry; off-white coat and trousers, red facings, black leather'],
 ['militia','man','broad','dark','black','cropped','none','navy-uniform','Broad militia infantryman; plain navy coat, red collar, ivory straps'],
 ['blue-officer','man','regular','olive','black','sideburns','none','blue-officer','Navy officer coat; modest brass shoulder trim, red collar, dark trousers'],
 ['scarlet-officer','man','regular','fair','gray','sideburns','none','scarlet-officer','Weathered scarlet officer coat, dark facings, cream stock, gray trousers'],
 ['rifleman','man','lean','fair','gray','sideburns','none','green-uniform','Lean veteran; dark green rifle coat with black braid, gray hair at temples'],
 ['naval','man','regular','fair','auburn','wavy','none','naval-jacket','Worn navy sailor jacket, loose linen collar, neckcloth and plain trousers'],
 ['gaucho','man','regular','tan','black','mustache','felt-hat','ochre-poncho','Weathered gaucho; ochre wool poncho, red scarf, felt hat, riding boots'],
 ['scout','man','lean','copper','black','tied-back','none','charcoal-poncho','Lean scout; dark woven poncho, tied-back hair, practical gaiters'],
 ['artisan','man','broad','tan','gray','beard','none','leather-apron','Broad artisan; brown leather apron over cream linen, beard, sturdy boots'],
 ['worker','man','lean','olive','brown','short','none','linen-shirt','Young adult worker; plain linen shirt, brown waistcoat, leather apron straps, dark trousers'],
 ['civilian','man','regular','olive','brown','short','felt-hat','brown-jacket','Civilian traveller; brown jacket and waistcoat, linen shirt, simple felt hat'],
 ['surgeon','man','lean','fair','gray','receding','none','brown-coat','Older surgeon; brown long coat, cream cravat, spectacles, small leather satchel'],
 ['friar','man','broad','olive','black','tonsure','none','brown-habit','Workshop friar; practical brown wool habit, rope belt and worn shoes'],
 ['woman-scout','woman','athletic','copper','black','braid','none','olive-jacket','Woman scout; tied dark braid, olive travel jacket, linen shirt, practical trousers'],
 ['woman-officer','woman','athletic','copper','black','braid','none','blue-officer','Woman partisan officer; navy coat, red collar, dark braid and riding trousers'],
 ['woman-shawl','woman','regular','olive','brown','bun','none','burgundy-shawl','Woman civilian specialist; burgundy shawl, cream blouse, practical long skirt'],
 ['woman-headscarf','woman','sturdy','dark','black','covered','linen-wrap','indigo-shawl','Woman field medic; cream linen headwrap, indigo shawl and practical long skirt'],
 ['woman-elder','woman','regular','copper','gray','braid','none','charcoal-shawl','Older woman practitioner; gray-streaked braid, charcoal shawl, plain long skirt'],
];
const ORIGINAL_SPRITE_APPEARANCES = Object.freeze(Object.fromEntries(rows.map(([id,gender,body,skin,hairColor,hair,headwear,clothing,description])=>[id,Object.freeze({id,gender,body,skin,hairColor,hair,headwear,clothing,description})])));

// Seven authoring families. Military keeps both existing faction variants.
export const SPRITE_FAMILIES = Object.freeze({
 military:Object.freeze({label:'Military',base:'granadero',variants:Object.freeze(['granadero','royalist'])}),
 worker:Object.freeze({label:'Worker',base:'worker',variants:Object.freeze(['worker'])}),
 'civilian-man':Object.freeze({label:'Civilian man',base:'surgeon',variants:Object.freeze(['surgeon'])}),
 'poncho-wearer':Object.freeze({label:'Poncho wearer',base:'gaucho',variants:Object.freeze(['gaucho'])}),
 friar:Object.freeze({label:'Friar',base:'friar',variants:Object.freeze(['friar'])}),
 'woman-combatant':Object.freeze({label:'Woman combatant',base:'woman-scout',variants:Object.freeze(['woman-scout'])}),
 'civilian-woman':Object.freeze({label:'Civilian woman',base:'woman-shawl',variants:Object.freeze(['woman-shawl'])}),
});
export const SPRITE_APPEARANCE_ALIASES = Object.freeze({
 militia:'granadero','blue-officer':'granadero','scarlet-officer':'granadero',rifleman:'granadero',naval:'worker',artisan:'worker',
 civilian:'surgeon',scout:'gaucho','woman-officer':'woman-scout',
 'woman-headscarf':'woman-shawl','woman-elder':'woman-shawl',
});
export const SPRITE_APPEARANCES = Object.freeze(Object.fromEntries(
 Object.values(SPRITE_FAMILIES).flatMap(family=>family.variants.map(id=>[id,ORIGINAL_SPRITE_APPEARANCES[id]]))
));
export function canonicalSpriteAppearance(id){
 const canonical=Object.hasOwn(SPRITE_APPEARANCE_ALIASES,id)?SPRITE_APPEARANCE_ALIASES[id]:id;
 return Object.hasOwn(SPRITE_APPEARANCES,canonical)?canonical:undefined;
}
const canonicalMappings=entries=>Object.freeze(Object.fromEntries(Object.entries(entries).map(([id,appearance])=>[id,canonicalSpriteAppearance(appearance)])));

// The portrait roster was visually reviewed. A named character selects a
// reusable combination; no unique animation or atlas is required for that ID.
export const ROSTER_SPRITE_APPEARANCES=canonicalMappings(DEFAULT_CATALOGUE.rosterSpriteAppearances);
export const CUSTOM_SPRITE_APPEARANCES=canonicalMappings(DEFAULT_CATALOGUE.customSpriteAppearances);

export function spriteAppearance(unit, kind='soldier') {
 // An explicit saved appearance is stable across roster changes and can also
 // be used by authored NPCs. Ignore unknown values in older or edited saves.
 const explicit=canonicalSpriteAppearance(unit.spriteAppearance);
 if(explicit)return explicit;
 // Generic actors do not infer a historical body or uniform from a legacy
 // numeric slot, civilian status, or a faction change after capture.
 if(unit.genericCharacter)return 'worker';
 // Authored visual selections take precedence over faction defaults. Ordinary
 // enemies without a selection retain their existing military appearance.
 if(unit.side==='enemy'&&kind!=='civilian')return 'royalist';
 if(kind==='civilian')return 'surgeon';
 if(unit.side==='enemy')return 'royalist';
 if(Number(unit.id)===1000){
  const portraitId=Number(unit.portraitId);
  return CUSTOM_SPRITE_APPEARANCES[unit.portraitId]??(Number.isInteger(portraitId)&&portraitId>=100&&portraitId<=147?ROSTER_SPRITE_APPEARANCES[portraitId]:undefined)??'granadero';
 }
 return ROSTER_SPRITE_APPEARANCES[unit.id]??'granadero';
}
