import {campaignActors,characterForActor,hasGenericCharacterDefinitions} from './content-character-ids.js';
import {validCharacterAbilities} from './character-abilities.js';

export function validateAbilityReferences(state,value=state){
 const need=ok=>{if(!ok)throw Error('Las habilidades guardadas no coinciden con el personaje de la campaña.');};
 // Progress records are mutable and get overlaid on roster entries at deployment.
 // Capabilities belong only to the immutable character definition.
 for(const record of Object.values(value.operativeState??{}))need(record.abilities===undefined);
 for(const actor of [...campaignActors(value),...campaignActors(value.pendingBattle?.resumeSnapshot??{})]){
  const definition=characterForActor(state,actor),generic=hasGenericCharacterDefinitions(state.contentCampaign?.package),expected=definition?definition.abilities??(generic?[]:undefined):undefined;
  if(definition&&generic)need(actor.genericCharacter===true);
  if(definition&&actor.contentId!==undefined)need(actor.contentId===definition.id);
  if(expected===undefined){need(actor.abilities===undefined);continue;}
  need(validCharacterAbilities(actor.abilities)&&actor.abilities.length===expected.length&&expected.every(id=>actor.abilities.includes(id)));
 }
}

// Legacy authored stories keep their numeric identities. Fill only omitted
// actor fields so a saved slot cannot imply historical abilities or prose.
export function restoreGenericCharacterReferences(state,value=state){
 if(!hasGenericCharacterDefinitions(state.contentCampaign?.package))return;
 for(const actor of [...campaignActors(value),...campaignActors(value.pendingBattle?.resumeSnapshot??{})]){
  const definition=characterForActor(state,actor);if(!definition)continue;
  if(actor.genericCharacter===undefined)actor.genericCharacter=true;
  if(definition.abilities===undefined&&actor.abilities===undefined)actor.abilities=[];
 }
}
