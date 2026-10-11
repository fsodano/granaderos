// Original dramatic characterization and dialogue, not authenticated historical quotations.
import {CHARACTER_ABILITIES} from './character-abilities.js';
import {CONTENT_TRAITS} from './content-character-options.js';
import {DEFAULT_CATALOGUE} from '../campaigns/default.js';
// Events are stable identifiers shared by tactical and strategic presentation.
export const ATTRIBUTE_LABELS={maxHp:'Salud',agility:'Agilidad',dexterity:'Destreza',strength:'Fuerza',leadership:'Liderazgo',wisdom:'Sabiduría',marksmanship:'Puntería',mechanical:'Mecánica',explosives:'Pólvora y artillería',medical:'Medicina'};
export const SPEECH_EVENTS=['hired','contact','cleared','wounded','exhausted','death','ending'];
// Optional additions do not change older packages or their saved content identity.
export const OPTIONAL_SPEECH_EVENTS=['treated','near','interrupt'];
export const AUTHORABLE_SPEECH_EVENTS=[...SPEECH_EVENTS,...OPTIONAL_SPEECH_EVENTS];
export const CHARACTER_PROFILES=structuredClone(DEFAULT_CATALOGUE.characterProfiles);
function baseCharacterProfile(operative){if(Number(operative.id)===1000)return customProfile(operative);if(operative.contentId&&(!CHARACTER_PROFILES[operative.id]||operative.genericCharacter))return {personality:operative.biography||'Su historia se define durante la campaña.',skills:(operative.traits??[]).map(id=>CONTENT_TRAITS.find(t=>t.id===id)?.name??id),registry:operative.recruitmentSource==='encounter'?'Habitantes de la campaña':'Contratación de la campaña',speech:{hired:operative.recruitmentSource==='encounter'?'Me sumo a la escuadra.':'Acepto el contrato. Estoy listo.',contact:'Enemigo a la vista.',cleared:'Sector asegurado.',wounded:'Estoy herido. Necesito atención.',exhausted:'Necesito descansar.',death:'Continúen sin mí…',ending:'La campaña ha terminado.'}};if(operative.contentId&&operative.recruitmentSource==='contract')return {...CHARACTER_PROFILES[operative.id],skills:(operative.traits??[]).map(id=>CONTENT_TRAITS.find(t=>t.id===id)?.name??id)};return CHARACTER_PROFILES[operative.id]??{personality:'Oficial formado ante la comisión del Cabildo. Su carrera se define por las decisiones y experiencias de la campaña.',skills:operative.traits||[],registry:'Comisión del Cabildo',speech:{hired:'Acepto la comisión. Serviré con responsabilidad.',contact:'Enemigo a la vista. Prepárense.',cleared:'Sector asegurado. Revisen a los compañeros.',wounded:'Estoy herido. Necesito atención.',exhausted:'No puedo seguir así. Debo descansar.',death:'Continúen sin mí…',ending:'La campaña termina; nuestra responsabilidad continúa.'}};}
export function characterProfile(operative){
 const base=baseCharacterProfile(operative);
 const profile=operative.storyProfile?{...base,...operative.storyProfile}:base;
 return operative.abilities===undefined?profile:{...profile,skills:[...new Set([...operative.abilities.map(id=>CHARACTER_ABILITIES.find(a=>a.id===id)?.name??id),...(operative.traits??[]).map(id=>CONTENT_TRAITS.find(t=>t.id===id)?.name??id)])]};
}
export function speechFor(operative,event){return characterProfile(operative).speech[event]??null;}
// Descriptions follow explicit pinned capabilities. Personality prose and
// omitted older definitions cannot advertise a newly added gameplay effect.
export function characterAbilityDescriptions(operative){return CHARACTER_ABILITIES.filter(ability=>(operative?.abilities??[]).includes(ability.id));}

function customProfile(operative){
 const temper=operative.personality||'steady';
 const labels={cavalry_commander:'Mando de caballería',guerrilla_tactician:'Táctica de guerrillas',gunsmith_artillerist:'Armería y artillería',line_marksman:'Tiro de línea',ambidextrous:'Ambidiestro: dos pistolas sin penalización de puntería',expert_rider:'Jinete experto',night_vision:'Operaciones nocturnas',teacher:'Enseñanza',workshop_training:'Aprendizaje de taller',field_rescuer:'Socorro bajo fuego',steadfast:'Ánimo firme'};
 const personality={optimistic:'Optimista: encuentra motivos para perseverar incluso después de un revés. Comienza el combate con moral elevada.',pessimistic:'Pesimista: anticipa pérdidas y expresa sus dudas. Comienza el combate con menor moral.',steady:'Sereno: concentra su atención en la tarea inmediata y conserva una disposición equilibrada.'}[temper]||'Su carácter se define durante la campaña.';
 return {personality,skills:(operative.traits||[]).map(t=>labels[t]||t),registry:(operative.profileRegistry??'Tu personaje')+' · '+(operative.role||'Voluntario'),speech:{hired:temper==='optimistic'?'Podemos hacer algo bueno juntos.':temper==='pessimistic'?'Espero que sepamos a qué nos enfrentamos.':'Estoy listo para cumplir mi parte.',contact:temper==='optimistic'?'¡Firmes! Podemos contenerlos.':temper==='pessimistic'?'Ahí están. Cuidado: esto puede salir mal.':'Contacto. Revisen sus posiciones.',cleared:temper==='optimistic'?'Sabía que encontraríamos la manera.':temper==='pessimistic'?'Esta vez salimos. Revisemos las bajas.':'Sector despejado. Reorganicemos la escuadra.',wounded:'Estoy herido. Necesito una venda.',exhausted:'Necesito recuperar el aliento.',death:'Compañeros… sigan…',ending:'Ahora habrá que construir la paz.'}};
}
