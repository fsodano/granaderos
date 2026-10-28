export const PROFILE_ATTRIBUTES=[['maxHp','Salud'],['agility','Agilidad'],['dexterity','Destreza'],['strength','Fuerza'],['leadership','Liderazgo'],['wisdom','Sabiduría'],['marksmanship','Puntería'],['mechanical','Mecánica'],['explosives','Pólvora y artillería'],['medical','Medicina']].map(([id,name])=>({id,name}));
import {campaignCharacterPortrait,campaignCharacterPortraits,NEUTRAL_CHARACTER_PORTRAIT} from './campaign-portraits.js';
import {campaignOfficerCreation,officerCreationWeapon} from './campaign-officer-creation.js';
import {weaponMetadata} from './weapon-definition.js';
import {canonicalSpriteAppearance} from './sprite-appearances.js';
import {CRITICAL_HEALTH} from './actor-condition.js';
export {CHARACTER_PORTRAITS,SELECTABLE_CHARACTER_PORTRAITS,PORTRAIT_GENDERS,PORTRAIT_ROLES,PORTRAIT_SKIN_TONES,PORTRAITS_PER_COMBINATION} from './character-portraits.js';
export const PROFILE_POINTS=550;
export const MIN_OFFICER_HEALTH=CRITICAL_HEALTH;
export const CHARACTER_CLASSES=structuredClone(campaignOfficerCreation().classes).map(c=>({...c,weapon:officerCreationWeapon(c.weapon)?.template??0,blade:officerCreationWeapon(c.blade)?.template}));
export const PROFILE_QUESTIONS=structuredClone(campaignOfficerCreation().questions);
export const defaultProfile=(context=null)=>{const creation=campaignOfficerCreation(context),portraits=campaignCharacterPortraits(context),portrait=portraits.find(p=>p.id===creation.defaults.portraitId)??portraits.find(p=>p.selectable!==false)??portraits[0]??NEUTRAL_CHARACTER_PORTRAIT;return {version:2,classId:creation.classes.find(c=>c.id===creation.defaults.classId)?.id??creation.classes[0].id,portraitId:portrait.id,attributes:Object.fromEntries(PROFILE_ATTRIBUTES.map(a=>[a.id,55]))};};
// Apply this only to new commissions. Earlier valid profiles remain unchanged
// when the roster or a saved campaign reconstructs their officer.
export function validateOfficerCreationHealth(profile){
 if(profile?.version===2&&(!Number.isInteger(profile.attributes?.maxHp)||profile.attributes.maxHp<MIN_OFFICER_HEALTH))throw Error(`La salud inicial debe tener al menos ${MIN_OFFICER_HEALTH} puntos para que tu personaje esté consciente.`);
}
export function applyCharacterProfile(op,answers,profile,context=null){
 if(profile===undefined)return op;
 if(profile?.nickname!==undefined&&(typeof profile.nickname!=='string'||profile.nickname.length>16||/[<>\x00-\x1f]/u.test(profile.nickname)))throw Error('El apodo debe tener hasta 16 caracteres, sin símbolos de marcado.');
 const creation=campaignOfficerCreation(context),cls=creation.classes.find(c=>c.id===profile?.classId),portrait=campaignCharacterPortrait(profile?.portraitId,context);
 if(profile?.version!==2||!cls||!portrait)throw Error('Elegí una clase y un retrato válidos.');
 if(creation.questions.some(q=>!q.choices.some(c=>c.id===answers?.[q.id])))throw Error('Completá el cuestionario personal.');
  if(!profile.attributes||Object.keys(profile.attributes).length!==PROFILE_ATTRIBUTES.length||PROFILE_ATTRIBUTES.some(a=>!Number.isInteger(profile.attributes[a.id])||profile.attributes[a.id]<0||profile.attributes[a.id]>85)||Object.values(profile.attributes).reduce((a,b)=>a+b,0)!==PROFILE_POINTS)throw Error('Distribuí exactamente 550 puntos: cada atributo debe quedar entre 0 y 85.');
 const weapon=officerCreationWeapon(cls.weapon,context),blade=officerCreationWeapon(cls.blade,context),content=context?.contentCampaign?.package??context?.campaignPackage??context;
 return {...op,...profile.attributes,nickname:profile.nickname?.trim()||op.nickname,hp:profile.attributes.maxHp,role:cls.name,classId:cls.id,weapon:weapon?.template??0,blade:blade?.template,weaponMetadata:weapon&&content?.weapons?weaponMetadata(weapon):undefined,bladeMetadata:blade&&content?.weapons?weaponMetadata(blade):undefined,profileRegistry:creation.registry,portrait:portrait.src,portraitId:profile.portraitId,...(canonicalSpriteAppearance(portrait.spriteAppearance)?{spriteAppearance:canonicalSpriteAppearance(portrait.spriteAppearance)}:{}),...(['light','brown','dark'].includes(portrait.spriteSkinTone??portrait.skinTone)?{skinTone:portrait.spriteSkinTone??portrait.skinTone}:{}),monthlyPay:0,weeklyPay:0,personality:answers.temperament,ridingSkill:answers.specialty==='rider'?80:answers.origin==='estancia'?55:20,origin:answers.origin,crisisResponse:answers.crisis,traits:[answers.doctrine,...(answers.origin==='workshop'?['workshop_training']:answers.origin==='cabildo'?['teacher']:[]),...(answers.crisis==='rescue'?['field_rescuer']:answers.crisis==='rally'?['steadfast']:['guerrilla_tactician']),...(answers.specialty==='night'?['night_vision']:answers.specialty==='teacher'?['teacher']:answers.specialty==='ambidextrous'?['ambidextrous']:['expert_rider'])],biography:creation.biography};
}
