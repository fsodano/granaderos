import {authoredPresentation} from './content-character-presentation.js';
import {characterForOperative,operativeIdForCharacter,legacyOperativeId,isContractCharacter} from './content-character-ids.js';
import {CIVIC_DEFAULTS} from './civic-recruits.js';
// Historical roles keep their original slots. New contract identities never
// acquire their numeric powers and need no entry in the built-in catalogue.
export function authoredOperative(state, operative) {
  const definition = characterForOperative(state,operative.id);
  if (!definition) return operative;
  return {
    ...operative,
    ...definition.attributes,
    ...authoredPresentation(definition),
    ...(definition.abilities===undefined?{}:{abilities:[...definition.abilities]}),
    ...(definition.traits===undefined?{}:{traits:definition.traits}),
    ...(definition.service===undefined?{}:{service:definition.service}),
    ...(definition.progression===undefined?{}:{progression:definition.progression}),
    ...(definition.ridingSkill===undefined&&definition.traits===undefined?{}:{ridingSkill:Math.max(definition.ridingSkill??operative.ridingSkill??0,(definition.traits??operative.traits??[]).includes('expert_rider')?80:0)}),
    recruitmentSource:isContractCharacter(definition)?'contract':'encounter',
    hp: definition.attributes.maxHp,
    name: definition.name,
    nickname: definition.nickname,
    role: definition.role,
    biography: definition.biography,
    monthlyPay: definition.monthlyPay,
    weeklyPay: Math.ceil((definition.monthlyPay * 7) / 30),
    portraitId: definition.portrait,
    portrait: definition.portrait,
    contentId: definition.id,
  };
}
/** @returns {Array<ReturnType<typeof authoredOperative>>} */
export function authoredRoster(state,baseline){
 const content=state.contentCampaign?.package;if(!content)return baseline;
 return content.characters.map(c=>authoredOperative(state,baseline.find(o=>o.id===legacyOperativeId(c.id))??{
  ...CIVIC_DEFAULTS,id:operativeIdForCharacter(content,c.id),name:c.name,nickname:c.nickname,role:c.role,biography:c.biography,
  classId:'soldado',traits:[],ridingSkill:0,monthlyPay:c.monthlyPay,service:'contract',progression:'experience',
 }));
}
