import {DEFAULT_CONTENT,DEFAULT_PRESENTATION} from '../campaigns/default.js';
import {FITTING_PATTERNS} from './weapon-fittings.js';

const definitionsFor=value=>value?.contentCampaign?.package??value?.campaignPackage??value;
export const usesGenericOfficerCreation=value=>{const d=definitionsFor(value);return d?.scenario==='generic-v1'||Boolean(d?.campaignStory);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=(value,max=800)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[<>\x00-\x1f]/u.test(value);
const choice=(id,name)=>({id,name});
const TRAIT_IDS=['cavalry_commander','guerrilla_tactician','gunsmith_artillerist','line_marksman'];
const CLASS_IDS=['gaucho','soldado','baqueano','artesano'];
const QUESTION_CHOICES={specialty:['rider','night','teacher','ambidextrous'],temperament:['optimistic','pessimistic','steady'],origin:['estancia','cabildo','workshop'],doctrine:TRAIT_IDS,crisis:['rescue','rally','flank']};
export const NEUTRAL_OFFICER_CREATION={
 classes:[{id:'gaucho',name:'Personaje',description:'Usá el equipo disponible en esta campaña.',weapon:null,blade:null}],
 questions:[{id:'specialty',label:'¿Qué destreza personal te distingue?',choices:[choice('rider','Conducir caballos'),choice('night','Reconocer el terreno de noche'),choice('teacher','Instruir a otras personas'),choice('ambidextrous','Usar ambas manos')]},{id:'temperament',label:'¿Cómo respondés después de un revés?',choices:[choice('optimistic','Confío en la recuperación'),choice('pessimistic','Preveo las dificultades'),choice('steady','Me concentro en la tarea')]}],
 commissionQuestions:[{id:'origin',label:'¿Dónde adquiriste tu formación?',choices:[choice('estancia','En el trabajo de campo'),choice('cabildo','En estudios y administración'),choice('workshop','En un taller')]},{id:'doctrine',label:'¿Qué disciplina guiará tu servicio?',choices:[choice('cavalry_commander','Mando montado'),choice('guerrilla_tactician','Exploración y movilidad'),choice('gunsmith_artillerist','Mecánica y artillería'),choice('line_marksman','Tiro disciplinado')]},{id:'crisis',label:'Un compañero cae bajo el fuego. ¿Cómo respondés?',choices:[choice('rescue','Acudo a socorrerlo'),choice('rally','Reúno al grupo'),choice('flank','Busco un flanco')]}],
 traits:TRAIT_IDS.map((id,index)=>({id,name:['Mando montado','Exploración y movilidad','Mecánica y artillería','Tiro disciplinado'][index],description:['Instrucción y maniobras a caballo.','Exploración y desplazamiento en el terreno.','Reparación y servicio de las piezas.','Puntería y tiro deliberado.'][index]})),
 defaults:{classId:'gaucho',portraitId:null},
 commission:{role:'Oficial',biography:'Personaje incorporado a la escuadra.',questionError:'Completá las tres preguntas de formación.',statusText:'se incorpora a la escuadra.',availableText:'Disponible para incorporarse.',weapon:null,doctrineWeapons:{}},
 registry:'Tu personaje',
 biography:'Personaje ficticio creado por el jugador. Sus atributos fueron asignados al comenzar la campaña.',
};

export function campaignOfficerCreation(context=null){
 const d=definitionsFor(context),base=usesGenericOfficerCreation(context)?NEUTRAL_OFFICER_CREATION:DEFAULT_PRESENTATION.officerCreation??NEUTRAL_OFFICER_CREATION,authored=d?.presentation?.officerCreation;
 if(!object(authored))return base;
 return {...base,...authored,defaults:{...base.defaults,...authored.defaults},commission:{...base.commission,...authored.commission}};
}

// A creator assigns campaign-local weapon IDs. Omitted generic assignments
// are unarmed, even when the package happens to retain a familiar numeric ID.
export function officerCreationWeapon(reference,context=null){
 if(reference===null||reference===undefined)return null;
 const d=definitionsFor(context),weapons=d?.weapons??(usesGenericOfficerCreation(context)?[]:DEFAULT_CONTENT.weapons);
 const weapon=weapons.find(w=>w.id===reference);if(!weapon)throw Error('El equipo inicial del personaje no existe en esta campaña.');return weapon;
}

const validClassFitting=(cls,weapons)=>cls.bladeFittingPattern===undefined||
 typeof cls.bladeFittingPattern==='string'&&Object.hasOwn(FITTING_PATTERNS,cls.bladeFittingPattern)&&
 weapons.find(w=>w.id===cls.weapon)?.template===FITTING_PATTERNS[cls.bladeFittingPattern].host&&
 weapons.find(w=>w.id===cls.blade)?.template===FITTING_PATTERNS[cls.bladeFittingPattern].weapon;
// Only the new-character order issues this authored fitting. Reconstructing
// an officer or restoring an old save must not identify an existing blade.
export function officerStartingFitting(profile,context=null){
 const cls=profile?.version===2&&campaignOfficerCreation(context).classes.find(c=>c.id===profile.classId);
 if(!cls||cls.bladeFittingPattern===undefined)return null;
 if(!validClassFitting(cls,definitionsFor(context)?.weapons??DEFAULT_CONTENT.weapons))throw Error('La bayoneta inicial no corresponde al equipo de esta clase.');
 return cls.bladeFittingPattern;
}

export function validateOfficerCreation(value,content){
 if(value===undefined)return [];
 const errors=[],check=(ok,message)=>{if(!ok)errors.push(`Creación de personajes: ${message}`);};
 if(!object(value))return ['Creación de personajes: la presentación no es válida.'];
 check(Object.keys(value).every(key=>['classes','questions','commissionQuestions','traits','defaults','commission','biography','registry'].includes(key)),'opción desconocida.');
 const weaponIds=new Set((content?.weapons??[]).map(w=>w.id)),bladeIds=new Set((content?.weapons??[]).filter(w=>w.template>=1809).map(w=>w.id));
 const equipment=(reference,blade=false)=>reference===null||(blade?bladeIds:weaponIds).has(reference);
 if(value.classes!==undefined)check(Array.isArray(value.classes)&&value.classes.length>0&&value.classes.length<=CLASS_IDS.length&&new Set(value.classes.map(c=>c?.id)).size===value.classes.length&&value.classes.every(c=>object(c)&&Object.keys(c).every(k=>['id','name','description','weapon','blade','bladeFittingPattern'].includes(k))&&CLASS_IDS.includes(c.id)&&text(c.name,100)&&text(c.description)&&equipment(c.weapon)&&equipment(c.blade,true)&&validClassFitting(c,content?.weapons??[])),'clases o equipo local inválidos.');
 function questions(list,ids){return Array.isArray(list)&&list.length===ids.length&&new Set(list.map(q=>q?.id)).size===ids.length&&list.every(q=>object(q)&&Object.keys(q).every(k=>['id','label','choices'].includes(k))&&ids.includes(q.id)&&text(q.label,200)&&Array.isArray(q.choices)&&q.choices.length>0&&q.choices.length<=QUESTION_CHOICES[q.id].length&&new Set(q.choices.map(c=>c?.id)).size===q.choices.length&&q.choices.every(c=>object(c)&&Object.keys(c).length===2&&QUESTION_CHOICES[q.id].includes(c.id)&&text(c.name,200)));}
 if(value.questions!==undefined)check(questions(value.questions,['specialty','temperament']),'cuestionario personal inválido.');
 if(value.commissionQuestions!==undefined)check(questions(value.commissionQuestions,['origin','doctrine','crisis']),'cuestionario de formación inválido.');
 if(value.traits!==undefined)check(Array.isArray(value.traits)&&value.traits.length>0&&value.traits.length<=TRAIT_IDS.length&&new Set(value.traits.map(t=>t?.id)).size===value.traits.length&&value.traits.every(t=>object(t)&&Object.keys(t).length===3&&TRAIT_IDS.includes(t.id)&&text(t.name,100)&&text(t.description)),'especialidades inválidas.');
 if(value.defaults!==undefined){const classes=value.classes??NEUTRAL_OFFICER_CREATION.classes;check(object(value.defaults)&&Object.keys(value.defaults).every(k=>['classId','portraitId'].includes(k))&&(value.defaults.classId===undefined||classes.some(c=>c.id===value.defaults.classId))&&(value.defaults.portraitId===undefined||value.defaults.portraitId===null||text(value.defaults.portraitId,80)),'selección inicial inválida.');}
 if(value.commission!==undefined){const c=value.commission;check(object(c)&&Object.keys(c).every(k=>['role','biography','questionError','statusText','availableText','weapon','doctrineWeapons'].includes(k))&&['role','biography','questionError','statusText','availableText'].every(k=>c[k]===undefined||text(c[k]))&&(c.weapon===undefined||equipment(c.weapon))&&(c.doctrineWeapons===undefined||object(c.doctrineWeapons)&&Object.entries(c.doctrineWeapons).every(([id,ref])=>TRAIT_IDS.includes(id)&&equipment(ref))),'datos de incorporación inválidos.');}
 if(value.biography!==undefined)check(text(value.biography,1000),'biografía inválida.');
 if(value.registry!==undefined)check(text(value.registry,100),'registro inválido.');
 return errors;
}
