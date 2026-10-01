import {authoredRoster} from './content-roster.js';
import {pendingHire} from './hiring-arrivals.js';
import {gainsExperience,isContractOperative} from './content-character-ids.js';
import {applyCharacterProfile} from './character-profile.js';
export * from './character-profile.js';
import {OPERATIVES} from './data.js';
import {CIVIC_RECRUITS,CIVIC_DEFAULTS} from './civic-recruits.js';
export {CIVIC_RECRUITS} from './civic-recruits.js';
export const OFFICER_TRAITS=[
 {id:'cavalry_commander',name:'Comandante de caballería',description:'Instrucción ecuestre, mando y maniobras a caballo.'},
 {id:'guerrilla_tactician',name:'Táctico de guerrillas',description:'Exploración, ocultamiento y movilidad en terreno quebrado.'},
 {id:'gunsmith_artillerist',name:'Maestro armero y artillero',description:'Cuidado de llaves, reparación y servicio de las piezas.'},
 {id:'line_marksman',name:'Tirador de línea',description:'Puntería deliberada, tiro disciplinado y armas rayadas.'},
];
export const OFFICER_QUESTIONS=[
 {id:'origin',label:'¿Dónde adquiriste tu formación?',choices:[{id:'estancia',name:'En una estancia: caballos y trabajo de campo'},{id:'cabildo',name:'En el Cabildo: estudios y administración'},{id:'workshop',name:'En un taller: herramientas y metalurgia'}]},
 {id:'doctrine',label:'¿Qué disciplina guiará tu servicio?',choices:OFFICER_TRAITS.map(t=>({id:t.id,name:t.name}))},
 {id:'crisis',label:'Un compañero cae bajo el fuego. ¿Cómo respondes?',choices:[{id:'rescue',name:'Acudo a socorrerlo'},{id:'rally',name:'Reúno al grupo y sostengo la posición'},{id:'flank',name:'Busco un flanco para aliviar la presión'}]},
];
export function createOfficerRecord(name,answers,profile){
 if(typeof name!=='string'||name.trim().length<2||name.trim().length>30||/[<>\x00-\x1f]/u.test(name))throw Error('Escribe un nombre de entre 2 y 30 caracteres, sin símbolos de marcado.');
 if(!answers||OFFICER_QUESTIONS.some(q=>!q.choices.some(c=>c.id===answers[q.id])))throw Error('Completa las tres preguntas del examen del Cabildo.');
 const op={...CIVIC_DEFAULTS,id:1000,name:name.trim(),nickname:name.trim().slice(0,14),role:'Oficial del Cabildo',biography:'Oficial incorporado mediante el Examen de Aptitud del Cabildo de Buenos Aires.',monthlyPay:300,weeklyPay:70,hp:78,maxHp:78,agility:72,dexterity:72,strength:70,leadership:65,wisdom:75,marksmanship:65,mechanical:35,explosives:30,medical:35,weapon:1803,traits:[answers.doctrine]};
 const boosts={estancia:{strength:10,agility:6},cabildo:{wisdom:10,leadership:8},workshop:{mechanical:25,dexterity:8},rescue:{medical:20,strength:5},rally:{leadership:12,wisdom:5},flank:{agility:10,marksmanship:5}};
 for(const response of [answers.origin,answers.crisis])for(const[k,v]of Object.entries(boosts[response]))op[k]=Math.min(95,op[k]+v);
 if(answers.doctrine==='line_marksman'){op.marksmanship+=12;op.weapon=1802;}
 if(answers.doctrine==='gunsmith_artillerist'){op.mechanical+=15;op.explosives+=15;}
 return applyCharacterProfile(op,answers,profile);
}
export function rosterFor(state){
 const base=authoredRoster(state,[...OPERATIVES,...CIVIC_RECRUITS]);if(state.officer)base.push(createOfficerRecord(state.officer.name,state.officer.answers,state.officer.profile));
 return base.map(op=>{
   const progress=state.operativeState?.[op.id],xp=progress?.xp??0,level=1+Math.min(9,Math.floor(xp/100));
   if(!gainsExperience(state,op))return {...op,xp,level:1};
   const grown={...op,xp,level};for(const field of ['maxHp','agility','dexterity','strength','leadership','wisdom','marksmanship','mechanical','explosives','medical'])grown[field]=Math.min(state.contentCampaign?Math.max(95,op[field]):95,op[field]+(level-1)*(field==='marksmanship'?4:2));return grown;
 });
}
export function civicStatus(state,id){
 id=Number(id);
 const op=rosterFor(state).find(o=>o.id===id&&isContractOperative(state,o)),record=state.operativeState[id];
 const reason=!op?'No existe ese voluntario.':state.recruited.includes(id)?'Ya se encuentra en tus filas.':pendingHire(state,id)?'Este contratado ya está en camino.':!record?.alive?'Ha caído en combate.':record.captured?'Este personaje está cautivo.':record.serviceEquipmentReturn?'Recogé todo el equipo que dejó esta persona antes de volver a contratarla.':null;
 return {available:!reason,reason:reason??'Disponible en el boletín del Cabildo.'};
}
