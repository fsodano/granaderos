// Independent of uniform, faction, equipment, posture, and health.
// Values are visual palettes, not ancestry or gameplay attributes.
export const SKIN_PALETTES=Object.freeze({
 light:Object.freeze({label:'Clara',r:[.06,.27,.52,.78,.98],g:[.04,.15,.34,.58,.82],b:[.03,.09,.22,.4,.64]}),
 brown:Object.freeze({label:'Morena',r:[.04,.18,.36,.57,.78],g:[.025,.08,.19,.33,.54],b:[.018,.04,.10,.19,.34]}),
 dark:Object.freeze({label:'Oscura',r:[.025,.08,.16,.29,.50],g:[.018,.04,.08,.16,.32],b:[.014,.025,.05,.10,.20]}),
});
// Existing portrait art direction for the named historical cast.
const historical={0:'brown',1:'brown',2:'light',3:'dark',4:'light',5:'light',6:'light',7:'dark',8:'brown',9:'brown',10:'light',11:'light',57:'light'};
import {ROSTER_SKIN_TONES} from './sprite-skin-roster.js';
import {characterPortrait} from './character-portraits.js';
export function spriteSkinTone(unit){
 const explicit=({white:'light',black:'dark'})[unit.skinTone]??unit.skinTone;
 if(Object.hasOwn(SKIN_PALETTES,explicit))return explicit;
 const avatarTone=Number(unit.id)===1000?characterPortrait(unit.portraitId)?.spriteSkinTone:undefined;
 if(avatarTone)return avatarTone;
 // Reusing a recruit's portrait also reuses that portrait's palette. Keep
 // avatar and legacy officer IDs on their existing stable fallback.
 const portraitId=Number(unit.portraitId),id=Number(unit.id)===1000&&Number.isInteger(portraitId)&&portraitId>=100&&portraitId<=147?portraitId:unit.id;
 if(Object.hasOwn(historical,id))return historical[id];
 if(Object.hasOwn(ROSTER_SKIN_TONES,id))return ROSTER_SKIN_TONES[id];
 // Stable ID selection also works for saved NPCs and enemy units. Never use RNG
 // here: drawing another frame or reloading a save cannot change a person's skin.
 let hash=2166136261;for(const c of String(id??unit.portraitId??'default'))hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
 return ['light','brown','dark'][hash%3];
}
