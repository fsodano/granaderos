import {OPERATIVES} from './data.js';
import {CIVIC_RECRUITS} from './civic-recruits.js';
import {characterProfile} from './characters.js';
import {legacyOperativeId,isContractCharacter,characterForActor,campaignActors} from './content-character-ids.js';
import {spriteAppearance} from './sprite-appearances.js';
import {canonicalContent} from './content-identity.js';

export const SPEECH_LABELS={hired:'Al incorporarse',contact:'Al detectar enemigos',cleared:'Al asegurar el sector',wounded:'Al recibir una herida',exhausted:'Al caer por agotamiento',death:'Al morir',ending:'Al terminar la campaña'};
export const SPEECH_LINE_LIMIT=800;
export const APPEARANCE_LABELS={granadero:'Uniforme de granadero',royalist:'Uniforme realista',worker:'Trabajador',surgeon:'Civil',gaucho:'Poncho',friar:'Fraile','woman-scout':'Combatiente','woman-shawl':'Civil con mantón'};

// Effective editor values also support drafts written before these fields existed.
export function characterPresentationDefaults(character){
 const id=legacyOperativeId(character.id);
 const original=[...OPERATIVES,...CIVIC_RECRUITS].find(o=>o.id===id);
 const operative={...original,id:id??2000,contentId:character.id,biography:character.biography,
  recruitmentSource:isContractCharacter(character)?'contract':'encounter',traits:character.traits??original?.traits??[]};
 const profile=characterProfile(operative);
 return {personality:character.personality??profile.personality,speech:character.speech??profile.speech,spriteAppearance:character.spriteAppearance??spriteAppearance(operative)};
}

// Only explicitly authored fields are attached to runtime actors. This keeps
// older packages and their existing saved actors compatible.
export function authoredPresentation(character){
 const profile={...(character.personality===undefined?{}:{personality:character.personality}),...(character.speech===undefined?{}:{speech:{...character.speech}})};
 return {...(Object.keys(profile).length?{storyProfile:profile}:{}),...(character.spriteAppearance===undefined?{}:{spriteAppearance:character.spriteAppearance})};
}

export function validatePresentationReferences(state,value=state){
 const need=condition=>{if(!condition)throw Error('La voz o apariencia guardada no coincide con el personaje de la campaña.');};
 for(const actor of campaignActors(value)){
  if(!state.contentCampaign){need(actor.storyProfile===undefined);continue;}
  const definition=characterForActor(state,actor);
  if(!definition){need(actor.storyProfile===undefined);continue;}
  if(actor.contentId!==undefined)need(actor.contentId===definition.id);
  const expected=authoredPresentation(definition);
  for(const field of ['storyProfile','spriteAppearance'])need(canonicalContent(actor[field]??null)===canonicalContent(expected[field]??null));
 }
}
