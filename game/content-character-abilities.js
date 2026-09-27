import {campaignActors,characterForActor} from './content-character-ids.js';
import {validCharacterAbilities} from './character-abilities.js';

export function validateAbilityReferences(state,value=state){
 const need=ok=>{if(!ok)throw Error('Las habilidades guardadas no coinciden con el personaje de la campaña.');};
 // Progress records are mutable and get overlaid on roster entries at deployment.
 // Capabilities belong only to the immutable character definition.
 for(const record of Object.values(value.operativeState??{}))need(record.abilities===undefined);
 for(const actor of campaignActors(value)){
  const definition=characterForActor(state,actor),expected=definition?.abilities;
  if(definition&&actor.contentId!==undefined)need(actor.contentId===definition.id);
  if(expected===undefined){need(actor.abilities===undefined);continue;}
  need(validCharacterAbilities(actor.abilities)&&actor.abilities.length===expected.length&&expected.every(id=>actor.abilities.includes(id)));
 }
}
